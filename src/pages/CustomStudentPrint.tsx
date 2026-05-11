import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Printer, 
  Filter, 
  CheckSquare, 
  Square,
  Loader2,
  LayoutGrid
} from 'lucide-react';

export default function CustomStudentPrint() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  
  // Selection State
  const [config, setConfig] = useState({
    academicYear: '2568',
    classLevel: 'ทั้งหมด',
    room: 'ทั้งหมด',
    reportTitle: 'รายชื่อนักเรียน',
    showLogo: true,
    showSignatures: true,
    teacherName: '',
    directorName: '',
  });

  const [selectedColumns, setSelectedColumns] = useState({
    student_id: true,
    prefix_name: true,
    national_id: false,
    class_room: true,
    birth_date: false,
    parent_name: false,
    address: false,
    status: true,
  });

  const fetchYears = async () => {
    const { data } = await supabase.from('students').select('academic_year');
    if (data) {
      const years = Array.from(new Set(data.map(d => d.academic_year))).sort((a, b) => b.localeCompare(a));
      setAvailableYears(years);
      if (years.length > 0 && !years.includes(config.academicYear)) {
        setConfig(prev => ({ ...prev, academicYear: years[0] }));
      }
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    let query = supabase
      .from('students')
      .select('*')
      .eq('academic_year', config.academicYear)
      .or('graduation_status.ilike.%กำลังศึกษา%,graduation_status.eq.ปกติ');
    
    if (config.classLevel !== 'ทั้งหมด') query = query.eq('class_level', config.classLevel);
    if (config.room !== 'ทั้งหมด') query = query.eq('room', config.room);

    const { data, error } = await query.order('class_level', { ascending: true }).order('student_id', { ascending: true });
    
    if (error) console.error(error);
    else setStudents(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchYears(); }, []);
  useEffect(() => { fetchStudents(); }, [config.academicYear, config.classLevel, config.room]);

  const toggleColumn = (col: string) => {
    setSelectedColumns(prev => ({ ...prev, [col]: !prev[col as keyof typeof selectedColumns] }));
  };

  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    const beYear = parseInt(year) + 543;
    return `${day}/${month}/${beYear}`;
  };

  const handlePrint = () => {
    const htmlRows = students.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        ${selectedColumns.student_id ? `<td>${s.student_id || '-'}</td>` : ''}
        ${selectedColumns.prefix_name ? `<td style="text-align:left;">${s.prefix}${s.first_name} ${s.last_name}</td>` : ''}
        ${selectedColumns.national_id ? `<td>${s.national_id || '-'}</td>` : ''}
        ${selectedColumns.class_room ? `<td>${s.class_level}/${s.room}</td>` : ''}
        ${selectedColumns.birth_date ? `<td>${formatThaiDate(s.birth_date)}</td>` : ''}
        ${selectedColumns.parent_name ? `<td style="text-align:left;">${s.parent_first_name} ${s.parent_last_name}</td>` : ''}
        ${selectedColumns.address ? `<td style="text-align:left; font-size: 10pt;">${s.address_no} ม.${s.moo} ต.${s.sub_district}</td>` : ''}
        ${selectedColumns.status ? `<td>${s.graduation_status}</td>` : ''}
      </tr>
    `).join('');

    const headers = `
      <tr>
        <th style="width:50px;">ที่</th>
        ${selectedColumns.student_id ? '<th>เลขประจำตัว</th>' : ''}
        ${selectedColumns.prefix_name ? '<th>ชื่อ - นามสกุล</th>' : ''}
        ${selectedColumns.national_id ? '<th>เลขประชาชน</th>' : ''}
        ${selectedColumns.class_room ? '<th>ชั้น/ห้อง</th>' : ''}
        ${selectedColumns.birth_date ? '<th>วันเกิด</th>' : ''}
        ${selectedColumns.parent_name ? '<th>ผู้ปกครอง</th>' : ''}
        ${selectedColumns.address ? '<th>ที่อยู่</th>' : ''}
        ${selectedColumns.status ? '<th>สถานะ</th>' : ''}
      </tr>
    `;

    const logoHtml = config.showLogo ? `
      <div style="text-align:center; margin-bottom: 20px;">
        <img src="/src/assets/logo.png" style="width: 80px; height: auto;" />
      </div>
    ` : '';

    const signatureHtml = config.showSignatures ? `
      <div class="footer-sign" style="margin-top: 2cm; display: flex; justify-content: space-between; page-break-inside: avoid;">
        <div class="sign-box" style="text-align: center; width: 45%;">
          <p>(ลงชื่อ)......................................................ผู้ให้ข้อมูล</p>
          <p>(${config.teacherName || '................................................'})</p>
          <p>ตำแหน่ง ครู</p>
        </div>
        <div class="sign-box" style="text-align: center; width: 45%;">
          <p>(ลงชื่อ)......................................................ผู้รับรองข้อมูล</p>
          <p>(${config.directorName || '................................................'})</p>
          <p>ตำแหน่ง ผู้อำนวยการสถานศึกษา</p>
        </div>
      </div>
    ` : '';

    const html = `
      <html>
        <head>
          <title>${config.reportTitle}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
            body { font-family: 'Sarabun', sans-serif; padding: 1.5cm; }
            .header { text-align: center; margin-bottom: 25px; line-height: 1.3; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid black; padding: 8px; text-align: center; font-size: 12pt; }
            th { background: #f0f0f0; font-weight: bold; }
            .no-print-btn { 
              position: fixed; top: 20px; right: 20px; 
              background: #16a34a; color: white; border: none; 
              padding: 12px 24px; border-radius: 12px; cursor: pointer;
              font-weight: bold; font-family: 'Sarabun', sans-serif;
              z-index: 9999;
            }
            @media print { .no-print-btn { display: none; } }
          </style>
        </head>
        <body>
          <button class="no-print-btn" onclick="window.print()">🖨️ คลิกเพื่อสั่งพิมพ์</button>
          ${logoHtml}
          <div class="header">
            <h2 style="margin:0;">${config.reportTitle}</h2>
            <p style="margin:5px 0;">โรงเรียนบ้านควนโคกยา ปีการศึกษา ${config.academicYear}</p>
            ${config.classLevel !== 'ทั้งหมด' ? `<p style="margin:0;">ระดับชั้น ${config.classLevel} ${config.room !== 'ทั้งหมด' ? `ห้อง ${config.room}` : ''}</p>` : ''}
          </div>
          <table>
            <thead>${headers}</thead>
            <tbody>${htmlRows}</tbody>
          </table>
          ${signatureHtml}
          <script>window.onload = function() { setTimeout(() => { window.print(); }, 600); }</script>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100">
        <div className="flex items-center gap-4 mb-10">
          <div className="bg-orange-50 p-4 rounded-3xl text-brand-secondary shadow-sm"><Printer size={32} /></div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">พิมพ์รายชื่อนักเรียน (กำหนดเอง)</h2>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">เลือกและจัดรูปแบบรายงานได้ตามต้องการ</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Settings Section */}
          <div className="lg:col-span-1 space-y-8 border-r border-slate-50 pr-6">
            <div className="space-y-6">
              <h4 className="font-black text-slate-700 text-xs uppercase tracking-widest flex items-center gap-2">
                <Filter size={16} /> 1. กรองและตั้งค่ารายงาน
              </h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ปีการศึกษา</label>
                  <select 
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-hidden focus:ring-2 ring-brand-primary/20"
                    value={config.academicYear}
                    onChange={e => setConfig({...config, academicYear: e.target.value})}
                  >
                    {availableYears.map(y => <option key={y} value={y}>ปี {y}</option>)}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ชั้นเรียน</label>
                      <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-hidden" value={config.classLevel} onChange={e => setConfig({...config, classLevel: e.target.value})}>
                        <option value="ทั้งหมด">ทั้งหมด</option>
                        {['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'].map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ห้อง</label>
                      <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-hidden" value={config.room} onChange={e => setConfig({...config, room: e.target.value})}>
                        <option value="ทั้งหมด">ทั้งหมด</option>
                        {['1','2','3','4','5'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                   </div>
                </div>

                <div className="space-y-2 pt-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">หัวข้อรายงาน</label>
                  <input type="text" className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl font-bold outline-hidden focus:ring-2 ring-brand-primary/20" value={config.reportTitle} onChange={e => setConfig({...config, reportTitle: e.target.value})} />
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-50">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ตัวเลือกการแสดงผล</p>
                   <div className="space-y-2">
                      <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-all">
                        <input type="checkbox" className="w-4 h-4 rounded accent-brand-primary" checked={config.showLogo} onChange={e => setConfig({...config, showLogo: e.target.checked})} />
                        <span className="text-xs font-bold text-slate-700">แสดงโลโก้โรงเรียน (ตรงกลาง)</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-all">
                        <input type="checkbox" className="w-4 h-4 rounded accent-brand-primary" checked={config.showSignatures} onChange={e => setConfig({...config, showSignatures: e.target.checked})} />
                        <span className="text-xs font-bold text-slate-700">แสดงส่วนลงนาม (ผู้รับรอง)</span>
                      </label>
                   </div>
                </div>

                {config.showSignatures && (
                  <div className="space-y-3 pt-4 border-t border-slate-50 animate-in fade-in duration-300">
                    <input type="text" placeholder="ชื่อครูผู้ให้ข้อมูล" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold" value={config.teacherName} onChange={e => setConfig({...config, teacherName: e.target.value})} />
                    <input type="text" placeholder="ชื่อผู้อำนวยการ" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold" value={config.directorName} onChange={e => setConfig({...config, directorName: e.target.value})} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column Selection Section */}
          <div className="lg:col-span-2 space-y-8">
            <h4 className="font-black text-slate-700 text-xs uppercase tracking-widest flex items-center gap-2">
              <CheckSquare size={16} /> 2. เลือกคอลัมน์ที่จะแสดงในรายงาน
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <ColumnToggle label="เลขประจำตัว" active={selectedColumns.student_id} onClick={() => toggleColumn('student_id')} />
               <ColumnToggle label="ชื่อ-นามสกุล" active={selectedColumns.prefix_name} onClick={() => toggleColumn('prefix_name')} />
               <ColumnToggle label="เลขประชาชน" active={selectedColumns.national_id} onClick={() => toggleColumn('national_id')} />
               <ColumnToggle label="ชั้น/ห้อง" active={selectedColumns.class_room} onClick={() => toggleColumn('class_room')} />
               <ColumnToggle label="วันเกิด" active={selectedColumns.birth_date} onClick={() => toggleColumn('birth_date')} />
               <ColumnToggle label="ผู้ปกครอง" active={selectedColumns.parent_name} onClick={() => toggleColumn('parent_name')} />
               <ColumnToggle label="ที่อยู่" active={selectedColumns.address} onClick={() => toggleColumn('address')} />
               <ColumnToggle label="สถานะ" active={selectedColumns.status} onClick={() => toggleColumn('status')} />
            </div>

            <div className="pt-10 border-t border-slate-50 flex items-center justify-between">
               <div>
                  <p className="text-xl font-black text-slate-800">พบนักเรียนทั้งหมด {students.length} คน</p>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">พร้อมสำหรับการจัดพิมพ์รายงาน</p>
               </div>
               <button 
                 onClick={handlePrint}
                 disabled={students.length === 0}
                 className="bg-brand-primary text-white px-10 py-5 rounded-[28px] font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-green-100 hover:bg-green-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
               >
                 <Printer size={24} /> เริ่มพิมพ์รายงาน
               </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div className="bg-slate-900 rounded-[40px] p-8 text-white">
         <div className="flex items-center gap-3 mb-6">
            <LayoutGrid size={20} className="text-brand-primary" />
            <h3 className="font-bold">ตัวอย่างข้อมูลเบื้องต้น</h3>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                 <tr className="border-b border-white/10 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                   <th className="py-4">ที่</th>
                   {selectedColumns.student_id && <th className="py-4">รหัส</th>}
                   {selectedColumns.prefix_name && <th className="py-4">ชื่อ-สกุล</th>}
                   {selectedColumns.class_room && <th className="py-4 text-center">ชั้น/ห้อง</th>}
                   {selectedColumns.status && <th className="py-4 text-center">สถานะ</th>}
                 </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                 {loading ? (
                   <tr><td colSpan={5} className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-brand-primary" /></td></tr>
                 ) : students.slice(0, 5).map((s, i) => (
                   <tr key={s.id} className="text-sm font-medium">
                     <td className="py-4 text-slate-500">{i + 1}</td>
                     {selectedColumns.student_id && <td className="py-4">{s.student_id}</td>}
                     {selectedColumns.prefix_name && <td className="py-4">{s.prefix}{s.first_name} {s.last_name}</td>}
                     {selectedColumns.class_room && <td className="py-4 text-center">{s.class_level}/{s.room}</td>}
                     {selectedColumns.status && <td className="py-4 text-center"><span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded-md text-[10px]">{s.graduation_status}</span></td>}
                   </tr>
                 ))}
                 {students.length > 5 && <tr><td colSpan={5} className="py-4 text-center text-slate-500 italic text-xs">และนักเรียนอื่นอีก {students.length - 5} คน...</td></tr>}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}

function ColumnToggle({ label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${active ? 'bg-brand-primary/5 border-brand-primary text-brand-primary shadow-sm' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
    >
      {active ? <CheckSquare size={18} /> : <Square size={18} />}
      <span className="text-xs font-black uppercase tracking-tight">{label}</span>
    </button>
  );
}
