declare const process: any;
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';

// ============================================================
// Telegram Bot Webhook API
// รับ Webhook จาก Telegram เพื่อผูกบัญชีครูรายบุคคลและตอบกลับทั่วไป
// URL Webhook: https://your-domain.vercel.app/api/telegram-webhook?school_id=uuid
// ============================================================

/** ส่งข้อความกลับหาผู้ใช้ทาง Telegram Bot API */
async function sendTelegramMessage(botToken: string, chatId: number, text: string, replyMarkup?: any) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    console.error('[TELEGRAM SEND MESSAGE ERROR]', err);
  }
  return resp;
}

/** เรียกใช้งานโมเดล Gemini API สำหรับโต้ตอบบทสนทนา */
async function callGemini(system: string, user: string, apiKey: string): Promise<string> {
  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-flash-latest"];
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: system }]
          },
          contents: [{
            parts: [{ text: user }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        })
      });
      if (res.ok) {
        const data = await res.json() as any;
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          console.log(`[TELEGRAM WEBHOOK] Gemini model ${model} success!`);
          return text;
        }
      } else {
        const errData = await res.json() as any;
        console.error(`[TELEGRAM WEBHOOK] Error with model ${model}:`, JSON.stringify(errData));
      }
    } catch (e) {
      console.error(`[TELEGRAM WEBHOOK] Gemini error with model ${model}:`, e);
    }
  }
  return "";
}

/** แยกชั้นเรียนจากข้อความ เช่น ป.1, อ.2 */
function extractClassLevel(text: string): string | null {
  const cleaned = text.replace(/\s+/g, '');
  const pMatch = cleaned.match(/(ป|ประถม|ประถมศึกษา|ประถมศึกษาปีที่)\.?([1-6])/);
  if (pMatch) return `ป.${pMatch[2]}`;
  const aMatch = cleaned.match(/(อ|อนุบาล|อนุบาลปีที่)\.?([2-3])/);
  if (aMatch) return `อ.${aMatch[2]}`;
  return null;
}

/** ดึงคำค้นหาจากข้อความเรื่องเอกสาร */
function extractDocSearchWord(message: string): string {
  if (!message) return '';
  const msg = message.toLowerCase();
  const reangIdx = msg.indexOf('เรื่อง');
  const numIdx = msg.indexOf('เลขที่');
  let keyword = '';
  if (reangIdx !== -1) { keyword = msg.substring(reangIdx + 6).trim(); }
  else if (numIdx !== -1) { keyword = msg.substring(numIdx + 6).trim(); }
  else {
    keyword = msg;
    const commonWords = [
      'ชบา', 'น้องชบา', 'บอท',
      'ใครรับผิดชอบ', 'ผู้รับผิดชอบ', 'รับผิดชอบ', 'มอบหมายให้ใคร', 'มอบหมายงาน', 'มอบหมาย', 'ส่งให้ใคร', 'ให้ใคร', 'ของใคร', 'ใคร', 'คนไหน', 'ท่านใด', 'ทำหน้าที่',
      'ขอไฟล์แนบ', 'ขอเอกสารแนบ', 'ขอลิงก์', 'ขอลิงค์', 'ขอไฟล์', 'ดาวน์โหลด', 'ขอดู',
      'หนังสือรับที่', 'หนังสือส่งที่', 'คำสั่งที่', 'บันทึกที่', 'จดหมายที่', 'ฉบับที่', 'เรื่องที่',
      'หนังสือรับ', 'หนังสือส่ง', 'หนังสือเข้า', 'หนังสือออก', 'บันทึกข้อความ',
      'เอกสารรับ', 'เอกสารส่ง', 'ไฟล์แนบ', 'เอกสารแนบ', 'ไฟล์รับ', 'ไฟล์ส่ง',
      'ไฟล์คำสั่ง', 'ไฟล์บันทึก', 'คำสั่ง', 'ใบสั่ง', 'บันทึก', 'เมโม่', 'memo', 'โหลด',
      'เลขที่', 'เลข',
      'ของ', 'ที่', 'ฉบับ', 'เรื่อง', 'ขอ', 'มี', 'ส่ง', 'ล่าสุด', 'ใหม่ล่าสุด', 'ย้อนหลัง', 'เก่า', 'ใหม่'
    ];
    commonWords.forEach(w => { keyword = keyword.replace(new RegExp(w, 'g'), ''); });
  }
  const suffixes = ['หน่อย', 'ครับ', 'ค่ะ', 'นะ', 'นะคะ', 'ด้วย', 'ที', 'หน่อยครับ', 'หน่อยค่ะ', 'หน่อยนะ', 'หน่อยนะคะ', 'ด้วยครับ', 'ด้วยค่ะ', 'ซิ', 'สิ', 'จ๊ะ', 'จ้า'];
  suffixes.forEach(s => {
    keyword = keyword.replace(new RegExp(s + '$', 'g'), '');
    keyword = keyword.replace(new RegExp('\\s+' + s, 'g'), '');
  });
  return keyword.trim();
}

