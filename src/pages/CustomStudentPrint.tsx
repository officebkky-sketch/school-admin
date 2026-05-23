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

// ฝังฟอนต์ Base64 เพื่อให้หน้าต่างพิมพ์แสดงผลถูกต้อง 100% ใน Electron
const FONT_BASE64 = 'AAEAAAAWAQAABABgR0RFRgwJByQAASlEAAAAUkdQT1OM1rlcAAEpmAAAF0ZHU1VC+npHzgABQOAAABqmT1MvMqQuVIcAAAHoAAAAYFBDTFRiW0bNAAEpDAAAADZWRE1YaIVv6gAACjwAAAXgY21hcKcuOncAABAcAAAGhmN2dCAAFAAAAAAYHAAAAAJmZWF0AAYEVwABW4gAAAAsZnBnbQZZnDcAABakAAABc2dhc3AAFwAJAAEo/AAAABBnbHlmefHFYgAAGCAAALwMaGVhZOOWcZ0AAAFsAAAANmhoZWEFewQbAAABpAAAACRobXR4m98CUAAAAkgAAAf0a2Vybr7ZwqwAANgoAAAhPGxvY2F6zamAAADULAAAA/xtYXhwBDoEPwAAAcgAAAAgbW9yeAPXuA0AAVu0AAAmGG5hbWUshnerAAD5ZAAAIpdwb3N04ewapwABG/wAAAz/cHJlcLgAACsAABgYAAAABAABAAAAAQAA2bj+0F8PPPUACQPoAAAAAME4hTwAAAAAwTip3P5V/lsDswNEAAAACQACAAAAAAAAAAEAAANS/wYAHgO6/lX/XQOzAAEAAAAAAAAAAAAAAAAAAAH9AAEAAAH9AdIAKQBWAAYAAQAAAAAACgAAAgACFQADAAEAAwF2AZAABQAAArwCigAAAIwCvAKKAAAB3QAeAPoIBQILBQAEAgACAAOhAABvUAAgWgAAAAAAAAAAcHNrIABAACD7AgNS/wYAPANSAPpgAQGDgAAAAAFUAdwAAAAgAA0CtAAyANgAAACTACYA0AAlAZMAGwFpADQCSQAiAacAEwB4ACUAvgAUAL4AFAEdABIBmwAmAKIAHgDYABQAogAuAQ7/7gFqAB8BagBLAWoAGgFqACIBagAgAWoAGAFqACYBagAhAWoAIQFqACYAogAuAKIAHgGbACwBmwA3AZsALAEbAB8CGAAXAZAAAAF6ADYBlgAXAa8ANgFfADYBXwA2AakAFwG5ADYAkwA2AQj//wF4ADYBYQA2AiQAKAG5ADYB5gAWAXoANgHnABYBewA2AWAAGwF7//sB0gA2AYYAAAJMAAABogARAW4AAAGoABYAxAA0AQb/9wDEAAsBnAArAWAAAADMADsBWAAaAZEAMQFLABsBkQAcAXYAGwDOAAUBNwAkAYYANACPACcAm//WATwANADIADQCWQAtAYYALQGOABwBkQAxAZEAMQDZACoBGgAdAO4ABgGGADQBVQADAfsAAwE+AAABUQADAUEADwDQAA0AmQA8ANAAHAGgABoBPP7RAAAAAADYAAAAAP7fAJcAJgGbACABmwA5AZsAFgGbACIAmQA8AXYANwDUAA4CGAAZAPYAGAEqAAsBpAAXAhgAGQFgAAAA1AAUAZsAJgD+ABkA/gAjANQANgGWADkBdgAtAKIALgDUACMA/gA7AR0AFAEmABMCGAAeAhgAHgIYACMBIQAiAZAAAAGQAAABkAAAAZAAAAGQAAABkAAAAkb/+QGWABcBXwA2AV8ANgFfADYBXwA2AJMAHQCTAB0Ak//9AJP/8wGvAAUBuQA2AeYAFgHmABYB5gAWAeYAFgHmABYBmwAvAeYAFgHSADYB0gA2AdIANgHSADYBbgAAAXwAPAGIACkBWAAaAVgAGgFYABoAVgAGgFYABoAVgAGgCYAAaAUsAGwF2ABsBdgAbAXYAGwF2ABsAjwAbAI8AGwCP//sAj//xAWoAJgGGAC0BjgAcAY4AHAGOABwBjgAcAY4AHAGbACYBjgAcAYYANAGGADQBhgA0AYYANAFRAAMBsAA9AVEAAwCPADQBaQASANEAEgLHABYCpwAcAWAAGwEaAB0BfgAHAagAFgFBAA8Bjv/vANQAFwDUABcBLgA8AS4AdQEuAE0BLgBQANQAFwEXACoAAAAAAYIAJAF6AA8BfgAPAYkAIQGJACEBmAAPASYAEAFvABgBeQAaAXwADwGAAA8...';
const FONT_BOLD_BASE64 = 'AAEAAAAYAQAABACAR0RFRgQiB0AAAXOIAAAANEdQT1OM1rlcAAFzvAAAF0ZHU1VC+npHzgABiwQAABqmTFRTSEA59scAAApcAAACAU9TLzKlWlR9AAACCAAAAGBQQ0xUhJ9GzQABc1AAAAA2VkRNWGiFb+oAAAxgAAAF4GNtYXCnLjp3AABASAAABoZjdnQgABQAAAAASEgAAAACZmVhdAAGBFcAAaWsAAAALGZwZ20GWZw3AABG0AAAAXNnYXNwABcACQABc0AAAAAQZ2x5ZoBj9bQAAEhMAADWFGhkbXhIFrcjAAASQAAALghoZWFkNDBw0AAAAYwAAAA2aGhlYQVUBCoAAAHEAAAAJGhtdHjEmvsNAAACaAAAB/RrZXJndtnCrAABIlwAACE8bG9jYTuncdIAAR5gAAAD/G1heHAEOgQ6AAAB6AAAACBtb3J4A9e4DQABpdgAACYYbmFtZXNyEM4AAUOYAAAiqHBvc3Th7BqnAAFmQAAADP9wcmVwdAAAKwAASEQAAAAEAAEAAAABAABv2UP6Xw889QAZA+gAAAAAwTiFPAAAAADBOKkr/i7+NwOzA0wAAQAJAAIAAAAAAAAAAQAAA1L/BgAeA8z+Lv9aA7MAAQAAAAAAAAAAAAAAAAAAAf0AAQAAAf0B0gApAFEABgABAAAAAAAKAAACAAIVAAMAAQADAYwCvAAFAAACvAKKAAAAjAK8AooAAAHdAB4A+ggFAgsFAAQCAAIAA6EAAG9QACBaAAAAAAAAAABwc2sgACAAIPsCA1L/BgA8A1IA+mABAYOAAAAAAVQB3AAAACAADQK6ADUA3AAAAKgAJAEjADEBzgAhAW8AKwKwACcB5gAjAKkAMQD0ACwA9AALAVcAJwGhAB0ArAAZAOIADQCsACYBFP/iAXoAHAF6AEYBegAYAXoAGgF6ABwBegAaAXoAJAF6ABwBegAfAXoAJACsACYArAAZAaEAJAGhAC4BoQAkASEAGAI8AB4Bw///AYwAMgGwABoBywAyAWYAMgFmADIBxgAaAdgAMgCjADIBGv/6AZsAMgFnADICPgAdAdgAMgIGABoBhgAyAgYAGgGLADIBbQATAaUABAHiADIBpv//AmT//AGq//8BjP/6AcMAGwDqAC4BDP/qAOoAHgGiACABeAAAANIAIgFvABoBswAyAVsAGgGzABoBhwAaAP4AEQFMACABpwAyAKMAIACr/9ABVAAyANUAMgJ8ACoBpwAqAZwAGgGvAC4BrwAaAPYAJgEoABoBAgAJAiIAMgFm//wB4P/8AV3/9QFp//wBZgAUAP8AHgCxADwA/wAlAaYAFgFQ/roAAAAAANgAAAAA/t8AqAAkAeAAPQHgAFkB4AAyAeAAOAChADgBfAA2AVUANQIcABsA/AAaAWQAHgHAACICHAAbAXgAAAEVADEBuAAkAQQAGwEEACQBAwA1AZ4ALwF8ADAArAAmAPkANQEEADYBJgATAWQAHgIeABcCHgAXAh4AHwEhABgBw///AcP//wHD//8Bw///AcP//wHD//8CR//2AbAAGgFmADIBZgAyAWYAMgFmADIAowAPAKMADwCj//QAo//dAcsACQHYADICBgAaAgYAGgIGABoCBgAaAgYAGgGhABsCBgAaAeIAMgHiADIB4gAyAeIAMgGM//oBigA1AakALgFvABoBbwAaAW8AGgFvABoBbwAaAW8AGgJtABoBWwAaAYcAGgGHABoBhwAaAYcAGgCjAA8AowAPAKP/9ACj/90BegAkAacAKgGcABoBnAAaAZwAGgGcABoBnAAaAaEAGgGcABoBogAyAaIAMgGiADIBogAyAWn//AG2ADcBaf/8AKMAMgFnABUA2QAIAtMAGgKxABoBbQATASgAGgGM//oBwwAbAWYAFAGU/+UA2gAOATQAOwFWADUAwQA1AQoANQD/ADUBAwAcAWcANQAAAAABhwAeAZ8AFA...';

