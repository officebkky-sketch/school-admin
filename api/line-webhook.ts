import { createClient } from '@supabase/supabase-js';

declare const process: any;
declare const Buffer: any;
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!);

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') return res.status(200).json({ message: 'Nong Chaba Online' });
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // 0. รองรับการส่งแจ้งเตือนจาก Electron (Client-side push requests)
  const { lineUserId, message, payload } = req.body;
  if ((lineUserId && message) || payload) {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      return res.status(500).json({ message: 'LINE Channel Access Token not configured on server' });
    }
    try {
      const bodyToSend = payload ? payload : {
        to: lineUserId,
        messages: [{ type: 'text', text: message.substring(0, 5000) }]
      };
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bodyToSend)
      });
      if (response.ok) {
        return res.status(200).json({ success: true, message: 'Notification sent successfully' });
      } else {
        const errData = await response.json();
        console.error('[LINE PUSH ERROR DETAIL]', errData);
        return res.status(response.status).json({ success: false, error: errData });
      }
    } catch (err: any) {
      console.error('[LINE PUSH SYSTEM ERROR]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  try {
    const events = req.body.events || [];
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        const userMsg = event.message.text.trim();
        const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('line_user_id', userId).maybeSingle();

        if (profile) {
          await handleFastAI(event.replyToken, userMsg, profile);
        } else {
          if (userMsg.includes('@')) {
            const { data: found } = await supabaseAdmin.from('profiles').select('*').eq('email', userMsg.toLowerCase().trim()).maybeSingle();
            if (found) {
              await supabaseAdmin.from('profiles').update({ line_user_id: userId }).eq('id', found.id);
              if (found.email) {
                await supabaseAdmin.from('teachers').update({ line_user_id: userId }).ilike('email', found.email);
              }
              await replyToLine(event.replyToken, `ยืนยันตัวตนสำเร็จค่ะคุณครู ${found.display_name}! น้องชบาพร้อมรับใช้แล้วค่ะ ถามงานได้ทันทีเลยนะคะ`);
            } else {
              await replyToLine(event.replyToken, 'ไม่พบอีเมลในระบบค่ะ รบกวนเช็คอีกครั้งนะคะ');
            }
          } else {
            await replyToLine(event.replyToken, 'สวัสดีค่ะ ชบาคือ "น้องชบา" ค่ะ รบกวนคุณครูพิมพ์ "อีเมล" เพื่อเริ่มใช้งานนะคะ');
          }
        }
      }
      
      if (event.type === 'message' && event.message.type === 'image') {
        const userId = event.source.userId;
        const messageId = event.message.id;
        const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('line_user_id', userId).maybeSingle();
        if (profile) {
          await handleReceiptOCR(event.replyToken, messageId, profile);
        } else {
          await replyToLine(event.replyToken, 'สวัสดีค่ะ รบกวนยืนยันตัวตนด้วยการกรอกอีเมลของคุณครูก่อนเริ่มส่งใบเสร็จให้ชบาสแกนนะคะ 🌸');
        }
      }
    }
  } catch (err) { console.error(err); }
  return res.status(200).json({ message: 'OK' });
}

