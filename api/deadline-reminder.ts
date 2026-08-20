declare const process: any;
import { createClient } from '@supabase/supabase-js';
import { isNonWorkingDay, getThaiDateInfo } from './_utils/thaiHolidays';

// ── Helper: ส่งข้อความ Telegram พร้อม Fallback Plain Text ─────────────────────
async function sendTelegram(token: string, chatId: number | string, text: string, replyMarkup?: any): Promise<boolean> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: replyMarkup
      })
    });

    if (res.ok) return true;

    const errBody = await res.json().catch(() => ({})) as any;
    console.error('[DEADLINE-REMINDER] Telegram API error:', errBody);

    if (errBody?.description && (errBody.description.includes('entities') || errBody.description.includes('HTML') || errBody.description.includes('bad request'))) {
      const plainText = text.replace(/<\/?[^>]+(>|$)/g, '');
      const retryRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: plainText,
          disable_web_page_preview: true,
          reply_markup: replyMarkup
        })
      });
      return retryRes.ok;
    }

    return false;
  } catch (err) {
    console.error('[DEADLINE-REMINDER] sendTelegram network error:', err);
    return false;
  }
}

// ── Helper: แปลงวันที่เป็นภาษาไทย ────────────────────────────────────────────
function toThaiDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Bangkok'
    });
  } catch {
    return isoDate;
  }
}

// ── Helper: คำนวณจำนวนวันคงเหลือ ─────────────────────────────────────────────
function daysUntil(isoDate: string): number {
  const now = new Date();
  const target = new Date(isoDate);
  // เปรียบเทียบเฉพาะวันที่ (ไม่นับเวลา)
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diff = targetDay.getTime() - nowDay.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

// ── เครื่องหมาย urgency ───────────────────────────────────────────────────────
function daysEmoji(days: number): string {
  if (days <= 0) return '🔴 <b>เลยกำหนดแล้ว!</b>';
  if (days === 1) return '🟠 <b>พรุ่งนี้!</b>';
  if (days <= 3) return `🟡 อีก <b>${days} วัน</b>`;
  return `🟢 อีก <b>${days} วัน</b>`;
}

/** HTML escape ป้องกัน XSS/400 Error ใน Telegram HTML mode */
function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export default async function handler(req: Request): Promise<Response> {
  // ✅ ตรวจสอบ Authorization Header / Secret Key
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const url = new URL(req.url || 'http://localhost');
  const querySecret = url.searchParams.get('secret') || url.searchParams.get('key');
  const isForce = url.searchParams.get('force') === 'true';

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // ✅ ตรวจสอบวันทำงาน (ข้ามเสาร์-อาทิตย์ และวันหยุดนักขัตฤกษ์ไทย)
  const dateInfo = getThaiDateInfo();
  const nonWorkingCheck = isNonWorkingDay();

  if (!isForce && nonWorkingCheck.isNonWorking) {
    console.log(`[DEADLINE-REMINDER] Skipped: ${nonWorkingCheck.reason}`);
    return new Response(JSON.stringify({
      message: `Skipped: ${nonWorkingCheck.reason}`,
      date: dateInfo.thaiDateStr,
      isHoliday: dateInfo.isHoliday,
      holidayName: dateInfo.holidayName || null
    }), { status: 200 });
  }

  try {
    // ── 1. ดึง settings ของทุกโรงเรียน ────────────────────────────────────────
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase credentials' }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: allSettings } = await supabase
      .from('settings')
      .select('telegram_bot_token, telegram_group_id');

    if (!allSettings || allSettings.length === 0) {
      return new Response(JSON.stringify({ message: 'No school settings found' }), { status: 200 });
    }

    let totalSent = 0;

    for (const setting of allSettings) {
      const { telegram_bot_token: botToken, telegram_group_id: rawGroupId } = setting;
      if (!botToken || !rawGroupId) continue;

      // telegram_group_id เก็บรูปแบบ "centralId|proposalId"
      // Deadline Reminder ใช้กลุ่มส่วนกลาง (ส่วนแรก)
      const centralGroupId = rawGroupId.split('|')[0]?.trim();
      if (!centralGroupId) continue;
      const groupIdNum = parseInt(centralGroupId);
      if (isNaN(groupIdNum)) continue;


      // ── 2. ดึงหนังสือที่ action_deadline ภายใน 3 วัน ──────────────────────
      const today = new Date();
      const in3Days = new Date(today);
      in3Days.setDate(today.getDate() + 3);

      const { data: docs } = await supabase
        .from('incoming_docs')
        .select(`
          id,
          doc_number,
          doc_sequence,
          subject,
          action_deadline,
          status,
          suggested_assignee_id,
          teachers:suggested_assignee_id (prefix, first_name, last_name)
        `)
        .not('action_deadline', 'is', null)
        .lte('action_deadline', in3Days.toISOString())
        .neq('status', 'completed')
        .neq('status', 'closed')
        .order('action_deadline', { ascending: true })
        .limit(10);

      if (!docs || docs.length === 0) continue;

      // ── 3. สร้างข้อความแจ้งเตือน ───────────────────────────────────────────
      for (const doc of docs) {
        const days = daysUntil(doc.action_deadline);

        // ข้ามถ้าเกินกำหนดเกิน 1 วันแล้ว (แจ้งแค่ -1, 0, 1, 2, 3)
        if (days < -1) continue;

        const receiveNo = doc.doc_sequence
          ? `${doc.doc_sequence}`
          : (doc.doc_number || '-');

        const teacher = (doc as any).teachers;
        const teacherName = teacher
          ? `${teacher.prefix || ''}${teacher.first_name} ${teacher.last_name}`
          : 'ยังไม่ได้มอบหมาย';

        const thaiDeadline = toThaiDate(doc.action_deadline);
        const urgencyText = daysEmoji(days);

        let msg = `⏰ <b>แจ้งเตือน: ใกล้ครบกำหนดดำเนินการ</b>\n`;
        msg += `${urgencyText}\n\n`;
        msg += `📄 <b>หนังสือเลขรับ:</b> ${escapeHtml(receiveNo)}\n`;
        msg += `📝 <b>เรื่อง:</b> ${escapeHtml(doc.subject || '-')}\n`;
        msg += `🗓 <b>กำหนดส่ง:</b> ${thaiDeadline}\n`;
        msg += `🧑‍🏫 <b>ผู้รับผิดชอบ:</b> ${escapeHtml(teacherName)}\n`;


        if (days <= 0) {
          msg += `\n❗ <b>กรุณาดำเนินการและอัปเดตสถานะในระบบด่วน!</b>`;
        } else {
          msg += `\n⚠️ <b>กรุณาดำเนินการให้ทันกำหนดครับ</b>`;
        }

        const inlineButtons = {
          inline_keyboard: [
            [
              { text: '✅ ดำเนินการแล้ว', callback_data: `action=doc_complete&id=${doc.id}` },
              { text: '⏰ เลื่อน 3 วัน', callback_data: `action=doc_extend_3d&id=${doc.id}` }
            ]
          ]
        };

        await sendTelegram(botToken, groupIdNum, msg, inlineButtons);
        totalSent++;

        // หน่วงเวลาเล็กน้อยกัน Telegram rate limit
        await new Promise(r => setTimeout(r, 300));
      }
    }

    console.log(`[DEADLINE-REMINDER] ส่งแจ้งเตือนทั้งหมด ${totalSent} รายการ`);
    return new Response(JSON.stringify({
      success: true,
      sent: totalSent,
      timestamp: new Date().toISOString()
    }), { status: 200 });

  } catch (err: any) {
    console.error('[DEADLINE-REMINDER] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
