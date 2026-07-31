import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// ── Helper: ส่งข้อความ Telegram ──────────────────────────────────────────────
async function sendTelegram(token: string, chatId: number, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
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

// ── Main Handler ──────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ✅ ตรวจสอบ Authorization Header (Vercel ส่ง CRON_SECRET มาให้ตรวจ)
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // ── 1. ดึง settings ของทุกโรงเรียน ────────────────────────────────────────
    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: allSettings } = await supabase
      .from('settings')
      .select('school_id, telegram_bot_token, telegram_group_id');

    if (!allSettings || allSettings.length === 0) {
      return res.status(200).json({ message: 'No school settings found' });
    }

    let totalSent = 0;

    for (const setting of allSettings) {
      const { school_id, telegram_bot_token: botToken, telegram_group_id: groupId } = setting;
      if (!botToken || !groupId) continue;

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
        .eq('school_id', school_id)
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
        msg += `📄 <b>หนังสือเลขรับ:</b> ${receiveNo}\n`;
        msg += `📝 <b>เรื่อง:</b> ${doc.subject || '-'}\n`;
        msg += `🗓 <b>กำหนดส่ง:</b> ${thaiDeadline}\n`;
        msg += `🧑‍🏫 <b>ผู้รับผิดชอบ:</b> ${teacherName}\n`;

        if (days <= 0) {
          msg += `\n❗ <b>กรุณาดำเนินการและอัปเดตสถานะในระบบด่วน!</b>`;
        } else {
          msg += `\n⚠️ <b>กรุณาดำเนินการให้ทันกำหนดครับ</b>`;
        }

        await sendTelegram(botToken, parseInt(groupId), msg);
        totalSent++;

        // หน่วงเวลาเล็กน้อยกัน Telegram rate limit
        await new Promise(r => setTimeout(r, 300));
      }
    }

    console.log(`[DEADLINE-REMINDER] ส่งแจ้งเตือนทั้งหมด ${totalSent} รายการ`);
    return res.status(200).json({
      success: true,
      sent: totalSent,
      timestamp: new Date().toISOString()
    });

  } catch (err: any) {
    console.error('[DEADLINE-REMINDER] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