export default function CustomStudentPrint() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [customColumns, setCustomColumns] = useState<string[]>([]);
  const [newColumnName, setNewColumnName] = useState('');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [config, setConfig] = useState({
    academicYear: '',
    classLevel: 'ทั้งหมด',
    room: 'ทั้งหมด',
    reportTitle: 'รายชื่อนักเรียน',
    showLogo: true,
    showSignatures: true,
    teacherName: '',
    directorName: '',
    schoolLogo: '',
    schoolName: import.meta.env.VITE_SCHOOL_NAME || 'โรงเรียนบ้านควนโคกยา',
  });

  const [selectedColumns, setSelectedColumns] = useState({
    student_id: true, prefix_name: true, national_id: false, class_room: true,
    birth_date: false, parent_name: false, address: false, status: true,
  });

  const fetchInitialData = async () => {
    const { data: yearData } = await supabase.from('students').select('academic_year');
    if (yearData) {
      const years = Array.from(new Set(yearData.map(d => d.academic_year))).filter(Boolean).sort((a: any, b: any) => b.localeCompare(a));
      setAvailableYears(years as string[]);
    }

    // Fetch Current Year from Settings
    const { data: settings } = await supabase
      .from('settings')
      .select('school_name, current_academic_year, school_logo_url, director_name')
      .order('updated_at', { ascending: false })
      .maybeSingle();

    if (settings) {
      setConfig(prev => ({ 
        ...prev, 
        schoolName: settings.school_name || prev.schoolName,
        academicYear: settings.current_academic_year || prev.academicYear,
        schoolLogo: settings.school_logo_url || '',
        directorName: settings.director_name || prev.directorName
      }));
    }
  };

  const fetchStudents = async () => {
    if (!config.academicYear) return;
    setLoading(true);
    let query = supabase.from('students').select('*').eq('academic_year', config.academicYear).or('graduation_status.ilike.%กำลังศึกษา%,graduation_status.eq.ปกติ');
    if (config.classLevel !== 'ทั้งหมด') query = query.eq('class_level', config.classLevel);
    if (config.room !== 'ทั้งหมด') query = query.eq('room', config.room);
    const { data, error } = await query.order('class_level', { ascending: true }).order('student_id', { ascending: true });
    if (error) console.error(error); else setStudents(data || []);
    setLoading(false);
  };

  const toThaiDigits = (num: string | number) => {
    if (!num) return '';
    const thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
    return num.toString().split('').map(d => isNaN(parseInt(d)) ? d : thaiDigits[parseInt(d)]).join('');
  };

  useEffect(() => { fetchInitialData(); }, []);
  useEffect(() => { fetchStudents(); }, [config.academicYear, config.classLevel, config.room]);

  const addCustomColumn = () => { if (newColumnName.trim()) { setCustomColumns([...customColumns, newColumnName.trim()]); setNewColumnName(''); } };
  const removeCustomColumn = (index: number) => { setCustomColumns(customColumns.filter((_, i) => i !== index)); };
  const toggleColumn = (col: string) => { setSelectedColumns(prev => ({ ...prev, [col]: !prev[col as keyof typeof selectedColumns] })); };

  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    return `${toThaiDigits(day)}/${toThaiDigits(month)}/${toThaiDigits(parseInt(year) + 543)}`;
  };

  const handlePrint = () => {
    const htmlRows = students.map((s, i) => `
      <tr>
        <td>${toThaiDigits(i + 1)}</td>
        ${selectedColumns.student_id ? `<td>${toThaiDigits(s.student_id || '-')}</td>` : ''}
        ${selectedColumns.prefix_name ? `<td style="text-align:left;">${s.prefix}${s.first_name} ${s.last_name}</td>` : ''}
        ${selectedColumns.national_id ? `<td>${toThaiDigits(s.national_id || '-')}</td>` : ''}
        ${selectedColumns.class_room ? `<td>${s.class_level}/${toThaiDigits(s.room)}</td>` : ''}
        ${selectedColumns.birth_date ? `<td>${formatThaiDate(s.birth_date)}</td>` : ''}
        ${selectedColumns.parent_name ? `<td style="text-align:left;">${s.parent_first_name} ${s.parent_last_name}</td>` : ''}
        ${selectedColumns.address ? `<td style="text-align:left; font-size: 13pt;">${toThaiDigits(s.address_no)} ม.${toThaiDigits(s.moo)} ต.${s.sub_district}</td>` : ''}
        ${selectedColumns.status ? `<td>${s.graduation_status}</td>` : ''}
        ${customColumns.map(() => `<td></td>`).join('')}
      </tr>
    `).join('');

    const headers = `
      <tr>
        <th style="width:40px;">ที่</th>
        ${selectedColumns.student_id ? '<th style="width:90px;">เลขประจำตัว</th>' : ''}
        ${selectedColumns.prefix_name ? '<th style="text-align:left;">ชื่อ - นามสกุล</th>' : ''}
        ${selectedColumns.national_id ? '<th style="width:130px;">เลขประชาชน</th>' : ''}
        ${selectedColumns.class_room ? '<th style="width:70px;">ชั้น/ห้อง</th>' : ''}
        ${selectedColumns.birth_date ? '<th style="width:100px;">วันเกิด</th>' : ''}
        ${selectedColumns.parent_name ? '<th style="text-align:left;">ผู้ปกครอง</th>' : ''}
        ${selectedColumns.address ? '<th style="text-align:left; width:200px;">ที่อยู่</th>' : ''}
        ${selectedColumns.status ? '<th style="width:80px;">สถานะ</th>' : ''}
        ${customColumns.map(col => `<th style="min-width:100px;">${col}</th>`).join('')}
      </tr>
    `;

    const logoHtml = (config.showLogo && config.schoolLogo) ? `
      <div style="text-align:center; margin-bottom: 20px; margin-top: -10px;">
        <img src="${config.schoolLogo}" style="width: 80px; height: auto;" />
      </div>
    ` : '';

    const signatureHtml = config.showSignatures ? `
      <div style="margin-top: 1.5cm; display: flex; justify-content: space-between; width: 100%;">
        <div style="display: flex; flex-direction: column; align-items: center; width: 48%;">
          <table style="border: none !important; margin: 0 auto; border-spacing: 0;">
            <tr><td style="border: none !important; text-align: right; padding-right: 5px; font-size: 16pt;">ลงชื่อ</td><td style="border: none !important; text-align: center; font-size: 16pt;">...........................................................</td><td style="border: none !important; text-align: left; font-size: 16pt;">ผู้ให้ข้อมูล</td></tr>
            <tr><td style="border: none !important;"></td><td style="border: none !important; text-align: center; font-size: 16pt;">( ${config.teacherName || '.........................................................'} )</td><td style="border: none !important;"></td></tr>
          </table>
          <div style="font-size: 16pt;">ตำแหน่ง ครู</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; width: 48%;">
          <table style="border: none !important; margin: 0 auto; border-spacing: 0;">
            <tr><td style="border: none !important; text-align: right; padding-right: 5px; font-size: 16pt;">ลงชื่อ</td><td style="border: none !important; text-align: center; font-size: 16pt;">...........................................................</td><td style="border: none !important; text-align: left; font-size: 16pt;">ผู้รับรองข้อมูล</td></tr>
            <tr><td style="border: none !important;"></td><td style="border: none !important; text-align: center; font-size: 16pt;">( ${config.directorName || '.........................................................'} )</td><td style="border: none !important;"></td></tr>
          </table>
          <div style="font-size: 16pt;">ตำแหน่ง ผู้อำนวยการโรงเรียน</div>
        </div>
      </div>
    ` : '';

    const html = `
      <html>
        <head>
          <title>${config.reportTitle}</title>
          <style>
            @font-face { font-family: 'TH Sarabun New'; src: url(data:font/truetype;charset=utf-8;base64,${FONT_BASE64}) format('truetype'); font-weight: normal; font-style: normal; }
            @font-face { font-family: 'TH Sarabun New'; src: url(data:font/truetype;charset=utf-8;base64,${FONT_BOLD_BASE64}) format('truetype'); font-weight: bold; font-style: normal; }
            @media print { @page { size: A4 ${orientation}; margin: 15mm; } .no-print-btn { display: none !important; } }
            .sarabun { font-family: 'TH Sarabun New', sans-serif; color: black; line-height: 1.0; }
            body { background: white; margin: 0; padding: 0; }
            .page { background: white; width: ${orientation === 'portrait' ? '210mm' : '297mm'}; padding: 1.5cm; margin: 0 auto; box-sizing: border-box; }
            .header { text-align: center; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black !important; padding: 4px 6px !important; text-align: center; font-size: 16pt; }
            th { background: #f8fafc; font-weight: bold; }
            .no-print-btn { position: fixed; top: 20px; right: 20px; background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 12px; cursor: pointer; font-weight: bold; z-index: 9999; }
          </style>
        </head>
        <body class="sarabun">
          <button class="no-print-btn" onclick="window.print()">🖨️ คลิกเพื่อสั่งพิมพ์</button>
          <div class="page">
            ${logoHtml}
            <div class="header">
              <h1 style="margin:0; font-size: 20pt; font-weight: bold;">${config.reportTitle}</h1>
              <p style="margin:5px 0; font-size: 16pt;">${config.schoolName} ปีการศึกษา ${toThaiDigits(config.academicYear)}</p>
              ${config.classLevel !== 'ทั้งหมด' ? `<p style="margin:0; font-size: 16pt;">ระดับชั้น ${config.classLevel} ${config.room !== 'ทั้งหมด' ? `ห้อง ${toThaiDigits(config.room)}` : ''}</p>` : ''}
            </div>
            <table><thead>${headers}</thead><tbody>${htmlRows}</tbody></table>
            ${signatureHtml}
          </div>
          <script>window.onload = function() { setTimeout(() => { window.print(); }, 800); }</script>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100 print:hidden">
        <div className="flex items-center gap-4 mb-10">
          <div className="bg-orange-50 p-4 rounded-3xl text-brand-secondary shadow-sm"><Printer size={32} /></div>
          <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">พิมพ์รายชื่อนักเรียน (กำหนดเอง)</h2><p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">เลือกและจัดรูปแบบรายงานได้ตามต้องการ</p></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1 space-y-8 border-r border-slate-50 pr-6">
            <div className="space-y-6">
              <h4 className="font-black text-slate-700 text-xs uppercase tracking-widest flex items-center gap-2"><Filter size={16} /> 1. กรองและตั้งค่ารายงาน</h4>
              <div className="space-y-4">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">ปีการศึกษา</label><select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 ring-brand-primary/20" value={config.academicYear} onChange={e => setConfig({...config, academicYear: e.target.value})}>{availableYears.map(y => <option key={y} value={y}>ปี {y}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">ชั้นเรียน</label><select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={config.classLevel} onChange={e => setConfig({...config, classLevel: e.target.value})}><option value="ทั้งหมด">ทั้งหมด</option>{['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'].map(l => <option key={l} value={l}>{l}</option>)}</select></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">ห้อง</label><select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={config.room} onChange={e => setConfig({...config, room: e.target.value})}><option value="ทั้งหมด">ทั้งหมด</option>{['1','2','3','4','5'].map(r => <option key={r} value={r}>{r}</option>)}</select></div></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">หัวข้อรายงาน</label><input type="text" className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl font-bold" value={config.reportTitle} onChange={e => setConfig({...config, reportTitle: e.target.value})} /></div>
                <div className="space-y-2 pt-4 border-t border-slate-50"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">การจัดวางหน้ากระดาษ</label><div className="flex gap-2"><button onClick={() => setOrientation('portrait')} className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${orientation === 'portrait' ? 'bg-brand-primary text-white' : 'bg-slate-50'}`}>แนวตั้ง</button><button onClick={() => setOrientation('landscape')} className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${orientation === 'landscape' ? 'bg-brand-primary text-white' : 'bg-slate-50'}`}>แนวนอน</button></div></div>
                <div className="space-y-4 pt-4 border-t border-slate-50"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ตัวเลือกการแสดงผล</p><div className="space-y-2"><label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer"><input type="checkbox" checked={config.showLogo} onChange={e => setConfig({...config, showLogo: e.target.checked})} /><span className="text-xs font-bold">แสดงโลโก้โรงเรียน</span></label><label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer"><input type="checkbox" checked={config.showSignatures} onChange={e => setConfig({...config, showSignatures: e.target.checked})} /><span className="text-xs font-bold">แสดงส่วนลงนาม</span></label></div></div>
                {config.showSignatures && <div className="space-y-3 pt-4 border-t border-slate-50 animate-in fade-in duration-300"><input type="text" placeholder="ชื่อครูผู้ให้ข้อมูล" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold" value={config.teacherName} onChange={e => setConfig({...config, teacherName: e.target.value})} /><input type="text" placeholder="ชื่อผู้อำนวยการ" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold" value={config.directorName} onChange={e => setConfig({...config, directorName: e.target.value})} /></div>}
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 space-y-8">
            <h4 className="font-black text-slate-700 text-xs uppercase tracking-widest flex items-center gap-2"><CheckSquare size={16} /> 2. เลือกคอลัมน์</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><ColumnToggle label="เลขประจำตัว" active={selectedColumns.student_id} onClick={() => toggleColumn('student_id')} /><ColumnToggle label="ชื่อ-นามสกุล" active={selectedColumns.prefix_name} onClick={() => toggleColumn('prefix_name')} /><ColumnToggle label="เลขประชาชน" active={selectedColumns.national_id} onClick={() => toggleColumn('national_id')} /><ColumnToggle label="ชั้น/ห้อง" active={selectedColumns.class_room} onClick={() => toggleColumn('class_room')} /><ColumnToggle label="วันเกิด" active={selectedColumns.birth_date} onClick={() => toggleColumn('birth_date')} /><ColumnToggle label="ผู้ปกครอง" active={selectedColumns.parent_name} onClick={() => toggleColumn('parent_name')} /><ColumnToggle label="ที่อยู่" active={selectedColumns.address} onClick={() => toggleColumn('address')} /><ColumnToggle label="สถานะ" active={selectedColumns.status} onClick={() => toggleColumn('status')} /></div>
            <div className="pt-8 space-y-4"><h4 className="font-black text-slate-700 text-xs uppercase tracking-widest flex items-center gap-2"><LayoutGrid size={16} /> 3. เพิ่มคอลัมน์เปล่า</h4><div className="flex gap-2"><input type="text" placeholder="ชื่อคอลัมน์ เช่น ลายมือชื่อ" className="flex-1 p-3.5 bg-white border border-slate-200 rounded-2xl font-bold" value={newColumnName} onChange={e => setNewColumnName(e.target.value)} /><button onClick={addCustomColumn} className="px-6 py-3 bg-slate-800 text-white rounded-2xl font-bold text-sm">เพิ่ม</button></div>{customColumns.length > 0 && <div className="flex flex-wrap gap-2 mt-4">{customColumns.map((col, index) => <div key={index} className="flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-xl font-bold text-xs border border-brand-primary/20">{col}<button onClick={() => removeCustomColumn(index)}>×</button></div>)}</div>}</div>
            <div className="pt-10 border-t border-slate-50 flex items-center justify-between"><div><p className="text-xl font-black text-slate-800">พบ {students.length} คน</p></div><button onClick={handlePrint} disabled={students.length === 0} className="bg-brand-primary text-white px-10 py-5 rounded-[28px] font-black text-lg flex items-center gap-3 shadow-xl"><Printer size={24} /> เริ่มพิมพ์รายงาน</button></div>
          </div>
        </div>
      </div>
      <div className="bg-slate-900 rounded-[40px] p-8 text-white"><div className="flex items-center gap-3 mb-6"><LayoutGrid size={20} className="text-brand-primary" /><h3 className="font-bold">ตัวอย่างข้อมูล</h3></div><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-white/10 text-slate-500 text-[10px] font-black uppercase tracking-widest"><th className="py-4">ที่</th>{selectedColumns.student_id && <th className="py-4">รหัส</th>}{selectedColumns.prefix_name && <th className="py-4">ชื่อ-สกุล</th>}{selectedColumns.class_room && <th className="py-4 text-center">ชั้น/ห้อง</th>}{selectedColumns.status && <th className="py-4 text-center">สถานะ</th>}</tr></thead><tbody className="divide-y divide-white/5">{loading ? <tr><td colSpan={5} className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-brand-primary" /></td></tr> : students.slice(0, 5).map((s, i) => <tr key={s.id} className="text-sm font-medium"><td className="py-4 text-slate-500">{i + 1}</td>{selectedColumns.student_id && <td className="py-4">{s.student_id}</td>}{selectedColumns.prefix_name && <td className="py-4">{s.prefix}{s.first_name} {s.last_name}</td>}{selectedColumns.class_room && <td className="py-4 text-center">{s.class_level}/{s.room}</td>}{selectedColumns.status && <td className="py-4 text-center"><span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded-md text-[10px]">{s.graduation_status}</span></td>}</tr>)}</tbody></table></div></div>
    </div>
  );
}

function ColumnToggle({ label, active, onClick }: any) { return <button onClick={onClick} className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${active ? 'bg-brand-primary/5 border-brand-primary text-brand-primary shadow-sm' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}>{active ? <CheckSquare size={18} /> : <Square size={18} />}<span className="text-xs font-black uppercase tracking-tight">{label}</span></button>; }
