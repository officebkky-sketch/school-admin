declare const process: any;
import { createClient } from '@supabase/supabase-js';
import zlib from 'zlib';

// ── Helper: ส่งไฟล์เอกสารเข้า Telegram (sendDocument) ─────────────────────────
async function sendTelegramDocument(token: string, chatId: number, fileBuffer: Buffer, filename: string, caption: string) {
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
export default async function handler(req: Request): Promise<Response> {
  // ✅ ตรวจสอบ Authorization Header
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. ดึง settings
    const { data: settings } = await supabase
      .from('settings')
      .select('school_name, telegram_bot_token, telegram_group_id')
      .limit(1)
      .maybeSingle();

    if (!settings || !settings.telegram_bot_token) {
      return new Response(JSON.stringify({ error: 'No bot token configured' }), { status: 400 });
    }

    const botToken = settings.telegram_bot_token;
    const schoolName = settings.school_name || 'สถานศึกษา';

    // 2. ดึงข้อมูลตารางหลักทั้งหมดมาสำรองข้อมูล
    const tablesToBackup = [
      'settings',
      'profiles',
      'teachers',
      'incoming_docs',
      'outgoing_docs',
      'orders',
      'memos',
      'utilities',
      'procurement_projects',
      'service_area_students'
    ];

    const backupPayload: Record<string, any> = {
      backup_version: '1.0',
      exported_at: new Date().toISOString(),
      school_name: schoolName,
      data: {}
    };

    let totalRecords = 0;

    for (const table of tablesToBackup) {
      try {
        const { data, error } = await supabase.from(table).select('*');
        if (!error && data) {
          backupPayload.data[table] = data;
          totalRecords += data.length;
        } else {
          backupPayload.data[table] = [];
        }
      } catch {
        backupPayload.data[table] = [];
      }
    }

    // 3. แปลงเป็น JSON แล้วอัดบีบไฟล์ด้วย gzip (.json.gz)
    const jsonString = JSON.stringify(backupPayload, null, 2);
    const jsonBuffer = Buffer.from(jsonString, 'utf-8');
    const gzipBuffer = zlib.gzipSync(jsonBuffer);

    const thaiDateStr = getThaiDateStr();
    const fileName = `backup_${schoolName.replace(/\s+/g, '_')}_${thaiDateStr}.json.gz`;

    const sizeKb = (gzipBuffer.length / 1024).toFixed(1);
    const rawSizeKb = (jsonBuffer.length / 1024).toFixed(1);

    const caption = `💾 <b>สำรองข้อมูลระบบสารบรรณประจำสัปดาห์</b>\n` +
      `🏫 <b>${schoolName}</b>\n` +
      `📅 <b>วันที่:</b> ${thaiDateStr}\n` +
      `📊 <b>จำนวนข้อมูลทั้งหมด:</b> ${totalRecords} รายการ\n` +
      `📦 <b>ขนาดไฟล์ (.json.gz):</b> ${sizeKb} KB (บีบอัดจาก ${rawSizeKb} KB)\n\n` +
      `🔐 <i>โปรดเก็บรักษาไฟล์นี้ไว้ในที่ปลอดภัย สำหรับกู้คืนข้อมูลระบบในอนาคต</i>`;

    // 4. ดึงรายชื่อ Admin และ Director เพื่อส่งไฟล์สำรองข้อมูลส่วนตัว
    const { data: admins } = await supabase
      .from('profiles')
      .select('telegram_chat_id, role, full_name')
      .in('role', ['admin', 'director'])
      .not('telegram_chat_id', 'is', null);

    const recipientChatIds = new Set<number>();

    if (admins && admins.length > 0) {
      for (const admin of admins) {
        if (admin.telegram_chat_id) {
          const cid = parseInt(admin.telegram_chat_id.trim());
          if (!isNaN(cid)) recipientChatIds.add(cid);
        }
      }
    }

    // หากไม่มี Telegram ID ของ ผอ./Admin ให้ส่งเข้ากลุ่มส่วนกลางเป็น fallback
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

    return new Response(JSON.stringify({
      success: true,
      sent_to_users: sentCount,
      file_name: fileName,
      compressed_size_kb: sizeKb,
      raw_size_kb: rawSizeKb,
      total_records: totalRecords,
      timestamp: new Date().toISOString()
    }), { status: 200 });

  } catch (err: any) {
    console.error('[WEEKLY-BACKUP] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
