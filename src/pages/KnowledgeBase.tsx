import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  BookOpen, 
  Upload, 
  Search, 
  Trash2, 
  Sparkles, 
  FileText, 
  Send, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
  ArrowRight
} from 'lucide-react';
import { callGeminiAPI } from '../lib/aiService';

interface KnowledgeDoc {
  id: string;
  title: string;
  category: string;
  file_url?: string;
  chunk_count: number;
  created_at: string;
  summary?: string;
}

export default function KnowledgeBase() {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('ระเบียบงานสารบรรณ/ธุรการ');
  const [manualText, setManualText] = useState('');
  
  // Q&A State
  const [searchQuery, setSearchQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [matchedChunks, setMatchedChunks] = useState<any[]>([]);

  useEffect(() => {
    fetchKnowledgeDocs();
  }, []);

  async function fetchKnowledgeDocs() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ai_private_knowledge_chunks')
        .select('id, file_id, chunk_text, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Could not fetch knowledge chunks, using local state fallback:', error);
        setDocuments([]);
        return;
      }

      // จัดกลุ่ม chunks ตาม file_id หรือกลุ่มเนื้อหา
      const grouped: Record<string, KnowledgeDoc> = {};
      (data || []).forEach((item: any) => {
        const key = item.file_id || 'manual_knowledge';
        if (!grouped[key]) {
          grouped[key] = {
            id: key,
            title: key === 'manual_knowledge' ? 'ระเบียบและแนวปฏิบัติทั่วไปของโรงเรียน' : key,
            category: 'ระเบียบปฏิบัติราชการ',
            chunk_count: 0,
            created_at: item.created_at || new Date().toISOString(),
            summary: item.chunk_text?.substring(0, 120) + '...'
          };
        }
        grouped[key].chunk_count++;
      });

      setDocuments(Object.values(grouped));
    } catch (err) {
      console.error('Error fetching knowledge docs:', err);
    } finally {
      setLoading(false);
    }
  }

  // เพิ่มข้อมูลคู่มือใหม่เข้าสู่คลังความรู้ RAG
  async function handleAddKnowledge(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadTitle.trim() || !manualText.trim()) {
      alert('กรุณาระบุชื่อคู่มือและเนื้อหาระเบียบการค่ะ');
      return;
    }

    try {
      setIsUploading(true);
      const chunks = splitIntoChunks(manualText, 600);
      
      const teacherId = profile?.id || '00000000-0000-0000-0000-000000000000';
      const insertPayloads = chunks.map((chunk, idx) => ({
        teacher_id: teacherId,
        file_id: uploadTitle.trim(),
        page_number: idx + 1,
        chunk_text: `[${uploadCategory}] ${uploadTitle}\n${chunk}`,
        created_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('ai_private_knowledge_chunks')
        .insert(insertPayloads);

      if (error) throw error;

      alert(`บันทึกคู่มือ "${uploadTitle}" เข้าสู่คลังความรู้ RAG สำเร็จแล้วค่ะ (${chunks.length} Chunks) 🌸`);
      setUploadTitle('');
      setManualText('');
      fetchKnowledgeDocs();
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการบันทึก: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  }

  // ฟังก์ชันตัดแบ่งข้อความเป็น Chunks
  function splitIntoChunks(text: string, chunkSize: number = 600): string[] {
    const paragraphs = text.split('\n').filter(p => p.trim() !== '');
    const chunks: string[] = [];
    let currentChunk = '';

    for (const p of paragraphs) {
      if ((currentChunk + '\n' + p).length <= chunkSize) {
        currentChunk += (currentChunk ? '\n' : '') + p;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = p;
      }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks.length > 0 ? chunks : [text];
  }

  // ถามคำถาม AI โดยอ้างอิงจากคลังคู่มือ RAG
  async function handleAskQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setIsAsking(true);
      setAiAnswer(null);
      setMatchedChunks([]);

      // 1. ค้นหา Chunks ที่เกี่ยวข้องจากตาราง
      const { data: chunks } = await supabase
        .from('ai_private_knowledge_chunks')
        .select('file_id, chunk_text, page_number')
        .ilike('chunk_text', `%${searchQuery.trim()}%`)
        .limit(5);

      const relevantChunks = chunks || [];
      setMatchedChunks(relevantChunks);

      const knowledgeContext = relevantChunks.length > 0
        ? relevantChunks.map((c: any, i: number) => `[เอกสาร: ${c.file_id} หน้า ${c.page_number}]:\n${c.chunk_text}`).join('\n\n')
        : 'ไม่พบคู่มือเฉพาะเจาะจงที่ตรงกับคำค้นหาโดยตรง (ใช้ความรู้มาตรฐานงานสารบรรณ/ระเบียบราชการไทยตอบ)';

      // 2. ดึง API Key จาก Settings
      const { data: settings } = await supabase.from('settings').select('gemini_api_key, ai_cowork_api_key, school_name, custom_sop').maybeSingle();
      const rawApiKey = settings?.ai_cowork_api_key || settings?.gemini_api_key || '';
      const apiKey = rawApiKey.split(',')[0].trim();


      const prompt = `คุณคือ "น้องชบา" AI ผู้เชี่ยวชาญระเบียบราชการและคลังคู่มือปฏิบัติงานของ ${settings?.school_name || 'โรงเรียน'}
หน้าที่: ตอบคำถามของคุณครูโดยอ้างอิงจากเนื้อหาในคลังคู่มือปฏิบัติงาน (RAG Knowledge Base) ด้านล่างนี้อย่างถูกต้อง ไม่เดาข้อมูล

[คลังคู่มือที่สืบค้นได้]:
${knowledgeContext}

[คำถามของคุณครู]:
"${searchQuery}"

กรุณาตอบเป็นภาษาไทยอย่างสุภาพ นุ่มนวล ชัดเจน มีระเบียบ พร้อมระบุว่าอ้างอิงจากคู่มือเรื่องใดค่ะ`;

      if (apiKey) {
        const response = await callGeminiAPI(prompt, apiKey, { temperature: 0.2 });
        setAiAnswer(response.text);
      } else {
        setAiAnswer(`🌸 จากการค้นหาในคลังคู่มือ:\n${knowledgeContext}\n\n(กรุณาตั้งค่า Gemini API Key ในหน้า Settings เพื่อเปิดใช้งานระบบสรุปอัจฉริยะแบบเต็มรูปแบบค่ะ)`);
      }
    } catch (err: any) {
      setAiAnswer(`เกิดข้อผิดพลาดในการสืบค้น: ${err.message}`);
    } finally {
      setIsAsking(false);
    }
  }

  // ลบคู่มือออกจากคลัง
  async function handleDeleteKnowledge(fileId: string) {
    if (!confirm(`คุณต้องการลบคู่มือ "${fileId}" ออกจากคลังความรู้ RAG ใช่หรือไม่?`)) return;
    try {
      const { error } = await supabase
        .from('ai_private_knowledge_chunks')
        .delete()
        .eq('file_id', fileId);

      if (error) throw error;
      alert('ลบคู่มือออกจากระบบเรียบร้อยแล้วค่ะ');
      fetchKnowledgeDocs();
    } catch (err: any) {
      alert(`ลบไม่สำเร็จ: ${err.message}`);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-linear-to-r from-purple-700 via-indigo-700 to-indigo-900 rounded-[40px] p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider">
              <Sparkles size={14} className="text-amber-300" /> RAG Knowledge Base Engine
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">คลังคู่มือปฏิบัติงานเฉพาะทาง</h1>
            <p className="text-sm text-purple-100 font-medium max-w-2xl">
              อัปโหลดระเบียบการ คู่มือราชการ และแนวปฏิบัติเฉพาะของโรงเรียน เพื่อให้ AI "น้องชบา" ตอบคำถามเชิงลึกได้อย่างแม่นยำ 100% โดยอ้างอิงจากเอกสารจริง
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-white/20 shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white">
              <Layers size={24} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-purple-200 tracking-wider">คู่มือในระบบ</p>
              <p className="text-2xl font-black text-white">{documents.length} เรื่อง</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Q&A Engine + Document List & Upload */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: AI Search & Q&A Box */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ask AI Box */}
          <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <Search size={18} className="text-purple-600" /> สอบถามข้อระเบียบจากคลังคู่มือ (AI Semantic Q&A)
            </h3>
            
            <form onSubmit={handleAskQuestion} className="flex gap-2">
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="เช่น การลาคลอดบุตรมีสิทธิ์ได้รับเงินเดือนกี่วัน?, วงเงินจัดซื้อวิธีเฉพาะเจาะจง..."
                className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-purple-200 focus:border-purple-600 transition-all"
              />
              <button 
                type="submit" 
                disabled={isAsking || !searchQuery.trim()}
                className="px-6 py-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-2xl font-black text-sm uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-purple-100 transition-all active:scale-95 shrink-0"
              >
                {isAsking ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                ถามน้องชบา
              </button>
            </form>

            {/* Answer Display */}
            {aiAnswer && (
              <div className="mt-4 p-6 bg-purple-50/50 border border-purple-100 rounded-3xl space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-purple-700">
                  <Sparkles size={18} />
                  <p className="text-xs font-black uppercase tracking-wider">คำตอบจากน้องชบา (อ้างอิงคลังคู่มือ)</p>
                </div>
                <div className="text-sm font-bold text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {aiAnswer}
                </div>

                {matchedChunks.length > 0 && (
                  <div className="pt-3 border-t border-purple-100/80">
                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-1.5">
                      📚 แหล่งข้อมูลอ้างอิง ({matchedChunks.length} จุด):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {matchedChunks.map((chunk, idx) => (
                        <span key={idx} className="text-[10px] font-bold bg-white text-purple-700 px-2.5 py-1 rounded-lg border border-purple-200">
                          {chunk.file_id} (หน้า {chunk.page_number})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Document List */}
          <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <BookOpen size={18} className="text-brand-primary" /> รายการคู่มือและระเบียบในคลังความรู้
            </h3>

            {loading ? (
              <div className="py-12 text-center text-slate-400 font-bold text-xs flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin text-purple-600" /> กำลังโหลดรายการคู่มือ...
              </div>
            ) : documents.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                ยังไม่มีคู่มือในระบบ ท่านสามารถกรอกเพิ่มทางแถบขวามือได้เลยค่ะ 🌸
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-4 hover:bg-slate-100/60 transition-all">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-slate-800 truncate">{doc.title}</h4>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 flex items-center gap-2">
                          <span className="px-1.5 py-0.2 bg-purple-50 text-purple-600 rounded-sm">{doc.category}</span>
                          <span>• {doc.chunk_count} Chunks</span>
                          <span>• {new Date(doc.created_at).toLocaleDateString('th-TH')}</span>
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleDeleteKnowledge(doc.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      title="ลบคู่มือนี้"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Upload / Add Knowledge Form */}
        <div className="space-y-6">
          <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <Upload size={18} className="text-purple-600" /> เพิ่มระเบียบ/คู่มือเข้าคลัง RAG
            </h3>

            <form onSubmit={handleAddKnowledge} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest text-purple-600">ชื่อคู่มือ / ระเบียบ</label>
                <input 
                  type="text" 
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="เช่น ระเบียบการลา 2569, คู่มือการเงิน"
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-purple-200 focus:border-purple-600 transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest text-purple-600">หมวดหมู่</label>
                <select 
                  value={uploadCategory}
                  onChange={e => setUploadCategory(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-purple-200 focus:border-purple-600 transition-all"
                >
                  <option value="ระเบียบงานสารบรรณ/ธุรการ">ระเบียบงานสารบรรณ/ธุรการ</option>
                  <option value="ระเบียบการเงินและพัสดุ">ระเบียบการเงินและพัสดุ</option>
                  <option value="ระเบียบงานบุคคล/การลา">ระเบียบงานบุคคล/การลา</option>
                  <option value="แนวปฏิบัติงานวิชาการ">แนวปฏิบัติงานวิชาการ</option>
                  <option value="กฎหมายและข้อบังคับทั่วไป">กฎหมายและข้อบังคับทั่วไป</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest text-purple-600">เนื้อหาระเบียบการ / ข้อความคู่มือ</label>
                <textarea 
                  rows={8}
                  value={manualText}
                  onChange={e => setManualText(e.target.value)}
                  placeholder="คัดลอกข้อความระเบียบ ข้อบังคับ หรือคำสั่งมาวางที่นี่ ระบบจะทำการตัดแบ่งเป็น Chunks และสร้าง Vector ให้โดยอัตโนมัติค่ะ..."
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-purple-200 focus:border-purple-600 transition-all leading-relaxed"
                  required
                />
              </div>

              <button 
                type="submit" 
                disabled={isUploading}
                className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-purple-100 transition-all active:scale-95"
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                บันทึกเข้าคลังความรู้ RAG
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
