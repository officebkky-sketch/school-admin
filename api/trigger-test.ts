import { createClient } from '@supabase/supabase-js';
import { getThaiDateInfo, isNonWorkingDay } from './_utils/thaiHolidays';
import directorPendingHandler from './director-pending-reminder';
import deadlineReminderHandler from './deadline-reminder';
import weeklyBackupHandler from './weekly-backup';

declare const process: any;

/**
 * Helper ดึง Auth Secret จาก Header หรือ Query Parameter
 */
function verifySecret(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // หากยังไม่ได้ตั้ง CRON_SECRET ใน env อนุญาตให้รันได้สำหรับการทดสอบ

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader === `Bearer ${cronSecret}`) return true;

  const url = new URL(req.url || 'http://localhost');
  const querySecret = url.searchParams.get('secret') || url.searchParams.get('key');
  if (querySecret && querySecret === cronSecret) return true;

  return false;
}

export default async function handler(req: Request): Promise<Response> {
  // 1. ตรวจสอบสิทธิ์ความปลอดภัย
  if (!verifySecret(req)) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Unauthorized: กรุณาระบุ Secret Key ผ่าน Authorization Header หรือ ?secret=...'
    }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(req.url || 'http://localhost');
  const action = url.searchParams.get('action') || 'status';
  const force = url.searchParams.get('force') === 'true';
  const testDate = url.searchParams.get('date'); // เช่น ?date=2026-08-12

  try {
    // ── Action: ตรวจสอบสถานะวันและระบบ (check-holiday / status) ───────────────
    if (action === 'status' || action === 'check-holiday') {
      const dateInfo = getThaiDateInfo(testDate || undefined);
      const nonWorking = isNonWorkingDay(testDate || undefined);

      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      let schoolName = 'ไม่ได้เชื่อมต่อ Database';
      let hasTelegramToken = false;
      let pendingDocsCount = 0;

      if (supabaseUrl && supabaseKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data: settings } = await supabase.from('settings').select('school_name, telegram_bot_token').maybeSingle();
          if (settings) {
            schoolName = settings.school_name || 'ไม่ได้ระบุชื่อ';
            hasTelegramToken = !!settings.telegram_bot_token;
          }
          const { count } = await supabase.from('incoming_docs').select('*', { count: 'exact', head: true }).in('status', ['pending', 'waiting_proposal']);
          pendingDocsCount = count || 0;
        } catch (dbErr: any) {
          console.error('[TRIGGER TEST STATUS DB ERROR]', dbErr);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        action: 'status',
        serverTimeBangkok: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
        dateInfo,
        nonWorkingReason: nonWorking.isNonWorking ? nonWorking.reason : 'วันทำการปกติ (Working day)',
        school: {
          schoolName,
          hasTelegramToken,
          pendingDocsCount
        },
        availableActions: [
          { action: 'director-digest', description: 'ทดสอบส่ง Executive Morning Digest หา ผอ. (รองรับ ?force=true)' },
          { action: 'deadline-reminder', description: 'ทดสอบส่งการแจ้งเตือนหนังสือใกล้ครบกำหนด (รองรับ ?force=true)' },
          { action: 'weekly-backup', description: 'ทดสอบการสำรองข้อมูลรายสัปดาห์' },
          { action: 'check-holiday', description: 'ตรวจสอบวันหยุดไทย (รองรับ ?date=YYYY-MM-DD)' }
        ]
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // ── Action: Director Pending Reminder (Director Morning Digest) ───────────
    if (action === 'director-digest' || action === 'director-pending-reminder') {
      const cronSecret = process.env.CRON_SECRET || 'manual-trigger';
      const syntheticReq = new Request(
        `${url.origin}/api/director-pending-reminder?force=${force ? 'true' : 'false'}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${cronSecret}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const res = await directorPendingHandler(syntheticReq);
      const data = await res.json().catch(() => ({}));
      return new Response(JSON.stringify({
        success: true,
        triggeredAction: 'director-digest',
        forceBypassHoliday: force,
        result: data
      }, null, 2), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // ── Action: Deadline Reminder ─────────────────────────────────────────────
    if (action === 'deadline-reminder') {
      const cronSecret = process.env.CRON_SECRET || 'manual-trigger';
      const syntheticReq = new Request(
        `${url.origin}/api/deadline-reminder?force=${force ? 'true' : 'false'}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${cronSecret}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const res = await deadlineReminderHandler(syntheticReq);
      const data = await res.json().catch(() => ({}));
      return new Response(JSON.stringify({
        success: true,
        triggeredAction: 'deadline-reminder',
        forceBypassHoliday: force,
        result: data
      }, null, 2), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // ── Action: Weekly Database Backup ────────────────────────────────────────
    if (action === 'weekly-backup') {
      const cronSecret = process.env.CRON_SECRET || 'manual-trigger';
      const syntheticReq = new Request(
        `${url.origin}/api/weekly-backup`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${cronSecret}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const res = await weeklyBackupHandler(syntheticReq);
      const data = await res.json().catch(() => ({}));
      return new Response(JSON.stringify({
        success: true,
        triggeredAction: 'weekly-backup',
        result: data
      }, null, 2), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // Action ไม่ถูกต้อง
    return new Response(JSON.stringify({
      success: false,
      error: `ไม่พบ Action '${action}' กรุณาใช้ ?action=status, ?action=director-digest, ?action=deadline-reminder หรือ ?action=weekly-backup`
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

  } catch (err: any) {
    console.error('[TRIGGER TEST ERROR]', err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Internal Server Error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}
