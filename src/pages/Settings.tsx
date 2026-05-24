import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadToSupabase } from '../lib/storage';
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
              <p className="text-xs text-slate-500 font-bold mt-1">ระบบบริหารจัดการข้อมูลโรงเรียนบ้านควนโคกยา</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">เวอร์ชันปัจจุบัน:</span>
              <span className="px-4 py-1.5 bg-blue-100 text-blue-700 font-black rounded-full text-xs">
                {import.meta.env.VITE_APP_VERSION || '1.0.9'}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-black text-slate-800 text-sm border-l-4 border-brand-primary pl-3 uppercase tracking-tight">ประวัติการปรับปรุง (Changelog)</h4>
            <div className="space-y-3 pl-4">
              <div className="relative pl-6 border-l border-slate-200 pb-2">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-brand-primary"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">v1.0.9</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">(24 พ.ค. 2569)</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-500 mt-1 space-y-1">
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
