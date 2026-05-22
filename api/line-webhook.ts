import { createClient } from '@supabase/supabase-js';

declare const process: any;
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!);

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') return res.status(200).json({ message: 'Nong Chaba Online' });
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

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
              await replyToLine(event.replyToken, `ยืนยันตัวตนสำเร็จค่ะคุณครู ${found.display_name}! น้องชบาพร้อมรับใช้แล้วค่ะ ถามงานได้ทันทีเลยนะคะ`);
            } else {
              await replyToLine(event.replyToken, 'ไม่พบอีเมลในระบบค่ะ รบกวนเช็คอีกครั้งนะคะ');
            }
          } else {
            await replyToLine(event.replyToken, 'สวัสดีค่ะ ชบาคือ "น้องชบา" ค่ะ รบกวนคุณครูพิมพ์ "อีเมล" เพื่อเริ่มใช้งานนะคะ');
          }
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
    if (!apiKey) return;

    const currentYear = sets?.current_academic_year || '2569';
    
    // 1. Smart Data Fetch (Check common school tables)
    let contextData = "";
    const msg = message.toLowerCase();
    
    if (msg.includes('โครงการ') || msg.includes('งบ')) {
      const { data } = await supabaseAdmin.from('school_projects').select('project_name, planned_amount, spent_amount, status').eq('academic_year', currentYear).limit(10);
      if (data) contextData = `รายการโครงการ: ${JSON.stringify(data)}`;
    } else if (msg.includes('นักเรียน') || msg.includes('กี่คน')) {
      const { count } = await supabaseAdmin.from('students').select('*', { count: 'exact', head: true }).eq('academic_year', currentYear).in('graduation_status', ['ปกติ', 'กำลังศึกษา']);
      contextData = `จำนวนนักเรียนปัจจุบัน: ${count} คน`;
    } else if (msg.includes('หนังสือรับ') || msg.includes('จดหมาย')) {
      const { data } = await supabaseAdmin.from('incoming_docs').select('doc_number, subject, from_agency, doc_date').order('doc_date', { ascending: false }).limit(5);
      if (data) contextData = `หนังสือรับล่าสุด: ${JSON.stringify(data)}`;
    } else if (msg.includes('หนังสือส่ง')) {
      const { data } = await supabaseAdmin.from('outgoing_docs').select('doc_number, subject, to_agency, doc_date').order('doc_date', { ascending: false }).limit(5);
      if (data) contextData = `หนังสือส่งล่าสุด: ${JSON.stringify(data)}`;
    } else if (msg.includes('บันทึก') || msg.includes('เมโม่')) {
      const { data } = await supabaseAdmin.from('memos').select('memo_number, subject, requester, memo_date').order('memo_date', { ascending: false }).limit(5);
      if (data) contextData = `บันทึกข้อความล่าสุด: ${JSON.stringify(data)}`;
    }

    // 2. High-Speed Direct Prompting with Extraction Tag
    const systemPrompt = `คุณคือ "น้องชบา" ผู้ช่วยครูเพศหญิงของโรงเรียนบ้านควนโคกยา (ห้ามใช้คำว่า AI Cowork หรือ AI เด็ดขาด)
ลักษณะนิสัย: สุภาพ อ่อนน้อม ใช้ "ค่ะ/นะคะ" แทนตัวว่า "ชบา" หรือ "หนู"
กฎเหล็ก:
- ตอบเฉพาะ "คำตอบสุดท้ายที่จะส่งให้ครู" โดยใส่ไว้ในแท็ก <ans>...</ans> เท่านั้น
- ห้ามพิมพ์ขั้นตอนการคิด (Thinking), ห้ามทวนคำถาม, ห้ามเกริ่นนำใดๆ นอกแท็ก <ans>
- ห้ามใช้ดอกจัน (*) ในคำตอบเด็ดขาด
- ใช้ Emoji ให้ดูเป็นมิตรและเว้นบรรทัดให้อ่านง่ายบนมือถือ`;

    const userPrompt = `ข้อมูลฐานข้อมูลโรงเรียน: ${contextData || 'ไม่พบข้อมูลที่เกี่ยวข้องในฐานข้อมูลด่วน'}\nปีการศึกษา: ${currentYear}\nคำถามของคุณครู: "${message}"\nกรุณาตอบในแท็ก <ans> ให้ชบาหน่อยนะคะ`;

    const rawResponse = await callGemini(systemPrompt, userPrompt, apiKey);
    
    // 3. Absolute Extraction Protocol
    let finalAnswer = "";
    const match = rawResponse.match(/<ans>([\s\S]*?)<\/ans>/);
    if (match && match[1]) {
      finalAnswer = match[1].trim();
    } else {
      // Fallback if tag is missing but try to clean it
      finalAnswer = rawResponse;
    }

    // 4. Final Polish & Cleanup
    finalAnswer = finalAnswer
      .replace(/\*/g, '')
      .replace(/AI Cowork/gi, 'น้องชบา')
      .replace(/ครับ/g, 'ค่ะ')
      .split('\n')
      .filter(line => !line.match(/^\s*(\*|-)?\s*(Identity|Role|User|Context|Input|Logic|Drafting|Winner|Step|Goal|Strict|Formatting|Section|Check|Evaluation|Actionable|Final|Plan|Result).*?:/i))
      .join('\n')
      .trim();

    if (finalAnswer) await replyToLine(replyToken, finalAnswer);

  } catch (err) { console.error(err); }
}

async function callGemini(system: string, user: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }]
      })
    });
    const data = await res.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (e) { return ""; }
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
