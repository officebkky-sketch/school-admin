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

/**
 * Helper: ส่งข้อความ Telegram พร้อม Fallback Plain Text หาก HTML Parsing ล้มเหลว
 * คืนค่า true หากส่งสำเร็จ, false หากส่งล้มเหลว
 */
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
    console.error('[DIRECTOR-REMINDER] Telegram API error:', errBody);

    // Fallback: หาก HTML formatting ผิดพลาด ให้ถอดแท็ก HTML แล้วส่งแบบข้อความล้วน (Plain Text)
    if (errBody?.description && (errBody.description.includes('entities') || errBody.description.includes('HTML') || errBody.description.includes('bad request'))) {
      console.warn('[DIRECTOR-REMINDER] HTML parsing failed, retrying plain text fallback...');
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
    console.error('[DIRECTOR-REMINDER] sendTelegram network error:', err);
    return false;
  }
}

/** Helper: สัญลักษณ์ความเร่งด่วน */
function urgencyEmoji(urgency?: string): string {
  if (urgency === 'ด่วนที่สุด') return '🔴 <b>[ด่วนที่สุด]</b>';
  if (urgency === 'ด่วนมาก' || urgency === 'ด่วน') return '🟡 <b>[ด่วน]</b>';
  return '🟢 <b>[ปกติ]</b>';
}

/** HTML escape ป้องกัน XSS/400 Error ใน Telegram HTML mode */
function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Helper: แปลง attachment_urls ให้เป็น string[] เสมอ */
function parseAttachmentUrls(raw: any): string[] {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try { return JSON.parse(raw).filter(Boolean); } catch { /* ignore */ }
  }
  return [];
}

/**
 * Main Handler: Executive Morning Digest สรุปหนังสือรอเกษียณ 08:00 น.
 * (Rule A & Rule B & Rule C Compliant)
 */
