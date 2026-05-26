import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Bot, 
  Send, 
  Loader2, 
  Trash2, 
  FolderOpen, 
  FileText, 
  ChevronRight, 
  Database, 
  Search, 
  Sparkles, 
  RefreshCw, 
  Plus, 
  ArrowRight,
  BrainCircuit,
  UploadCloud,
  CheckCircle2,
  FileSearch,
  Megaphone,
  Gamepad2,
  BookOpen
} from 'lucide-react';
import { 
  extractTextFromPdf, 
  getAvailableModels, 
  processDocumentToKnowledge, 
  searchKnowledge,
  callGeminiAPI,
  truncateContext,
  processPrivateDocumentToKnowledge,
  searchPrivateKnowledge
} from '../lib/aiService';
import { uploadFileToDrive, deleteFileFromDrive } from '../lib/storage';

// Standard Folders for Knowledge Base (Thai School Admin Standard)
const KNOWLEDGE_FOLDERS = [
  { id: '00', name: '00-นโยบาย/แผนงาน' },
  { id: '01', name: '01-หลักสูตร/การสอน' },
  { id: '02', name: '02-วิจัย/นวัตกรรม' },
  { id: '03', name: '03-วัดผล/ประเมินผล' },
  { id: '04', name: '04-แนะแนว/ระบบดูแล' },
  { id: '05', name: '05-กิจกรรมนักเรียน' },
  { id: '06', name: '06-อบรม/สัมมนา' },
  { id: '07', name: '07-ธุรการ/งบประมาณ' },
  { id: '08', name: '08-อื่นๆ' },
];

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractClassLevel(text: string): string | null {
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

interface PersonalDoc {
  file_name: string;
  content_text: string;
}

function searchPersonalDocs(query: string, docs: PersonalDoc[]) {
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
      // 1. ตรวจสอบชื่อไฟล์ (ให้คะแนนสูงขึ้นเพราะตรงจุด)
      if (fileNameLower.includes(keyword)) {
        score += 20; // ให้น้ำหนักชื่อไฟล์มากๆ
      }
      
      // 2. ตรวจสอบเนื้อหา
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

    // หากพิมพ์ชื่อไฟล์ตรงๆ หรือคำใกล้เคียงมากๆ
    if (fileNameLower.includes(queryLower) || queryLower.includes(fileNameLower.split('.')[0])) {
      score += 50;
    }

    if (score > 0) {
      let bestIndex = 0;
      // พยายามหาตำแหน่งที่ดีที่สุดของ snippet ใน content_text
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
        // กรณีไม่มีเนื้อหา text หรือแปลงไม่ได้
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

const DEFAULT_SCHEMA_MAP: Record<string, { description: string; columns: string[] }> = {
  profiles: {
    description: "ข้อมูลโปรไฟล์/คุณครูในระบบโรงเรียน",
    columns: ["id", "display_name", "email", "role", "status", "created_at"]
  },
  students: {
    description: "ข้อมูลประวัตินักเรียน ชั้นเรียน ห้องเรียน และรายละเอียดผู้ปกครอง (เพศใช้ 'ช' หรือ 'ญ', สถานะใช้ 'กำลังศึกษา' หรือ 'ปกติ')",
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

async function planDatabaseQueries(message: string, schemaMap: Record<string, any>, apiKey: string, academicYear = "2569"): Promise<{ queries: any[]; need_rag: boolean }> {
  if (!apiKey) return { queries: [], need_rag: true };

  const schemaBrief: Record<string, { desc: string; cols: string[] }> = {};
  Object.entries(schemaMap).forEach(([table, def]) => {
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
  5. หากตารางมีคอลัมน์ academic_year ให้ใส่ฟิลเตอร์กรองปี "${academicYear}" เสมอ เว้นแต่ผู้ใช้จะระบุปีอื่น
  6. รูปแบบ JSON: { "queries": [{ "table": "...", "select": "*", "filters": [{"column": "...", "operator": "eq", "value": "..."}] }], "need_rag": boolean }`;

  const prompt = `คำถามของผู้ใช้: "${message}"`;

  try {
    const res = await callGeminiAPI(prompt, apiKey, {
      systemInstruction,
      temperature: 0.1,
      responseMimeType: "application/json"
    });
    
    let text = res.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(text);
    
    // ตรวจสอบโครงสร้างคำตอบ
    if (!result.queries) result.queries = [];
    return result;
  } catch (err: any) {
    console.error(`Planning failed:`, err.message);
    return { queries: [], need_rag: true };
  }
}

export default function AICowork() {
  const { user, profile } = useAuth();
  const [activeView, setActiveTab] = useState<'chat' | 'drive' | 'intelligence'>('chat');
  const [loading, setLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [searchQuery, setSearchTerm] = useState('');

  // Intelligence Hub States
  const [knowledgeFiles, setKnowledgeFiles] = useState<any[]>([]);
  const [processingStatus, setProcessingStatus] = useState<{ current: number, total: number, fileName: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Chat States
  const [messages, setMessages] = useState<any[]>([
    { role: 'ai', text: 'สวัสดีค่ะ ชบาคือ "น้องชบา" ผู้ช่วยอัจฉริยะของคุณครู มีอะไรให้หนูช่วยสรุปหรือค้นหาข้อมูลในคลังเอกสารไหมคะ?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [searchSource, setSearchSource] = useState<'all' | 'global' | 'private'>('all');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const QUICK_TOOLS = [
    { 
      id: 'worksheet', 
      name: 'ออกแบบใบงาน/แบบฝึกหัด', 
      icon: <FileText className="text-orange-500" />, 
      prompt: 'ช่วยออกแบบใบงาน หรือแบบฝึกหัดที่น่าสนใจสำหรับนักเรียนเรื่อง... (ระบุหัวข้อและระดับชั้น)',
      description: 'สร้างโจทย์ ปริศนา หรือข้อสอบพร้อมเฉลย'
    },
    { 
      id: 'memo', 
      name: 'ร่างบันทึกข้อความ/โครงการ', 
      icon: <Plus className="text-blue-500" />, 
      prompt: 'ช่วยร่างบันทึกข้อความ หรือร่างโครงการโรงเรียนเรื่อง... (ระบุวัตถุประสงค์)',
      description: 'ร่างเอกสารภาษาราชการที่สละสลวย'
    },
    { 
      id: 'social', 
      name: 'ช่วยคิดโพสต์ PR โรงเรียน', 
      icon: <Megaphone className="text-pink-500" />, 
      prompt: 'ช่วยร่างโพสต์ Facebook สำหรับประชาสัมพันธ์กิจกรรม... (ระบุชื่อกิจกรรมและรายละเอียดที่เกิดขึ้น)',
      description: 'ร่างโพสต์โซเชียล สคริปต์ข่าว หรือคำกล่าว'
    },
    { 
      id: 'creative', 
      name: 'ออกแบบกิจกรรมเชิงสร้างสรรค์', 
      icon: <Gamepad2 className="text-indigo-500" />, 
      prompt: 'ช่วยออกแบบกิจกรรมการเรียนรู้แบบสนุกๆ เช่น เกม ฐานการเรียนรู้ หรือบทบาทสมมติ เรื่อง... (ระบุหัวข้อ)',
      description: 'ออกแบบเกม บทละคร หรือกิจกรรม Active Learning'
    },
    { 
      id: 'analyze', 
      name: 'วิเคราะห์ข้อมูล/เสนอแนะ', 
      icon: <Database className="text-purple-500" />, 
      prompt: 'ช่วยวิเคราะห์ข้อมูลนักเรียน หรือสถิติต่างๆ ของโรงเรียน และให้ข้อเสนอแนะในการพัฒนา...',
      description: 'วิเคราะห์จุดแข็ง จุดอ่อน จากข้อมูลจริง'
    },
    { 
      id: 'lesson', 
      name: 'ช่วยออกแบบแผนการสอน', 
      icon: <Sparkles className="text-green-500" />, 
      prompt: 'ช่วยออกแบบแผนการจัดการเรียนรู้ (Lesson Plan) ที่เน้น Active Learning เรื่อง...',
      description: 'กำหนดตัวชี้วัด กิจกรรม และการวัดผล'
    }
  ];

  useEffect(() => {
    if (activeView === 'drive') fetchFiles();
    if (activeView === 'intelligence') fetchKnowledgeFiles();
  }, [activeView, selectedFolder]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchFiles() {
    setLoading(true);
    try {
      let query = supabase.from('ai_knowledge_base').select('*').eq('teacher_id', user?.id);
      if (selectedFolder) query = query.eq('folder_id', selectedFolder);
      const { data } = await query.order('created_at', { ascending: false });
      setFiles(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchKnowledgeFiles() {
    setLoading(true);
    try {
      // 1. ลองดึงผ่าน View ใหม่ (ประสิทธิภาพสูงสุด)
      const { data: viewData, error: viewError } = await supabase
        .from('unique_knowledge_docs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!viewError && viewData) {
        setKnowledgeFiles(viewData);
        setLoading(false);
        return;
      }

      // 2. Fallback: หากยังไม่ได้สร้าง View ให้ดึงแบบเดิมแต่เพิ่มขีดจำกัด
      const { data, error } = await supabase
        .from('school_knowledge')
        .select('document_name, created_at')
        .order('created_at', { ascending: false })
        .limit(2000);
      
      if (error) throw error;
      
      const uniqueFiles = data.reduce((acc: any[], current) => {
        const x = acc.find(item => item.document_name === current.document_name);
        if (!x) return acc.concat([current]);
        return acc;
      }, []);

      setKnowledgeFiles(uniqueFiles);
    } catch (err) {
      console.error('Fetch knowledge files failed:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleKnowledgeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (profile?.role !== 'admin' && profile?.role !== 'director') {
      alert('ขออภัยค่ะ เฉพาะผู้ดูแลระบบหรือผู้อำนวยการเท่านั้นที่มีสิทธิ์เพิ่มข้อมูลคลังสมองส่วนกลาง');
      return;
    }
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    if (file.type !== 'application/pdf') {
      alert('กรุณาเลือกไฟล์ PDF เท่านั้นค่ะ');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus({ current: 0, total: 0, fileName: file.name });

    try {
      const { data: settings } = await supabase.from('settings').select('gemini_api_key, ai_cowork_api_key').single();
      const apiKey = settings?.ai_cowork_api_key || settings?.gemini_api_key;
      if (!apiKey) throw new Error('กรุณาตั้งค่า Gemini API Key หรือ AI Cowork API Key ก่อนค่ะ');

      const buffer = await file.arrayBuffer();
      await processDocumentToKnowledge(buffer, file.name, apiKey, (current, total) => {
        setProcessingStatus({ current, total, fileName: file.name });
      });

      alert('ชบาย่อยข้อมูลและจดจำลงสมองเรียบร้อยแล้วค่ะ!');
      fetchKnowledgeFiles();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProcessingStatus(null);
    }
  }

  async function handleDeleteKnowledge(fileName: string) {
    if (profile?.role !== 'admin' && profile?.role !== 'director') {
      alert('ขออภัยค่ะ เฉพาะผู้ดูแลระบบหรือผู้อำนวยการเท่านั้นที่มีสิทธิ์ลบข้อมูลคลังสมองส่วนกลาง');
      return;
    }
    if (!confirm(`ยืนยันการลบความรู้จากไฟล์ "${fileName}" ออกจากสมองของชบาคะ?`)) return;
    try {
      const { error } = await supabase.from('school_knowledge').delete().eq('document_name', fileName);
      if (error) throw error;
      fetchKnowledgeFiles();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length || !selectedFolder) return;
    setIsUploading(true);
    const file = e.target.files[0];
    setUploadProgress('กำลังอัปโหลดเอกสารไปยังคลังส่วนตัว...');
    try {
      const folderName = KNOWLEDGE_FOLDERS.find(f => f.id === selectedFolder)?.name || 'อื่นๆ';
      
      let buffer: ArrayBuffer | null = null;
      if (file.type === 'application/pdf') {
        buffer = await file.arrayBuffer();
      }

      const customName = `${Date.now()}_${file.name.split('.')[0]}`;
      const publicUrl = await uploadFileToDrive(file, `kb_${user?.id}_${selectedFolder}`, customName);

      setUploadProgress('อัปโหลดไฟล์เสร็จสิ้น กำลังถอดความข้อความ...');
      let extractedText = "";
      if (buffer) {
        extractedText = await extractTextFromPdf(buffer);
      }

      const { data: dbData, error: insertErr } = await supabase
        .from('ai_knowledge_base')
        .insert([{
          teacher_id: user?.id,
          folder_id: selectedFolder,
          folder_name: folderName,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type.split('/')[1],
          content_text: extractedText
        }])
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      if (buffer && dbData?.id) {
        setUploadProgress('กำลังสกัดคำและคำนวณเวกเตอร์ความรู้สำหรับสืบค้น (RAG)...');
        const { data: settings } = await supabase.from('settings').select('gemini_api_key, ai_cowork_api_key').single();
        const apiKey = settings?.ai_cowork_api_key || settings?.gemini_api_key;
        if (!apiKey) throw new Error('กรุณาตั้งค่า Gemini API Key หรือ AI Cowork API Key ก่อนสร้างความรู้คลังส่วนตัวนะคะ');
        
        await processPrivateDocumentToKnowledge(
          buffer, 
          file.name, 
          dbData.id, 
          user?.id || '', 
          apiKey,
          (current, total) => {
            setUploadProgress(`กำลังย่อยเอกสารส่วนตัว: หน้าที่ ${current} จาก ${total}...`);
          }
        );
      }

      setUploadProgress('ประมวลผลและเพิ่มคลังเอกสารส่วนตัวเสร็จสมบูรณ์!');
      setTimeout(() => setUploadProgress(null), 3000);
      fetchFiles();
    } catch (err: any) {
      alert('Upload and indexing failed: ' + err.message);
      setUploadProgress(null);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteFile(id: string, url: string) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบเอกสารนี้คะ?')) return;
    try {
      await deleteFileFromDrive(url);
      await supabase.from('ai_knowledge_base').delete().eq('id', id);
      fetchFiles();
    } catch (err: any) { alert(err.message); }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim() || isThinking) return;

    const userMsg = inputText;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInputText('');
    setIsThinking(true);

    try {
      const { data: settings } = await supabase.from('settings').select('gemini_api_key, ai_cowork_api_key, current_academic_year').single();
      const apiKey = settings?.ai_cowork_api_key || settings?.gemini_api_key;
      const currentYear = settings?.current_academic_year || '2569';
      
      if (!apiKey) throw new Error('กรุณาตั้งค่า API Key ก่อนนะคะ');

      let searchQuery = userMsg;

      // Query Condensation: หากมีประวัติการสนทนา ให้สร้าง Standalone Query
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

      // 1. วางแผนสืบค้นข้อมูลฐานข้อมูลแบบไดนามิก (Dynamic Database AI Solver)
      let dbContextParts: string[] = [];
      let queryPlan = { queries: [] as any[], need_rag: true };
      
      try {
        queryPlan = await planDatabaseQueries(searchQuery, DEFAULT_SCHEMA_MAP, apiKey, currentYear);
      } catch (planErr) {
        console.error("Failed to plan database queries:", planErr);
      }

      // --- ระบบ RAG Fallback สำหรับตารางหลัก (Database Fallback Solver) ---
      if (!queryPlan.queries) queryPlan.queries = [];
      const msgLower = userMsg.toLowerCase();
      
      // 1. สำหรับข้อมูลนักเรียน
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

      // 2. สำหรับข้อมูลครูและเวร
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

      // 3. สำหรับโครงการและงบประมาณ
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

      // 4. สำหรับข้อมูลหนังสือราชการและไฟล์แนบ
      const hasDocQuery = queryPlan.queries.some((q: any) => q.table === 'incoming_docs' || q.table === 'outgoing_docs' || q.table === 'orders' || q.table === 'memos');
      if (!hasDocQuery && (msgLower.includes('หนังสือรับ') || msgLower.includes('หนังสือเข้า') || msgLower.includes('หนังสือส่ง') || msgLower.includes('หนังสือออก') || msgLower.includes('คำสั่ง') || msgLower.includes('บันทึกข้อความ') || msgLower.includes('เมโม่') || msgLower.includes('แนบ') || msgLower.includes('ไฟล์แนบ') || msgLower.includes('เอกสารแนบ'))) {
        const searchWord = userMsg.replace(/(ขอ|ไฟล์|แนบ|หนังสือ|คำสั่ง|บันทึกข้อความ|เมโม่|ล่าสุด|ของ|เรื่อง|เรื่องที่|ที่)/g, '').trim();
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

      // 5. สำหรับข้อมูลบิลค่าไฟ ค่าน้ำ และสาธารณูปโภค
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

      // 6. สำหรับข้อมูลจัดซื้อจัดจ้าง
      const hasProcureQuery = queryPlan.queries.some((q: any) => q.table === 'procurement_projects');
      if (!hasProcureQuery && (msgLower.includes('จัดซื้อ') || msgLower.includes('จัดจ้าง') || msgLower.includes('พัสดุ') || msgLower.includes('ผู้ขาย') || msgLower.includes('สัญญา') || msgLower.includes('ผู้รับจ้าง'))) {
        queryPlan.queries.push({
          table: 'procurement_projects',
          select: 'project_name, academic_year, method, procurement_type, total_amount, status, ref_doc_number, contract_number, committee_json, vendor_info',
          filters: [{ column: 'academic_year', operator: 'eq', value: currentYear }],
          limit: 20
        });
      }
      // ---------------------------------------------------------------------

      // ดึงสถิตินักเรียนและครูพื้นฐาน (Fallback)
      let fallbackStats = "";
      try {
        const { count: sCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('academic_year', currentYear).in('graduation_status', ['ปกติ', 'กำลังศึกษา']);
        const { count: tCount } = await supabase.from('teachers').select('*', { count: 'exact', head: true });
        fallbackStats = `สถิติพื้นฐาน: นักเรียน ${sCount || 0} คน, ครู ${tCount || 0} คน (ปีการศึกษา ${currentYear})`;
      } catch (e) {}

      if (queryPlan.queries && Array.isArray(queryPlan.queries)) {
        for (const q of queryPlan.queries) {
          if (!DEFAULT_SCHEMA_MAP[q.table]) continue;
          try {
            // ป้องกัน syntax พังจากการที่ AI พยายามสร้างฟังก์ชัน aggregate เช่น count(*) ใน select
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
            
            // --- ระบบบังคับกรองข้อมูลตามปีการศึกษาและสถานะปัจจุบัน (Enforce Academic Year & Status Filter) ---
            const columnsInTable = DEFAULT_SCHEMA_MAP[q.table]?.columns || [];
            
            // 1. บังคับกรองปีการศึกษา (academic_year)
            if (columnsInTable.includes('academic_year')) {
              const hasYearFilter = q.filters && q.filters.some((f: any) => f.column === 'academic_year');
              if (!hasYearFilter) {
                query = query.eq('academic_year', currentYear);
              }
            }
            
            // 2. บังคับกรองสถานะนักเรียนปกติ/กำลังศึกษา (graduation_status)
            if (q.table === 'students') {
              const hasStatusFilter = q.filters && q.filters.some((f: any) => f.column === 'graduation_status');
              if (!hasStatusFilter) {
                query = query.in('graduation_status', ['ปกติ', 'กำลังศึกษา']);
              }
            }
            // -------------------------------------------------------------------------------------------------

            if (q.filters) {
              for (const f of q.filters) {
                if (DEFAULT_SCHEMA_MAP[q.table].columns.includes(f.column)) {
                  // ปรับปรุงการกรองระดับชั้นเรียน (class_level) ในตาราง students ให้ยืดหยุ่นและทนทาน (Robust Filter)
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
              console.error(`[AICowork DB Query Error on ${q.table}]:`, error);
            } else if (data?.length) {
              // เพิ่ม Pre-computed stats สำหรับตารางนักเรียนภาพรวม เพื่อให้ AI ตอบได้ถูกต้อง 100%
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
            console.error(`[AICowork DB Query Exec Fail on ${q.table}]:`, queryErr);
          }
        }
      }

      // 2. ค้นหาคลังปัญญา (RAG ส่วนกลาง)
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

      // 3. ค้นหาเอกสารส่วนตัว (Private Knowledge RAG)
      let privateContext = "";
      if (searchSource === 'all' || searchSource === 'private') {
        try {
          const privateMatches = await searchPrivateKnowledge(searchQuery, user?.id || '', apiKey, 10);
          if (privateMatches && privateMatches.length > 0) {
            privateContext = privateMatches.map((m: any) => `[ไฟล์ส่วนตัว: ${m.document_name} หน้า ${m.page_number}]\n${m.chunk_text}`).join('\n\n');
          } else {
            // Fallback: ค้นหาจากเนื้อหาไฟล์ดิบดั้งเดิมแบบ Keyword Search
            const { data: personalDocs } = await supabase
              .from('ai_knowledge_base')
              .select('*')
              .eq('teacher_id', user?.id)
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
          console.error("Private search error:", privErr);
        }
      }

      // 4. สร้างประวัติการสนทนาย้อนหลังเสริมเป็น Context
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

      // 5. สร้าง Prompt และเรียก AI
      const systemInstruction = `คุณคือ "น้องชบา" ผู้ช่วยอัจฉริยะโรงเรียนบ้านควนโคกยา
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
      
      setMessages(prev => [...prev, { role: 'ai', text: finalAnswer }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: `ขออภัยค่ะ เกิดข้อผิดพลาด: ${err.message}` }]);
    } finally {
      setIsThinking(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
      {/* Tabs */}
      <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-100 w-fit shadow-sm">
        <button 
          onClick={() => setActiveTab('chat')} 
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all ${activeView === 'chat' ? 'bg-brand-primary text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <Bot size={18} /> Chat Hub
        </button>
        <button 
          onClick={() => setActiveTab('drive')} 
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all ${activeView === 'drive' ? 'bg-brand-primary text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <Database size={18} /> Virtual Drive
        </button>
        {(profile?.role === 'admin' || profile?.role === 'director') && (
          <button 
            onClick={() => setActiveTab('intelligence')} 
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all ${activeView === 'intelligence' ? 'bg-brand-primary text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <BrainCircuit size={18} /> Intelligence Hub
          </button>
        )}
      </div>
      {activeView === 'chat' && (
        <div className="flex-1 flex flex-col bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-hidden relative">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center text-white">
                   <Sparkles size={20} />
                </div>
                <div>
                   <h3 className="font-black text-slate-800 text-sm">น้องชบา (Nong Chaba)</h3>
                   <div className="text-[10px] text-green-500 font-bold uppercase tracking-widest flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div> พร้อมช่วยงานค่ะ
                   </div>
                </div>
             </div>
             <button onClick={() => setMessages([{ role: 'ai', text: 'รีเซ็ตการสนทนาเรียบร้อยค่ะ มีอะไรให้ชบาช่วยไหมคะ?' }])} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                <RefreshCw size={18} />
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {messages.length <= 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {QUICK_TOOLS.map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => setInputText(tool.prompt)}
                    className="flex flex-col items-start p-5 bg-slate-50 border border-slate-100 rounded-[32px] hover:bg-white hover:border-brand-primary/30 hover:shadow-xl hover:shadow-green-100/20 transition-all text-left group"
                  >
                    <div className="p-3 bg-white rounded-2xl mb-4 group-hover:scale-110 transition-transform shadow-sm">
                      {tool.icon}
                    </div>
                    <h4 className="font-black text-slate-800 text-sm mb-1">{tool.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold leading-relaxed">{tool.description}</p>
                  </button>
                ))}
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-5 rounded-[28px] text-sm leading-relaxed shadow-sm transition-all ${
                  msg.role === 'user' 
                    ? 'bg-brand-primary text-white rounded-tr-none' 
                    : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                }`}>
                  <div className={`whitespace-pre-wrap prose-sm max-w-none prose-headings:font-black prose-strong:font-black ${
                    msg.role === 'user' 
                      ? 'text-white prose-headings:text-white prose-strong:text-white' 
                      : 'text-slate-700 prose-headings:text-slate-800 prose-strong:text-brand-primary'
                  }`}>
                     {msg.text.split('\n').map((line: string, index: number) => {
                        // Simple Markdown rendering for headers
                        if (line.startsWith('# ')) return <h1 key={index} className="text-xl font-black mb-4 mt-2">{line.replace('# ', '')}</h1>;
                        if (line.startsWith('## ')) return <h2 key={index} className="text-lg font-black mb-3 mt-4">{line.replace('## ', '')}</h2>;
                        if (line.startsWith('### ')) return <h3 key={index} className="text-base font-black mb-2 mt-3">{line.replace('### ', '')}</h3>;
                        
                        // ตรวจสอบและแปลงรายการ Bullet points (*, -, •, +)
                        const trimmedLine = line.trim();
                        const isBullet = trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ') || trimmedLine.startsWith('+ ');
                        const isNumbered = /^\d+(\.\d+)*\.\s/.test(trimmedLine);
                        
                        // คำนวณระดับความเยื้อง (Indentation level) จากจำนวนเว้นวรรคข้างหน้าบรรทัด
                        const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
                        const indentLevel = leadingSpaces > 0 ? Math.floor(leadingSpaces / 2) : 0;
                        
                        let cleanLine = line;
                        if (isBullet) {
                          cleanLine = trimmedLine.replace(/^(\*\s|-\s|•\s|\+\s)/, '');
                        } else if (isNumbered) {
                          cleanLine = trimmedLine.replace(/^\d+(\.\d+)*\.\s/, '');
                        }
                        
                        const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
                        const renderedContent = parts.map((part, pIdx) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return (
                              <strong key={pIdx} className={`${msg.role === 'user' ? 'text-white' : 'bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded-md border border-amber-200 font-black mx-0.5 shadow-sm'}`}>
                                {part.slice(2, -2)}
                              </strong>
                            );
                          }
                          
                          // Parse citations in non-bold parts: (อ้างอิงจาก...)
                          const citationRegex = /(\(อ้างอิงจาก[^)]+\))/g;
                          const subParts = part.split(citationRegex);
                          return subParts.map((subPart, sIdx) => {
                            if (subPart.startsWith('(อ้างอิงจาก') && subPart.endsWith(')')) {
                              const citationContent = subPart.slice(1, -1); // e.g. "อ้างอิงจากคลังกลาง: ระเบียบการลาปี 2568 หน้า 5"
                              const cleanContent = citationContent.replace(/^อ้างอิงจาก/, '').trim();
                              return (
                                <span key={`${pIdx}-${sIdx}`} className="group relative inline-block mx-1 cursor-help align-middle">
                                  <span className="inline-flex items-center justify-center bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-200 transition-colors shadow-sm gap-0.5">
                                    <BookOpen size={9} />
                                    <span>อ้างอิง</span>
                                  </span>
                                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-950/95 backdrop-blur text-white text-[11px] font-medium rounded-xl py-2 px-3 w-56 whitespace-normal break-words z-50 shadow-2xl border border-white/10 text-center leading-relaxed">
                                    {cleanContent}
                                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-950/95"></span>
                                  </span>
                                </span>
                              );
                            }
                            return subPart;
                          });
                        });

                        // เพิ่มการรองรับตารางแบบง่าย (Simple Table Support)
                        if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
                          const cells = trimmedLine.split('|').filter(c => c.trim() !== '' || trimmedLine.indexOf('|'+c+'|') !== -1);
                          return (
                            <div key={index} className="overflow-x-auto my-2">
                              <table className="min-w-full border-collapse border border-slate-200 text-xs">
                                <tbody>
                                  <tr className={msg.role === 'user' ? 'bg-white/10' : 'bg-slate-50'}>
                                    {cells.map((cell, cIdx) => (
                                      <td key={cIdx} className="border border-slate-200 px-3 py-2 font-bold">{cell.trim()}</td>
                                    ))}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          );
                        }
                        
                        if (isBullet) {
                          let bulletIndicator = <span className={`${msg.role === 'user' ? 'bg-white' : 'bg-brand-primary'} mt-2 min-w-[6px] h-[6px] rounded-full`}></span>;
                          if (indentLevel === 1) {
                            bulletIndicator = <span className={`mt-1.5 min-w-[6px] h-[6px] rounded-full border ${msg.role === 'user' ? 'border-white' : 'border-brand-primary'} bg-transparent`}></span>;
                          } else if (indentLevel >= 2) {
                            bulletIndicator = <span className={`mt-2 min-w-[5px] h-[5px] ${msg.role === 'user' ? 'bg-white/80' : 'bg-brand-primary/80'}`}></span>;
                          }
                          
                          return (
                            <div key={index} className="flex items-start gap-2 mb-2" style={{ paddingLeft: `${(indentLevel + 1) * 16}px` }}>
                              {bulletIndicator}
                              <span className="flex-1">{renderedContent}</span>
                            </div>
                          );
                        }
                        
                        if (isNumbered) {
                          const numMatch = trimmedLine.match(/^(\d+(\.\d+)*)\.\s/);
                          const num = numMatch ? numMatch[1] : '1';
                          return (
                            <div key={index} className="flex items-start gap-2 mb-2" style={{ paddingLeft: `${(indentLevel + 1) * 16}px` }}>
                              <span className={`font-black text-xs min-w-[20px] ${msg.role === 'user' ? 'text-white' : 'text-brand-primary'}`}>{num}.</span>
                              <span className="flex-1">{renderedContent}</span>
                            </div>
                          );
                        }
                        
                        if (line.trim() === '') {
                          return <div key={index} className="h-2"></div>;
                        }
                        
                        return (
                          <p key={index} className="mb-2 last:mb-0">
                            {renderedContent}
                          </p>
                        );
                     })}
                  </div>
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-white p-5 rounded-[28px] rounded-tl-none border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-2">
                     <Loader2 size={20} className="animate-spin text-brand-primary" />
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ชบากำลังวิเคราะห์คลังปัญญา...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-6 bg-slate-50/50 border-t border-slate-100">
             {/* ขอบเขตการค้นหาความรู้ */}
             <div className="flex flex-wrap gap-2 mb-4 justify-center items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">ขอบเขตสืบค้น:</span>
                <button
                   type="button"
                   onClick={() => setSearchSource('all')}
                   className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-wide transition-all active:scale-95 ${
                      searchSource === 'all' 
                        ? 'bg-brand-primary text-white shadow-sm' 
                        : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-100'
                   }`}
                >
                   ทั้งหมด (สถิติ + คลังกลาง + ส่วนตัว)
                </button>
                <button
                   type="button"
                   onClick={() => setSearchSource('global')}
                   className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-wide transition-all active:scale-95 ${
                      searchSource === 'global' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-100'
                   }`}
                >
                   คลังปัญญาส่วนกลาง
                </button>
                <button
                   type="button"
                   onClick={() => setSearchSource('private')}
                   className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-wide transition-all active:scale-95 ${
                      searchSource === 'private' 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-100'
                   }`}
                >
                   เอกสารส่วนตัวของคุณครู
                </button>
             </div>
             <div className="relative">
                <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="พิมพ์คำถามถึงน้องชบาที่นี่นะคะ (เช่น ช่วยสรุประเบียบพัสดุให้หน่อย)..." 
                  className="w-full pl-6 pr-14 py-4 bg-white border border-slate-200 rounded-[24px] font-bold text-slate-700 outline-hidden focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all shadow-sm"
                />
                <button type="submit" className="absolute right-2 top-2 w-10 h-10 bg-brand-primary text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all">
                   <Send size={18} />
                </button>
             </div>
             <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-widest mt-3">ขับเคลื่อนด้วย Google Gemini AI • ระบบวิเคราะห์จากคลังปัญญาโรงเรียน</p>
          </form>
        </div>
      )}

      {activeView === 'drive' && (
        <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Folders Sidebar */}
          <div className="w-72 bg-white rounded-[40px] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
             <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-1">หมวดหมู่เอกสาร</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Knowledge Folders</p>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                {KNOWLEDGE_FOLDERS.map(folder => (
                  <button 
                    key={folder.id} 
                    onClick={() => setSelectedFolder(folder.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${selectedFolder === folder.id ? 'bg-brand-primary text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                  >
                    <div className="flex items-center gap-3">
                       <FolderOpen size={18} className={selectedFolder === folder.id ? 'text-white' : 'text-slate-400 group-hover:text-brand-primary'} />
                       <span className="text-xs font-bold">{folder.name}</span>
                    </div>
                    {selectedFolder === folder.id && <ChevronRight size={14} />}
                  </button>
                ))}
             </div>
          </div>

          {/* Files Main */}
          <div className="flex-1 bg-white rounded-[40px] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
             <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div>
                   <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                      {selectedFolder ? KNOWLEDGE_FOLDERS.find(f => f.id === selectedFolder)?.name : 'กรุณาเลือกโฟลเดอร์'}
                   </h3>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                      {files.length} รายการเอกสาร
                   </p>
                </div>
                <div className="flex items-center gap-3">
                   <div className="relative">
                      <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                      <input type="text" placeholder="ค้นหาชื่อไฟล์..." className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:bg-white transition-all w-64" value={searchQuery} onChange={e => setSearchTerm(e.target.value)} />
                   </div>
                   {selectedFolder && (
                     <label className="bg-brand-primary text-white px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer hover:bg-green-700 transition-all shadow-md">
                        <input type="file" className="hidden" onChange={handleFileUpload} />
                        {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} อัปโหลดไฟล์
                     </label>
                   )}
                 </div>
              </div>

              {uploadProgress && (
                <div className="mx-8 mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold animate-in fade-in duration-300">
                  <Loader2 size={16} className="animate-spin text-brand-primary" />
                  <span>{uploadProgress}</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                     <Loader2 className="animate-spin mb-4" size={40} />
                     <p className="font-bold uppercase tracking-widest text-[10px]">ชบากำลังโหลดคลังเอกสาร...</p>
                  </div>
                ) : files.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {files.filter(f => f.file_name.toLowerCase().includes(searchQuery.toLowerCase())).map(file => (
                        <div key={file.id} className="group p-4 bg-slate-50 border border-slate-100 rounded-[24px] hover:bg-white hover:border-brand-primary/20 hover:shadow-xl hover:shadow-green-100/20 transition-all">
                           <div className="flex items-start justify-between mb-4">
                              <div className="p-3 bg-white rounded-2xl text-brand-primary shadow-sm group-hover:bg-brand-primary group-hover:text-white transition-colors">
                                 <FileText size={24} />
                              </div>
                              <button onClick={() => handleDeleteFile(file.id, file.file_url)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                 <Trash2 size={16} />
                              </button>
                           </div>
                           <h4 className="font-black text-slate-800 text-sm truncate mb-1" title={file.file_name}>{file.file_name}</h4>
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-4">{file.file_type || 'PDF'} • {new Date(file.created_at).toLocaleDateString('th-TH')}</p>
                           <a href={file.file_url} target="_blank" className="inline-flex items-center gap-1.5 text-[10px] font-black text-brand-primary uppercase hover:underline">
                              เปิดดูเอกสาร <ArrowRight size={10} />
                           </a>
                        </div>
                     ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300 border-2 border-dashed border-slate-100 rounded-[40px]">
                     <FolderOpen size={64} className="mb-4 opacity-20" />
                     <p className="font-black uppercase tracking-[0.2em] text-sm">ไม่มีเอกสารในหมวดหมู่นี้</p>
                     <p className="text-[10px] font-bold mt-1 text-slate-400">อัปโหลดไฟล์แรกของคุณครูเพื่อเริ่มให้ชบาช่วยวิเคราะห์นะคะ</p>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

      {activeView === 'intelligence' && (profile?.role === 'admin' || profile?.role === 'director') && (
        <div className="flex-1 flex flex-col bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-10 border-b border-slate-50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                <BrainCircuit size={32} className="text-brand-primary" /> Intelligence Hub
              </h3>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">คลังปัญญาโรงเรียน (ระบบอ่านและจดจำเนื้อหาอัตโนมัติ) ใช้ความสามารถของ Gemma 4 จัดการ</p>
            </div>
            <div className="flex gap-3">
              <label className={`bg-brand-primary text-white px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-green-100 transition-all active:scale-95 ${isProcessing ? 'opacity-50 pointer-events-none' : 'hover:bg-green-700'}`}>
                <input type="file" className="hidden" accept="application/pdf" onChange={handleKnowledgeUpload} />
                <UploadCloud size={20} /> สอนงานชบา (ป้อน PDF)
              </label>
            </div>
          </div>

          {isProcessing && processingStatus && (
            <div className="p-8 bg-blue-600 text-white animate-in slide-in-from-top duration-500">
               <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                     <Loader2 className="animate-spin" size={24} />
                     <div>
                        <p className="font-black text-lg">ชบากำลังอ่านและจดจำเนื้อหาค่ะ...</p>
                        <p className="text-blue-100 text-xs font-bold uppercase tracking-widest">ไฟล์: {processingStatus.fileName}</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-3xl font-black">{Math.round((processingStatus.current / processingStatus.total) * 100)}%</p>
                     <p className="text-[10px] font-black uppercase opacity-60">หน้า {processingStatus.current} จาก {processingStatus.total}</p>
                  </div>
               </div>
               <div className="h-3 bg-white/20 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-white transition-all duration-300" style={{ width: `${(processingStatus.current / processingStatus.total) * 100}%` }}></div>
               </div>
               <p className="text-[10px] font-black uppercase mt-4 tracking-widest text-center opacity-80">* กรุณาอย่าปิดหน้านี้จนกว่าชบาจะทำงานเสร็จนะคะ *</p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {knowledgeFiles.map((file, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-100 p-6 rounded-[32px] group hover:bg-white hover:border-brand-primary/20 hover:shadow-xl transition-all">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-white rounded-2xl text-brand-primary shadow-sm group-hover:bg-brand-primary group-hover:text-white transition-colors">
                      <FileSearch size={28} />
                    </div>
                    <button onClick={() => handleDeleteKnowledge(file.document_name)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={20} />
                    </button>
                  </div>
                  <h4 className="font-black text-slate-800 text-lg line-clamp-2 mb-2" title={file.document_name}>{file.document_name}</h4>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-500" /> จดจำเข้าระบบแล้วค่ะ
                  </p>
                  <div className="mt-6 pt-6 border-t border-slate-100 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase">
                    <span>วันที่จดจำ: {new Date(file.created_at).toLocaleDateString('th-TH')}</span>
                  </div>
                </div>
              ))}

              {knowledgeFiles.length === 0 && !loading && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300 border-4 border-dashed border-slate-50 rounded-[40px]">
                   <BrainCircuit size={80} className="mb-6 opacity-10" />
                   <p className="text-xl font-black uppercase tracking-[0.2em]">สมองชบายังว่างเปล่าค่ะ</p>
                   <p className="text-sm font-bold mt-2 text-slate-400 max-w-sm text-center">เริ่มสอนงานชบาโดยการอัปโหลดระเบียบหรือคู่มือการทำงานของโรงเรียนนะคะ เพื่อให้ชบาช่วยตอบคำถามและร่างเอกสารได้แม่นยำขึ้น</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
