declare const process: any;
import { createClient } from '@supabase/supabase-js';

// ── Helper: ส่งข้อความ Telegram ──────────────────────────────────────────────
async function sendTelegram(token: string, chatId: number, text: string, replyMarkup?: any) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,          // Fix Bug#2: ใช้ number เสมอ ไม่ใช่ string
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: replyMarkup
      })
    });
    if (!res.ok) {
      const errBody = await res.json() as any;
      console.error('[DIRECTOR-REMINDER] Telegram API error:', errBody);
    }
  } catch (err) {
    console.error('[DIRECTOR-REMINDER] sendTelegram error:', err);
  }
}

// ── Helper: เลือกสัญลักษณ์ความเร่งด่วน ───────────────────────────────────────
function urgencyEmoji(urgency?: string): string {
  if (urgency === 'ด่วนที่สุด') return '🔴 <b>[ด่วนที่สุด]</b>';
  if (urgency === 'ด่วนมาก' || urgency === 'ด่วน') return '🟡 <b>[ด่วน]</b>';
  return '🟢 <b>[ปกติ]</b>';
}

// ── Helper: แปลง attachment_urls ให้เป็น string[] เสมอ (Bug#3) ───────────────
function parseAttachmentUrls(raw: any): string[] {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try { return JSON.parse(raw).filter(Boolean); } catch { /* ignore */ }
  }
  return [];
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export default async function handler(req: Request): Promise<Response> {
  // ✅ 1. ตรวจสอบ Authorization Header (Vercel CRON_SECRET)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // ✅ 2. ตรวจสอบวันทำงาน (เฉพาะ จันทร์ - ศุกร์) ตามเวลาประเทศไทย Asia/Bangkok
  const now = new Date();
  const bangkokDateStr = now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' });
  const bangkokDate = new Date(bangkokDateStr);
  const dayOfWeek = bangkokDate.getDay(); // 0 = อาทิตย์, 6 = เสาร์

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log('[DIRECTOR-REMINDER] Skipped: Weekend day (Sat/Sun)');
    return new Response(JSON.stringify({ message: 'Skipped: Weekend day' }), { status: 200 });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    // Fix: ใช้ SUPABASE_SERVICE_ROLE_KEY ให้ตรงกับชื่อที่ตั้งไว้จริงใน Vercel Dashboard
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ✅ 3. ดึงตั้งค่า Telegram ของโรงเรียน
    const { data: settings } = await supabase
      .from('settings')
      .select('school_name, telegram_bot_token, telegram_group_id')
      .limit(1)
      .maybeSingle();

    if (!settings || !settings.telegram_bot_token) {
      return new Response(JSON.stringify({ message: 'No Telegram bot token configured' }), { status: 200 });
    }

    const botToken = settings.telegram_bot_token;
    const rawGroupId = settings.telegram_group_id || '';

    // Rule B: telegram_group_id เป็น "centralId|proposalId"
    // Fix Bug#2: แปลงเป็น number ตั้งแต่ต้น เพื่อให้ Telegram API รับได้ถูกต้อง
    const proposalGroupIdStr = rawGroupId.split('|')[1]?.trim() || rawGroupId.split('|')[0]?.trim() || '';
    const proposalGroupId: number | null = proposalGroupIdStr ? parseInt(proposalGroupIdStr, 10) : null;
    // ตรวจว่า parse ได้จริง
    const validProposalGroupId = proposalGroupId !== null && !isNaN(proposalGroupId) ? proposalGroupId : null;

    // ✅ 4. ดึงรายการหนังสือรับเข้าที่ยังรอการเกษียณสั่งการ (status = pending หรือ waiting_proposal)
    // ดึงทั้ง file_url (ไฟล์หลัก) และ attachment_urls (ไฟล์แนบ) พร้อมนับจำนวนรวมทั้งหมด
    const { data: pendingDocs, count: totalPending } = await supabase
      .from('incoming_docs')
      .select('id, doc_number, subject, from_agency, urgency, doc_date, file_url, attachment_urls, created_at', { count: 'exact' })
      .in('status', ['pending', 'waiting_proposal'])
      .order('created_at', { ascending: false })
      .limit(10); // จำกัดแสดงรายละเอียด 10 ฉบับแรก ป้องกันข้อความยาวเกินไปบน Telegram

    // Fix Bug#4: ใช้ null check แทน || เพื่อไม่ให้ totalPending=0 ถูกแทนที่ผิดพลาด
    const totalCount = (totalPending !== null && totalPending !== undefined)
      ? totalPending
      : (pendingDocs ? pendingDocs.length : 0);

    // หากไม่มีหนังสือค้าง ไม่ต้องส่งข้อความใดๆ เพื่อไม่รบกวน ผอ.
    if (!pendingDocs || pendingDocs.length === 0 || totalCount === 0) {
      console.log('[DIRECTOR-REMINDER] No pending documents for retirement. Skipped sending message.');
      return new Response(JSON.stringify({ message: 'No pending documents for retirement' }), { status: 200 });
    }

    // ✅ 5. คิวรีหา ผอ.รร. จาก profiles (role = director หรือ admin ที่ผูก telegram_chat_id ไว้)
    const { data: directorProfiles } = await supabase
      .from('profiles')
      .select('telegram_chat_id, display_name, role')
      .or('role.eq.director,role.eq.admin')
      .not('telegram_chat_id', 'is', null);

    // ✅ 6. ประกอบข้อความแจ้งเตือน Executive Digest
    const thaiDateText = bangkokDate.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    let msg = `🌅 <b>[สรุปประจำวัน 08:00 น.] หนังสือรอเกษียณสั่งการ</b>\n`;
    msg += `🏫 <b>${settings.school_name || 'โรงเรียน'} (ประจำวันที่ ${thaiDateText})</b>\n\n`;
    msg += `⚠️ <b>เรียน ผอ.รร. ขณะนี้มีหนังสือรับเข้าคงค้างรอเกษียณสั่งการทั้งหมด ${totalCount} ฉบับ:</b>\n\n`;

    const inlineButtons: any[] = [];

    pendingDocs.forEach((doc, idx) => {
      const emoji = urgencyEmoji(doc.urgency);
      const docNumStr = doc.doc_number || (idx + 1).toString();
      msg += `${idx + 1}. ${emoji} <b>เรื่อง:</b> ${doc.subject || '-'}\n`;
      msg += `   • <b>จาก:</b> ${doc.from_agency || '-'}\n`;
      msg += `   • <b>เลขรับ:</b> ${docNumStr}\n`;

      // แสดงลิงก์ต้นฉบับเอกสารหลัก
      if (doc.file_url) {
        msg += `   📄 <a href="${doc.file_url}">เปิดดูต้นฉบับ</a>`;
      }

      // Fix Bug#3: ใช้ helper parseAttachmentUrls รองรับทั้ง Array และ JSON string
      const atts = parseAttachmentUrls(doc.attachment_urls);
      if (atts.length > 0) {
        msg += ` | 📎 <b>ไฟล์แนบ:</b> `;
        atts.forEach((url: string, i: number) => {
          msg += `<a href="${url}">[แนบ ${i + 1}]</a> `;
        });
      }

      if (doc.file_url || atts.length > 0) {
        msg += `\n`;
      }

      msg += `\n`;

      // ใส่ปุ่มทางลัดสั่งการรายฉบับ (สูงสุด 5 ปุ่ม เพื่อไม่ให้แน่นหน้าจอ)
      if (inlineButtons.length < 5) {
        inlineButtons.push([{
          text: `✍️ สั่งการเรื่อง ${docNumStr}`,
          callback_data: `action=start_assign&id=${doc.id}`
        }]);
      }
    });

    // หากมีหนังสือค้างมากกว่า 10 ฉบับ ให้แสดงข้อความแจ้งเตือนเพิ่มเติม
    if (totalCount > 10) {
      msg += `📌 <i>และยังมีหนังสือรอเกษียณอีก ${totalCount - 10} ฉบับในระบบ...</i>\n\n`;
    }

    msg += `💡 <i>ท่านสามารถกดปุ่ม "✍️ สั่งการ" ด้านล่างข้อความเพื่อดำเนินการผ่าน Telegram ได้ทันทีครับ</i>`;

    const replyMarkup = { inline_keyboard: inlineButtons };

    // ✅ 7. ส่งข้อความ (ส่งเข้า Telegram ส่วนตัว ผอ. ถ้าผูกไว้ -> หากไม่มีให้ Fallback เข้ากลุ่มเสนอหนังสือ)
    let sentCount = 0;

    if (directorProfiles && directorProfiles.length > 0) {
      for (const dir of directorProfiles) {
        if (dir.telegram_chat_id) {
          // Fix Bug#2: parseInt ให้เป็น number ก่อนส่ง
          const chatIdNum = parseInt(String(dir.telegram_chat_id), 10);
          if (!isNaN(chatIdNum)) {
            await sendTelegram(botToken, chatIdNum, msg, replyMarkup);
            sentCount++;
            await new Promise(r => setTimeout(r, 200));
          } else {
            console.warn('[DIRECTOR-REMINDER] Invalid telegram_chat_id for director:', dir.display_name, dir.telegram_chat_id);
          }
        }
      }
    }

    // Fallback ส่งเข้ากลุ่มเสนอหนังสือ หากไม่สามารถส่งถึง Telegram ส่วนตัวของ ผอ. รายใดได้เลย
    if (sentCount === 0 && validProposalGroupId !== null) {
      console.log('[DIRECTOR-REMINDER] No director telegram_chat_id found. Fallback to proposal group:', validProposalGroupId);
      await sendTelegram(botToken, validProposalGroupId, msg, replyMarkup);
      sentCount++;
    } else if (sentCount === 0) {
      console.warn('[DIRECTOR-REMINDER] No valid chat_id found for director and no valid proposal group ID. Message not sent.');
    }

    console.log(`[DIRECTOR-REMINDER] ส่งแจ้งเตือนหนังสือค้างเกษียณสำเร็จ ${sentCount} ช่องทาง (มีหนังสือค้างทั้งหมด ${totalCount} ฉบับ)`);

    return new Response(JSON.stringify({
      success: true,
      sent: sentCount,
      totalPendingCount: totalCount,
      displayedCount: pendingDocs.length,
      timestamp: bangkokDate.toISOString()
    }), { status: 200 });

  } catch (err: any) {
    console.error('[DIRECTOR-REMINDER] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