export default async function handler(req: Request | any, res?: any): Promise<Response | void> {
  // ✅ 1. ตรวจสอบ Authorization Header / Secret Key แบบปลอดภัย (รองรับทั้ง Node.js และ Web Request)
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
    } catch { /* ignore URL parse error */ }
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    if (res?.status) return res.status(401).json({ error: 'Unauthorized' });
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // ✅ 2. ตรวจสอบวันทำงาน (ข้ามเสาร์-อาทิตย์ และวันหยุดนักขัตฤกษ์ไทย) ตามเวลาประเทศไทย
  const dateInfo = getThaiDateInfo();
  const nonWorkingCheck = isNonWorkingDay();

  if (!isForce && nonWorkingCheck.isNonWorking) {
    console.log(`[DIRECTOR-REMINDER] Skipped: ${nonWorkingCheck.reason}`);
    const payload = {
      message: `Skipped: ${nonWorkingCheck.reason}`,
      date: dateInfo.thaiDateStr,
      isHoliday: dateInfo.isHoliday,
      holidayName: dateInfo.holidayName || null
    };
    if (res?.status) return res.status(200).json(payload);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
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

    // ✅ 3. ดึงตั้งค่า Telegram ของโรงเรียน (Rule C: 1 row per school)
    const { data: settings, error: settingsErr } = await supabase
      .from('settings')
      .select('school_name, telegram_bot_token, telegram_group_id')
      .limit(1)
      .maybeSingle();

    if (settingsErr || !settings || !settings.telegram_bot_token) {
      const payload = { message: 'No Telegram bot token configured in settings' };
      if (res?.status) return res.status(200).json(payload);
      return new Response(JSON.stringify(payload), { status: 200 });
    }

    const botToken = settings.telegram_bot_token;
    const rawGroupId = settings.telegram_group_id || '';

    // Rule B: telegram_group_id เป็น "centralId|proposalId"
    const proposalGroupIdStr = rawGroupId.split('|')[1]?.trim() || rawGroupId.split('|')[0]?.trim() || '';

    // ✅ 4. ดึงรายการหนังสือรับเข้าที่ยังรอการเกษียณสั่งการ (status = pending หรือ waiting_proposal)
    const { data: pendingDocs, count: totalPending, error: docsErr } = await supabase
      .from('incoming_docs')
      .select('id, doc_number, subject, from_agency, urgency, doc_date, file_url, attachment_urls, created_at', { count: 'exact' })
      .in('status', ['pending', 'waiting_proposal'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (docsErr) {
      console.error('[DIRECTOR-REMINDER] Error querying incoming_docs:', docsErr);
      if (res?.status) return res.status(500).json({ error: docsErr.message });
      return new Response(JSON.stringify({ error: docsErr.message }), { status: 500 });
    }

    const totalCount = (totalPending !== null && totalPending !== undefined)
      ? totalPending
      : (pendingDocs ? pendingDocs.length : 0);

    // หากไม่มีหนังสือค้าง ไม่ต้องส่งข้อความ
    if (!pendingDocs || pendingDocs.length === 0 || totalCount === 0) {
      console.log('[DIRECTOR-REMINDER] No pending documents. Skipped.');
      const payload = { message: 'No pending documents for retirement' };
      if (res?.status) return res.status(200).json(payload);
      return new Response(JSON.stringify(payload), { status: 200 });
    }

    // ✅ 5. คิวรีหา ผอ.รร. / ผู้ดูแล จาก profiles (role = director หรือ admin ที่ผูก telegram_chat_id ไว้)
    const { data: directorProfiles } = await supabase
      .from('profiles')
      .select('telegram_chat_id, display_name, role')
      .or('role.eq.director,role.eq.admin')
      .not('telegram_chat_id', 'is', null);

    // ✅ 6. ประกอบข้อความแจ้งเตือน Executive Digest
    const thaiDateText = dateInfo.thaiDateStr;
    let msg = `🌅 <b>[สรุปประจำวัน 08:00 น.] หนังสือรอเกษียณสั่งการ</b>\n`;
    msg += `🏫 <b>${escapeHtml(settings.school_name || 'โรงเรียน')} (ประจำวันที่ ${thaiDateText})</b>\n\n`;
    msg += `⚠️ <b>เรียน ผอ.รร. ขณะนี้มีหนังสือรับเข้าคงค้างรอเกษียณสั่งการทั้งหมด ${totalCount} ฉบับ:</b>\n\n`;

    const inlineButtons: any[] = [];

    pendingDocs.forEach((doc, idx) => {
      const emoji = urgencyEmoji(doc.urgency);
      const docNumStr = doc.doc_number || (idx + 1).toString();
      msg += `${idx + 1}. ${emoji} <b>เรื่อง:</b> ${escapeHtml(doc.subject || '-')}\n`;
      msg += `   • <b>จาก:</b> ${escapeHtml(doc.from_agency || '-')}\n`;
      msg += `   • <b>เลขรับ:</b> ${escapeHtml(docNumStr)}\n`;

      if (doc.file_url) {
        msg += `   📄 <a href="${doc.file_url}">เปิดดูต้นฉบับ</a>`;
      }

      const atts = parseAttachmentUrls(doc.attachment_urls);
      if (atts.length > 0) {
        msg += ` | 📎 <b>ไฟล์แนบ:</b> `;
        atts.forEach((url: string, i: number) => {
          msg += `<a href="${url}">[แนบ ${i + 1}]</a> `;
        });
      }

      if (doc.file_url || atts.length > 0) msg += `\n`;
      msg += `\n`;

      if (inlineButtons.length < 5) {
        inlineButtons.push([{
          text: `✍️ สั่งการเรื่อง ${docNumStr}`,
          callback_data: `action=start_assign&id=${doc.id}`
        }]);
      }
    });

    if (totalCount > 10) {
      msg += `📌 <i>และยังมีหนังสือรอเกษียณอีก ${totalCount - 10} ฉบับในระบบ...</i>\n\n`;
    }

    msg += `💡 <i>ท่านสามารถกดปุ่ม "✍️ สั่งการ" ด้านล่างข้อความเพื่อดำเนินการผ่าน Telegram ได้ทันทีค่ะ 🌸</i>`;

    const replyMarkup = { inline_keyboard: inlineButtons };

    // ✅ 7. ส่งข้อความแจ้งเตือน:
    // ช่องทางที่ 1: กลุ่มเสนอหนังสือ (Proposal Group) เป็นช่องทางหลักในการสั่งการ
    // ช่องทางที่ 2: แชทส่วนตัวของ ผอ./แอดมิน (Direct Message)
    let sentSuccessCount = 0;
    const sentTargets: string[] = [];

    if (proposalGroupIdStr) {
      const okGroup = await sendTelegram(botToken, proposalGroupIdStr, msg, replyMarkup);
      if (okGroup) {
        sentSuccessCount++;
        sentTargets.push(`กลุ่มเสนอหนังสือ (${proposalGroupIdStr})`);
      }
    }

    if (directorProfiles && directorProfiles.length > 0) {
      for (const dir of directorProfiles) {
        if (dir.telegram_chat_id) {
          const okPersonal = await sendTelegram(botToken, dir.telegram_chat_id, msg, replyMarkup);
          if (okPersonal) {
            sentSuccessCount++;
            sentTargets.push(`${dir.display_name || 'ผอ.'} (${dir.telegram_chat_id})`);
            await new Promise(r => setTimeout(r, 200));
          }
        }
      }
    }

    console.log(`[DIRECTOR-REMINDER] ส่งสำเร็จ ${sentSuccessCount} ช่องทาง (${sentTargets.join(', ')}) หนังสือค้าง ${totalCount} ฉบับ`);

    const resultPayload = {
      success: true,
      sentCount: sentSuccessCount,
      sentTargets,
      totalPendingCount: totalCount,
      displayedCount: pendingDocs.length,
      timestamp: new Date().toISOString()
    };

    if (res?.status) return res.status(200).json(resultPayload);
    return new Response(JSON.stringify(resultPayload, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

  } catch (err: any) {
    console.error('[DIRECTOR-REMINDER] Critical Error:', err);
    if (res?.status) return res.status(500).json({ error: err.message || 'Internal Server Error' });
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
