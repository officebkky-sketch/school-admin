import { createClient } from '@supabase/supabase-js';

declare const process: any;

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return res.status(200).json({ message: 'Nong Chaba LINE Webhook is ONLINE', status: 'ready' });
  }

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
            const incomingEmail = userMessage.toLowerCase().trim();
            const { data: foundUser } = await supabaseAdmin.from('profiles').select('*').eq('email', incomingEmail).maybeSingle();
            if (foundUser) {
              await supabaseAdmin.from('profiles').update({ line_user_id: userId }).eq('id', foundUser.id);
              await replyToLine(event.replyToken, `ยืนยันตัวตนสำเร็จค่ะ! ยินดีต้อนรับคุณครู ${foundUser.display_name} เข้าสู่ระบบน้องชบานะคะ\n\nตอนนี้ชบาเชื่อมต่อกับคลังข้อมูลโรงเรียนเรียบร้อยแล้ว ถามงานชบาได้ทันทีเลยค่ะ!`);
            } else {
              await replyToLine(event.replyToken, 'ขออภัยค่ะ ไม่พบอีเมลนี้ในระบบโรงเรียนของเรา รบกวนคุณครูตรวจสอบอีเมลอีกครั้งนะคะ');
            }
          } else {
            await replyToLine(event.replyToken, 'สวัสดีค่ะ ชบาคือ "น้องชบา" ผู้ช่วยอัจฉริยะประจำโรงเรียนค่ะ\n\nเพื่อความปลอดภัย รบกวนคุณครูพิมพ์ "อีเมล" ที่ใช้ในระบบเพื่อยืนยันตัวตนก่อนนะคะ');
          }
        }
      }
    }
  } catch (err) { console.error(err); }
  return res.status(200).json({ message: 'OK' });
}

async function handleFullAIQuery(replyToken: string, message: string, profile: any) {
  try {
    const { data: sets } = await supabaseAdmin.from('settings').select('*').maybeSingle();
    const apiKey = sets?.gemini_api_key;
    if (!apiKey) return await replyToLine(replyToken, '❌ ระบบยังไม่ได้ตั้งค่า API Key ค่ะ');

    const currentYear = sets?.current_academic_year || '2569';
    const schemaMap = await getDynamicSchema(supabaseUrl, supabaseServiceKey);
    const queryPlan = await planDatabaseQueries(message, schemaMap, apiKey, currentYear);
    
    let dbContextParts: string[] = [];
    if (queryPlan?.queries?.length > 0) {
      for (const q of queryPlan.queries) {
        if (!schemaMap[q.table]) continue;
        let qb: any = supabaseAdmin.from(q.table).select(q.select || '*');
        if (q.filters) {
          q.filters.forEach((f: any) => {
            if (schemaMap[q.table].columns.includes(f.column)) qb = qb[f.operator](f.column, f.value);
          });
        }
        const { data } = await qb.limit(q.limit || 20);
        if (data?.length > 0) dbContextParts.push(`[ข้อมูล ${q.table}]: ${JSON.stringify(data)}`);
      }
    }

    const dbContext = dbContextParts.length > 0 ? dbContextParts.join('\n') : "ไม่พบข้อมูลในฐานข้อมูล";
    
    // Simple RAG Fallback
    let knowledgeContext = "";
    if (queryPlan.need_rag !== false && !message.includes('รายชื่อ')) {
       const { data: kData } = await supabaseAdmin.from('school_knowledge').select('chunk_text').limit(5);
       knowledgeContext = (kData || []).map(k => k.chunk_text).join('\n');
    }

    // ULTRA STRICT PROMPT
    const systemPrompt = `คุณคือ "น้องชบา" ผู้ช่วยเพศหญิงของโรงเรียนบ้านควนโคกยา
กฎเหล็ก:
- ห้ามใช้ดอกจัน (*) เด็ดขาด
- ห้ามแทนตัวว่า AI Cowork หรือใช้คำว่าครับ
- ตอบสุภาพ นอบน้อม ลงท้ายด้วยค่ะ/นะคะ
- ห้ามพิมพ์หัวข้อเทคนิค ห้ามเกริ่นนำ ให้ตอบเข้าเรื่องทันที`;

    const userPrompt = `ข้อมูลอ้างอิง: ${dbContext} ${knowledgeContext}
คำถามของคุณครู: ${message}
จงสรุปคำตอบที่ถูกต้องที่สุดให้คุณครู โดยห้ามใช้เครื่องหมาย * และห้ามแนะนำตัวนะคะ`;

    const finalAnswer = await callGemini(systemPrompt, userPrompt, apiKey);
    await replyToLine(replyToken, finalAnswer);

  } catch (err: any) {
    await replyToLine(replyToken, `⚠️ เกิดข้อผิดพลาด: ${err.message}`);
  }
}

async function callGemini(system: string, user: string, apiKey: string): Promise<string> {
  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
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
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "ขออภัยค่ะ ชบาสร้างคำตอบไม่ได้";
      }
    } catch (e) { /* next */ }
  }
  return "ขออภัยค่ะ ระบบขัดข้อง";
}

async function replyToLine(replyToken: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] })
  });
}

const DEFAULT_SCHEMA_MAP: Record<string, any> = {
  students: { description: "ข้อมูลนักเรียน", columns: ["id", "first_name", "last_name", "academic_year", "class_level"] },
  school_projects: { description: "โครงการ", columns: ["id", "project_name", "planned_amount", "academic_year"] }
};

async function getDynamicSchema(url: string, key: string) { return DEFAULT_SCHEMA_MAP; }

async function planDatabaseQueries(msg: string, map: any, key: string, year: string) {
  const prompt = `วิเคราะห์คำถาม: "${msg}" ปีการศึกษา: ${year} Schema: ${JSON.stringify(map)}
  ตอบเป็น JSON: { "queries": [{ "table": string, "select": string, "filters": [] }], "need_rag": boolean }`;
  
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
