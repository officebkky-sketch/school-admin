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
    
    // 1. Quick Data Fetch (Direct check common tables)
    let contextData = "";
    if (message.includes('โครงการ') || message.includes('งบ')) {
      const { data } = await supabaseAdmin.from('school_projects').select('project_name, planned_amount').eq('academic_year', currentYear).order('planned_amount', { ascending: true }).limit(20);
      if (data) contextData = `รายการโครงการ: ${JSON.stringify(data)}`;
    } else if (message.includes('นักเรียน') || message.includes('กี่คน')) {
      const { count } = await supabaseAdmin.from('students').select('*', { count: 'exact', head: true }).eq('academic_year', currentYear).eq('graduation_status', 'ปกติ');
      contextData = `จำนวนนักเรียนปัจจุบัน: ${count} คน`;
    }

    // 2. High-Speed Direct Prompting with Extraction Tag
    const systemPrompt = `คุณคือ "น้องชบา" ผู้ช่วยครูเพศหญิงของโรงเรียนบ้านควนโคกยา
กฎเหล็ก:
- ตอบเฉพาะ "เนื้อหาสุดท้าย" ที่จะส่งให้คุณครู โดยใส่ไว้ในแท็ก <ans>...</ans> เท่านั้น
- ห้ามพิมพ์ขั้นตอนการคิด ห้ามแนะนำตัว ห้ามพิมพ์หัวข้อ Identity/Role/Logic ใดๆ ทั้งสิ้น
- ห้ามใช้ดอกจัน (*) และห้ามพูดคำว่า "ครับ" (ให้ใช้ค่ะ/นะคะ)
- ตอบสั้น กระชับ ใช้ Emoji และเว้นบรรทัดให้สวยงาม`;

    const userPrompt = `ข้อมูลโรงเรียน: ${contextData || 'ไม่มีข้อมูลเสริม'}\nคำถามของคุณครู: "${message}"\nตอบลงในแท็ก <ans> ค่ะ`;

    const rawResponse = await callGemini(systemPrompt, userPrompt, apiKey);
    
    // 3. Absolute Extraction Protocol
    let finalAnswer = "";
    const match = rawResponse.match(/<ans>([\s\S]*?)<\/ans>/);
    if (match && match[1]) {
      finalAnswer = match[1].trim();
    } else {
      // Fallback if tag is missing
      finalAnswer = rawResponse;
    }

    // 4. Final Polish & Cleanup
    finalAnswer = finalAnswer
      .replace(/\*/g, '')
      .replace(/AI Cowork/gi, 'น้องชบา')
      .replace(/ครับ/g, 'ค่ะ')
      .split('\n')
      .filter(line => !line.match(/^\s*(Identity|Role|User|Context|Input|Logic|Drafting|Winner|Step|Goal|Strict|Formatting|Section|Check|Evaluation|Actionable|Final).*?:/i))
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
