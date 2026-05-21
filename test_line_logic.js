import { createClient } from '@supabase/supabase-js';

// จำลอง Environment สำหรับ Webhook
const process = {
  env: {
    VITE_SUPABASE_URL: 'https://vzrrpxrmtjpgfbbvhjra.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4',
    SUPABASE_SERVICE_ROLE_KEY: '', // ใส่ถ้ามี แต่ในเครื่องนี้ใช้ Anon ก่อน
    LINE_CHANNEL_ACCESS_TOKEN: 'test_token'
  }
};

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// คัดลอก DEFAULT_SCHEMA_MAP มาจาก api/line-webhook.ts
const DEFAULT_SCHEMA_MAP = {
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

async function callGemini(prompt, apiKey) {
  const modelsToTry = ["gemini-1.5-pro", "gemini-2.0-flash", "gemini-flash-latest", "gemini-pro-latest"];
  const versions = ["v1beta", "v1"];

  for (const model of modelsToTry) {
    for (const ver of versions) {
      try {
        const url = `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          console.log(`[Model: ${model}, Ver: ${ver}] SUCCESS Raw Text:`, text);
          return text;
        } else {
          const errData = await response.json().catch(() => ({}));
          console.error(`[Model: ${model}, Ver: ${ver}] FAILED ${response.status} ${response.statusText}:`, JSON.stringify(errData));
        }
      } catch (e) { /* next */ }
    }
  }
  return null;
}

async function planDatabaseQueries(message, schemaMap, apiKey, academicYear = "2569") {
  const schemaBrief = {};
  Object.entries(schemaMap).forEach(([table, def]) => {
    schemaBrief[table] = {
      desc: def.description,
      cols: def.columns
    };
  });

  const prompt = `คุณคือ AI Database Architect หน้าที่ของคุณคือวิเคราะห์คำถามภาษาไทย และเลือกตารางที่เกี่ยวข้อง
  
  โครงสร้างฐานข้อมูล:
  ${JSON.stringify(schemaBrief, null, 2)}
  
  คำถาม: "${message}"
  ปีการศึกษาปัจจุบัน: "${academicYear}"
  
  ตอบเป็น JSON เท่านั้น ห้ามมีคำเกริ่นนำ
  ตัวอย่าง:
  {
    "queries": [
      {
        "table": "students",
        "select": "*",
        "filters": [{ "column": "academic_year", "operator": "eq", "value": "2569" }],
        "limit": 20
      }
    ],
    "need_rag": false
  }`;

  const text = await callGemini(prompt, apiKey);
  if (!text) return { queries: [], need_rag: true };
  return JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
}

async function testQueryPlanning(message, apiKey) {
  console.log(`\n--- ทดสอบการวิเคราะห์คำถาม: "${message}" ---`);
  
  try {
    const result = await planDatabaseQueries(message, DEFAULT_SCHEMA_MAP, apiKey);
    console.log('AI Plan:', JSON.stringify(result, null, 2));

    if (result.queries && result.queries.length > 0) {
        console.log('\n--- จำลองการดึงข้อมูลจาก DB ---');
        for (const q of result.queries) {
            console.log(`ดึงข้อมูลจากตาราง: ${q.table}`);
            if (!q.table) continue;
            let queryBuilder = supabase.from(q.table).select(q.select || '*');
            if (q.filters && Array.isArray(q.filters)) {
                q.filters.forEach(f => {
                    console.log(`- กรอง ${f.column} ${f.operator} ${f.value}`);
                    const op = f.operator;
                    if (op === 'eq') queryBuilder = queryBuilder.eq(f.column, f.value);
                    else if (op === 'ilike') queryBuilder = queryBuilder.ilike(f.column, f.value);
                    else if (op === 'gt') queryBuilder = queryBuilder.gt(f.column, f.value);
                });
            }
            const { data: dbData, error } = await queryBuilder.limit(q.limit || 3);
            if (error) console.error('Error:', error.message);
            else console.log(`พบ ${dbData?.length || 0} รายการ:`, JSON.stringify(dbData, null, 2));
        }
    }
  } catch (err) {
    console.error('Test Error:', err);
  }
}

async function runTest() {
  const { data: sets } = await supabase.from('settings').select('ai_cowork_api_key').single();
  const apiKey = sets?.ai_cowork_api_key;
  
  if (!apiKey) {
    console.error('กรุณาตั้งค่า Gemini API Key ก่อนทดสอบ');
    return;
  }

  // ทดสอบ 2 คำถามที่ต่างกัน
  await testQueryPlanning("ปี 2569 มีนักเรียนทั้งหมดกี่คน", apiKey);
  await testQueryPlanning("โครงการที่มีงบมากกว่า 10000 มีอะไรบ้าง", apiKey);
  await testQueryPlanning("เดือนนี้เราจ่ายค่าไฟไปเท่าไหร่", apiKey);
}

runTest();