async function handleFastAI(replyToken: string, message: string, _profile: any) {
  try {
    const { data: sets } = await supabaseAdmin.from('settings').select('gemini_api_key, current_academic_year').single();
    const apiKey = sets?.gemini_api_key;
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const currentYear = sets?.current_academic_year || '2569';
    
    console.log(`[LINE WEBHOOK] Message received: "${message}"`);
    
    // 1. Smart Data Fetch (Universal Database Router)
    const contextData = await smartFetchContext(message, currentYear, supabaseAdmin);
    console.log(`[LINE WEBHOOK] Context Data size: ${contextData.length} chars`);

    // 2. High-Speed Direct Prompting with Extraction Tag
    const systemPrompt = `คุณคือ "น้องชบา" ผู้ช่วยครูเพศหญิงของโรงเรียนบ้านควนโคกยา (ห้ามใช้คำว่า AI Cowork หรือ AI เด็ดขาด)
ลักษณะนิสัย: สุภาพ อ่อนน้อม ใช้ "ค่ะ/นะคะ" แทนตัวว่า "ชบา" หรือ "หนู" (ห้ามใช้หางเสียง "ครับ" หรือคำพูดเชิงผู้ชายเด็ดขาด)
กฎเหล็ก:
- ตอบเฉพาะ "คำตอบสุดท้ายที่จะส่งให้ครู" โดยใส่ไว้ในแท็ก <ans>...</ans> เท่านั้น
- ห้ามพิมพ์ขั้นตอนการคิด (Thinking), ห้ามทวนคำถาม, ห้ามเกริ่นนำใดๆ นอกแท็ก <ans>
- ห้ามจินตนาการ ห้ามสร้าง คาดเดา หรือสมมติข้อมูลใดๆ เช่น ชื่อคน ชื่อโครงการ วันที่ หรือตัวเลขขึ้นมาเองโดยเด็ดขาด หากข้อมูลไม่อยู่ใน "ข้อมูลฐานข้อมูลโรงเรียน" ที่ส่งมา ให้ตอบอย่างสุภาพว่าไม่พบข้อมูลดังกล่าวในระบบ (เช่น "ไม่พบข้อมูลรายชื่อครูในระบบค่ะ" หรือ "ไม่มีข้อมูลส่วนนี้ในฐานข้อมูลค่ะ")
- การแยกแยะไฟล์ของหนังสือรับ (incoming_docs):
  * "หนังสือนำส่งหลัก" หรือ "ตัวหนังสือหลักที่ลงเลขรับ" จะใช้ลิงก์ดาวน์โหลดจากฟิลด์ file_url
  * "ไฟล์แนบ" หรือ "เอกสารแนบ" (สิ่งที่ส่งมาด้วย) จะใช้ลิงก์ดาวน์โหลดจากรายการในฟิลด์ attachment_urls ซึ่งเก็บเป็น JSON array
  * หากครูขอ "ไฟล์แนบ" หรือ "เอกสารแนบ": ชบาต้องดึงและแสดงลิงก์ดาวน์โหลดทั้งหมดที่อยู่ใน attachment_urls เท่านั้น ห้ามนำลิงก์ file_url (หนังสือนำ) มาตอบแทนเด็ดขาด! หากในข้อมูลไม่มีไฟล์แนบเพิ่มเติม (attachment_urls ว่างหรือเป็นอาร์เรย์ว่าง) ให้ตอบคุณครูอย่างสุภาพว่า "ไม่มีเอกสารแนบเพิ่มเติมสำหรับหนังสือฉบับนี้ค่ะ"
  * หากครูขอ "ตัวหนังสือ", "หนังสือนำ", หรือเรื่องเอกสารทั่วไป: ให้ส่งลิงก์หนังสือนำหลัก (file_url) และระบุรายการลิงก์ไฟล์แนบเพิ่มเติมไว้ด้านล่างหากมี
- ห้ามใช้สัญลักษณ์ดอกจันเดี่ยว (*) ในการทำ Bullet point ให้เปลี่ยนไปใช้ "•" หรือ "-" แทน
- สามารถใช้ **ตัวหนา** ในประเด็นสำคัญได้ ห้ามละทิ้งรูปแบบตัวหนาเด็ดขาด
- ใช้ Emoji ให้ดูเป็นมิตรและเว้นบรรทัดให้อ่านง่ายบนมือถือ
- ห้ามใช้ Markdown Table ในการตอบคำถามโดยเด็ดขาด ให้ใช้ Bullet points และการเว้นบรรทัดแทน`;

    const userPrompt = `ข้อมูลฐานข้อมูลโรงเรียน: ${contextData || 'ไม่พบข้อมูลที่เกี่ยวข้องในฐานข้อมูลด่วน'}\nปีการศึกษา: ${currentYear}\nคำถามของคุณครู: "${message}"\nกรุณาตอบในแท็ก <ans> ให้ชบาหน่อยนะคะ`;

    let rawResponse = "";
    if (apiKey) {
      rawResponse = await callGemini(systemPrompt, userPrompt, apiKey);
    }

    if (!rawResponse && openaiApiKey) {
      console.log("[LINE WEBHOOK] Gemini failed or not configured, falling back to OpenAI...");
      rawResponse = await callOpenAI(systemPrompt, userPrompt, openaiApiKey);
    }
    
    // 3. Absolute Extraction Protocol
    let finalAnswer = "";
    if (!rawResponse) {
      finalAnswer = "ขออภัยนะคะคุณครู ตอนนี้ระบบสมองของชบามีการเชื่อมต่อขัดข้องชั่วคราวค่ะ รบกวนลองใหม่อีกครั้งในภายหลังนะคะ 🙏🌸";
    } else {
      console.log(`[LINE WEBHOOK] Raw response length: ${rawResponse.length}`);
      const matchComplete = rawResponse.match(/<ans>([\s\S]*?)<\/ans>/);
      if (matchComplete && matchComplete[1]) {
        finalAnswer = matchComplete[1].trim();
      } else {
        const startIdx = rawResponse.indexOf('<ans>');
        if (startIdx !== -1) {
          let content = rawResponse.substring(startIdx + 5).trim();
          content = content.replace(/<\/?a(n(s)?)?$/i, '').trim();
          finalAnswer = content;
        } else {
          finalAnswer = rawResponse;
        }
      }
    }

    // 4. Final Polish & Cleanup
    if (rawResponse) {
      finalAnswer = finalAnswer
        .replace(/AI Cowork/gi, 'น้องชบา')
        .replace(/ครับ/g, 'ค่ะ')
        .replace(/^\s*\*\s+/gm, '• ') // แปลงดอกจันเดี่ยวของ bullet point เป็นจุดกลม
        .split('\n')
        .filter(line => !line.match(/^\s*(\*|-)?\s*(Identity|Role|User|Context|Input|Logic|Drafting|Winner|Step|Goal|Strict|Formatting|Section|Check|Evaluation|Actionable|Final|Plan|Result).*?:/i))
        .join('\n')
        .trim();
    }

    console.log(`[LINE WEBHOOK] Sending response (length ${finalAnswer.length}): ${JSON.stringify(finalAnswer)}`);
    if (finalAnswer) await replyToLine(replyToken, finalAnswer);

  } catch (err) { console.error("[LINE WEBHOOK ERROR]", err); }
}

