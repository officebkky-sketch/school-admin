import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  FileText, 
  Printer, 
  Users, 
  RefreshCcw,
  CalendarDays,
  AlertCircle,
  Save,
  Loader2
} from 'lucide-react';

export default function LECReports() {
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [config, setConfig] = useState({
    academicYear: '2568',
    term: '1',
    teacherName: '',
    teacherPhone: '',
    directorName: '',
    reportDate: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
    localGovName: '',
  });

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      // 1. Fetch available years
      const { data: yearData } = await supabase.from('students').select('academic_year');
      if (yearData) {
        const years = Array.from(new Set(yearData.map(d => d.academic_year))).sort((a, b) => b.localeCompare(a));
        setAvailableYears(years);
        if (years.length > 0) setConfig(prev => ({ ...prev, academicYear: years[0] }));
      }

      // 2. Fetch settings
      const { data: sets } = await supabase.from('settings').select('*').single();
      if (sets) {
        setConfig(prev => ({
          ...prev,
          directorName: sets.director_name || prev.directorName,
          localGovName: sets.local_gov_name || prev.localGovName,
          teacherName: sets.teacher_name || prev.teacherName,
          teacherPhone: sets.phone_number || prev.teacherPhone
        }));
      }
    } catch (err) {
      console.error('Error fetching initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const { data: existing } = await supabase.from('settings').select('id').maybeSingle();
      const payload = {
        director_name: config.directorName,
        local_gov_name: config.localGovName,
        phone_number: config.teacherPhone
      };

      const { error } = existing 
        ? await supabase.from('settings').update(payload).eq('id', existing.id)
        : await supabase.from('settings').insert([payload]);

      if (error) throw error;
      alert('บันทึกรายชื่อผู้ลงนามและหน่วยงานแล้ว');
    } catch (err: any) {
      alert('ไม่สามารถบันทึกได้: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchStudentData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('academic_year', config.academicYear)
      .or('graduation_status.ilike.%กำลังศึกษา%,graduation_status.eq.ปกติ');
    
    if (error) {
      console.error(error);
    } else {
      setStudents(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchStudentData();
  }, [config.academicYear]);

  // Robust gender check for Thai DMC data
  const checkIsMale = (s: any) => {
    const prefix = (s.prefix || '').trim();
    const gender = (s.gender || '').trim();
    return (
      gender === 'ชาย' || 
      gender === 'ช' || 
      prefix.includes('ด.ช.') || 
      prefix.includes('เด็กชาย') || 
      prefix.includes('นาย')
    );
  };

  const printLEC1 = () => {
    const stats: Record<string, { male: number, female: number }> = {};
    const levels = ['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'];
    levels.forEach(l => stats[l] = { male: 0, female: 0 });

    students.forEach(s => {
      const level = s.class_level;
      if (stats[level]) {
        if (checkIsMale(s)) stats[level].male++;
        else stats[level].female++;
      }
    });

    let totalMale = 0, totalFemale = 0;
    const tableRows = levels.map(l => {
      totalMale += stats[l].male;
      totalFemale += stats[l].female;
      return `<tr><td style="text-align:left; padding-left: 20px;">ชั้น ${l}</td><td>${stats[l].male}</td><td>${stats[l].female}</td><td>${stats[l].male + stats[l].female}</td></tr>`;
    }).join('');

    const html = `
      <html>
        <head>
          <title>แบบ LEC-1 ปี ${config.academicYear}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
            body { font-family: 'Sarabun', sans-serif; padding: 1.5cm; font-size: 14pt; }
            .header { text-align: center; line-height: 1.2; margin-bottom: 0.5cm; }
            .lec-code { text-align: right; font-weight: bold; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid black; padding: 6px; text-align: center; }
            th { background: #eeeeee; }
            .footer { margin-top: 2cm; display: flex; justify-content: space-between; }
            .sign-box { text-align: center; width: 45%; }
            .no-print-btn { 
              position: fixed; top: 20px; right: 20px; 
              background: #16a34a; color: white; border: none; 
              padding: 12px 24px; border-radius: 12px; cursor: pointer;
              font-weight: bold; font-family: 'Sarabun', sans-serif;
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
              z-index: 9999;
            }
            @media print { .no-print-btn { display: none; } }
          </style>
        </head>
        <body>
          <button class="no-print-btn" onclick="window.print()">🖨️ คลิกที่นี่เพื่อสั่งพิมพ์</button>
          <div class="lec-code">(แบบ LEC - 1)</div>
          <div class="header">
            <h3 style="margin:0;">แบบบัญชีสรุปข้อมูลจำนวนนักเรียนของสถานศึกษาสังกัดหน่วยงานอื่น</h3>
            <p style="margin:5px 0; font-size: 11pt;">เพื่อใช้ในการตรวจสอบและพิจารณาจัดสรรงบประมาณอุดหนุนด้านการศึกษาขององค์กรปกครองส่วนท้องถิ่น</p>
            <p style="margin:5px 0; font-size: 11pt;">ประจำปีการศึกษา ${config.academicYear} (ครั้งที่ ${config.term})</p>
            <p style="margin:5px 0; font-size: 11pt;">โรงเรียนบ้านควนโคกยา สังกัด สำนักงานเขตพื้นที่การศึกษาประถมศึกษาพัทลุง เขต ๒</p>
            <p style="margin:5px 0; font-size: 11pt;">เพื่อจัดส่งให้ ${config.localGovName || '................................................'}</p>
          </div>
          <table>
            <thead>
              <tr><th rowspan="2" style="width:40%;">ระดับชั้น</th><th colspan="3">จำนวนนักเรียน (คน)</th></tr>
              <tr><th style="width:20%;">ชาย</th><th style="width:20%;">หญิง</th><th style="width:20%;">รวม</th></tr>
            </thead>
            <tbody>
              ${tableRows}
              <tr style="font-weight:bold; background:#f9f9f9;"><td>รวมทั้งสิ้น</td><td>${totalMale}</td><td>${totalFemale}</td><td>${totalMale + totalFemale}</td></tr>
            </tbody>
          </table>
          <div class="footer">
            <div class="sign-box">
              <p>(ลงชื่อ)......................................................ผู้ให้ข้อมูล</p>
              <p>(${config.teacherName || '................................................'})</p>
              <p>ตำแหน่ง ครู</p>
              <p>วันที่ ${config.reportDate}</p>
              <p>เบอร์โทรศัพท์: ${config.teacherPhone || '...........................'}</p>
            </div>
            <div class="sign-box">
              <p>(ลงชื่อ)......................................................ผู้รับรองข้อมูล</p>
              <p>(${config.directorName || '................................................'})</p>
              <p>ผู้อำนวยการสถานศึกษา</p>
              <p>วันที่ ${config.reportDate}</p>
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(() => { window.print(); }, 800);
            }
          </script>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
  };

  const printLEC2 = () => {
    // Sort students by level and ID
    const sorted = [...students].sort((a, b) => {
      const levelA = a.class_level || '';
      const levelB = b.class_level || '';
      if (levelA !== levelB) return levelA.localeCompare(levelB);
      return (a.student_id || '').localeCompare(b.student_id || '');
    });

    // Split into chunks of 25
    const pageSize = 25;
    const pages = [];
    for (let i = 0; i < sorted.length; i += pageSize) {
      pages.push(sorted.slice(i, i + pageSize));
    }

    const htmlPages = pages.map((pageDocs, pageIdx) => {
      const tableRows = pageDocs.map((s, i) => `
        <tr>
          <td style="width:5%;">${(pageIdx * pageSize) + i + 1}</td>
          <td style="width:15%;">${s.student_id || '-'}</td>
          <td style="text-align:left; width:35%; padding-left: 10px;">${s.prefix || ''}${s.first_name} ${s.last_name}</td>
          <td style="width:20%;">${s.national_id || '-'}</td>
          <td style="width:15%;">${s.class_level || '-'}/${s.room || '-'}</td>
        </tr>
      `).join('');

      // Add empty rows to maintain table height if it's the last page and has few records
      const emptyRowsCount = pageSize - pageDocs.length;
      const emptyRows = Array(emptyRowsCount).fill(0).map(() => `
        <tr><td style="height: 32px;">&nbsp;</td><td></td><td></td><td></td><td></td></tr>
      `).join('');

      return `
        <div class="page">
          <div class="lec-code">(แบบ LEC - 2)</div>
          <div class="header">
            <h3 style="margin:0;">แบบรับรองรายชื่อนักเรียนของสถานศึกษาสังกัดหน่วยงานอื่น</h3>
            <p style="margin:5px 0; font-size: 11pt;">เพื่อใช้ในการตรวจสอบและพิจารณาจัดสรรงบประมาณอุดหนุนด้านการศึกษาขององค์กรปกครองส่วนท้องถิ่น</p>
            <p style="margin:5px 0; font-size: 11pt;">ประจำปีการศึกษา ${config.academicYear} (ครั้งที่ ${config.term})</p>
            <p style="margin:5px 0; font-size: 11pt;">โรงเรียนบ้านควนโคกยา สังกัด สำนักงานเขตพื้นที่การศึกษาประถมศึกษาพัทลุง เขต ๒</p>
            <p style="margin:5px 0; font-size: 11pt;">เพื่อจัดส่งให้ ${config.localGovName || '................................................'}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>ลำดับ</th>
                <th>เลขประจำตัว</th>
                <th>คำนำหน้าชื่อ ชื่อ - สกุล</th>
                <th>เลขประชาชน</th>
                <th>ระดับชั้น</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
              ${emptyRows}
            </tbody>
          </table>
          <div class="footer-sign">
            <div class="sign-box">
              <p>(ลงชื่อ)......................................................ผู้ให้ข้อมูล</p>
              <p>(${config.teacherName || '................................................'})</p>
              <p>ตำแหน่ง ครู</p>
              <p>วันที่ ${config.reportDate}</p>
              <p>เบอร์โทรศัพท์: ${config.teacherPhone || '...........................'}</p>
            </div>
            <div class="sign-box">
              <p>(ลงชื่อ)......................................................ผู้รับรองข้อมูล</p>
              <p>(${config.directorName || '................................................'})</p>
              <p>ผู้อำนวยการสถานศึกษา</p>
              <p>วันที่ ${config.reportDate}</p>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <html>
        <head>
          <title>แบบ LEC-2 ปี ${config.academicYear}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
            body { font-family: 'Sarabun', sans-serif; margin: 0; padding: 0; background: #f0f0f0; }
            .page { 
              background: white; 
              width: 210mm; 
              min-height: 297mm; 
              padding: 1.5cm; 
              margin: 1cm auto; 
              box-sizing: border-box; 
              page-break-after: always;
              position: relative;
            }
            .lec-code { text-align: right; font-weight: bold; font-size: 14pt; margin-bottom: 5px; }
            .header { text-align: center; line-height: 1.1; margin-bottom: 20px; font-size: 13pt; }
            table { width: 100%; border-collapse: collapse; font-size: 12pt; }
            th, td { border: 1px solid black; padding: 4px; text-align: center; }
            th { background: #f5f5f5; font-weight: bold; }
            .footer-sign { margin-top: 25px; display: flex; justify-content: space-between; font-size: 13pt; }
            .sign-box { text-align: center; width: 48%; line-height: 1.3; }
            .no-print-btn { 
              position: fixed; top: 20px; right: 20px; 
              background: #2563eb; color: white; border: none; 
              padding: 12px 24px; border-radius: 12px; cursor: pointer;
              font-weight: bold; font-family: 'Sarabun', sans-serif;
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
              z-index: 9999;
            }
            @media print { 
              body { background: white; }
              .page { margin: 0; border: none; box-shadow: none; padding: 1.5cm; width: 100%; height: auto; }
              .no-print-btn { display: none; } 
            }
          </style>
        </head>
        <body>
          <button class="no-print-btn" onclick="window.print()">🖨️ คลิกที่นี่เพื่อสั่งพิมพ์</button>
          ${htmlPages}
          <script>
            window.onload = function() {
              setTimeout(() => { window.print(); }, 800);
            }
          </script>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="bg-brand-primary/10 p-4 rounded-3xl text-brand-primary shadow-sm"><FileText size={32} /></div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">ระบบรายงานสถิตินักเรียน (LEC)</h2>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">อ้างอิงสถานะ "กำลังศึกษา"</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={saveSettings}
              disabled={isSaving}
              className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 px-6 py-3 rounded-2xl text-indigo-600 font-bold text-xs transition-all active:scale-95 border border-indigo-100"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} บันทึกการตั้งค่า
            </button>
            <button 
              onClick={fetchStudentData}
              className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 px-6 py-3 rounded-2xl text-slate-600 font-bold text-xs transition-all active:scale-95"
            >
              <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} /> รีเฟรชข้อมูล
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
           <div className="space-y-8">
              <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest border-l-4 border-orange-400 pl-3">1. ตั้งค่าปีและเทอม</h4>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ปีการศึกษาที่พบ</label>
                  <div className="relative">
                    <CalendarDays className="absolute left-4 top-3.5 text-brand-primary" size={18} />
                    <select 
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-700 focus:ring-2 ring-brand-primary/20 outline-hidden"
                      value={config.academicYear}
                      onChange={e => setConfig({...config, academicYear: e.target.value})}
                    >
                      {availableYears.map(y => <option key={y} value={y}>ปี {y}</option>)}
                      {availableYears.length === 0 && <option value="2568">ปี 2568</option>}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ครั้งที่ (รอบรายงาน)</label>
                  <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-700 outline-hidden" value={config.term} onChange={e => setConfig({...config, term: e.target.value})}>
                    <option value="1">1 (มิถุนายน)</option>
                    <option value="2">2 (พฤศจิกายน)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">จัดส่งให้หน่วยงาน (อปท.)</label>
                  <input 
                    type="text" 
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 ring-brand-primary/20 outline-hidden" 
                    placeholder="เช่น อบต.เขาชัยสน..."
                    value={config.localGovName} 
                    onChange={e => setConfig({...config, localGovName: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">เบอร์โทรศัพท์ผู้ให้ข้อมูล</label>
                  <input 
                    type="text" 
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 ring-brand-primary/20 outline-hidden" 
                    placeholder="เช่น 081-XXX-XXXX"
                    value={config.teacherPhone} 
                    onChange={e => setConfig({...config, teacherPhone: e.target.value})} 
                  />
                </div>
              </div>
           </div>

           <div className="space-y-8">
              <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest border-l-4 border-blue-400 pl-3">2. ข้อมูลผู้ลงนามในเอกสาร</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ชื่อ-สกุล ครูผู้ให้ข้อมูล</label>
                  <input 
                    type="text" 
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-hidden focus:ring-2 ring-brand-primary/20" 
                    placeholder="ระบุชื่อ-นามสกุล ครู"
                    value={config.teacherName} 
                    onChange={e => setConfig({...config, teacherName: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ชื่อ-สกุล ผู้อำนวยการ</label>
                  <input 
                    type="text" 
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-hidden focus:ring-2 ring-brand-primary/20" 
                    placeholder="ระบุชื่อ-นามสกุล ผู้อำนวยการ"
                    value={config.directorName} 
                    onChange={e => setConfig({...config, directorName: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ลงวันที่รายงาน</label>
                  <input type="text" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-hidden" value={config.reportDate} onChange={e => setConfig({...config, reportDate: e.target.value})} />
                </div>
              </div>
           </div>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row gap-4 pt-10 border-t border-slate-100">
           <button 
             onClick={printLEC1}
             disabled={loading || students.length === 0}
             className="flex-1 bg-brand-primary text-white py-5 rounded-[24px] font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-green-100 hover:bg-green-700 hover:scale-[1.02] transition-all disabled:opacity-50 active:scale-95"
           >
             <Printer size={24} /> พิมพ์รายงานสรุปจำนวน (LEC - 1)
           </button>
           <button 
             onClick={printLEC2}
             disabled={loading || students.length === 0}
             className="flex-1 bg-white text-brand-primary border-2 border-brand-primary/20 py-5 rounded-[24px] font-black text-lg flex items-center justify-center gap-3 hover:bg-green-50 transition-all disabled:opacity-50 active:scale-95"
           >
             <Users size={24} /> พิมพ์รายชื่อนักเรียน (LEC - 2)
           </button>
        </div>
        
        {students.length === 0 && !loading && (
          <div className="mt-8 flex items-center gap-3 bg-red-50 p-6 rounded-3xl border border-red-100 text-red-600 text-sm font-bold">
            <AlertCircle size={20} className="shrink-0" />
            <span>ไม่พบนักเรียนที่มีสถานะ "กำลังศึกษา" ในปี {config.academicYear} กรุณาตรวจสอบปีการศึกษาหรือนำเข้า DMC อีกครั้ง</span>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-blue-900 to-indigo-950 rounded-[40px] p-12 text-white relative overflow-hidden shadow-2xl">
         <div className="relative z-10">
            <h3 className="text-3xl font-black tracking-tight mb-2">สรุปสถิติจริงในฐานข้อมูล</h3>
            <p className="text-blue-300 font-bold uppercase tracking-widest text-xs opacity-80">ปีการศึกษา {config.academicYear} | รวมนักเรียนที่กำลังเรียนอยู่</p>
            <div className="flex flex-wrap gap-12 mt-10">
               <div>
                 <p className="text-6xl font-black tracking-tighter">{students.length}</p>
                 <p className="text-[10px] font-black text-blue-400 uppercase mt-2 tracking-widest">นักเรียนทั้งหมด (คน)</p>
               </div>
               <div className="w-px h-16 bg-white/10 self-center hidden sm:block"></div>
               <div>
                 <p className="text-6xl font-black tracking-tighter text-orange-400">{students.filter(s => checkIsMale(s)).length}</p>
                 <p className="text-[10px] font-black text-blue-400 uppercase mt-2 tracking-widest">นักเรียนชาย</p>
               </div>
               <div className="w-px h-16 bg-white/10 self-center hidden sm:block"></div>
               <div>
                 <p className="text-6xl font-black tracking-tighter text-teal-400">{students.filter(s => !checkIsMale(s)).length}</p>
                 <p className="text-[10px] font-black text-blue-400 uppercase mt-2 tracking-widest">นักเรียนหญิง</p>
               </div>
            </div>
         </div>
         <Users size={280} className="absolute right-[-40px] bottom-[-60px] opacity-5 rotate-12" />
      </div>
    </div>
  );
}
