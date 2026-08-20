declare const process: any;
import { createClient } from '@supabase/supabase-js';
import { isNonWorkingDay, getThaiDateInfo } from './_utils/thaiHolidays';

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
export default async function handler(req: Request): Promise<Response> {
  // ✅ 1. ตรวจสอบ Authorization Header / Secret Key
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const url = new URL(req.url || 'http://localhost');
  const querySecret = url.searchParams.get('secret') || url.searchParams.get('key');
  const isForce = url.searchParams.get('force') === 'true';

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ✅ 2. ตรวจสอบวันทำงาน (ข้ามเสาร์-อาทิตย์ และวันหยุดนักขัตฤกษ์ไทย) ตามเวลาประเทศไทย
  const dateInfo = getThaiDateInfo();
  const nonWorkingCheck = isNonWorkingDay();

  if (!isForce && nonWorkingCheck.isNonWorking) {
    console.log(`[DIRECTOR-REMINDER] Skipped: ${nonWorkingCheck.reason}`);
    return new Response(JSON.stringify({
      message: `Skipped: ${nonWorkingCheck.reason}`,
      date: dateInfo.thaiDateStr,
      isHoliday: dateInfo.isHoliday,
      holidayName: dateInfo.holidayName || null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase credentials' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
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
      return new Response(JSON.stringify({ message: 'No Telegram bot token configured in settings' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
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
      return new Response(JSON.stringify({ error: docsErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const totalCount = (totalPending !== null && totalPending !== undefined)
      ? totalPending
      : (pendingDocs ? pendingDocs.length : 0);

    // หากไม่มีหนังสือค้าง ไม่ต้องส่งข้อความ
    if (!pendingDocs || pendingDocs.length === 0 || totalCount === 0) {
      console.log('[DIRECTOR-REMINDER] No pending documents. Skipped.');
      return new Response(JSON.stringify({ message: 'No pending documents for retirement' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
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

    return new Response(JSON.stringify({
      success: true,
      sentCount: sentSuccessCount,
      sentTargets,
      totalPendingCount: totalCount,
      displayedCount: pendingDocs.length,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

  } catch (err: any) {
    console.error('[DIRECTOR-REMINDER] Critical Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