async function callGemini(system: string, user: string, apiKey: string): Promise<string> {
  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-flash-latest"];
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048
          }
        })
      });
      if (res.ok) {
        const data = await res.json() as any;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          console.log(`[LINE WEBHOOK] Gemini model ${model} success!`);
          return text;
        }
      } else {
        const errData = await res.json() as any;
        console.error(`[LINE WEBHOOK] Error with model ${model}:`, JSON.stringify(errData));
      }
    } catch (e) {
      console.error(`[LINE WEBHOOK] Fetch error with model ${model}:`, e);
    }
  }
  return "";
}

async function callOpenAI(system: string, user: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.1,
        max_tokens: 2048
      })
    });
    if (res.ok) {
      const data = await res.json() as any;
      const text = data.choices?.[0]?.message?.content;
      if (text) {
        console.log(`[LINE WEBHOOK] OpenAI gpt-4o-mini success!`);
        return text;
      }
    } else {
      const errData = await res.json() as any;
      console.error("[LINE WEBHOOK] Error with OpenAI:", JSON.stringify(errData));
    }
  } catch (e) {
    console.error("[LINE WEBHOOK] Fetch error with OpenAI:", e);
  }
  return "";
}

async function replyToLine(replyToken: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !text) return;
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text: text.substring(0, 5000) }] })
  });
}

function extractClassLevel(text: string): string | null {
  const cleaned = text.replace(/\s+/g, '');
  
  // ค้นหารูปแบบ ป.1 - ป.6
  const pMatch = cleaned.match(/(ป|ประถม|ประถมศึกษา|ประถมศึกษาปีที่)\.?([1-6])/);
  if (pMatch) {
    return `ป.${pMatch[2]}`;
  }

  // ค้นหารูปแบบ อ.2 - อ.3
  const aMatch = cleaned.match(/(อ|อนุบาล|อนุบาลปีที่)\.?([2-3])/);
  if (aMatch) {
    return `อ.${aMatch[2]}`;
  }

  return null;
}

