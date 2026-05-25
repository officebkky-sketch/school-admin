import { useState, useEffect } from 'react';
import { 
  School, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  ArrowLeft, 
  Info, 
  ExternalLink,
  Save,
  Database,
  Globe,
  Settings
} from 'lucide-react';
import { type SchoolProfile, getSchoolProfiles, getActiveSchoolProfile, initSupabase } from '../lib/supabase';

interface SchoolSetupProps {
  onBackToLogin?: () => void;
}

export default function SchoolSetup({ onBackToLogin }: SchoolSetupProps) {
  const [profiles, setProfiles] = useState<SchoolProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<SchoolProfile | null>(null);
  
  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [vercelUrl, setVercelUrl] = useState('');
  const [gasUrl, setGasUrl] = useState('');
  
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = () => {
    const list = getSchoolProfiles();
    setProfiles(list);
    setActiveProfile(getActiveSchoolProfile());
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || !supabaseUrl || !supabaseAnonKey || !vercelUrl) {
      setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    try {
      // Validate URLs basic check
      new URL(supabaseUrl);
      new URL(vercelUrl);
      if (gasUrl) new URL(gasUrl);
    } catch (err) {
      setError('รูปแบบ URL ไม่ถูกต้อง กรุณาตรวจสอบและกรอกใหม่ (เช่น https://example.com)');
      return;
    }

    const currentList = getSchoolProfiles();
    
    if (editId) {
      // Edit mode
      const updatedList = currentList.map(p => {
        if (p.id === editId) {
          return {
            ...p,
            name,
            supabaseUrl: supabaseUrl.trim(),
            supabaseAnonKey: supabaseAnonKey.trim(),
            vercelUrl: vercelUrl.trim(),
            gasUrl: gasUrl.trim() || undefined
          };
        }
        return p;
      });
      localStorage.setItem('school_profiles', JSON.stringify(updatedList));
      
      // If updating the active school, re-initialize
      if (activeProfile?.id === editId) {
        initSupabase();
      }
    } else {
      // Add mode
      const newProfile: SchoolProfile = {
        id: 'school_' + Date.now(),
        name,
        supabaseUrl: supabaseUrl.trim(),
        supabaseAnonKey: supabaseAnonKey.trim(),
        vercelUrl: vercelUrl.trim(),
        gasUrl: gasUrl.trim() || undefined
      };
      
      const updatedList = [...currentList, newProfile];
      localStorage.setItem('school_profiles', JSON.stringify(updatedList));
      
      // If it's the first profile, make it active and redirect to login screen
      if (updatedList.length === 1) {
        localStorage.setItem('active_school_id', newProfile.id);
        initSupabase();
        alert(`ลงทะเบียนโรงเรียนแรกสำเร็จ! กำลังพาท่านไปหน้าเข้าสู่ระบบของ: ${newProfile.name}`);
        window.location.reload();
        return;
      }
    }

    // Reset Form
    setIsEditing(false);
    setEditId(null);
    setName('');
    setSupabaseUrl('');
    setSupabaseAnonKey('');
    setVercelUrl('');
    setGasUrl('');
    
    loadProfiles();
  };

  const handleEdit = (profile: SchoolProfile) => {
    setEditId(profile.id);
    setName(profile.name);
    setSupabaseUrl(profile.supabaseUrl);
    setSupabaseAnonKey(profile.supabaseAnonKey);
    setVercelUrl(profile.vercelUrl);
    setGasUrl(profile.gasUrl || '');
    setIsEditing(true);
    setError(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`คุณครูยืนยันที่จะลบโปรไฟล์ของ "${name}" หรือไม่?\nข้อมูลการเชื่อมต่อจะถูกลบออกจากเครื่องนี้`)) {
      const currentList = getSchoolProfiles();
      const updatedList = currentList.filter(p => p.id !== id);
      localStorage.setItem('school_profiles', JSON.stringify(updatedList));

      // If deleted the active school
      if (activeProfile?.id === id) {
        if (updatedList.length > 0) {
          localStorage.setItem('active_school_id', updatedList[0].id);
        } else {
          localStorage.removeItem('active_school_id');
        }
        initSupabase();
      }

      loadProfiles();
    }
  };

  const handleSelect = (profile: SchoolProfile) => {
    localStorage.setItem('active_school_id', profile.id);
    initSupabase();
    setActiveProfile(profile);
    
    // Alert and reload to refresh connections
    alert(`เปลี่ยนไปเชื่อมต่อฐานข้อมูล: ${profile.name}`);
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <header className="flex items-center justify-between mb-8 pb-6 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
              <Settings size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">ตั้งค่าการเชื่อมต่อสถานศึกษา</h1>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Multi-School Connection Settings</p>
            </div>
          </div>

          {profiles.length > 0 && !isEditing && (
            <button 
              onClick={onBackToLogin || (() => window.location.reload())}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-600 font-bold rounded-xl border border-slate-200 transition-all text-sm"
            >
              <ArrowLeft size={16} /> ย้อนกลับไปเข้าสู่ระบบ
            </button>
          )}
        </header>

        {isEditing ? (
          /* Form for Add/Edit */
          <div className="bg-white rounded-[32px] border border-slate-200/60 shadow-xl overflow-hidden animate-in fade-in duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center gap-3 bg-slate-50/50">
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600">
                <School size={20} />
              </div>
              <h3 className="font-black text-slate-800 text-base">
                {editId ? '📝 แก้ไขข้อมูลโรงเรียน' : '➕ เพิ่มข้อมูลโรงเรียนใหม่'}
              </h3>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-6">
              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 font-medium">
                  ⚠️ {error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">ชื่อโรงเรียน *</label>
                  <input 
                    type="text" 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="เช่น โรงเรียนบ้านควนโคกยา (โรงเรียนที่ 3)"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Supabase URL *</label>
                  <input 
                    type="url" 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                    value={supabaseUrl}
                    onChange={e => setSupabaseUrl(e.target.value)}
                    placeholder="https://xxxxxx.supabase.co"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Supabase Anon Key *</label>
                  <textarea 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                    rows={2}
                    value={supabaseAnonKey}
                    onChange={e => setSupabaseAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Vercel Webhook URL (ของบอตไลน์) *</label>
                  <input 
                    type="url" 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                    value={vercelUrl}
                    onChange={e => setVercelUrl(e.target.value)}
                    placeholder="https://school-admin-xxxx.vercel.app"
                    required
                  />
                  <span className="text-[10px] text-slate-400 block ml-1">ระบบจะยิงแจ้งเตือนผ่าน endpoint `/api/line-webhook` ของ Vercel นี้</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Google Apps Script URL (เบิกสาธารณูปโภค/แนบไฟล์ไดรฟ์ - ไม่จำเป็น)</label>
                  <input 
                    type="url" 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                    value={gasUrl}
                    onChange={e => setGasUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/xxxx/exec"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-50">
                <button 
                  type="button"
                  onClick={() => { setIsEditing(false); setEditId(null); setError(null); }}
                  className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  className="flex items-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-sm transition-all"
                >
                  <Save size={18} /> บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* List of Schools */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-700 text-sm uppercase tracking-widest">
                รายชื่อโรงเรียนที่ตั้งค่าไว้ ({profiles.length})
              </h3>
              <button 
                onClick={() => {
                  setEditId(null);
                  setName('');
                  setSupabaseUrl('');
                  setSupabaseAnonKey('');
                  setVercelUrl('');
                  setGasUrl('');
                  setIsEditing(true);
                  setError(null);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-sm transition-all text-sm"
              >
                <Plus size={16} /> เพิ่มโรงเรียนใหม่
              </button>
            </div>

            {profiles.length === 0 ? (
              <div className="bg-white rounded-[32px] border border-slate-200/60 p-12 text-center shadow-xs">
                <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4">
                  <School size={32} />
                </div>
                <h4 className="font-black text-slate-700 text-lg">ยังไม่มีข้อมูลการเชื่อมต่อโรงเรียน</h4>
                <p className="text-slate-400 text-sm max-w-md mx-auto mt-2 font-medium">
                  กรุณากดปุ่ม <strong>"เพิ่มโรงเรียนใหม่"</strong> ด้านบน เพื่อกรอกคีย์เชื่อมต่อฐานข้อมูล Supabase และแชทบอตไลน์ของโรงเรียน
                </p>
                <div className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl">
                  <Info size={14} /> สามารถศึกษาขั้นตอนการสร้างคีย์จากไฟล์ MULTISCHOOL_SETUP_GUIDE.md ในโปรเจกต์
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {profiles.map(profile => {
                  const isActive = activeProfile?.id === profile.id;
                  return (
                    <div 
                      key={profile.id}
                      className={`bg-white rounded-[32px] border transition-all duration-300 relative group overflow-hidden shadow-xs ${
                        isActive 
                          ? 'border-emerald-500 ring-2 ring-emerald-500/10 shadow-emerald-50/50' 
                          : 'border-slate-200/60 hover:border-slate-300 hover:shadow-md'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute top-0 right-0 bg-emerald-500 text-white px-4 py-1.5 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                          <Check size={12} /> กำลังเชื่อมต่อ
                        </div>
                      )}

                      <div className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                            isActive ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            <School size={22} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-black text-slate-800 text-base leading-tight truncate pr-16">{profile.name}</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">ID: {profile.id}</p>
                          </div>
                        </div>

                        <div className="mt-6 space-y-2.5 pt-4 border-t border-slate-100/80">
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                            <Database size={14} className="text-slate-400 shrink-0" />
                            <span className="truncate">{profile.supabaseUrl}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                            <Globe size={14} className="text-slate-400 shrink-0" />
                            <span className="truncate">{profile.vercelUrl}</span>
                          </div>
                        </div>

                        <div className="mt-6 flex gap-2 pt-2">
                          <button
                            onClick={() => handleSelect(profile)}
                            disabled={isActive}
                            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                              isActive 
                                ? 'bg-emerald-50 text-emerald-600 cursor-default' 
                                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm active:scale-95'
                            }`}
                          >
                            <Check size={14} /> {isActive ? 'เชื่อมต่ออยู่' : 'เลือกเชื่อมต่อ'}
                          </button>
                          
                          <button
                            onClick={() => handleEdit(profile)}
                            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl border border-slate-200/50 transition-all active:scale-95"
                            title="แก้ไขข้อมูล"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            onClick={() => handleDelete(profile.id, profile.name)}
                            className="p-2.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-all active:scale-95"
                            title="ลบโรงเรียน"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <footer className="max-w-4xl mx-auto w-full mt-12 pt-6 border-t border-slate-200 text-center">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          <p>Smart School Admin © Multi-School Manager</p>
          <div className="flex gap-4">
            <span className="flex items-center gap-1 text-slate-500">
              <Info size={12} />
              ระบบรหัสเชื่อมต่อเก็บอยู่ในเบราว์เซอร์เครื่องนี้อย่างปลอดภัย
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
