import { useState, useEffect } from 'react';
import { supabase, type SchoolProfile, initSupabase } from '../lib/supabase';
import { ArrowLeft, Mail, Loader2, CheckCircle2, School, RefreshCw } from 'lucide-react';

interface ForgotPasswordViewProps {
  onBack: () => void;
  profiles: SchoolProfile[];
  selectedSchoolId: string;
  schoolName: string;
  schoolLogo: string;
  onSchoolChange: (e: React.ChangeEvent<HTMLSelectElement>) => Promise<void>;
}

function mapErrorMessage(msg: string): string {
  if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many'))
    return 'ส่งอีเมลบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
  if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('invalid'))
    return 'ไม่พบอีเมลนี้ในระบบ กรุณาตรวจสอบอีเมลอีกครั้ง';
  if (msg.toLowerCase().includes('smtp'))
    return 'ระบบอีเมลขัดข้อง กรุณาติดต่อผู้ดูแลระบบ';
  return `เกิดข้อผิดพลาด: ${msg}`;
}

export default function ForgotPasswordView({
  onBack,
  profiles,
  selectedSchoolId,
  schoolName,
  schoolLogo,
  onSchoolChange,
}: ForgotPasswordViewProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [localSchoolId, setLocalSchoolId] = useState(selectedSchoolId);

  // Countdown สำหรับส่งซ้ำ
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSchoolSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocalSchoolId(e.target.value);
    await onSchoolChange(e);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // ดึง redirectTo URL ตามโรงเรียนที่เลือก (Multi-school aware)
      const activeProfile = profiles.find((p) => p.id === localSchoolId);
      const baseUrl = activeProfile?.vercelUrl || window.location.origin;
      const redirectTo = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (resetError) throw resetError;

      setIsSent(true);
      setResendCooldown(60);
    } catch (err: any) {
      setError(mapErrorMessage(err.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError(null);
    try {
      const activeProfile = profiles.find((p) => p.id === localSchoolId);
      const baseUrl = activeProfile?.vercelUrl || window.location.origin;
      const redirectTo = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (resetError) throw resetError;
      setResendCooldown(60);
    } catch (err: any) {
      setError(mapErrorMessage(err.message || 'เกิดข้อผิดพลาด'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-green-50 to-orange-50 p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20">
        {/* Header */}
        <div className="bg-brand-primary p-8 text-white text-center relative">
          <button
            onClick={onBack}
            className="absolute left-4 top-8 p-2 hover:bg-white/10 rounded-full transition-colors"
            aria-label="กลับหน้า Login"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="bg-white w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg p-2 overflow-hidden">
            <img
              src={schoolLogo || import.meta.env.VITE_SCHOOL_LOGO_PATH || 'logo.png'}
              alt="School Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold">ลืมรหัสผ่าน</h1>
          <p className="text-green-100/80 mt-1 truncate">{schoolName}</p>
        </div>

        {/* Body */}
        <div className="p-8">
          {!isSent ? (
            /* ===== ฟอร์มกรอกอีเมล ===== */
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-slate-500 text-sm text-center leading-relaxed">
                กรอกอีเมลที่ใช้ลงทะเบียนในระบบ เราจะส่งลิงก์สำหรับ
                <br />
                <strong className="text-slate-700">ตั้งรหัสผ่านใหม่</strong> ไปให้ที่อีเมลของท่าน
              </p>

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 font-medium animate-in fade-in">
                  {error}
                </div>
              )}

              {/* School Selector */}
              {profiles.length > 1 && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
                    สถานศึกษา
                  </label>
                  <div className="relative">
                    <select
                      className="w-full px-4 py-3 pr-10 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all bg-slate-50 font-bold text-slate-700 appearance-none"
                      value={localSchoolId}
                      onChange={handleSchoolSelect}
                    >
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-4 text-slate-400 pointer-events-none">
                      <School size={16} />
                    </div>
                  </div>
                </div>
              )}

              {/* Email Input */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
                  อีเมลผู้ใช้งาน
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    className="w-full px-4 py-3 pl-11 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all bg-slate-50 font-bold"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <div className="absolute left-4 top-3.5 text-slate-400 pointer-events-none">
                    <Mail size={18} />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-primary hover:bg-green-700 text-white py-4 rounded-2xl font-black text-lg transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-70 disabled:active:scale-100"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={22} />
                ) : (
                  <Mail size={22} />
                )}
                {loading ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
              </button>

              {/* Back link */}
              <button
                type="button"
                onClick={onBack}
                className="w-full text-slate-400 text-sm font-bold hover:text-slate-600 transition-colors py-2"
              >
                ← กลับสู่หน้าเข้าสู่ระบบ
              </button>
            </form>
          ) : (
            /* ===== Success State ===== */
            <div className="text-center space-y-5 animate-in fade-in">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="text-green-500" size={44} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 mb-2">ส่งอีเมลแล้ว!</h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปที่
                  <br />
                  <strong className="text-brand-primary break-all">{email}</strong>
                  <br />
                  <br />
                  กรุณาตรวจสอบ <strong>Inbox</strong> และ <strong>Spam/Junk</strong>
                  <br />
                  ลิงก์จะหมดอายุภายใน <strong>1 ชั่วโมง</strong>
                </p>
              </div>

              {/* Resend Button */}
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                className="w-full border-2 border-brand-primary text-brand-primary hover:bg-green-50 py-3 rounded-2xl font-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <RefreshCw size={18} />
                )}
                {resendCooldown > 0
                  ? `ส่งซ้ำได้ใน ${resendCooldown} วินาที`
                  : 'ส่งอีเมลอีกครั้ง'}
              </button>

              <button
                onClick={onBack}
                className="w-full text-slate-400 text-sm font-bold hover:text-slate-600 transition-colors py-2"
              >
                ← กลับสู่หน้าเข้าสู่ระบบ
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
