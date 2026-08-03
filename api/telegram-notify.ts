declare const process: any;
import { createClient } from '@supabase/supabase-js';

// ============================================================
// Telegram Notify API (Rule A & Rule C compliant)
// API สำหรับส่งการแจ้งเตือนหาผู้ใช้ทางห้องแชท Telegram
// Method: POST /api/telegram-notify
// Body: { chat_id, message, reply_markup }
// ============================================================

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export default async function handler(req: Request | any, res?: any): Promise<Response | void> {
  const method = req.method || 'POST';
  if (method !== 'POST') {
    if (res?.status) return res.status(405).json({ message: 'Method not allowed' });
    return new Response(JSON.stringify({ message: 'Method not allowed' }), { status: 405 });
  }

  let body: any = {};
  try {
    if (typeof req.json === 'function') {
      body = await req.json();
    } else {
      body = req.body || {};
    }
  } catch (e) {
    body = req.body || {};
  }

  const { chat_id, message, reply_markup } = body;

  if (!chat_id || !message) {
    if (res?.status) return res.status(400).json({ message: 'Missing required fields: chat_id or message' });
    return new Response(JSON.stringify({ message: 'Missing required fields: chat_id or message' }), { status: 400 });
  }

  try {
    const supabase = getSupabase();
    const { data: settings, error: settingsErr } = await supabase
      .from('settings')
      .select('telegram_bot_token')
      .limit(1)
      .maybeSingle();

    if (settingsErr || !settings?.telegram_bot_token) {
      console.error('[TELEGRAM NOTIFY ERROR] Settings or Token not found:', settingsErr);
      if (res?.status) return res.status(400).json({ message: 'Missing telegram_bot_token in settings' });
      return new Response(JSON.stringify({ message: 'Missing telegram_bot_token in settings' }), { status: 400 });
    }

    const botToken = settings.telegram_bot_token;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat_id,
        text: message.substring(0, 4096),
        parse_mode: 'HTML',
        reply_markup: reply_markup
      }),
    });

    if (response.ok) {
      if (res?.status) return res.status(200).json({ success: true, message: 'Telegram notification sent successfully' });
      return new Response(JSON.stringify({ success: true, message: 'Telegram notification sent successfully' }), { status: 200 });
    } else {
      const errData = await response.json();
      console.error('[TELEGRAM NOTIFY API ERROR DETAIL]', errData);
      if (res?.status) return res.status(response.status).json({ success: false, error: errData });
      return new Response(JSON.stringify({ success: false, error: errData }), { status: response.status });
    }
  } catch (err: any) {
    console.error('[TELEGRAM NOTIFY SYSTEM ERROR]', err);
    if (res?.status) return res.status(500).json({ success: false, error: err.message });
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}