function extractDocSearchWord(message: string): string {
  if (!message) return '';
  const msg = message.toLowerCase();
  const reangIdx = msg.indexOf('เรื่อง');
  const numIdx = msg.indexOf('เลขที่');
  let keyword = '';
  if (reangIdx !== -1) {
    keyword = msg.substring(reangIdx + 6).trim();
  } else if (numIdx !== -1) {
    keyword = msg.substring(numIdx + 6).trim();
  } else {
    keyword = msg;
    const commonWords = [
      'ขอไฟล์แนบ', 'ขอเอกสารแนบ', 'ขอลิงก์', 'ขอลิงค์', 'ขอไฟล์', 'ดาวน์โหลด', 'ขอดู',
      'หนังสือรับที่', 'หนังสือส่งที่', 'คำสั่งที่', 'บันทึกที่', 'จดหมายที่', 'ฉบับที่', 'เรื่องที่',
      'หนังสือรับ', 'หนังสือส่ง', 'หนังสือเข้า', 'หนังสือออก', 'บันทึกข้อความ', 
      'เอกสารรับ', 'เอกสารส่ง', 'ไฟล์แนบ', 'เอกสารแนบ', 'ไฟล์รับ', 'ไฟล์ส่ง', 
      'ไฟล์คำสั่ง', 'ไฟล์บันทึก', 'คำสั่ง', 'ใบสั่ง', 'บันทึก', 'เมโม่', 'memo', 'โหลด',
      'เลขที่', 'เลข', 
      'ของ', 'ที่', 'ฉบับ', 'เรื่อง', 'ขอ', 'มี', 'ส่ง'
    ];
    commonWords.forEach(w => { keyword = keyword.replace(new RegExp(w, 'g'), ''); });
  }
  const suffixes = [
    'หน่อย', 'ครับ', 'ค่ะ', 'นะ', 'นะคะ', 'ด้วย', 'ที', 'หน่อยครับ', 'หน่อยค่ะ', 
    'หน่อยนะ', 'หน่อยนะคะ', 'ด้วยครับ', 'ด้วยค่ะ', 'ซิ', 'สิ', 'จ๊ะ', 'จ้า'
  ];
  suffixes.forEach(s => {
    keyword = keyword.replace(new RegExp(s + '$', 'g'), '');
    keyword = keyword.replace(new RegExp('\\s+' + s, 'g'), '');
  });
  return keyword.trim();
}

