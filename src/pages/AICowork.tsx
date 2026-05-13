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
  ArrowRight
} from 'lucide-react';
import { extractTextFromPdf } from '../lib/aiService';

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
  const [activeView, setActiveTab] = useState<'chat' | 'drive'>('chat');
  const [loading, setLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchTerm] = useState('');

  // Chat States
  const [messages, setMessages] = useState<any[]>([
    { role: 'ai', text: 'สวัสดีครับ ผม AI Cowork ผู้ช่วยอัจฉริยะของคุณครู มีอะไรให้ผมช่วยสรุปหรือค้นหาข้อมูลจากคลังเอกสารของคุณครูไหมครับ?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeView === 'drive') fetchFiles();
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
      const { data: settings } = await supabase.from('settings').select('gemini_api_key, ai_cowork_api_key').single();
      const apiKey = settings?.ai_cowork_api_key || settings?.gemini_api_key;
      
      if (!apiKey) throw new Error('กรุณาตั้งค่า API Key ก่อนใช้งาน');

      // 1. Semantic Search (Simple keywords for now)
      const { data: kbFiles } = await supabase.from('ai_knowledge_base')
        .select('content_text, file_name')
        .eq('teacher_id', user?.id)
        .limit(5);
      
      const context = kbFiles?.map(f => `[จากไฟล์: ${f.file_name}]\n${f.content_text?.substring(0, 1000)}`).join('\n\n') || "ไม่มีข้อมูลในคลัง";

      // 2. Call Gemini
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const prompt = `คุณคือ AI Cowork ผู้ช่วยครูอัจฉริยะ 
      ข้อมูลบริบทจากคลังเอกสารของครู:
      ${context}

      คำถามของครู: ${userMsg}

      ตอบคำถามโดยอ้างอิงจากข้อมูลที่มี (ถ้ามี) หากไม่มีให้ตอบตามความรู้ของคุณในฐานะผู้ช่วยครู ใช้ภาษาที่เป็นกันเองแต่สุภาพ และเป็นมืออาชีพ`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const resData = await response.json();
      const aiText = resData.candidates?.[0]?.content?.parts?.[0]?.text || "ขออภัยครับ ผมไม่สามารถประมวลผลคำตอบได้ในขณะนี้";
      
      setMessages(prev => [...prev, { role: 'ai', text: aiText }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: `เกิดข้อผิดพลาด: ${err.message}` }]);
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
          <Database size={18} /> Virtual Drive (คลังครู)
        </button>
      </div>

      {activeView === 'chat' ? (
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
                <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-brand-primary text-white rounded-tr-none' : 'bg-slate-50 text-slate-700 rounded-tl-none border border-slate-100'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-slate-50 p-4 rounded-2xl rounded-tl-none border border-slate-100">
                  <Loader2 size={20} className="animate-spin text-brand-primary" />
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
                  placeholder="พิมพ์คำถามของคุณครูที่นี่ (เช่น ช่วยสรุปแผนการสอนในคลังให้หน่อย)..." 
                  className="w-full pl-6 pr-14 py-4 bg-white border border-slate-200 rounded-[24px] font-bold text-slate-700 outline-hidden focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary transition-all shadow-sm"
                />
                <button type="submit" className="absolute right-2 top-2 w-10 h-10 bg-brand-primary text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all">
                   <Send size={18} />
                </button>
             </div>
             <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-widest mt-3">ขับเคลื่อนด้วย Google Gemini AI • ข้อมูลของคุณจะถูกเก็บเป็นความลับ</p>
          </form>
        </div>
      ) : (
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
    </div>
  );
}
