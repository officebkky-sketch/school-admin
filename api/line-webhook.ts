import { createClient } from '@supabase/supabase-js';

declare const process: any;

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
// ใช้ Service Role เพื่อข้าม RLS ในการค้นหาข้อมูลส่วนตัวครู (ต้องเพิ่มใน Vercel Env)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return res.status(200).json({ 
      message: 'AI Cowork LINE Webhook is ONLINE with RAG',
      status: 'ready',
      env_check: {
        has_token: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
        has_url: !!process.env.VITE_SUPABASE_URL,
        has_key: !!process.env.VITE_SUPABASE_ANON_KEY
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

        // 1. Check if user is already bound
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('line_user_id', userId)
          .maybeSingle();

        if (profile) {
          // --- FULL AI BRAIN (Stats + Knowledge Base) ---
          await handleFullAIQuery(event.replyToken, userMessage, profile);
        } else {
          // 2. Not bound yet. Check if the message is an email
          if (userMessage.includes('@')) {
            const incomingEmail = userMessage.toLowerCase().trim();
            const { data: foundUser } = await supabase
              .from('profiles')
              .select('*')
              .eq('email', incomingEmail)
              .maybeSingle();

            if (foundUser) {
              await supabase.from('profiles').update({ line_user_id: userId }).eq('id', foundUser.id);
              await replyToLine(event.replyToken, `ยืนยันตัวตนสำเร็จ! ยินดีต้อนรับคุณครู ${foundUser.display_name} เข้าสู่ระบบ AI Cowork ครับ\n\nตอนนี้ผมเชื่อมต่อกับ "คลังปัญญาโรงเรียน" เรียบร้อยแล้ว คุณครูสามารถถามระเบียบหรือข้อมูลนักเรียนได้ทันทีครับ!`);
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
    const { data: sets } = await supabase.from('settings').select('*').maybeSingle();
    const apiKey = sets?.gemini_api_key;
    if (!apiKey) {
      await replyToLine(replyToken, '❌ ระบบยังไม่ได้ตั้งค่า Gemini API Key ในหน้าการตั้งค่าครับ');
      return;
    }

    // 2. Database Context (Stats)
    const currentYear = sets?.current_academic_year || '2569';
    const { data: students } = await supabase.from('students').select('class_level, gender, religion, prefix').eq('academic_year', currentYear).eq('graduation_status', 'ปกติ');
    const { count: teacherCount } = await supabase.from('teachers').select('*', { count: 'exact', head: true });
    
    const religionStats: any = {};
    const classStats: any = {};
    students?.forEach(s => {
      const rel = s.religion || 'ไม่ระบุ';
      religionStats[rel] = (religionStats[rel] || 0) + 1;
      const lv = s.class_level || 'ไม่ระบุ';
      if (!classStats[lv]) classStats[lv] = { total: 0, male: 0, female: 0 };
      classStats[lv].total++;
      
      // ตรวจสอบเพศแบบครอบคลุม (ช, ญ, ชาย, หญิง, ด.ช., ด.ญ.)
      const g = s.gender || '';
      const p = s.prefix || '';
      if (g === 'ชาย' || g === 'ช' || g === 'Male' || p.includes('ด.ช.') || p.includes('เด็กชาย')) {
        classStats[lv].male++;
      } else if (g === 'หญิง' || g === 'ญ' || g === 'Female' || p.includes('ด.ญ.') || p.includes('เด็กหญิง')) {
        classStats[lv].female++;
      }
    });

    // 3. Knowledge Base Context (RAG / Hybrid Search)
    let knowledgeContext = "";
    try {
       // 3.1 Vector Search (Primary)
       const embedding = await generateEmbedding(message, apiKey);
       let matches: any[] = [];
       
       if (embedding) {
          const { data: vectorMatches } = await supabase.rpc('match_knowledge', {
            query_embedding: embedding,
            match_threshold: 0.1,
            match_count: 5
          });
          if (vectorMatches) matches = [...vectorMatches];
       }

       // 3.2 Text Search (Fallback/Supplement)
       if (matches.length < 3) {
          // Extract keywords (simple split for demo, can be improved)
          const keywords = message.split(' ').filter(k => k.length > 2);
          if (keywords.length > 0) {
            const orQuery = keywords.map(k => `chunk_text.ilike.%${k}%`).join(',');
            const { data: textMatches } = await supabase
              .from('school_knowledge')
              .select('document_name, chunk_text')
              .or(orQuery)
              .limit(5);
            
            if (textMatches) {
               // Combine and deduplicate
               const allMatches = [...matches, ...textMatches];
               matches = allMatches.filter((v, i, a) => a.findIndex(t => (t.chunk_text === v.chunk_text)) === i);
            }
          }
       }

       if (matches.length > 0) {
         // Limit to top 10 chunks to avoid exceeding context window
         knowledgeContext = matches.slice(0, 10).map((m: any) => `[แหล่งข้อมูล: ${m.document_name}]\nเนื้อหา: ${m.chunk_text}`).join('\n---\n');
       }
    } catch (err) {
       console.warn('Hybrid Search failed:', err);
    }

    const context = `คุณคือ AI Cowork ผู้ช่วยอัจฉริยะของ${sets?.school_name || 'โรงเรียน'} 
    [ข้อมูลสถิติปัจจุบัน (ปี ${currentYear})]
    - จำนวนนักเรียนทั้งหมด: ${students?.length || 0} คน
    - สรุปศาสนา: ${Object.entries(religionStats).map(([r, c]) => `${r} ${c} คน`).join(', ')}
    - สรุปรายชั้น: ${Object.entries(classStats).map(([lv, s]: any) => `ชั้น ${lv} ${s.total} คน (ช ${s.male} ญ ${s.female})`).join('\n    ')}
    - จำนวนครู: ${teacherCount || 0} คน

    [ข้อมูลจากคลังปัญญาโรงเรียน (เนื้อหาจากระเบียบ/เอกสาร)]
    ${knowledgeContext || "ไม่พบข้อมูลที่เกี่ยวข้องในคลังปัญญา"}

    ผู้ถาม: คุณครู ${profile.display_name} (สิทธิ์: ${profile.role})
    คำถาม: ${message}

    คำแนะนำในการตอบ:
    1. หากข้อมูลในสถิติระบุว่าเป็น 0 คน แต่ใน "คลังปัญญา" มีข้อมูลอื่น ให้แจ้งคุณครูตามตรงและอ้างอิงจากคลังปัญญา
    2. ตอบให้กระชับ เหมาะกับการอ่านใน LINE พร้อมใช้ Emoji
    3. หากหาข้อมูลไม่เจอจริงๆ ให้แนะนำให้คุณครูอัปโหลดเอกสารเพิ่มที่เมนู AI Cowork บนคอมพิวเตอร์`;

    // 4. Call Gemini with Full Context
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
  // ลองหาโมเดลที่ใช้งานได้ (เหมือนเดิม)
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
