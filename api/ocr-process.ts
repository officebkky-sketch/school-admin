import { createClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';

declare const process: any;

/** HTML escape ป้องกัน XSS/400 Error ใน Telegram HTML mode */
function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** แปลงเลขไทย → เลขอารบิก เพื่อ standardize เลขที่หนังสือก่อนบันทึกทุกครั้ง */
function toArabicNumerals(str: string): string {
  if (!str) return str;
  return str.replace(/[๐-๙]/g, d => '๐๑๒๓๔๕๖๗๘๙'.indexOf(d).toString());
}

/** Helper: แปลง URL ของ Google Drive ให้เป็น Direct Download Link สำหรับดาวน์โหลด Binary */
function getDirectDownloadUrl(url: string): string {
  if (!url) return '';
  if (url.includes('drive.google.com')) {
    const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const fileId = match1?.[1] || match2?.[1];
    if (fileId) {
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
  }
  return url;
}

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/** ฟังก์ชันเรียก Gemini API สำหรับสกัดข้อมูล */
async function callGemini(system: string, user: string, apiKey: string, inlineImageData?: { mimeType: string, data: string }): Promise<string> {
  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];
  for (const model of models) {
    try {
      const parts: any[] = [];
      if (inlineImageData) {
        parts.push({
          inlineData: {
            mimeType: inlineImageData.mimeType,
            data: inlineImageData.data
          }
        });
      }
      parts.push({ text: user });

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ parts }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
        })
      });
      if (res.ok) {
        const data = await res.json() as any;
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch (e) {
      console.error(`[OCR PROCESS] Gemini error on model ${model}:`, e);
    }
  }
  return "";
}

