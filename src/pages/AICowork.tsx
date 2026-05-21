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
  Gamepad2
} from 'lucide-react';
import { extractTextFromPdf, getAvailableModels, processDocumentToKnowledge, searchKnowledge } from '../lib/aiService';
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

async function planDatabaseQueries(message: string, schemaMap: Record<string, any>, apiKey: string, academicYear = "2569"): Promise<{ queries: any[]; need_rag: boolean }> {
  if (!apiKey) return { queries: [], need_rag: true };

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
    "need_rag": true
  }`;

  let modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro", "gemini-flash-latest"];
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
          text = text.replace(/```json/g, "").replace(/```/g, "").trim();
          return JSON.parse(text);
        }
      } catch (err: any) {
        console.error(`Error with model ${model} in planning:`, err.message);
      }
    }
  }
  return { queries: [], need_rag: true };
}

export default function AICowork() {
  const { user, profile } = useAuth();
  const [activeView, setActiveTab] = useState<'chat' | 'drive' | 'intelligence'>('chat');
  const [loading, setLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchTerm] = useState('');

  // Intelligence Hub States
  const [knowledgeFiles, setKnowledgeFiles] = useState<any[]>([]);
  const [processingStatus, setProcessingStatus] = useState<{ current: number, total: number, fileName: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Chat States
  const [messages, setMessages] = useState<any[]>([
    { role: 'ai', text: 'สวัสดีครับ ผม AI Cowork ผู้ช่วยอัจฉริยะของคุณครู มีอะไรให้ผมช่วยสรุปหรือค้นหาข้อมูลจากคลังเอกสารของคุณครูไหมครับ?' }
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
      // ดึงชื่อไฟล์ที่ไม่ซ้ำกันจากคลังปัญญา
      const { data, error } = await supabase
        .from('school_knowledge')
        .select('document_name, created_at')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Filter unique filenames
      const uniqueFiles = data.reduce((acc: any[], current) => {
        const x = acc.find(item => item.document_name === current.document_name);
        if (!x) return acc.concat([current]);
        return acc;
      }, []);

      setKnowledgeFiles(uniqueFiles);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleKnowledgeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (profile?.role !== 'admin' && profile?.role !== 'director') {
      alert('ขออภัยครับ เฉพาะผู้ดูแลระบบหรือผู้อำนวยการเท่านั้นที่มีสิทธิ์เพิ่มข้อมูลคลังสมองส่วนกลาง');
      return;
    }
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    if (file.type !== 'application/pdf') {
      alert('กรุณาเลือกไฟล์ PDF เท่านั้นครับ');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus({ current: 0, total: 0, fileName: file.name });

    try {
      const { data: settings } = await supabase.from('settings').select('gemini_api_key').single();
      const apiKey = settings?.gemini_api_key;
      if (!apiKey) throw new Error('กรุณาตั้งค่า Gemini API Key ก่อนครับ');

      const buffer = await file.arrayBuffer();
      await processDocumentToKnowledge(buffer, file.name, apiKey, (current, total) => {
        setProcessingStatus({ current, total, fileName: file.name });
      });

      alert('AI ย่อยข้อมูลและจดจำลงสมองเรียบร้อยแล้วครับ!');
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
      alert('ขออภัยครับ เฉพาะผู้ดูแลระบบหรือผู้อำนวยการเท่านั้นที่มีสิทธิ์ลบข้อมูลคลังสมองส่วนกลาง');
      return;
    }
    if (!confirm(`ยืนยันการลบความรู้จากไฟล์ "${fileName}" ออกจากสมอง AI?`)) return;
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
    try {
      const folderName = KNOWLEDGE_FOLDERS.find(f => f.id === selectedFolder)?.name || 'อื่นๆ';
      
      // 1. Upload to Google Drive Storage via GAS
      const customName = `${Date.now()}_${file.name.split('.')[0]}`;
      const publicUrl = await uploadFileToDrive(file, `kb_${user?.id}_${selectedFolder}`, customName);

      // 2. Extract Text (if PDF)
      let extractedText = "";
      if (file.type === 'application/pdf') {
        const buffer = await file.arrayBuffer();
        extractedText = await extractTextFromPdf(buffer);
      }

      // 3. Save to DB
      await supabase.from('ai_knowledge_base').insert([{
        teacher_id: user?.id,
        folder_id: selectedFolder,
        folder_name: folderName,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type.split('/')[1],
        content_text: extractedText
      }]);

      fetchFiles();
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteFile(id: string, url: string) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบเอกสารนี้?')) return;
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
      
      if (!apiKey) throw new Error('กรุณาตั้งค่า API Key ก่อนใช้งาน');

      // 1. วางแผนสืบค้นข้อมูลฐานข้อมูลแบบไดนามิก (Dynamic Database AI Solver)
      let dbContextParts: string[] = [];
      let queryPlan = { queries: [] as any[], need_rag: true };
      
      try {
        queryPlan = await planDatabaseQueries(userMsg, DEFAULT_SCHEMA_MAP, apiKey, currentYear);
      } catch (planErr) {
        console.error("Failed to plan database queries:", planErr);
      }

      // ดึงสถิตินักเรียนและครูพื้นฐานไว้เสมอสำหรับกรณี Fallback หรือประกอบคำตอบเพิ่มเติม
      let fallbackStudentCount = 0;
      let fallbackTeacherCount = 0;
      try {
        const { count: sCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('academic_year', currentYear).eq('graduation_status', 'ปกติ');
        const { count: tCount } = await supabase.from('teachers').select('*', { count: 'exact', head: true });
        fallbackStudentCount = sCount || 0;
        fallbackTeacherCount = tCount || 0;
      } catch (e) {
        console.warn("Fetch fallback stats failed:", e);
      }

      if (queryPlan && Array.isArray(queryPlan.queries) && queryPlan.queries.length > 0) {
        for (const queryConfig of queryPlan.queries) {
          const targetTable = queryConfig.table;
          
          // ตรวจสอบ whitelist ป้องกัน SQL injection/unsafe table access
          if (!DEFAULT_SCHEMA_MAP[targetTable]) {
            console.warn(`⚠️ Skipping unsafe table query: ${targetTable}`);
            continue;
          }
          
          let queryBuilder: any = supabase.from(targetTable).select(queryConfig.select || '*');
          
          // กรองข้อมูล (Filters)
          if (queryConfig.filters && Array.isArray(queryConfig.filters)) {
            for (const f of queryConfig.filters) {
              if (!DEFAULT_SCHEMA_MAP[targetTable].columns.includes(f.column)) {
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
          
          // จัดเรียง (Order)
          if (queryConfig.order && queryConfig.order.column) {
            if (DEFAULT_SCHEMA_MAP[targetTable].columns.includes(queryConfig.order.column)) {
              queryBuilder = queryBuilder.order(queryConfig.order.column, { ascending: !!queryConfig.order.ascending });
            }
          }
          
          // จำกัดจำนวนรายการ (Limit)
          const limitVal = queryConfig.limit ? Math.min(queryConfig.limit, 30) : 20;
          queryBuilder = queryBuilder.limit(limitVal);
          
          // รันคิวรี
          try {
            const { data, error } = await queryBuilder;
            if (error) {
              console.error(`Supabase Client Error querying ${targetTable}:`, error.message);
            } else if (data && data.length > 0) {
              const tableDesc = DEFAULT_SCHEMA_MAP[targetTable].description || targetTable;
              dbContextParts.push(`[ตารางข้อมูล: ${targetTable} (${tableDesc})]\n${JSON.stringify(data, null, 2)}`);
            }
          } catch (queryErr: any) {
            console.error(`Failed to execute dynamic query for ${targetTable}:`, queryErr.message);
          }
        }
      }

      // ดึงสถิติตามแบบเดิมเพื่อใช้ใน Prompt สถิตินักเรียน
      const { data: studentStats } = await supabase
        .from('students')
        .select('class_level, gender, prefix, first_name, last_name, graduation_status, religion')
        .eq('academic_year', currentYear)
        .eq('graduation_status', 'ปกติ');

      const religionStats: Record<string, number> = {};
      const studentSummary = studentStats?.reduce((acc: any, curr: any) => {
        const level = curr.class_level || 'ไม่ระบุ';
        if (!acc[level]) acc[level] = { total: 0, male: 0, female: 0, names: [] };
        acc[level].total++;
        
        const rel = curr.religion || 'ไม่ระบุ';
        religionStats[rel] = (religionStats[rel] || 0) + 1;

        const gender = (curr.gender || '').trim();
        const prefix = (curr.prefix || '').trim();
        const isMale = gender === 'ชาย' || gender.toLowerCase() === 'male' || 
                       prefix === 'ด.ช.' || prefix === 'เด็กชาย' || prefix === 'นาย';
        const isFemale = gender === 'หญิง' || gender.toLowerCase() === 'female' || 
                         prefix === 'ด.ญ.' || prefix === 'เด็กหญิง' || prefix === 'นางสาว' || prefix === 'นาง';
        
        if (isMale) acc[level].male++;
        else if (isFemale) acc[level].female++;
        
        if (acc[level].names.length < 20) {
          acc[level].names.push(`${curr.prefix || ''}${curr.first_name} ${curr.last_name}`);
        }
        return acc;
      }, {});

      const staticDbContext = `
      สถิติทั่วไปในฐานข้อมูล (เฉพาะนักเรียนสถานะปกติ ปีการศึกษา ${currentYear}):
      - จำนวนนักเรียนปัจจุบัน: ${fallbackStudentCount || studentStats?.length || 0} คน
      - สรุปแยกตามศาสนา: ${Object.entries(religionStats).map(([r, c]) => `${r} ${c} คน`).join(', ')}
      - รายละเอียดรายชั้น: ${Object.entries(studentSummary || {}).map(([lv, s]: any) => 
          `ชั้น ${lv}: ${s.total} คน (ชาย ${s.male}, หญิง ${s.female}) [รายชื่อ: ${s.names.join(', ')}${s.total > 20 ? ' ...และคนอื่นๆ' : ''}]`
        ).join('\n      - ')}
      - จำนวนบุคลากรครูทั้งหมด: ${fallbackTeacherCount || 0} คน
      `;

      const dbContext = dbContextParts.length > 0
        ? `${dbContextParts.join('\n\n')}\n\n---\n${staticDbContext}`
        : staticDbContext;

      // 2. ค้นหาข้อมูลจาก "สมองอัจฝริยะ" (Vector Search จากไฟล์ PDF ของคลังกลาง)
      let matches: any[] = [];
      let globalKeywordMatches: any[] = [];

      if (queryPlan.need_rag !== false && (searchSource === 'all' || searchSource === 'global')) {
        // --- 2.1 Vector Search (semantic) ---
        try {
          matches = await searchKnowledge(userMsg, apiKey, 5);
        } catch (searchErr) {
          console.error('Error searching global knowledge (vector):', searchErr);
        }

        // --- 2.2 Keyword Search (fallback/hybrid) ---
        try {
          const keywords = userMsg.toLowerCase().split(/[\s,，.、?？!！]+/g).filter(w => w.length > 1);
          if (keywords.length > 0) {
            let kwQuery = supabase
              .from('school_knowledge')
              .select('document_name, page_number, chunk_text');
            
            const filters = keywords.slice(0, 3).map(kw => `chunk_text.ilike.%${kw}%`).join(',');
            const { data: kwData } = await kwQuery.or(filters).limit(5);
            
            if (kwData) {
              globalKeywordMatches = kwData.map(d => ({
                document_name: d.document_name,
                page_number: d.page_number,
                chunk_text: d.chunk_text,
                is_keyword_match: true
              }));
            }
          }
        } catch (kwErr) {
          console.error('Error searching global knowledge (keywords):', kwErr);
        }
      }
      
      // 3. ค้นหาและดึงรายการข้อมูลจาก "เอกสารส่วนตัว" (Virtual Drive)
      let privateMatches: any[] = [];
      let personalDocsList = "ไม่มีเอกสารอัปโหลดในห้องส่วนตัว";
      
      try {
        const { data: personalDocs } = await supabase
          .from('ai_knowledge_base')
          .select('file_name, folder_name, created_at, content_text')
          .eq('teacher_id', user?.id)
          .order('created_at', { ascending: false });

        if (personalDocs && personalDocs.length > 0) {
          personalDocsList = personalDocs.map((doc, idx) => 
            `- [ลำดับที่ ${idx + 1}] ชื่อไฟล์: ${doc.file_name} (อัปโหลดเมื่อ: ${new Date(doc.created_at).toLocaleString('th-TH')}, โฟลเดอร์: ${doc.folder_name})`
          ).join('\n');

          if (searchSource === 'all' || searchSource === 'private') {
            // ค้นหาแบบ Keyword
            privateMatches = searchPersonalDocs(userMsg, personalDocs);

            // คืนค่าระบบช่วยเหลือ RAG จากรุ่น 1.0.6:
            // หากค้นหาคำสำคัญไม่เจอบนไฟล์ส่วนตัว แต่คุณครูถามถึงของล่าสุด หรือขอสรุป/วิเคราะห์ หรือในไดรฟ์มีไฟล์เดียว
            // ให้ดึงไฟล์ล่าสุดเพียง 1 ไฟล์มาเป็น Context เพื่อเพิ่มความแม่นยำสูงสุด (ไม่นำไฟล์อื่นๆ ที่ไม่เกี่ยวมาปะปน)
            const isAskingForLatest = userMsg.includes('ล่าสุด') || userMsg.includes('เพิ่ง') || userMsg.includes('พึ่ง') || userMsg.includes('อันใหม่') || userMsg.includes('ใหม่สุด') || userMsg.includes('อัพเดท') || userMsg.includes('อัปเดต');
            const isAskingForSummaryOrInfo = userMsg.includes('สรุป') || userMsg.includes('วิเคราะห์') || userMsg.includes('อ่าน') || userMsg.includes('คืออะไร') || userMsg.includes('ข้อมูล');
            const hasOnlyOneDoc = personalDocs.length === 1;

            if (privateMatches.length === 0 && (isAskingForLatest || isAskingForSummaryOrInfo || hasOnlyOneDoc)) {
              const latestDoc = personalDocs[0];
              const snippet = latestDoc.content_text 
                ? latestDoc.content_text.substring(0, 1500) 
                : "(ไฟล์นี้ไม่มีเนื้อหาข้อความหรือไม่ได้เป็น PDF)";
              
              privateMatches.push({
                file_name: latestDoc.file_name,
                snippet: snippet,
                score: 100
              });
            }
          }
        }
      } catch (privateSearchErr) {
        console.error('Error searching personal documents:', privateSearchErr);
      }

      // 4. จัดรูปแบบบริบททั้งหมด
      const combinedGlobalMatches = [...matches];
      globalKeywordMatches.forEach(kwm => {
        if (!combinedGlobalMatches.find(m => m.chunk_text === kwm.chunk_text)) {
          combinedGlobalMatches.push(kwm);
        }
      });

      const knowledgeContext = combinedGlobalMatches.length > 0 
        ? combinedGlobalMatches.map((m: any) => `[อ้างอิงคลังกลาง: ${m.document_name} หน้า ${m.page_number}${m.is_keyword_match ? ' - ค้นหาพบจากคำสำคัญ' : ''}]\n${m.chunk_text}`).join('\n\n')
        : "ไม่พบข้อมูลที่ตรงกันโดยตรงในคลังปัญญาโรงเรียน (ส่วนกลาง)";

      const privateContext = privateMatches.length > 0
        ? privateMatches.map((m: any) => `[อ้างอิงเอกสารส่วนตัวของคุณครู: ${m.file_name}]\n${m.snippet}`).join('\n\n')
        : "ไม่พบข้อมูลที่ตรงกันในเอกสารส่วนตัวของคุณครู (ห้องส่วนตัว)";

      // 5. สร้าง Prompt สำหรับ Gemini
      const isWorksheet = userMsg.includes('ใบงาน') || userMsg.includes('ฝึกหัด') || userMsg.includes('ข้อสอบ');
      const isMemo = userMsg.includes('บันทึกข้อความ') || userMsg.includes('โครงการ') || userMsg.includes('ร่าง');
      const isAnalysis = userMsg.includes('วิเคราะห์') || userMsg.includes('เสนอแนะ') || userMsg.includes('สรุป');
      const isSocial = userMsg.includes('โพสต์') || userMsg.includes('ประชาสัมพันธ์') || userMsg.includes('Facebook');
      const isCreative = userMsg.includes('กิจกรรม') || userMsg.includes('เกม') || userMsg.includes('สร้างสรรค์');

      const prompt = `คุณคือ AI Cowork ผู้ช่วยครูอัจฉริยะของโรงเรียนบ้านควนโคกยา
      
      [ความสามารถพิเศษที่ต้องใช้ในครั้งนี้]
      ${isWorksheet ? '- ทำหน้าที่เป็น: "ครูวิชาการเชี่ยวชาญด้านการออกแบบสื่อการสอน"' : ''}
      ${isMemo ? '- ทำหน้าที่เป็น: "ผู้เชี่ยวชาญงานสารบรรณและธุรการโรงเรียน"' : ''}
      ${isAnalysis ? '- ทำหน้าที่เป็น: "นักวิเคราะห์ข้อมูลและที่ปรึกษาผู้บริหารโรงเรียน"' : ''}
      ${isSocial ? '- ทำหน้าที่เป็น: "นักประชาสัมพันธ์และคอนเทนต์ครีเอเตอร์มือโปร"' : ''}
      ${isCreative ? '- ทำหน้าที่เป็น: "นักออกแบบการเรียนรู้เชิงสร้างสรรค์ (Learning Designer)"' : ''}

      [ส่วนที่ 1: ข้อมูลจริงจากระบบฐานข้อมูล (สืบค้นด้วย Dynamic Query Solver มีความแม่นยำสูง)]
      ${dbContext}

      [ส่วนที่ 2: ข้อมูลจากคลังปัญญาโรงเรียน (ส่วนกลาง)]
      ${knowledgeContext}

      [ส่วนที่ 3: ข้อมูลจากเอกสารส่วนตัวของคุณครู (ห้องส่วนตัว)]
      * รายชื่อไฟล์ทั้งหมดใน Virtual Drive ของครูผู้นี้ (เรียงจากใหม่สุดไปเก่าสุด):
      ${personalDocsList}
      
      * เนื้อหาจากไฟล์ที่เกี่ยวข้องหรือค้นพบ (Snippet):
      ${privateContext}

      คำถามของคุณครู: ${userMsg}

      คำแนะนำและกฎการตอบคำถามแบบ Hybrid (Hybrid Prompt System):
      * การตัดสินใจเลือกรูปแบบคำตอบ:
        - หากคำถามเป็นการสั่งให้สร้างชิ้นงานเฉพาะทาง เช่น ออกแบบใบงาน/ข้อสอบ, ร่างจดหมายราชการ/บันทึกข้อความ, วิเคราะห์สถิติข้อมูลเชิงลึก, ร่างโพสต์ Facebook/PR หรือออกแบบกิจกรรมการเรียนรู้/เกม ให้บังคับใช้ "กฎเหล็กการตอบสำหรับงานเฉพาะทาง (STRICT RULES)" อย่างเข้มงวดและครบถ้วนตามรูปแบบที่กำหนด
        - หากไม่ใช่คำถามเฉพาะทาง (เช่น เป็นการถามคำถามทั่วไป, ขอสรุปสาระสำคัญ, สอบถามสถิติทั่วไป, ปรึกษาวิธีปฏิบัติการสอน หรือพูดคุยทั่วไป) ให้ใช้ "กฎทั่วไปสำหรับการตอบคำถามทั่วไป" เพื่อให้คำตอบที่สั้น กระชับ สลวย ตรงประเด็น ทันใจ โดยไม่ต้องใช้โครงสร้างเอกสารหรือหัวข้อย่อยที่ซับซ้อนเกินความจำเป็น

      [กฎทั่วไปสำหรับการตอบคำถามทั่วไป (ถอดแบบจากเวอร์ชัน 1.0.6)]
      1. หากคำถามเกี่ยวกับ "จำนวน" หรือ "สถิติ" ของโรงเรียน ให้วิเคราะห์และตอบโดยอ้างอิงจากตัวเลขและข้อมูลจริงใน [ส่วนที่ 1] อย่างแม่นยำ
      2. หากคำถามเกี่ยวกับ "ระเบียบ" หรือ "วิธีปฏิบัติ" ส่วนกลาง ให้ใช้ข้อมูลอ้างอิงคลังกลางจาก [ส่วนที่ 2] ในการตอบ
      3. หากคำถามเกี่ยวกับ "เอกสารหรือไฟล์ส่วนตัว" ให้ตรวจสอบและใช้ข้อมูลจาก [ส่วนที่ 3]
      4. หากคุณครูถามถึง "เอกสารล่าสุด" หรือขอสรุปไฟล์ล่าสุด ให้ตรวจสอบไฟล์ล่าสุดจาก [ส่วนที่ 3] และสรุปเนื้อหาหลักให้ชัดเจน ครอบคลุมสาระสำคัญ
      5. จัดรูปแบบคำตอบให้อ่านง่ายที่สุด โดยใช้ Markdown (## หัวข้อ, **ตัวหนา**, รายการข้อ) เพื่อเน้นข้อมูลสำคัญ
      6. หากไม่พบข้อมูลในฐานข้อมูล คลังกลาง หรือเอกสารส่วนตัว ให้ระบุอย่างชัดเจนว่า "ไม่พบข้อมูลนี้ในระบบของโรงเรียน" และให้คำแนะนำหรือวิเคราะห์เพิ่มเติมตามหลักการทั่วไป
      7. ใช้ภาษาไทยที่สุภาพ เป็นทางการแต่มีความเป็นกันเอง มีหางเสียง (ครับ/ค่ะ) เสมอ

      [กฎเหล็กการตอบสำหรับงานเฉพาะทาง (STRICT RULES FOR SPECIALIZED WORK)]
      1. ออกแบบใบงาน/แบบฝึกหัด/ข้อสอบ: ออกแบบโครงสร้างใบงานให้ชัดเจน (ชื่อ-นามสกุล, ชั้น, เลขที่, คำชี้แจง, โจทย์คำถาม) และต้องแยกเฉลย (Answer Key) ไว้ส่วนท้ายสุดเสมอ
      2. ร่างบันทึกข้อความ/โครงการ: ร่างข้อความตามแบบฟอร์มหนังสือราชการอย่างสละสลวย (ส่วนราชการ, ที่, วันที่, เรื่อง, คำขึ้นต้น, เนื้อหาภาคเหตุ-ภาคประสงค์-ภาคสรุป)
      3. วิเคราะห์ข้อมูลเชิงลึก: อ้างอิงตัวเลขสถิติจริงจาก [ส่วนที่ 1] พร้อมเสนอข้อเสนอแนะเชิงรุก (Actionable Advice) อย่างน้อย 3 ข้อที่เป็นรูปธรรม
      4. ร่างโพสต์ประชาสัมพันธ์/Facebook PR: เขียนเนื้อหาดึงดูด น่าติดตาม (Engagement) มีอีโมจิสร้างสรรค์ และติดแฮชแท็ก (#) ของโรงเรียน
      5. ออกแบบกิจกรรม/เกมการเรียนรู้: กำหนดรายละเอียดกิจกรรม (ขั้นตอน How to play, อุปกรณ์, เกณฑ์ประเมินผล) เน้นการเรียนรู้แบบ Active Learning
      6. จัดรูปแบบให้สวยงาม มีช่องว่างที่อ่านง่าย ไม่บีบอัดข้อความยาวเกินไป`;

      let modelsToTry = await getAvailableModels(apiKey);
      if (modelsToTry.length === 0) {
        modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
      }

      const apiVersions = ["v1beta", "v1"];
      let aiResponseText = "";
      let success = false;
      let lastErrorMessage = "";

      for (const modelName of modelsToTry) {
        if (success) break;
        for (const version of apiVersions) {
          if (success) break;
          try {
            const url = `https://generativelanguage.googleapis.com/${version}/models/${modelName}:generateContent?key=${apiKey.trim()}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.7,
                  topP: 0.95,
                  maxOutputTokens: 2048,
                }
              })
            });

            const resData = await response.json();
            if (response.ok && resData.candidates?.[0]?.content?.parts?.[0]?.text) {
              aiResponseText = resData.candidates[0].content.parts[0].text.trim();
              success = true;
            } else if (resData.error) {
              lastErrorMessage = resData.error.message;
              console.warn(`AICowork: Model ${modelName} (${version}) failed:`, lastErrorMessage);
            } else if (resData.candidates?.[0]?.finishReason) {
              lastErrorMessage = `AI ปฏิเสธการตอบคำถาม (สาเหตุ: ${resData.candidates[0].finishReason})`;
            }
          } catch (fetchErr: any) {
            lastErrorMessage = fetchErr.message;
            console.error(`AICowork: Fetch error with ${modelName} (${version}):`, fetchErr);
          }
        }
      }

      if (!success) {
        throw new Error(lastErrorMessage || 'ไม่สามารถติดต่อ AI ได้ในขณะนี้ โปรดตรวจสอบ API Key ของคุณ');
      }
      
      setMessages(prev => [...prev, { role: 'ai', text: aiResponseText }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: `ขออภัยครับ เกิดข้อผิดพลาด: ${err.message}` }]);
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
                   <h3 className="font-black text-slate-800 text-sm">Gemini AI Assistant</h3>
                   <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div> Online
                   </p>
                </div>
             </div>
             <button onClick={() => setMessages([{ role: 'ai', text: 'รีเซ็ตการสนทนาเรียบร้อยครับ มีอะไรให้ช่วยไหมครับ?' }])} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
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
                  <div className="whitespace-pre-wrap prose-sm max-w-none prose-headings:text-slate-800 prose-headings:font-black prose-strong:text-brand-primary prose-strong:font-black">
                     {msg.text.split('\n').map((line: string, index: number) => {
                        // Simple Markdown rendering for headers
                        if (line.startsWith('# ')) return <h1 key={index} className="text-xl font-black mb-4 mt-2 text-slate-800">{line.replace('# ', '')}</h1>;
                        if (line.startsWith('## ')) return <h2 key={index} className="text-lg font-black mb-3 mt-4 text-slate-800">{line.replace('## ', '')}</h2>;
                        if (line.startsWith('### ')) return <h3 key={index} className="text-base font-black mb-2 mt-3 text-slate-700">{line.replace('### ', '')}</h3>;
                        
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
                            // สไตล์ตัวหนาพรีเมียมสีเหลืองทองครีม สวยงามนำสายตา อ่านง่าย สบายตา
                            return (
                              <strong key={pIdx} className="bg-amber-50 text-slate-900 px-1.5 py-0.5 rounded-md border border-amber-100 font-bold mx-0.5 shadow-2xs">
                                {part.slice(2, -2)}
                              </strong>
                            );
                          }
                          return part;
                        });
                        
                        if (isBullet) {
                          let bulletIndicator = <span className="text-brand-primary mt-2 min-w-[6px] h-[6px] rounded-full bg-brand-primary"></span>;
                          if (indentLevel === 1) {
                            bulletIndicator = <span className="text-brand-primary mt-1.5 min-w-[6px] h-[6px] rounded-full border border-brand-primary bg-transparent"></span>;
                          } else if (indentLevel >= 2) {
                            bulletIndicator = <span className="text-brand-primary mt-2 min-w-[5px] h-[5px] bg-brand-primary/80"></span>;
                          }
                          
                          return (
                            <div key={index} className="flex items-start gap-2 mb-2" style={{ paddingLeft: `${(indentLevel + 1) * 16}px` }}>
                              {bulletIndicator}
                              <span className="flex-1 text-slate-700">{renderedContent}</span>
                            </div>
                          );
                        }
                        
                        if (isNumbered) {
                          const numMatch = trimmedLine.match(/^(\d+(\.\d+)*)\.\s/);
                          const num = numMatch ? numMatch[1] : '1';
                          return (
                            <div key={index} className="flex items-start gap-2 mb-2" style={{ paddingLeft: `${(indentLevel + 1) * 16}px` }}>
                              <span className="text-brand-primary font-black text-xs min-w-[20px]">{num}.</span>
                              <span className="flex-1 text-slate-700">{renderedContent}</span>
                            </div>
                          );
                        }
                        
                        if (line.trim() === '') {
                          return <div key={index} className="h-2"></div>;
                        }
                        
                        return (
                          <p key={index} className="mb-2 last:mb-0 text-slate-700">
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
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI กำลังวิเคราะห์คลังปัญญา...</span>
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
                  placeholder="พิมพ์คำถามของคุณครูที่นี่ (เช่น ช่วยสรุประเบียบพัสดุในคลังให้หน่อย)..." 
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

             <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                     <Loader2 className="animate-spin mb-4" size={40} />
                     <p className="font-bold uppercase tracking-widest text-[10px]">กำลังโหลดคลังเอกสาร...</p>
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
                     <p className="text-[10px] font-bold mt-1 text-slate-400">อัปโหลดไฟล์แรกของคุณครูเพื่อเริ่มให้ AI ช่วยวิเคราะห์</p>
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
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">คลังปัญญาโรงเรียน (ระบบอ่านและจดจำเนื้อหาอัตโนมัติ)</p>
            </div>
            <div className="flex gap-3">
              <label className={`bg-brand-primary text-white px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-green-100 transition-all active:scale-95 ${isProcessing ? 'opacity-50 pointer-events-none' : 'hover:bg-green-700'}`}>
                <input type="file" className="hidden" accept="application/pdf" onChange={handleKnowledgeUpload} />
                <UploadCloud size={20} /> สอนงาน AI (ป้อน PDF)
              </label>
            </div>
          </div>

          {isProcessing && processingStatus && (
            <div className="p-8 bg-blue-600 text-white animate-in slide-in-from-top duration-500">
               <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                     <Loader2 className="animate-spin" size={24} />
                     <div>
                        <p className="font-black text-lg">AI กำลังอ่านและจดจำเนื้อหา...</p>
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
               <p className="text-[10px] font-black uppercase mt-4 tracking-widest text-center opacity-80">* กรุณาอย่าปิดหน้านี้จนกว่าการประมวลผลจะเสร็จสิ้น *</p>
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
                    <CheckCircle2 size={14} className="text-green-500" /> จดจำเข้าระบบแล้ว
                  </p>
                  <div className="mt-6 pt-6 border-t border-slate-100 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase">
                    <span>วันที่จดจำ: {new Date(file.created_at).toLocaleDateString('th-TH')}</span>
                  </div>
                </div>
              ))}

              {knowledgeFiles.length === 0 && !loading && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300 border-4 border-dashed border-slate-50 rounded-[40px]">
                   <BrainCircuit size={80} className="mb-6 opacity-10" />
                   <p className="text-xl font-black uppercase tracking-[0.2em]">สมอง AI ยังว่างเปล่า</p>
                   <p className="text-sm font-bold mt-2 text-slate-400 max-w-sm text-center">เริ่มสอนงาน AI โดยการอัปโหลดระเบียบหรือคู่มือการทำงานของโรงเรียน เพื่อให้ AI ช่วยตอบคำถามและร่างเอกสารได้แม่นยำขึ้น</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
