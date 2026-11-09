import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ShieldCheck, 
  Search, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Download, 
  Calendar, 
  Building2, 
  User, 
  Award, 
  Loader2,
  ExternalLink,
  QrCode,
  FileCheck
} from 'lucide-react';

interface Props {
  onBack?: () => void;
  defaultDocId?: string;
  defaultDocNum?: string;
  defaultDocType?: 'certificate' | 'order' | 'all';
}

export default function PublicDocVerifyPortal({ 
  onBack, 
  defaultDocId, 
  defaultDocNum,
  defaultDocType = 'all' 
}: Props) {
  const [docType, setDocType] = useState<'certificate' | 'order' | 'all'>(defaultDocType);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifiedDoc, setVerifiedDoc] = useState<any | null>(null);
  const [searched, setSearched] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // โหลดข้อมูลการตั้งค่าโรงเรียน (ชื่อโรงเรียน, โลโก้)
  useEffect(() => {
    async function loadSchoolSettings() {
      try {
        const { data } = await supabase
          .from('settings')
          .select('school_name, school_logo_url, director_name')
          .limit(1)
          .maybeSingle();
        if (data) setSchoolSettings(data);
      } catch (err) {
        console.warn('Error fetching school settings for verify portal:', err);
      }
    }
    loadSchoolSettings();
  }, []);

  // ดึงค่า Query Parameters จาก URL อัตโนมัติ (รองรับทั้ง search params และ hash)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let initialId = defaultDocId || '';
    let initialNum = defaultDocNum || '';
    let initialType: 'certificate' | 'order' | 'all' = defaultDocType;

    // 1. อ่านจาก Search Params (?portal=verify&type=...&id=...&num=...)
    const params = new URLSearchParams(window.location.search);
    if (params.get('id')) initialId = params.get('id')!;
    if (params.get('num')) initialNum = params.get('num')!;
    if (params.get('verify')) initialNum = params.get('verify')!;
    if (params.get('cert')) {
      initialNum = params.get('cert')!;
      initialType = 'certificate';
    }
    if (params.get('order')) {
      initialNum = params.get('order')!;
      initialType = 'order';
    }
    if (params.get('type') === 'certificate' || params.get('type') === 'order') {
      initialType = params.get('type') as any;
    }

    // 2. อ่านจาก Hash (#/certificates?verify=... หรือ #/orders?verify=...)
    if (window.location.hash) {
      const hashPart = window.location.hash.split('?')[1];
      if (hashPart) {
        const hashParams = new URLSearchParams(hashPart);
        if (hashParams.get('verify')) initialNum = hashParams.get('verify')!;
        if (hashParams.get('id')) initialId = hashParams.get('id')!;
        if (hashParams.get('order_number')) {
          initialNum = hashParams.get('order_number')!;
          initialType = 'order';
        }
        if (window.location.hash.includes('certificates')) initialType = 'certificate';
        if (window.location.hash.includes('orders')) initialType = 'order';
      }
    }

    if (initialType) setDocType(initialType);
    if (initialId || initialNum) {
      setSearchQuery(initialNum || initialId);
      performLookup(initialId, initialNum, initialType);
    }
  }, [defaultDocId, defaultDocNum, defaultDocType]);

  // ฟังก์ชันค้นหาเอกสาร
  const performLookup = async (id?: string, num?: string, type: 'certificate' | 'order' | 'all' = 'all') => {
    setLoading(true);
    setErrorMessage(null);
    setVerifiedDoc(null);
    setSearched(true);

    try {
      const cleanId = (id || '').trim();
      const cleanNum = (num || '').trim();

      // 1. ค้นหาในหมวด หนังสือรับรอง (Certificates)
      if (type === 'all' || type === 'certificate') {
        let certQuery = supabase.from('certificates').select('*');
        if (cleanId) {
          certQuery = certQuery.or(`id.eq.${cleanId},certificate_number.eq.${cleanNum || cleanId}`);
        } else if (cleanNum) {
          certQuery = certQuery.eq('certificate_number', cleanNum);
        }

        const { data: certData, error: certErr } = await certQuery.limit(1).maybeSingle();
        if (certData && !certErr) {
          setVerifiedDoc({ ...certData, _category: 'certificate' });
          setDocType('certificate');
          setLoading(false);
          return;
        }
      }

      // 2. ค้นหาในหมวด คำสั่งโรงเรียน (Orders)
      if (type === 'all' || type === 'order') {
        let orderQuery = supabase.from('orders').select('*');
        if (cleanId) {
          orderQuery = orderQuery.or(`id.eq.${cleanId},order_number.eq.${cleanNum || cleanId}`);
        } else if (cleanNum) {
          orderQuery = orderQuery.eq('order_number', cleanNum);
        }

        const { data: orderData, error: orderErr } = await orderQuery.limit(1).maybeSingle();
        if (orderData && !orderErr) {
          setVerifiedDoc({ ...orderData, _category: 'order' });
          setDocType('order');
          setLoading(false);
          return;
        }
      }

      // หากไม่พบเอกสาร
      setErrorMessage('ไม่พบข้อมูลเอกสารในระบบ หรือรหัสตรวจสอบไม่ถูกต้อง กรุณาตรวจสอบเลขที่เอกสารอีกครั้ง');
    } catch (err: any) {
      console.error('Document verification lookup failed:', err);
      setErrorMessage('เกิดข้อผิดพลาดในการเชื่อมต่อระบบตรวจสอบ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    performLookup('', searchQuery.trim(), docType);
  };

  const formatThaiDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];
      return `${d.getDate()} ${thaiMonths[d.getMonth()]} พ.ศ. ${d.getFullYear() + 543}`;
    } catch {
      return dateStr;
    }
  };

  const schoolName = schoolSettings?.school_name || import.meta.env.VITE_SCHOOL_NAME || 'โรงเรียนบ้านควนโคกยา';
  const schoolLogo = schoolSettings?.school_logo_url || import.meta.env.VITE_SCHOOL_LOGO_PATH || 'logo.png';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sarabun flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={schoolLogo} alt="School Logo" className="w-10 h-10 object-contain rounded-lg" />
            <div>
              <h1 className="font-bold text-slate-900 text-sm leading-tight flex items-center gap-1.5">
                {schoolName}
              </h1>
              <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <ShieldCheck size={13} className="text-emerald-600" />
                ระบบตรวจสอบความถูกต้องของเอกสารราชการ (Document Verification Portal)
              </p>
            </div>
          </div>

          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>กลับสู่ระบบ</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto w-full px-4 py-8 flex-1">
        {/* Verification Banner */}
        <div className="bg-linear-to-r from-emerald-600 to-teal-700 text-white rounded-3xl p-6 sm:p-8 shadow-xl mb-6 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 opacity-10 pointer-events-none">
            <ShieldCheck size={220} />
          </div>
          
          <div className="relative z-10 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold backdrop-blur-xs mb-3">
              <CheckCircle2 size={14} className="text-emerald-300" />
              ระบบป้องกันการปลอมแปลงเอกสารราชการ (Anti-Forgery Verification)
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-snug">
              ตรวจสอบหนังสือรับรองและเอกสารคำสั่ง
            </h2>
            <p className="text-emerald-100 text-xs sm:text-sm mt-1.5 leading-relaxed">
              สแกน QR Code หรือกรอกเลขที่เอกสารเพื่อยืนยันว่าเอกสารฉบับนี้ออกโดยสถานศึกษาจริง ผ่านการลงนามและมีผลบังคับใช้ตามระเบียบงานสารบรรณ
            </p>
          </div>
        </div>

        {/* Search Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm mb-6">
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
              <button
                type="button"
                onClick={() => setDocType('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  docType === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => setDocType('certificate')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  docType === 'certificate' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                📜 หนังสือรับรอง / ปพ.7
              </button>
              <button
                type="button"
                onClick={() => setDocType('order')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  docType === 'order' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                📋 คำสั่งโรงเรียน
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="กรอกเลขที่เอกสาร เช่น 1/2569 หรือรหัสตรวจสอบ UUID..."
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !searchQuery.trim()}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm rounded-2xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer shrink-0"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                <span>ตรวจสอบ</span>
              </button>
            </div>
          </form>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm animate-pulse">
            <Loader2 size={36} className="animate-spin text-emerald-600 mx-auto mb-3" />
            <p className="font-bold text-slate-800 text-sm">กำลังค้นหาและตรวจสอบลายมือชื่อดิจิทัล...</p>
            <p className="text-xs text-slate-400 mt-1">กำลังเชื่อมต่อฐานข้อมูลสถานศึกษา {schoolName}</p>
          </div>
        )}

        {/* Error / Not Found Alert */}
        {!loading && searched && errorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-center animate-in fade-in duration-300">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={28} />
            </div>
            <h3 className="text-base font-bold text-rose-900 mb-1">ไม่พบข้อมูลเอกสารในระบบ</h3>
            <p className="text-xs text-rose-700 max-w-md mx-auto leading-relaxed">
              {errorMessage}
            </p>
            <div className="mt-4 pt-4 border-t border-rose-200/60 text-[11px] text-slate-500">
              หากท่านมั่นใจว่าเป็นเอกสารที่ถูกต้อง กรุณาติดต่อฝ่ายงานสารบรรณ {schoolName} เพื่อตรวจสอบต้นฉบับ
            </div>
          </div>
        )}

        {/* Verified Result Card */}
        {!loading && verifiedDoc && (
          <div className="bg-white rounded-3xl border-2 border-emerald-500/80 shadow-xl overflow-hidden animate-in fade-in duration-300">
            {/* Top Verified Header */}
            <div className="bg-linear-to-r from-emerald-600 to-teal-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-200 uppercase tracking-wider">
                    <CheckCircle2 size={12} className="text-emerald-300" />
                    Verified Official Document
                  </div>
                  <h3 className="text-base sm:text-lg font-black leading-tight">
                    เอกสารนี้ออกโดยสถานศึกษาจริง ผ่านการรับรองถูกต้อง
                  </h3>
                </div>
              </div>

              <span className="hidden sm:inline-block px-3 py-1 bg-white/20 backdrop-blur-xs rounded-full text-xs font-bold">
                {verifiedDoc._category === 'certificate' ? 'หนังสือรับรอง' : 'คำสั่งโรงเรียน'}
              </span>
            </div>

            {/* Document Details Grid */}
            <div className="p-6 sm:p-8 space-y-6">
              {/* Document Subject Banner */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ชื่อเรื่อง / เอกสาร</p>
                <h4 className="text-lg font-black text-slate-900 mt-0.5">
                  {verifiedDoc.subject || (verifiedDoc.certificate_type === 'pp7' ? 'ใบรับรองผลการเรียน (ปพ.7)' : 'หนังสือรับรอง')}
                </h4>
              </div>

              {/* Two Column Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* เลขที่เอกสาร */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                  <FileText size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">เลขที่เอกสาร</span>
                    <span className="font-bold text-slate-900 text-sm font-mono">
                      {verifiedDoc.certificate_number || verifiedDoc.order_number || '-'}
                    </span>
                  </div>
                </div>

                {/* วันที่ออกเอกสาร */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                  <Calendar size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">วันที่ออกเอกสาร / มีผลบังคับใช้</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {formatThaiDate(verifiedDoc.certificate_date || verifiedDoc.order_date)}
                    </span>
                  </div>
                </div>

                {/* ผู้ขอรับการรับรอง / ผู้รับ */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                  <User size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">
                      {verifiedDoc._category === 'certificate' ? 'ผู้ขอรับการรับรอง' : 'ผู้รับคำสั่ง / กลุ่มเป้าหมาย'}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {verifiedDoc.recipient_name || verifiedDoc.to_agency || '-'}
                    </span>
                    {verifiedDoc.recipient_position && (
                      <span className="text-slate-500 block text-[11px] mt-0.5">({verifiedDoc.recipient_position})</span>
                    )}
                  </div>
                </div>

                {/* ผู้มีอำนาจลงนาม */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                  <Award size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">ผู้ลงนามรับรอง</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {verifiedDoc.sign_name || schoolSettings?.director_name || 'ผู้อำนวยการสถานศึกษา'}
                    </span>
                    {verifiedDoc.sign_position && (
                      <span className="text-slate-500 block text-[11px] mt-0.5">({verifiedDoc.sign_position})</span>
                    )}
                  </div>
                </div>
              </div>

              {/* สถานศึกษาผู้ออกเอกสาร */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <Building2 size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-slate-400 font-bold text-[10px] uppercase block">หน่วยงานที่ออกเอกสาร</span>
                    <span className="font-bold text-slate-900">{verifiedDoc.issuer || schoolName}</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                  สถานศึกษาของรัฐ สพฐ.
                </span>
              </div>

              {/* วัตถุประสงค์ / หมายเหตุ (ถ้ามี) */}
              {verifiedDoc.purpose && (
                <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/60 text-xs">
                  <span className="font-bold text-amber-900 block mb-0.5">💡 วัตถุประสงค์การใช้งาน / อายุเอกสาร:</span>
                  <span className="text-amber-800">{verifiedDoc.purpose}</span>
                </div>
              )}

              {/* เนื้อหาข้อความสถานภาพทางการเรียน (กรณี ปพ.7) */}
              {verifiedDoc.content && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-1.5">
                  <span className="font-bold text-slate-700 block">📄 ข้อความและสถานภาพทางการเรียนที่รับรอง:</span>
                  <div className="font-mono text-[11px] text-slate-800 whitespace-pre-wrap bg-white p-3 rounded-xl border border-slate-200">
                    {verifiedDoc.content}
                  </div>
                </div>
              )}

              {/* Action Buttons: ดาวน์โหลดไฟล์ต้นฉบับจริง */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                {verifiedDoc.file_url ? (
                  <a
                    href={verifiedDoc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl font-bold text-xs sm:text-sm text-center transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download size={16} />
                    <span>เปิดดู / ดาวน์โหลดเอกสารฉบับจริง (PDF)</span>
                    <ExternalLink size={14} className="opacity-70" />
                  </a>
                ) : (
                  <div className="flex-1 py-3 px-4 bg-slate-100 text-slate-500 rounded-2xl text-xs text-center font-medium flex items-center justify-center gap-2">
                    <FileCheck size={16} className="text-slate-400" />
                    <span>ข้อมูลเอกสารถูกบันทึกในทะเบียนราชการอิเล็กทรอนิกส์ของสถานศึกษาเรียบร้อยแล้ว</span>
                  </div>
                )}
              </div>

              {/* Anti-Forgery Footer Metadata */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-slate-400 gap-2">
                <div className="font-mono">
                  REF-UUID: {verifiedDoc.id}
                </div>
                <div className="flex items-center gap-1.5">
                  <QrCode size={12} className="text-emerald-600" />
                  <span>ดิจิทัลพอร์ทัลยืนยันความถูกต้อง 100% สพฐ.</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-500">
        <p className="font-bold text-slate-700">{schoolName}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          ระบบบริหารจัดการสถานศึกษาและงานสารบรรณอิเล็กทรอนิกส์ (School Admin Multischool)
        </p>
      </footer>
    </div>
  );
}
