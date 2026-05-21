import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { uploadToSupabase } from '../lib/storage';
import { 
  User, 
  Mail, 
  Shield, 
  Save, 
  Loader2, 
  Upload, 
  Image as ImageIcon,
  CheckCircle2, 
  MessageCircle,
  ExternalLink,
  Trash2
} from 'lucide-react';

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [selectedSignature, setSelectedSignature] = useState<File | null>(null);
  const [sigPreviewUrl, setSigPreviewUrl] = useState<string | null>(null);
  const [teacherInfo, setTeacherInfo] = useState<any>(null);
  const [lineLink, setLineLink] = useState('');

  const fetchTeacherInfo = async (email: string) => {
    if (!email) return;
    try {
      const { data } = await supabase
        .from('teachers')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      
      setTeacherInfo(data);
    } catch (err) {
      console.error('Error fetching teacher info:', err);
    }
  };

  async function fetchSettings() {
    try {
      const { data } = await supabase.from('settings').select('line_oa_link').maybeSingle();
      if (data) setLineLink(data.line_oa_link || '');
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  }

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setSigPreviewUrl(profile.signature_url || null);
      fetchTeacherInfo(profile.email);
    }
    fetchSettings();
  }, [profile]);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);

    try {
      let signatureUrl = profile?.signature_url;

      if (selectedSignature) {
        const fileExt = selectedSignature.name.split('.').pop() || 'png';
        const fileName = `user_sig_${user.id}_${Date.now()}.${fileExt}`;
        signatureUrl = await uploadToSupabase(selectedSignature, 'system', fileName);
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          signature_url: signatureUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      alert('อัปเดตข้อมูลส่วนตัวเรียบร้อยแล้ว');
      setSelectedSignature(null);
    } catch (err: any) {
      alert('อัปเดตไม่สำเร็จ: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedSignature(file);
      setSigPreviewUrl(URL.createObjectURL(file));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-brand-primary/10 rounded-[24px] flex items-center justify-center text-brand-primary shadow-sm border border-brand-primary/20">
          <User size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">ข้อมูลส่วนตัวและลายเซ็น</h2>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">My Profile & Digital Signature</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Account Summary */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm text-center">
            <div className="w-24 h-24 bg-slate-50 rounded-[32px] border border-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-300 shadow-inner overflow-hidden">
               {teacherInfo?.photo_url ? (
                 <img src={teacherInfo.photo_url} className="w-full h-full object-cover" alt="Profile" />
               ) : (
                 <User size={48} />
               )}
            </div>
            <h3 className="font-black text-slate-800 text-lg leading-tight">{profile?.display_name || user?.email}</h3>
            <div className="mt-4 flex flex-col items-center gap-2">
               <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                  {profile?.role || 'Guest'}
               </span>
               {profile?.status === 'active' && (
                 <span className="flex items-center gap-1 text-[9px] font-black text-green-500 uppercase tracking-widest">
                   <CheckCircle2 size={10} /> บัญชีได้รับการอนุมัติแล้ว
                 </span>
               )}
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-[32px] text-white space-y-4">
             <div className="flex items-center gap-3">
                <Shield size={20} className="text-brand-primary" />
                <p className="text-xs font-black uppercase tracking-widest">ความปลอดภัย</p>
             </div>
             <p className="text-[10px] text-slate-400 leading-relaxed font-bold">
               ลายเซ็นดิจิทัลของคุณจะถูกเก็บรักษาไว้อย่างปลอดภัยและจะถูกนำไปใช้เฉพาะเมื่อคุณดำเนินการผ่านระบบสารบรรณของโรงเรียนเท่านั้น
             </p>
          </div>

          {/* LINE Connection Status */}
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
             <div className="flex items-center gap-3">
                <MessageCircle size={20} className="text-[#06C755]" />
                <p className="text-xs font-black text-slate-800 uppercase tracking-widest">การเชื่อมต่อ LINE</p>
             </div>
             {profile?.line_user_id ? (
               <div className="space-y-2">
                 <div className="flex items-center gap-2 text-green-600">
                   <CheckCircle2 size={14} />
                   <span className="text-[10px] font-black uppercase">เชื่อมต่อแล้ว</span>
                 </div>
                 <p className="text-[9px] text-slate-400 font-bold leading-relaxed">
                   คุณสามารถสอบถามข้อมูลโรงเรียนผ่าน LINE OA ได้ทันที
                 </p>
               </div>
             ) : (
               <div className="space-y-3">
                 <p className="text-[10px] text-slate-400 font-bold leading-relaxed italic">
                   ยังไม่ได้เชื่อมต่อบัญชี LINE
                 </p>
                 <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[9px] text-slate-600 font-bold leading-relaxed">
                      วิธีเชื่อมต่อ: เพิ่มเพื่อน LINE OA ของโรงเรียนแล้วพิมพ์อีเมลของคุณส่งไปในแชท
                    </p>
                 </div>
                 {lineLink && (
                   <a 
                     href={lineLink} 
                     target="_blank" 
                     rel="noreferrer"
                     className="w-full py-3 bg-[#06C755] text-white rounded-xl font-black text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-green-100 hover:bg-[#05b34c] transition-all uppercase tracking-widest"
                   >
                     <ExternalLink size={14} /> เพิ่มเพื่อน LINE OA ตอนนี้
                   </a>
                 )}
               </div>
             )}
          </div>
        </div>

        {/* Right Column: Edit Form */}
        <div className="md:col-span-2 space-y-8">
          <form onSubmit={handleUpdateProfile} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
            {/* Display Name */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800">
                <User size={20} className="text-brand-primary" />
                <h4 className="font-black text-sm uppercase tracking-wider">ชื่อที่แสดงในระบบ</h4>
              </div>
              <input 
                type="text" 
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
                placeholder="เช่น นายไพโรจน์ มากแก้ว"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <p className="text-[10px] text-slate-400 font-bold ml-1 uppercase">ชื่อนี้จะถูกนำไปวางในช่อง "ลงชื่อ" ในเอกสาร PDF</p>
            </div>

            {/* Email (Read Only) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-400">
                <Mail size={20} />
                <h4 className="font-black text-sm uppercase tracking-wider">อีเมลล็อกอิน (แก้ไขไม่ได้)</h4>
              </div>
              <input 
                type="text" 
                className="w-full p-4 bg-slate-100 border border-slate-100 rounded-2xl font-bold text-slate-400 cursor-not-allowed"
                value={user?.email || ''}
                readOnly
              />
            </div>

            {/* Signature Upload */}
            <div className="space-y-4 pt-4 border-t border-slate-50">
              <div className="flex items-center gap-2 text-slate-800">
                <ImageIcon size={20} className="text-brand-primary" />
                <h4 className="font-black text-sm uppercase tracking-wider">ลายเซ็นดิจิทัลส่วนตัว</h4>
              </div>
              
              <div className="flex flex-col items-center justify-center gap-6 p-8 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 relative group overflow-hidden">
                 {sigPreviewUrl ? (
                   <img src={sigPreviewUrl} className="max-h-32 object-contain" alt="Signature Preview" />
                 ) : (
                   <div className="flex flex-col items-center gap-3">
                      <Upload className="text-slate-300" size={40} />
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">คลิกเพื่ออัปโหลดไฟล์ภาพลายเซ็น</span>
                   </div>
                 )}
                 <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    <Upload className="text-white" size={32} />
                 </label>
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                 <div className="shrink-0 w-8 h-8 bg-amber-200 rounded-full flex items-center justify-center text-amber-700">
                    <Trash2 size={16} />
                 </div>
                 <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                   คำแนะนำ: ควรใช้ภาพถ่ายลายเซ็นจากปากกาสีน้ำเงินหรือดำ บนกระดาษขาวล้วน <br/>
                   ระบบจะนำไปประทับตราอัตโนมัติในส่วนของ "เกษียณเสนอ" (ซ้ายล่าง) ของหนังสือรับ
                 </p>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSaving}
              className="w-full py-5 bg-brand-primary text-white rounded-[24px] font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-green-100 hover:bg-green-700 transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <Save />} บันทึกการเปลี่ยนแปลง
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
