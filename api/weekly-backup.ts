declare const process: any;
import { createClient } from '@supabase/supabase-js';
import zlib from 'zlib';

// ── Helper: ส่งไฟล์เอกสารเข้า Telegram (sendDocument) ─────────────────────────
async function sendTelegramDocument(token: string, chatId: number, fileBuffer: Buffer, filename: string, caption: string): Promise<any> {
  try {
    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');

    const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'application/gzip' });
    formData.append('document', blob, filename);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData
    });
    return await res.json();
  } catch (err) {
    console.error('[WEEKLY-BACKUP] sendTelegramDocument error:', err);
    return null;
  }
}

// ── Helper: แปลงเป็นวันที่ภาษาไทย ──────────────────────────────────────────────
function getThaiDateStr(): string {
  const d = new Date();
  const year = d.getFullYear() + 543;
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export default async function handler(req: Request | any, res?: any): Promise<Response | void> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = typeof req?.headers?.get === 'function'
    ? req.headers.get('authorization')
    : (req?.headers?.authorization || req?.headers?.Authorization);

  let querySecret = req?.query?.secret || req?.query?.key;
  if (!querySecret) {
    try {
      const url = new URL(req?.url || '/', 'http://localhost');
      querySecret = url.searchParams.get('secret') || url.searchParams.get('key');
    } catch { /* ignore */ }
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    if (res?.status) return res.status(401).json({ error: 'Unauthorized' });
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
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

    // 1. ดึง settings
    const { data: settings } = await supabase
      .from('settings')
      .select('school_name, telegram_bot_token, telegram_group_id')
      .limit(1)
      .maybeSingle();

    if (!settings || !settings.telegram_bot_token) {
      const payload = { error: 'No bot token configured' };
      if (res?.status) return res.status(400).json(payload);
      return new Response(JSON.stringify(payload), { status: 400 });
    }

    const botToken = settings.telegram_bot_token;
    const schoolName = settings.school_name || 'โรงเรียน';
    const thaiDate = getThaiDateStr();

    // 2. ดึงข้อมูลตารางสำคัญ
    const backupData: Record<string, any[]> = {};
    const tables = [
      'settings',
      'profiles',
      'incoming_docs',
      'outgoing_docs',
      'memos',
      'orders',
      'students',
      'inventory_items'
    ];

    let totalRecords = 0;
    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('*');
        if (!error && data) {
          backupData[table] = data;
          totalRecords += data.length;
        } else {
          backupData[table] = [];
        }
      } catch {
        backupData[table] = [];
      }
    }

    // 3. บีบอัดข้อมูลเป็น Gzip JSON
    const jsonString = JSON.stringify({
      version: '1.0',
      exported_at: new Date().toISOString(),
      school_name: schoolName,
      total_records: totalRecords,
      data: backupData
    }, null, 2);

    const rawBuffer = Buffer.from(jsonString, 'utf-8');
    const gzipBuffer = zlib.gzipSync(rawBuffer);

    const sizeKb = (gzipBuffer.length / 1024).toFixed(1);
    const rawSizeKb = (rawBuffer.length / 1024).toFixed(1);
    const fileName = `backup_${thaiDate}.json.gz`;

    const caption = `💾 <b>สำรองข้อมูลอัตโนมัติประจำสัปดาห์</b>\n` +
      `🏫 <b>${schoolName}</b>\n` +
      `📅 <b>ประจำวันที่:</b> ${thaiDate}\n` +
      `📊 <b>จำนวนข้อมูลรวม:</b> ${totalRecords} รายการ\n` +
      `📦 <b>ขนาดไฟล์:</b> ${sizeKb} KB (จาก ${rawSizeKb} KB)\n` +
      `🔒 <i>ไฟล์ถูกบีบอัดแบบ GZIP (.json.gz) เก็บรักษาเพื่อความปลอดภัย</i>`;

    // 4. ค้นหาผู้รับ
    const recipientChatIds: Set<number> = new Set();
    const { data: admins } = await supabase
      .from('profiles')
      .select('telegram_chat_id, role')
      .or('role.eq.admin,role.eq.director');

    if (admins) {
      for (const admin of admins) {
        if (admin.telegram_chat_id) {
          const cid = parseInt(admin.telegram_chat_id.trim());
          if (!isNaN(cid)) recipientChatIds.add(cid);
        }
      }
    }

    if (recipientChatIds.size === 0 && settings.telegram_group_id) {
      const centralGroupId = settings.telegram_group_id.split('|')[0]?.trim();
      if (centralGroupId) {
        const cid = parseInt(centralGroupId);
        if (!isNaN(cid)) recipientChatIds.add(cid);
      }
    }

    let sentCount = 0;
    for (const chatId of recipientChatIds) {
      const res = await sendTelegramDocument(botToken, chatId, gzipBuffer, fileName, caption);
      if (res && res.ok) sentCount++;
      await new Promise(r => setTimeout(r, 500));
    }

    const payload = {
      success: true,
      sent_to_users: sentCount,
      file_name: fileName,
      compressed_size_kb: sizeKb,
      raw_size_kb: rawSizeKb,
      total_records: totalRecords,
      timestamp: new Date().toISOString()
    };

    if (res?.status) return res.status(200).json(payload);
    return new Response(JSON.stringify(payload), { status: 200 });

  } catch (err: any) {
    console.error('[WEEKLY-BACKUP] Error:', err);
    if (res?.status) return res.status(500).json({ error: err.message });
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