/** ฟังก์ชันส่ง Telegram Message */
async function sendTelegramMessage(botToken: string, chatId: number | string, text: string, replyMarkup?: any) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,

      text: text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    }),
  });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export default async function handler(req: Request): Promise<Response> {
  // 1. รองรับ CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  // 2. ปลอดภัยในการ Parse Request Body
  let body: any = {};
  try {
    if (typeof req.json === 'function') {
      body = await req.json();
    } else if ((req as any).body) {
      body = (req as any).body;
    }
  } catch (e) {
    console.warn('[OCR PROCESS] Body parsing warning:', e);
  }

  // ตอบกลับ 200 OK ทันที ป้องกัน client timeout
  const immediateResponse = new Response(JSON.stringify({ 
    ok: true, 
    message: 'กำลังประมวลผล OCR และความจำ RAG ในพื้นหลัง...' 
  }), { 
    status: 200, 
    headers: corsHeaders 
  });

  const processTask = async () => {
    const { docId, fileUrl } = body || {};
    if (!docId || !fileUrl) return;

    let supabase: any = null;
    let botToken: string | undefined = undefined;

    try {
      supabase = getSupabase();

      // 1. ดึงข้อมูล Settings & Teachers
      const { data: settings } = await supabase
        .from('settings')
        .select('school_name, telegram_bot_token, telegram_group_id, gemini_api_key, ai_cowork_api_key, current_academic_year, google_vision_api_key')
        .single();

      if (!settings) return;
      const rawApiKey = settings.ai_cowork_api_key || settings.gemini_api_key || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
      const apiKey = rawApiKey.split(',')[0].trim();
      botToken = settings.telegram_bot_token;

      // ดึงรายชื่อครูทั้งหมดไว้สำหรับแมตช์ผู้รับมอบหมาย
      const { data: teachers } = await supabase
        .from('teachers')
        .select('id, prefix, first_name, last_name, position, department')
        .eq('status', 'active');

      // ย่อรายชื่อครูให้สั้น เพื่อไม่กินพื้นที่ context จนตัดเนื้อหาเอกสาร
      const teachersListStr = (teachers || []).map((t: any) =>
        `- ${t.prefix || ''}${t.first_name} ${t.last_name} (ฝ่าย: ${t.department || 'ไม่ระบุ'})`
      ).join('\n');

      // 2. ดาวน์โหลดไฟล์เอกสารเพื่อนำมาทำ OCR
      let extractedText = '';
      let inlineImageData: { mimeType: string, data: string } | undefined = undefined;

      const directDownloadUrl = getDirectDownloadUrl(fileUrl);
      const fileRes = await fetch(directDownloadUrl);
      if (fileRes.ok) {
        const arrayBuffer = await fileRes.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        const isPdf = fileUrl.toLowerCase().endsWith('.pdf') || (fileRes.headers.get('content-type') || '').includes('pdf');
        const mimeType = isPdf ? 'application/pdf' : 'image/jpeg';

        // ใช้ Cloud Vision API หากมี Key
        if (settings.google_vision_api_key && !isPdf) {
          try {
            const vRes = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${settings.google_vision_api_key}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                requests: [{
                  image: { content: base64Data },
                  features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
                }]
              })
            });
            if (vRes.ok) {
              const vData = await vRes.json() as any;
              extractedText = vData.responses?.[0]?.fullTextAnnotation?.text || '';
            }
          } catch (vErr) {
            console.error('[OCR PROCESS] Vision API Error:', vErr);
          }
        }

        // หากยังไม่ได้ข้อความ ใช้ Gemini Multimodal API อ่านไฟล์โดยตรง
        if (!extractedText && apiKey) {
          inlineImageData = { mimeType, data: base64Data };
          const ocrPrompt = "จงอ่านและแปลงข้อความทั้งหมดในไฟล์เอกสารนี้ให้ออกมาเป็นข้อความ Markdown รักษารูปแบบตารางและหัวข้อให้อยู่ในลำดับเดิมทั้งหมดโดยไม่ตัดทอน";
          extractedText = await callGemini("คุณคือผู้เชี่ยวชาญ OCR อ่านเอกสารราชการไทย", ocrPrompt, apiKey, inlineImageData);
        }
      }

      if (!extractedText && !inlineImageData) {
        console.error('[OCR PROCESS] Failed to extract text from document');
        return;
      }

      // 3. ใช้ Gemini วิเคราะห์ Metadata, กำหนดการ (Deadline) และครูผู้รับมอบหมาย
      const analysisPrompt = `
จากเอกสารราชการไทยด้านล่างนี้ ให้สกัดข้อมูลสำคัญแล้วตอบกลับเฉพาะโครงสร้าง JSON ดังต่อไปนี้เท่านั้น (ห้ามพิมพ์ข้อความอื่นนอก JSON):

{
  "doc_number": "เลขที่หนังสือของผู้ส่ง เช่น ศธ 04225/2666 (ถ้าไม่มีใส่ null)",
  "subject": "ชื่อเรื่องหนังสือ (ให้สกัดจากส่วน 'เรื่อง:' เท่านั้น ห้ามใช้ชื่อหน่วยงานหรือหัวกระดาษ)",
  "from_agency": "ชื่อหน่วยงานผู้ส่ง (สกัดจาก 'จาก:' หรือหัวจดหมาย)",
  "doc_date": "วันที่หนังสือ (รูปแบบ YYYY-MM-DD ถ้าไม่ทราบใส่ null)",
  "urgency": "ปกติ หรือ ด่วน หรือ ด่วนที่สุด (ให้เดาจากเนื้อหา ห้ามใส่ null)",
  "summary": "สรุปสาระสำคัญของหนังสือ 2-3 ประโยค (ให้สรุปเสมอ ห้ามใส่ null)",
  "action_deadline": "วันที่ต้องส่งงาน/หมดเขตดำเนินการ (รูปแบบ YYYY-MM-DDTHH:mm:ssZ ถ้าไม่มีให้ใส่ null)",
  "suggested_assignee_name": "ชื่อ-นามสกุลครูจากรายชื่อด้านล่างที่เหมาะสมที่สุด (ให้เดาจากเนื้อหา อย่าใส่ null โดยไม่จำเป็น)",
  "suggested_assignee_dept": "ฝ่าย/กลุ่มสาระที่ควรรับผิดชอบงานนี้ เช่น วิชาการ, กิจการนักเรียน, งบประมาณ (ให้เดาจากเนื้อหาเสมอ)"
}

รายชื่อครูและบุคลากรในโรงเรียน:
${teachersListStr}

เนื้อหาเอกสาร:
${extractedText.substring(0, 5000)}
      `;

      const aiAnalysisRaw = await callGemini("คุณคือผู้ช่วยสกัดข้อมูลและมอบหมายงานสารบรรณโรงเรียน ให้ตอบเป็น JSON เท่านั้น ห้ามอธิบายเพิ่มเติม", analysisPrompt, apiKey);

      let parsedInfo: any = {};
      try {
        const jsonMatch = aiAnalysisRaw.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsedInfo = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('[OCR PROCESS] JSON parse error:', e);
      }

      // Phase 2: Fuzzy Matching 3 ชั้น หาครูที่ตรงจาก suggested_assignee_name / dept
      let matchedTeacher: any = null;
      if (teachers && teachers.length > 0) {
        const suggestedName = (parsedInfo.suggested_assignee_name || '').toLowerCase().trim();
        const suggestedDept = (parsedInfo.suggested_assignee_dept || '').toLowerCase().trim();

        // ชั้น 1: ชื่อ/นามสกุล fuzzy match
        if (suggestedName) {
          matchedTeacher = teachers.find((t: any) => {
            const firstName = (t.first_name || '').toLowerCase();
            const lastName = (t.last_name || '').toLowerCase();
            const fullName = `${t.prefix || ''}${t.first_name} ${t.last_name}`.toLowerCase();
            return fullName.includes(suggestedName) ||
                   suggestedName.includes(firstName) ||
                   suggestedName.includes(lastName);
          }) || null;
        }

        // ชั้น 2: Department keyword match (fallback)
        if (!matchedTeacher && suggestedDept) {
          matchedTeacher = teachers.find((t: any) => {
            const dept = (t.department || '').toLowerCase();
            return dept && (suggestedDept.includes(dept) || dept.includes(suggestedDept));
          }) || null;
        }
      }

      // 4. ดึงข้อมูลเดิมของ incoming_docs (รวม doc_number เลขรับ, subject, from_agency เพื่อตรวจสอบก่อนทับ)
      const { data: currentDoc } = await supabase.from('incoming_docs')
        .select('remark, subject, from_agency, doc_number').eq('id', docId).single();
      let existingRemarkObj: any = {};
      if (currentDoc?.remark) {
        try {
          existingRemarkObj = typeof currentDoc.remark === 'string' && currentDoc.remark.startsWith('{') 
            ? JSON.parse(currentDoc.remark) 
            : { summary_text: currentDoc.remark };
        } catch (e) {
          existingRemarkObj = { summary_text: currentDoc.remark };
        }
      }

      // Phase 4: Merge remark อย่างปลอดภัย — OCR เป็น fallback เท่านั้น
      // sender_doc_number: ทับเฉพาะเมื่อว่าง, แปลงเลขไทย→อารบิกทุกครั้ง
      if (parsedInfo.doc_number) {
        const arabicDocNum = toArabicNumerals(parsedInfo.doc_number);
        if (!existingRemarkObj.sender_doc_number) {
          existingRemarkObj.sender_doc_number = arabicDocNum;
        } else {
          // มีค่าแล้ว → เก็บ OCR ไว้ใน key แยก ไม่ทับของเดิม
          existingRemarkObj.ocr_doc_number = arabicDocNum;
        }
      }

      // proposal_summary: ห้ามทับ — เก็บ AI summary ใน ai_summary แยก
      if (parsedInfo.summary) {
        existingRemarkObj.ai_summary = parsedInfo.summary;
        if (!existingRemarkObj.proposal_summary) {
          existingRemarkObj.proposal_summary = parsedInfo.summary;
        }
      }

      const updatePayload: any = {
        extracted_text: extractedText,
        auto_processed_at: new Date().toISOString(),
        ai_status: 'success',
        remark: JSON.stringify(existingRemarkObj)
      };

      // หมายเหตุ: ไม่ทับ doc_number (เลขที่รับของโรงเรียน) ด้วย parsedInfo.doc_number
      // subject: ทับเฉพาะเมื่อว่างหรือเป็น default fallback ที่ผู้ใช้ไม่ได้กรอก
      if (parsedInfo.subject && (!currentDoc?.subject || currentDoc.subject === 'หนังสือรับ' || currentDoc.subject === '-' || currentDoc.subject === '')) {
        updatePayload.subject = parsedInfo.subject;
      }
      // from_agency: ทับเฉพาะเมื่อว่าง
      if (parsedInfo.from_agency && (!currentDoc?.from_agency || currentDoc.from_agency === '-' || currentDoc.from_agency === '')) {
        updatePayload.from_agency = parsedInfo.from_agency;
      }
      if (parsedInfo.doc_date) updatePayload.doc_date = parsedInfo.doc_date;
      if (parsedInfo.urgency) updatePayload.urgency = parsedInfo.urgency;
      if (parsedInfo.action_deadline) updatePayload.action_deadline = parsedInfo.action_deadline;
      // ใช้ matched teacher ID จาก fuzzy matching แทน suggested_assignee_id เดิม
      if (matchedTeacher) updatePayload.suggested_assignee_id = matchedTeacher.id;

      await supabase
        .from('incoming_docs')
        .update(updatePayload)
        .eq('id', docId);

      // 5. บันทึกเข้า RAG Knowledge Base (`school_knowledge`) สำหรับความจำถาวรน้องชบา
      const docSubject = parsedInfo.subject || 'หนังสือรับ';
      const chunkSize = 1500;
      for (let i = 0; i < extractedText.length; i += chunkSize) {
        const chunk = extractedText.substring(i, i + chunkSize);
        const docName = `[หนังสือรับ] ${docSubject} (ส่วน ${Math.floor(i / chunkSize) + 1})`;
        
        await supabase.from('school_knowledge').upsert({
          document_name: docName,
          chunk_text: chunk,
          source_doc_id: docId,
          source_type: 'incoming_doc'
        }, { onConflict: 'document_name' });
      }

      // 6. แจ้งเตือนเข้า Telegram ผอ. / กลุ่ม พร้อมเสนอสกัดตารางงาน & ผู้รับมอบหมาย
      if (botToken) {
        // Phase 3: คำนวณ AI confidence score
        let aiConfidence = 0;
        if (parsedInfo.doc_number) aiConfidence++;
        if (parsedInfo.subject) aiConfidence++;
        if (parsedInfo.summary) aiConfidence++;
        if (parsedInfo.action_deadline) aiConfidence++;
        if (matchedTeacher) aiConfidence++;
        const totalFields = 5;

        // ใช้ matchedTeacher จาก fuzzy matching แทนการ find UUID
        const suggestedTeacherName = matchedTeacher
          ? `${matchedTeacher.prefix || ''}${matchedTeacher.first_name} ${matchedTeacher.last_name}`
          : '';

        // ชื่อเรื่องที่แสดงใน notification: ใช้ค่าที่ผู้ใช้กรอก (currentDoc) ก่อน แล้วค่อย fallback
        const displaySubject = updatePayload.subject || currentDoc?.subject || parsedInfo.subject || 'ไม่ระบุ';
        // เนื้อหาที่เสนอ: ใช้ proposal_summary ที่ผู้ใช้กรอก (ก่อน AI ทับ)
        const proposalSummary = existingRemarkObj.proposal_summary || '';

        let notifyMsg = `📄 <b>สแกนอ่านหนังสือรับสำเร็จเรียบร้อย!</b>\n\n`;
        // เลขรับในสารบรรณ (เลขที่โรงเรียนออกเอง)
        notifyMsg += `📌 <b>เลขรับที่:</b> <code>${escapeHtml(currentDoc?.doc_number || '-')}</code>\n`;
        notifyMsg += `<b>เรื่อง:</b> ${escapeHtml(displaySubject)}\n`;
        notifyMsg += `<b>เลขที่หนังสือ (ผู้ส่ง):</b> ${escapeHtml(toArabicNumerals(parsedInfo.doc_number || '') || '-')}\n`;
        // เนื้อหาที่เสนอ (proposal_summary ที่ผู้ใช้กรอกตอนรับหนังสือ)
        if (proposalSummary) {
          notifyMsg += `📝 <b>เนื้อหาที่เสนอ:</b> ${escapeHtml(proposalSummary)}\n`;
        }
        notifyMsg += `\n`;
        // แสดง summary เสมอ ไม่ซ่อน
        notifyMsg += `<b>สรุปสาระสำคัญ (AI):</b> ${parsedInfo.summary ? `"${escapeHtml(parsedInfo.summary)}"` : '<i>(วิเคราะห์ไม่ได้)</i>'}\n`;
        // แสดง deadline เสมอ ไม่ซ่อน
        if (parsedInfo.action_deadline) {
          const deadlineDate = new Date(parsedInfo.action_deadline).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
          notifyMsg += `⏰ <b>กำหนดการดำเนินการ:</b> <u>${deadlineDate}</u>\n`;
        } else {
          notifyMsg += `⏰ <b>กำหนดการดำเนินการ:</b> <i>(ไม่พบในเอกสาร)</i>\n`;
        }
        // แสดงครูที่แนะนำพร้อมเหตุผล
        if (suggestedTeacherName) {
          notifyMsg += `🧑‍🏫 <b>ครูผู้รับงานที่ AI แนะนำ:</b> <b>${escapeHtml(suggestedTeacherName)}</b>\n`;
        } else if (parsedInfo.suggested_assignee_dept) {
          notifyMsg += `🧑‍🏫 <b>ครูผู้รับงานที่ AI แนะนำ:</b> <i>(ไม่พบในรายชื่อ — ฝ่ายที่ควรรับ: ${escapeHtml(parsedInfo.suggested_assignee_dept)})</i>\n`;
        } else {
          notifyMsg += `🧑‍🏫 <b>ครูผู้รับงานที่ AI แนะนำ:</b> <i>(กรุณาเลือกด้วยตนเอง)</i>\n`;
        }
        notifyMsg += `\n🤖 <i>AI วิเคราะห์ได้ ${aiConfidence}/${totalFields} ฟิลด์</i>`;

        const inlineButtons: any[] = [];
        // ปุ่ม ✅ มอบหมายทันที: แสดงเฉพาะเมื่อ fuzzy match สำเร็จ
        if (matchedTeacher) {
          inlineButtons.push([{
            text: `✅ มอบหมาย ${suggestedTeacherName} ทันที`,
            callback_data: `action=smart_assign_confirm&doc_id=${docId}&t_id=${matchedTeacher.id}`
          }]);
        }
        inlineButtons.push([{
          text: `✍️ เลือกครูท่านอื่น / ระบุคำสั่งเอง`,
          callback_data: `action=start_assign&id=${docId}`
        }]);


        // ส่งให้ ผอ. ส่วนตัว
        const { data: directors } = await supabase.from('profiles').select('telegram_chat_id').eq('role', 'director');
        if (directors) {
          for (const dir of directors) {
            if (dir.telegram_chat_id) {
              await sendTelegramMessage(botToken, dir.telegram_chat_id, notifyMsg, { inline_keyboard: inlineButtons });
            }
          }
        }

        // Rule B: ส่งเข้ากลุ่มเสนอหนังสือ (ถ้ามี)
        const rawGroupId = settings.telegram_group_id || '';
        const proposalGroupId = rawGroupId.split('|')[1]?.trim() || rawGroupId.split('|')[0]?.trim();
        if (proposalGroupId) {
          await sendTelegramMessage(botToken, proposalGroupId, notifyMsg, { inline_keyboard: inlineButtons });
        }
      }


    } catch (err: any) {
      console.error('[OCR PROCESS ERROR]', err);
      try {
        await supabase.from('incoming_docs').update({ ai_status: 'failed' }).eq('id', docId);
        if (botToken) {
          const { data: admins } = await supabase.from('profiles').select('telegram_chat_id').in('role', ['admin', 'director']);
          if (admins) {
            for (const adm of admins) {
              if (adm.telegram_chat_id) {
                const alertMsg = `⚠️ <b>แจ้งเตือนข้อผิดพลาด OCR</b>\n\nเกิดข้อผิดพลาดขณะวิเคราะห์เอกสาร ID: <code>${docId}</code>\n❌ <b>รายละเอียด:</b> ${err.message || 'Unknown error'}\n\n<i>ท่านสามารถกดปุ่มลองใหม่อีกครั้งบนหน้าเว็บระบบสารบรรณได้ค่ะ</i>`;
                await sendTelegramMessage(botToken, parseInt(adm.telegram_chat_id), alertMsg);
              }
            }
          }
        }
      } catch (alertErr) {
        console.error('[OCR ALERT ERROR]', alertErr);
      }
    }
  };

  try {
    waitUntil(processTask());
  } catch (waitUntilErr) {
    console.warn('[OCR PROCESS] waitUntil fallback:', waitUntilErr);
    processTask().catch(e => console.error('[DETACHED OCR TASK ERROR]', e));
  }

  return immediateResponse;
}

