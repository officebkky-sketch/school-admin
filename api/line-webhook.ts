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
        
        let queryBuilder: any = supabaseAdmin.from(targetTable).select(queryConfig.select || '*');
        
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

    // 3. Advanced Hybrid Search (Global + Private + Thai Regex)
    let knowledgeContext = "";
    // Optimization: ถ้าได้ข้อมูลจาก DB เยอะพอแล้ว (เช่น รายชื่อนักเรียน) ให้ข้าม RAG เพื่อความเร็ว
    const skipRAG = dbContextParts.length > 0 && (message.includes('รายชื่อ') || message.includes('กี่คน'));

    if (queryPlan && queryPlan.need_rag !== false && !skipRAG) {
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

    const context = `คุณคือ "น้องชบา" ผู้ช่วยอัจฉริยะเพศหญิงของโรงเรียนบ้านควนโคกยา
    
    ข้อมูลสำหรับตอบ:
    ${dbContext}
    ${knowledgeContext}

    คำถามจากคุณครู ${profile.display_name}: "${message}"

    กฎเหล็กในการตอบ (STRICT RULES):
    1. ให้ตอบเฉพาะ "ข้อความที่จะส่งให้คุณครู" เท่านั้น ห้ามพิมพ์หัวข้อทางเทคนิค เช่น Role:, Input Data:, Constraints: หรือวิเคราะห์การทำงานออกมาเด็ดขาด
    2. แทนตัวเองว่า "ชบา" หรือ "หนู" และลงท้ายว่า "ค่ะ" ทุกบรรทัดที่เหมาะสม
    3. ห้ามใช้ดอกจัน (**) เน้นคำ ให้ใช้การเว้นบรรทัดและ Emoji (📝, 📊, 📋, 💡, ✅) แทน
    4. ตอบเข้าประเด็นทันทีด้วยความนอบน้อมและเฉลียวฉลาด เหมือนลูกศิษย์ที่ตั้งใจช่วยงานคุณครู

    ตัวอย่างคำตอบที่ถูกต้อง:
    📝 ข้อมูลโครงการปี 2569 ที่คุณครูถามหามาแล้วค่ะ
    
    - โครงการพัฒนาบุคลากร (15,000 บาท)
    - โครงการ Eco School (20,000 บาท)
    
    💡 ชบาพร้อมช่วยหาข้อมูลส่วนอื่นต่อให้ทันทีนะคะ แจ้งได้เลยค่ะ`;

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
  let modelsToTry = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-pro", "gemini-flash-latest"];
  try {
     const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
     if (listRes.ok) {
        const listData = await listRes.json() as any;
        const found = listData.models
          ?.filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => m.name.replace('models/', ''));
        if (found && found.length > 0) modelsToTry = found;
     }
  } catch (e) { /* fallback */ }

  const versions = ["v1beta", "v1"];
  for (const model of modelsToTry) {
    for (const ver of versions) {
      try {
        const url = `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (response.ok) {
          const data = await response.json() as any;
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

const DEFAULT_SCHEMA_MAP: Record<string, { description: string; columns: string[] }> = {
  profiles: {
    description: "ข้อมูลโปรไฟล์/คุณครูในระบบโรงเรียน",
    columns: ["id", "display_name", "email", "role", "status", "created_at"]
  },
  students: {
    description: "ข้อมูลประวัตินักเรียน ชั้นเรียน ห้องเรียน และรายละเอียดผู้ปกครอง",
    columns: ["id", "academic_year", "class_level", "room", "student_id", "gender", "prefix", "first_name", "last_name", "graduation_status", "religion"]
  },
  incoming_docs: {
    description: "ทะเบียนหนังสือราชการรับ (จดหมายจากภายนอกเข้าโรงเรียน)",
    columns: ["id", "doc_number", "from_agency", "to_agency", "subject", "doc_date", "urgency", "status"]
  },
  outgoing_docs: {
    description: "ทะเบียนหนังสือราชการส่ง (เอกสารที่โรงเรียนส่งออกภายนอก)",
    columns: ["id", "doc_number", "to_agency", "subject", "doc_date", "status"]
  },
  orders: {
    description: "คำสั่งโรงเรียน (แต่งตั้งคณะกรรมการ หรือการปฏิบัติงานต่าง ๆ)",
    columns: ["id", "order_number", "subject", "order_date", "status"]
  },
  memos: {
    description: "บันทึกข้อความสื่อสารภายในหน่วยงาน",
    columns: ["id", "memo_number", "subject", "requester", "department", "memo_date", "status"]
  },
  attendance: {
    description: "สถิติเช็คชื่อการเข้าเรียน ขาด ลา มาสาย ของแต่ละชั้นเรียนในแต่ละวัน",
    columns: ["id", "date", "class_level", "summary", "recorded_at"]
  },
  teachers: {
    description: "ประวัติรายชื่อครูและบุคลากร ตำแหน่ง สังกัดฝ่าย เบอร์โทรศัพท์",
    columns: ["id", "prefix", "first_name", "last_name", "position", "department", "phone", "email", "status"]
  },
  teacher_duties: {
    description: "ตารางเวรปฏิบัติหน้าที่ประจำวันของคุณครู (เช่น ครูเวรวันจันทร์, ครูเวรประจำวัน)",
    columns: ["id", "teacher_id", "duty_day", "duty_type"]
  },
  doc_assignments: {
    description: "การมอบหมายหนังสือรับ ให้ครูไปปฏิบัติหน้าที่และรายงานผลการทำงาน",
    columns: ["id", "doc_id", "assignee_id", "instruction", "status", "reported_at"]
  },
  utilities: {
    description: "บิลสรุปค่าสาธารณูปโภค เช่น ค่าน้ำประปา ค่าไฟฟ้า ค่าโทรศัพท์ ค่าอินเทอร์เน็ต",
    columns: ["id", "type", "academic_year", "month", "amount", "invoice_number", "status"]
  },
  school_projects: {
    description: "โครงการและงบประมาณปีการศึกษาปัจจุบันของโรงเรียน",
    columns: ["id", "project_name", "academic_year", "planned_amount", "current_amount", "spent_amount", "status"]
  },
  budget_allocations: {
    description: "แหล่งจัดสรรงบประมาณแบ่งตามประเภทเงิน (เช่น งบอุดหนุน, งบอาหารกลางวัน)",
    columns: ["id", "academic_year", "budget_type", "category_name", "amount", "spent_amount", "remaining_amount"]
  },
  procurement_projects: {
    description: "โครงการการจัดซื้อจัดจ้างพัสดุหรือจ้างเหมางานพัสดุ",
    columns: ["id", "project_id", "project_name", "academic_year", "method", "procurement_type", "total_amount", "status", "ref_doc_number"]
  },
  procurement_items: {
    description: "รายการวัสดุและอุปกรณ์ที่จัดซื้อภายใต้โครงการจัดซื้อจัดจ้างต่าง ๆ",
    columns: ["id", "procurement_id", "item_name", "quantity", "unit", "price_per_unit", "total_price"]
  }
};

async function getDynamicSchema(supabaseUrl: string, serviceKey: string): Promise<Record<string, { description: string; columns: string[] }>> {
  try {
    const url = `${supabaseUrl}/rest/v1/`;
    const response = await fetch(url, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });
    if (!response.ok) {
      console.log(`Failed to fetch schema dynamically (Status ${response.status}), using default static schema.`);
      return DEFAULT_SCHEMA_MAP;
    }
    const schema = await response.json() as any;
    const dynamicMap = { ...DEFAULT_SCHEMA_MAP };
    
    if (schema && schema.definitions) {
      Object.entries(schema.definitions).forEach(([tableName, tableDef]: [string, any]) => {
        const columns = Object.keys(tableDef.properties || {});
        if (dynamicMap[tableName]) {
          dynamicMap[tableName].columns = Array.from(new Set([...dynamicMap[tableName].columns, ...columns]));
        } else {
          dynamicMap[tableName] = {
            description: tableDef.description || `ตารางข้อมูลระบบ ${tableName}`,
            columns: columns
          };
        }
      });
      console.log("Successfully fetched and merged dynamic OpenAPI schema!");
    }
    return dynamicMap;
  } catch (err: any) {
    console.log("Error fetching dynamic schema, falling back to static:", err.message);
    return DEFAULT_SCHEMA_MAP;
  }
}

async function planDatabaseQueries(message: string, schemaMap: Record<string, any>, apiKey: string, academicYear = "2569"): Promise<{ queries: any[]; need_rag: boolean }> {
  if (!apiKey) {
    console.error("Gemini API key is required!");
    return { queries: [], need_rag: true };
  }

  const schemaBrief: Record<string, { desc: string; cols: string[] }> = {};
  Object.entries(schemaMap).forEach(([table, def]) => {
    schemaBrief[table] = {
      desc: def.description,
      cols: def.columns
    };
  });

  const prompt = `คุณคือ AI Database Architect หน้าที่ของคุณคือการวิเคราะห์คำถามภาษาไทยของผู้ใช้เกี่ยวกับระบบโรงเรียน และเลือกตารางข้อมูลในฐานข้อมูลที่เกี่ยวข้องมาสืบค้นข้อมูล
  
  นี่คือโครงสร้างฐานข้อมูลที่มีอยู่ในระบบ (Database Schema Map):
  ${JSON.stringify(schemaBrief, null, 2)}
  
  คำถามของผู้ใช้: "${message}"
  ปีการศึกษาปัจจุบันของโรงเรียน: "${academicYear}"
  
  ให้วิเคราะห์ว่าคำถามนี้ต้องการข้อมูลจริงจากตารางใดบ้างเพื่อนำมาสังเคราะห์เป็นคำตอบ โดยเขียนคำแนะนำการคิวรีข้อมูลผ่าน Supabase Client
  
  กฎข้อบังคับในการตัดสินใจ (STRICT RULES):
  1. เลือกเฉพาะตารางที่ตรงประเด็นและจำเป็นเท่านั้น (สูงสุดไม่เกิน 3 ตาราง)
  2. เขียนเงื่อนไข filters ในรูปแบบอาร์เรย์:
     - operator ที่รองรับ: "eq" (เท่ากับ), "neq" (ไม่เท่ากับ), "gt" (มากกว่า), "lt" (น้อยกว่า), "gte", "lte", "like", "ilike"
     - ถ้าคำถามระบุเกี่ยวกับปีการศึกษา เช่น "ปีนี้" หรือไม่ได้ระบุปีเฉพาะเจาะจง ให้กรองคอลัมน์ academic_year ด้วยปีการศึกษาปัจจุบัน "${academicYear}" เสมอ (หากตารางนั้นมีคอลัมน์ academic_year)
     - สำหรับตาราง utilities: หากถามเรื่องน้ำประปา/ค่าน้ำ ให้กรอง type = 'water', ไฟฟ้า/ค่าไฟ type = 'electricity', อินเทอร์เน็ต/ค่าเน็ต type = 'internet'
  3. คอลัมน์ที่เลือก (select) ให้ใช้ * หรือระบุเฉพาะคอลัมน์ที่นำมาตอบคำถามจริง ๆ (ระบุคอลัมน์ที่มีอยู่จริงใน Schema เท่านั้น)
  4. จำกัดจำนวนรายการ (limit) ไม่เกิน 20-30 รายการต่อตารางเพื่อความรวดเร็ว
  5. หากต้องการนำเข้าข้อมูล RAG เพิ่มเติมจากคลังเอกสารโรงเรียน (PDF / Virtual Drive) ให้ตั้งค่า "need_rag": true
  
  ให้ตอบกลับในรูปแบบ JSON วัตถุเท่านั้น ห้ามมีเนื้อหาเกริ่นนำหรือปิดท้ายนอกเหนือจากรูปแบบ JSON ที่กำหนดเด็ดขาด!
  
  รูปแบบผลลัพธ์ที่ต้องการ (JSON Output Format):
  {
    "queries": [
      {
        "table": "ชื่อตาราง เช่น utilities",
        "select": "คอลัมน์ที่ต้องการ หรือ *",
        "filters": [
          { "column": "ชื่อคอลัมน์", "operator": "eq หรือ ilike หรือ gt ฯลฯ", "value": "ค่าที่กรอง" }
        ],
        "order": { "column": "คอลัมน์จัดเรียง", "ascending": false },
        "limit": 10
      }
    ],
    "need_rag": true หรือ false
  }`;

  let modelsToTry = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-pro", "gemini-flash-latest"];
  try {
     const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
     if (listRes.ok) {
        const listData = await listRes.json() as any;
        const found = listData.models
          ?.filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => m.name.replace('models/', ''));
        if (found && found.length > 0) modelsToTry = found;
     }
  } catch (e) { /* fallback */ }

  const versions = ["v1beta", "v1"];
  for (const model of modelsToTry) {
    for (const ver of versions) {
      try {
        const url = `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        });
        
        if (response.ok) {
          const data = await response.json() as any;
          let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
          
          // ทำความสะอาด JSON string เผื่อ AI แนบ markdown tag
          text = text.replace(/```json/g, "").replace(/```/g, "").trim();
          
          console.log("--- AI Raw Query Plan ---");
          console.log(text);
          
          return JSON.parse(text);
        }
      } catch (err: any) {
        console.error(`Error with model ${model} on ${ver}:`, err.message);
      }
    }
  }
  return { queries: [], need_rag: true };
}
