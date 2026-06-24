import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadToSupabase, uploadFileToDrive, deleteFromSupabase } from '../lib/storage';
import { 
  Save, 
  Loader2, 
  School, 
  CalendarDays, 
  UserCircle,
  ImageIcon,
  Upload,
  Send,
  Sparkles,
  Info
} from 'lucide-react';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState({
    school_name: '',
    school_address: '',
    director_name: '',
    current_academic_year: '2568',
    current_term: '1',
    school_logo_url: '',
    director_signature_url: '',
    phone_number: '',
    local_gov_name: '',
    line_channel_access_token: '',
    line_group_id: '',
    line_oa_link: '',
    gemini_api_key: '',
    ai_cowork_api_key: ''
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSignature, setSelectedSignature] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sigPreviewUrl, setSigPreviewUrl] = useState<string | null>(null);

  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState('');
  const [migrationProgress, setMigrationProgress] = useState(0);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is 'no rows'
      if (data) {
        setSettings(data);
        setPreviewUrl(data.school_logo_url);
        setSigPreviewUrl(data.director_signature_url);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleMigrateOldFiles = async () => {
    if (!confirm('ยืนยันที่จะโอนย้ายไฟล์เอกสารที่เคยเกษียณผ่าน LINE ในอดีตเข้า Google Drive หรือไม่? (ระบบจะค้นหาและย้ายไฟล์ให้เฉพาะเอกสารที่เก็บอยู่ใน Supabase ชั่วคราว)')) return;
    setIsMigrating(true);
    setMigrationStatus('กำลังค้นหาเอกสารเก่า...');
    setMigrationProgress(0);

    try {
      // 1. ดึงรายการเอกสารรับ (incoming_docs) ที่เกษียณแล้ว (assigned)
      const { data: docs, error } = await supabase
        .from('incoming_docs')
        .select('id, doc_number, subject, file_url')
        .eq('status', 'assigned');

      if (error) throw error;

      // คัดกรองเฉพาะไฟล์ที่เป็น Supabase Storage
      const targetDocs = (docs || []).filter(doc => doc.file_url && doc.file_url.includes('supabase.co'));

      if (targetDocs.length === 0) {
        setMigrationStatus('🎉 ไม่พบไฟล์เอกสารค้างใน Supabase แล้ว! เอกสารทั้งหมดอยู่ใน Google Drive เรียบร้อยดีค่ะ');
        setIsMigrating(false);
        return;
      }

      let successCount = 0;
      for (let i = 0; i < targetDocs.length; i++) {
        const doc = targetDocs[i];
        setMigrationStatus(`[${i + 1}/${targetDocs.length}] กำลังย้ายเรื่อง: "${doc.subject.substring(0, 30)}..."`);
        
        try {
          // 1. Fetch file จาก Supabase
          const response = await fetch(doc.file_url);
          if (!response.ok) throw new Error('ดาวน์โหลดไฟล์จาก Supabase ล้มเหลว');
          const blob = await response.blob();

          // 2. สร้างอ็อบเจกต์ไฟล์
          const sanitized = doc.subject.replace(/[\/\\?%*:|"<>]/g, '-').slice(0, 50);
          const fileName = `${doc.doc_number}_เรื่อง_${sanitized}.pdf`;
          const file = new File([blob], fileName, { type: 'application/pdf' });

          // 3. ส่งเข้า Google Drive
          const gDriveUrl = await uploadFileToDrive(file, 'incoming', fileName.replace('.pdf', ''));
          
          // 4. อัปเดตใน Supabase Database
          const { error: updateErr } = await supabase
            .from('incoming_docs')
            .update({ file_url: gDriveUrl })
            .eq('id', doc.id);

          if (updateErr) throw updateErr;

          // 5. ลบไฟล์เดิมใน Supabase Storage
          const tempPath = doc.file_url.split('/').pop()?.split('?')[0];
          if (tempPath) {
            await deleteFromSupabase('temp_docs', tempPath);
          }

          successCount++;
        } catch (err: any) {
          console.error(`Failed to migrate doc ID ${doc.id}:`, err);
        }
        setMigrationProgress(Math.round(((i + 1) / targetDocs.length) * 100));
      }

      setMigrationStatus(`✅ โอนย้ายไฟล์เอกสารเก่าสำเร็จ ${successCount} จากทั้งหมด ${targetDocs.length} รายการแล้วค่ะ 🌸`);
    } catch (err: any) {
      setMigrationStatus(`❌ เกิดข้อผิดพลาดในการโอนย้าย: ${err.message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    try {
      let logoUrl = settings.school_logo_url;
      let sigUrl = settings.director_signature_url;

      // ตั้งชื่อไฟล์ใหม่เป็นภาษาอังกฤษเพื่อป้องกันปัญหา Invalid Key จากภาษาไทย
      if (selectedFile) {
        const logoExt = selectedFile.name.split('.').pop() || 'png';
        const logoPath = `school_logo_${Date.now()}.${logoExt}`;
        logoUrl = await uploadToSupabase(selectedFile, 'system', logoPath);
      }

      if (selectedSignature) {
        const sigExt = selectedSignature.name.split('.').pop() || 'png';
        const sigPath = `director_sig_${Date.now()}.${sigExt}`;
        sigUrl = await uploadToSupabase(selectedSignature, 'system', sigPath);
      }

      const payload = { 
        ...settings, 
        school_logo_url: logoUrl, 
        director_signature_url: sigUrl 
      };
      
      const { data: existing } = await supabase.from('settings').select('id').maybeSingle();

      const { error } = existing 
        ? await supabase.from('settings').update(payload).eq('id', existing.id)
        : await supabase.from('settings').insert([payload]);

      if (error) throw error;
      alert('บันทึกการตั้งค่าเรียบร้อยแล้ว');
      fetchSettings();
    } catch (err: any) {
      console.error(err);
      alert('บันทึกไม่สำเร็จ: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedSignature(file);
      setSigPreviewUrl(URL.createObjectURL(file));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[40px] border border-slate-100 shadow-sm">
        <Loader2 className="animate-spin text-brand-primary mb-4" size={40} />
        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">กำลังโหลดข้อมูลการตั้งค่า...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <form onSubmit={handleSave} className="space-y-8">
        {/* Section: School Info */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex items-center gap-4 bg-slate-50/30">
            <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary shadow-sm">
              <School size={24} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">ข้อมูลสถานศึกษา</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">School Identity & Profile</p>
            </div>
          </div>

          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-full space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest text-brand-primary">ชื่อโรงเรียน</label>
              <input 
                type="text" 
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
                value={settings.school_name}
                onChange={e => setSettings({...settings, school_name: e.target.value})}
                placeholder="โรงเรียน..."
                required
              />
            </div>

            <div className="col-span-full space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest text-brand-primary">ที่อยู่โรงเรียน</label>
              <textarea 
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
                rows={3}
                value={settings.school_address}
                onChange={e => setSettings({...settings, school_address: e.target.value})}
                placeholder="ที่อยู่..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest text-brand-primary">ชื่อผู้อำนวยการ</label>
              <div className="relative">
                <UserCircle className="absolute left-4 top-4 text-slate-300" size={20} />
                <input 
                  type="text" 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
                  value={settings.director_name}
                  onChange={e => setSettings({...settings, director_name: e.target.value})}
                  placeholder="นาย/นาง/นางสาว..."
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest text-brand-primary">ต้นสังกัด/องค์กรปกครองส่วนท้องถิ่น</label>
              <input 
                type="text" 
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
                value={settings.local_gov_name}
                onChange={e => setSettings({...settings, local_gov_name: e.target.value})}
                placeholder="สพป.พัทลุง เขต 2 / ทต..."
              />
            </div>

            <div className="col-span-full space-y-4 pt-4 border-t border-slate-50">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Send size={16} className="text-brand-primary" /> การตั้งค่า LINE Messaging API
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest text-brand-primary">Channel Access Token</label>
                  <input 
                    type="password" 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
                    value={settings.line_channel_access_token}
                    onChange={e => setSettings({...settings, line_channel_access_token: e.target.value})}
                    placeholder="ใส่ Long-lived Channel Access Token..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest text-brand-primary">Group ID (สำหรับแจ้งเตือนส่วนกลาง)</label>
                  <input 
                    type="text" 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
                    value={settings.line_group_id}
                    onChange={e => setSettings({...settings, line_group_id: e.target.value})}
                    placeholder="เช่น C1234567890abcdef..."
                  />
                </div>
                <div className="col-span-full space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest text-[#06C755]">ลิงก์เพิ่มเพื่อน LINE OA (เช่น https://line.me/R/ti/p/@...)</label>
                  <input 
                    type="text" 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-[#06C755]/10 focus:border-[#06C755] transition-all"
                    value={settings.line_oa_link || ''}
                    onChange={e => setSettings({...settings, line_oa_link: e.target.value})}
                    placeholder="ใส่ลิงก์สำหรับให้ครูกดเพิ่มเพื่อน..."
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Messaging API จะถูกนำมาใช้แทน LINE Notify ที่กำลังจะปิดตัวลง</p>
            </div>
          </div>
        </div>

        {/* Section: Gemini AI API */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex items-center gap-4 bg-slate-50/30">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">การตั้งค่า AI (Gemini API)</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">AI Summary & Document Processing</p>
            </div>
          </div>

          <div className="p-8 space-y-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest text-indigo-600">Gemini API Key (หลัก)</label>
              <input 
                type="password" 
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
                value={settings.gemini_api_key}
                onChange={e => setSettings({...settings, gemini_api_key: e.target.value})}
                placeholder="ใส่ Gemini API Key หลัก (หากมีหลายคีย์ ให้คั่นด้วยเครื่องหมายจุลภาค , )"
              />
              <p className="text-[10px] text-slate-400 font-bold ml-1 uppercase">ใช้สำหรับการสรุปเนื้อหาหนังสือราชการ (งานสารบรรณ) *รองรับการใส่หลายคีย์คั่นด้วยเครื่องหมายจุลภาคเพื่อกระจายโหลดและป้องกัน Rate Limit</p>
            </div>

            <div className="space-y-1.5 pt-4 border-t border-slate-50">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest text-brand-primary">AI Cowork API Key (เฉพาะส่วนผู้ช่วยครู)</label>
              <input 
                type="password" 
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-green-100 focus:border-brand-primary transition-all"
                value={settings.ai_cowork_api_key}
                onChange={e => setSettings({...settings, ai_cowork_api_key: e.target.value})}
                placeholder="ใส่ API Key แยกสำหรับ AI Cowork (หากมีหลายคีย์ ให้คั่นด้วยเครื่องหมายจุลภาค , )"
              />
              <p className="text-[10px] text-slate-400 font-bold ml-1 uppercase italic">* แนะนำให้แยก Key หรือใส่หลายคีย์คั่นด้วยเครื่องหมายจุลภาค ( , ) เพื่อกระจายการทำงานไม่ให้กระทบงานสารบรรณเมื่อคุณครูใช้งานพร้อมกันจำนวนมาก</p>
            </div>
          </div>

        </div>

        {/* Section: Academic Year & Logo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-50 flex items-center gap-4 bg-slate-50/30">
              <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-600 shadow-sm">
                <CalendarDays size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">ปีการศึกษาปัจจุบัน</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Active Academic Term</p>
              </div>
            </div>
            <div className="p-8 space-y-6 flex-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest text-orange-600">ปีการศึกษา (พ.ศ.)</label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-2xl text-slate-700 text-center outline-hidden focus:ring-2 focus:ring-orange-200 focus:border-orange-500 transition-all"
                  value={settings.current_academic_year}
                  onChange={e => setSettings({...settings, current_academic_year: e.target.value})}
                  placeholder="256X"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest text-orange-600">ภาคเรียน</label>
                <div className="grid grid-cols-2 gap-4">
                  {['1', '2'].map(term => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setSettings({...settings, current_term: term})}
                      className={`py-4 rounded-2xl font-black text-xl transition-all ${settings.current_term === term ? 'bg-orange-500 text-white shadow-lg shadow-orange-100 ring-4 ring-orange-50' : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100'}`}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex items-center gap-4 bg-slate-50/30">
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                <ImageIcon size={24} />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">ตราสัญลักษณ์โรงเรียน</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">School Logo & Branding</p>
              </div>
            </div>
            <div className="p-8 flex flex-col items-center justify-center gap-6">
              <div className="w-32 h-32 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden group relative">
                {previewUrl ? (
                  <img src={previewUrl} className="w-full h-full object-contain p-2" alt="Preview" />
                ) : (
                  <School className="text-slate-200" size={48} />
                )}
                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  <Upload className="text-white" size={24} />
                </label>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase text-center leading-relaxed max-w-[200px]">
                รองรับไฟล์ PNG, JPG <br/>ขนาดแนะนำ 512x512 พิกเซล
              </p>
            </div>
          </div>
        </div>

        {/* Section: Director Signature */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex items-center gap-4 bg-slate-50/30">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
              <UserCircle size={24} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">ลายเซ็นดิจิทัลผู้อำนวยการ</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Digital Signature Image</p>
            </div>
          </div>
          <div className="p-8 flex flex-col items-center justify-center gap-6">
            <div className="w-64 h-32 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden group relative">
              {sigPreviewUrl ? (
                <img src={sigPreviewUrl} className="w-full h-full object-contain p-4" alt="Signature Preview" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="text-slate-300" size={32} />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">คลิกเพื่ออัปโหลดลายเซ็น</span>
                </div>
              )}
              <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                <input type="file" className="hidden" accept="image/*" onChange={handleSignatureChange} />
                <Upload className="text-white" size={24} />
              </label>
            </div>
            <div className="max-w-md space-y-2">
              <p className="text-[10px] text-slate-400 font-bold uppercase text-center leading-relaxed">
                แนะนำ: ไฟล์ PNG พื้นหลังโปร่งใส (Transparent) <br/>
                จะช่วยให้ลายเซ็นดูสมจริงเมื่อประทับทับเส้นประในเอกสาร PDF
              </p>
              {sigPreviewUrl && (
                <div className="flex justify-center">
                  <button 
                    type="button" 
                    onClick={() => { setSelectedSignature(null); setSigPreviewUrl(null); setSettings({...settings, director_signature_url: ''}); }}
                    className="text-[10px] font-black text-red-400 uppercase hover:text-red-500 transition-colors"
                  >
                    ลบลายเซ็นเดิม
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-brand-primary text-white px-12 py-4.5 rounded-[24px] font-black text-xl flex items-center gap-3 shadow-2xl shadow-green-200 hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
            บันทึกการตั้งค่าทั้งหมด
          </button>
        </div>
      </form>

      {/* Section: System Migration Tools */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden mb-8 mt-8">
        <div className="p-8 border-b border-slate-50 flex items-center gap-4 bg-slate-50/30">
          <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">เครื่องมือจัดการเอกสารย้อนหลัง</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Document Sync & Migration Tools</p>
          </div>
        </div>
        <div className="p-8 space-y-6">
          <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100/50">
            <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
              🔄 โอนย้ายไฟล์เอกสารที่สั่งการผ่าน LINE ในอดีตเข้า Google Drive
            </h4>
            <p className="text-xs text-slate-500 font-bold mt-2 leading-relaxed">
              สำหรับไฟล์ PDF ที่ผู้อำนวยการเคยสั่งการหรือเกษียณหนังสือผ่านระบบ LINE OA ก่อนการอัปเดตระบบ 
              ไฟล์เหล่านั้นจะยังคงเก็บค้างอยู่ในระบบจัดเก็บชั่วคราว (Supabase Storage) 
              ท่านสามารถใช้เครื่องมือนี้ในการสแกนดึงไฟล์เก่าทั้งหมดเหล่านั้นไปจัดเก็บถาวรใน Google Drive และอัปเดตลิงก์ในระบบให้ถูกต้องโดยอัตโนมัติ
            </p>

            {migrationStatus && (
              <div className="mt-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-2">
                <p className="text-xs font-bold text-slate-600">{migrationStatus}</p>
                {isMigrating && (
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${migrationProgress}%` }}
                    ></div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end">
              <button
                type="button"
                onClick={handleMigrateOldFiles}
                disabled={isMigrating}
                className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isMigrating ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    กำลังโอนย้ายไฟล์... ({migrationProgress}%)
                  </>
                ) : (
                  <>
                    <span>เริ่มโอนย้ายไฟล์ไป Google Drive</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section: About & Changelog */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center gap-4 bg-slate-50/30">
          <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
            <Info size={24} />
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">เกี่ยวกับระบบ (About System)</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Version info & update history</p>
          </div>
        </div>
        <div className="p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-50 rounded-3xl">
            <div>
              <h4 className="font-black text-slate-800 text-md">Smart School Admin (V2)</h4>
              <p className="text-xs text-slate-500 font-bold mt-1">ระบบบริหารจัดการข้อมูลโรงเรียน</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">เวอร์ชันปัจจุบัน:</span>
              <span className="px-4 py-1.5 bg-blue-100 text-blue-700 font-black rounded-full text-xs">
                {import.meta.env.VITE_APP_VERSION || '1.1.13'}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-black text-slate-800 text-sm border-l-4 border-brand-primary pl-3 uppercase tracking-tight">ประวัติการปรับปรุง (Changelog)</h4>
            <div className="space-y-3 pl-4">
              <div className="relative pl-6 border-l border-slate-200 pb-2">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-brand-primary animate-pulse"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">v1.1.14</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(24 มิ.ย. 2569)</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-500 mt-1 space-y-1">
                  <li>เพิ่มโมดูลย่อย <strong>"ส่งแผนการสอน"</strong> ของฝ่ายวิชาการ อนุมัติโดย ผอ./วิชาการ พร้อมพิมพ์แบบคำขอเสนออนุมัติขนาด A4 มีตราครุฑตามระเบียบงานสารบรรณ</li>
                  <li>อัปเกรดระบบลงทะเบียนนักกีฬา (ระดับจังหวัด): แปลงตัวเลขในเอกสารเป็น <strong>"ตัวเลขไทย"</strong> อัตโนมัติ ปรับปรุงหน้าสิ่งพิมพ์บังคับขนาด 16pt (TH Sarabun) และลดระยะห่างกล่องลงชื่อ ผอ. เพื่อความสมบูรณ์</li>
                  <li>แก้ไขปัญหาหน้าสิ่งพิมพ์ของนักกีฬาเกิดหน้าว่างหน้าสุดท้าย ด้วยการซ่อนแถบเครดิตและโลโก้ท้ายระบบ (IdentityFooter) ขณะสั่งพิมพ์</li>
                  <li>แก้ไขการตรวจสอบข้อมูลเพศของนักเรียน รองรับคำนำหน้าย่อ <code>"ช"</code> และ <code>"ญ"</code> เพื่อป้องกันการแสดงผลผิดพลาด</li>
                  <li>ปรับปรุงสิทธิ์การเข้าใช้งาน: แยกเมนูของครูทั่วไปเป็น <strong>"งานแผนการสอน"</strong> (เข้าถึงเฉพาะส่งแผน) และซ่อนเมนูวิชาการอื่นๆ รวมถึงระบบห้องสมุด</li>
                </ul>
              </div>

              <div className="relative pl-6 border-l border-slate-200 pb-2">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">v1.1.13</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(18 มิ.ย. 2569)</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-500 mt-1 space-y-1">
                  <li>เพิ่มระบบโมดูล <strong>เด็กในเขตพื้นที่บริการ (ทร.14/พฐ.03)</strong> นำเข้าข้อมูล จัดเรียงตามหมู่และ ก-ฮ พร้อมส่งออก พฐ.03 แนวนอน</li>
                  <li>แก้ไขสิทธิ์ระบบเบิกค่าสาธารณูปโภค ให้ ผอ. และแอดมิน อนุมัติ/ลบรายการเบิกจ่ายของทุกคนได้สำเร็จ (แก้บั๊ก RLS บล็อก)</li>
                  <li>ปิดช่องโหว่ความปลอดภัยบน Supabase: เปิด RLS ตารางจัดสรรงบประมาณ และจำกัดสิทธิ์ SELECT ตาราง <code>profiles</code> และ <code>settings</code> ให้เฉพาะคนที่ล็อกอินแล้วเท่านั้น</li>
                </ul>
              </div>

              <div className="relative pl-6 border-l border-slate-200 pb-2">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">v1.1.12</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(16 มิ.ย. 2569)</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-500 mt-1 space-y-1">
                  <li>ปรับโมเดล AI หลักเป็น <strong>gemini-3.1-flash-lite</strong> เพื่อแก้ไขข้อจำกัด Rate Limit (โควต้ารายวัน 500 RPD) สำหรับบัญชี Free Tier</li>
                  <li>แก้ไขปัญหา Error 400 จาก Google Server โดยเปลี่ยนพารามิเตอร์ส่งข้อมูลกลับเป็น CamelCase <code>responseMimeType</code> และ <code>systemInstruction</code></li>
                  <li>แก้ไขระบบการจัดเก็บข้อมูลออนไลน์ด่าน AR บังคับใช้รหัส UUID v4 ป้องกันข้อผิดพลาดของ Supabase</li>
                  <li>แยกสิทธิ์จัดการบทเรียน AR: ครูวิชาการ/ผอ. จัดการบทเรียนทั้งหมดได้ ครูทั่วไปจัดการได้เฉพาะของตนเอง</li>
                </ul>
              </div>

              <div className="relative pl-6 border-l border-slate-200 pb-2">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">v1.1.9</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(16 มิ.ย. 2569)</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-500 mt-1 space-y-1">
                  <li>ปรับปรุงสิทธิ์หน้าจอเมนูควบคุม AR Algorithm ให้รองรับการเข้าถึงของคุณครูทุกคน</li>
                  <li>แก้ไขระบบสแกนกล้องเว็บแคมในโหมด AR หากหาอุปกรณ์ไม่พบจะสลับมาใช้โหมดเมาส์/สัมผัสทันทีโดยไม่มีหน้าต่างแจ้งเตือน Error ขวางกั้น</li>
                </ul>
              </div>

              <div className="relative pl-6 border-l border-slate-200 pb-2">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">v1.1.7 - v1.1.8</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(15-16 มิ.ย. 2569)</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-500 mt-1 space-y-1">
                  <li>พัฒนาระบบบอร์ดด่านการเรียนรู้ AR Algorithm "น้องชบาพาพิชิต" รูปแบบใหม่</li>
                  <li>เชื่อมต่อโครงสร้างระบบฐานข้อมูลตาราง <code>ar_lessons</code> และ <code>ar_steps</code> ออนไลน์บน Supabase</li>
                  <li>เพิ่มฟังก์ชันน้องชบาช่วยประมวลผลคิดออกแบบด่าน AR ผ่านทาง Gemini AI</li>
                </ul>
              </div>

              <div className="relative pl-6 border-l border-slate-200 pb-2">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">v1.1.6</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(9 มิ.ย. 2569)</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-500 mt-1 space-y-1">
                  <li>ปรับปรุงระบบตราประทับ ผอ. ในการเกษียณสั่งการ ให้ดึงข้อมูลชื่อโรงเรียนจากหน้าตั้งค่าโดยอัตโนมัติ (Dynamic School Name on Stamping)</li>
                  <li>แยกการแสดงผลและข้อมูลอย่างเป็นอิสระ 100% สำหรับการใช้งานระบบ Multi-School ของแต่ละสถานศึกษา</li>
                  <li>เผยแพร่และอัปโหลดไฟล์ตัวติดตั้งเดสก์ท็อป (Windows Setup) v1.1.6 ขึ้นสู่ GitHub Releases</li>
                </ul>
              </div>

              <div className="relative pl-6 border-l border-slate-200 pb-2">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">v1.1.5</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(8 มิ.ย. 2569)</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-500 mt-1 space-y-1">
                  <li>แก้ไขปัญหาตำแหน่งผู้อำนวยการโรงเรียนในตราประทับเกษียณ ผอ. ของโรงเรียนที่ 2 ไม่ให้มีชื่อโรงเรียนแรกปะปน</li>
                  <li>เพิ่มระบบการส่งไฟล์ที่สแตมป์เกษียณผ่าน LINE ไปจัดเก็บถาวรใน Google Drive ประจำแต่ละโรงเรียนโดยอัตโนมัติ</li>
                  <li>ติดตั้งเครื่องมือโอนย้ายไฟล์ประวัติเอกสารย้อนหลังที่เกษียณผ่าน LINE เข้าสู่ Google Drive ในหน้าตั้งค่า</li>
                  <li>เพิ่มคอลัมน์เลือกพิมพ์รายชื่อนักเรียนแบบกำหนดเอง ได้แก่ ชื่อบิดา, ชื่อมารดา, ศาสนา และสถานะความด้อยโอกาส</li>
                  <li>แก้ไขบั๊กการนำเข้าข้อมูลนักเรียน (Import Excel) ให้คำนำหน้าและชื่อจริงของผู้ปกครอง บิดา มารดา รวมกันได้อย่างถูกต้อง</li>
                  <li>เผยแพร่และอัปโหลดไฟล์ตัวติดตั้งเดสก์ท็อป (Windows Setup) v1.1.5 ขึ้นสู่ GitHub Releases</li>
                </ul>
              </div>

              <div className="relative pl-6 border-l border-slate-200 pb-2">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">v1.1.4</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(28-29 พ.ค. 2569)</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-500 mt-1 space-y-1">
                  <li>ปรับปรุงระบบสิทธิ์ของครู (Teacher) แยกสิทธิ์พื้นฐานและสิทธิ์พิเศษ</li>
                  <li>เพิ่มสิทธิ์พิเศษตัวใหม่สำหรับงานวิชาการ (`access_academic`) และงานงบประมาณ (`access_finance`)</li>
                  <li>ติดตั้งระบบ Double-Gate Verification ดีดผู้ใช้กลับหน้าแดชบอร์ดอัตโนมัติหากไม่มีสิทธิ์</li>
                  <li>เพิ่มการส่งกลุ่ม "งานรอสั่งการ" ของ ผอ. และการโต้ตอบของบอท LINE ด้วยรูปแบบ Flex Message Carousel</li>
                  <li>เผยแพร่และอัปโหลดไฟล์ตัวติดตั้งเดสก์ท็อป (Windows Setup) v1.1.4 ขึ้นสู่ GitHub Releases</li>
                </ul>
              </div>

              <div className="relative pl-6 border-l border-slate-200 pb-2">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">v1.1.3</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(27 พ.ค. 2569)</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-500 mt-1 space-y-1">
                  <li>ปรับปรุงการโหลดฟอนต์ไทย `THSarabunNew.ttf` ใน Vercel Serverless Function</li>
                  <li>เพิ่มระบบล้างแคชภาพ (Cache-Busting) สำหรับไฟล์ PDF หลัง ผอ. ประทับตราเกษียณเพื่อป้องกันการแสดงไฟล์เก่า</li>
                  <li>ปรับโครงสร้างการตั้งชื่อตัวติดตั้งเดสก์ท็อปให้เสถียรกับการอัปโหลดขึ้น GitHub Releases</li>
                </ul>
              </div>

              <div className="relative pl-6 border-l border-slate-200 pb-2">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">v1.1.2</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(27 พ.ค. 2569)</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-500 mt-1 space-y-1">
                  <li>ปรับปรุงระบบกรองปีการศึกษา (Year System Filter) และรีเซ็ตเลขที่เอกสารอัตโนมัติประจำปี พ.ศ.</li>
                  <li>พัฒนา LINE Interactive Webhook และการเก็บสถานะสนทนาแบบขั้นตอน (Multi-step Chatbot) ด้วยตาราง `line_action_states`</li>
                </ul>
              </div>

              <div className="relative pl-6 border-l border-slate-200 pb-2">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">v1.1.1</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(26 พ.ค. 2569)</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-500 mt-1 space-y-1">
                  <li>ปรับแต่งการสกัดคำค้นหา RAG คลังเอกสารใน LINE Webhook และแก้ไขบั๊ก TypeScript Compile</li>
                </ul>
              </div>

              <div className="relative pl-6 border-l border-slate-200 pb-2">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">v1.1.0</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(24 พ.ค. 2569)</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-500 mt-1 space-y-1">
                  <li>ปรับปรุงเลย์เอาต์รายงาน LEC-2 ให้แสดงผล 25 รายชื่อต่อหน้า และแสดงช่องลงลายมือชื่อที่ส่วนท้ายในทุกหน้ากระดาษ</li>
                  <li>แก้ไขปัญหาฟอนต์ TH Sarabun New ในโหมดจัดพิมพ์รายงานให้กลับมาคมชัดสวยงาม ไม่หนาเข้มและไม่ล้นกรอบตาราง</li>
                </ul>
              </div>

              <div className="relative pl-6 border-l border-slate-200 pb-2">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">v1.0.9</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(24 พ.ค. 2569)</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-400 mt-1 space-y-1">
                  <li>แก้ไขตัวหนังสือ/ตัวเข้ม ในรายงานสรุปและรายชื่อผู้ปกครองระบบเงินเรียนฟรี (15 ปี) และรายงาน LEC</li>
                  <li>แยกความแตกต่างฟอนต์สำหรับงานพิมพ์เอกสารออกเป็น TH Sarabun New Print ป้องกันความสับสนน้ำหนักฟอนต์</li>
                </ul>
              </div>

              <div className="relative pl-6 border-l border-slate-200 pb-2">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">v1.0.8</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(24 พ.ค. 2569)</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-500 mt-1 space-y-1">
                  <li>เปลี่ยนระบบ GAS_URL และ LINE_TOKEN ให้รองรับ Environment Variables</li>
                  <li>แก้ไขประเภทข้อมูลประวัติและข้อมูลส่วนตัวผู้เสนอเอกสารส่งออนไลน์</li>
                </ul>
              </div>

              <div className="relative pl-6 border-l border-slate-200 pb-2">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">v1.0.7</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(23 พ.ค. 2569)</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-500 mt-1 space-y-1">
                  <li>ระบบสกัดโครงการพัสดุอัจฉริยะ (AI Project Extraction)</li>
                  <li>เชื่อมโยงข้อมูลโครงการและแผนงบประมาณ (Budget Linkage)</li>
                  <li>ระบบแนะนำร้านค้าจัดซื้อจากประวัติในระบบ (Smart Vendor Suggestion)</li>
                  <li>ระบบ Multimodal OCR สแกนบิลและวิเคราะห์เอกสารใบเสร็จด้วย AI</li>
                </ul>
              </div>

              <div className="relative pl-6 border-l border-slate-200">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-300"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">v1.0.6</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(19 พ.ค. 2569)</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-500 mt-1 space-y-1">
                  <li>ปรับปรุงการแสดงผลและข้อมูลรายงานเรียนฟรี LEC-1 และ LEC-2</li>
                  <li>พัฒนาระบบถัวจ่ายงบประมาณแยกโครงการ (Budget Share)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
