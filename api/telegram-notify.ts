declare const process: any;
import { createClient } from '@supabase/supabase-js';

// ============================================================
// Telegram Notify API (Rule A & Rule C compliant)
// รองรับ:
// 1. Auto-Retry เมื่อเจอ Rate Limit (HTTP 429: Too Many Requests)
// 2. Auto Plaintext Fallback เมื่อเจอ Entity Parse Error (HTTP 400: can't parse entities)
// 3. Smart Message Splitting เมื่อข้อความยาวเกิน 4000 ตัวอักษร
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

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

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function splitMessageSafely(text: string, maxLen = 3800): string[] {
  if (text.length <= maxLen) return [text];
  
  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    if ((currentChunk + '\n' + line).length > maxLen) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      if (line.length > maxLen) {
        // บรรทัดเดียวยาวเกิน maxLen ให้ตัดเป็นท่อนๆ
        for (let i = 0; i < line.length; i += maxLen) {
          chunks.push(line.substring(i, i + maxLen));
        }
      } else {
        currentChunk = line;
      }
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text.substring(0, maxLen)];
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function executeTelegramSend(
  botToken: string,
  chatId: string | number,
  text: string,
  parseMode: 'HTML' | null,
  replyMarkup?: any,
  attempt = 1
): Promise<{ ok: boolean; data?: any; status: number }> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload: any = {
    chat_id: chatId,
    text: text,
  };

  if (parseMode) {
    payload.parse_mode = parseMode;
  }
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const resData: any = await res.json().catch(() => ({}));

  // กรณี 429 Too Many Requests -> หน่วงเวลารอ retry_after แล้วลองส่งใหม่อัตโนมัติ
  if (res.status === 429 && attempt <= 2) {
    const retryAfter = Number(resData?.parameters?.retry_after || 3);
    const waitSeconds = Math.min(Math.max(retryAfter, 1), 8); // ป้องกันรอนานเกิน Vercel timeout
    console.warn(`[TELEGRAM NOTIFY] Rate limit 429 encountered, waiting ${waitSeconds}s before retry (attempt ${attempt})...`);
    await sleep(waitSeconds * 1000);
    return executeTelegramSend(botToken, chatId, text, parseMode, replyMarkup, attempt + 1);
  }

  // กรณี 400 Bad Request: parse entities error -> fallback ส่งเป็น Plain Text
  if (!res.ok && parseMode === 'HTML' && resData?.description?.includes("can't parse entities")) {
    console.warn('[TELEGRAM NOTIFY] HTML Entity parsing failed. Retrying with clean plain text...', resData.description);
    const plainText = stripHtml(text);
    return executeTelegramSend(botToken, chatId, plainText, null, replyMarkup, attempt + 1);
  }

  return { ok: res.ok, data: resData, status: res.status };
}

export default async function handler(req: any, res?: any): Promise<any> {
  const sendResponse = (status: number, data: any) => {
    if (res && typeof res.status === 'function') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.status(status).json(data);
    }
    return new Response(JSON.stringify(data), { 
      status, 
      headers: corsHeaders 
    });
  };

  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    if (res && typeof res.status === 'function') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.status(204).end();
    }
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return sendResponse(405, { message: 'Method not allowed' });
  }

  let body: any = {};
  try {
    if (req.body && typeof req.body === 'object') {
      body = req.body;
    } else if (typeof req.json === 'function') {
      body = await req.json();
    } else if (typeof req.body === 'string') {
      try { body = JSON.parse(req.body); } catch {}
    }
  } catch (e) {
    body = {};
  }

  const { chat_id, message, reply_markup } = body || {};

  if (!chat_id || !message) {
    return sendResponse(400, { 
      success: false, 
      message: 'Missing required fields: chat_id or message' 
    });
  }

  try {
    const supabase = getSupabase();
    // Rule C: ไม่ใส่ school_id
    const { data: settings, error: settingsErr } = await supabase
      .from('settings')
      .select('telegram_bot_token')
      .limit(1)
      .maybeSingle();

    if (settingsErr || !settings?.telegram_bot_token) {
      console.error('[TELEGRAM NOTIFY ERROR] Settings or Token not found:', settingsErr);
      return sendResponse(400, { 
        success: false, 
        message: 'Missing telegram_bot_token in settings' 
      });
    }

    const botToken = settings.telegram_bot_token;

    // ตรวจสอบความยาวข้อความ หากยาวเกิน 4000 ตัวอักษร ให้แบ่งท่อนส่งอย่างปลอดภัย
    const chunks = splitMessageSafely(message, 3800);
    let lastResult: any = null;

    for (let i = 0; i < chunks.length; i++) {
      const isLastChunk = i === chunks.length - 1;
      // ส่ง reply_markup ที่ท่อนสุดท้าย
      const markupToSend = isLastChunk ? reply_markup : undefined;

      const result = await executeTelegramSend(
        botToken,
        chat_id,
        chunks[i],
        'HTML',
        markupToSend
      );

      lastResult = result;

      if (!result.ok) {
        console.error('[TELEGRAM NOTIFY SEND FAILED]', result.data);
        return sendResponse(result.status || 500, { 
          success: false, 
          error: result.data 
        });
      }

      // หากมีหลายข้อความ ให้หน่วงเวลาเล็กน้อย (500ms) เพื่อป้องกัน Telegram 429
      if (chunks.length > 1 && !isLastChunk) {
        await sleep(500);
      }
    }

    return sendResponse(200, { 
      success: true, 
      message: 'Telegram notification sent successfully' 
    });

  } catch (err: any) {
    console.error('[TELEGRAM NOTIFY SYSTEM ERROR]', err);
    return sendResponse(500, { 
      success: false, 
      error: err.message || 'Internal Server Error' 
    });
  }
}
