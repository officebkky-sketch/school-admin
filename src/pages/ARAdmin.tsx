import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getARLessons, saveARLesson, deleteARLesson, generateUUID, type ARLesson, type ARStep } from '../lib/arService';
import { callGeminiAPI } from '../lib/aiService';
import { 
  Plus, 
  Trash, 
  Edit, 
  Save, 
  ArrowLeft, 
  Lock, 
  Unlock, 
  Copy, 
  Sparkles, 
  Loader2, 
  Eye, 
  BookOpen,
  X,
  Bot
} from 'lucide-react';

interface ARAdminProps {
  onBack?: () => void;
}

export default function ARAdmin({ onBack }: ARAdminProps) {
  const [lessons, setLessons] = useState<ARLesson[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Editor States
  const [isEditing, setIsEditing] = useState(false);
  const [editLessonId, setEditLessonId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [steps, setSteps] = useState<Omit<ARStep, 'id'>[]>([]);
  const [lessonMode, setLessonMode] = useState<'sequencing' | 'matching'>('sequencing');
  
  // Save loading state
  const [saveLoading, setSaveLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  // น้องชบาช่วยคิดขั้นตอนอัลกอริทึม
  async function handleAICoWorkGenerate() {
    if (!title.trim()) {
      alert('กรุณากรอกชื่อบทเรียน/ด่านก่อนค่ะ เพื่อให้น้องชบานำไปช่วยคิดขั้นตอนได้ถูกต้อง');
      return;
    }
    
    setAiGenerating(true);
    try {
      const { data: settings } = await supabase
        .from('settings')
        .select('gemini_api_key, ai_cowork_api_key')
        .single();
        
      const apiKey = settings?.ai_cowork_api_key || settings?.gemini_api_key;
      if (!apiKey) {
        alert('กรุณาตั้งค่า API Key ในระบบก่อนนะคะ (สามารถตั้งค่าได้ในหน้าตั้งค่าระบบ)');
        setAiGenerating(false);
        return;
      }

      const prompt = `คุณคือน้องชบา ผู้ช่วยอัจฉริยะของคุณครูในโรงเรียนประถมศึกษา
จงช่วยออกแบบบทเรียนวิชาการสำหรับหัวข้อที่ครูกำหนดให้: "${title}"
โดยให้คุณวิเคราะห์ลักษณะหัวข้ออย่างละเอียด และเลือกรูปแบบบทเรียนอย่างชาญฉลาดตามกฎต่อไปนี้:

กฎการตัดสินใจและรูปแบบบทเรียน:

1. หากหัวข้อครูสั่งให้ทำ "โจทย์คณิตศาสตร์เรียงลำดับตัวเลข" หรือเจตนาทำโจทย์ตัวเลขโดยตรง (เช่น "เรียงตัวเลขจากน้อยไปมาก", "โจทย์เรียงตัวเลข", "เรียงลำดับจำนวน 1-50")
   - ห้าม! ออกแบบเป็นขั้นตอนวิธีคิดเด็ดขาด! (ห้ามเขียนขั้นตอนประเภท "เปรียบเทียบตัวเลข", "หาตัวที่น้อยสุด" เป็นต้น)
   - แต่ให้สร้างชุดตัวเลขคณิตศาสตร์สมมติที่มีค่าคละกันจำนวน 3 ถึง 5 ตัวเลข และป้อนตัวเลขเหล่านั้นลงใน step_text ของแต่ละขั้นตอน โดยเรียงลำดับ step_order ให้ถูกต้องตามหลักคณิตศาสตร์จากน้อยไปมาก (หรือตามคำสั่ง)
   - ตัวอย่างหัวข้อ "เรียงตัวเลขจากน้อยไปมาก" (4 ขั้นตอน):
     [
       {"step_order": 1, "step_text": "15", "emoji": "🔢"},
       {"step_order": 2, "step_text": "34", "emoji": "🔢"},
       {"step_order": 3, "step_text": "62", "emoji": "🔢"},
       {"step_order": 4, "step_text": "89", "emoji": "🔢"}
     ]

2. หากหัวข้อครูสั่งให้เป็น "ขั้นตอน/วิธีการ/อัลกอริทึมในการแก้ปัญหา" (เช่น "ขั้นตอนการแก้ปัญหาการเรียงตัวเลข", "ขั้นตอนล้างมือ", "อัลกอริทึมการแปรงฟัน", "ลำดับการตื่นนอน")
   - ให้สร้างขั้นตอนการทำงานย่อย (Algorithm Steps) ในการคิดแก้ปัญหาหรือกระบวนการทำงานจริงตามลำดับก่อนหลัง
   - ตัวอย่างหัวข้อ "ขั้นตอนการแก้ปัญหาการเรียงตัวเลขจากน้อยไปมาก" (4 ขั้นตอน):
     [
       {"step_order": 1, "step_text": "เปรียบเทียบค่าตัวเลขทั้งหมด", "emoji": "🔍"},
       {"step_order": 2, "step_text": "หาตัวเลขที่มีค่าน้อยที่สุด", "emoji": "⬇️"},
       {"step_order": 3, "step_text": "เขียนตัวเลขจากน้อยไปหามาก", "emoji": "✍️"},
       {"step_order": 4, "step_text": "ตรวจสอบความถูกต้องอีกครั้ง", "emoji": "✅"}
     ]

3. หากหัวข้อเป็นเรื่อง "การจับคู่" (คำศัพท์ภาษาอังกฤษ-คำแปล, สมการคณิตศาสตร์-คำตอบ, สัญลักษณ์วิทยาศาสตร์-คำอธิบาย)
   - ให้ใช้โครงสร้าง "โจทย์/คำหลัก : คำตอบ/คำแปล" (มีเครื่องหมายโคลอน :) เช่น "Apple : แอปเปิ้ล" หรือ "3 x 5 : 15" หรือ "H2O : น้ำ"
   - ตัวอย่างคำศัพท์ภาษาอังกฤษ-คำแปลภาษาไทย (4 ขั้นตอน):
     [
       {"step_order": 1, "step_text": "Fish : ปลา", "emoji": "🐟"},
       {"step_order": 2, "step_text": "Cat : แมว", "emoji": "🐱"},
       {"step_order": 3, "step_text": "Bird : นก", "emoji": "🐦"},
       {"step_order": 4, "step_text": "Dog : สุนัข", "emoji": "🐶"}
     ]
   - ตัวอย่างคณิตศาสตร์/วิทยาศาสตร์:
     [
       {"step_order": 1, "step_text": "2 + 5 : 7", "emoji": "➕"},
       {"step_order": 2, "step_text": "10 - 4 : 6", "emoji": "➖"},
       {"step_order": 3, "step_text": "3 x 3 : 9", "emoji": "✖️"}
     ]

4. หากหัวข้อเป็นเรื่อง "การเรียงลำดับขั้นตอน/กระบวนการทั่วไป" (เช่น วัฏจักรชีวิตสัตว์, ลำดับการทดลองวิทยาศาสตร์)
   - ให้ตอบกลับเป็นข้อความขั้นตอนปกติที่ไม่มีโคลอน (:) เพื่อเรียงจากลำดับ 1 ไปยังลำดับสุดท้าย
   - ตัวอย่างวิทยาศาสตร์ (วัฏจักรชีวิตผีเสื้อ):
     [
       {"step_order": 1, "step_text": "ไข่บนใบไม้", "emoji": "🥚"},
       {"step_order": 2, "step_text": "ตัวหนอนผีเสื้อ", "emoji": "🐛"},
       {"step_order": 3, "step_text": "ดักแด้ในรัง", "emoji": "🕸️"},
       {"step_order": 4, "step_text": "ผีเสื้อแสนสวย", "emoji": "🦋"}
     ]

รายละเอียดข้อกำหนดเพิ่มเติม:
- ให้ออกแบบบทเรียนตั้งแต่ 3 ถึง 5 ขั้นตอน (ขึ้นอยู่กับความเหมาะสม)
- ข้อความทางฝั่งซ้ายและฝั่งขวาของโคลอน (:) หรือข้อความในขั้นตอนทั่วไป ต้องสั้น กระชับ มีความยาวไม่เกิน 15 ตัวอักษร
- emoji ต้องเข้ากับขั้นตอนนี้อย่างดีที่สุด
- ส่งผลลัพธ์กลับมาในรูปแบบ JSON Array เท่านั้น ห้ามมีข้อความอื่นๆ เสริม`;

      const res = await callGeminiAPI(prompt, apiKey, {
        temperature: 0.4,
        responseMimeType: "application/json"
      });

      if (res && res.text) {
        const parsedSteps = JSON.parse(res.text);
        if (Array.isArray(parsedSteps)) {
          // Detect mode from generated steps
          const isMatching = parsedSteps.some(s => s.step_text && (s.step_text.includes(':') || s.step_text.includes('：')));
          setLessonMode(isMatching ? 'matching' : 'sequencing');
          
          // อัปเดตขั้นตอนในหน้าจอ
          setSteps(parsedSteps.map(s => ({
            step_order: s.step_order,
            step_text: s.step_text,
            emoji: s.emoji || '💡'
          })));
          alert('น้องชบาช่วยคิดขั้นตอนเรียบร้อยแล้วค่ะ! คุณครูสามารถปรับแต่งเนื้อหาเพิ่มเติมต่อได้เลยนะคะ');
        } else {
          throw new Error('รูปแบบข้อมูลจาก AI ไม่ถูกต้อง');
        }
      }
    } catch (err: any) {
      console.error('AI generate failed:', err);
      alert('น้องชบาติดขัดบางประการในการวิเคราะห์: ' + err.message + '\nคุณครูสามารถพิมพ์กำหนดขั้นตอนด้วยตัวเองได้เช่นกันค่ะ');
    } finally {
      setAiGenerating(false);
    }
  }

  useEffect(() => {
    // 1. Check current logged in user
    async function checkUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
        
        if (user) {
          // Fetch additional profile data
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          setUserProfile(profile);
        }
      } catch (e) {
        console.error('Error fetching user:', e);
      }
    }
    
    checkUser();
  }, []);

  // สิทธิ์ฝ่ายวิชาการ/ผู้บริหาร
  const isAcademicOrManagement = userProfile?.role === 'admin' || 
                                 userProfile?.role === 'director' || 
                                 userProfile?.extra_permissions?.access_academic === true;

  useEffect(() => {
    // 2. Fetch all lessons
    fetchLessons();
  }, [currentUser, userProfile]);

  async function fetchLessons() {
    setLoading(true);
    try {
      const data = await getARLessons(currentUser?.id);
      if (isAcademicOrManagement) {
        // วิชาการ/ผู้บริหาร มองเห็นของทุกคนได้หมด
        setLessons(data);
      } else {
        // ครูทั่วไปเห็นเฉพาะของตนเอง (created_by === currentUser.id) และด่านระบบเริ่มต้น ('teacher_default')
        const filtered = data.filter(l => l.created_by === currentUser?.id || l.created_by === 'teacher_default');
        setLessons(filtered);
      }
    } catch (e) {
      console.error('Failed to fetch lessons:', e);
    } finally {
      setLoading(false);
    }
  }

  // Handle open editor for new lesson
  function handleNewLesson() {
    setEditLessonId(null);
    setTitle('');
    setDescription('');
    setIsPublic(true);
    setLessonMode('sequencing');
    setSteps([
      { step_order: 1, step_text: '', emoji: '💡' },
      { step_order: 2, step_text: '', emoji: '💡' },
      { step_order: 3, step_text: '', emoji: '💡' }
    ]);
    setIsEditing(true);
  }

  // Handle open editor for editing existing lesson
  function handleEditLesson(lesson: ARLesson) {
    // ครูผู้สร้าง หรือ ฝ่ายวิชาการ/ผู้บริหาร สามารถแก้ไขได้
    const canEdit = !currentUser || lesson.created_by === currentUser.id || isAcademicOrManagement;
    if (!canEdit) {
      alert('คุณไม่ได้รับอนุญาตให้แก้ไขบทเรียนของท่านอื่น (สามารถทำได้เฉพาะการคัดลอกบทเรียน)');
      return;
    }
    
    setEditLessonId(lesson.id);
    setTitle(lesson.title);
    setDescription(lesson.description);
    setIsPublic(lesson.is_public);
    
    // Detect lesson mode based on steps
    const isMatchingType = lesson.steps.some(s => s.step_text && (s.step_text.includes(':') || s.step_text.includes('：')));
    setLessonMode(isMatchingType ? 'matching' : 'sequencing');

    // Sort steps by order to ensure it matches UI
    const sortedSteps = [...lesson.steps].sort((a, b) => a.step_order - b.step_order);
    setSteps(sortedSteps.map(s => ({
      step_order: s.step_order,
      step_text: s.step_text,
      emoji: s.emoji
    })));
    setIsEditing(true);
  }

  // Handle duplicate other teacher's lesson
  async function handleDuplicateLesson(lesson: ARLesson) {
    if (!confirm(`คุณต้องการคัดลอกบทเรียน "${lesson.title}" ไปเป็นบทเรียนส่วนตัวของคุณใช่หรือไม่?`)) {
      return;
    }
    
    setLoading(true);
    const newLessonId = generateUUID();
    const duplicatedLesson: Omit<ARLesson, 'school_id'> = {
      id: newLessonId,
      created_by: currentUser?.id || 'teacher_default',
      title: `${lesson.title} (คัดลอก)`,
      description: lesson.description,
      is_public: false, // Default private for duplicate
      steps: lesson.steps.map(s => ({
        id: generateUUID(),
        lesson_id: newLessonId,
        step_order: s.step_order,
        step_text: s.step_text,
        emoji: s.emoji
      }))
    };
    
    const success = await saveARLesson(duplicatedLesson, currentUser?.id || 'teacher_default');
    if (success) {
      alert('คัดลอกบทเรียนสำเร็จแล้ว! สามารถเข้าไปแก้ไขเป็นเนื้อหาของคุณได้ในตาราง');
      fetchLessons();
    } else {
      alert('เกิดข้อผิดพลาดในการคัดลอกบทเรียน');
      setLoading(false);
    }
  }

  // Handle delete lesson
  async function handleDeleteLesson(lessonId: string) {
    if (!confirm('คุณแน่ใจว่าต้องการลบบทเรียนนี้อย่างถาวรใช่หรือไม่?')) return;
    
    setLoading(true);
    const success = await deleteARLesson(lessonId);
    if (success) {
      alert('ลบบทเรียนเรียบร้อยแล้ว');
      fetchLessons();
    } else {
      alert('เกิดข้อผิดพลาดในการลบบทเรียน');
      setLoading(false);
    }
  }

  // Add a new step in Editor
  function handleAddStep() {
    if (steps.length >= 6) {
      alert('แนะนำให้มีจำนวนสูงสุดไม่เกิน 6 ขั้นตอน เพื่อการแสดงผลที่สวยงามบนหน้าจอ AR');
      return;
    }
    setSteps([...steps, { step_order: steps.length + 1, step_text: '', emoji: '💡' }]);
  }

  // Remove last step in Editor
  function handleRemoveStep(index: number) {
    if (steps.length <= 2) {
      alert('บทเรียนต้องมีลำดับขั้นตอนอย่างน้อย 2 ขั้นตอน');
      return;
    }
    const newSteps = steps.filter((_, idx) => idx !== index);
    // Re-calculate step orders
    const resetOrderSteps = newSteps.map((s, idx) => ({
      ...s,
      step_order: idx + 1
    }));
    setSteps(resetOrderSteps);
  }

  // Update step field
  function handleUpdateStep(index: number, field: 'step_text' | 'emoji', value: any) {
    const newSteps = [...steps];
    newSteps[index] = {
      ...newSteps[index],
      [field]: value
    };
    setSteps(newSteps);
  }

  // Save lesson
  async function handleSave() {
    if (!title.trim()) {
      alert('กรุณากรอกชื่อบทเรียน/ด่าน');
      return;
    }
    
    // Check if steps are empty
    const hasEmptyStep = steps.some(s => !s.step_text.trim());
    if (hasEmptyStep) {
      alert('กรุณากรอกข้อความรายละเอียดขั้นตอนให้ครบทุกช่อง');
      return;
    }

    setSaveLoading(true);
    const lessonId = editLessonId || generateUUID();
    
    const formattedSteps: ARStep[] = steps.map((s, idx) => ({
      id: generateUUID(),
      lesson_id: lessonId,
      step_order: idx + 1,
      step_text: s.step_text.trim(),
      emoji: s.emoji || '💡'
    }));

    const lessonData: Omit<ARLesson, 'school_id'> = {
      id: lessonId,
      created_by: currentUser?.id || 'teacher_default',
      title: title.trim(),
      description: description.trim(),
      is_public: isPublic,
      steps: formattedSteps
    };

    const success = await saveARLesson(lessonData, currentUser?.id || 'teacher_default');
    setSaveLoading(false);
    if (success) {
      setIsEditing(false);
      fetchLessons();
      alert('บันทึกบทเรียนเรียบร้อยแล้ว!');
    } else {
      alert('เกิดข้อผิดพลาดในการบันทึกบทเรียน');
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 relative">
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none"></div>
      
      {/* HEADER */}
      <header className="relative z-10 flex justify-between items-center mb-8 bg-slate-900/40 backdrop-blur border border-white/10 p-5 rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition duration-300 group"
          >
            <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">AR Learning System</span>
            <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              {isEditing ? 'จัดการรายละเอียดบทเรียน' : 'คลังจัดระบบบทเรียนอัลกอริทึม (AR)'}
            </h1>
          </div>
        </div>

        {!isEditing && (
          <button 
            onClick={handleNewLesson}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold px-6 py-3.5 rounded-2xl shadow-lg hover:shadow-cyan-500/25 transition duration-300 transform hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5" />
            สร้างบทเรียนใหม่
          </button>
        )}
      </header>

      {/* CONTENT AREA */}
      <main className="relative z-10">
        
        {/* LOADING STATE */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
            <p className="text-slate-400 text-sm animate-pulse">กำลังโหลดข้อมูลบทเรียนจากระบบฐานข้อมูล...</p>
          </div>
        )}

        {/* EDITOR MODE */}
        {!loading && isEditing && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Left: General Settings Info */}
            <div className="lg:col-span-1 bg-slate-900/60 backdrop-blur border border-white/10 p-6 rounded-3xl shadow-2xl flex flex-col gap-6">
              <h2 className="text-lg font-bold text-cyan-300 flex items-center gap-2 border-b border-white/5 pb-3">
                <Sparkles className="w-5 h-5" />
                ตั้งค่าหลักของบทเรียน
              </h2>
              
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase">ชื่อบทเรียน/ด่าน *</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="เช่น การต้มบะหมี่สำเร็จรูป 🍜"
                    className="flex-grow bg-slate-950 border border-white/10 focus:border-cyan-400 focus:outline-none rounded-xl px-4 py-3 text-white transition min-w-0"
                  />
                  <button
                    type="button"
                    onClick={handleAICoWorkGenerate}
                    disabled={aiGenerating}
                    title="ให้น้องชบาช่วยออกแบบขั้นตอน"
                    className="px-4 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 rounded-xl flex items-center justify-center transition disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {aiGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bot className="w-5 h-5" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-500">✨ พิมพ์ชื่อหัวข้อด่านแล้วกดปุ่มหุ่นยนต์ ให้น้องชบาช่วยคิดขั้นตอนย่อยได้ทันที!</span>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase">รูปแบบบทเรียน / ด่าน</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setLessonMode('sequencing')}
                    className={`py-2 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                      lessonMode === 'sequencing' 
                        ? 'bg-cyan-500 text-slate-950 shadow-md' 
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    เรียงตามลำดับขั้นตอน
                  </button>
                  <button
                    type="button"
                    onClick={() => setLessonMode('matching')}
                    className={`py-2 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                      lessonMode === 'matching' 
                        ? 'bg-cyan-500 text-slate-950 shadow-md' 
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    เกมจับคู่คำถาม-คำตอบ
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase">คำอธิบายภารกิจ</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="รายละเอียดสำหรับนักเรียนเพื่อประกอบการทำด่าน..."
                  rows={3}
                  className="w-full bg-slate-950 border border-white/10 focus:border-cyan-400 focus:outline-none rounded-xl px-4 py-3 text-white transition resize-none"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase">การแชร์และสิทธิ์</label>
                <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    {isPublic ? <Unlock className="w-5 h-5 text-emerald-400" /> : <Lock className="w-5 h-5 text-amber-500" />}
                    <div>
                      <span className="text-sm font-semibold block">{isPublic ? 'แชร์สาธารณะ' : 'ส่วนตัวในวิชาคุณ'}</span>
                      <span className="text-xs text-slate-500">{isPublic ? 'ครูทุกคนในโรงเรียนเปิดดูได้' : 'เห็นและแก้สิทธิ์เฉพาะบัญชีคุณ'}</span>
                    </div>
                  </div>
                  <input 
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="w-5 h-5 accent-cyan-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Checklist คำแนะนำขณะเขียน */}
              <div className="bg-slate-950/80 p-4.5 rounded-2xl border border-white/5 text-[11px] text-slate-400 flex flex-col gap-2.5">
                <span className="font-black text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Checklist ออกแบบด่าน AR:
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-300">
                  <li>มีจำนวนขั้นตอนแนะนำ <span className="text-white font-bold">3 - 5 ขั้นตอน</span></li>
                  <li>ข้อความรายละเอียดสั้นกระชับ <span className="text-white font-bold">ไม่เกิน 15 ตัวอักษร</span></li>
                  <li>โจทย์จับคู่ใช้เครื่องหมายโคลอนคั่น เช่น <span className="text-cyan-300 font-mono font-bold">โจทย์ : คำตอบ</span></li>
                </ul>
              </div>

              <div className="flex gap-3 border-t border-white/5 pt-4 mt-2">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold rounded-xl text-center transition"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={handleSave}
                  disabled={saveLoading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
                >
                  {saveLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  บันทึกบทเรียน
                </button>
              </div>
            </div>

            {/* Right: Steps Builder */}
            <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur border border-white/10 p-6 rounded-3xl shadow-2xl">
              <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-cyan-300 flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    กำหนดลำดับขั้นตอน (Algorithm Steps)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">เรียงตามลำดับความจริงที่ถูกต้องตั้งแต่ขั้นตอนที่ 1 ไปจนสุด</p>
                </div>
                
                <button 
                  onClick={handleAddStep}
                  className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-bold text-sm rounded-xl transition"
                >
                  <Plus className="w-4 h-4" />
                  เพิ่มขั้นตอน
                </button>
              </div>

              {/* Steps List */}
              <div className="flex flex-col gap-4">
                {steps.map((step, index) => (
                  <div 
                    key={index}
                    className="flex flex-col md:flex-row items-center gap-4 bg-slate-950/75 p-4 rounded-2xl border border-white/5 relative group hover:border-cyan-500/20 transition duration-300"
                  >
                    {/* Badge Step Order */}
                    <div className="w-10 h-10 flex items-center justify-center bg-cyan-500 text-slate-950 font-black rounded-xl text-lg shrink-0">
                      {step.step_order}
                    </div>

                    {/* Emoji selector */}
                    <div className="flex flex-col gap-1 w-full md:w-20 shrink-0">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Emoji</label>
                      <input 
                        type="text"
                        maxLength={2}
                        value={step.emoji}
                        onChange={(e) => handleUpdateStep(index, 'emoji', e.target.value)}
                        className="bg-slate-900 border border-white/10 text-center text-xl focus:border-cyan-400 focus:outline-none rounded-xl py-2 transition"
                      />
                    </div>

                    {/* Step description */}
                    <div className="flex flex-col gap-1 flex-grow w-full">
                      {lessonMode === 'sequencing' ? (
                        <>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">คำอธิบายขั้นตอนการแก้ปัญหา *</label>
                          <input 
                            type="text"
                            value={step.step_text}
                            onChange={(e) => handleUpdateStep(index, 'step_text', e.target.value)}
                            placeholder={`รายละเอียดขั้นตอนที่ ${step.step_order} เช่น ลวกเส้นในน้ำเดือด`}
                            className="bg-slate-900 border border-white/10 focus:border-cyan-400 focus:outline-none rounded-xl px-4 py-2.5 text-white transition w-full"
                          />
                        </>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                          <div className="flex flex-col gap-1 w-full">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">โจทย์ / คำถาม (แสดงบนการ์ด) *</label>
                            <input 
                              type="text"
                              value={step.step_text.includes(':') || step.step_text.includes('：') 
                                ? step.step_text.split(step.step_text.includes('：') ? '：' : ':')[0].trim() 
                                : step.step_text}
                              onChange={(e) => {
                                const val = e.target.value;
                                const sep = step.step_text.includes('：') ? '：' : ':';
                                const right = (step.step_text.includes(':') || step.step_text.includes('：'))
                                  ? step.step_text.split(sep)[1].trim() 
                                  : '';
                                handleUpdateStep(index, 'step_text', `${val} : ${right}`);
                              }}
                              placeholder="เช่น Apple หรือ 3 x 5"
                              className="bg-slate-900 border border-white/10 focus:border-cyan-400 focus:outline-none rounded-xl px-4 py-2.5 text-white transition w-full"
                            />
                          </div>
                          <div className="flex flex-col gap-1 w-full">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">คำแปล / คำตอบ (แสดงบนเป้าหมาย) *</label>
                            <input 
                              type="text"
                              value={step.step_text.includes(':') || step.step_text.includes('：') 
                                ? step.step_text.split(step.step_text.includes('：') ? '：' : ':')[1].trim() 
                                : ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const sep = step.step_text.includes('：') ? '：' : ':';
                                const left = (step.step_text.includes(':') || step.step_text.includes('：'))
                                  ? step.step_text.split(sep)[0].trim() 
                                  : step.step_text;
                                handleUpdateStep(index, 'step_text', `${left} : ${val}`);
                              }}
                              placeholder="เช่น แอปเปิ้ล หรือ 15"
                              className="bg-slate-900 border border-white/10 focus:border-cyan-400 focus:outline-none rounded-xl px-4 py-2.5 text-white transition w-full"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Remove button */}
                    <button 
                      onClick={() => handleRemoveStep(index)}
                      className="p-2 md:mt-4 bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-xl transition cursor-pointer md:opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* LIST TABLE VIEW */}
        {!loading && !isEditing && (
          <>
            <div className="bg-slate-900/40 backdrop-blur border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            {lessons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-5xl mb-4 opacity-50">🗂️</div>
                <h3 className="text-lg font-bold text-slate-300">ยังไม่มีบทเรียนใดๆ ในระบบ</h3>
                <p className="text-slate-500 text-sm mt-1 mb-6 max-w-sm">เริ่มสร้างบทเรียนวิทยาการคำนวณบทเรียนแรกของคุณครู เพื่อให้นักเรียนเข้าเรียนรู้อัลกอริทึมในห้องเรียน</p>
                <button 
                  onClick={handleNewLesson}
                  className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl transition"
                >
                  สร้างบทเรียนแรก
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-slate-900/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <th className="p-5">บทเรียน/โจทย์การเรียงลำดับ</th>
                      <th className="p-5">จำนวนขั้นตอน</th>
                      <th className="p-5">สถานะการแชร์</th>
                      <th className="p-5">ผู้สร้างสรรค์บทเรียน</th>
                      <th className="p-5 text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {lessons.map((lesson) => {
                      const isOwner = !currentUser || lesson.created_by === currentUser.id;
                      return (
                        <tr 
                          key={lesson.id}
                          className="hover:bg-white/5 transition duration-200 text-slate-200"
                        >
                          <td className="p-5">
                            <div className="font-extrabold text-white text-base">{lesson.title}</div>
                            {lesson.description && (
                              <div className="text-xs text-slate-400 mt-1 max-w-md truncate">{lesson.description}</div>
                            )}
                          </td>
                          <td className="p-5">
                            <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 rounded-full font-bold text-xs">
                              {lesson.steps.length} ขั้นตอน (Slots)
                            </span>
                          </td>
                          <td className="p-5">
                            <div className="flex items-center gap-1.5">
                              {lesson.is_public ? (
                                <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold">
                                  <Unlock className="w-3.5 h-3.5" /> สาธารณะ
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-amber-500 font-bold">
                                  <Lock className="w-3.5 h-3.5" /> ส่วนตัว
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-5 text-sm">
                            {isOwner ? (
                              <span className="text-cyan-400 font-bold">บัญชีของคุณ</span>
                            ) : (
                              <span className="text-slate-400">คุณครูท่านอื่น</span>
                            )}
                          </td>
                          <td className="p-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isOwner || isAcademicOrManagement ? (
                                <>
                                  <button 
                                    onClick={() => handleEditLesson(lesson)}
                                    className="p-2.5 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/20 hover:border-cyan-500/40 text-cyan-400 rounded-xl transition cursor-pointer"
                                    title="แก้ไขบทเรียน"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteLesson(lesson.id)}
                                    className="p-2.5 bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-xl transition cursor-pointer"
                                    title="ลบบทเรียน"
                                  >
                                    <Trash className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button 
                                  onClick={() => handleDuplicateLesson(lesson)}
                                  className="flex items-center gap-1 px-3.5 py-2 bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-400 font-bold text-xs rounded-xl transition cursor-pointer"
                                  title="คัดลอกบทเรียน"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  คัดลอกสื่อ
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {/* Guide & Best Practices Card */}
          <div className="mt-8 bg-slate-900/40 backdrop-blur border border-white/10 p-6 rounded-3xl shadow-xl grid grid-cols-1 md:grid-cols-2 gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
            <div>
              <h3 className="text-cyan-400 font-extrabold text-base flex items-center gap-2 mb-3">
                <Bot className="w-5 h-5 text-cyan-400" />
                คู่มือน้องชบาช่วยคิดขั้นตอน 🤖 (คำแนะนำการป้อนหัวข้อ)
              </h3>
              <ul className="text-xs text-slate-300 space-y-2.5 list-disc pl-4 leading-relaxed">
                <li><strong className="text-white">โจทย์เลขคณิตศาสตร์:</strong> ป้อนหัวข้อที่มีคำว่า <span className="text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800">"โจทย์เรียง"</span> หรือ <span className="text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800">"ตัวเลข"</span> (เช่น <em>"เรียงตัวเลขจากน้อยไปมาก"</em>) น้องชบาจะสุ่มชุดตัวเลขสมมติคละกันมาให้จัดเรียง</li>
                <li><strong className="text-white">โจทย์ลำดับขั้นตอน/อัลกอริทึม:</strong> ป้อนหัวข้อที่มีคำว่า <span className="text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800">"ขั้นตอน"</span> หรือ <span className="text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800">"วิธีการ"</span> (เช่น <em>"ขั้นตอนการล้างมือ"</em>) น้องชบาจะส่งลำดับวิธีคิดย่อยมาให้เรียงลำดับ</li>
                <li><strong className="text-white">โจทย์การจับคู่วิชาการ:</strong> ป้อนหัวข้อที่มีคำว่า <span className="text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800">"จับคู่"</span> หรือ <span className="text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800">"คำศัพท์"</span> (เช่น <em>"จับคู่คำศัพท์ภาษาอังกฤษ"</em>) น้องชบาจะสร้างข้อความแบบมีโคลอน <code className="text-cyan-300 bg-cyan-950/40 px-1 py-0.5 rounded border border-cyan-800">:</code> แยกโจทย์กับคำแปลอย่างประณีต</li>
              </ul>
            </div>
            
            <div className="border-t md:border-t-0 md:border-l border-white/5 md:pl-6 pt-6 md:pt-0">
              <h3 className="text-amber-400 font-extrabold text-base flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-amber-400" />
                แนวทางการออกแบบด่านให้ได้ผลลัพธ์ดีที่สุด 💡
              </h3>
              <ul className="text-xs text-slate-300 space-y-2.5 list-disc pl-4 leading-relaxed">
                <li><strong className="text-white">จำนวนขั้นตอนที่เหมาะสม:</strong> แนะนำให้สร้างบทเรียนประมาณ <strong className="text-amber-300">3 ถึง 5 ขั้นตอน</strong> (สูงสุดไม่เกิน 6) เพื่อการจัดวางที่สวยงามและไม่ทับซ้อนกันบนหน้าจอ AR</li>
                <li><strong className="text-white">ความยาวข้อความสั้นกระชับ:</strong> พยายามจำกัดความยาวไม่เกิน <strong className="text-amber-300">15 ตัวอักษร</strong> เพื่อให้ตัวหนังสืออ่านง่าย คมชัด และไม่ล้นกรอบการ์ดในเกม</li>
                <li><strong className="text-white">การประยุก輳์ใช้ในวัยอนุบาล:</strong> เน้นการใช้รูปภาพ Emoji เด่นๆ เป็นสื่อการสอนหลัก และแนะนำให้เด็กๆ เล่นผ่าน <strong className="text-amber-300">แท็บเล็ต/จอสัมผัส</strong> โดยใช้นิ้วลากแทนการใช้กล้องเว็บแคม</li>
              </ul>
            </div>
          </div>
        </>
      )}

      </main>
    </div>
  );
}
