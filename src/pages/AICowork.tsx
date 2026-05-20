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
  FileSearch
} from 'lucide-react';
import { extractTextFromPdf, getAvailableModels, processDocumentToKnowledge, searchKnowledge } from '../lib/aiService';

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

export default function AICowork() {
  const { user } = useAuth();
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
  const chatEndRef = useRef<HTMLDivElement>(null);

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
      // 1. Upload to Storage
      const path = `kb/${user?.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);

      // 2. Extract Text (if PDF)
      let extractedText = "";
      if (file.type === 'application/pdf') {
        const buffer = await file.arrayBuffer();
        extractedText = await extractTextFromPdf(buffer);
      }

      // 3. Save to DB
      const folderName = KNOWLEDGE_FOLDERS.find(f => f.id === selectedFolder)?.name || 'อื่นๆ';
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
      const path = url.split('/').pop()?.split('?')[0];
      if (path) await supabase.storage.from('documents').remove([`kb/${user?.id}/${path}`]);
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

      // 1. ดึงข้อมูลสถิติจริงจากฐานข้อมูล (ประสานระบบเก่า)
      // กรองเฉพาะปีการศึกษาปัจจุบัน, สถานะปกติ และดึงชื่อมาด้วย
      const { data: studentStats } = await supabase
        .from('students')
        .select('class_level, gender, prefix, first_name, last_name, graduation_status')
        .eq('academic_year', currentYear)
        .eq('graduation_status', 'ปกติ');

      const { count: teacherCount } = await supabase.from('teachers').select('*', { count: 'exact', head: true });
      const { data: utilityStats } = await supabase.from('utilities').select('amount').order('created_at', { ascending: false }).limit(5);

      // จัดรูปแบบสถิตินักเรียนและรายชื่อ
      const studentSummary = studentStats?.reduce((acc: any, curr: any) => {
        const level = curr.class_level || 'ไม่ระบุ';
        if (!acc[level]) acc[level] = { total: 0, male: 0, female: 0, names: [] };
        acc[level].total++;
        
        // ตรวจสอบเพศแบบละเอียด (ชาย, ด.ช., เด็กชาย, Male)
        const gender = (curr.gender || '').trim();
        const prefix = (curr.prefix || '').trim();
        const isMale = gender === 'ชาย' || gender.toLowerCase() === 'male' || 
                       prefix === 'ด.ช.' || prefix === 'เด็กชาย' || prefix === 'นาย';
        const isFemale = gender === 'หญิง' || gender.toLowerCase() === 'female' || 
                         prefix === 'ด.ญ.' || prefix === 'เด็กหญิง' || prefix === 'นางสาว' || prefix === 'นาง';
        
        if (isMale) acc[level].male++;
        else if (isFemale) acc[level].female++;
        
        // เก็บรายชื่อ (เก็บสูงสุด 20 คนต่อชั้นเพื่อความละเอียด)
        if (acc[level].names.length < 20) {
          acc[level].names.push(`${curr.prefix || ''}${curr.first_name} ${curr.last_name}`);
        }
        return acc;
      }, {});

      const dbContext = `
      ข้อมูลจริงจากระบบฐานข้อมูล (เฉพาะนักเรียนสถานะปกติ ปีการศึกษา ${currentYear}):
      - จำนวนนักเรียนปัจจุบัน: ${studentStats?.length || 0} คน
      - รายละเอียดรายชั้น: ${Object.entries(studentSummary || {}).map(([lv, s]: any) => 
          `ชั้น ${lv}: ${s.total} คน (ชาย ${s.male}, หญิง ${s.female}) [รายชื่อ: ${s.names.join(', ')}${s.total > 20 ? ' ...และคนอื่นๆ' : ''}]`
        ).join('\n      - ')}
      - จำนวนบุคลากรครู: ${teacherCount || 0} คน
      - ข้อมูลค่าสาธารณูปโภคล่าสุด: ${utilityStats?.map(u => `${u.amount} บาท`).join(', ')}
      `;

      // 2. ค้นหาข้อมูลจาก "สมองอัจฉริยะ" (Vector Search จากไฟล์ PDF)
      const matches = await searchKnowledge(userMsg, apiKey, 5);
      
      // 3. จัดรูปแบบบริบททั้งหมด
      const knowledgeContext = matches.length > 0 
        ? matches.map((m: any) => `[อ้างอิง: ${m.document_name} หน้า ${m.page_number}]\n${m.chunk_text}`).join('\n\n')
        : "ไม่พบข้อมูลที่ตรงกันโดยตรงในคลังปัญญาโรงเรียน";

      // 4. สร้าง Prompt สำหรับ Gemini
      const prompt = `คุณคือ AI Cowork ผู้ช่วยครูอัจฉริยะของโรงเรียนบ้านควนโคกยา
      
      [ส่วนที่ 1: ข้อมูลจริงจากระบบฐานข้อมูล]
      ${dbContext}

      [ส่วนที่ 2: ข้อมูลจากคลังปัญญา (ไฟล์ระเบียบ/PDF)]
      ${knowledgeContext}

      คำถามของคุณครู: ${userMsg}

      คำแนะนำในการตอบ:
      1. หากคำถามเกี่ยวกับ "จำนวน" หรือ "สถิติ" ให้ใช้ข้อมูลจาก [ส่วนที่ 1] ในการตอบทันที
      2. หากคำถามเกี่ยวกับ "ระเบียบ" หรือ "วิธีปฏิบัติ" ให้ใช้ข้อมูลจาก [ส่วนที่ 2] ในการตอบ
      3. จัดรูปแบบคำตอบให้ "อ่านง่ายที่สุด" โดยใช้ Markdown (## หัวข้อ, **ตัวหนา**, รายการข้อ)
      4. หากข้อมูลใดไม่มีทั้งในฐานข้อมูลและคลังปัญญา ให้ตอบตามความรู้พื้นฐานและแจ้งว่า "ข้อมูลนี้ไม่อยู่ในฐานข้อมูลโรงเรียน"
      5. ใช้ภาษาไทยที่สุภาพ เป็นทางการแต่เป็นกันเอง`;

      let modelsToTry = await getAvailableModels(apiKey);
      if (modelsToTry.length === 0) {
        modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];
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
        <button 
          onClick={() => setActiveTab('intelligence')} 
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all ${activeView === 'intelligence' ? 'bg-brand-primary text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <BrainCircuit size={18} /> Intelligence Hub
        </button>
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
                        if (line.startsWith('# ')) return <h1 key={index} className="text-xl font-black mb-4 mt-2">{line.replace('# ', '')}</h1>;
                        if (line.startsWith('## ')) return <h2 key={index} className="text-lg font-black mb-3 mt-4 text-slate-800">{line.replace('## ', '')}</h2>;
                        if (line.startsWith('### ')) return <h3 key={index} className="text-base font-black mb-2 mt-3 text-slate-700">{line.replace('### ', '')}</h3>;
                        
                        // Simple Bold rendering **text**
                        const parts = line.split(/(\*\*.*?\*\*)/g);
                        return (
                          <p key={index} className="mb-2 last:mb-0">
                            {parts.map((part, pIdx) => {
                              if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={pIdx} className="font-black text-slate-900 bg-yellow-50 px-1 rounded-sm">{part.slice(2, -2)}</strong>;
                              }
                              return part;
                            })}
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

      {activeView === 'intelligence' && (
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
