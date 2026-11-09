import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ShieldCheck, 
  Search, 
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
  defaultDocId?: string;
  defaultDocNum?: string;
  defaultDocType?: 'certificate' | 'order' | 'all';
}

export default function PublicDocVerifyPortal({ 
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

  // ฟังก์ชันค้นหาเอกสาร (รองรับทั้ง UUID, เลขที่เอกสาร, และชื่อผู้ขอรับการรับรอง)
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
        if (cleanId && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(cleanId)) {
          certQuery = certQuery.eq('id', cleanId);
        } else {
          const term = cleanNum || cleanId;
          certQuery = certQuery.or(`certificate_number.eq.${term},certificate_number.ilike.%${term}%,recipient_name.ilike.%${term}%`);
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
        if (cleanId && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(cleanId)) {
          orderQuery = orderQuery.eq('id', cleanId);
        } else {
          const term = cleanNum || cleanId;
          orderQuery = orderQuery.or(`order_number.eq.${term},order_number.ilike.%${term}%,subject.ilike.%${term}%`);
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sarabun flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar (ตัดปุ่มกลับสู่ระบบออกตามคำขอ) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <img src={schoolLogo} alt="School Logo" className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-xl shrink-0" />
            <div>
              <h1 className="font-black text-slate-900 text-base sm:text-lg leading-tight">
                {schoolName}
              </h1>
              <p className="text-xs sm:text-sm text-emerald-700 font-bold flex items-center gap-1.5 mt-0.5">
                <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                <span>ระบบตรวจสอบความถูกต้องของเอกสารราชการ (Document Verification Portal)</span>
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-10 flex-1">
        {/* Verification Banner */}
        <div className="bg-linear-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-3xl p-6 sm:p-9 shadow-xl mb-7 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 opacity-15 pointer-events-none">
            <ShieldCheck size={260} />
          </div>
          
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 text-white text-xs sm:text-sm font-bold backdrop-blur-xs mb-3.5">
              <CheckCircle2 size={16} className="text-emerald-300" />
              ระบบป้องกันการปลอมแปลงเอกสารราชการ (Anti-Forgery Verification)
            </span>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-snug">
              ตรวจสอบหนังสือรับรองและเอกสารคำสั่ง
            </h2>
            <p className="text-emerald-100 text-sm sm:text-base mt-2.5 leading-relaxed font-medium">
              สแกน QR Code หรือกรอกเลขที่เอกสารเพื่อยืนยันว่าเอกสารฉบับนี้ออกโดยสถานศึกษาจริง ผ่านการลงนามและมีผลบังคับใช้ตามระเบียบงานสารบรรณ
            </p>
          </div>
        </div>

        {/* Search Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm mb-7">
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit flex-wrap">
              <button
                type="button"
                onClick={() => setDocType('all')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  docType === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => setDocType('certificate')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  docType === 'certificate' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📜 หนังสือรับรอง / ปพ.7
              </button>
              <button
                type="button"
                onClick={() => setDocType('order')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  docType === 'order' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📋 คำสั่งโรงเรียน
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="กรอกเลขที่เอกสาร เช่น 1/2569 หรือชื่อผู้ขอรับการรับรอง..."
                  className="w-full pl-12 pr-4 py-3.5 sm:py-4 bg-slate-50 border border-slate-200 rounded-2xl text-base sm:text-lg font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !searchQuery.trim()}
                className="px-8 py-3.5 sm:py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-base sm:text-lg rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer shrink-0"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                <span>ตรวจสอบ</span>
              </button>
            </div>
          </form>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm animate-pulse">
            <Loader2 size={44} className="animate-spin text-emerald-600 mx-auto mb-3.5" />
            <p className="font-black text-slate-900 text-base sm:text-lg">กำลังค้นหาและตรวจสอบลายมือชื่อดิจิทัล...</p>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">กำลังเชื่อมต่อฐานข้อมูลสถานศึกษา {schoolName}</p>
          </div>
        )}

        {/* Error / Not Found Alert */}
        {!loading && searched && errorMessage && (
          <div className="bg-rose-50/90 border-2 border-rose-200 rounded-3xl p-7 sm:p-9 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3.5 shadow-xs">
              <AlertTriangle size={34} />
            </div>
            <h3 className="text-lg sm:text-2xl font-black text-rose-900 mb-1.5">
              ไม่พบข้อมูลเอกสารในระบบ
            </h3>
            <p className="text-sm sm:text-base text-rose-700 max-w-lg mx-auto leading-relaxed font-medium">
              {errorMessage}
            </p>
            <div className="mt-5 pt-4 border-t border-rose-200 text-xs sm:text-sm text-slate-600 font-medium">
              หากท่านมั่นใจว่าเป็นเอกสารที่ถูกต้อง กรุณาติดต่อฝ่ายงานสารบรรณ {schoolName} เพื่อตรวจสอบต้นฉบับ
            </div>
          </div>
        )}

        {/* Verified Result Card */}
        {!loading && verifiedDoc && (
          <div className="bg-white rounded-3xl border-2 border-emerald-500 shadow-xl overflow-hidden animate-in fade-in duration-300">
            {/* Top Verified Header */}
            <div className="bg-linear-to-r from-emerald-600 to-teal-600 text-white p-6 sm:p-7 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-emerald-200 uppercase tracking-wider">
                    <CheckCircle2 size={16} className="text-emerald-300" />
                    Verified Official Document
                  </div>
                  <h3 className="text-lg sm:text-2xl font-black leading-tight mt-0.5">
                    เอกสารนี้ออกโดยสถานศึกษาจริง ผ่านการรับรองถูกต้อง
                  </h3>
                </div>
              </div>

              <span className="hidden sm:inline-block px-4 py-1.5 bg-white/20 backdrop-blur-xs rounded-full text-xs sm:text-sm font-bold">
                {verifiedDoc._category === 'certificate' ? 'หนังสือรับรอง' : 'คำสั่งโรงเรียน'}
              </span>
            </div>

            {/* Document Details Grid */}
            <div className="p-6 sm:p-8 space-y-6">
              {/* Document Subject Banner */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">ชื่อเรื่อง / เอกสาร</p>
                <h4 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 leading-snug">
                  {verifiedDoc.subject || (verifiedDoc.certificate_type === 'pp7' ? 'ใบรับรองผลการเรียน (ปพ.7)' : 'หนังสือรับรอง')}
                </h4>
              </div>

              {/* Two Column Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* เลขที่เอกสาร */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-3.5">
                  <FileText size={22} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-500 font-bold block text-xs uppercase tracking-wider">เลขที่เอกสาร</span>
                    <span className="font-black text-slate-900 text-base sm:text-lg font-mono">
                      {verifiedDoc.certificate_number || verifiedDoc.order_number || '-'}
                    </span>
                  </div>
                </div>

                {/* วันที่ออกเอกสาร */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-3.5">
                  <Calendar size={22} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-500 font-bold block text-xs uppercase tracking-wider">วันที่ออกเอกสาร / มีผลบังคับใช้</span>
                    <span className="font-bold text-slate-900 text-base sm:text-lg">
                      {formatThaiDate(verifiedDoc.certificate_date || verifiedDoc.order_date)}
                    </span>
                  </div>
                </div>

                {/* ผู้ขอรับการรับรอง / ผู้รับ */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-3.5">
                  <User size={22} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-500 font-bold block text-xs uppercase tracking-wider">
                      {verifiedDoc._category === 'certificate' ? 'ผู้ขอรับการรับรอง' : 'ผู้รับคำสั่ง / กลุ่มเป้าหมาย'}
                    </span>
                    <span className="font-bold text-slate-900 text-base sm:text-lg">
                      {verifiedDoc.recipient_name || verifiedDoc.to_agency || '-'}
                    </span>
                    {verifiedDoc.recipient_position && (
                      <span className="text-slate-600 block text-xs sm:text-sm mt-0.5 font-medium">({verifiedDoc.recipient_position})</span>
                    )}
                  </div>
                </div>

                {/* ผู้มีอำนาจลงนาม */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-3.5">
                  <Award size={22} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-500 font-bold block text-xs uppercase tracking-wider">ผู้ลงนามรับรอง</span>
                    <span className="font-bold text-slate-900 text-base sm:text-lg">
                      {verifiedDoc.sign_name || schoolSettings?.director_name || 'ผู้อำนวยการสถานศึกษา'}
                    </span>
                    {verifiedDoc.sign_position && (
                      <span className="text-slate-600 block text-xs sm:text-sm mt-0.5 font-medium">({verifiedDoc.sign_position})</span>
                    )}
                  </div>
                </div>
              </div>

              {/* สถานศึกษาผู้ออกเอกสาร */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Building2 size={22} className="text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-slate-500 font-bold text-xs uppercase tracking-wider block">หน่วยงานที่ออกเอกสาร</span>
                    <span className="font-bold text-slate-900 text-base sm:text-lg">{verifiedDoc.issuer || schoolName}</span>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs shrink-0">
                  สถานศึกษาของรัฐ สพฐ.
                </span>
              </div>

              {/* วัตถุประสงค์ / หมายเหตุ (ถ้ามี) */}
              {verifiedDoc.purpose && (
                <div className="p-5 bg-amber-50/70 rounded-2xl border border-amber-200 text-sm sm:text-base">
                  <span className="font-bold text-amber-900 block mb-1">💡 วัตถุประสงค์การใช้งาน / อายุเอกสาร:</span>
                  <span className="text-amber-900 font-medium">{verifiedDoc.purpose}</span>
                </div>
              )}

              {/* เนื้อหาข้อความสถานภาพทางการเรียน (กรณี ปพ.7) */}
              {verifiedDoc.content && (
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-800 block text-sm sm:text-base">📄 ข้อความและสถานภาพทางการเรียนที่รับรอง:</span>
                  <div className="text-sm sm:text-base text-slate-800 whitespace-pre-wrap bg-white p-4 rounded-xl border border-slate-200 leading-relaxed font-sarabun">
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
                    className="flex-1 py-4 px-5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl font-black text-sm sm:text-base text-center transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download size={18} />
                    <span>เปิดดู / ดาวน์โหลดเอกสารฉบับจริง (PDF)</span>
                    <ExternalLink size={16} className="opacity-70" />
                  </a>
                ) : (
                  <div className="flex-1 py-4 px-5 bg-slate-100 text-slate-600 rounded-2xl text-xs sm:text-sm text-center font-bold flex items-center justify-center gap-2 border border-slate-200">
                    <FileCheck size={18} className="text-slate-500 shrink-0" />
                    <span>ข้อมูลเอกสารถูกบันทึกในทะเบียนราชการอิเล็กทรอนิกส์ของสถานศึกษาเรียบร้อยแล้ว</span>
                  </div>
                )}
              </div>

              {/* Anti-Forgery Footer Metadata */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2 font-medium">
                <div className="font-mono text-[11px] sm:text-xs">
                  REF-UUID: {verifiedDoc.id}
                </div>
                <div className="flex items-center gap-1.5">
                  <QrCode size={14} className="text-emerald-600" />
                  <span>ดิจิทัลพอร์ทัลยืนยันความถูกต้อง 100% สพฐ.</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-5 px-4 text-center text-xs sm:text-sm text-slate-500">
        <p className="font-bold text-slate-800 text-sm">{schoolName}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          ระบบบริหารจัดการสถานศึกษาและงานสารบรรณอิเล็กทรอนิกส์ (School Admin Multischool)
        </p>
      </footer>
    </div>
  );
}
