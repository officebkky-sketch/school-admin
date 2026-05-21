import { createClient } from '@supabase/supabase-js';

declare const process: any;

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
// ใช้ Service Role เพื่อข้าม RLS ในการค้นหาข้อมูลส่วนตัวครู (ต้องเพิ่มใน Vercel Env)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return res.status(200).json({ 
      message: 'AI Cowork LINE Webhook is ONLINE with Advanced RAG',
      status: 'ready',
      env_check: {
        has_token: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
        has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        has_url: !!process.env.VITE_SUPABASE_URL
      },
      time: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const events = req.body.events || [];

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        const userMessage = event.message.text.trim();

        // 1. Check if user is already bound (ใช้ Admin เพื่อหาจาก line_user_id ได้ทุกเคส)
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('line_user_id', userId)
          .maybeSingle();

        if (profile) {
          // --- FULL AI BRAIN (Stats + Dual Knowledge Base) ---
          await handleFullAIQuery(event.replyToken, userMessage, profile);
        } else {
          // 2. Not bound yet. Check if the message is an email
          if (userMessage.includes('@')) {
            const incomingEmail = userMessage.toLowerCase().trim();
            const { data: foundUser } = await supabaseAdmin
              .from('profiles')
              .select('*')
              .eq('email', incomingEmail)
              .maybeSingle();

            if (foundUser) {
              await supabaseAdmin.from('profiles').update({ line_user_id: userId }).eq('id', foundUser.id);
              await replyToLine(event.replyToken, `ยืนยันตัวตนสำเร็จ! ยินดีต้อนรับคุณครู ${foundUser.display_name} เข้าสู่ระบบ AI Cowork ครับ\n\nตอนนี้ผมเชื่อมต่อกับ "คลังปัญญาโรงเรียน" และ "Virtual Drive ส่วนตัว" ของคุณครูเรียบร้อยแล้ว ถามข้อมูลได้ทันทีครับ!`);
            } else {
              await replyToLine(event.replyToken, 'ขออภัยครับ ไม่พบอีเมลนี้ในระบบโรงเรียน กรุณาตรวจสอบอีเมลและส่งมาใหม่ครับ');
            }
          } else {
            await replyToLine(event.replyToken, 'สวัสดีครับ ผม AI Cowork ผู้ช่วยอัจฉริยะ\n\nเพื่อความปลอดภัย รบกวนคุณครูพิมพ์ **อีเมล** ที่ใช้ลงทะเบียนในระบบเพื่อยืนยันตัวตนก่อนครับ');
          }
        }
      }
    }
  } catch (err) {
    console.error('Webhook error:', err);
  }

  return res.status(200).json({ message: 'OK' });
}

