declare const process: any;
import { createClient } from '@supabase/supabase-js';

// ── Thai Public Holidays Inline Helper (Self-Contained for Vercel Lambdas) ──
const THAI_PUBLIC_HOLIDAYS: Record<string, string> = {
  '2025-01-01': 'วันขึ้นปีใหม่', '2025-02-12': 'วันมาฆบูชา', '2025-04-06': 'วันจักรี',
  '2025-04-07': 'วันหยุดชดเชยวันจักรี', '2025-04-13': 'วันสงกรานต์', '2025-04-14': 'วันสงกรานต์',
  '2025-04-15': 'วันสงกรานต์', '2025-04-16': 'วันหยุดชดเชยวันสงกรานต์', '2025-05-04': 'วันฉัตรมงคล',
  '2025-05-05': 'วันหยุดชดเชยวันฉัตรมงคล', '2025-05-09': 'วันพืชมงคล', '2025-05-11': 'วันวิสาขบูชา',
  '2025-05-12': 'วันหยุดชดเชยวันวิสาขบูชา', '2025-06-02': 'วันหยุดพิเศษ', '2025-06-03': 'วันเฉลิมฯ พระราชินี',
  '2025-07-10': 'วันอาสาฬหบูชา', '2025-07-11': 'วันเข้าพรรษา', '2025-07-28': 'วันเฉลิมฯ ร.10',
  '2025-08-11': 'วันหยุดพิเศษ', '2025-08-12': 'วันแม่แห่งชาติ', '2025-10-13': 'วันนวมินทรมหาราช',
  '2025-10-23': 'วันปิยมหาราช', '2025-12-05': 'วันพ่อแห่งชาติ', '2025-12-10': 'วันรัฐธรรมนูญ',
  '2025-12-31': 'วันสิ้นปี',
  '2026-01-01': 'วันขึ้นปีใหม่', '2026-01-02': 'วันหยุดพิเศษ', '2026-03-03': 'วันมาฆบูชา',
  '2026-04-06': 'วันจักรี', '2026-04-13': 'วันสงกรานต์', '2026-04-14': 'วันสงกรานต์',
  '2026-04-15': 'วันสงกรานต์', '2026-05-04': 'วันฉัตรมงคล', '2026-05-13': 'วันพืชมงคล',
  '2026-05-31': 'วันวิสาขบูชา', '2026-06-01': 'วันหยุดชดเชยวันวิสาขบูชา', '2026-06-03': 'วันเฉลิมฯ พระราชินี',
  '2026-07-28': 'วันเฉลิมฯ ร.10', '2026-07-29': 'วันอาสาฬหบูชา', '2026-07-30': 'วันเข้าพรรษา',
  '2026-08-12': 'วันแม่แห่งชาติ', '2026-10-13': 'วันนวมินทรมหาราช', '2026-10-23': 'วันปิยมหาราช',
  '2026-12-05': 'วันพ่อแห่งชาติ', '2026-12-07': 'วันหยุดชดเชยวันพ่อแห่งชาติ', '2026-12-10': 'วันรัฐธรรมนูญ',
  '2026-12-31': 'วันสิ้นปี',
  '2027-01-01': 'วันขึ้นปีใหม่', '2027-02-21': 'วันมาฆบูชา', '2027-02-22': 'วันหยุดชดเชยวันมาฆบูชา',
  '2027-04-06': 'วันจักรี', '2027-04-13': 'วันสงกรานต์', '2027-04-14': 'วันสงกรานต์',
  '2027-04-15': 'วันสงกรานต์', '2027-04-16': 'วันหยุดชดเชยวันสงกรานต์', '2027-05-04': 'วันฉัตรมงคล',
  '2027-05-14': 'วันพืชมงคล', '2027-05-20': 'วันวิสาขบูชา', '2027-06-03': 'วันเฉลิมฯ พระราชินี',
  '2027-07-18': 'วันอาสาฬหบูชา', '2027-07-19': 'วันหยุดชดเชยวันอาสาฬหบูชา', '2027-07-28': 'วันเฉลิมฯ ร.10',
  '2027-08-12': 'วันแม่แห่งชาติ', '2027-10-13': 'วันนวมินทรมหาราช', '2027-10-23': 'วันปิยมหาราช',
  '2027-10-25': 'วันหยุดชดเชยวันปิยมหาราช', '2027-12-05': 'วันพ่อแห่งชาติ', '2027-12-06': 'วันหยุดชดเชยวันพ่อแห่งชาติ',
  '2027-12-10': 'วันรัฐธรรมนูญ', '2027-12-31': 'วันสิ้นปี'
};

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