async function smartFetchContext(message: string, currentYear: string, supabase: any): Promise<string> {
  const msg = message.toLowerCase();
  const targetClass = extractClassLevel(message);
  
  const rules = [
    {
      keys: ['ครู', 'คุณครู', 'บุคลากร', 'ผู้สอน', 'เวร', 'เวรยาม', 'เวรประจำวัน', 'อีเมล', 'อีเมล์', 'เมล', 'เบอร์โทร', 'เบอร์โทรศัพท์', 'เบอร์ติดต่อ'],
      fetch: async () => {
        const { data: teachers } = await supabase.from('teachers').select('id, prefix, first_name, last_name, position, department, phone, email, status');
        const { data: duties } = await supabase.from('teacher_duties').select('duty_day, duty_type, teacher_id, teachers(prefix, first_name, last_name)');
        return `รายชื่อครูและบุคลากร: ${JSON.stringify(teachers)}\nตารางเวรประจำวันครู (เชื่อมโยงรายชื่อครูแล้ว): ${JSON.stringify(duties)}`;
      }
    },
    {
      keys: ['โครงการ', 'งบประมาณ', 'งบ', 'เงินงบ', 'สถิติ', 'สรุป', 'ผลสัมฤทธิ์', 'จัดซื้อจัดจ้าง', 'พัสดุ', 'ซื้อจ้าง'],
      fetch: async () => {
        const { data: projects } = await supabase.from('school_projects').select('project_name, planned_amount, spent_amount, status, budget_allocations(budget_type, category_name)').eq('academic_year', currentYear);
        const { data: budget } = await supabase.from('budget_allocations').select('id, budget_type, category_name, amount, spent_amount, remaining_amount').eq('academic_year', currentYear);
        const { data: procurement } = await supabase.from('procurement_projects').select('project_name, total_amount, status, procurement_type').eq('academic_year', currentYear);
        
        // คำนวณสรุปตัวเลขสถิติเพื่อให้ AI ทำข้อมูลผลสัมฤทธิ์
        const totalAllocated = budget?.reduce((sum: number, b: any) => sum + (b.amount || 0), 0) || 0;
        const totalSpent = budget?.reduce((sum: number, b: any) => sum + (b.spent_amount || 0), 0) || 0;
        const totalRemaining = budget?.reduce((sum: number, b: any) => sum + (b.remaining_amount || 0), 0) || 0;
        
        const procCount = procurement?.length || 0;
        const procFinished = procurement?.filter((p: any) => p.status === 'approved' || p.status === 'completed')?.length || 0;
        const procSpent = procurement?.reduce((sum: number, p: any) => sum + (Number(p.total_amount) || 0), 0) || 0;

        return `สถิติสรุปงบประมาณและพัสดุ ปีการศึกษา ${currentYear}:
- ยอดงบประมาณรวมที่ได้รับการจัดสรร: ${totalAllocated.toLocaleString()} บาท
- งบประมาณที่ใช้ไปแล้วสะสม: ${totalSpent.toLocaleString()} บาท
- งบประมาณคงเหลือสุทธิ: ${totalRemaining.toLocaleString()} บาท
- จำนวนโครงการจัดซื้อจัดจ้างทั้งหมด: ${procCount} รายการ
- โครงการจัดซื้อจัดจ้างที่อนุมัติ/สำเร็จแล้ว: ${procFinished} รายการ
- ยอดจัดซื้อจัดจ้างรวม: ${procSpent.toLocaleString()} บาท

ข้อมูลโครงการทั้งหมด: ${JSON.stringify(projects)}
ข้อมูลแหล่งงบประมาณ: ${JSON.stringify(budget)}
ข้อมูลการจัดซื้อจัดจ้างในระบบ: ${JSON.stringify(procurement)}`;
      }
    },
    {
      keys: ['หนังสือรับ', 'จดหมาย', 'เอกสารรับ', 'หนังสือเข้า', 'ไฟล์แนบ', 'เอกสารแนบ', 'แนบ', 'ไฟล์รับ'],
      fetch: async () => {
        const searchWord = extractDocSearchWord(message);
        let query = supabase.from('incoming_docs').select('doc_number, subject, from_agency, doc_date, urgency, remark, file_url, attachment_urls');
        if (searchWord.length > 0) {
          query = query.or(`subject.ilike.%${searchWord}%,doc_number.ilike.%${searchWord}%`);
        }
        const { data } = await query.order('doc_date', { ascending: false }).limit(5);
        return `ข้อมูลหนังสือรับที่เกี่ยวข้องหรือล่าสุด: ${JSON.stringify(data)}`;
      }
    },
    {
      keys: ['หนังสือส่ง', 'เอกสารส่ง', 'หนังสือออก', 'ไฟล์ส่ง'],
      fetch: async () => {
        const searchWord = extractDocSearchWord(message);
        let query = supabase.from('outgoing_docs').select('doc_number, subject, to_agency, doc_date, urgency, remark, file_url');
        if (searchWord.length > 0) {
          query = query.or(`subject.ilike.%${searchWord}%,doc_number.ilike.%${searchWord}%`);
        }
        const { data } = await query.order('doc_date', { ascending: false }).limit(5);
        return `ข้อมูลหนังสือส่งที่เกี่ยวข้องหรือล่าสุด: ${JSON.stringify(data)}`;
      }
    },
    {
      keys: ['คำสั่ง', 'ใบสั่ง', 'ไฟล์คำสั่ง'],
      fetch: async () => {
        const searchWord = extractDocSearchWord(message);
        let query = supabase.from('orders').select('order_number, subject, issuer, order_date, remark, file_url');
        if (searchWord.length > 0) {
          query = query.or(`subject.ilike.%${searchWord}%,order_number.ilike.%${searchWord}%`);
        }
        const { data } = await query.order('order_date', { ascending: false }).limit(5);
        return `ข้อมูลคำสั่งที่เกี่ยวข้องหรือล่าสุด: ${JSON.stringify(data)}`;
      }
    },
    {
      keys: ['บันทึก', 'เมโม่', 'memo', 'บันทึกข้อความ', 'ไฟล์บันทึก'],
      fetch: async () => {
        const searchWord = extractDocSearchWord(message);
        let query = supabase.from('memos').select('memo_number, subject, requester, memo_date, urgency, remark, file_url');
        if (searchWord.length > 0) {
          query = query.or(`subject.ilike.%${searchWord}%,memo_number.ilike.%${searchWord}%`);
        }
        const { data } = await query.order('memo_date', { ascending: false }).limit(5);
        return `ข้อมูลบันทึกข้อความที่เกี่ยวข้องหรือล่าสุด: ${JSON.stringify(data)}`;
      }
    },
    {
      keys: ['ค่าไฟ', 'ไฟฟ้า', 'ค่าน้ำ', 'ประปา', 'โทรศัพท์', 'เน็ต', 'อินเทอร์เน็ต', 'สาธารณูปโภค', 'บิล'],
      fetch: async () => {
        let query = supabase.from('utilities').select('*').eq('academic_year', currentYear);
        const types: string[] = [];
        if (msg.includes('ค่าไฟ') || msg.includes('ไฟฟ้า')) types.push('electricity');
        if (msg.includes('ค่าน้ำ') || msg.includes('ประปา')) types.push('water');
        if (msg.includes('ค่าโทรศัพท์')) types.push('telephone');
        if (msg.includes('เน็ต') || msg.includes('อินเทอร์เน็ต')) types.push('internet');

        if (types.length > 0) {
          query = query.in('type', types);
        }
        const { data } = await query.order('bill_date', { ascending: false }).limit(20);
        return `ข้อมูลค่าสาธารณูปโภค ปีการศึกษา ${currentYear}: ${JSON.stringify(data)}`;
      }
    },
    {
      keys: ['เช็คชื่อ', 'ขาด', 'ลา', 'มาสาย', 'เข้าเรียน', 'เช็คขาด', 'เช็คมาสาย', 'สถิติ'],
      fetch: async () => {
        const { data } = await supabase.from('attendance').select('date, class_level, summary, recorded_at').order('date', { ascending: false }).limit(5);
        return `ข้อมูลการเช็คชื่อเข้าเรียนล่าสุด: ${JSON.stringify(data)}`;
      }
    },
    {
      keys: ['พัสดุ', 'จัดซื้อ', 'จัดจ้าง', 'การจ้าง', 'สัญญา', 'ผู้ขาย', 'ผู้รับจ้าง', 'ตรวจรับ', 'กรรมการ'],
      fetch: async () => {
        const { data: projects } = await supabase.from('procurement_projects').select('project_name, academic_year, method, procurement_type, total_amount, status, ref_doc_number, contract_number, committee_json, vendor_info, school_projects(project_name)').eq('academic_year', currentYear).limit(10);
        return `ข้อมูลโครงการจัดซื้อจัดจ้าง ปี ${currentYear} (เชื่อมโยงโครงการหลักตามแผนแล้ว): ${JSON.stringify(projects)}`;
      }
    },
    {
      keys: ['ห้องสมุด', 'ยืมหนังสือ', 'คืนหนังสือ', 'ยืม-คืน', 'หนังสือห้องสมุด'],
      fetch: async () => {
        const { data: books } = await supabase.from('library_books').select('id, book_id, title, category, author, available_qty, status').limit(15);
        const { data: borrow } = await supabase.from('library_borrow').select('borrow_date, borrower_name, return_date, status, library_books(book_id, title, category)').order('borrow_date', { ascending: false }).limit(10);
        return `ข้อมูลหนังสือในห้องสมุด: ${JSON.stringify(books)}\nประวัติการยืมคืนหนังสือ (เชื่อมโยงรายละเอียดหนังสือแล้ว): ${JSON.stringify(borrow)}`;
      }
    },
    {
      keys: ['มอบหมาย', 'งานมอบหมาย', 'ติดตามงาน', 'สั่งงาน', 'มอบหมายงาน'],
      fetch: async () => {
        const { data } = await supabase.from('doc_assignments').select('instruction, status, reported_at, staff_report, incoming_docs(doc_number, subject), teachers(prefix, first_name, last_name)').limit(15);
        return `ข้อมูลการมอบหมายหนังสือราชการให้คุณครูผู้รับผิดชอบเชิงลึก: ${JSON.stringify(data)}`;
      }
    },
    {
      keys: ['การตั้งค่า', 'โรงเรียน', 'ผู้อำนวยการ', 'เบอร์โทร', 'ที่อยู่โรงเรียน', 'ข้อมูลโรงเรียน'],
      fetch: async () => {
        const { data } = await supabase.from('settings').select('school_name, school_address, director_name, current_academic_year, current_term, phone_number, local_gov_name').single();
        return `ข้อมูลการตั้งค่าโรงเรียนทั่วไป: ${JSON.stringify(data)}`;
      }
    },
    {
      keys: ['นักเรียน', 'กี่คน', 'รายชื่อ', 'รายนาม', 'คนไหนบ้าง', 'เด็กนักเรียน', 'ชั้นเรียน'],
      fetch: async () => {
        // หากผู้ใช้พิมพ์เรื่องครู หรือโครงการ หรือจัดซื้อ หรือห้องสมุด ไม่ควรตกในกฎนี้
        if (msg.includes('ครู') || msg.includes('โครงการ') || msg.includes('จัดซื้อ') || msg.includes('พัสดุ') || msg.includes('ห้องสมุด') || msg.includes('หนังสือ')) {
          return "";
        }
        if (targetClass) {
          const { data } = await supabase
            .from('students')
            .select('prefix, first_name, last_name, class_level, room, gender')
            .eq('class_level', targetClass)
            .eq('academic_year', currentYear)
            .in('graduation_status', ['ปกติ', 'กำลังศึกษา'])
            .order('room', { ascending: true })
            .order('first_name', { ascending: true });
          if (data && data.length > 0) {
            const listText = data.map((s: any, idx: number) => `${idx + 1}. ${s.prefix || ''}${s.first_name} ${s.last_name} ${s.room ? `(ห้อง ${s.room})` : ''}`).join('\n');
            return `รายชื่อนักเรียนชั้น ${targetClass} สำหรับปีการศึกษา ${currentYear} (รวม ${data.length} คน):\n${listText}`;
          }
          return `ไม่พบข้อมูลรายชื่อนักเรียนชั้น ${targetClass} สำหรับปีการศึกษา ${currentYear} ค่ะ`;
        } else {
          const { count } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('academic_year', currentYear).in('graduation_status', ['ปกติ', 'กำลังศึกษา']);
          return `จำนวนนักเรียนปัจจุบันทั้งหมดในปีการศึกษา ${currentYear}: ${count} คน`;
        }
      }
    }
  ];

  for (const rule of rules) {
    if (rule.keys.some(key => msg.includes(key))) {
      try {
        console.log(`[LINE WEBHOOK] Match rule for keys: ${rule.keys[0]}`);
        const result = await rule.fetch();
        if (result) return result; // หากคืนค่าว่าง ให้ผ่านไปตรวจกฎอื่น
      } catch (err) {
        console.error(`[LINE WEBHOOK] Error executing fetch for keys ${rule.keys}:`, err);
      }
    }
  }

  // Fallback: ค้นหาใน school_knowledge
  try {
    const { data: knowledge } = await supabase
      .from('school_knowledge')
      .select('document_name, chunk_text')
      .or(`chunk_text.ilike.%${msg}%,document_name.ilike.%${msg}%`)
      .limit(3);
    
    if (knowledge && knowledge.length > 0) {
      console.log(`[LINE WEBHOOK] Found ${knowledge.length} matches in school_knowledge`);
      return `ข้อมูลความรู้โรงเรียนที่ค้นพบ:\n` + knowledge.map((k: any) => `[ไฟล์: ${k.document_name}]: ${k.chunk_text}`).join('\n\n');
    }
  } catch (err) {
    console.error(`[LINE WEBHOOK] Error fetching school_knowledge:`, err);
  }

  return "";
}

