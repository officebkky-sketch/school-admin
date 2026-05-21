import { createClient } from '@supabase/supabase-js';

declare const process: any;
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') return res.status(200).json({ message: 'Nong Chaba is Ready' });
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const events = req.body.events || [];
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        const userMsg = event.message.text.trim();
        const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('line_user_id', userId).maybeSingle();

        if (profile) {
          await handleFullAIQuery(event.replyToken, userMsg, profile);
        } else {
          if (userMsg.includes('@')) {
            const { data: found } = await supabaseAdmin.from('profiles').select('*').eq('email', userMsg.toLowerCase().trim()).maybeSingle();
            if (found) {
              await supabaseAdmin.from('profiles').update({ line_user_id: userId }).eq('id', found.id);
              await replyToLine(event.replyToken, `ยินดีต้อนรับคุณครู ${found.display_name} เข้าสู่ระบบน้องชบาค่ะ ถามงานชบาได้ทันทีเลยนะคะ!`);
            } else {
              await replyToLine(event.replyToken, 'ไม่พบอีเมลนี้ในระบบค่ะ รบกวนตรวจสอบอีกครั้งนะคะ');
            }
          } else {
            await replyToLine(event.replyToken, 'สวัสดีค่ะ ชบาคือ "น้องชบา" ผู้ช่วยอัจฉริยะประจำโรงเรียนค่ะ\n\nรบกวนคุณครูพิมพ์ "อีเมล" เพื่อยืนยันตัวตนก่อนนะคะ');
          }
        }
      }
    }
  } catch (err) { console.error(err); }
  return res.status(200).json({ message: 'OK' });
}

async function handleFullAIQuery(replyToken: string, message: string, _profile: any) {
  try {
    const { data: sets } = await supabaseAdmin.from('settings').select('gemini_api_key, current_academic_year').single();
    const apiKey = sets?.gemini_api_key;
    if (!apiKey) return await replyToLine(replyToken, '❌ ระบบยังไม่ได้ตั้งค่า API Key ค่ะ');

    const currentYear = sets?.current_academic_year || '2569';
    
    // 1. Fast Planning (Simplified)
    const queryPlan = await planDatabaseQueries(message, apiKey, currentYear);
    
    let dbContext = "";
    if (queryPlan?.queries?.length > 0) {
      const q = queryPlan.queries[0]; // Take only the most relevant query for speed
      let qb: any = supabaseAdmin.from(q.table).select(q.select || '*');
      if (q.filters) {
        q.filters.forEach((f: any) => { qb = qb.eq(f.column, f.value); });
      }
      const { data } = await qb.limit(10);
      if (data) dbContext = `ข้อมูลในระบบ: ${JSON.stringify(data)}`;
    }

    // 2. Ultra-Strict Prompting
    const systemPrompt = `คุณคือ "น้องชบา" ผู้ช่วยเพศหญิงของโรงเรียนบ้านควนโคกยา
กฎเหล็ก:
- ห้ามแนะนำตัว ห้ามทวนคำถาม ห้ามพิมพ์ขั้นตอนการคิด
- ห้ามใช้ดอกจัน (*) และห้ามใช้คำว่า "ครับ"
- ให้ตอบเฉพาะ "ข้อความสุดท้าย" ที่จะส่งให้คุณครูเท่านั้น
- หากมีข้อมูลให้สรุปสั้นๆ ใช้ Emoji และเว้นบรรทัดให้สวยงาม`;

    const userPrompt = `ข้อมูล: ${dbContext || 'ไม่พบข้อมูลเฉพาะเจาะจง'}\nคำถาม: "${message}"\nตอบสั้นๆ และนอบน้อมค่ะ`;

    let finalAnswer = await callGemini(systemPrompt, userPrompt, apiKey);
    
    // 3. Aggressive Post-Processing
    finalAnswer = finalAnswer
      .replace(/\*/g, '')
      .replace(/AI Cowork/gi, 'น้องชบา')
      .replace(/ครับ/g, 'ค่ะ')
      // ลบทุกอย่างที่ดูเหมือนเป็นหัวข้อวิเคราะห์
      .split('\n')
      .filter(line => !line.match(/^\s*(Identity|Role|User|Context|Input|Logic|Drafting|Winner|Step|Goal|Strict|Formatting|Section|Check|Evaluation|Actionable).*?:/i))
      .join('\n')
      .trim();

    if (!finalAnswer) finalAnswer = "ชบาหาข้อมูลไม่เจอค่ะคุณครู รบกวนลองถามใหม่อีกครั้งนะคะ";
    
    await replyToLine(replyToken, finalAnswer);

  } catch (err: any) {
    await replyToLine(replyToken, `⚠️ เกิดข้อผิดพลาดค่ะ: ${err.message}`);
  }
}

async function callGemini(system: string, user: string, apiKey: string): Promise<string> {
  // Use flash only for speed
  const model = "gemini-1.5-flash";
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
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

async function planDatabaseQueries(msg: string, key: string, year: string) {
  const prompt = `วิเคราะห์คำถาม: "${msg}" ปี ${year} ตอบเป็น JSON เท่านั้น: { "queries": [{ "table": "students หรือ school_projects", "filters": [] }] }`;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    const data = await res.json() as any;
    return JSON.parse(data.candidates[0].content.parts[0].text);
  } catch (e) { return { queries: [] }; }
}