function getThaiDateInfo(dateObj?: Date | string) {
  let targetDate: Date;
  if (!dateObj) targetDate = new Date();
  else if (typeof dateObj === 'string') targetDate = new Date(dateObj.includes('T') ? dateObj : `${dateObj}T00:00:00+07:00`);
  else targetDate = dateObj;

  const bangkokDateStr = targetDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const [yearStr, monthStr, dayStr] = bangkokDateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const bkkDate = new Date(targetDate.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const dayOfWeek = bkkDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isoDateStr = bangkokDateStr;
  const holidayName = THAI_PUBLIC_HOLIDAYS[isoDateStr];
  const isHoliday = !!holidayName;
  const isWorkingDay = !isWeekend && !isHoliday;
  const thaiYear = year + 543;
  const thaiMonthName = THAI_MONTHS[month - 1] || '';
  const thaiDateStr = `${day} ${thaiMonthName} ${thaiYear}`;

  return { isHoliday, holidayName, isWeekend, isWorkingDay, thaiDateStr, isoDateStr, dayOfWeek };
}

function isNonWorkingDay(dateObj?: Date | string) {
  const info = getThaiDateInfo(dateObj);
  if (info.isWeekend) {
    const dayNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
    return { isNonWorking: true, reason: `วันหยุดสุดสัปดาห์ (${dayNames[info.dayOfWeek]})` };
  }
  if (info.isHoliday) {
    return { isNonWorking: true, reason: `วันหยุดราชการ (${info.holidayName})` };
  }
  return { isNonWorking: false };
}

// ── Helper: ส่งข้อความ Telegram ──────────────────────────────────────────────
async function sendTelegram(token: string, chatId: number, text: string, replyMarkup?: any) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });
  } catch (err) {
    console.error('[DEADLINE-REMINDER] sendTelegram error:', err);
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
export default async function handler(req: Request | any, res?: any): Promise<Response | void> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = typeof req?.headers?.get === 'function'
    ? req.headers.get('authorization')
    : (req?.headers?.authorization || req?.headers?.Authorization);

  let querySecret = req?.query?.secret || req?.query?.key;
  let isForce = req?.query?.force === 'true' || req?.query?.force === true;

  if (!querySecret || !isForce) {
    try {
      const url = new URL(req?.url || '/', 'http://localhost');
      if (!querySecret) querySecret = url.searchParams.get('secret') || url.searchParams.get('key');
      if (!isForce) isForce = url.searchParams.get('force') === 'true';
    } catch { /* ignore */ }
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    if (res?.status) return res.status(401).json({ error: 'Unauthorized' });
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // ตรวจสอบวันทำงาน (ข้ามเสาร์-อาทิตย์ และวันหยุดนักขัตฤกษ์ไทย)
  const dateInfo = getThaiDateInfo();
  const nonWorkingCheck = isNonWorkingDay();

  if (!isForce && nonWorkingCheck.isNonWorking) {
    console.log(`[DEADLINE-REMINDER] Skipped: ${nonWorkingCheck.reason}`);
    const payload = {
      message: `Skipped: ${nonWorkingCheck.reason}`,
      date: dateInfo.thaiDateStr,
      isHoliday: dateInfo.isHoliday,
      holidayName: dateInfo.holidayName || null
    };
    if (res?.status) return res.status(200).json(payload);
    return new Response(JSON.stringify(payload), { status: 200 });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      if (res?.status) return res.status(500).json({ error: 'Missing Supabase credentials' });
      return new Response(JSON.stringify({ error: 'Missing Supabase credentials' }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: allSettings } = await supabase
      .from('settings')
      .select('telegram_bot_token, telegram_group_id');

    if (!allSettings || allSettings.length === 0) {
      const payload = { message: 'No school settings found' };
      if (res?.status) return res.status(200).json(payload);
      return new Response(JSON.stringify(payload), { status: 200 });
    }

    let totalSent = 0;

    for (const setting of allSettings) {
      const { telegram_bot_token: botToken, telegram_group_id: rawGroupId } = setting;
      if (!botToken || !rawGroupId) continue;

      const centralGroupId = rawGroupId.split('|')[0]?.trim();
      if (!centralGroupId) continue;
      const groupIdNum = parseInt(centralGroupId);
      if (isNaN(groupIdNum)) continue;

      const today = new Date();
      const in3Days = new Date(today);
      in3Days.setDate(today.getDate() + 3);
      const in3DaysStr = in3Days.toISOString().split('T')[0];

      const { data: dueDocs, error: docsError } = await supabase
        .from('incoming_docs')
        .select(`
          id,
          doc_number,
          subject,
          action_deadline,
          status,
          assigned_to,
          assigned_user:profiles!incoming_docs_assigned_to_fkey (
            display_name
          )
        `)
        .not('action_deadline', 'is', null)
        .lte('action_deadline', in3DaysStr)
        .not('status', 'in', '("completed","cancelled")')
        .order('action_deadline', { ascending: true });

      if (docsError || !dueDocs || dueDocs.length === 0) continue;

      for (const doc of dueDocs) {
        const days = daysUntil(doc.action_deadline);
        const emoji = daysEmoji(days);
        const thaiDeadline = toThaiDate(doc.action_deadline);
        const teacherName = (doc.assigned_user as any)?.display_name || 'ไม่ระบุผู้รับผิดชอบ';
        const receiveNo = doc.doc_number || '-';

        let msg = `⏰ <b>แจ้งเตือนหนังสือใกล้ครบกำหนดปฏิบัติ</b>\n\n`;
        msg += `📌 <b>สถานะกำหนดส่ง:</b> ${emoji}\n`;
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
        await new Promise(r => setTimeout(r, 300));
      }
    }

    console.log(`[DEADLINE-REMINDER] ส่งแจ้งเตือนทั้งหมด ${totalSent} รายการ`);
    const payload = {
      success: true,
      sent: totalSent,
      timestamp: new Date().toISOString()
    };
    if (res?.status) return res.status(200).json(payload);
    return new Response(JSON.stringify(payload), { status: 200 });

  } catch (err: any) {
    console.error('[DEADLINE-REMINDER] Error:', err);
    if (res?.status) return res.status(500).json({ error: err.message });
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