async function handleReceiptOCR(replyToken: string, messageId: string, _profile: any) {
  try {
    await replyToLine(replyToken, "ชบากำลังดึงรูปภาพใบเสร็จของคุณครูและใช้ AI สแกนอ่านรายละเอียดให้อยู่นะคะ สักครู่เดียวค่ะ... 🌸⚡");
    
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN not configured");

    // 1. ดาวน์โหลด Content ของรูปภาพ
    const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`LINE image fetch returned HTTP ${response.status}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    // 2. ดึง API Key
    const { data: sets } = await supabaseAdmin.from('settings').select('gemini_api_key').single();
    const apiKey = sets?.gemini_api_key;
    if (!apiKey) {
      await replyToLine(replyToken, "ระบบยังไม่ได้ตั้งค่า API Key ในโรงเรียนค่ะ รบกวนคุณครูตั้งค่า API Key ในหน้าตั้งค่าก่อนนะคะ 🌸");
      return;
    }

    // 3. เรียก Gemini Multimodal OCR
    const systemPrompt = `คุณคือ "น้องชบา" ผู้ช่วยฝ่ายพัสดุและงบประมาณโรงเรียนบ้านควนโคกยา
ภารกิจ: วิเคราะห์สแกนรูปภาพใบเสร็จ/บิลค่าใช้จ่ายนี้ และสรุปผลออกมาในรูปแบบราชการที่เข้าใจง่าย
กฎเหล็ก:
- ตอบข้อมูลสกัดออกมาให้ชัดเจนดังนี้:
  1. ชื่อร้านค้า / ผู้ขาย
  2. วันที่ในใบเสร็จ
  3. รายการสินค้าพัสดุ (ระบุเป็นหัวข้อย่อย: ชื่อสินค้า, จำนวน, หน่วย, ราคาต่อหน่วย, ราคารวม)
  4. ยอดเงินรวมทั้งสิ้น (บาท)
- ให้คำแนะนำท้ายข้อความว่า "คุณครูสามารถนำข้อมูลที่ชบาสแกนนี้ไปกดเพิ่มรายการจัดซื้อจัดจ้างใหม่ในหน้าระบบพัสดุได้ทันทีเลยนะคะ 🌸"
- ห้ามใช้คำพูดไม่สุภาพ และตอบอย่างนอบน้อมค่ะ/นะคะ เท่านั้น`;

    const userPrompt = "ชบาส่งรูปใบเสร็จให้ค่ะ รบกวนสแกนอ่านให้ชบาหน่อยนะคะ";
    const ocrResult = await callGeminiMultimodal(systemPrompt, userPrompt, base64Image, 'image/jpeg', apiKey);
    
    if (ocrResult) {
      await replyToLine(replyToken, ocrResult);
    } else {
      await replyToLine(replyToken, "ขออภัยนะคะชบาไม่สามารถวิเคราะห์ข้อมูลจากภาพใบเสร็จนี้ได้ค่ะ รบกวนคุณครูช่วยตรวจสอบความคมชัดและส่งเข้ามาใหม่อีกครั้งนะคะ 🙏🌸");
    }
  } catch (err: any) {
    console.error("[LINE OCR ERROR]", err);
    await replyToLine(replyToken, `เกิดข้อผิดพลาดในการสแกนสกัดใบเสร็จค่ะ: ${err.message}`);
  }
}

async function callGeminiMultimodal(system: string, user: string, base64Data: string, mimeType: string, apiKey: string): Promise<string> {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: base64Data } },
              { text: user }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048
          }
        })
      });
      if (res.ok) {
        const data = await res.json() as any;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch (e) {
      console.error(`[LINE MULTIMODAL ERROR] ${model}:`, e);
    }
  }
  return "";
}
