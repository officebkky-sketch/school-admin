import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BookOpen, 
  Plus, 
  Loader2, 
  Trash2, 
  Edit2, 
  Calendar,
  UserCheck,
  LayoutGrid,
  Settings as SettingsIcon,
  RefreshCcw,
  BookMarked,
  Save,
  FileText
} from 'lucide-react';
import Modal from '../components/Modal';
import LessonPlansTab from '../components/LessonPlansTab';
import { useAuth } from '../contexts/AuthContext';

type Subject = {
  id: string;
  code: string;
  name: string;
  credits: number;
  type: 'พื้นฐาน' | 'เพิ่มเติม';
  class_level: string;
  academic_year: string;
};

export default function Academic() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isDirector = profile?.role === 'director' || isAdmin;
  const isAcademic = profile?.extra_permissions?.access_academic || isDirector;

  const [activeSubTab, setActiveSubTab] = useState<'lesson_plans' | 'subjects' | 'assignments' | 'timetable'>('lesson_plans');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>({
    code: '',
    name: '',
    credits: 0.5,
    type: 'พื้นฐาน',
    class_level: 'ป.1',
    academic_year: '2569'
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (activeSubTab === 'subjects') fetchSubjects();
  }, [activeSubTab]);

  async function fetchSubjects() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('code', { ascending: true });

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('relation "subjects" does not exist')) {
          setSubjects([]); // Table might not exist yet
        } else {
          throw error;
        }
      } else {
        setSubjects(data || []);
      }
    } catch (err) {
      console.error('Error fetching subjects:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSubject(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = { ...formData };
      const { error } = editingId 
        ? await supabase.from('subjects').update(payload).eq('id', editingId)
        : await supabase.from('subjects').insert([payload]);

      if (error) throw error;
      alert(editingId ? 'แก้ไขวิชาเรียบร้อย' : 'เพิ่มวิชาเรียบร้อย');
      setIsModalOpen(false);
      setEditingId(null);
      resetForm();
      fetchSubjects();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message + '\n(หมายเหตุ: โปรดตรวจสอบว่ามีตาราง subjects ในฐานข้อมูลแล้ว)');
    } finally {
      setIsSaving(false);
    }
  }

  function resetForm() {
    setFormData({
      code: '',
      name: '',
      credits: 0.5,
      type: 'พื้นฐาน',
      class_level: 'ป.1',
      academic_year: '2569'
    });
  }

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      {isAcademic && (
        <div className="flex flex-wrap gap-2 bg-white/50 p-2 rounded-[32px] border border-slate-200 w-fit">
          <TabBtn active={activeSubTab === 'lesson_plans'} icon={<FileText size={18} />} label="ส่งแผนการสอน" onClick={() => setActiveSubTab('lesson_plans')} />
          <TabBtn active={activeSubTab === 'subjects'} icon={<BookMarked size={18} />} label="ทะเบียนวิชา" onClick={() => setActiveSubTab('subjects')} />
          <TabBtn active={activeSubTab === 'assignments'} icon={<UserCheck size={18} />} label="มอบหมายงานสอน" onClick={() => setActiveSubTab('assignments')} />
          <TabBtn active={activeSubTab === 'timetable'} icon={<Calendar size={18} />} label="ตารางเรียน/สอน" onClick={() => setActiveSubTab('timetable')} />
        </div>
      )}

      {(activeSubTab === 'lesson_plans' || !isAcademic) && <LessonPlansTab />}

      {activeSubTab === 'subjects' && isAcademic && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-100">
                <BookOpen size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">ทะเบียนวิชาเรียน</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">ปีการศึกษา {formData.academic_year}</p>
              </div>
            </div>
            <button 
              onClick={() => { resetForm(); setEditingId(null); setIsModalOpen(true); }}
              className="bg-brand-primary text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-green-100 active:scale-95 transition-all text-sm"
            >
              <Plus size={18} /> เพิ่มวิชาใหม่
            </button>
          </div>

          {loading ? (
            <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-brand-primary" /></div>
          ) : subjects.length === 0 ? (
            <div className="bg-white rounded-[40px] p-20 text-center border border-dashed border-slate-200">
               <p className="text-slate-400 italic">ยังไม่มีข้อมูลวิชาในระบบ (หรือยังไม่ได้สร้างตาราง subjects)</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subjects.map(subject => (
                <div key={subject.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xs hover:shadow-xl transition-all group relative overflow-hidden">
                   <div className="flex justify-between items-start mb-4">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-bold ${subject.type === 'พื้นฐาน' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-purple-50 text-purple-600 border border-purple-100'}`}>
                        {subject.type}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => { setFormData(subject); setEditingId(subject.id); setIsModalOpen(true); }} className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl transition-colors"><Edit2 size={14} /></button>
                         <button className="p-2 bg-slate-50 text-slate-400 hover:text-red-600 rounded-xl transition-colors"><Trash2 size={14} /></button>
                      </div>
                   </div>
                   <h4 className="font-bold text-slate-800 text-lg">{subject.name}</h4>
                   <p className="text-sm font-bold text-brand-primary mt-1">{subject.code}</p>
                   <div className="mt-4 flex items-center gap-4 text-xs font-bold text-slate-400">
                      <span className="flex items-center gap-1"><LayoutGrid size={14} /> ชั้น {subject.class_level}</span>
                      <span className="flex items-center gap-1"><SettingsIcon size={14} /> {subject.credits} หน่วยกิต</span>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(activeSubTab === 'assignments' || activeSubTab === 'timetable') && isAcademic && (
        <div className="bg-white rounded-[40px] p-20 text-center border border-slate-100 shadow-sm">
          <RefreshCcw className="mx-auto text-blue-200 mb-4 animate-pulse" size={64} />
          <h4 className="text-xl font-bold text-slate-800">ระบบอัจฉริยะกำลังอยู่ในการพัฒนา</h4>
          <p className="text-slate-400 font-medium max-w-md mx-auto mt-2">
            ส่วนของ "{activeSubTab === 'assignments' ? 'การมอบหมายงานสอน' : 'การจัดตารางเรียน'}" จะเชื่อมต่อกับทะเบียนวิชาเพื่อตรวจสอบความขัดแย้งให้อัตโนมัติ
          </p>
        </div>
      )}

      {/* Subject Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'แก้ไขข้อมูลวิชา' : 'เพิ่มวิชาเรียนใหม่'}>
        <form onSubmit={handleSaveSubject} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <label className="text-xs font-bold text-slate-500 ml-1">รหัสวิชา</label>
               <input type="text" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="เช่น ท11101" required value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
             </div>
             <div className="space-y-2">
               <label className="text-xs font-bold text-slate-500 ml-1">ประเภทวิชา</label>
               <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                 <option value="พื้นฐาน">พื้นฐาน</option>
                 <option value="เพิ่มเติม">เพิ่มเติม</option>
               </select>
             </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 ml-1">ชื่อวิชา</label>
            <input type="text" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="เช่น ภาษาไทย" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <label className="text-xs font-bold text-slate-500 ml-1">ระดับชั้น</label>
               <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={formData.class_level} onChange={e => setFormData({...formData, class_level: e.target.value})}>
                 {['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'].map(l => <option key={l} value={l}>{l}</option>)}
               </select>
             </div>
             <div className="space-y-2">
               <label className="text-xs font-bold text-slate-500 ml-1">หน่วยกิต/น้ำหนัก</label>
               <input type="number" step="0.5" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={formData.credits} onChange={e => setFormData({...formData, credits: parseFloat(e.target.value)})} />
             </div>
          </div>

          <button type="submit" disabled={isSaving} className="w-full bg-brand-primary text-white py-4.5 rounded-[24px] font-bold flex items-center justify-center gap-3 shadow-xl shadow-green-100 hover:bg-green-700 transition-all active:scale-[0.98]">
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} บันทึกข้อมูลวิชา
          </button>
        </form>
      </Modal>
    </div>
  );
}

function TabBtn({ active, icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 rounded-[24px] font-bold text-xs transition-all ${active ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
    >
      {icon} {label}
    </button>
  );
}