/** Smart Data Fetch — ดึงข้อมูลจริงจากฐานข้อมูลตามหมวดคำถาม (เทียบเท่า LINE Bot) */
async function smartFetchContext(message: string, currentYear: string, supabase: any, schoolId: string, profileLinked?: any): Promise<string> {
  const msg = message.toLowerCase();
  const targetClass = extractClassLevel(message);

  const rules = [
    {
      keys: ['ค้างเกษียณ', 'รอเกษียณ', 'ยังไม่ได้เกษียณ', 'ยังไม่เกษียณ', 'ผอ. ยังไม่ได้ทำ', 'ผอ. ยังไม่สั่ง', 'ค้างผอ', 'หนังสือค้าง', 'รอสั่งการ', 'ค้างสั่งการ'],
      fetch: async () => {
        let query = supabase.from('incoming_docs').select('id, doc_number, subject, from_agency, doc_date, urgency, status, file_url, attachment_urls');
        if (schoolId) query = query;
        query = query.eq('status', 'pending');
        const { data } = await query.order('doc_date', { ascending: false }).limit(20);
        return `ข้อมูลหนังสือรับที่ยังค้างเสนอผู้อำนวยการเกษียณสั่งการ (สถานะ pending): ${JSON.stringify(data)}`;
      }
    },
    {
      keys: ['งานค้าง', 'งานค้างของฉัน', 'งานของฉัน', 'งานที่ยังไม่ได้ส่ง', 'ยังไม่ได้รายงาน', 'งานที่มอบหมายค้าง', 'งานมอบหมายค้าง', 'รายงานผล', 'ส่งรายงาน', 'ส่งงาน'],
      fetch: async () => {
        if (!profileLinked || !profileLinked.email) return 'ไม่มีข้อมูลโปรไฟล์ผู้ใช้สำหรับสืบค้นงานค้างส่วนบุคคล';
        const { data: teacher } = await supabase
          .from('teachers')
          .select('id')
          .eq('email', profileLinked.email)
          .maybeSingle();
        if (!teacher) return `ไม่พบข้อมูลคุณครูในตารางระบบโรงเรียนสำหรับอีเมล: ${profileLinked.email}`;
        
        const { data: pendingAssigns } = await supabase
          .from('doc_assignments')
          .select('*, incoming_docs(subject, doc_number)')
          .eq('assignee_id', teacher.id)
          .in('status', ['pending', 'acknowledged'])
          .order('created_at', { ascending: false });
        return `รายการงานมอบหมายที่ยังค้างการรายงานผล/ครูยังทำไม่เสร็จ (สถานะ pending หรือ acknowledged) ของครูผู้สอบถาม: ${JSON.stringify(pendingAssigns)}`;
      }
    },
    {
      keys: ['ครู', 'คุณครู', 'บุคลากร', 'ผู้สอน', 'เวร', 'เวรยาม', 'อีเมล', 'อีเมล์', 'เบอร์โทร', 'เบอร์ติดต่อ', 'มีใครบ้าง', 'ใครบ้าง'],
      fetch: async () => {
        let teachersQuery = supabase.from('teachers').select('id, prefix, first_name, last_name, position, department, phone, email, status');
        if (schoolId) teachersQuery = teachersQuery;
        let { data: teachers } = await teachersQuery;
        if (!teachers || teachers.length === 0) {
          let profilesQuery = supabase.from('profiles').select('id, display_name, email, role, status');
          if (schoolId) profilesQuery = profilesQuery;
          const { data: profiles } = await profilesQuery;
          if (profiles && profiles.length > 0) {
            teachers = profiles.map((p: any) => ({
              id: p.id, prefix: '', first_name: p.display_name || p.email?.split('@')[0], last_name: '',
              position: p.role === 'admin' ? 'ผู้ดูแลระบบ' : p.role === 'director' ? 'ผู้อำนวยการ' : 'ครู',
              department: 'ทั่วไป', phone: '', email: p.email, status: p.status
            }));
          }
        }
        const { data: duties } = await supabase.from('teacher_duties').select('duty_day, duty_type, teacher_id, teachers(prefix, first_name, last_name)');
        return `รายชื่อครูและบุคลากร: ${JSON.stringify(teachers)}\nตารางเวรประจำวันครู: ${JSON.stringify(duties)}`;
      }
    },
    {
      keys: ['เขตพื้นที่บริการ', 'พื้นที่บริการ', 'ทร.14', 'ทร14', 'พฐ.03', 'พฐ03', 'เด็กเข้าเกณฑ์', 'เด็กในเขต'],
      fetch: async () => {
        let sasQuery = supabase.from('service_area_students').select('prefix, first_name, last_name, gender, birth_date, moo, sub_district');
        if (schoolId) sasQuery = sasQuery;
        const { data } = await sasQuery.limit(60);
        return `ข้อมูลทะเบียนเด็กในเขตพื้นที่บริการ (ทร.14 / พฐ.03): ${JSON.stringify(data)}`;
      }
    },
    {
      keys: ['โครงการ', 'งบประมาณ', 'งบ', 'เงินงบ', 'สถิติ', 'สรุป', 'ผลสัมฤทธิ์', 'จัดซื้อจัดจ้าง', 'ซื้อจ้าง'],
      fetch: async () => {
        let projQuery = supabase.from('school_projects').select('project_name, planned_amount, spent_amount, status, budget_allocations(budget_type, category_name)').eq('academic_year', currentYear);
        let budgQuery = supabase.from('budget_allocations').select('id, budget_type, category_name, amount, spent_amount, remaining_amount').eq('academic_year', currentYear);
        let procQuery = supabase.from('procurement_projects').select('project_name, total_amount, status, procurement_type').eq('academic_year', currentYear);
        if (schoolId) { projQuery = projQuery; budgQuery = budgQuery; procQuery = procQuery; }
        const { data: projects } = await projQuery;
        const { data: budget } = await budgQuery;
        const { data: procurement } = await procQuery;
        const totalAllocated = budget?.reduce((sum: number, b: any) => sum + (b.amount || 0), 0) || 0;
        const totalSpent = budget?.reduce((sum: number, b: any) => sum + (b.spent_amount || 0), 0) || 0;
        const totalRemaining = budget?.reduce((sum: number, b: any) => sum + (b.remaining_amount || 0), 0) || 0;
        return `สถิติสรุปงบประมาณ ปี ${currentYear}:\n- ยอดงบรวม: ${totalAllocated.toLocaleString()} บาท\n- ใช้ไป: ${totalSpent.toLocaleString()} บาท\n- คงเหลือ: ${totalRemaining.toLocaleString()} บาท\nข้อมูลโครงการ: ${JSON.stringify(projects)}\nข้อมูลงบ: ${JSON.stringify(budget)}\nข้อมูลจัดซื้อจัดจ้าง: ${JSON.stringify(procurement)}`;
      }
    },
    {
      keys: ['หนังสือรับ', 'จดหมาย', 'เอกสารรับ', 'หนังสือเข้า', 'ไฟล์แนบ', 'เอกสารแนบ', 'แนบ', 'ไฟล์รับ'],
      fetch: async () => {
        const searchWord = extractDocSearchWord(message);
        let query = supabase.from('incoming_docs').select('id, status, doc_number, subject, from_agency, doc_date, urgency, remark, file_url, attachment_urls, doc_assignments(instruction, status, teachers(prefix, first_name, last_name))');
        if (schoolId) query = query;
        if (searchWord.length > 0) query = query.or(`subject.ilike.%${searchWord}%,doc_number.ilike.%${searchWord}%`);
        const { data } = await query.order('doc_date', { ascending: false }).limit(5);
        return `ข้อมูลหนังสือรับล่าสุด (รวมข้อมูลการมอบหมายงานด้วย): ${JSON.stringify(data)}`;
      }
    },
    {
      keys: ['หนังสือส่ง', 'เอกสารส่ง', 'หนังสือออก', 'ไฟล์ส่ง'],
      fetch: async () => {
        const searchWord = extractDocSearchWord(message);
        let query = supabase.from('outgoing_docs').select('doc_number, subject, to_agency, doc_date, urgency, remark, file_url');
        if (schoolId) query = query;
        if (searchWord.length > 0) query = query.or(`subject.ilike.%${searchWord}%,doc_number.ilike.%${searchWord}%`);
        const { data } = await query.order('doc_date', { ascending: false }).limit(5);
        return `ข้อมูลหนังสือส่งล่าสุด: ${JSON.stringify(data)}`;
      }
    },
    {
      keys: ['คำสั่ง', 'ใบสั่ง', 'ไฟล์คำสั่ง'],
      fetch: async () => {
        const searchWord = extractDocSearchWord(message);
        let query = supabase.from('orders').select('order_number, subject, issuer, order_date, remark, file_url');
        if (schoolId) query = query;
        if (searchWord.length > 0) query = query.or(`subject.ilike.%${searchWord}%,order_number.ilike.%${searchWord}%`);
        const { data } = await query.order('order_date', { ascending: false }).limit(5);
        return `ข้อมูลคำสั่งล่าสุด: ${JSON.stringify(data)}`;
      }
    },
    {
      keys: ['บันทึก', 'เมโม่', 'memo', 'บันทึกข้อความ', 'ไฟล์บันทึก'],
      fetch: async () => {
        const searchWord = extractDocSearchWord(message);
        let query = supabase.from('memos').select('memo_number, subject, requester, memo_date, urgency, remark, file_url');
        if (schoolId) query = query;
        if (searchWord.length > 0) query = query.or(`subject.ilike.%${searchWord}%,memo_number.ilike.%${searchWord}%`);
        const { data } = await query.order('memo_date', { ascending: false }).limit(5);
        return `ข้อมูลบันทึกข้อความล่าสุด: ${JSON.stringify(data)}`;
      }
    },
    {
      keys: ['ค่าไฟ', 'ไฟฟ้า', 'ค่าน้ำ', 'ประปา', 'โทรศัพท์', 'เน็ต', 'อินเทอร์เน็ต', 'สาธารณูปโภค', 'บิล'],
      fetch: async () => {
        let query = supabase.from('utilities').select('*').eq('academic_year', currentYear);
        if (schoolId) query = query;
        const types: string[] = [];
        if (msg.includes('ค่าไฟ') || msg.includes('ไฟฟ้า')) types.push('electricity');
        if (msg.includes('ค่าน้ำ') || msg.includes('ประปา')) types.push('water');
        if (msg.includes('โทรศัพท์')) types.push('telephone');
        if (msg.includes('เน็ต') || msg.includes('อินเทอร์เน็ต')) types.push('internet');
        if (types.length > 0) query = query.in('type', types);
        const { data } = await query.order('bill_date', { ascending: false }).limit(20);
        return `ข้อมูลค่าสาธารณูปโภค ปี ${currentYear}: ${JSON.stringify(data)}`;
      }
    },
    {
      keys: ['เช็คชื่อ', 'ขาด', 'ลา', 'มาสาย', 'เข้าเรียน'],
      fetch: async () => {
        let attQuery = supabase.from('attendance').select('date, class_level, summary, recorded_at');
        if (schoolId) attQuery = attQuery;
        const { data } = await attQuery.order('date', { ascending: false }).limit(5);
        return `ข้อมูลการเช็คชื่อเข้าเรียนล่าสุด: ${JSON.stringify(data)}`;
      }
    },
    {
      keys: ['พัสดุ', 'จัดซื้อ', 'จัดจ้าง', 'การจ้าง', 'สัญญา', 'ผู้ขาย', 'ผู้รับจ้าง', 'ตรวจรับ', 'กรรมการ'],
      fetch: async () => {
        let procQuery2 = supabase.from('procurement_projects').select('project_name, academic_year, method, procurement_type, total_amount, status, ref_doc_number, contract_number, committee_json, vendor_info, school_projects(project_name)').eq('academic_year', currentYear);
        if (schoolId) procQuery2 = procQuery2;
        const { data: projects } = await procQuery2.limit(10);
        return `ข้อมูลจัดซื้อจัดจ้าง ปี ${currentYear}: ${JSON.stringify(projects)}`;
      }
    },
    {
      keys: ['ห้องสมุด', 'ยืมหนังสือ', 'คืนหนังสือ', 'ยืม-คืน', 'หนังสือห้องสมุด'],
      fetch: async () => {
        let booksQuery = supabase.from('library_books').select('id, book_id, title, category, author, available_qty, status');
        let borrowQuery = supabase.from('library_borrow').select('borrow_date, borrower_name, return_date, status, library_books(book_id, title, category)');
        if (schoolId) { booksQuery = booksQuery; borrowQuery = borrowQuery; }
        const { data: books } = await booksQuery.limit(15);
        const { data: borrow } = await borrowQuery.order('borrow_date', { ascending: false }).limit(10);
        return `หนังสือในห้องสมุด: ${JSON.stringify(books)}\nประวัติยืม-คืน: ${JSON.stringify(borrow)}`;
      }
    },
    {
      keys: ['มอบหมาย', 'งานมอบหมาย', 'ติดตามงาน', 'สั่งงาน', 'มอบหมายงาน'],
      fetch: async () => {
        let daQuery = supabase.from('doc_assignments').select('instruction, status, reported_at, staff_report, incoming_docs(doc_number, subject), teachers(prefix, first_name, last_name)');
        if (schoolId) daQuery = daQuery;
        const { data } = await daQuery.limit(15);
        return `ข้อมูลการมอบหมายงาน: ${JSON.stringify(data)}`;
      }
    },
    {
      keys: ['การตั้งค่า', 'โรงเรียน', 'ผู้อำนวยการ', 'ที่อยู่โรงเรียน', 'ข้อมูลโรงเรียน'],
      fetch: async () => {
        let settingsQuery = supabase.from('settings').select('school_name, school_address, director_name, current_academic_year, current_term, phone_number, local_gov_name');
        if (schoolId) settingsQuery = settingsQuery;
        const { data } = await settingsQuery.limit(1).maybeSingle();
        return `ข้อมูลโรงเรียน: ${JSON.stringify(data)}`;
      }
    },
    {
      keys: ['นักเรียน', 'กี่คน', 'รายชื่อ', 'รายนาม', 'เด็กนักเรียน', 'ชั้นเรียน'],
      fetch: async () => {
        if (msg.includes('ครู') || msg.includes('โครงการ') || msg.includes('จัดซื้อ') || msg.includes('พัสดุ') || msg.includes('ห้องสมุด')) return "";
        if (targetClass) {
          const prefix = targetClass.startsWith('ป') ? 'ป' : 'อ';
          const levelNum = targetClass.split('.')[1];
          let query = supabase.from('students').select('prefix, first_name, last_name, class_level, room, gender').eq('academic_year', currentYear).in('graduation_status', ['ปกติ', 'กำลังศึกษา']);
          if (schoolId) query = query;
          if (prefix === 'ป') { query = query.or(`class_level.eq.${targetClass},class_level.ilike.ป%${levelNum}%`); }
          else { query = query.or(`class_level.eq.${targetClass},class_level.ilike.อ%${levelNum}%`); }
          const { data } = await query.order('room', { ascending: true }).order('first_name', { ascending: true });
          if (data && data.length > 0) {
            const listText = data.map((s: any, idx: number) => `${idx + 1}. ${s.prefix || ''}${s.first_name} ${s.last_name} ${s.room ? `(ห้อง ${s.room})` : ''}`).join('\n');
            return `รายชื่อนักเรียนชั้น ${targetClass} ปี ${currentYear} (รวม ${data.length} คน):\n${listText}`;
          }
          return `ไม่พบข้อมูลรายชื่อนักเรียนชั้น ${targetClass} สำหรับปี ${currentYear}`;
        } else {
          let studQuery = supabase.from('students').select('class_level, gender, religion').eq('academic_year', currentYear).in('graduation_status', ['ปกติ', 'กำลังศึกษา']);
          if (schoolId) studQuery = studQuery;
          const { data: allStudents } = await studQuery;
          if (allStudents && allStudents.length > 0) {
            const counts: Record<string, number> = {}; const genders: Record<string, number> = {};
            (allStudents as any[]).forEach((s: any) => { counts[s.class_level || 'ไม่ระบุ'] = (counts[s.class_level || 'ไม่ระบุ'] || 0) + 1; genders[s.gender || 'ไม่ระบุ'] = (genders[s.gender || 'ไม่ระบุ'] || 0) + 1; });
            const summaryStr = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], 'th')).map(([lvl, num]) => `- ${lvl}: ${num} คน`).join('\n');
            const genderStr = Object.entries(genders).map(([g, num]) => `- ${g}: ${num} คน`).join('\n');
            return `[สถิตินักเรียนปี ${currentYear}]:\nรวม: ${allStudents.length} คน\nแยกชั้น:\n${summaryStr}\nแยกเพศ:\n${genderStr}`;
          }
          let studQuery2 = supabase.from('students').select('*', { count: 'exact', head: true }).eq('academic_year', currentYear).in('graduation_status', ['ปกติ', 'กำลังศึกษา']);
          if (schoolId) studQuery2 = studQuery2;
          const { count } = await studQuery2;
          return `จำนวนนักเรียนปี ${currentYear}: ${count} คน`;
        }
      }
    },
    {
      keys: ['แผนการสอน', 'ส่งแผน', 'แผนสอน', 'ตรวจแผน'],
      fetch: async () => {
        let lpQuery = supabase.from('lesson_plans').select('title, subject_code, subject_name, class_level, term, status, academic_comments, director_comments, created_at, profiles(display_name)');
        if (schoolId) lpQuery = lpQuery;
        const { data } = await lpQuery;
        if (data && data.length > 0) {
          const listText = data.map((p: any, idx: number) => {
            const statusMap: Record<string, string> = { 'Draft': 'แบบร่าง', 'Pending_Academic': 'รอวิชาการตรวจ', 'Rejected_by_Academic': 'วิชาการส่งแก้ไข', 'Pending_Director': 'เสนอ ผอ. อนุมัติ', 'Rejected_by_Director': 'ผอ. ส่งแก้ไข', 'Approved': 'อนุมัติแล้ว 🟢' };
            return `${idx + 1}. "${p.title}" (${p.subject_code} ${p.subject_name} ชั้น ${p.class_level}) สถานะ: ${statusMap[p.status] || p.status} ครู: ${p.profiles?.display_name || '-'}`;
          }).join('\n');
          return `สถานะแผนการสอน:\n${listText}`;
        }
        return `ยังไม่มีข้อมูลแผนการสอนในระบบ`;
      }
    }
  ];

  for (const rule of rules) {
    if (rule.keys.some(key => msg.includes(key))) {
      try {
        const result = await rule.fetch();
        if (result) return result;
      } catch (err) {
        console.error(`[TELEGRAM WEBHOOK] Error in smartFetchContext for keys ${rule.keys[0]}:`, err);
      }
    }
  }

  // Fallback: ค้นหาใน school_knowledge (RAG)
  try {
    let skQuery = supabase.from('school_knowledge').select('document_name, chunk_text').or(`chunk_text.ilike.%${message}%,document_name.ilike.%${message}%`);
    if (schoolId) skQuery = skQuery;
    const { data: knowledge } = await skQuery.limit(3);
    if (knowledge && knowledge.length > 0) {
      return "ข้อมูลจากคลังความรู้โรงเรียน:\n" + knowledge.map((k: any) => `[ไฟล์: ${k.document_name}] ${k.chunk_text}`).join('\n');
    }
  } catch (err) { console.error('[TELEGRAM WEBHOOK RAG ERROR]', err); }

  return "";
}

