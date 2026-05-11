import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadFile } from '../lib/storage';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import { 
  UserPlus, 
  Search, 
  Users, 
  Loader2,
  Save, 
  Camera,
  Trash2,
  Edit2,
  Calendar,
  Phone,
  ShieldCheck
} from 'lucide-react';

type Teacher = {
  id: string;
  prefix: string;
  first_name: string;
  last_name: string;
  position: string;
  department: string;
  phone: string;
  email: string;
  photo_url: string;
  status: string;
  line_user_id?: string;
};

type Duty = {
  id: string;
  teacher_id: string;
  duty_day: string;
  duty_type: string;
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_LABELS: Record<string, string> = {
  'Monday': 'วันจันทร์',
  'Tuesday': 'วันอังคาร',
  'Wednesday': 'วันพุธ',
  'Thursday': 'วันพฤหัสบดี',
  'Friday': 'วันศุกร์',
  'Saturday': 'วันเสาร์',
  'Sunday': 'วันอาทิตย์'
};

export default function Teachers() {
  const { profile } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDutyModalOpen, setIsDutyModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [duties, setDuties] = useState<Duty[]>([]);

  // Form State
  const [formData, setFormData] = useState<any>({
    prefix: 'นาย',
    first_name: '',
    last_name: '',
    position: 'ครูผู้ช่วย',
    department: 'กลุ่มสาระการเรียนรู้...',
    phone: '',
    email: '',
    status: 'active',
    line_user_id: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTeachers();
  }, []);

  async function fetchTeachers() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .order('first_name', { ascending: true });

      if (error) throw error;
      setTeachers(data || []);
    } catch (err) {
      console.error('Error fetching teachers:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      let photoUrl = formData.photo_url;
      if (selectedFile) {
        photoUrl = await uploadFile(selectedFile, 'teachers', 'photos');
      }

      const payload = { ...formData, photo_url: photoUrl };

      if (editingId) {
        const { error } = await supabase.from('teachers').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('teachers').insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      resetForm();
      fetchTeachers();
    } catch (err: any) {
      alert('บันทึกไม่สำเร็จ: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลครูท่านนี้?')) return;
    try {
      const { error } = await supabase.from('teachers').delete().eq('id', id);
      if (error) throw error;
      fetchTeachers();
    } catch (err: any) {
      alert('ลบไม่สำเร็จ: ' + err.message);
    }
  }

  const resetForm = () => {
    setFormData({
      prefix: 'นาย',
      first_name: '',
      last_name: '',
      position: 'ครูผู้ช่วย',
      department: 'กลุ่มสาระการเรียนรู้...',
      phone: '',
      email: '',
      status: 'active',
    });
    setEditingId(null);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const openEditModal = (teacher: Teacher) => {
    setEditingId(teacher.id);
    setFormData(teacher);
    setPreviewUrl(teacher.photo_url);
    setIsModalOpen(true);
  };

  const openDutyModal = async (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setIsDutyModalOpen(true);
    // Fetch duties for this teacher
    const { data } = await supabase.from('teacher_duties').select('*').eq('teacher_id', teacher.id);
    setDuties(data || []);
  };

  const toggleDuty = async (day: string) => {
    if (!selectedTeacher) return;
    const existing = duties.find(d => d.duty_day === day);
    if (existing) {
      await supabase.from('teacher_duties').delete().eq('id', existing.id);
    } else {
      await supabase.from('teacher_duties').insert([{
        teacher_id: selectedTeacher.id,
        duty_day: day,
        duty_type: 'เวรประจำวัน'
      }]);
    }
    // Refresh duties
    const { data } = await supabase.from('teacher_duties').select('*').eq('teacher_id', selectedTeacher.id);
    setDuties(data || []);
  };

  const filteredTeachers = teachers.filter(t => 
    `${t.first_name} ${t.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAdmin = profile?.role === 'admin';
  const isDirector = profile?.role === 'director' || isAdmin;
  const extraPerms = profile?.extra_permissions || {};
  const hasAccess = isDirector || extraPerms.access_hr;

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[40px] border border-slate-100 shadow-sm">
        <ShieldCheck size={64} className="text-red-200 mb-4" />
        <h3 className="text-xl font-black text-slate-800">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h3>
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-1">กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าใช้งานโมดูลงานบุคคล</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Users size={32} className="text-brand-primary" />
            ระบบจัดการข้อมูลครู
          </h2>
          <p className="text-slate-400 font-bold mt-1 uppercase tracking-widest text-xs">Teacher & Staff Information Management</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-brand-primary text-white px-8 py-4 rounded-[24px] font-black text-lg flex items-center gap-3 shadow-2xl shadow-green-200 hover:bg-green-700 active:scale-95 transition-all w-full md:w-auto justify-center"
        >
          <UserPlus size={24} /> เพิ่มข้อมูลครูใหม่
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
          <input 
            type="text" 
            placeholder="ค้นหาชื่อครู หรือตำแหน่ง..." 
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Teacher Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[40px] border border-slate-100 shadow-sm">
          <Loader2 className="animate-spin text-brand-primary mb-4" size={40} />
          <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">กำลังดึงข้อมูลครู...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTeachers.map(teacher => (
            <div key={teacher.id} className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="h-32 bg-slate-50 relative overflow-hidden">
                <div className="absolute inset-0 bg-brand-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                {teacher.photo_url ? (
                  <img src={teacher.photo_url} alt={teacher.first_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-200"><Users size={48} /></div>
                )}
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                  <button onClick={() => openEditModal(teacher)} className="p-2 bg-white/90 backdrop-blur-sm rounded-xl text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-sm"><Edit2 size={16} /></button>
                  {isAdmin && <button onClick={() => handleDelete(teacher.id)} className="p-2 bg-white/90 backdrop-blur-sm rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"><Trash2 size={16} /></button>}
                </div>
              </div>
              <div className="p-6 text-center -mt-12 relative">
                <div className="w-20 h-20 bg-white rounded-3xl border-4 border-white shadow-lg mx-auto overflow-hidden">
                  {teacher.photo_url ? (
                    <img src={teacher.photo_url} alt={teacher.first_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-300"><Users size={32} /></div>
                  )}
                </div>
                <h4 className="mt-4 font-black text-slate-800 text-lg">{teacher.prefix}{teacher.first_name} {teacher.last_name}</h4>
                <p className="text-[10px] font-black text-brand-primary uppercase tracking-widest mt-1 bg-green-50 px-3 py-1 rounded-full inline-block">{teacher.position}</p>
                
                <div className="mt-6 space-y-3">
                   <div className="flex items-center gap-3 text-slate-400 text-xs font-bold bg-slate-50 p-3 rounded-2xl">
                      <Phone size={14} className="text-slate-300" /> {teacher.phone || '-'}
                   </div>
                   <button 
                    onClick={() => openDutyModal(teacher)}
                    className="w-full py-3 bg-slate-800 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-900 transition-all shadow-lg shadow-slate-200"
                   >
                     <Calendar size={14} /> ตั้งค่าวันเวร
                   </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingId ? 'แก้ไขข้อมูลครู' : 'เพิ่มข้อมูลครูใหม่'}
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="w-32 h-32 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden group relative">
              {previewUrl ? (
                <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
              ) : (
                <Users className="text-slate-200" size={48} />
              )}
              <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    setPreviewUrl(URL.createObjectURL(file));
                  }
                }} />
                <Camera className="text-white" size={24} />
              </label>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase">รูปถ่ายหน้าตรง</p>
          </div>

          <div className="grid grid-cols-6 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">คำนำหน้า</label>
              <select 
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary"
                value={formData.prefix}
                onChange={e => setFormData({...formData, prefix: e.target.value})}
              >
                <option>นาย</option>
                <option>นาง</option>
                <option>นางสาว</option>
                <option>ว่าที่ ร.ต.</option>
                <option>ดร.</option>
              </select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">ชื่อ</label>
              <input 
                type="text" 
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary"
                value={formData.first_name}
                onChange={e => setFormData({...formData, first_name: e.target.value})}
                required
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">นามสกุล</label>
              <input 
                type="text" 
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary"
                value={formData.last_name}
                onChange={e => setFormData({...formData, last_name: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">ตำแหน่ง</label>
              <input 
                type="text" 
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary"
                value={formData.position}
                onChange={e => setFormData({...formData, position: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">กลุ่มสาระ/ฝ่าย</label>
              <input 
                type="text" 
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary"
                value={formData.department}
                onChange={e => setFormData({...formData, department: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">เบอร์โทรศัพท์</label>
              <input 
                type="text" 
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">อีเมล</label>
              <input 
                type="email" 
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest text-brand-primary">LINE User ID (สำหรับแจ้งเตือนส่วนบุคคล)</label>
            <input 
              type="text" 
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
              value={formData.line_user_id}
              onChange={e => setFormData({...formData, line_user_id: e.target.value})}
              placeholder="ใส่ LINE User ID (เช่น U123456...)"
            />
            <p className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Messaging API จะส่งข้อความตรงถึงครูรายบุคคลผ่าน User ID</p>
          </div>

          <div className="flex gap-4 pt-6">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-8 py-4 border border-slate-200 text-slate-400 font-black rounded-2xl hover:bg-slate-50 transition-all uppercase tracking-widest text-xs"
            >
              ยกเลิก
            </button>
            <button 
              type="submit" 
              disabled={isSaving}
              className="flex-1 px-8 py-4 bg-brand-primary text-white font-black rounded-2xl hover:bg-green-700 transition-all shadow-lg shadow-green-100 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              บันทึกข้อมูล
            </button>
          </div>
        </form>
      </Modal>

      {/* Duty Management Modal */}
      <Modal
        isOpen={isDutyModalOpen}
        onClose={() => setIsDutyModalOpen(false)}
        title={`ตั้งค่าวันเวร: ${selectedTeacher?.prefix}${selectedTeacher?.first_name}`}
      >
        <div className="space-y-6">
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
             <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Calendar size={18} className="text-brand-primary" /> เลือกวันปฏิบัติหน้าที่
             </h4>
             <div className="grid grid-cols-1 gap-3">
                {DAYS.map(day => {
                  const isActive = duties.some(d => d.duty_day === day);
                  return (
                    <button
                      key={day}
                      onClick={() => toggleDuty(day)}
                      className={`flex items-center justify-between p-4 rounded-2xl font-bold transition-all ${isActive ? 'bg-brand-primary text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200 hover:border-brand-primary'}`}
                    >
                      <span>{DAY_LABELS[day]}</span>
                      {isActive && <ShieldCheck size={20} />}
                    </button>
                  );
                })}
             </div>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase text-center">ข้อมูลจะถูกบันทึกและแสดงผลที่หน้าแดชบอร์ดโดยอัตโนมัติ</p>
        </div>
      </Modal>
    </div>
  );
}
