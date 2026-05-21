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
    const schemaMap = await getDynamicSchema();
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
        const { data } = await qb.limit(20);
        if (data?.length > 0) dbContextParts.push(`[Data ${q.table}]: ${JSON.stringify(data)}`);
      }
    }

    const dbContext = dbContextParts.length > 0 ? dbContextParts.join('\n') : "No direct database matches found.";

    const systemPrompt = `คุณคือ "น้องชบา" ผู้ช่วยเพศหญิงที่น่ารัก นอบน้อม และเฉลียวฉลาดของโรงเรียนบ้านควนโคกยา
กฎเหล็กที่ต้องทำตามอย่างเคร่งครัด:
1. ห้ามใช้เครื่องหมายดอกจัน (*) เด็ดขาด ไม่ว่าจะเน้นคำหรือทำรายการ
2. ห้ามแทนตัวว่า AI Cowork หรือใช้คำว่า "ครับ" ให้แทนตัวว่า "ชบา" หรือ "หนู" และลงท้ายด้วย "ค่ะ/นะคะ"
3. ตอบเข้าประเด็นทันที ห้ามเกริ่นนำ ห้ามแนะนำตัว ห้ามพิมพ์หัวข้อวิเคราะห์ หรือหัวข้อเทคนิคใดๆ ทั้งสิ้น
4. จัดรูปแบบให้สะอาดตา ใช้ Emoji นำหน้าหัวข้อ และเว้นบรรทัดให้โปร่ง
5. หากข้อมูลมาจากฐานข้อมูล ให้สรุปเป็นภาษามนุษย์ที่สละสลวย`;

    const userPrompt = `ข้อมูลอ้างอิง: ${dbContext}
ปีการศึกษา: ${currentYear}
คำถามของคุณครู: "${message}"
จงตอบคำถามนี้โดยยึดกฎเหล็กอย่างเคร่งครัดค่ะ`;

    let finalAnswer = await callGemini(systemPrompt, userPrompt, apiKey);
    
    // --- POST-PROCESSING FILTERS (Double Protection) ---
    finalAnswer = finalAnswer
      .replace(/\*/g, '') // ลบดอกจันทุกตัว
      .replace(/AI Cowork/gi, 'น้องชบา') // เปลี่ยนชื่อถ้าหลุดมา
      .replace(/ครับ/g, 'ค่ะ') // เปลี่ยนครับเป็นค่ะ
      .replace(/^(Identity|Role|User|Question|Data Source|Section|Formatting Rules|Goal|Answer|Analysis|Greeting|Main Answer|Details|Closing|Check|Is it optimized).*?:/gim, '') // ลบหัวข้อเทคนิคที่ AI ชอบเผลอพิมพ์
      .trim();

    await replyToLine(replyToken, finalAnswer);

  } catch (err: any) {
    await replyToLine(replyToken, `⚠️ ขออภัยค่ะ เกิดข้อผิดพลาด: ${err.message}`);
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
  students: { description: "ข้อมูลนักเรียน", columns: ["id", "first_name", "last_name", "academic_year", "class_level"] },
  school_projects: { description: "โครงการ", columns: ["id", "project_name", "planned_amount", "academic_year"] }
};

async function getDynamicSchema() { return DEFAULT_SCHEMA_MAP; }

async function planDatabaseQueries(msg: string, _map: any, key: string, year: string) {
  const prompt = `วิเคราะห์คำถาม: "${msg}" ปี ${year} ตอบ JSON: { "queries": [{ "table": string, "select": string, "filters": [] }], "need_rag": boolean }`;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
    });
    const data = await res.json() as any;
    return JSON.parse(data.candidates[0].content.parts[0].text);
  } catch (e) { return { queries: [], need_rag: true }; }
}