function wrapThaiText(text: string, maxWidth: number, font: any, fontSize: number) {
  if (!text) return [];
  const segments = text.split(/(\s+)/);
  const lines = [];
  let currentLine = '';

  for (const segment of segments) {
    const testLine = currentLine + segment;
    const lineWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (lineWidth > maxWidth && currentLine !== '') {
      lines.push(currentLine);
      currentLine = segment;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

async function applyStampsOnServer(
  pdfBuffer: ArrayBuffer,
  directorData: {
    order: string;
    signer: string;
    date: string;
    position?: string;
    signatureUrl?: string;
    pageNumber?: number;
  }
) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    pdfDoc.registerFontkit(fontkit);

    let fontBytes: ArrayBuffer;
    try {
      const fontB64Path = path.join(process.cwd(), 'font.b64');
      const localFontPath = path.join(process.cwd(), 'public', 'fonts', 'THSarabunNew.ttf');
      const localDistFontPath = path.join(process.cwd(), 'dist', 'fonts', 'THSarabunNew.ttf');
      const rootFontPath = path.join(process.cwd(), 'THSarabunNew.ttf');

      if (fs.existsSync(localFontPath)) {
        const buffer = fs.readFileSync(localFontPath);
        fontBytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      } else if (fs.existsSync(localDistFontPath)) {
        const buffer = fs.readFileSync(localDistFontPath);
        fontBytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      } else if (fs.existsSync(fontB64Path)) {
        const b64Str = fs.readFileSync(fontB64Path, 'utf-8');
        const buf = Buffer.from(b64Str.trim(), 'base64');
        fontBytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      } else if (fs.existsSync(rootFontPath)) {
        const buffer = fs.readFileSync(rootFontPath);
        fontBytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      } else {
        const res = await fetch('https://school-admin-psi.vercel.app/fonts/THSarabunNew.ttf');
        if (!res.ok) throw new Error(`Failed to fetch remote font: status ${res.status}`);
        fontBytes = await res.arrayBuffer();
      }
    } catch (err) {
      console.error('Error loading local/preferred font, falling back to remote network fetch:', err);
      const res = await fetch('https://school-admin-psi.vercel.app/fonts/THSarabunNew.ttf');
      if (!res.ok) throw new Error(`Remote network backup fetch failed: status ${res.status}`);
      fontBytes = await res.arrayBuffer();
    }

    const customFont = await pdfDoc.embedFont(fontBytes);
    const pages = pdfDoc.getPages();
    const pageCount = pages.length;

    const requestedPage = directorData.pageNumber || 1;
    const pageIndex = Math.min(Math.max(requestedPage - 1, 0), pageCount - 1);
    const targetPage = pages[pageIndex];

    const { width } = targetPage.getSize();
    const stampColor = rgb(0.1, 0.2, 0.7);
    const fontSize = 15;
    const receiptBoxWidth = 140;
    const rightMargin = 30;
    const startX = width - receiptBoxWidth - rightMargin;
    const effectiveWidth = receiptBoxWidth;
    const dirY = 140;

    targetPage.drawText(`คำสั่ง / การปฏิบัติ`, {
      x: startX,
      y: dirY + 115,
      size: fontSize + 1,
      font: customFont,
      color: stampColor,
    });

    const orderLines = wrapThaiText(directorData.order, effectiveWidth, customFont, fontSize);
    let dCurrentY = dirY + 98;
    for (const line of orderLines) {
      targetPage.drawText(line, { x: startX, y: dCurrentY, size: fontSize, font: customFont, color: stampColor });
      dCurrentY -= 18;
    }

    const dirSignerY = dCurrentY - 35;

    if (directorData.signatureUrl) {
      try {
        const sigRes = await fetch(directorData.signatureUrl);
        if (sigRes.ok) {
          const sigBytes = await sigRes.arrayBuffer();
          const isPng = directorData.signatureUrl.toLowerCase().includes('.png') || directorData.signatureUrl.toLowerCase().includes('image/png');
          const sigImage = isPng ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes);
          const sigDims = sigImage.scale(0.50);
          targetPage.drawImage(sigImage, {
            x: startX + 60,
            y: dirSignerY + 10,
            width: sigDims.width,
            height: sigDims.height,
          });
        }
      } catch (imgErr) { console.error('Server PDF Signature image embed error:', imgErr); }
    }

    targetPage.drawText(`(ลงชื่อ) ........................................`, { x: startX - 10, y: dirSignerY, size: fontSize, font: customFont, color: stampColor });
    targetPage.drawText(`(${directorData.signer})`, { x: startX + 15, y: dirSignerY - 17, size: fontSize, font: customFont, color: stampColor });

    if (directorData.position) {
      targetPage.drawText(`${directorData.position}`, { x: startX - 5, y: dirSignerY - 34, size: fontSize, font: customFont, color: stampColor });
    }

    const dateObj = new Date(directorData.date);
    const thDay = dateObj.getDate();
    const thMonthAbbr = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."][dateObj.getMonth()];
    const thYear = dateObj.getFullYear() + 543;
    const thDateStr = `${thDay}/${thMonthAbbr}/${thYear}`;

    const thNumerals = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
    const thaiFormattedDate = thDateStr.replace(/[0-9]/g, (digit) => thNumerals[parseInt(digit)]);

    targetPage.drawText(`วันที่: ${thaiFormattedDate}`, {
      x: startX + 20,
      y: dirSignerY - (directorData.position ? 51 : 34),
      size: fontSize,
      font: customFont,
      color: stampColor,
    });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  } catch (err: any) {
    console.error('applyStampsOnServer error:', err);
    throw err;
  }
}

async function executeDocAssignment(
  docId: string,
  teacherId: string,
  instruction: string,
  botToken: string,
  chatId: number,
  profile: any,
  supabase: any
) {
  try {
    const { data: doc } = await supabase
      .from('incoming_docs')
      .select('*')
      .eq('id', docId)
      .single();

    if (!doc) {
      await sendTelegramMessage(botToken, chatId, '❌ ไม่พบข้อมูลหนังสือรับชิ้นนี้ในระบบค่ะ');
      return;
    }

    const { data: teacher } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', teacherId)
      .single();

    if (!teacher) {
      await sendTelegramMessage(botToken, chatId, '❌ ไม่พบข้อมูลคุณครูในระบบค่ะ');
      return;
    }

    let proposalStampPage = 1;
    if (doc.remark) {
      try {
        const extra = typeof doc.remark === 'object' ? doc.remark : JSON.parse(doc.remark);
        if (extra && extra.stamp_page) proposalStampPage = parseInt(extra.stamp_page) || 1;
      } catch (e) {}
    }

    const schoolId = doc?.school_id || profile?.school_id;
    let settingsQuery = supabase.from('settings').select('school_name, director_name, director_signature_url');
    if (schoolId) settingsQuery = settingsQuery;
    const { data: settings } = await settingsQuery.limit(1).maybeSingle();

    const schoolLabel = settings?.school_name 
      ? (settings.school_name.startsWith('โรงเรียน') ? settings.school_name : `โรงเรียน${settings.school_name}`)
      : '';
    const directorPosition = schoolLabel ? `ผู้อำนวยการ${schoolLabel}` : 'ผู้อำนวยการโรงเรียน';

    let finalFileUrl = doc.file_url;
    if (doc.file_url && doc.file_url.includes('supabase.co') && doc.file_url.toLowerCase().includes('.pdf')) {
      try {
        const fileRes = await fetch(doc.file_url);
        if (fileRes.ok) {
          const pdfBuffer = await fileRes.arrayBuffer();
          const stampedBytes = await applyStampsOnServer(pdfBuffer, {
            order: instruction,
            signer: settings?.director_name || profile.display_name || 'ผู้อำนวยการโรงเรียน',
            position: directorPosition,
            date: new Date().toISOString().split('T')[0],
            signatureUrl: settings?.director_signature_url || profile.signature_url,
            pageNumber: proposalStampPage
          });

          const pathSegments = doc.file_url.split('/');
          const fileName = pathSegments[pathSegments.length - 1].split('?')[0];

          await supabase.storage.from('temp_docs').upload(fileName, stampedBytes, { contentType: 'application/pdf', upsert: true });

          const { data: publicData } = supabase.storage.from('temp_docs').getPublicUrl(fileName);
          if (publicData?.publicUrl) finalFileUrl = `${publicData.publicUrl}?t=${Date.now()}`;

          const gasUrl = process.env.VITE_GAS_URL || 'https://script.google.com/macros/s/AKfycbw52uo8upPX6SiZ_W4dD9MUrocA3DkZm3XnE-eU4uE3vvOtOAK4VhXcLIf71PGVsvxj/exec';
          const base64 = Buffer.from(stampedBytes).toString('base64');
          const sanitizedSubject = doc.subject.replace(/[\/\\?%*:|"<>]/g, '-').slice(0, 50);
          const finalFileName = `${doc.doc_number}_เรื่อง_${sanitizedSubject}.pdf`;

          try {
            const driveRes = await fetch(gasUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ folder: 'incoming', filename: finalFileName, mimeType: 'application/pdf', base64: base64 })
            });

            if (driveRes.ok) {
              const driveResult = await driveRes.json() as any;
              if (driveResult.status === 'success' && driveResult.url) {
                finalFileUrl = driveResult.url;
                try {
                  await supabase.storage.from('temp_docs').remove([fileName]);
                } catch (e) {}
              }
            }
          } catch (e) {}
        }
      } catch (e) {}
    }

    await supabase.from('incoming_docs').update({ status: 'assigned', file_url: finalFileUrl }).eq('id', docId);

    const { data: insertedAssigns, error: assignErr } = await supabase
      .from('doc_assignments')
      .insert([{ doc_id: docId, assignee_id: teacherId, instruction: instruction, status: 'pending' }])
      .select();

    if (assignErr) throw assignErr;
    const assignment = insertedAssigns?.[0];

    await supabase.from('line_action_states').delete().eq('user_id', `telegram:${profile.id}`);

    const teacherName = `${teacher.prefix || ''}${teacher.first_name} ${teacher.last_name}`;
    await sendTelegramMessage(botToken, chatId, `✅ ทำการเกษียณสั่งการหนังสือเรื่อง "${doc.subject}" และมอบหมายงานให้คุณครู <b>${teacherName}</b> เรียบร้อยแล้วค่ะ 🌸`);

    const personalMsg = `📌 <b>มีงานมอบหมายใหม่ถึงคุณ</b>\n\n• <b>เรื่อง</b>: ${doc.subject}\n• <b>เลขที่หนังสือ</b>: ${doc.doc_number}\n• <b>คำสั่งการ</b>: ${instruction}\n\n📄 <a href="${finalFileUrl}">เปิดดูต้นฉบับเอกสารสั่งการ</a>`;
    const { data: teacherProfile } = await supabase.from('profiles').select('telegram_chat_id').eq('email', teacher.email).maybeSingle();

    if (teacherProfile?.telegram_chat_id) {
      const teacherReplyMarkup = {
        inline_keyboard: [
          [
            { text: '✅ รับทราบงาน', callback_data: `action=acknowledge&id=${assignment.id}` }
          ],
          [
            { text: '📢 ประชาสัมพันธ์ลงกลุ่มกลาง', callback_data: `action=bc_grp&id=${assignment.id}` }
          ]
        ]
      };
      await sendTelegramMessage(botToken, parseInt(teacherProfile.telegram_chat_id), personalMsg, teacherReplyMarkup);
    } else {
      const teacherReplyMarkup = {
        inline_keyboard: [
          [
            { text: '✅ รับทราบงาน', callback_data: `action=acknowledge&id=${assignment.id}` }
          ]
        ]
      };
      await sendTelegramMessage(botToken, chatId, `📢 <b>แจ้งมอบหมายงานใหม่</b>\n\n• <b>ถึงคุณครู</b>: ${teacherName}\n• <b>เรื่อง</b>: ${doc.subject}\n• <b>คำสั่งการ</b>: ${instruction}\n\n📄 <a href="${finalFileUrl}">เปิดดูเอกสารสั่งการ</a>`, teacherReplyMarkup);
    }

  } catch (err: any) {
    console.error('executeDocAssignment error:', err);
    await sendTelegramMessage(botToken, chatId, `❌ ดำเนินการไม่สำเร็จ: ${err.message}`);
  }
}

/** สร้าง Supabase client โดยใช้ Service Role Key เพื่อก้าวข้ามสิทธิ์ RLS */
function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/** ตอบรับ Callback Query เพื่อหยุดปุ่มหมุนค้าง และส่งข้อความ Alert ได้ */
async function answerCallbackQuery(botToken: string, callbackQueryId: string, text?: string, showAlert: boolean = false) {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: showAlert
    }),
  });
}

