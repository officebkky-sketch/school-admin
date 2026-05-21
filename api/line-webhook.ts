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

    // 2. Database Context (Dynamic Database AI Solver)
    const currentYear = sets?.current_academic_year || '2569';
    
    // ดึง Schema แบบไดนามิก
    const schemaMap = await getDynamicSchema(supabaseUrl, supabaseServiceKey);
    
    // แนะนำคิวรีด้วย AI (AI Step 1)
    const queryPlan = await planDatabaseQueries(message, schemaMap, apiKey, currentYear);
    
    let dbContextParts: string[] = [];
    
    // ดึงสถิตินักเรียนและครูพื้นฐานไว้เสมอสำหรับกรณี Fallback
    let studentsCount = 0;
    let teachersCount = 0;
    try {
      const { count: sCount } = await supabaseAdmin.from('students').select('*', { count: 'exact', head: true }).eq('academic_year', currentYear).eq('graduation_status', 'ปกติ');
      const { count: tCount } = await supabaseAdmin.from('teachers').select('*', { count: 'exact', head: true });
      studentsCount = sCount || 0;
      teachersCount = tCount || 0;
    } catch (e) {
      console.warn("Fetch fallback stats failed:", e);
    }
    
    if (queryPlan && Array.isArray(queryPlan.queries) && queryPlan.queries.length > 0) {
      for (const queryConfig of queryPlan.queries) {
        const targetTable = queryConfig.table;
        
        // 1. Whitelist Verification
        if (!schemaMap[targetTable]) {
          console.warn(`⚠️ Skipping unsafe table query: ${targetTable} (not in schema whitelist)`);
          continue;
        }
        
        let queryBuilder = supabaseAdmin.from(targetTable).select(queryConfig.select || '*');
        
        // 2. Filters Whitelisting & Execution
        if (queryConfig.filters && Array.isArray(queryConfig.filters)) {
          for (const f of queryConfig.filters) {
            if (!schemaMap[targetTable].columns.includes(f.column)) {
              console.warn(`⚠️ Skip filter on unsafe/non-existent column: ${f.column}`);
              continue;
            }
            
            const op = f.operator;
            const col = f.column;
            const val = f.value;
            
            if (op === 'eq') queryBuilder = queryBuilder.eq(col, val);
            else if (op === 'neq') queryBuilder = queryBuilder.neq(col, val);
            else if (op === 'gt') queryBuilder = queryBuilder.gt(col, val);
            else if (op === 'lt') queryBuilder = queryBuilder.lt(col, val);
            else if (op === 'gte') queryBuilder = queryBuilder.gte(col, val);
            else if (op === 'lte') queryBuilder = queryBuilder.lte(col, val);
            else if (op === 'like') queryBuilder = queryBuilder.like(col, val);
            else if (op === 'ilike') queryBuilder = queryBuilder.ilike(col, val);
          }
        }
        
        // 3. Order Whitelisting
        if (queryConfig.order && queryConfig.order.column) {
          if (schemaMap[targetTable].columns.includes(queryConfig.order.column)) {
            queryBuilder = queryBuilder.order(queryConfig.order.column, { ascending: !!queryConfig.order.ascending });
          }
        }
        
        // 4. Limit Constraint
        const limitVal = queryConfig.limit ? Math.min(queryConfig.limit, 30) : 20;
        queryBuilder = queryBuilder.limit(limitVal);
        
        // 5. Query execution
        try {
          const { data, error } = await queryBuilder;
          if (error) {
            console.error(`Supabase Client Error querying ${targetTable}:`, error.message);
          } else if (data && data.length > 0) {
            const tableDesc = schemaMap[targetTable].description || targetTable;
            // สรุปข้อมูลในรูป JSON เพื่อส่งให้ AI วิเคราะห์
            const formattedData = JSON.stringify(data, null, 2);
            dbContextParts.push(`[ตารางข้อมูล: ${targetTable} (${tableDesc})]\n${formattedData}`);
          }
        } catch (queryErr: any) {
          console.error(`Failed to execute dynamic query for ${targetTable}:`, queryErr.message);
        }
      }
    }
    
    // ประกอบข้อมูลทั้งหมดเป็น Context
    const dbContext = dbContextParts.length > 0 
      ? dbContextParts.join('\n\n')
      : `[ข้อมูลทั่วไปของโรงเรียนปี ${currentYear}] (หมายเหตุ: คำถามไม่ได้ระบุคีย์เวิร์ดดึงตารางข้อมูลเฉพาะเจาะจง หรือไม่พบข้อมูลตามคำค้น)\n- ปีการศึกษาปัจจุบัน: ${currentYear}\n- จำนวนนักเรียนทั้งหมด: ${studentsCount} คน\n- จำนวนบุคลากรครูทั้งหมด: ${teachersCount} คน`;

    // 3. Advanced Hybrid Search (Global + Private + Thai Regex) - เรียกใช้เฉพาะเมื่อ need_rag ไม่ใช่ false
    let knowledgeContext = "";
    if (queryPlan && queryPlan.need_rag !== false) {
      try {
         const embedding = await generateEmbedding(message, apiKey);
         let matches: any[] = [];
         
         if (embedding) {
            // 3.1 Search Global Knowledge
            const { data: globalMatches } = await supabaseAdmin.rpc('match_knowledge', {
              query_embedding: embedding,
              match_threshold: 0.1,
              match_count: 10
            });
            if (globalMatches) matches = [...globalMatches];
         }
  
         // 3.2 Thai Keyword Fallback (Regex based)
         if (matches.length < 10) {
            const yearMatch = message.match(/\d{4}/g) || [];
            const keywords = ["โครงการ", "งบประมาณ", "ระเบียบ", "แผน", "พัสดุ", "เงิน", "นักเรียน", "กิจกรรม", "โครง", "งบ"];
            const foundKeywords = keywords.filter(k => message.includes(k));
            const searchTerms = [...yearMatch, ...foundKeywords];
  
            if (searchTerms.length > 0) {
              // ค้นหาตาราง school_knowledge (ใช้ chunk_text และ document_name)
              const globalOrQuery = searchTerms.map(t => `chunk_text.ilike.%${t}%,document_name.ilike.%${t}%`).join(',');
              
              // ค้นหาตาราง ai_knowledge_base (ใช้ content_text และ file_name ให้ตรงกับ DB)
              const privateOrQuery = searchTerms.map(t => `content_text.ilike.%${t}%,file_name.ilike.%${t}%`).join(',');
  
              const [{data: t1}, {data: t2}] = await Promise.all([
                 supabaseAdmin.from('school_knowledge')
                   .select('document_name, chunk_text')
                   .or(globalOrQuery)
                   .limit(10),
                 supabaseAdmin.from('ai_knowledge_base')
                   .select('file_name, content_text')
                   .or(privateOrQuery)
                   .eq('teacher_id', profile.id)
                   .limit(5)
              ]);
  
              // แปลงข้อมูลเอกสารส่วนตัวให้อยู่ในโครงสร้างมาตรฐาน
              const formattedPrivateMatches = (t2 || []).map((m: any) => ({
                document_name: m.file_name,
                chunk_text: m.content_text ? m.content_text.substring(0, 1500) : ""
              }));
  
              const textMatches = [...(t1 || []), ...formattedPrivateMatches];
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
    }

    const context = `คุณคือ AI Cowork ผู้ช่วยอัจฉริยะของ${sets?.school_name || 'โรงเรียน'}
    [ส่วนที่ 1: ข้อมูลจริงจากระบบฐานข้อมูล (สืบค้นแบบไดนามิกแม่นยำสูง)]
    ${dbContext}

    [ส่วนที่ 2: ข้อมูล RAG จากคลังปัญญาโรงเรียน (เนื้อหาข้อความจากเอกสาร PDF/Virtual Drive)]
    ${knowledgeContext || "ไม่พบเนื้อหาที่เกี่ยวข้องเพิ่มเติมในคลังปัญญา"}

    ผู้ถาม: คุณครู ${profile.display_name} (สิทธิ์: ${profile.role})
    คำถาม: ${message}

    คำแนะนำในการตอบและจัดรูปแบบคำตอบ (STRICT RULES FOR PREMIUM LINE UI):
    1. ให้ความสำคัญกับข้อมูลจริงใน [ส่วนที่ 1] เป็นอันดับแรก และวิเคราะห์ข้อมูลดิบที่ได้จากตารางเพื่อสรุปอย่างเป็นระบบ
    2. จัดรูปแบบคำตอบให้สวยงาม อ่านง่าย และเป็นระเบียบเรียบร้อยบนหน้าจอ LINE:
       - ใช้ Emoji นำหน้าหัวข้อที่เหมาะสมเพื่อความสวยงามและเป็นมิตร (เช่น 📝, 📊, 💡, ⚠️, ✅, 💧, ⚡)
       - จัดย่อหน้าและเว้นบรรทัด (Spacing/Line Break) ให้ดูโปร่งตา ไม่ติดกันเป็นพรืด
       - ใช้ตัวหนา (**ข้อความ**) ในการเน้นประเด็นสำคัญ หัวข้อ หรือยอดเงิน เพื่อดึงดูดสายตา
       - นำเสนอข้อมูลเป็นข้อๆ (Bullet points) หรือใช้การสรุปสั้นๆ ที่เข้าใจง่าย
       - ห้ามใช้ตารางแบบ Markdown (ที่ใช้ | และ -) เนื่องจากแสดงผลได้ไม่ดีบนอุปกรณ์เคลื่อนที่ ให้เปลี่ยนรูปแบบตารางเป็นหัวข้อย่อยและข้อมูลในแต่ละบรรทัดแทน
    3. ตอบคำถามอย่างเป็นมืออาชีพ กระชับ แต่มีรายละเอียดที่ใช้งานได้จริง (Actionable Suggestions)
    4. หากข้อมูลใน [ส่วนที่ 1] ไม่เพียงพอ หรือคำถามเกี่ยวกับระเบียบ/ข้อบังคับ จึงค่อยใช้เนื้อหาจาก [ส่วนที่ 2] มาสรุปเพิ่มเติม
    5. ตอบในฐานะผู้ช่วยครูที่เป็นมิตร สุภาพ มีหางเสียง (ครับ/ค่ะ) และสร้างพลังบวกในการทำงาน`;

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
