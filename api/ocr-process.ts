import { createClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';

declare const process: any;

function getSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseKey);
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
async function sendTelegramMessage(botToken: string, chatId: number, text: string, replyMarkup?: any) {
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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // ตอบกลับ 200 OK ทันที ป้องกัน timeout
  res.status(200).json({ ok: true, message: 'กำลังประมวลผล OCR และความจำ RAG ในพื้นหลัง...' });

  const mockRes: any = {
    status: () => mockRes,
    json: () => mockRes,
    send: () => mockRes,
    end: () => mockRes
  };

  waitUntil((async () => {
    const res = mockRes;
    const { docId, fileUrl } = req.body || {};
    if (!docId || !fileUrl) return;

    try {
      const supabase = getSupabase();

      // 1. ดึงข้อมูล Settings & Teachers
      const { data: settings } = await supabase
        .from('settings')
        .select('school_name, telegram_bot_token, telegram_group_id, gemini_api_key, ai_cowork_api_key, current_academic_year, google_vision_api_key')
        .single();

      if (!settings) return;
      const rawApiKey = settings.ai_cowork_api_key || settings.gemini_api_key || '';
      const apiKey = rawApiKey.split(',')[0].trim();
      const botToken = settings.telegram_bot_token;

      // ดึงรายชื่อครูทั้งหมดไว้สำหรับแมตช์ผู้รับมอบหมาย
      const { data: teachers } = await supabase
        .from('teachers')
        .select('id, prefix, first_name, last_name, position, department')
        .eq('status', 'active');

      const teachersListStr = (teachers || []).map((t: any) => `- ID: ${t.id} | ชื่อ: ${t.prefix || ''}${t.first_name} ${t.last_name} | ตำแหน่ง: ${t.position || '-'} | ฝ่าย: ${t.department || '-'}`).join('\n');

      // 2. ดาวน์โหลดไฟล์เอกสารเพื่อนำมาทำ OCR
      let extractedText = '';
      let inlineImageData: { mimeType: string, data: string } | undefined = undefined;

      const fileRes = await fetch(fileUrl);
      if (fileRes.ok) {
        const arrayBuffer = await fileRes.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        const isPdf = fileUrl.toLowerCase().endsWith('.pdf');
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
  "doc_number": "เลขที่หนังสือ (ถ้ามี)",
  "subject": "ชื่อเรื่องหนังสือ",
  "from_agency": "หน่วยงานผู้ส่ง",
  "doc_date": "วันที่หนังสือ (รูปแบบ YYYY-MM-DD ถ้าไม่ทราบใส่ null)",
  "urgency": "ปกติ หรือ ด่วน หรือ ด่วนที่สุด",
  "summary": "สรุปสาระสำคัญของหนังสือ 2-3 บรรทัด",
  "action_deadline": "วันที่ต้องส่งงาน/หมดเขตดำเนินการ (รูปแบบ YYYY-MM-DDTHH:mm:ssZ ถ้าไม่มีให้ใส่ null)",
  "suggested_assignee_id": "เลือก ID ของครูจากรายชื่อด้านล่างที่เหมาะสมที่สุดในการรับมอบหมายงานนี้ (ถ้าไม่แน่ใจใส่ null)"
}

รายชื่อครูและบุคลากรในโรงเรียน:
${teachersListStr}

เนื้อหาเอกสาร:
${extractedText.substring(0, 4000)}
      `;

      const aiAnalysisRaw = await callGemini("คุณคือผู้ช่วยสกัดข้อมูลและมอบหมายงานสารบรรณโรงเรียน", analysisPrompt, apiKey);

      let parsedInfo: any = {};
      try {
        const jsonMatch = aiAnalysisRaw.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsedInfo = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('[OCR PROCESS] JSON parse error:', e);
      }

      // 4. ดึงข้อมูลเดิมของ incoming_docs เพื่ออัปเดต remark โดยไม่ทับเลขที่รับของโรงเรียน (doc_number)
      const { data: currentDoc } = await supabase.from('incoming_docs').select('remark').eq('id', docId).single();
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

      if (parsedInfo.doc_number) existingRemarkObj.sender_doc_number = parsedInfo.doc_number;
      if (parsedInfo.summary) existingRemarkObj.proposal_summary = parsedInfo.summary;

      const updatePayload: any = {
        extracted_text: extractedText,
        auto_processed_at: new Date().toISOString(),
        remark: JSON.stringify(existingRemarkObj)
      };

      // หมายเหตุ: ไม่ทับ doc_number (เลขที่รับของโรงเรียน) ด้วย parsedInfo.doc_number
      if (parsedInfo.subject) updatePayload.subject = parsedInfo.subject;
      if (parsedInfo.from_agency) updatePayload.from_agency = parsedInfo.from_agency;
      if (parsedInfo.doc_date) updatePayload.doc_date = parsedInfo.doc_date;
      if (parsedInfo.urgency) updatePayload.urgency = parsedInfo.urgency;
      if (parsedInfo.action_deadline) updatePayload.action_deadline = parsedInfo.action_deadline;
      if (parsedInfo.suggested_assignee_id) updatePayload.suggested_assignee_id = parsedInfo.suggested_assignee_id;

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
        let suggestedTeacherName = 'ไม่ระบุ';
        if (parsedInfo.suggested_assignee_id && teachers) {
          const matchedT = teachers.find((t: any) => t.id === parsedInfo.suggested_assignee_id);
          if (matchedT) {
            suggestedTeacherName = `${matchedT.prefix || ''}${matchedT.first_name} ${matchedT.last_name}`;
          }
        }

        let notifyMsg = `📄 <b>สแกนอ่านหนังสือรับสำเร็จเรียบร้อย!</b>\n\n`;
        notifyMsg += `<b>เรื่อง:</b> ${docSubject}\n`;
        notifyMsg += `<b>เลขที่หนังสือ:</b> ${parsedInfo.doc_number || '-'}\n`;
        if (parsedInfo.summary) notifyMsg += `<b>สรุปสาระสำคัญ:</b> "${parsedInfo.summary}"\n`;
        if (parsedInfo.action_deadline) {
          const deadlineDate = new Date(parsedInfo.action_deadline).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
          notifyMsg += `⏰ <b>กำหนดการดำเนินการ:</b> <u>${deadlineDate}</u>\n`;
        }
        notifyMsg += `🧑‍🏫 <b>ครูผู้รับงานที่ AI แนะนำ:</b> <b>${suggestedTeacherName}</b>\n`;

        const inlineButtons: any[] = [];
        if (parsedInfo.suggested_assignee_id) {
          inlineButtons.push([{
            text: `✅ มอบหมายครู ${suggestedTeacherName} ทันที`,
            callback_data: `action=smart_assign_confirm&doc_id=${docId}&t_id=${parsedInfo.suggested_assignee_id}`
          }]);
        }
        inlineButtons.push([{
          text: `✍️ เลือกครูท่านอื่น / ระบุคำสั่งเอง`,
          callback_data: `action=start_assign&id=${docId}`
        }]);

        // ส่งให้ ผอ.
        const { data: directors } = await supabase.from('profiles').select('telegram_chat_id').eq('role', 'director');
        if (directors) {
          for (const dir of directors) {
            if (dir.telegram_chat_id) {
              await sendTelegramMessage(botToken, parseInt(dir.telegram_chat_id), notifyMsg, { inline_keyboard: inlineButtons });
            }
          }
        }
      }

    } catch (err: any) {
      console.error('[OCR PROCESS ERROR]', err);
    }
  })());
}
