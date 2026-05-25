import { useState, useEffect } from 'react';
import { supabase, getSchoolProfiles, getActiveSchoolProfile, initSupabase, type SchoolProfile } from '../lib/supabase';
import { LogIn, UserPlus, Loader2, ArrowLeft, Settings, School } from 'lucide-react';

interface LoginProps {
  onManageSchools: () => void;
}

export default function Login({ onManageSchools }: LoginProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  const [profiles, setProfiles] = useState<SchoolProfile[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [schoolName, setSchoolName] = useState('โรงเรียนยังไม่ได้ระบุ');
  const [schoolLogo, setSchoolLogo] = useState('');

  useEffect(() => {
    const list = getSchoolProfiles();
    setProfiles(list);
    
    const active = getActiveSchoolProfile();
    if (active) {
      setSelectedSchoolId(active.id);
      setSchoolName(active.name);
      fetchSchoolSettings();
    } else if (list.length > 0) {
      const firstSchool = list[0];
      setSelectedSchoolId(firstSchool.id);
      localStorage.setItem('active_school_id', firstSchool.id);
      initSupabase();
      setSchoolName(firstSchool.name);
      fetchSchoolSettings();
    }
  }, []);

  async function fetchSchoolSettings() {
    try {
      const { data, error } = await supabase.from('settings').select('school_name, school_logo_url').single();
      if (error) throw error;
      if (data?.school_name) {
        setSchoolName(data.school_name);
      }
      if (data?.school_logo_url) {
        setSchoolLogo(data.school_logo_url);
      } else {
        setSchoolLogo('');
      }
    } catch (err) {
      console.warn('Error fetching school name/logo from DB:', err);
      setSchoolLogo('');
    }
  }

  const handleSchoolChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedSchoolId(id);
    localStorage.setItem('active_school_id', id);
    initSupabase();
    
    const matched = profiles.find(p => p.id === id);
    if (matched) {
      setSchoolName(matched.name);
    }
    
    setSchoolLogo('');
    await fetchSchoolSettings();
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        // 1. Sign Up User
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
            }
          }
        });

        if (signUpError) throw signUpError;

        // 2. Create Profile in 'profiles' table
        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').insert([
            {
              id: data.user.id,
              display_name: displayName,
              email: email,
              role: 'guest',
              status: 'active'
            }
          ]);
          if (profileError) console.error('Profile creation error:', profileError);
        }

        setMessage('ลงทะเบียนสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันตัวตน (หากระบบตั้งค่าไว้) หรือลองเข้าสู่ระบบ');
        setIsSignUp(false);
      } else {
        // Sign In
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      let errorMsg = err.message;
      if (err.message === 'User already registered') errorMsg = 'อีเมลนี้ถูกใช้งานไปแล้ว';
      setError(errorMsg || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-green-50 to-orange-50 p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20">
        <div className="bg-brand-primary p-8 text-white text-center transition-all duration-500 relative">
          {isSignUp && (
            <button 
              onClick={() => setIsSignUp(false)}
              className="absolute left-4 top-8 p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="bg-white w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg p-2 overflow-hidden">
            <img src={schoolLogo || import.meta.env.VITE_SCHOOL_LOGO_PATH || "logo.png"} alt="School Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold">{isSignUp ? 'ลงทะเบียนผู้ใช้งาน' : 'ระบบบริหารจัดการข้อมูลโรงเรียน'}</h1>
          <p className="text-green-100/80 mt-1 truncate">{schoolName}</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleAuth} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 animate-pulse font-medium">
                {error}
              </div>
            )}
            {message && (
              <div className="bg-green-50 text-green-600 p-4 rounded-xl text-sm border border-green-100 font-medium">
                {message}
              </div>
            )}
            
            {/* School Selector (Only shown if not signing up) */}
            {!isSignUp && profiles.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    เชื่อมต่อฐานข้อมูลสถานศึกษา
                  </label>
                  <button 
                    type="button"
                    onClick={onManageSchools}
                    className="text-[10px] text-brand-primary font-black hover:underline uppercase tracking-widest flex items-center gap-1"
                  >
                    <Settings size={10} /> จัดการ
                  </button>
                </div>
                <div className="relative">
                  <select
                    className="w-full px-4 py-3 pr-10 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all bg-slate-50 font-bold text-slate-700 appearance-none animate-in fade-in"
                    value={selectedSchoolId}
                    onChange={handleSchoolChange}
                  >
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-4 text-slate-400 pointer-events-none">
                    <School size={16} />
                  </div>
                </div>
              </div>
            )}

            {isSignUp && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all bg-slate-50 font-bold"
                  placeholder="กรอกชื่อของคุณ"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">อีเมลผู้ใช้งาน</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all bg-slate-50 font-bold"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1 tracking-widest">รหัสผ่าน</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all bg-slate-50 font-bold"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full ${isSignUp ? 'bg-brand-primary hover:bg-green-700' : 'bg-brand-secondary hover:bg-orange-600'} text-white py-4 rounded-2xl font-black text-lg transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-70 disabled:active:scale-100`}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                isSignUp ? <UserPlus size={24} /> : <LogIn size={24} />
              )}
              {isSignUp ? 'สร้างบัญชีผู้ใช้' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          {!isSignUp && (
            <div className="mt-6 text-center">
              <p className="text-slate-500 text-sm">
                ยังไม่มีบัญชี? {' '}
                <button 
                  onClick={() => { setIsSignUp(true); setError(null); setMessage(null); }}
                  className="text-brand-primary font-bold hover:underline"
                >
                  ลงทะเบียนที่นี่
                </button>
              </p>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              © {new Date().getFullYear()} {schoolName}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