async function handleFullAIQuery(replyToken: string, message: string, profile: any) {
  try {
    // 1. Fetch Basic Settings & API Key
    const { data: sets } = await supabaseAdmin.from('settings').select('*').maybeSingle();
    const apiKey = sets?.gemini_api_key;
    if (!apiKey) {
      await replyToLine(replyToken, '❌ ระบบยังไม่ได้ตั้งค่า Gemini API Key ในหน้าการตั้งค่าครับ');
      return;
    }

    // 2. Database Context (Stats)
    const currentYear = sets?.current_academic_year || '2569';
    const { data: students } = await supabaseAdmin.from('students').select('class_level, gender, religion, prefix').eq('academic_year', currentYear).eq('graduation_status', 'ปกติ');
    const { count: teacherCount } = await supabaseAdmin.from('teachers').select('*', { count: 'exact', head: true });
    const { data: projects } = await supabaseAdmin.from('school_projects').select('project_name, planned_amount, status').eq('academic_year', currentYear);
    
    const religionStats: any = {};
    const classStats: any = {};
    students?.forEach(s => {
      const rel = s.religion || 'ไม่ระบุ';
      religionStats[rel] = (religionStats[rel] || 0) + 1;
      const lv = s.class_level || 'ไม่ระบุ';
      if (!classStats[lv]) classStats[lv] = { total: 0, male: 0, female: 0 };
      classStats[lv].total++;
      
      const g = s.gender || '';
      const p = s.prefix || '';
      if (g === 'ชาย' || g === 'ช' || g === 'Male' || p.includes('ด.ช.') || p.includes('เด็กชาย')) {
        classStats[lv].male++;
      } else if (g === 'หญิง' || g === 'ญ' || g === 'Female' || p.includes('ด.ญ.') || p.includes('เด็กหญิง')) {
        classStats[lv].female++;
      }
    });

    // 3. Advanced Hybrid Search (Global + Private + Thai Regex)
    let knowledgeContext = "";
    try {
       const embedding = await generateEmbedding(message, apiKey);
       let matches: any[] = [];
       
       if (embedding) {
          // 3.1 Search Global Knowledge (เพิ่มเป็น 10)
          const { data: globalMatches } = await supabaseAdmin.rpc('match_knowledge', {
            query_embedding: embedding,
            match_threshold: 0.1,
            match_count: 10
          });
          if (globalMatches) matches = [...globalMatches];

          // 3.2 Search Private Knowledge (เพิ่มเป็น 10)
          const { data: privateMatches } = await supabaseAdmin.rpc('match_personal_knowledge', {
            query_embedding: embedding,
            match_threshold: 0.1,
            match_count: 10,
            p_teacher_id: profile.id
          });
          if (privateMatches) matches = [...matches, ...privateMatches];
       }

       // 3.3 Thai Keyword Fallback (Regex based - เพิ่มคำย่อ)
       if (matches.length < 10) {
          const yearMatch = message.match(/\d{4}/g) || [];
          const keywords = ["โครงการ", "งบประมาณ", "ระเบียบ", "แผน", "พัสดุ", "เงิน", "นักเรียน", "กิจกรรม", "โครง", "งบ"];
          const foundKeywords = keywords.filter(k => message.includes(k));
          const searchTerms = [...yearMatch, ...foundKeywords];

          if (searchTerms.length > 0) {
            // ค้นหาทั้งจากเนื้อหา (chunk_text) และชื่อเอกสาร (document_name)
            const orQuery = searchTerms.map(t => `chunk_text.ilike.%${t}%,document_name.ilike.%${t}%`).join(',');
            const [{data: t1}, {data: t2}] = await Promise.all([
               supabaseAdmin.from('school_knowledge').select('document_name, chunk_text').or(orQuery).limit(10),
               supabaseAdmin.from('ai_knowledge_base').select('document_name, chunk_text').or(orQuery).eq('teacher_id', profile.id).limit(10)
            ]);
            const textMatches = [...(t1 || []), ...(t2 || [])];
            const allMatches = [...matches, ...textMatches];
            matches = allMatches.filter((v, i, a) => a.findIndex(t => (t.chunk_text === v.chunk_text)) === i);
          }
       }

       if (matches.length > 0) {
         // ส่งให้ AI อ่านสูงสุด 20 ชิ้น
         knowledgeContext = matches.slice(0, 20).map((m: any) => `[แหล่งข้อมูล: ${m.document_name}]\nเนื้อหา: ${m.chunk_text}`).join('\n---\n');
       }
    } catch (err) {
       console.warn('Advanced Search failed:', err);
    }

    const context = `คุณคือ AI Cowork ผู้ช่วยอัจฉริยะของ${sets?.school_name || 'โรงเรียน'} 
    [ส่วนที่ 1: ข้อมูลสถิติและโครงการจากฐานข้อมูลโดยตรง (แม่นยำสูง)]
    - ปีการศึกษา: ${currentYear}
    - จำนวนนักเรียน: ${students?.length || 0} คน
    - สรุปรายชั้น: ${Object.entries(classStats).map(([lv, s]: any) => `ชั้น ${lv} ${s.total} คน (ช ${s.male} ญ ${s.female})`).join('\n    ')}
    - จำนวนครู: ${teacherCount || 0} คน
    ${projectContext}

    [ส่วนที่ 2: ข้อมูลจากคลังปัญญา (เนื้อหาจากระเบียบ/เอกสาร)]
    ${knowledgeContext || "ไม่พบเนื้อหาที่เกี่ยวข้องเพิ่มเติมในคลังปัญญา"}

    ผู้ถาม: คุณครู ${profile.display_name} (สิทธิ์: ${profile.role})
    คำถาม: ${message}

    คำแนะนำในการตอบ (STRICT RULES):
    1. ให้ความสำคัญกับข้อมูลใน [ส่วนที่ 1] เป็นอันดับแรก เพราะเป็นข้อมูลจริงล่าสุดจากฐานข้อมูล
    2. หากข้อมูลในคลังปัญญามีหลายปีการศึกษา ให้ยึดข้อมูลปี ${currentYear} เป็นหลัก
    3. หากคุณครูถามสั้นๆ เช่น "โครงการ" หรือ "โครง" ให้สรุปรายชื่อโครงการและงบประมาณจาก [ส่วนที่ 1] ให้ครบถ้วน
    4. หากข้อมูลใน [ส่วนที่ 1] ไม่เพียงพอ จึงค่อยนำเนื้อหาจาก [ส่วนที่ 2] มาเสริม
    5. ตอบให้เป็นมืออาชีพ มีประเด็น เสนอแนะเชิงรุก และใช้ Emoji ให้เหมาะสม
    6. ตอบให้กระชับเหมาะกับหน้าจอ LINE`;

    const finalAnswer = await callGemini(context, apiKey);
    await replyToLine(replyToken, finalAnswer);

  } catch (err: any) {
    console.error('AI Query Error:', err);
    await replyToLine(replyToken, `⚠️ เกิดข้อผิดพลาด: ${err.message}\nกรุณาลองใหม่อีกครั้งครับ`);
  }
}

async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  const model = "models/gemini-embedding-2";
  const versions = ['v1beta', 'v1'];
  for (const ver of versions) {
    try {
      const url = `https://generativelanguage.googleapis.com/${ver}/${model}:embedContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, content: { parts: [{ text }] } })
      });
      if (response.ok) {
        const data = await response.json();
        return data.embedding?.values || null;
      }
    } catch (e) { /* next */ }
  }
  return null;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  let modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro"];
  try {
     const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
     if (listRes.ok) {
        const listData = await listRes.json();
        const found = listData.models
          ?.filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => m.name.replace('models/', ''));
        if (found && found.length > 0) modelsToTry = found;
     }
  } catch (e) { /* fallback */ }

  const versions = ["v1beta", "v1"];
  for (const model of modelsToTry) {
    if (!model.includes('gemini')) continue;
    for (const ver of versions) {
      try {
        const url = `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (response.ok) {
          const data = await response.json();
          return data.candidates?.[0]?.content?.parts?.[0]?.text || "ขออภัยครับ AI ไม่สามารถสร้างคำตอบได้";
        }
      } catch (e) { /* next */ }
    }
  }
  return "ขออภัยครับ ระบบ AI ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง";
}

async function replyToLine(replyToken: string, message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        replyToken: replyToken,
        messages: [{ type: 'text', text: message }]
      })
    });
  } catch (e) {
    console.error('Fetch Error:', e);
  }
}
