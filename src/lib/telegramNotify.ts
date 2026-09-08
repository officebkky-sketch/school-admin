import { supabase, getActiveSchoolProfile } from './supabase';

/**
 * ฟังก์ชันสำหรับแปลงอักขระพิเศษ HTML เพื่อป้องกัน Error ใน Telegram HTML parse_mode
 */
export function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function getVercelBaseUrl(): string {
  let vercelBaseUrl = '';
  const isWebUrl = typeof window !== 'undefined' && 
                    window.location && 
                    window.location.origin && 
                    window.location.protocol.startsWith('http') &&
                    !window.location.origin.includes('localhost') && 
                    !window.location.origin.includes('127.0.0.1');

  if (isWebUrl) {
    vercelBaseUrl = window.location.origin;
  } else {
    const profile = getActiveSchoolProfile();
    vercelBaseUrl = profile?.vercelUrl || 'https://school-admin-psi.vercel.app';
  }

  if (!vercelBaseUrl || vercelBaseUrl.includes('localhost') || vercelBaseUrl.includes('127.0.0.1')) {
    vercelBaseUrl = 'https://school-admin-psi.vercel.app';
  }

  if (vercelBaseUrl && !vercelBaseUrl.startsWith('http://') && !vercelBaseUrl.startsWith('https://')) {
    vercelBaseUrl = `https://${vercelBaseUrl}`;
  }
  if (vercelBaseUrl.endsWith('/')) {
    vercelBaseUrl = vercelBaseUrl.slice(0, -1);
  }
  return vercelBaseUrl;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * ส่งการแจ้งเตือนทาง Telegram (ทั้งห้องแชทส่วนตัวและห้องแชทกลุ่ม)
 * @param message ข้อความแจ้งเตือน (รองรับรูปแบบ HTML)
 * @param specificToId รหัสผู้รับปลายทาง (ถ้าละไว้ จะดึง telegram_group_id จากหน้าตั้งค่าโรงเรียนโดยอัตโนมัติ)
 */
export async function sendTelegramNotification(
  message: string, 
  specificToId?: 'central' | 'proposal' | string, 
  replyMarkup?: any,
  retryCount = 0
): Promise<any> {
  try {
    const activeSchoolId = localStorage.getItem('active_school_id');
    if (!activeSchoolId) return;

    // ค้นหาค่าตั้งค่าจากตาราง settings (Rule C: 1 row ต่อ 1 โรงเรียน)
    const { data: settings } = await supabase
      .from('settings')
      .select('telegram_group_id')
      .maybeSingle();

    const rawGroupId = settings?.telegram_group_id || '';
    const [centralId, proposalId] = rawGroupId.split('|');

    let targetId = '';
    if (specificToId === 'central') {
      targetId = centralId?.trim() || '';
    } else if (specificToId === 'proposal' || !specificToId) {
      targetId = proposalId?.trim() || centralId?.trim() || ''; // หากระบุเป็นเสนอ หรือไม่ระบุปลายทาง ให้ใช้กลุ่มเสนอ (หรือกลุ่มกลางถ้าไม่ได้แยก)
    } else {
      targetId = specificToId;
    }

    if (!targetId) {
      // หากไม่ได้ตั้งค่ากลุ่มกลาง ลองตรวจสอบว่า ผอ. (director) ผูก Telegram ส่วนบุคคลไว้หรือยัง
      const { data: director } = await supabase
        .from('profiles')
        .select('telegram_chat_id')
        .eq('role', 'director')
        .not('telegram_chat_id', 'is', null)
        .maybeSingle();

      if (director?.telegram_chat_id) {
        targetId = director.telegram_chat_id;
        console.log('[TELEGRAM NOTIFY] No group ID found, falling back to Director personal chat:', targetId);
      }
    }

    if (!targetId) {
      console.warn('[TELEGRAM NOTIFY] Skipping send: No recipient chat_id or group_id found.');
      return;
    }

    const vercelUrl = getVercelBaseUrl();
    const endpoint = `${vercelUrl}/api/telegram-notify`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        school_id: activeSchoolId,
        chat_id: targetId,
        message: message,
        reply_markup: replyMarkup
      })
    });

    const resData = await response.json().catch(() => ({}));

    // จัดการกรณี Rate Limit 429 ฝั่ง Client
    if (response.status === 429 && retryCount < 2) {
      const waitSec = Number(resData?.error?.parameters?.retry_after || 4);
      console.warn(`[TELEGRAM NOTIFY] Client got 429, backing off for ${waitSec}s...`);
      await sleep(waitSec * 1000);
      return sendTelegramNotification(message, specificToId, replyMarkup, retryCount + 1);
    }

    if (!response.ok || !resData.success) {
      console.error('[TELEGRAM NOTIFY ERROR DETAIL]', resData);
      throw new Error(resData.error?.description || resData.message || 'Failed to send Telegram notification');
    }

    return resData;
  } catch (err: any) {
    // ถ้าเป็น 429 และยัง retry ได้
    if (err?.message?.includes('Too Many Requests') && retryCount < 2) {
      console.warn('[TELEGRAM NOTIFY] Retrying after error 429...');
      await sleep(4000);
      return sendTelegramNotification(message, specificToId, replyMarkup, retryCount + 1);
    }
    console.error('[TELEGRAM NOTIFY ERROR]', err);
    throw err;
  }
}

