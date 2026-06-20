import { supabase } from '../lib/supabase';
import { 
  callGeminiAPI, 
  truncateContext, 
  searchKnowledge, 
  searchPrivateKnowledge 
} from '../lib/aiService';

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

export interface PersonalDoc {
  file_name: string;
  content_text: string;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractClassLevel(text: string): string | null {
  const cleaned = text.replace(/\s+/g, '');
  
  // ค้นหารูปแบบ ป.1 - ป.6
  const pMatch = cleaned.match(/(ป|ประถม|ประถมศึกษา|ประถมศึกษาปีที่)\.?([1-6])/);
  if (pMatch) {
    return `ป.${pMatch[2]}`;
  }

  // ค้นหารูปแบบ อ.2 - อ.3
  const aMatch = cleaned.match(/(อ|อนุบาล|อนุบาลปีที่)\.?([2-3])/);
  if (aMatch) {
    return `อ.${aMatch[2]}`;
  }

  return null;
}

export function searchPersonalDocs(query: string, docs: PersonalDoc[]) {
  if (!docs || docs.length === 0) return [];
  
  const queryLower = query.toLowerCase();
  
  // 1. ดึงคำหลักทั่วไปจากการ split
  const baseKeywords = queryLower.split(/[\s,，.、?？!！]+/g).filter(w => w.length > 1);
  const keywordsSet = new Set<string>(baseKeywords);
  
  // 2. ดึงปีการศึกษา พ.ศ./ค.ศ.
  const yearMatches = queryLower.match(/\d{4}/g);
  if (yearMatches) {
    yearMatches.forEach(y => keywordsSet.add(y));
  }
  
  // 3. ดึงคำศัพท์ทั่วไปที่ใช้ในโรงเรียน (Thai Keyword Fallback)
  const schoolKeywords = [
    "ค่าน้ำ", "ค่าไฟ", "ค่าโทรศัพท์", "ค่าอินเทอร์เน็ต", "สาธารณูปโภค",
    "โครงการ", "งบประมาณ", "ระเบียบ", "พัสดุ", "จัดซื้อจัดจ้าง", "อาหารกลางวัน",
    "นักเรียน", "ครู", "บุคลากร", "ใบงาน", "แบบฝึกหัด", "ข้อสอบ",
    "บันทึกข้อความ", "คำสั่ง", "สถิติ", "การเช็คชื่อ", "เวรยาม", "เวรประจำวัน",
    "กิจกรรม", "ประเมินผล", "หลักสูตร", "วิจัย", "นวัตกรรม"
  ];
  
  schoolKeywords.forEach(kw => {
    if (queryLower.includes(kw)) {
      keywordsSet.add(kw);
    }
  });

  const keywords = Array.from(keywordsSet);
  if (keywords.length === 0) return [];

  const results: { file_name: string; snippet: string; score: number }[] = [];

  for (const doc of docs) {
    let score = 0;
    const fileNameLower = doc.file_name.toLowerCase();
    const contentLower = doc.content_text ? doc.content_text.toLowerCase() : "";
    
    // ตรวจสอบกับ Keywords
    for (const keyword of keywords) {
      if (fileNameLower.includes(keyword)) {
        score += 20; 
      }
      
      if (contentLower) {
        try {
          const regex = new RegExp(escapeRegExp(keyword), 'g');
          const matches = contentLower.match(regex);
          if (matches) {
            score += matches.length;
          }
        } catch (e) {
          let pos = 0;
          while ((pos = contentLower.indexOf(keyword, pos)) !== -1) {
            score++;
            pos += keyword.length;
          }
        }
      }
    }

    if (fileNameLower.includes(queryLower) || queryLower.includes(fileNameLower.split('.')[0])) {
      score += 50;
    }

    if (score > 0) {
      let bestIndex = 0;
      if (doc.content_text) {
        for (const keyword of keywords) {
          const idx = contentLower.indexOf(keyword);
          if (idx !== -1) {
            bestIndex = idx;
            break;
          }
        }
        
        const snippetStart = Math.max(0, bestIndex - 100);
        const snippetEnd = Math.min(doc.content_text.length, bestIndex + 300);
        const snippet = doc.content_text.substring(snippetStart, snippetEnd).trim();
        
        results.push({
          file_name: doc.file_name,
          snippet: `... ${snippet} ...`,
          score: score
        });
      } else {
        results.push({
          file_name: doc.file_name,
          snippet: "(ไฟล์นี้ไม่มีเนื้อหาข้อความหรือไม่ได้เป็น PDF)",
          score: score
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 3);
}

export const DEFAULT_SCHEMA_MAP: Record<string, { description: string; columns: string[] }> = {
  profiles: {
    description: "ข้อมูลโปรไฟล์/คุณครูในระบบโรงเรียน",
    columns: ["id", "display_name", "email", "role", "status", "created_at"]
  },
  teachers: {
    description: "รายชื่อครูและบุคลากรทางการศึกษาทั้งหมดในโรงเรียน",
    columns: ["id", "prefix", "first_name", "last_name", "position", "department", "phone", "email", "status"]
  },
  teacher_duties: {
    description: "ตารางเวรประจำวันครู (ครูเวรดูแลความปลอดภัย/เวรยามประจำวัน)",
    columns: ["id", "duty_day", "duty_type", "teacher_id", "created_at"]
  },
  students: {
    description: "ทะเบียนประวัตินักเรียนและรายชื่อนักเรียนแยกตามระดับชั้นและห้องเรียน",
    columns: ["id", "student_id", "prefix", "first_name", "last_name", "gender", "class_level", "room", "academic_year", "graduation_status", "religion"]
  },
  attendance: {
    description: "ข้อมูลสถิติการเช็คชื่อเข้าเรียนและการขาด ลา มาสาย ของนักเรียนประจำวัน",
    columns: ["id", "date", "class_level", "room", "summary", "recorded_by"]
  },
  school_projects: {
    description: "แผนงานและโครงการพัฒนาโรงเรียน วงเงินงบประมาณที่วางแผนและใช้ไป",
    columns: ["id", "project_name", "academic_year", "planned_amount", "spent_amount", "status"]
  },
  budget_allocations: {
    description: "แหล่งที่มาของงบประมาณและเงินอุดหนุนจัดสรรของโรงเรียนตามปีการศึกษา",
    columns: ["id", "budget_type", "category_name", "amount", "spent_amount", "remaining_amount", "academic_year"]
  },
  procurement_projects: {
    description: "โครงการและรายการสัญญาการจัดซื้อจัดจ้างพัสดุและวัสดุของสถานศึกษา",
    columns: ["id", "project_name", "academic_year", "method", "procurement_type", "total_amount", "status", "ref_doc_number", "contract_number", "committee_json", "vendor_info"]
  },
  incoming_docs: {
    description: "ทะเบียนหนังสือราชการรับ (หนังสือเข้า) ที่เข้ามายังสถานศึกษา พร้อมลิงก์ไฟล์แนบ",
    columns: ["id", "doc_number", "subject", "from_agency", "doc_date", "urgency", "remark", "file_url", "attachment_urls"]
  },
  outgoing_docs: {
    description: "ทะเบียนหนังสือราชการส่ง (หนังสือออก) ที่ส่งไปยังภายนอกสถานศึกษา",
    columns: ["id", "doc_number", "subject", "to_agency", "doc_date", "urgency", "remark", "file_url"]
  },
  orders: {
    description: "ทะเบียนคำสั่งของโรงเรียนหรือประกาศที่เป็นข้อสั่งการ",
    columns: ["id", "order_number", "subject", "issuer", "order_date", "remark", "file_url"]
  },
  memos: {
    description: "บันทึกข้อความภายในของโรงเรียนเพื่อเสนออนุมัติหรือชี้แจง",
    columns: ["id", "memo_number", "subject", "requester", "memo_date", "urgency", "remark", "file_url"]
  },
  utilities: {
    description: "ข้อมูลบิลและการชำระค่าสาธารณูปโภค เช่น ค่าไฟฟ้า ค่าน้ำประปา ค่าโทรศัพท์ ค่าอินเทอร์เน็ต ของสถานศึกษา",
    columns: ["id", "type", "academic_year", "month", "amount", "invoice_number", "status", "bill_date"]
  },
  library_books: {
    description: "ข้อมูลและรายการหนังสือในห้องสมุดของโรงเรียน",
    columns: ["id", "book_id", "title", "category", "author", "available_qty", "status"]
  },
  library_borrow: {
    description: "ประวัติการยืม-คืนหนังสือห้องสมุดของนักเรียนหรือคุณครู",
    columns: ["id", "book_id", "borrower_name", "borrow_date", "return_date", "status"]
  },
  doc_assignments: {
    description: "ข้อมูลการมอบหมายภารกิจหรือหนังสือราชการให้ครูและบุคลากรรับผิดชอบ",
    columns: ["id", "doc_id", "teacher_id", "instruction", "status", "reported_at", "staff_report"]
  },
  procurement_items: {
    description: "รายการวัสดุและอุปกรณ์ที่จัดซื้อภายใต้โครงการจัดซื้อจัดจ้างต่าง ๆ",
    columns: ["id", "procurement_id", "item_name", "quantity", "unit", "price_per_unit", "total_price"]
  },
  lesson_plans: {
    description: "ข้อมูลและสถานะการส่งแผนการสอนหรือแผนการจัดการเรียนรู้ของครูในโรงเรียน",
    columns: ["id", "teacher_id", "title", "subject_code", "subject_name", "class_level", "term", "file_url", "status", "academic_comments", "director_comments"]
  },
  lesson_plan_logs: {
    description: "ประวัติการส่งและอนุมัติแก้ไขแผนการสอนย้อนหลัง",
    columns: ["id", "lesson_plan_id", "actor_id", "action", "comments", "created_at"]
  }
};

export async function planDatabaseQueries(
  message: string, 
  apiKey: string, 
  academicYear = "2569"
): Promise<{ queries: any[]; need_rag: boolean }> {
  if (!apiKey) return { queries: [], need_rag: true };

  const schemaBrief: Record<string, { desc: string; cols: string[] }> = {};
  Object.entries(DEFAULT_SCHEMA_MAP).forEach(([table, def]) => {
    schemaBrief[table] = {
      desc: def.description,
      cols: def.columns
    };
  });

  const systemInstruction = `คุณคือ AI Database Architect ผู้เชี่ยวชาญการวิเคราะห์ความหมายภาษาไทยเพื่อการสืบค้นข้อมูลโรงเรียน
  
  โครงสร้างฐานข้อมูล (Schema): ${JSON.stringify(schemaBrief)}
  ปีการศึกษาปัจจุบัน: ${academicYear}
  
  หน้าที่: วิเคราะห์ว่าคำถามของผู้ใช้ต้องการข้อมูลจากตารางใด โดยตอบเป็นรูปแบบ JSON Object
  
  กฎเหล็ก:
  1. หากถามถึง "โครงการ" "งบประมาณ" หรือ "แผนงาน" ต้องเลือกตาราง school_projects เป็นอันดับแรก
  2. หากถามถึง "พัสดุ" "จัดซื้อ" หรือ "รายการของ" ต้องเลือกตาราง procurement_projects หรือ procurement_items
  3. หากถามถึง "นักเรียน" "คน" หรือ "รายชื่อ" ต้องเลือกตาราง students
  4. หากถามถึง "สถิติ" "มาเรียน" หรือ "ขาดลา" ต้องเลือกตาราง attendance
  5. หากถามถึง "แผนการสอน" หรือ "ส่งแผน" หรือ "ตรวจแผน" ต้องเลือกตาราง lesson_plans
  6. หากตารางมีคอลัมน์ academic_year ให้ใส่ฟิลเตอร์กรองปี "${academicYear}" เสมอ เว้นแต่ผู้ใช้จะระบุปีอื่น
  7. รูปแบบ JSON: { "queries": [{ "table": "...", "select": "*", "filters": [{"column": "...", "operator": "eq", "value": "..."}] }], "need_rag": boolean }`;

  const prompt = `คำถามของผู้ใช้: "${message}"`;

  try {
    const res = await callGeminiAPI(prompt, apiKey, {
      systemInstruction,
      temperature: 0.1,
      responseMimeType: "application/json"
    });
    
    let text = res.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(text);
    if (!result.queries) result.queries = [];
    return result;
  } catch (err: any) {
    console.error(`Planning failed:`, err.message);
    return { queries: [], need_rag: true };
  }
}

export interface AICoworkResponse {
  answer: string;
  queryPlanUsed: any;
  dbContextLoaded: string;
  knowledgeContextLoaded: string;
  privateContextLoaded: string;
}

export async function getAICoworkResponse(params: {
  userMsg: string;
  messages: ChatMessage[];
  apiKey: string;
  currentYear: string;
  searchSource: 'all' | 'database' | 'global' | 'private';
  userId: string;
}): Promise<AICoworkResponse> {
  const { userMsg, messages, apiKey, currentYear, searchSource, userId } = params;

  let schoolName = "โรงเรียน";
  try {
    const { data: settingsData } = await supabase
      .from('settings')
      .select('school_name')
      .maybeSingle();
    if (settingsData && settingsData.school_name) {
      schoolName = settingsData.school_name;
    }
  } catch (err) {
    console.error("Error loading school name for AI:", err);
  }

  let searchQuery = userMsg;

  // 1. Query Condensation: หากมีประวัติการสนทนา ให้สร้าง Standalone Query
  const historyForCondensation = messages.filter(m => 
    m.text !== 'สวัสดีค่ะ ชบาคือ "น้องชบา" ผู้ช่วยอัจฉริยะของคุณครู มีอะไรให้หนูช่วยสรุปหรือค้นหาข้อมูลในคลังเอกสารไหมคะ?' && 
    m.text !== 'รีเซ็ตการสนทนาเรียบร้อยค่ะ มีอะไรให้ชบาช่วยไหมคะ?'
  ).slice(-4);

  if (historyForCondensation.length > 0) {
    const condensationPrompt = `ภารกิจ: วิเคราะห์ประวัติการสนทนาและคำถามล่าสุดของผู้ใช้ จากนั้นสร้างคำถามที่สมบูรณ์และเป็นคำถามเดี่ยว (Standalone Query) สำหรับนำไปใช้สืบค้นในฐานข้อมูลหรือคลังเอกสาร RAG โดยต้องไม่เปลี่ยนความหมายเดิม และรักษาชื่อเฉพาะ ข้อมูลตัวเลข หรือคำสำคัญไว้
    
ประวัติการสนทนา:
${historyForCondensation.map(m => `${m.role === 'user' ? 'คำถาม' : 'คำตอบ'}: ${m.text}`).join('\n')}
คำถามล่าสุด: ${userMsg}

ตอบกลับเฉพาะข้อความที่เป็นคำถามเดี่ยว (Standalone Query) ในภาษาไทยเท่านั้น ห้ามอธิบายเพิ่มเติม ห้ามมีเครื่องหมายคำพูด ห้ามขึ้นต้นด้วย "คำถามเดี่ยว:"`;

    try {
      const condensedRes = await callGeminiAPI(condensationPrompt, apiKey, {
        temperature: 0.2
      });
      const condensedQuery = condensedRes.text.trim();
      if (condensedQuery) {
        console.log("Original query:", userMsg);
        console.log("Condensed query:", condensedQuery);
        searchQuery = condensedQuery;
      }
    } catch (condenseErr) {
      console.warn("Failed to condense query, using original:", condenseErr);
    }
  }

  // 2. วางแผนสืบค้นข้อมูลฐานข้อมูลแบบไดนามิก (Dynamic Database AI Solver)
  let dbContextParts: string[] = [];
  let queryPlan = { queries: [] as any[], need_rag: true };
  
  try {
    queryPlan = await planDatabaseQueries(searchQuery, apiKey, currentYear);
  } catch (planErr) {
    console.error("Failed to plan database queries:", planErr);
  }

  // --- ระบบ RAG Fallback สำหรับตารางหลัก (Database Fallback Solver) ---
  if (!queryPlan.queries) queryPlan.queries = [];
  const msgLower = userMsg.toLowerCase();
  
  // 2.1 สำหรับข้อมูลนักเรียน
  const hasStudentQuery = queryPlan.queries.some((q: any) => q.table === 'students');
  if (!hasStudentQuery && (msgLower.includes('นักเรียน') || msgLower.includes('ชั้นเรียน') || msgLower.includes('สถิติ') || msgLower.includes('ห้องเรียน') || msgLower.includes('เด็ก'))) {
    const targetClass = extractClassLevel(userMsg);
    if (targetClass) {
      queryPlan.queries.push({
        table: 'students',
        select: 'prefix, first_name, last_name, class_level, room, gender',
        filters: [
          { column: 'class_level', operator: 'eq', value: targetClass },
          { column: 'academic_year', operator: 'eq', value: currentYear },
          { column: 'graduation_status', operator: 'in', value: ['ปกติ', 'กำลังศึกษา'] }
        ]
      });
    } else {
      queryPlan.queries.push({
        table: 'students',
        select: 'class_level, gender, religion',
        limit: 500,
        filters: [
          { column: 'academic_year', operator: 'eq', value: currentYear },
          { column: 'graduation_status', operator: 'in', value: ['ปกติ', 'กำลังศึกษา'] }
        ]
      });
    }
  }

  // 2.2 สำหรับข้อมูลครูและเวร
  const hasTeacherQuery = queryPlan.queries.some((q: any) => q.table === 'teachers' || q.table === 'teacher_duties');
  if (!hasTeacherQuery && (msgLower.includes('ครู') || msgLower.includes('คุณครู') || msgLower.includes('เวร') || msgLower.includes('เวรยาม') || msgLower.includes('บุคลากร'))) {
    queryPlan.queries.push({
      table: 'teachers',
      select: 'id, prefix, first_name, last_name, position, department, phone, email',
      filters: []
    });
    queryPlan.queries.push({
      table: 'teacher_duties',
      select: 'duty_day, duty_type, teacher_id',
      filters: []
    });
  }

  // 2.3 สำหรับโครงการและงบประมาณ
  const hasProjectQuery = queryPlan.queries.some((q: any) => q.table === 'school_projects' || q.table === 'budget_allocations');
  if (!hasProjectQuery && (msgLower.includes('โครงการ') || msgLower.includes('งบประมาณ') || msgLower.includes('เงินงบ') || msgLower.includes('งบ'))) {
    queryPlan.queries.push({
      table: 'school_projects',
      select: 'project_name, academic_year, planned_amount, spent_amount, status',
      filters: [{ column: 'academic_year', operator: 'eq', value: currentYear }]
    });
    queryPlan.queries.push({
      table: 'budget_allocations',
      select: 'budget_type, category_name, amount, spent_amount, remaining_amount',
      filters: [{ column: 'academic_year', operator: 'eq', value: currentYear }]
    });
  }

  // 2.4 สำหรับข้อมูลหนังสือราชการและไฟล์แนบ
  const hasDocQuery = queryPlan.queries.some((q: any) => q.table === 'incoming_docs' || q.table === 'outgoing_docs' || q.table === 'orders' || q.table === 'memos');
  if (!hasDocQuery && (msgLower.includes('หนังสือรับ') || msgLower.includes('หนังสือเข้า') || msgLower.includes('หนังสือส่ง') || msgLower.includes('หนังสือออก') || msgLower.includes('คำสั่ง') || msgLower.includes('บันทึกข้อความ') || msgLower.includes('เมโม่') || msgLower.includes('แนบ') || msgLower.includes('ไฟล์แนบ') || msgLower.includes('เอกสารแนบ'))) {
    const searchWord = userMsg.replace(/(ขอ|ไฟล์|แนบ|หนังสือ|คำสั่ง|บันทึกข้อความ|เมโม่|ล่าสุด|ของ|ที่|เรื่อง|เรื่องที่)/g, '').trim();
    const docFilters = searchWord ? [{ column: 'subject', operator: 'ilike', value: `%${searchWord}%` }] : [];
    
    if (msgLower.includes('หนังสือรับ') || msgLower.includes('หนังสือเข้า') || msgLower.includes('แนบ') || msgLower.includes('เอกสารแนบ')) {
      queryPlan.queries.push({
        table: 'incoming_docs',
        select: 'doc_number, subject, from_agency, doc_date, urgency, remark, file_url, attachment_urls',
        filters: docFilters,
        limit: 10
      });
    }
    if (msgLower.includes('หนังสือส่ง') || msgLower.includes('หนังสือออก')) {
      queryPlan.queries.push({
        table: 'outgoing_docs',
        select: 'doc_number, subject, to_agency, doc_date, urgency, remark, file_url',
        filters: docFilters,
        limit: 10
      });
    }
    if (msgLower.includes('คำสั่ง')) {
      queryPlan.queries.push({
        table: 'orders',
        select: 'order_number, subject, issuer, order_date, remark, file_url',
        filters: docFilters,
        limit: 10
      });
    }
    if (msgLower.includes('บันทึกข้อความ') || msgLower.includes('เมโม่') || msgLower.includes('บันทึก')) {
      queryPlan.queries.push({
        table: 'memos',
        select: 'memo_number, subject, requester, memo_date, urgency, remark, file_url',
        filters: docFilters,
        limit: 10
      });
    }
  }

  // 2.5 สำหรับข้อมูลบิลค่าไฟ ค่าน้ำ และสาธารณูปโภค
  const hasUtilityQuery = queryPlan.queries.some((q: any) => q.table === 'utilities');
  if (!hasUtilityQuery && (msgLower.includes('ค่าไฟ') || msgLower.includes('ไฟฟ้า') || msgLower.includes('ค่าน้ำ') || msgLower.includes('ประปา') || msgLower.includes('โทรศัพท์') || msgLower.includes('เน็ต') || msgLower.includes('อินเทอร์เน็ต') || msgLower.includes('บิล') || msgLower.includes('สาธารณูปโภค'))) {
    const types = [];
    if (msgLower.includes('ค่าไฟ') || msgLower.includes('ไฟฟ้า')) types.push('electricity');
    if (msgLower.includes('ค่าน้ำ') || msgLower.includes('ประปา')) types.push('water');
    if (msgLower.includes('โทรศัพท์')) types.push('telephone');
    if (msgLower.includes('เน็ต') || msgLower.includes('อินเทอร์เน็ต')) types.push('internet');
    
    queryPlan.queries.push({
      table: 'utilities',
      select: 'type, academic_year, month, amount, invoice_number, status, bill_date',
      filters: [
        { column: 'academic_year', operator: 'eq', value: currentYear },
        ...(types.length > 0 ? [{ column: 'type', operator: 'in', value: types }] : [])
      ],
      limit: 20
    });
  }

  // 2.6 สำหรับข้อมูลจัดซื้อจัดจ้าง
  const hasProcureQuery = queryPlan.queries.some((q: any) => q.table === 'procurement_projects');
  if (!hasProcureQuery && (msgLower.includes('จัดซื้อ') || msgLower.includes('จัดจ้าง') || msgLower.includes('พัสดุ') || msgLower.includes('ผู้ขาย') || msgLower.includes('สัญญา') || msgLower.includes('ผู้รับจ้าง'))) {
    queryPlan.queries.push({
      table: 'procurement_projects',
      select: 'project_name, academic_year, method, procurement_type, total_amount, status, ref_doc_number, contract_number, committee_json, vendor_info',
      filters: [{ column: 'academic_year', operator: 'eq', value: currentYear }],
      limit: 20
    });
  }

  // 3. ดึงสถิตินักเรียนและครูพื้นฐาน (Fallback)
  let fallbackStats = "";
  try {
    const { count: sCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('academic_year', currentYear).in('graduation_status', ['ปกติ', 'กำลังศึกษา']);
    const { count: tCount } = await supabase.from('teachers').select('*', { count: 'exact', head: true });
    fallbackStats = `สถิติพื้นฐาน: นักเรียน ${sCount || 0} คน, ครู ${tCount || 0} คน (ปีการศึกษา ${currentYear})`;
  } catch (e) {}

  // 4. คิวรีข้อมูลจริงจาก Supabase
  if (queryPlan.queries && Array.isArray(queryPlan.queries)) {
    for (const q of queryPlan.queries) {
      if (!DEFAULT_SCHEMA_MAP[q.table]) continue;
      try {
        let selectStr = q.select || '*';
        if (selectStr.includes('count') || selectStr.includes('(') || selectStr.includes(')')) {
          const parts = selectStr.split(',').map((p: string) => p.trim());
          const validParts = parts.filter((p: string) => {
            const cleanName = p.replace(/[^a-zA-Z0-9_]/g, '');
            return DEFAULT_SCHEMA_MAP[q.table].columns.includes(cleanName);
          });
          selectStr = validParts.length > 0 ? validParts.join(',') : '*';
        }

        let query = supabase.from(q.table).select(selectStr);
        
        // กรองปีการศึกษา (academic_year)
        const columnsInTable = DEFAULT_SCHEMA_MAP[q.table]?.columns || [];
        if (columnsInTable.includes('academic_year')) {
          const hasYearFilter = q.filters && q.filters.some((f: any) => f.column === 'academic_year');
          if (!hasYearFilter) {
            query = query.eq('academic_year', currentYear);
          }
        }
        
        // กรองสถานะนักเรียนปกติ/กำลังศึกษา (graduation_status)
        if (q.table === 'students') {
          const hasStatusFilter = q.filters && q.filters.some((f: any) => f.column === 'graduation_status');
          if (!hasStatusFilter) {
            query = query.in('graduation_status', ['ปกติ', 'กำลังศึกษา']);
          }
        }

        if (q.filters) {
          for (const f of q.filters) {
            if (DEFAULT_SCHEMA_MAP[q.table].columns.includes(f.column)) {
              if (q.table === 'students' && f.column === 'class_level') {
                const rawVal = String(f.value).trim();
                const levelMatch = rawVal.match(/\d+/);
                const prefix = rawVal.includes('อ') || rawVal.includes('อนุบาล') ? 'อ' : 'ป';
                if (levelMatch) {
                  const levelNum = levelMatch[0];
                  if (prefix === 'ป') {
                    query = query.or(`class_level.eq.${rawVal},class_level.ilike.ป%${levelNum}%,class_level.ilike.%ประถม%${levelNum}%`);
                  } else {
                    query = query.or(`class_level.eq.${rawVal},class_level.ilike.อ%${levelNum}%,class_level.ilike.%อนุบาล%${levelNum}%`);
                  }
                } else {
                  // @ts-ignore
                  query = query[f.operator](f.column, f.value);
                }
              } else {
                // @ts-ignore
                query = query[f.operator](f.column, f.value);
              }
            }
          }
        }
        
        const { data, error } = await query.limit(Math.min(q.limit || 100, 500));
        if (error) {
          console.error(`[AICowork Service DB Query Error on ${q.table}]:`, error);
        } else if (data?.length) {
          // เพิ่ม Pre-computed stats สำหรับตารางนักเรียนภาพรวม
          if (q.table === 'students' && !userMsg.includes('รายชื่อ') && !userMsg.includes('คนไหนบ้าง')) {
            const counts: Record<string, number> = {};
            const genders: Record<string, number> = {};
            const religions: Record<string, number> = {};
            
            (data as any[]).forEach((s: any) => {
              const lvl = s.class_level || 'ไม่ระบุชั้น';
              const g = s.gender || 'ไม่ระบุเพศ';
              const r = s.religion || 'ไม่ระบุศาสนา';
              
              counts[lvl] = (counts[lvl] || 0) + 1;
              genders[g] = (genders[g] || 0) + 1;
              religions[r] = (religions[r] || 0) + 1;
            });
            
            const sortedClasses = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], 'th'));
            const summaryStr = sortedClasses.map(([lvl, num]) => `- ${lvl}: ${num} คน`).join('\n');
            const genderStr = Object.entries(genders).map(([g, num]) => `- ${g}: ${num} คน`).join('\n');
            const religionStr = Object.entries(religions).map(([r, num]) => `- ${r}: ${num} คน`).join('\n');
            
            dbContextParts.push(`[สรุปสถิตินักเรียนปีการศึกษา ${currentYear} คำนวณจากระบบฐานข้อมูล]:
รวมนักเรียนปัจจุบันทั้งหมด: ${data.length} คน

จำนวนนักเรียนแยกตามชั้นเรียน:
${summaryStr}

จำนวนนักเรียนแยกตามเพศ:
${genderStr}

จำนวนนักเรียนแยกตามศาสนา:
${religionStr}

[ข้อมูลรายละเอียดตารางนักเรียนดิบ: ${q.table}]
${JSON.stringify(data, null, 2)}`);
          } else {
            dbContextParts.push(`[ข้อมูลตาราง: ${q.table}]\n${JSON.stringify(data, null, 2)}`);
          }
        }
      } catch (queryErr) {
        console.error(`[AICowork Service DB Query Exec Fail on ${q.table}]:`, queryErr);
      }
    }
  }

  // 5. ค้นหาคลังปัญญา (RAG ส่วนกลาง)
  let knowledgeContext = "";
  if (queryPlan.need_rag !== false && (searchSource === 'all' || searchSource === 'global')) {
    let matches = await searchKnowledge(searchQuery, apiKey, 12);
    
    const fileRefMatch = searchQuery.match(/(\d+[\/_]\d+|ว\s?\d+|ระเบียบ\s?\d+)/i) || userMsg.match(/(\d+[\/_]\d+|ว\s?\d+|ระเบียบ\s?\d+)/i);
    if (fileRefMatch) {
      const keyword = fileRefMatch[0];
      const cleanKw = keyword.replace(/\//g, '_');
      const { data: deepMatches } = await supabase
        .from('school_knowledge')
        .select('document_name, page_number, chunk_text')
        .or(`document_name.ilike.%${keyword}%,document_name.ilike.%${cleanKw}%,chunk_text.ilike.%${keyword}%,chunk_text.ilike.%${cleanKw}%`)
        .limit(10);
      
      if (deepMatches?.length) {
        const combinedMatches = [...deepMatches.map(m => ({...m, similarity: 1})), ...matches];
        matches = combinedMatches.filter((v, i, a) => a.findIndex(t => (t.chunk_text === v.chunk_text)) === i);
      }
    }

    knowledgeContext = matches.map((m: any) => `[คลังกลาง: ${m.document_name} หน้า ${m.page_number}]\n${m.chunk_text}`).join('\n\n');
  }

  // 6. ค้นหาเอกสารส่วนตัว (Private Knowledge RAG)
  let privateContext = "";
  if (searchSource === 'all' || searchSource === 'private') {
    try {
      const privateMatches = await searchPrivateKnowledge(searchQuery, userId, apiKey, 10);
      if (privateMatches && privateMatches.length > 0) {
        privateContext = privateMatches.map((m: any) => `[ไฟล์ส่วนตัว: ${m.document_name} หน้า ${m.page_number}]\n${m.chunk_text}`).join('\n\n');
      } else {
        // Fallback: ค้นหาจากเนื้อหาไฟล์ดิบดั้งเดิมแบบ Keyword Search
        const { data: personalDocs } = await supabase
          .from('ai_knowledge_base')
          .select('*')
          .eq('teacher_id', userId)
          .order('created_at', { ascending: false });

        if (personalDocs?.length) {
          const pMatches = searchPersonalDocs(searchQuery, personalDocs);
          if (pMatches.length === 0 && (searchQuery.includes('ล่าสุด') || personalDocs.length === 1)) {
            const latest = personalDocs[0];
            privateContext = `[ไฟล์ล่าสุด: ${latest.file_name}]\n${latest.content_text?.substring(0, 1500)}`;
          } else {
            privateContext = pMatches.map(m => `[ไฟล์ส่วนตัว: ${m.file_name}]\n${m.snippet}`).join('\n\n');
          }
        }
      }
    } catch (privErr) {
      console.error("Private search error in service:", privErr);
    }
  }

  // 7. สร้างประวัติการสนทนาย้อนหลังเสริมเป็น Context
  const historyForPrompt = messages.filter(m => 
    m.text !== 'สวัสดีค่ะ ชบาคือ "น้องชบา" ผู้ช่วยอัจฉริยะของคุณครู มีอะไรให้หนูช่วยสรุปหรือค้นหาข้อมูลในคลังเอกสารไหมคะ?' && 
    m.text !== 'รีเซ็ตการสนทนาเรียบร้อยค่ะ มีอะไรให้ชบาช่วยไหมคะ?'
  ).slice(-5);

  let historyContext = "";
  if (historyForPrompt.length > 0) {
    historyContext = `ประวัติการสนทนาล่าสุดของเซสชันนี้:\n` + 
      historyForPrompt.map(m => `- ${m.role === 'user' ? 'คุณครู' : 'น้องชบา'}: ${m.text}`).join('\n') + 
      `\n\n`;
  }

  // 8. สร้าง Prompt และเรียก AI
  const systemInstruction = `คุณคือ "น้องชบา" ผู้ช่วยอัจฉริยะ${schoolName}
  บุคลิก: สุภาพ ใช้ "ค่ะ/นะคะ" แทนตัวว่า "ชบา" หรือ "หนู"
  กฎการตอบ:
  - ตอบเฉพาะความจริงจากบริบทที่ให้เท่านั้น ห้ามมโนข้อมูลเอง
  - หากนำข้อมูลมาจาก 'บริบทคลังปัญญา' หรือ 'บริบทเอกสารส่วนตัว' มาตอบ ให้เขียนระบุแหล่งอ้างอิงเอกสารต้นฉบับและหน้า (ถ้ามี) ไว้ท้ายข้อมูลหรือส่วนที่เกี่ยวข้องเสมอ เช่น "(อ้างอิงจากคลังกลาง: [ชื่อเอกสาร] หน้า [หน้า])" หรือ "(อ้างอิงจากไฟล์ส่วนตัว: [ชื่อไฟล์] หน้า [หน้า])" เพื่อให้ผู้ใช้สามารถตรวจสอบความถูกต้องได้
  - หากไม่พบข้อมูล ให้แจ้งสุภาพว่า "ชบาหาข้อมูลส่วนนี้ไม่พบค่ะ"
  - ห้ามใช้เครื่องหมายดอกจัน (*) ในคำตอบ
  - จัดรูปแบบให้อ่านง่าย ใช้แท็ก <ans>...</ans> หุ้มคำตอบสุดท้าย`;

  const prompt = `บริบทฐานข้อมูล:
  ${fallbackStats}
  ${truncateContext(dbContextParts.join('\n\n'), 150000)}

  บริบทคลังปัญญา:
  ${truncateContext(knowledgeContext, 150000)}

  บริบทเอกสารส่วนตัว:
  ${truncateContext(privateContext, 150000)}

  ${historyContext}คำถามปัจจุบันของคุณครู: "${userMsg}"
  
  ตอบในแท็ก <ans> เท่านั้นนะคะ`;

  const res = await callGeminiAPI(prompt, apiKey, {
    systemInstruction,
    temperature: 0.7
  });

  let finalAnswer = res.text;
  const match = finalAnswer.match(/<ans>([\s\S]*?)<\/ans>/);
  if (match) finalAnswer = match[1].trim();
  
  finalAnswer = finalAnswer.replace(/\*/g, '').replace(/AI Cowork/gi, 'น้องชบา').replace(/ครับ/g, 'ค่ะ');

  return {
    answer: finalAnswer,
    queryPlanUsed: queryPlan,
    dbContextLoaded: dbContextParts.join('\n\n'),
    knowledgeContextLoaded: knowledgeContext,
    privateContextLoaded: privateContext
  };
}
