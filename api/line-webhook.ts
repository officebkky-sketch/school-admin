import { createClient } from '@supabase/supabase-js';

declare const process: any;
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') return res.status(200).json({ message: 'Nong Chaba LINE Webhook is ONLINE' });
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const events = req.body.events || [];
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        const userMessage = event.message.text.trim();
        const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('line_user_id', userId).maybeSingle();

        if (profile) {
          await handleFullAIQuery(event.replyToken, userMessage, profile);
        } else {
          if (userMessage.includes('@')) {
            const { data: foundUser } = await supabaseAdmin.from('profiles').select('*').eq('email', userMessage.toLowerCase().trim()).maybeSingle();
            if (foundUser) {
              await supabaseAdmin.from('profiles').update({ line_user_id: userId }).eq('id', foundUser.id);
              await replyToLine(event.replyToken, `ยืนยันตัวตนสำเร็จค่ะ! ยินดีต้อนรับคุณครู ${foundUser.display_name} เข้าสู่ระบบน้องชบานะคะ ถามงานชบาได้เลยค่ะ!`);
            } else {
              await replyToLine(event.replyToken, 'ขออภัยค่ะ ไม่พบอีเมลนี้ในระบบโรงเรียน รบกวนตรวจสอบอีกครั้งนะคะ');
            }
          } else {
            await replyToLine(event.replyToken, 'สวัสดีค่ะ ชบาคือ "น้องชบา" ผู้ช่วยส่วนตัวของคุณครูค่ะ\n\nรบกวนคุณครูพิมพ์ "อีเมล" เพื่อยืนยันตัวตนก่อนนะคะ');
          }
        }
      }
    }
  } catch (err) { console.error(err); }
  return res.status(200).json({ message: 'OK' });
}

async function handleFullAIQuery(replyToken: string, message: string, _profile: any) {
  try {
    const { data: sets } = await supabaseAdmin.from('settings').select('*').maybeSingle();
    const apiKey = sets?.gemini_api_key;
    if (!apiKey) return await replyToLine(replyToken, '❌ ยังไม่ได้ตั้งค่า API Key ค่ะ');

    const currentYear = sets?.current_academic_year || '2569';
    const queryPlan = await planDatabaseQueries(message, DEFAULT_SCHEMA_MAP, apiKey, currentYear);
    
    let dbContextParts: string[] = [];
    if (queryPlan?.queries?.length > 0) {
      for (const q of queryPlan.queries) {
        if (!DEFAULT_SCHEMA_MAP[q.table]) continue;
        let qb: any = supabaseAdmin.from(q.table).select(q.select || '*');
        if (q.filters) {
          q.filters.forEach((f: any) => {
            if (DEFAULT_SCHEMA_MAP[q.table].columns.includes(f.column)) {
              if (f.operator === 'eq') qb = qb.eq(f.column, f.value);
              else if (f.operator === 'ilike') qb = qb.ilike(f.column, f.value);
              else if (f.operator === 'gt') qb = qb.gt(f.column, f.value);
              else if (f.operator === 'lt') qb = qb.lt(f.column, f.value);
            }
          });
        }
        const { data } = await qb.limit(20);
        if (data?.length > 0) dbContextParts.push(`[ตาราง ${q.table}]: ${JSON.stringify(data)}`);
      }
    }

    const dbContext = dbContextParts.length > 0 ? dbContextParts.join('\n') : "ไม่มีข้อมูลในฐานข้อมูล";

    const systemPrompt = `คุณคือ "น้องชบา" ผู้ช่วยเพศหญิงของโรงเรียนบ้านควนโคกยา (ห้ามใช้ดอกจัน * และห้ามเกริ่นนำ)
กฎ: ตอบสุภาพ แทนตัวว่า ชบา/หนู ลงท้ายด้วย ค่ะ/นะคะ และเข้าเรื่องทันที ห้ามพิมพ์หัวข้อวิเคราะห์เด็ดขาด`;

    const userPrompt = `ข้อมูล: ${dbContext}\nคำถาม: "${message}"`;

    let finalAnswer = await callGemini(systemPrompt, userPrompt, apiKey);
    
    // --- POST-PROCESSING FILTERS (Aggressive Cleanup) ---
    finalAnswer = finalAnswer
      .replace(/\*/g, '') // ลบดอกจันทั้งหมด
      .replace(/AI Cowork/gi, 'น้องชบา') 
      .replace(/ครับ/g, 'ค่ะ')
      // ลบหัวข้อเทคนิคและขั้นตอนการคิด (รองรับช่องว่างข้างหน้า)
      .replace(/^\s*(Identity|Role|User|Question|Data|Section|Formatting|Goal|Answer|Analysis|Greeting|Main|Details|Closing|Check|Winner|Logic|Constraints|Drafting|Step|Priority|Refining|Winner).*?:/gim, '')
      .trim();

    await replyToLine(replyToken, finalAnswer);

  } catch (err: any) {
    await replyToLine(replyToken, `⚠️ เกิดข้อผิดพลาดค่ะ: ${err.message}`);
  }
}

async function callGemini(system: string, user: string, apiKey: string): Promise<string> {
  const models = ["gemini-1.5-flash", "gemini-2.0-flash"];
  for (const m of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }]
        })
      });
      if (res.ok) {
        const data = await res.json() as any;
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
    } catch (e) { /* next */ }
  }
  return "ขออภัยค่ะ ระบบขัดข้อง";
}

async function replyToLine(replyToken: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !text) return;
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] })
  });
}

const DEFAULT_SCHEMA_MAP: Record<string, any> = {
  profiles: { description: "คุณครู", columns: ["id", "display_name", "email", "role"] },
  students: { description: "นักเรียน", columns: ["id", "academic_year", "class_level", "room", "first_name", "last_name", "prefix"] },
  school_projects: { description: "โครงการ", columns: ["id", "project_name", "academic_year", "planned_amount", "spent_amount", "status"] },
  utilities: { description: "ค่าน้ำค่าไฟ", columns: ["id", "type", "academic_year", "month", "amount"] },
  attendance: { description: "การมาเรียน", columns: ["id", "date", "class_level", "summary"] }
};

async function planDatabaseQueries(msg: string, map: any, key: string, year: string) {
  const schemaBrief = JSON.stringify(map);
  const prompt = `วิเคราะห์คำถาม: "${msg}" ในปีการศึกษา ${year} โดยใช้ Schema: ${schemaBrief}
  ตอบเป็น JSON เท่านั้น: { "queries": [{ "table": "...", "select": "*", "filters": [{ "column": "...", "operator": "eq", "value": "..." }] }], "need_rag": false }`;
  
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
  } catch (e) { return { queries: [], need_rag: true }; }
}