/** แก้ไขปุ่มของข้อความเดิมบน Telegram */
async function editTelegramMessageMarkup(botToken: string, chatId: number, messageId: number, replyMarkup: any) {
  const url = `https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup
    }),
  });
}

/** ดึงปุ่ม Markup ตามสถานะงานที่ส่งมอบ เพื่อป้องกันการกดรับทราบ/รายงานซ้ำ */
function getUpdatedMarkupForStatus(status: string, assignmentId: string) {
  if (status === 'pending') {
    return {
      inline_keyboard: [
        [{ text: '✅ รับทราบงาน', callback_data: `action=acknowledge&id=${assignmentId}` }],
        [{ text: '📢 ประชาสัมพันธ์ลงกลุ่มกลาง', callback_data: `action=bc_grp&id=${assignmentId}` }]
      ]
    };
  } else if (status === 'acknowledged') {
    return {
      inline_keyboard: [
        [{ text: '📝 รายงานผลการปฏิบัติงาน', callback_data: `action=report&id=${assignmentId}` }],
        [{ text: '📢 ประชาสัมพันธ์ลงกลุ่มกลาง', callback_data: `action=bc_grp&id=${assignmentId}` }]
      ]
    };
  } else if (status === 'completed') {
    return {
      inline_keyboard: [
        [{ text: '📊 รายงานผลแล้ว (รอ ผอ. ตรวจ)', callback_data: `action=noop` }]
      ]
    };
  } else if (status === 'closed') {
    return {
      inline_keyboard: [
        [{ text: '🔒 งานนี้เสร็จสิ้นแล้ว', callback_data: `action=noop` }]
      ]
    };
  }
  return { inline_keyboard: [] };
}

export default async function handler(req: any, res: any) {
  // รองรับเฉพาะ POST Webhook เท่านั้น
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // --- 1. รับค่า school_id จาก URL query parameter ---
  const schoolId = req.query?.school_id as string;

  try {
    const supabase = getSupabase();

    // --- 2. ดึงข้อมูลทั้งหมดจากตาราง settings (ซึ่งมีเพียงแถวเดียวสำหรับโครงการโรงเรียนนี้) ---
    const { data: settings, error: settingsErr } = await supabase
      .from('settings')
      .select('school_name, telegram_bot_token, telegram_bot_username, gemini_api_key, ai_cowork_api_key, current_academic_year')
      .single();

    if (settingsErr || !settings?.telegram_bot_token) {
      console.error('[TELEGRAM WEBHOOK ERROR] Settings or Token not found:', settingsErr);
      return res.status(400).json({ 
        message: 'Missing telegram_bot_token in settings', 
        error: settingsErr ? settingsErr.message : 'Missing telegram_bot_token' 
      });
    }

    const botToken = settings.telegram_bot_token;
    const currentYear = settings?.current_academic_year || '2569';
    const rawApiKey = settings?.ai_cowork_api_key || settings?.gemini_api_key;
    let apiKey = '';
    if (rawApiKey) {
      if (rawApiKey.includes(',')) {
        const keys = rawApiKey.split(',').map((k: string) => k.trim()).filter(Boolean);
        apiKey = keys[Math.floor(Math.random() * keys.length)] || '';
      } else {
        apiKey = rawApiKey.trim();
      }
    }

    // --- 3. แกะ payload ที่ Telegram ส่งมา ---
    const update = req.body;
    const message = update?.message;
    const callbackQuery = update?.callback_query;

    // จัดการ callback_query (ปุ่มกดแบบ Inline Keyboard)
    if (callbackQuery) {
      const callbackData = callbackQuery.data;
      const callbackChatId = callbackQuery.message?.chat?.id;
      const userTelegramId = callbackQuery.from?.id;

      if (!callbackData || !callbackChatId || !userTelegramId) {
        return res.status(200).json({ ok: true });
      }

      // 2. ดึงข้อมูล Profile ของผู้กดปุ่มเพื่อตรวจสอบสิทธิ์
      const { data: profileLinked, error: linkErr } = await supabase
        .from('profiles')
        .select('id, display_name, role, signature_url, email')
        .eq('telegram_chat_id', String(userTelegramId))
        
        .maybeSingle();

      if (linkErr || !profileLinked) {
        await sendTelegramMessage(botToken, callbackChatId, '❌ ขออภัยค่ะ ชบาหาบัญชีที่ผูกกับ Telegram ของคุณครูไม่พบค่ะ กรุณาผูกบัญชีของท่านในระบบก่อนใช้งานฟังก์ชันนี้หน้าตู้ควบคุมนะคะ 🌸');
        return res.status(200).json({ ok: true });
      }

      // 3. แยก params วิเคราะห์ action
      const params = new URLSearchParams(callbackData);
      const action = params.get('action');

      if (action === 'noop') {
        await answerCallbackQuery(botToken, callbackQuery.id);
        return res.status(200).json({ ok: true });
      }

      if (action === 'start_assign') {
        const docId = params.get('id');
        if (profileLinked.role !== 'director' && profileLinked.role !== 'admin') {
          await answerCallbackQuery(botToken, callbackQuery.id, '❌ ขออภัยค่ะ ปุ่มนี้สำหรับผู้อำนวยการ/ผู้รักษาการเท่านั้นค่ะ 🌸', true);
          return res.status(200).json({ ok: true });
        }

        const { data: doc } = await supabase
          .from('incoming_docs')
          .select('subject, status')
          .eq('id', docId)
          .single();

        if (!doc) {
          await answerCallbackQuery(botToken, callbackQuery.id, '❌ ไม่พบข้อมูลหนังสือรับชิ้นนี้ในระบบค่ะ', true);
          return res.status(200).json({ ok: true });
        }

        // ป้องกันการทำซ้ำในขั้นตอนเกษียณหนังสือของ ผอ.
        if (doc.status && doc.status !== 'pending') {
          await answerCallbackQuery(botToken, callbackQuery.id, '⚠️ หนังสือรับฉบับนี้ได้รับการเกษียณสั่งการไปเรียบร้อยแล้วค่ะ', true);

          const completedMarkup = {
            inline_keyboard: [
              [
                { text: '🔒 เกษียณสั่งการแล้ว', callback_data: 'action=noop' }
              ]
            ]
          };
          await editTelegramMessageMarkup(botToken, callbackChatId, callbackQuery.message.message_id, completedMarkup);
          return res.status(200).json({ ok: true });
        }

        await answerCallbackQuery(botToken, callbackQuery.id);

        // ล้างสถานะเก่าของผู้ใช้นี้ออกก่อน จากนั้นเก็บ doc_id ลงใน Action State
        await supabase.from('line_action_states').delete().eq('user_id', `telegram:${userTelegramId}`);
        await supabase.from('line_action_states').insert([{
          user_id: `telegram:${userTelegramId}`,
          action: 'tg_assign_flow',
          context: { doc_id: docId },
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        }]);

        // ดึงรายชื่อคุณครู active ทั้งหมด
        const { data: teachers } = await supabase
          .from('teachers')
          .select('*')
          .eq('status', 'active')
          .order('first_name');

        if (!teachers || teachers.length === 0) {
          await sendTelegramMessage(botToken, callbackChatId, '❌ ไม่พบรายชื่อคุณครูในระบบสำหรับมอบหมายงานค่ะ');
          return res.status(200).json({ ok: true });
        }

        // สร้าง Inline Keyboard ปุ่มรายชื่อครู (2 คอลัมน์) โดยส่งค่าเพียงครู ID (เลี่ยงข้อจำกัด 64 bytes)
        const inlineKeyboard: any[] = [];
        for (let i = 0; i < teachers.length; i += 2) {
          const row: any[] = [];
          const t1 = teachers[i];
          const t2 = teachers[i + 1];
          
          row.push({
            text: `🧑‍🏫 ${t1.prefix || ''}${t1.first_name} ${t1.last_name.substring(0, 3)}.`,
            callback_data: `action=assign&t_id=${t1.id}`
          });
          
          if (t2) {
            row.push({
              text: `🧑‍🏫 ${t2.prefix || ''}${t2.first_name} ${t2.last_name.substring(0, 3)}.`,
              callback_data: `action=assign&t_id=${t2.id}`
            });
          }
          inlineKeyboard.push(row);
        }

        await sendTelegramMessage(
          botToken,
          callbackChatId,
          `🧑‍🏫 กรุณาเลือกคุณครูผู้รับมอบงานสำหรับเอกสารเรื่อง <b>"${doc.subject}"</b> ด้านล่างนี้ค่ะ:`,
          { inline_keyboard: inlineKeyboard }
        );

      } else if (action === 'assign') {
        await answerCallbackQuery(botToken, callbackQuery.id);
        const teacherId = params.get('t_id') || '';

        if (profileLinked.role !== 'director' && profileLinked.role !== 'admin') {
          await sendTelegramMessage(botToken, callbackChatId, '❌ ไม่มีสิทธิ์ดำเนินการค่ะ');
          return res.status(200).json({ ok: true });
        }

        // ค้นหา State ล่าสุดเพื่อดึง doc_id
        const { data: activeState } = await supabase
          .from('line_action_states')
          .select('*')
          .eq('user_id', `telegram:${userTelegramId}`)
          .eq('action', 'tg_assign_flow')
          .maybeSingle();

        if (!activeState || !activeState.context?.doc_id) {
          await sendTelegramMessage(botToken, callbackChatId, '❌ เซสชันการเกษียณสั่งการหมดอายุแล้วค่ะ กรุณากดปุ่มสั่งการใหม่อีกครั้งนะคะ');
          return res.status(200).json({ ok: true });
        }

        const docId = activeState.context.doc_id;

        // อัปเดตเพิ่ม teacher_id เข้าไปใน State
        await supabase
          .from('line_action_states')
          .update({
            context: { doc_id: docId, teacher_id: teacherId }
          })
          .eq('id', activeState.id);

        // แสดงตัวเลือกคำสั่งด่วน (ใช้ shortcodes ป้องกันความยาวปุ่มเกิน 64 bytes)
        const inlineKeyboard = [
          [{ text: 'สั่งการ: มอบดำเนินการ', callback_data: 'action=confirm_assign&ins=1' }],
          [{ text: 'สั่งการ: ทราบ/ถือปฏิบัติ', callback_data: 'action=confirm_assign&ins=2' }],
          [{ text: 'สั่งการ: ประสานงานต่อ', callback_data: 'action=confirm_assign&ins=3' }],
          [{ text: '✍️ พิมพ์ระบุคำสั่งเอง', callback_data: 'action=confirm_assign&ins=manual' }]
        ];

        await sendTelegramMessage(
          botToken,
          callbackChatId,
          '✍️ เลือกคำสั่งการเกษียณสั่งการหนังสือ หรือเลือกพิมพ์แบบเจาะจงเองด้านล่างค่ะ:',
          { inline_keyboard: inlineKeyboard }
        );

      } else if (action === 'confirm_assign') {
        await answerCallbackQuery(botToken, callbackQuery.id);
        const insCode = params.get('ins') || '1';

        if (profileLinked.role !== 'director' && profileLinked.role !== 'admin') {
          await sendTelegramMessage(botToken, callbackChatId, '❌ ไม่มีสิทธิ์ดำเนินการค่ะ');
          return res.status(200).json({ ok: true });
        }

        // ดึง State ล่าสุด
        const { data: activeState } = await supabase
          .from('line_action_states')
          .select('*')
          .eq('user_id', `telegram:${userTelegramId}`)
          .eq('action', 'tg_assign_flow')
          .maybeSingle();

        if (!activeState || !activeState.context?.doc_id || !activeState.context?.teacher_id) {
          await sendTelegramMessage(botToken, callbackChatId, '❌ เซสชันการเกษียณสั่งการหมดอายุแล้วค่ะ กรุณากดปุ่มสั่งการใหม่อีกครั้งนะคะ');
          return res.status(200).json({ ok: true });
        }

        const docId = activeState.context.doc_id;
        const teacherId = activeState.context.teacher_id;

        if (insCode === 'manual') {
          // เปลี่ยนสถานะเป็นรอพิมพ์คำสั่ง
          await supabase
            .from('line_action_states')
            .update({
              action: 'awaiting_assign_instruction',
              expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
            })
            .eq('id', activeState.id);
          await sendTelegramMessage(botToken, callbackChatId, '💬 กรุณาพิมพ์ข้อความคำสั่งการของคุณครูส่งเข้ามาในแชทนี้ได้เลยค่ะ 🌸');
        } else {
          // แปลง shortcode กลับเป็นคำสั่งการจริง
          let instruction = 'มอบดำเนินการ';
          if (insCode === '2') instruction = 'ทราบ/ถือปฏิบัติ';
          else if (insCode === '3') instruction = 'ประสานงานต่อ';

          // ลบ State ออกก่อนรันงานหลัก
          await supabase.from('line_action_states').delete().eq('id', activeState.id);
          await executeDocAssignment(docId, teacherId, instruction, botToken, callbackChatId, profileLinked, supabase);
        }
      } else if (action === 'bc_grp') {
        await answerCallbackQuery(botToken, callbackQuery.id);
        const assignId = params.get('id');
        const { data: assign } = await supabase
          .from('doc_assignments')
          .select('*, incoming_docs(subject, doc_number, file_url), teachers(prefix, first_name, last_name)')
          .eq('id', assignId)
          .single();

        if (assign) {
          const { data: settings } = await supabase
            .from('settings')
            .select('telegram_group_id')
            
            .maybeSingle();

          if (settings?.telegram_group_id) {
            const teacherName = `${assign.teachers?.prefix || ''}${assign.teachers?.first_name} ${assign.teachers?.last_name}`;
            const broadcastMsg = `📢 <b>ประชาสัมพันธ์ / แจ้งเพื่อทราบ</b>\n\n• <b>เรื่อง</b>: ${assign.incoming_docs?.subject}\n• <b>เลขที่หนังสือ</b>: ${assign.incoming_docs?.doc_number}\n• <b>ผู้รับมอบหมาย</b>: ${teacherName}\n• <b>คำสั่งการ/การดำเนินการ</b>: ${assign.instruction}\n\n📄 <a href="${assign.incoming_docs?.file_url}">เปิดดูเอกสารสั่งการที่ลงนามแล้ว</a>`;

            await sendTelegramMessage(botToken, settings.telegram_group_id, broadcastMsg);
            await sendTelegramMessage(botToken, callbackChatId, '✅ ได้ทำการประชาสัมพันธ์ข่าวสารเรื่องนี้เข้ากลุ่มกลางเรียบร้อยแล้วค่ะ 📢');
          } else {
            await sendTelegramMessage(botToken, callbackChatId, '⚠️ ไม่พบข้อมูลกลุ่มกลางในตารางตั้งค่าค่ะ กรุณาตั้งค่ากลุ่มกลางก่อนนะคะ');
          }
        }
      } else if (action === 'acknowledge') {
        const assignId = params.get('id');
        const { data: assign, error: assignErr } = await supabase
          .from('doc_assignments')
          .select('*, incoming_docs(subject)')
          .eq('id', assignId)
          .single();

        if (assignErr || !assign) {
          await answerCallbackQuery(botToken, callbackQuery.id, '❌ ไม่พบข้อมูลการมอบหมายงานนี้ในระบบค่ะ', true);
          return res.status(200).json({ ok: true });
        }

        // ป้องกันการทำซ้ำ
        if (assign.status !== 'pending') {
          let statusText = 'ได้รับทราบงานนี้ไปแล้ว';
          if (assign.status === 'completed') statusText = 'รายงานผลงานนี้ไปแล้ว';
          if (assign.status === 'closed') statusText = 'งานนี้ปิดเรียบร้อยแล้ว';
          
          await answerCallbackQuery(botToken, callbackQuery.id, `⚠️ คุณครู${statusText}ค่ะ`, true);

          const updatedMarkup = getUpdatedMarkupForStatus(assign.status, assignId || '');
          await editTelegramMessageMarkup(botToken, callbackChatId, callbackQuery.message.message_id, updatedMarkup);
          return res.status(200).json({ ok: true });
        }

        // อัปเดตสถานะเป็น acknowledged
        await supabase
          .from('doc_assignments')
          .update({ status: 'acknowledged' })
          .eq('id', assignId);

        await answerCallbackQuery(botToken, callbackQuery.id, '✅ รับทราบงานเรียบร้อยแล้วค่ะ');

        const docSubject = assign.incoming_docs?.subject || 'หนังสือสั่งการ';
        const teacherName = profileLinked.display_name || 'คุณครู';

        // ตอบกลับครู (ผู้กด) - แก้ไขปุ่มเดิมของข้อความ
        const teacherReplyMarkup = {
          inline_keyboard: [
            [
              { text: '📝 รายงานผลการปฏิบัติงาน', callback_data: `action=report&id=${assignId}` }
            ],
            [
              { text: '📢 ประชาสัมพันธ์ลงกลุ่มกลาง', callback_data: `action=bc_grp&id=${assignId}` }
            ]
          ]
        };
        await editTelegramMessageMarkup(botToken, callbackChatId, callbackQuery.message.message_id, teacherReplyMarkup);

        await sendTelegramMessage(
          botToken,
          callbackChatId,
          `✅ บันทึกการรับทราบงานเรื่อง "${docSubject}" เรียบร้อยแล้วค่ะ\nคุณครูสามารถกดรายงานผลการปฏิบัติงานจากปุ่มด้านบนได้เลยนะคะเมื่อดำเนินงานเสร็จ 🌸✨`
        );

        const sId = assign.incoming_docs?.school_id || schoolId;

        // แจ้งเตือนในกลุ่มกลาง Telegram
        const { data: settings } = await supabase
          .from('settings')
          .select('telegram_group_id')
          
          .maybeSingle();

        if (settings?.telegram_group_id) {
          await sendTelegramMessage(
            botToken,
            settings.telegram_group_id,
            `👍 คุณครู <b>${teacherName}</b> กดรับทราบงานเรื่อง <b>"${docSubject}"</b> เรียบร้อยแล้วค่ะ 🌸`
          );
        }

        // แจ้งเตือน ผอ. (หา ผอ. ของโรงเรียนนี้ที่มี telegram_chat_id)
        const { data: directors } = await supabase
          .from('profiles')
          .select('telegram_chat_id')
          .eq('role', 'director')
          ;

        if (directors) {
          for (const dir of directors) {
            if (dir.telegram_chat_id) {
              await sendTelegramMessage(
                botToken,
                parseInt(dir.telegram_chat_id),
                `👍 คุณครู <b>${teacherName}</b> กดรับทราบงานเรื่อง <b>"${docSubject}"</b> แล้วค่ะ`
              );
            }
          }
        }

      } else if (action === 'report') {
        const assignId = params.get('id');
        const { data: assign, error: assignErr } = await supabase
          .from('doc_assignments')
          .select('*, incoming_docs(subject)')
          .eq('id', assignId)
          .single();

        if (assignErr || !assign) {
          await answerCallbackQuery(botToken, callbackQuery.id, '❌ ไม่พบข้อมูลการมอบหมายงานในระบบค่ะ', true);
          return res.status(200).json({ ok: true });
        }

        // ป้องกันการทำซ้ำ
        if (assign.status === 'completed' || assign.status === 'closed') {
          let statusText = 'เคยรายงานผลงานนี้ไปแล้ว';
          if (assign.status === 'closed') statusText = 'งานนี้ปิดเรียบร้อยแล้ว';
          
          await answerCallbackQuery(botToken, callbackQuery.id, `⚠️ ${statusText}ค่ะ`, true);

          const updatedMarkup = getUpdatedMarkupForStatus(assign.status, assignId || '');
          await editTelegramMessageMarkup(botToken, callbackChatId, callbackQuery.message.message_id, updatedMarkup);
          return res.status(200).json({ ok: true });
        }

        await answerCallbackQuery(botToken, callbackQuery.id);

        // ล้างสถานะเก่าของผู้ใช้นี้ออกก่อน จากนั้นเก็บ state
        await supabase.from('line_action_states').delete().eq('user_id', `telegram:${userTelegramId}`);
        await supabase.from('line_action_states').insert([{
          user_id: `telegram:${userTelegramId}`,
          action: 'awaiting_report_text',
          context: { assignment_id: assignId },
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        }]);

        await sendTelegramMessage(
          botToken,
          callbackChatId,
          `✍️ กรุณาพิมพ์รายงานสรุปผลการดำเนินงานสำหรับเรื่อง <b>"${assign.incoming_docs?.subject}"</b> ส่งเข้ามาในห้องแชทนี้ได้เลยค่ะ ชบาจะนำไปบันทึกรายงานเสนอ ผอ. ทันที 🌸`
        );

      } else if (action === 'close') {
        const assignId = params.get('id');
        if (profileLinked.role !== 'director' && profileLinked.role !== 'admin') {
          await answerCallbackQuery(botToken, callbackQuery.id, '❌ สิทธิ์การปิดงานเป็นของผู้อำนวยการเท่านั้นค่ะ 🌸', true);
          return res.status(200).json({ ok: true });
        }

        const { data: assign, error: assignErr } = await supabase
          .from('doc_assignments')
          .select('*, incoming_docs(subject)')
          .eq('id', assignId)
          .single();

        if (assignErr || !assign) {
          await answerCallbackQuery(botToken, callbackQuery.id, '❌ ไม่พบชิ้นงานในระบบค่ะ', true);
          return res.status(200).json({ ok: true });
        }

        // ป้องกันการทำซ้ำ
        if (assign.status === 'closed') {
          await answerCallbackQuery(botToken, callbackQuery.id, '⚠️ งานนี้ได้รับการปิดงานไปเรียบร้อยแล้วค่ะ', true);
          
          const updatedMarkup = getUpdatedMarkupForStatus('closed', assignId || '');
          await editTelegramMessageMarkup(botToken, callbackChatId, callbackQuery.message.message_id, updatedMarkup);
          return res.status(200).json({ ok: true });
        }

        // อัปเดตสถานะเป็น closed และใส่เวลาปิด
        await supabase
          .from('doc_assignments')
          .update({ status: 'closed', closed_at: new Date().toISOString() })
          .eq('id', assignId);

        await answerCallbackQuery(botToken, callbackQuery.id, '✅ ดำเนินการทราบ/ปิดงานเรียบร้อยแล้วค่ะ');

        // อัปเดตปุ่มเดิมของ ผอ.
        const closedReplyMarkup = {
          inline_keyboard: [
            [
              { text: '🔒 งานนี้เสร็จสิ้นแล้ว (ทราบ/ปิดงาน)', callback_data: `action=noop` }
            ]
          ]
        };
        await editTelegramMessageMarkup(botToken, callbackChatId, callbackQuery.message.message_id, closedReplyMarkup);

        await sendTelegramMessage(botToken, callbackChatId, `✅ ได้ดำเนินการ "ทราบ/ปิดงาน" และส่งแจ้งคุณครูเรียบร้อยแล้วค่ะ 🌸`);

        // ค้นหาคุณครูและส่งแจ้งเตือน
        const { data: teacher } = await supabase
          .from('teachers')
          .select('email, prefix, first_name, last_name')
          .eq('id', assign.assignee_id)
          .maybeSingle();

        if (teacher) {
          const { data: teacherProfile } = await supabase
            .from('profiles')
            .select('telegram_chat_id')
            .eq('email', teacher.email)
            .maybeSingle();

          if (teacherProfile?.telegram_chat_id) {
            await sendTelegramMessage(
              botToken,
              parseInt(teacherProfile.telegram_chat_id),
              `🎉 ผู้อำนวยการได้รับทราบผลรายงานและสั่งการ "ทราบ/ปิดงาน" สำหรับงานเรื่อง <b>"${assign.incoming_docs?.subject}"</b> แล้วค่ะ ขอบคุณในการดำเนินงานและปิดจ๊อบนะคะคุณครู 🌸⚡`
            );
          }
        }

      } else if (action === 'feedback') {
        const assignId = params.get('id');
        if (profileLinked.role !== 'director' && profileLinked.role !== 'admin') {
          await answerCallbackQuery(botToken, callbackQuery.id, '❌ สิทธิ์การสั่งเพิ่มเติมเป็นของผู้อำนวยการเท่านั้นค่ะ 🌸', true);
          return res.status(200).json({ ok: true });
        }

        const { data: assign, error: assignErr } = await supabase
          .from('doc_assignments')
          .select('status')
          .eq('id', assignId)
          .single();

        if (assignErr || !assign) {
          await answerCallbackQuery(botToken, callbackQuery.id, '❌ ไม่พบข้อมูลการมอบหมายงานในระบบค่ะ', true);
          return res.status(200).json({ ok: true });
        }

        if (assign.status === 'closed') {
          await answerCallbackQuery(botToken, callbackQuery.id, '⚠️ ไม่สามารถสั่งการเพิ่มเติมได้เนื่องจากปิดงานไปแล้วค่ะ', true);
          
          const updatedMarkup = getUpdatedMarkupForStatus('closed', assignId || '');
          await editTelegramMessageMarkup(botToken, callbackChatId, callbackQuery.message.message_id, updatedMarkup);
          return res.status(200).json({ ok: true });
        }

        await answerCallbackQuery(botToken, callbackQuery.id);

        // แก้ปุ่ม ผอ. ให้เปลี่ยนเป็นปุ่มพิมพ์คำสั่งเพิ่มเติม
        const feedbackReplyMarkup = {
          inline_keyboard: [
            [
              { text: '💬 อยู่ระหว่างพิมพ์คำสั่งเพิ่มเติม...', callback_data: `action=noop` }
            ]
          ]
        };
        await editTelegramMessageMarkup(botToken, callbackChatId, callbackQuery.message.message_id, feedbackReplyMarkup);

        // ล้างสถานะเก่าของผู้ใช้นี้ออกก่อน จากนั้นเก็บ state
        await supabase.from('line_action_states').delete().eq('user_id', `telegram:${userTelegramId}`);
        await supabase.from('line_action_states').insert([{
          user_id: `telegram:${userTelegramId}`,
          action: 'awaiting_feedback_text',
          context: { assignment_id: assignId },
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        }]);

        await sendTelegramMessage(
          botToken,
          callbackChatId,
          `💬 กรุณาพิมพ์ข้อแนะนำหรือคำสั่งการเพิ่มเติมที่ต้องการให้คุณครูดำเนินการแก้ไข/ทำเพิ่มส่งมาได้เลยค่ะ 🌸`
        );
      } else if (action === 'approve_doc') {
        const type = params.get('type') || 'outgoing';
        const docId = params.get('id');

        if (profileLinked.role !== 'director' && profileLinked.role !== 'admin') {
          await answerCallbackQuery(botToken, callbackQuery.id, '❌ สิทธิ์การอนุมัติเป็นของผู้อำนวยการเท่านั้นค่ะ 🌸', true);
          return res.status(200).json({ ok: true });
        }

        try {
          let tableName = '';
          let numberColumn = '';
          let nameString = '';
          
          if (type === 'outgoing') { tableName = 'outgoing_docs'; numberColumn = 'doc_number'; nameString = 'หนังสือส่ง'; }
          else if (type === 'memo') { tableName = 'memos'; numberColumn = 'memo_number'; nameString = 'บันทึกข้อความ'; }
          else if (type === 'order') { tableName = 'orders'; numberColumn = 'order_number'; nameString = 'คำสั่งแต่งตั้ง'; }
          else {
            await answerCallbackQuery(botToken, callbackQuery.id, '❌ ประเภทเอกสารไม่ถูกต้องค่ะ', true);
            return res.status(200).json({ ok: true });
          }

          // 1. ดึงข้อมูลเอกสาร
          const { data: doc, error: docErr } = await supabase
            .from(tableName)
            .select('*')
            .eq('id', docId)
            .single();

          if (docErr || !doc) {
            await answerCallbackQuery(botToken, callbackQuery.id, `❌ ไม่พบข้อมูล${nameString}ในระบบค่ะ`, true);
            return res.status(200).json({ ok: true });
          }

          // ตรวจสอบความซ้ำซ้อน หากอนุมัติไปแล้ว
          if (doc.status === 'approved') {
            await answerCallbackQuery(botToken, callbackQuery.id, `⚠️ ${nameString}นี้ได้รับการอนุมัติลงนามไปแล้วค่ะ`, true);
            const approvedMarkup = {
              inline_keyboard: [[{ text: `🔒 อนุมัติลงนามแล้ว`, callback_data: 'action=noop' }]]
            };
            await editTelegramMessageMarkup(botToken, callbackChatId, callbackQuery.message.message_id, approvedMarkup);
            return res.status(200).json({ ok: true });
          }

          let finalNumber = doc[numberColumn];
          let docYear = doc.doc_year;
          let docSeq = doc.doc_sequence;

          // สำหรับคำสั่งแต่งตั้ง (รันเลขอัตโนมัติ หากยังไม่ได้รับอนุมัติ)
          if (type === 'order' && (finalNumber === 'รออนุมัติ' || !finalNumber)) {
            const orderDateObj = new Date(doc.order_date || new Date());
            docYear = orderDateObj.getFullYear() + 543;
            
            const { data: seqDocs } = await supabase
              .from('orders')
              .select('doc_sequence')
              .eq('doc_year', docYear)
              .order('doc_sequence', { ascending: false })
              .limit(1);
              
            docSeq = (seqDocs && seqDocs.length > 0) ? (seqDocs[0].doc_sequence + 1) : 1;
            finalNumber = `${docSeq}/${docYear}`;
          }

          // 2. อัปเดตสถานะและเลขทะเบียนในฐานข้อมูล
          const updateObj: any = { status: 'approved' };
          if (type === 'order') {
            updateObj.order_number = finalNumber;
            updateObj.doc_year = docYear;
            updateObj.doc_sequence = docSeq;
          }

          const { error: updateErr } = await supabase
            .from(tableName)
            .update(updateObj)
            .eq('id', docId);

          if (updateErr) throw updateErr;

          await answerCallbackQuery(botToken, callbackQuery.id, `✅ ทำการอนุมัติและลงนามเรียบร้อยค่ะ`, false);

          // อัปเดตปุ่มเดิมของ ผอ.
          const approvedMarkup = {
            inline_keyboard: [[{ text: `🔒 อนุมัติลงนามแล้ว`, callback_data: 'action=noop' }]]
          };
          await editTelegramMessageMarkup(botToken, callbackChatId, callbackQuery.message.message_id, approvedMarkup);

          // แจ้งข้อความยืนยันหา ผอ.
          await sendTelegramMessage(botToken, callbackChatId, `✅ ทำการอนุมัติและลงนามอิเล็กทรอนิกส์ใน${nameString} เรื่อง <b>"${doc.subject}"</b> เรียบร้อยแล้วค่ะ 🌸`);

          // 3. แจ้งเตือนครูผู้สร้าง/ผู้เสนอ
          if (doc.created_by) {
            const { data: creator } = await supabase
              .from('profiles')
              .select('telegram_chat_id')
              .eq('id', doc.created_by)
              .maybeSingle();

            if (creator?.telegram_chat_id) {
              await sendTelegramMessage(
                botToken,
                parseInt(creator.telegram_chat_id),
                `✅ <b>แจ้งเตือนอนุมัติเอกสาร</b>\n\nยินดีด้วยค่ะ! ผู้อำนวยการได้อนุมัติและลงนามใน${nameString} เรื่อง <b>"${doc.subject}"</b> ของคุณครูเรียบร้อยแล้วนะคะ 🌸✨`
              );
            }
          }

        } catch (err: any) {
          console.error('handleApproveDoc error:', err);
          await answerCallbackQuery(botToken, callbackQuery.id, `❌ เกิดข้อผิดพลาดในการอนุมัติ: ${err.message}`, true);
        }

      } else if (action === 'reject_doc') {
        const type = params.get('type') || 'outgoing';
        const docId = params.get('id');

        if (profileLinked.role !== 'director' && profileLinked.role !== 'admin') {
          await answerCallbackQuery(botToken, callbackQuery.id, '❌ สิทธิ์การปฏิเสธงานเป็นของผู้อำนวยการเท่านั้นค่ะ 🌸', true);
          return res.status(200).json({ ok: true });
        }

        try {
          await answerCallbackQuery(botToken, callbackQuery.id);

          // อัปเดตปุ่มเดิมให้ ผอ.
          const progressMarkup = {
            inline_keyboard: [[{ text: `💬 อยู่ระหว่างพิมพ์เหตุผลแก้ไข...`, callback_data: 'action=noop' }]]
          };
          await editTelegramMessageMarkup(botToken, callbackChatId, callbackQuery.message.message_id, progressMarkup);

          // บันทึกสถานะเพื่อรอเหตุผล (หมดอายุใน 15 นาที)
          await supabase.from('line_action_states').delete().eq('user_id', `telegram:${userTelegramId}`);
          await supabase.from('line_action_states').insert([{
            user_id: `telegram:${userTelegramId}`,
            action: 'awaiting_doc_reject_reason',
            context: { type, id: docId },
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
          }]);

          await sendTelegramMessage(
            botToken,
            callbackChatId,
            `💬 กรุณาพิมพ์เหตุผลการส่งกลับ หรือจุดที่ต้องแก้ไขส่งเข้ามาในแชทนี้ เพื่อแจ้งแก่คุณครูผู้ร่างคำเสนอได้เลยค่ะ 🌸`
          );

        } catch (err: any) {
          console.error('handleRejectDoc error:', err);
          await answerCallbackQuery(botToken, callbackQuery.id, `❌ ไม่สามารถทำรายการได้: ${err.message}`, true);
        }
      }

      return res.status(200).json({ ok: true });
    }

    // หากไม่มีข้อความหรือแชทไอดี ไม่ประมวลผลต่อ
    if (!message?.text || !message?.chat?.id) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const rawText = message.text.trim();
    const userTelegramId = message.from?.id;

    // ดักรับคำสั่งหา Chat ID / Group ID ทันทีเพื่อความสะดวกของคุณครู
    const lowerText = rawText.toLowerCase();
    if (lowerText.startsWith('/id') || lowerText.startsWith('/groupid')) {
      await sendTelegramMessage(
        botToken,
        chatId,
        `🆔 <b>รหัสแชทนี้ (Chat ID):</b> <code>${chatId}</code>\n\n*(คุณครูสามารถคัดลอกเลขตัวนี้ไปกรอกในระบบได้เลยค่ะ)*`
      );
      return res.status(200).json({ ok: true });
    }

    // --- 4. ดำเนินการผูกบัญชีด้วย Deep Linking (/start auth_<base64_email>) ---
    if (rawText.startsWith('/start ')) {
      const authToken = rawText.replace('/start ', '').trim();
      
      if (!authToken.startsWith('auth_')) {
        await sendTelegramMessage(botToken, chatId, '❌ รูปแบบลิงก์การผูกบัญชีไม่ถูกต้อง กรุณากดปุ่มผูกบัญชีจากในระบบใหม่อีกครั้ง');
        return res.status(200).json({ ok: true });
      }

      const base64Part = authToken.replace('auth_', '');
      let email = '';
      try {
        email = Buffer.from(base64Part, 'base64').toString('utf-8');
      } catch (decodeErr) {
        await sendTelegramMessage(botToken, chatId, '❌ ไม่สามารถถอดรหัสข้อมูลการผูกบัญชีได้ กรุณาลองใหม่อีกครั้ง');
        return res.status(200).json({ ok: true });
      }

      if (!email || !email.includes('@')) {
        await sendTelegramMessage(botToken, chatId, '❌ ข้อมูลอีเมลในการผูกบัญชีไม่ถูกต้อง');
        return res.status(200).json({ ok: true });
      }

      // ค้นหาโปรไฟล์คุณครูจากอีเมลและรหัสโรงเรียน
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('email', email.toLowerCase().trim())
        
        .maybeSingle();

      if (profileErr || !profile) {
        console.error('[TELEGRAM WEBHOOK LINKING ERROR]', profileErr);
        await sendTelegramMessage(
          botToken, 
          chatId, 
          `❌ ไม่พบบัญชีผู้ใช้ที่มีอีเมล <b>${email}</b> ในระบบของโรงเรียนนี้ กรุณาลงทะเบียนบัญชีผู้ใช้ในระบบสารบรรณก่อน`
        );
        return res.status(200).json({ ok: true });
      }

      // อัปเดต telegram_chat_id ลงในตาราง profiles ของครูผู้ใช้รายนั้น
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ telegram_chat_id: String(chatId) })
        .eq('id', profile.id);

      if (updateErr) {
        console.error('[TELEGRAM WEBHOOK UPDATE ERROR]', updateErr);
        await sendTelegramMessage(botToken, chatId, '❌ ระบบไม่สามารถบันทึกข้อมูลได้ชั่วคราว กรุณาติดต่อผู้ดูแลระบบ');
        return res.status(200).json({ ok: true });
      }

      const name = profile.display_name || 'คุณครู';
      await sendTelegramMessage(
        botToken,
        chatId,
        `🎉 <b>ผูกบัญชีสำเร็จเรียบร้อย!</b>\n\nยินดีต้อนรับคุณครู <b>${name}</b> เข้าสู่ระบบการแจ้งเตือนสารบรรณผ่าน Telegram\nระบบจะส่งข้อความแจ้งเตือนคำสั่ง, มอบหมายงาน และเอกสารราชการต่างๆ มายังห้องแชทนี้โดยตรงอัตโนมัติค่ะ 📬`
      );
      return res.status(200).json({ ok: true });
    }

    // --- 5. ตอบกลับข้อความทั่วไป ---
    // ตรวจสอบว่าแชทไอดีนี้ผูกบัญชีไว้กับโรงเรียนนี้แล้วหรือยัง
    const { data: profileLinked, error: linkErr } = await supabase
      .from('profiles')
      .select('id, display_name, role, email')
      .eq('telegram_chat_id', String(userTelegramId))
      
      .maybeSingle();

    if (linkErr || !profileLinked) {
      await sendTelegramMessage(
        botToken,
        chatId,
        '🔗 <b>แชทนี้ยังไม่ได้เชื่อมต่อระบบสารบรรณ</b>\n\nกรุณาเข้าสู่ระบบสารบรรณโรงเรียนบนเว็บไซต์หรือคอมพิวเตอร์ จากนั้นไปที่หน้า "โปรไฟล์ส่วนตัว" และกดปุ่ม <b>"ผูกบัญชี Telegram"</b> เพื่อเปิดระบบแจ้งเตือนค่ะ'
      );
      return res.status(200).json({ ok: true });
    }

    // ตรวจสอบสถานะการพิมพ์ข้อความสั่งการ/รายงานผล (Stateful Conversation)
    const { data: activeState } = await supabase
      .from('line_action_states')
      .select('*')
      .eq('user_id', `telegram:${userTelegramId}`)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeState) {
      if (activeState.action === 'awaiting_assign_instruction') {
        const { doc_id, teacher_id } = activeState.context || {};
        await supabase.from('line_action_states').delete().eq('id', activeState.id);
        await executeDocAssignment(doc_id, teacher_id, rawText, botToken, chatId, profileLinked, supabase);
        return res.status(200).json({ ok: true });
      } else if (activeState.action === 'awaiting_report_text') {
        const { assignment_id } = activeState.context || {};
        await supabase.from('line_action_states').delete().eq('id', activeState.id);

        const { data: assign, error: assignErr } = await supabase
          .from('doc_assignments')
          .select('*, incoming_docs(subject)')
          .eq('id', assignment_id)
          .single();

        if (assignErr || !assign) {
          await sendTelegramMessage(botToken, chatId, '❌ ไม่พบข้อมูลการมอบหมายงานนี้ในระบบค่ะ');
          return res.status(200).json({ ok: true });
        }

        const sId = assign.incoming_docs?.school_id || schoolId;

        // อัปเดตสถานะเป็น completed และบันทึกรายงานผล
        await supabase
          .from('doc_assignments')
          .update({
            status: 'completed',
            staff_report: rawText,
            reported_at: new Date().toISOString()
          })
          .eq('id', assignment_id);

        await sendTelegramMessage(
          botToken,
          chatId,
          `✅ บันทึกคำรายงานผลและส่งมอบงานเรื่อง <b>"${assign.incoming_docs?.subject}"</b> เสนอผู้อำนวยการเรียบร้อยแล้วค่ะ ขอบคุณมากนะคะคุณครู 🌸`
        );

        // ค้นหา ผอ. โรงเรียนเพื่อส่งรายงาน
        const { data: directors } = await supabase
          .from('profiles')
          .select('telegram_chat_id')
          .eq('role', 'director')
          ;

        const docSubject = assign.incoming_docs?.subject || 'งานที่มอบหมาย';
        const teacherName = profileLinked.display_name || 'คุณครู';
        const dirMessage = `📊 คุณครู <b>${teacherName}</b> ได้รายงานผลงาน\n<b>เรื่อง</b>: ${docSubject}\n\n<b>ผลงาน</b>: "${rawText}"`;

        const dirReplyMarkup = {
          inline_keyboard: [
            [
              { text: '✅ ทราบ/ปิดงาน', callback_data: `action=close&id=${assignment_id}` },
              { text: '💬 สั่งเพิ่มเติม', callback_data: `action=feedback&id=${assignment_id}` }
            ]
          ]
        };

        if (directors) {
          for (const dir of directors) {
            if (dir.telegram_chat_id) {
              await sendTelegramMessage(
                botToken,
                parseInt(dir.telegram_chat_id),
                dirMessage,
                dirReplyMarkup
              );
            }
          }
        }
        return res.status(200).json({ ok: true });

      } else if (activeState.action === 'awaiting_feedback_text') {
        const { assignment_id } = activeState.context || {};
        await supabase.from('line_action_states').delete().eq('id', activeState.id);

        const { data: assign, error: assignErr } = await supabase
          .from('doc_assignments')
          .select('*, incoming_docs(subject), assignee_id')
          .eq('id', assignment_id)
          .single();

        if (assignErr || !assign) {
          await sendTelegramMessage(botToken, chatId, '❌ ไม่พบข้อมูลการมอบหมายงานนี้ในระบบค่ะ');
          return res.status(200).json({ ok: true });
        }

        const sId = assign.incoming_docs?.school_id || schoolId;

        // อัปเดต feedback ผอ. และถอยสถานะกลับไปเป็น acknowledged
        await supabase
          .from('doc_assignments')
          .update({
            status: 'acknowledged',
            director_feedback: rawText
          })
          .eq('id', assignment_id);

        await sendTelegramMessage(botToken, chatId, `✅ บันทึกคำสั่งการเพิ่มเติมเรียบร้อยและส่งแจ้งคุณครูเรียบร้อยแล้วค่ะ 🌸`);

        // ค้นหาคุณครูและส่งแจ้งเตือน
        const { data: teacher } = await supabase
          .from('teachers')
          .select('email, prefix, first_name, last_name')
          .eq('id', assign.assignee_id)
          .maybeSingle();

        if (teacher) {
          const { data: teacherProfile } = await supabase
            .from('profiles')
            .select('telegram_chat_id')
            .eq('email', teacher.email)
            .maybeSingle();

          if (teacherProfile?.telegram_chat_id) {
            const docSubject = assign.incoming_docs?.subject || 'งานที่มอบหมาย';
            const teacherMsg = `📌 ผอ. มีคำแนะนำ/สั่งการเพิ่มเติม\n<b>เรื่อง</b>: ${docSubject}\n\n<b>คำสั่ง ผอ.</b>: "${rawText}"\n\nรบกวนคุณครูดำเนินการเพิ่มเติม และรายงานผลส่งกลับอีกครั้งเมื่อเสร็จงานนะคะ 🌸`;
            
            const teacherReplyMarkup = {
              inline_keyboard: [
                [
                  { text: '📝 รายงานผลใหม่', callback_data: `action=report&id=${assignment_id}` }
                ]
              ]
            };

            await sendTelegramMessage(
              botToken,
              parseInt(teacherProfile.telegram_chat_id),
              teacherMsg,
              teacherReplyMarkup
            );
          }
        }
        return res.status(200).json({ ok: true });

      } else if (activeState.action === 'awaiting_doc_reject_reason') {
        const { type, id } = activeState.context || {};
        await supabase.from('line_action_states').delete().eq('id', activeState.id);

        let tableName = '';
        let nameString = '';
        if (type === 'outgoing') { tableName = 'outgoing_docs'; nameString = 'หนังสือส่ง'; }
        else if (type === 'memo') { tableName = 'memos'; nameString = 'บันทึกข้อความ'; }
        else if (type === 'order') { tableName = 'orders'; nameString = 'คำสั่งแต่งตั้ง'; }
        else {
          await sendTelegramMessage(botToken, chatId, '❌ ประเภทเอกสารไม่ถูกต้องค่ะ');
          return res.status(200).json({ ok: true });
        }

        // 1. ดึงข้อมูลเอกสาร
        const { data: doc, error: docErr } = await supabase
          .from(tableName)
          .select('*')
          .eq('id', id)
          .single();

        if (docErr || !doc) {
          await sendTelegramMessage(botToken, chatId, '❌ ไม่พบข้อมูลเอกสารในระบบค่ะ');
          return res.status(200).json({ ok: true });
        }

        // 2. อัปเดตสถานะและเหตุผลส่งกลับ
        let remarkObj: any = {};
        try {
          remarkObj = typeof doc.remark === 'object' ? doc.remark : JSON.parse(doc.remark || '{}');
        } catch (e) { remarkObj = {}; }

        remarkObj.director_opinion = rawText;
        remarkObj.director_decision = 'ส่งกลับแก้ไข';
        remarkObj.approved_date = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

        await supabase
          .from(tableName)
          .update({
            status: 'rejected',
            remark: JSON.stringify(remarkObj)
          })
          .eq('id', id);

        await sendTelegramMessage(
          botToken,
          chatId,
          `✅ ทำการปฏิเสธ/ส่งแก้ไข ${nameString} เรื่อง <b>"${doc.subject}"</b> และส่งเหตุผลคืนคุณครูผู้ร่างเรียบร้อยแล้วค่ะ 🌸`
        );

        // 3. แจ้งเตือนครูผู้ร่าง
        if (doc.created_by) {
          const { data: creator } = await supabase
            .from('profiles')
            .select('telegram_chat_id')
            .eq('id', doc.created_by)
            .maybeSingle();

          if (creator?.telegram_chat_id) {
            await sendTelegramMessage(
              botToken,
              parseInt(creator.telegram_chat_id),
              `❌ <b>แจ้งเตือนส่งกลับแก้ไขเอกสาร</b>\n\n${nameString} เรื่อง <b>"${doc.subject}"</b> ได้ถูกส่งกลับแก้ไข\n\n💬 <b>เหตุผลของ ผอ.:</b> "${rawText}"\n\nรบกวนคุณครูช่วยตรวจสอบและเข้าไปทำการแก้ไขบนหน้าเว็บโรงเรียนนะคะ 🙇‍♀️🌸`
            );
          }
        }
        return res.status(200).json({ ok: true });
      }
    }

    // จัดการข้อความสนทนาทั่วไป
    const isGroup = chatId < 0;
    const botMention = settings.telegram_bot_username ? `@${settings.telegram_bot_username}` : `@${settings.telegram_bot_token?.split(':')[0] || 'ChabaSchoolBot'}`;
    const isMentioned = !isGroup || rawText.includes(botMention) || rawText.includes('ชบา') || rawText.includes('น้องชบา');

    if (isGroup && !isMentioned) {
      // อยู่ในกลุ่มแต่ไม่ได้กล่าวถึงบอท ไม่ตอบเพื่อประหยัดโควตาและลดความรำคาญ
      return res.status(200).json({ ok: true });
    }

    // จัดการข้อความ (ล้าง mention ออกเพื่อให้ AI ตอบได้ดีขึ้น)
    const cleanedText = rawText.replace(new RegExp(botMention, 'g'), '').trim();

    try {
      // 1. Smart Data Fetch — ดึงข้อมูลจริงจากฐานข้อมูลตามหมวดคำถาม
      const contextData = await smartFetchContext(cleanedText, currentYear, supabase, schoolId, profileLinked);
      console.log(`[TELEGRAM WEBHOOK] Context Data size: ${contextData.length} chars`);

      // 2. นับจำนวนบุคลากร
      const { count: staffCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        ;

      if (apiKey) {
        // --- โหมด AI อัจฉริยะ (Jarvis Mode V2 with Strict Rules) ---
        const systemPrompt = `คุณคือ "น้องชบา AI" ผู้ช่วยอัจฉริยะระบบงานธุรการและสารบรรณของ ${settings.school_name || 'โรงเรียน'} (ห้ามใช้คำว่า AI Cowork หรือ AI เด็ดขาด)
ลักษณะนิสัย: สุภาพ อ่อนน้อม ใช้ "ค่ะ/นะคะ" แทนตัวว่า "ชบา" หรือ "หนู" (ห้ามใช้หางเสียง "ครับ" หรือคำพูดเชิงผู้ชายเด็ดขาด)
คล้ายกับบอท J.A.R.V.I.S. ในไอรอนแมน (ผู้ช่วยสมองกลอัจฉริยะ)

กฎเหล็ก:
- ตอบเฉพาะ "คำตอบสุดท้ายที่จะส่งให้ครู" โดยใส่ไว้ในแท็ก <ans>...</ans> เท่านั้น
- ห้ามพิมพ์ขั้นตอนการคิด (Thinking), ห้ามทวนคำถาม, ห้ามเกริ่นนำใดๆ นอกแท็ก <ans>
- ห้ามจินตนาการ ห้ามสร้าง คาดเดา หรือสมมติข้อมูลใดๆ เช่น ชื่อคน ชื่อโครงการ วันที่ หรือตัวเลขขึ้นมาเองโดยเด็ดขาด หากข้อมูลไม่อยู่ใน "ข้อมูลฐานข้อมูลโรงเรียน" ที่ส่งมา ให้ตอบอย่างสุภาพว่าไม่พบข้อมูลดังกล่าวในระบบ
- ให้ใช้รูปแบบ HTML สำหรับ Telegram ในการจัดรูปแบบข้อความเท่านั้น **ห้ามใช้รูปแบบ Markdown (เช่น ห้ามใช้ ** หรือ [ข้อความ](ลิงก์) เด็ดขาด)**:
  * ใช้ <b>ข้อความตัวหนา</b> สำหรับตัวหนา (เช่น <b>เรื่อง:</b> หรือ <b>รายละเอียด:</b>)
  * ใช้ <i>ข้อความตัวเอียง</i> สำหรับตัวเอียง
  * ใช้ <code>รหัส</code> สำหรับข้อความโค้ดหรือ ID
- การจัดรูปแบบลิงก์ (สำคัญมาก):
  * ห้ามแสดงลิงก์ URL ยาวๆ แบบดิบ และห้ามใช้วงเล็บลิงก์แบบ Markdown [ลิงก์](URL) เด็ดขาด
  * ให้แปลงเป็นลิงก์ HTML สวยงามโดยใช้แท็ก <a href="URL">ข้อความอ้างอิงสวยงามเป็นภาษาไทย</a> เสมอ เช่น <a href="file_url">🔗 ดาวน์โหลดหนังสือนำส่งหลัก</a> หรือ <a href="attachment_url">📎 เปิดเอกสารแนบ</a>
- การแยกแยะไฟล์ของหนังสือรับ (incoming_docs):
  * "หนังสือนำส่งหลัก" ใช้ลิงก์จาก file_url
  * "ไฟล์แนบ" หรือ "สิ่งที่ส่งมาด้วย" ใช้ลิงก์จาก attachment_urls
- ห้ามใช้สัญลักษณ์ดอกจันเดี่ยว (*) ในการทำ Bullet point ให้ใช้ "•" หรือ "-" แทน
- ใช้ Emoji ให้ดูเป็นมิตร เว้นบรรทัดให้อ่านง่าย
- ห้ามใช้ Markdown Table ให้ใช้ Bullet points แทน

ข้อมูลคุณครูผู้คุยกับคุณ:
- ชื่อ: ${profileLinked.display_name}
- บทบาท: ${profileLinked.role === 'director' ? 'ผู้อำนวยการโรงเรียน' : profileLinked.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'คุณครูผู้ปฏิบัติงาน'}
- จำนวนบุคลากรในระบบ: ${staffCount || 0} คน`;

        const userPrompt = `ข้อมูลฐานข้อมูลโรงเรียน: ${contextData || 'ไม่พบข้อมูลที่เกี่ยวข้องในฐานข้อมูล'}\nปีการศึกษา: ${currentYear}\nคำถามของคุณครู: "${cleanedText}"\nกรุณาตอบในแท็ก <ans> ให้ชบาหน่อยนะคะ`;

        const rawResponse = await callGemini(systemPrompt, userPrompt, apiKey);

          if (rawResponse) {
            // 3. Answer Extraction — สกัดคำตอบจากแท็ก <ans>...</ans>
            let finalAnswer = "";
            const matchComplete = rawResponse.match(/<ans>([\s\S]*?)<\/ans>/);
            if (matchComplete && matchComplete[1]) {
              finalAnswer = matchComplete[1].trim();
            } else {
              const startIdx = rawResponse.indexOf('<ans>');
              if (startIdx !== -1) {
                let content = rawResponse.substring(startIdx + 5).trim();
                content = content.replace(/<\/?a(n(s)?)?$/i, '').trim();
                finalAnswer = content;
              } else {
                finalAnswer = rawResponse;
              }
            }

            // 4. Answer Polish — ทำความสะอาดคำตอบ
            finalAnswer = finalAnswer
              .replace(/AI Cowork/gi, 'น้องชบา')
              .replace(/ครับ/g, 'ค่ะ')
              .replace(/^\s*\*\s+/gm, '• ')
              .split('\n')
              .filter(line => !line.match(/^\s*(\*|-)?\s*(Identity|Role|User|Context|Input|Logic|Drafting|Winner|Step|Goal|Strict|Formatting|Section|Check|Evaluation|Actionable|Final|Plan|Result).*?:/i))
              .join('\n')
              .trim();

            if (finalAnswer) {
              let replyMarkup: any = undefined;
              const isReportIntent = ['งานค้าง', 'งานของฉัน', 'ยังไม่ได้ส่ง', 'ยังไม่ได้รายงาน', 'งานที่มอบหมายค้าง', 'รายงานผล', 'ส่งรายงาน', 'ส่งงาน'].some(k => cleanedText.includes(k));
              
              // ค้นหา ID หนังสือรับทั้งหมดใน contextData (สกัดแบบอิสระ ไม่จำกัดเฉพาะ pending เพื่อให้บริการปุ่มดูเอกสารแก่ครูทุกคน)
              const docMatches = contextData.match(/"id":"([a-f0-9-]{36})"/g);
              if (docMatches) {
                const inlineKeyboard: any[] = [];
                const addedIds = new Set<string>();
                
                for (const match of docMatches) {
                  const idMatch = match.match(/"id":"([a-f0-9-]{36})"/);
                  if (idMatch && idMatch[1] && !addedIds.has(idMatch[1])) {
                    const docId = idMatch[1];
                    addedIds.add(docId);
                    
                    const docBlockMatch = contextData.match(new RegExp(`\\{[^\\{]*?"id":"${docId}".*?\\}`));
                    if (docBlockMatch && docBlockMatch[0]) {
                      let docNum = '';
                      let status = '';
                      let fileUrl = '';
                      let attachmentUrls: string[] = [];
                      
                      const numMatch = docBlockMatch[0].match(/"doc_number":"(.*?)"/);
                      if (numMatch && numMatch[1]) docNum = numMatch[1];
                      
                      const statusMatch = docBlockMatch[0].match(/"status":"(.*?)"/);
                      if (statusMatch && statusMatch[1]) status = statusMatch[1];
                      
                      const fileMatch = docBlockMatch[0].match(/"file_url":"(.*?)"/);
                      if (fileMatch && fileMatch[1]) fileUrl = fileMatch[1];
                      
                      const attachMatch = docBlockMatch[0].match(/"attachment_urls":(\[.*?\])/);
                      if (attachMatch && attachMatch[1]) {
                        try {
                          attachmentUrls = JSON.parse(attachMatch[1]);
                        } catch (e) {}
                      }
                      
                      // 1. สร้างแถวปุ่มสำหรับ เปิดดูเอกสาร และ สิ่งที่ส่งมาด้วย (ครูทุกคนกดดูได้)
                      const rowButtons: any[] = [];
                      if (fileUrl) {
                        rowButtons.push({ text: `📄 ดูต้นฉบับ ${docNum ? `(${docNum})` : ''}`, url: fileUrl });
                      }
                      
                      if (attachmentUrls && attachmentUrls.length > 0) {
                        attachmentUrls.forEach((url, idx) => {
                          if (url && (url.startsWith('http') || url.startsWith('https'))) {
                            rowButtons.push({ text: `📎 แนบ ${idx + 1}`, url: url });
                          }
                        });
                      }
                      
                      if (rowButtons.length > 0) {
                        inlineKeyboard.push(rowButtons);
                      }
                      
                      // 2. ถ้าผู้ใช้มีสิทธิ์เป็น ผอ./แอดมิน และหนังสือยังไม่ได้เกษียณ (status === 'pending') และไม่ได้ต้องการรายงานผล -> แนบปุ่มเกษียณสั่งการเพิ่มขึ้นมาในแถวถัดไป
                      if ((profileLinked.role === 'director' || profileLinked.role === 'admin') && status === 'pending' && !isReportIntent) {
                        inlineKeyboard.push([
                          { text: `✍️ เกษียณสั่งการหนังสือ เลขที่ ${docNum || ''}`, callback_data: `action=start_assign&id=${docId}` }
                        ]);
                      }
                    }
                  }
                }
                
                if (inlineKeyboard.length > 0) {
                  replyMarkup = { inline_keyboard: inlineKeyboard };
                }
              }
              
              // 2. ค้นหา ID ของการมอบหมายงาน (doc_assignments) ใน contextData เพื่อสร้างปุ่มรายงานผล (เฉพาะงานของครูท่านนั้น)
              const assignMatches = contextData.match(/"id":"([a-f0-9-]{36})".*?"status":"(acknowledged|pending)"/g);
              if (assignMatches) {
                const inlineKeyboard: any[] = replyMarkup?.inline_keyboard || [];
                const addedAssignIds = new Set<string>();
                
                for (const match of assignMatches) {
                  const idMatch = match.match(/"id":"([a-f0-9-]{36})"/);
                  if (idMatch && idMatch[1] && !addedAssignIds.has(idMatch[1])) {
                    const assignId = idMatch[1];
                    addedAssignIds.add(assignId);
                    
                    const assignBlockMatch = contextData.match(new RegExp(`\\{[^\\{]*?"id":"${assignId}".*?\\}`));
                    if (assignBlockMatch && assignBlockMatch[0]) {
                      let docNum = '';
                      const docBlockMatch = assignBlockMatch[0].match(/"incoming_docs":\{.*?\}/);
                      if (docBlockMatch && docBlockMatch[0]) {
                        const numMatch = docBlockMatch[0].match(/"doc_number":"(.*?)"/);
                        if (numMatch && numMatch[1]) docNum = numMatch[1];
                      }
                      if (!docNum) {
                        const numDirectMatch = assignBlockMatch[0].match(/"doc_number":"(.*?)"/);
                        if (numDirectMatch && numDirectMatch[1]) docNum = numDirectMatch[1];
                      }
                      
                      inlineKeyboard.push([
                        { text: `📝 รายงานผลงาน เลขที่ ${docNum || ''}`, callback_data: `action=report&id=${assignId}` }
                      ]);
                    }
                  }
                }
                
                if (inlineKeyboard.length > 0) {
                  replyMarkup = { inline_keyboard: inlineKeyboard };
                }
              }
              
              await sendTelegramMessage(botToken, chatId, finalAnswer, replyMarkup);
            } else {
              await sendTelegramMessage(botToken, chatId, `📬 สวัสดีค่ะคุณครู <b>${profileLinked.display_name || ''}</b>\nขณะนี้ระบบพร้อมใช้งานแจ้งเตือนหนังสือราชการและงานสารบรรณแล้วค่ะ หากมีคำสั่งหรือการมอบหมายงานใหม่ ระบบจะทักมาโดยอัตโนมัติค่ะ`);
            }
          } else if (contextData) {
            // Fallback: หาก AI ล่ม แต่มีข้อมูลจาก DB → ส่งข้อมูลดิบกลับ
            const fallbackMsg = `📊 ชบาขอส่งข้อมูลโดยตรงจากฐานข้อมูลให้ดังนี้นะคะ:\n\n${contextData.substring(0, 3500)}`;
            await sendTelegramMessage(botToken, chatId, fallbackMsg);
          } else {
            await sendTelegramMessage(botToken, chatId, `ขออภัยนะคะคุณครู ตอนนี้ระบบสมองของชบามีการเชื่อมต่อขัดข้องชั่วคราวค่ะ รบกวนลองใหม่อีกครั้งในภายหลังนะคะ 🙏🌸`);
          }
        } else if (contextData) {
          // --- โหมดไม่มี API Key แต่มีข้อมูลจาก DB ---
          const fallbackMsg = `📊 ข้อมูลจากฐานข้อมูลโรงเรียน:\n\n${contextData.substring(0, 3500)}`;
          await sendTelegramMessage(botToken, chatId, fallbackMsg);
        } else {
          await sendTelegramMessage(botToken, chatId, `📬 สวัสดีค่ะคุณครู <b>${profileLinked.display_name || ''}</b>\nขณะนี้ระบบพร้อมใช้งานแจ้งเตือนหนังสือราชการและงานสารบรรณแล้วค่ะ หากมีคำสั่งหรือการมอบหมายงานใหม่ ระบบจะทักมาโดยอัตโนมัติค่ะ`);
        }
      } catch (aiErr) {
        console.error('[GEMINI TELEGRAM BOT ERROR]', aiErr);
        await sendTelegramMessage(botToken, chatId, `📬 สวัสดีค่ะคุณครู <b>${profileLinked.display_name || ''}</b>\nขณะนี้ระบบพร้อมใช้งานแจ้งเตือนหนังสือราชการและงานสารบรรณแล้วค่ะ หากมีคำสั่งหรือการมอบหมายงานใหม่ ระบบจะทักมาโดยอัตโนมัติค่ะ`);
      }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[TELEGRAM WEBHOOK CRITICAL ERROR]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
