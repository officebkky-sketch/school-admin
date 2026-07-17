declare const process: any;
import { createClient } from '@supabase/supabase-js';

// ============================================================
// Telegram Notify API (Non-Hybrid / 1 Project per School)
// API สำหรับส่งการแจ้งเตือนหาผู้ใช้ทางห้องแชท Telegram
// Method: POST /api/telegram-notify
// Body: { chat_id, message, reply_markup }
// ============================================================

/** สร้าง Supabase client โดยใช้ Service Role Key เพื่อก้าวข้ามสิทธิ์ RLS */
function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export default async function handler(req: any, res: any) {
  // รองรับเฉพาะ POST เท่านั้น
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { chat_id, message, reply_markup } = req.body;

  // ตรวจสอบข้อมูลนำเข้าให้ครบถ้วน
  if (!chat_id || !message) {
    return res.status(400).json({ message: 'Missing required fields: chat_id or message' });
  }

  try {
    const supabase = getSupabase();

    // ดึง token ของบอท Telegram จากตาราง settings แทน schools
    const { data: settings, error: settingsErr } = await supabase
      .from('settings')
      .select('telegram_bot_token')
      .single();

    if (settingsErr || !settings?.telegram_bot_token) {
      console.error('[TELEGRAM NOTIFY ERROR] Settings or Token not found:', settingsErr);
      return res.status(400).json({ message: 'Missing telegram_bot_token in settings' });
    }

    const botToken = settings.telegram_bot_token;

    // เรียก API ของ Telegram เพื่อส่งข้อความ
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat_id,
        text: message.substring(0, 4096), // Telegram จำกัดข้อความ 4096 อักขระ
        parse_mode: 'HTML',
        reply_markup: reply_markup
      }),
    });

    if (response.ok) {
      return res.status(200).json({ success: true, message: 'Telegram notification sent successfully' });
    } else {
      const errData = await response.json();
      console.error('[TELEGRAM NOTIFY API ERROR DETAIL]', errData);
      return res.status(response.status).json({ success: false, error: errData });
    }
  } catch (err: any) {
    console.error('[TELEGRAM NOTIFY SYSTEM ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
