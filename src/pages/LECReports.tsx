import { useState, useEffect, useRef } from 'react';
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

// ฝังฟอนต์ Base64 เพื่อให้หน้าต่างพิมพ์แสดงผลถูกต้อง 100% ใน Electron
const FONT_BASE64 = 'AAEAAAAWAQAABABgR0RFRgwJByQAASlEAAAAUkdQT1OM1rlcAAEpmAAAF0ZHU1VC+npHzgABQOAAABqmT1MvMqQuVIcAAAHoAAAAYFBDTFRiW0bNAAEpDAAAADZWRE1YaIVv6gAACjwAAAXgY21hcKcuOncAABAcAAAGhmN2dCAAFAAAAAAYHAAAAAJmZWF0AAYEVwABW4gAAAAsZnBnbQZZnDcAABakAAABc2dhc3AAFwAJAAEo/AAAABBnbHlmefHFYgAAGCAAALwMaGVhZOOWcZ0AAAFsAAAANmhoZWEFewQbAAABpAAAACRobXR4m98CUAAAAkgAAAf0a2Vybr7ZwqwAANgoAAAhPGxvY2F6zamAAADULAAAA/xtYXhwBDoEPwAAAcgAAAAgbW9yeAPXuA0AAVu0AAAmGG5hbWUshnerAAD5ZAAAIpdwb3N04ewapwABG/wAAAz/cHJlcLgAACsAABgYAAAABAABAAAAAQAA2bj+0F8PPPUACQPoAAAAAME4hTwAAAAAwTip3P5V/lsDswNEAAAACQACAAAAAAAAAAEAAANS/wYAHgO6/lX/XQOzAAEAAAAAAAAAAAAAAAAAAAH9AAEAAAH9AdIAKQBWAAYAAQAAAAAACgAAAgACFQADAAEAAwF2AZAABQAAArwCigAAAIwCvAKKAAAB3QAeAPoIBQILBQAEAgACAAOhAABvUAAgWgAAAAAAAAAAcHNrIABAACD7AgNS/wYAPANSAPpgAQGDgAAAAAFUAdwAAAAgAA0CtAAyANgAAACTACYA0AAlAZMAGwFpADQCSQAiAacAEwB4ACUAvgAUAL4AFAEdABIBmwAmAKIAHgDYABQAogAuAQ7/7gFqAB8BagBLAWoAGgFqACIBagAgAWoAGAFqACYBagAhAWoAIQFqACYAogAuAKIAHgGbACwBmwA3AZsALAEbAB8CGAAXAZAAAAF6ADYBlgAXAa8ANgFfADYBXwA2AakAFwG5ADYAkwA2AQj//wF4ADYBYQA2AiQAKAG5ADYB5gAWAXoANgHnABYBewA2AWAAGwF7//sB0gA2AYYAAAJMAAABogARAW4AAAGoABYAxAA0AQb/9wDEAAsBnAArAWAAAADMADsBWAAaAZEAMQFLABsBkQAcAXYAGwDOAAUBNwAkAYYANACPACcAm//WATwANADIADQCWQAtAYYALQGOABwBkQAxAZEAMQDZACoBGgAdAO4ABgGGADQBVQADAfsAAwE+AAABUQADAUEADwDQAA0AmQA8ANAAHAGgABoBPP7RAAAAAADYAAAAAP7fAJcAJgGbACABmwA5AZsAFgGbACIAmQA8AXYANwDUAA4CGAAZAPYAGAEqAAsBpAAXAhgAGQFgAAAA1AAUAZsAJgD+ABkA/gAjANQANgGWADkBdgAtAKIALgDUACMA/gA7AR0AFAEmABMCGAAeAhgAHgIYACMBIQAiAZAAAAGQAAABkAAAAZAAAAGQAAABkAAAAkb/+QGWABcBXwA2AV8ANgFfADYBXwA2AJMAHQCTAB0Ak//9AJP/8wGvAAUBuQA2AeYAFgHmABYB5gAWAeYAFgHmABYBmwAvAeYAFgHSADYB0gA2AdIANgHSADYBbgAAAXwAPAGIACkBWAAaAVgAGgFYABoAVgAGgFYABoAVgAGgCYAAaAUsAGwF2ABsBdgAbAXYAGwF2ABsAjwAbAI8AGwCP//sAj//xAWoAJgGGAC0BjgAcAY4AHAGOABwBjgAcAY4AHAGbACYBjgAcAYYANAGGADQBhgA0AYYANAFRAAMBsAA9AVEAAwCPADQBaQASANEAEgLHABYCpwAcAWAAGwEaAB0BfgAHAagAFgFBAA8Bjv/vANQAFwDUABcBLgA8AS4AdQEuAE0BLgBQANQAFwEXACoAAAAAAYIAJAF6AA8BfgAPAYkAIQGJACEBmAAPASYAEAFvABgBeQAaAXwADwGAAA8...';
const FONT_BOLD_BASE64 = 'AAEAAAAYAQAABACAR0RFRgQiB0AAAXOIAAAANEdQT1OM1rlcAAFzvAAAF0ZHU1VC+npHzgABiwQAABqmTFRTSEA59scAAApcAAACAU9TLzKlWlR9AAACCAAAAGBQQ0xUhJ9GzQABc1AAAAA2VkRNWGiFb+oAAAxgAAAF4GNtYXCnLjp3AABASAAABoZjdnQgABQAAAAASEgAAAACZmVhdAAGBFcAAaWsAAAALGZwZ20GWZw3AABG0AAAAXNnYXNwABcACQABc0AAAAAQZ2x5ZoBj9bQAAEhMAADWFGhkbXhIFrcjAAASQAAALghoZWFkNDBw0AAAAYwAAAA2aGhlYQVUBCoAAAHEAAAAJGhtdHjEmvsNAAACaAAAB/RrZXJndtnCrAABIlwAACE8bG9jYTuncdIAAR5gAAAD/G1heHAEOgQ6AAAB6AAAACBtb3J4A9e4DQABpdgAACYYbmFtZXNyEM4AAUOYAAAiqHBvc3Th7BqnAAFmQAAADP9wcmVwdAAAKwAASEQAAAAEAAEAAAABAABv2UP6Xw889QAZA+gAAAAAwTiFPAAAAADBOKkr/i7+NwOzA0wAAQAJAAIAAAAAAAAAAQAAA1L/BgAeA8z+Lv9aA7MAAQAAAAAAAAAAAAAAAAAAAf0AAQAAAf0B0gApAFEABgABAAAAAAAKAAACAAIVAAMAAQADAYwCvAAFAAACvAKKAAAAjAK8AooAAAHdAB4A+ggFAgsFAAQCAAIAA6EAAG9QACBaAAAAAAAAAABwc2sgACAAIPsCA1L/BgA8A1IA+mABAYOAAAAAAVQB3AAAACAADQK6ADUA3AAAAKgAJAEjADEBzgAhAW8AKwKwACcB5gAjAKkAMQD0ACwA9AALAVcAJwGhAB0ArAAZAOIADQCsACYBFP/iAXoAHAF6AEYBegAYAXoAGgF6ABwBegAaAXoAJAF6ABwBegAfAXoAJACsACYArAAZAaEAJAGhAC4BoQAkASEAGAI8AB4Bw///AYwAMgGwABoBywAyAWYAMgFmADIBxgAaAdgAMgCjADIBGv/6AZsAMgFnADICPgAdAdgAMgIGABoBhgAyAgYAGgGLADIBbQATAaUABAHiADIBpv//AmT//AGq//8BjP/6AcMAGwDqAC4BDP/qAOoAHgGiACABeAAAANIAIgFvABoBswAyAVsAGgGzABoBhwAaAP4AEQFMACABpwAyAKMAIACr/9ABVAAyANUAMgJ8ACoBpwAqAZwAGgGvAC4BrwAaAPYAJgEoABoBAgAJAiIAMgFm//wB4P/8AV3/9QFp//wBZgAUAP8AHgCxADwA/wAlAaYAFgFQ/roAAAAAANgAAAAA/t8AqAAkAeAAPQHgAFkB4AAyAeAAOAChADgBfAA2AVUANQIcABsA/AAaAWQAHgHAACICHAAbAXgAAAEVADEBuAAkAQQAGwEEACQBAwA1AZ4ALwF8ADAArAAmAPkANQEEADYBJgATAWQAHgIeABcCHgAXAh4AHwEhABgBw///AcP//wHD//8Bw///AcP//wHD//8CR//2AbAAGgFmADIBZgAyAWYAMgFmADIAowAPAKMADwCj//QAo//dAcsACQHYADICBgAaAgYAGgIGABoCBgAaAgYAGgGhABsCBgAaAeIAMgHiADIB4gAyAeIAMgGM//oBigA1AakALgFvABoBbwAaAW8AGgFvABoBbwAaAW8AGgJtABoBWwAaAYcAGgGHABoBhwAaAYcAGgCjAA8AowAPAKP/9ACj/90BegAkAacAKgGcABoBnAAaAZwAGgGcABoBnAAaAaEAGgGcABoBogAyAaIAMgGiADIBogAyAWn//AG2ADcBaf/8AKMAMgFnABUA2QAIAtMAGgKxABoBbQATASgAGgGM//oBwwAbAWYAFAGU/+UA2gAOATQAOwFWADUAwQA1AQoANQD/ADUBAwAcAWcANQAAAAABhwAeAZ8AFA...';

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
    schoolLogo: '',
    schoolName: import.meta.env.VITE_SCHOOL_NAME || 'โรงเรียนบ้านควนโคกยา',
  });

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const { data: yearData } = await supabase.from('students').select('academic_year');
      if (yearData) {
        const years = Array.from(new Set(yearData.map(d => d.academic_year))).sort((a, b) => b.localeCompare(a));
        setAvailableYears(years);
        if (years.length > 0) setConfig(prev => ({ ...prev, academicYear: years[0] }));
      }

      // 2. Fetch settings
      const { data: sets } = await supabase
        .from('settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .maybeSingle();

      if (sets) {
        setConfig(prev => ({
          ...prev,
          directorName: sets.director_name || prev.directorName,
          localGovName: sets.local_gov_name || prev.localGovName,
          teacherName: sets.teacher_name || prev.teacherName || '', // Support teacher_name if added to DB
          teacherPhone: sets.phone_number || prev.teacherPhone,
          schoolLogo: sets.school_logo_url || '',
          schoolName: sets.school_name || prev.schoolName
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

  const latestFetchYear = useRef(config.academicYear);

  const fetchStudentData = async () => {
    const targetYear = config.academicYear;
    latestFetchYear.current = targetYear;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('academic_year', targetYear.toString());
      if (error) throw error;

      // ป้องกัน Race Condition: ถ้าระหว่างที่ดึงข้อมูล ผู้ใช้เปลี่ยนปีไปแล้ว ให้ทิ้งข้อมูลชุดนี้
      if (latestFetchYear.current !== targetYear) return;

      const activeStudents = (data || []).filter(s => {
        const status = s.graduation_status || '';
        return status.includes('กำลังศึกษา') || status === 'ปกติ' || status === '';
      });
      setStudents(activeStudents);
    } catch (err) {
      console.error('Error fetching student data:', err);
    } finally {
      if (latestFetchYear.current === targetYear) setLoading(false);
    }
  };

  useEffect(() => { fetchInitialData(); }, []);
  useEffect(() => { if (config.academicYear) fetchStudentData(); }, [config.academicYear]);

  const checkIsMale = (s: any) => {
    const prefix = (s.prefix || '').trim();
    const gender = (s.gender || '').trim();
    return (gender === 'ชาย' || gender === 'ช' || prefix.includes('ด.ช.') || prefix.includes('เด็กชาย') || prefix.includes('นาย'));
  };

  const toThaiDigits = (num: string | number) => {
    if (num === 0 || num === '0') return '๐';
    if (!num && num !== 0) return '';
    const thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
    return num.toString().split('').map(d => isNaN(parseInt(d)) ? d : thaiDigits[parseInt(d)]).join('');
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
      totalMale += stats[l].male; totalFemale += stats[l].female;
      const levelNum = l.split('.')[1];
      const displayLevel = l.startsWith('อ') ? `อ.${toThaiDigits(levelNum)}` : `ป.${toThaiDigits(levelNum)}`;
      return `<tr><td style="text-align:left; padding-left: 20px;">ชั้น ${displayLevel}</td><td>${toThaiDigits(stats[l].male)}</td><td>${toThaiDigits(stats[l].female)}</td><td>${toThaiDigits(stats[l].male + stats[l].female)}</td></tr>`;
    }).join('');

    const html = `
      <html>
        <head>
          <title>แบบ LEC-1 ปี ${config.academicYear}</title>
          <style>
            @font-face {
              font-family: 'TH Sarabun New Print';
              src: url(data:font/truetype;charset=utf-8;base64,${FONT_BASE64}) format('truetype');
              font-weight: normal; font-style: normal;
            }
            @font-face {
              font-family: 'TH Sarabun New Print';
              src: url(data:font/truetype;charset=utf-8;base64,${FONT_BOLD_BASE64}) format('truetype');
              font-weight: bold; font-style: normal;
            }
            @media print {
              @page { size: A4; margin: 15mm; }
              body { background: white; }
              .no-print-btn { display: none !important; }
            }
            .sarabun { font-family: 'TH Sarabun New Print', sans-serif; color: black; line-height: 1.1; font-weight: normal; }
            body { background: #f0f0f0; margin: 0; padding: 0; }
            .page { 
              background: white; width: 210mm; min-height: 297mm; 
              padding: 1.5cm; margin: 1cm auto; box-sizing: border-box; 
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            @media print {
              body { background: white; }
              .page { margin: 0; box-shadow: none; width: 100%; height: auto; }
            }
            .header { text-align: center; line-height: 1.1; margin-bottom: 0.5cm; }
            .lec-code { text-align: right; font-weight: bold; font-size: 16pt; margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid black !important; padding: 4px 8px !important; text-align: center; font-size: 16pt; font-family: 'TH Sarabun New Print', sans-serif; }
            td { font-weight: normal; }
            th { background: #f8fafc; font-weight: bold; }
            .footer { margin-top: 1.2cm; display: flex; justify-content: space-between; width: 100%; font-size: 16pt; }
            .sign-box-table { border: none !important; margin: 0 auto; line-height: 1.1; border-spacing: 0; }
            .sign-box-table td { border: none !important; padding: 1px 2px !important; }
            .no-print-btn { position: fixed; top: 20px; right: 20px; background: #16a34a; color: white; border: none; padding: 12px 24px; border-radius: 12px; cursor: pointer; font-weight: bold; z-index: 9999; }
          </style>
        </head>
        <body class="sarabun">
          <button class="no-print-btn" onclick="window.print()">🖨️ คลิกเพื่อสั่งพิมพ์</button>
          <div class="page">
            <div class="lec-code">(แบบ LEC - ${toThaiDigits(1)})</div>
            <div class="header">
              <h3 style="margin:0; font-size: 20pt; font-weight: bold;">แบบบัญชีสรุปข้อมูลจำนวนนักเรียนของสถานศึกษาสังกัดหน่วยงานอื่น</h3>
              <p style="margin:2px 0; font-size: 14pt;">เพื่อใช้ในการตรวจสอบและพิจารณาจัดสรรงบประมาณอุดหนุนด้านการศึกษาขององค์กรปกครองส่วนท้องถิ่น</p>
              <p style="margin:2px 0; font-size: 14pt;">ประจำปีการศึกษา ${toThaiDigits(config.academicYear)} (ครั้งที่ ${toThaiDigits(config.term)})</p>
              <p style="margin:2px 0; font-size: 14pt;">${config.schoolName} สังกัด สำนักงานเขตพื้นที่การศึกษาประถมศึกษาพัทลุง เขต ๒</p>
              <p style="margin:2px 0; font-size: 14pt;">เพื่อจัดส่งให้ ${config.localGovName || '................................................'}</p>
            </div>
            <table>
              <thead><tr><th rowspan="2" style="width:40%;">ระดับชั้น</th><th colspan="3">จำนวนนักเรียน (คน)</th></tr><tr><th style="width:20%;">ชาย</th><th style="width:20%;">หญิง</th><th style="width:20%;">รวม</th></tr></thead>
              <tbody>${tableRows}<tr style="font-weight:bold; background:#f8fafc;"><td>รวมทั้งสิ้น</td><td>${toThaiDigits(totalMale)}</td><td>${toThaiDigits(totalFemale)}</td><td>${toThaiDigits(totalMale + totalFemale)}</td></tr></tbody>
            </table>
            <div class="footer">
              <div style="display: flex; flex-direction: column; align-items: center; width: 48%;">
                <table class="sign-box-table">
                  <tr><td style="text-align: right; padding-right: 5px;">ลงชื่อ</td><td style="text-align: center;">...........................................................</td><td style="text-align: left;">ผู้ให้ข้อมูล</td></tr>
                  <tr><td></td><td style="text-align: center;">( ${config.teacherName || '.........................................................'} )</td><td></td></tr>
                </table>
                <div style="margin-top: 1px;">ตำแหน่ง ครู&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
                <div style="margin-top: 0px;">วันที่ ${toThaiDigits(config.reportDate)}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
                <div style="margin-top: 0px;">เบอร์โทรศัพท์: ${toThaiDigits(config.teacherPhone || '...........................')}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
              </div>
              <div style="display: flex; flex-direction: column; align-items: center; width: 48%;">
                <table class="sign-box-table">
                  <tr><td style="text-align: right; padding-right: 5px;">ลงชื่อ</td><td style="text-align: center;">...........................................................</td><td style="text-align: left;">ผู้รับรองข้อมูล</td></tr>
                  <tr><td></td><td style="text-align: center;">( ${config.directorName || '.........................................................'} )</td><td></td></tr>
                </table>
                <div style="margin-top: 1px;">ผู้อำนวยการสถานศึกษา&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
                <div style="margin-top: 0px;">วันที่ ${toThaiDigits(config.reportDate)}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
              </div>
            </div>
          </div>
          <script>window.onload = function() { setTimeout(() => { window.print(); }, 800); }</script>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
  };

  const printLEC2 = () => {
    const levelOrder = ['อ.1', 'อ.2', 'อ.3', 'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'];
    const sorted = [...students].sort((a, b) => {
      const indexA = levelOrder.indexOf(a.class_level); const indexB = levelOrder.indexOf(b.class_level);
      if (indexA !== indexB) return indexA - indexB;
      const roomA = parseInt(a.room) || 0; const roomB = parseInt(b.room) || 0;
      return roomA !== roomB ? roomA - roomB : (a.student_id || '').localeCompare(b.student_id || '');
    });
    const pageSize = 32; const pages = [];
    for (let i = 0; i < sorted.length; i += pageSize) pages.push(sorted.slice(i, i + pageSize));

    const htmlPages = pages.map((pageDocs, pageIdx) => {
      const tableRows = pageDocs.map((s, i) => `
        <tr><td>${toThaiDigits((pageIdx * pageSize) + i + 1)}</td><td>${toThaiDigits(s.student_id || '-')}</td><td style="text-align:left; padding-left: 10px;">${s.prefix || ''}${s.first_name} ${s.last_name}</td><td>${toThaiDigits(s.national_id || '-')}</td><td>${s.class_level.startsWith('อ') ? 'อ.' : 'ป.'}${toThaiDigits(s.class_level.split('.')[1] || '')}/${toThaiDigits(s.room || '1')}</td></tr>
      `).join('');
      
      return `
        <div class="page">
          <div class="lec-code">(แบบ LEC - ${toThaiDigits(2)})</div>
          <div class="header" style="text-align: center;">
            <h3 style="margin:0; font-size: 20pt; font-weight: bold;">แบบรับรองรายชื่อนักเรียนของสถานศึกษาสังกัดหน่วยงานอื่น</h3>
            <p style="margin:2px 0; font-size: 14pt;">เพื่อใช้ในการตรวจสอบและพิจารณาจัดสรรงบประมาณอุดหนุนด้านการศึกษาขององค์กรปกครองส่วนท้องถิ่น</p>
            <p style="margin:2px 0; font-size: 14pt;">ประจำปีการศึกษา ${toThaiDigits(config.academicYear)} (ครั้งที่ ${toThaiDigits(config.term)})</p>
            <p style="margin:2px 0; font-size: 14pt;">${config.schoolName} สังกัด สำนักงานเขตพื้นที่การศึกษาประถมศึกษาพัทลุง เขต ๒</p>
            <p style="margin:2px 0; font-size: 14pt;">เพื่อจัดส่งให้ ${config.localGovName || '................................................'}</p>
          </div>
          <table><thead><tr><th>ลำดับ</th><th>เลขประจำตัว</th><th>คำนำหน้าชื่อ ชื่อ - สกุล</th><th>เลขประชาชน</th><th>ระดับชั้น</th></tr></thead><tbody>${tableRows}</tbody></table>
          
          ${pageIdx === pages.length - 1 ? `
          <div class="footer" style="margin-top: 30px;">
              <div style="display: flex; flex-direction: column; align-items: center; width: 48%;">
                <table class="sign-box-table">
                  <tr><td style="text-align: right; padding-right: 5px;">ลงชื่อ</td><td style="text-align: center; border-bottom: 1px dotted black !important; width: 200px;"></td><td style="text-align: left;">ผู้ให้ข้อมูล</td></tr>
                  <tr><td></td><td style="text-align: center; padding-top: 8px;">( ${config.teacherName || '.........................................................'} )</td><td></td></tr>
                </table>
                <div style="margin-top: 1px;">ตำแหน่ง ครู&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
                <div style="margin-top: 0px;">วันที่ ${toThaiDigits(config.reportDate)}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
                <div style="margin-top: 0px;">เบอร์โทรศัพท์: ${toThaiDigits(config.teacherPhone || '...........................')}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
              </div>
              <div style="display: flex; flex-direction: column; align-items: center; width: 48%;">
                <table class="sign-box-table">
                  <tr><td style="text-align: right; padding-right: 5px;">ลงชื่อ</td><td style="text-align: center; border-bottom: 1px dotted black !important; width: 200px;"></td><td style="text-align: left;">ผู้รับรองข้อมูล</td></tr>
                  <tr><td></td><td style="text-align: center; padding-top: 8px;">( ${config.directorName || '.........................................................'} )</td><td></td></tr>
                </table>
                <div style="margin-top: 1px;">ผู้อำนวยการสถานศึกษา&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
                <div style="margin-top: 0px;">วันที่ ${toThaiDigits(config.reportDate)}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
              </div>
          </div>
          ` : ''}
        </div>
      `;
    }).join('');

    const html = `
      <html>
        <head>
          <title>แบบ LEC-2 ปี ${config.academicYear}</title>
          <style>
            @font-face {
              font-family: 'TH Sarabun New Print';
              src: url(data:font/truetype;charset=utf-8;base64,${FONT_BASE64}) format('truetype');
              font-weight: normal; font-style: normal;
            }
            @font-face {
              font-family: 'TH Sarabun New Print';
              src: url(data:font/truetype;charset=utf-8;base64,${FONT_BOLD_BASE64}) format('truetype');
              font-weight: bold; font-style: normal;
            }
            @media print {
              @page { size: A4; margin: 10mm; }
              body { background: white; }
              .no-print-btn { display: none !important; }
            }
            .sarabun { font-family: 'TH Sarabun New Print', sans-serif; color: black; line-height: 1.2; font-weight: normal; }
            body { background: #f0f0f0; margin: 0; padding: 0; }
            .page { background: white; width: 210mm; min-height: 297mm; padding: 1.2cm 1.5cm; margin: 1cm auto; box-sizing: border-box; page-break-after: always; position: relative; }
            .lec-code { text-align: right; font-weight: bold; font-size: 16pt; margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; font-size: 15pt; margin-top: 10px; }
            th, td { border: 1px solid black !important; padding: 3px 6px !important; text-align: center; font-family: 'TH Sarabun New Print', sans-serif; }
            td { font-weight: normal; }
            th { background: #f8fafc; font-weight: bold; }
            .footer { display: flex; justify-content: space-between; width: 100%; font-size: 15pt; }
            .sign-box-table { border: none !important; margin: 0 0 0 auto; line-height: 1.2; border-spacing: 0; width: auto !important; }
            .sign-box-table td { border: none !important; padding: 1px 2px !important; }
            .no-print-btn { position: fixed; top: 20px; right: 20px; background: #22c55e; color: white; border: none; padding: 12px 24px; border-radius: 12px; cursor: pointer; font-weight: bold; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
          </style>
        </head>
        <body class="sarabun">
          <button class="no-print-btn" onclick="window.print()">🖨️ คลิกเพื่อสั่งพิมพ์</button>
          ${htmlPages}
          <script>window.onload = function() { setTimeout(() => { window.print(); }, 800); }</script>
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
            <button onClick={saveSettings} disabled={isSaving} className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 px-6 py-3 rounded-2xl text-indigo-600 font-bold text-xs transition-all active:scale-95 border border-indigo-100">{isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} บันทึกการตั้งค่า</button>
            <button onClick={fetchStudentData} className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 px-6 py-3 rounded-2xl text-slate-600 font-bold text-xs transition-all active:scale-95"><RefreshCcw size={16} className={loading ? 'animate-spin' : ''} /> รีเฟรชข้อมูล</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
           <div className="space-y-8">
              <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest border-l-4 border-orange-400 pl-3">1. ตั้งค่าปีและเทอม</h4>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">ปีการศึกษาที่พบ</label>
                  <div className="relative"><CalendarDays className="absolute left-4 top-3.5 text-brand-primary" size={18} /><select className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-700 outline-hidden" value={config.academicYear} onChange={e => setConfig({...config, academicYear: e.target.value})}>{availableYears.map(y => <option key={y} value={y}>ปี {y}</option>)}{availableYears.length === 0 && <option value="2568">ปี 2568</option>}</select></div>
                </div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">ครั้งที่ (รอบรายงาน)</label><select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-700 outline-hidden" value={config.term} onChange={e => setConfig({...config, term: e.target.value})}><option value="1">1 (มิถุนายน)</option><option value="2">2 (พฤศจิกายน)</option></select></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">จัดส่งให้หน่วยงาน (อปท.)</label><input type="text" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-hidden" placeholder="เช่น อบต.เขาชัยสน..." value={config.localGovName} onChange={e => setConfig({...config, localGovName: e.target.value})} /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">เบอร์โทรศัพท์ผู้ให้ข้อมูล</label><input type="text" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-hidden" placeholder="เช่น 081-XXX-XXXX" value={config.teacherPhone} onChange={e => setConfig({...config, teacherPhone: e.target.value})} /></div>
              </div>
           </div>
           <div className="space-y-8">
              <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest border-l-4 border-blue-400 pl-3">2. ข้อมูลผู้ลงนามในเอกสาร</h4>
              <div className="space-y-4">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">ชื่อ-สกุล ครูผู้ให้ข้อมูล</label><input type="text" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-hidden" placeholder="ระบุชื่อ-นามสกุล ครู" value={config.teacherName} onChange={e => setConfig({...config, teacherName: e.target.value})} /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">ชื่อ-สกุล ผู้อำนวยการ</label><input type="text" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-hidden" placeholder="ระบุชื่อ-นามสกุล ผู้อำนวยการ" value={config.directorName} onChange={e => setConfig({...config, directorName: e.target.value})} /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">ลงวันที่รายงาน</label><input type="text" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-hidden" value={config.reportDate} onChange={e => setConfig({...config, reportDate: e.target.value})} /></div>
              </div>
           </div>
        </div>
        <div className="mt-12 flex flex-col sm:flex-row gap-4 pt-10 border-t border-slate-100">
           <button onClick={printLEC1} disabled={loading || students.length === 0} className="flex-1 bg-brand-primary text-white py-5 rounded-[24px] font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-green-100 hover:bg-green-700 transition-all disabled:opacity-50 active:scale-95"><Printer size={24} /> พิมพ์รายงานสรุปจำนวน (LEC - 1)</button>
           <button onClick={printLEC2} disabled={loading || students.length === 0} className="flex-1 bg-white text-brand-primary border-2 border-brand-primary/20 py-5 rounded-[24px] font-black text-lg flex items-center justify-center gap-3 hover:bg-green-50 transition-all disabled:opacity-50 active:scale-95"><Users size={24} /> พิมพ์รายชื่อนักเรียน (LEC - 2)</button>
        </div>
        {students.length === 0 && !loading && <div className="mt-8 flex items-center gap-3 bg-red-50 p-6 rounded-3xl border border-red-100 text-red-600 text-sm font-bold"><AlertCircle size={20} className="shrink-0" /><span>ไม่พบนักเรียนที่มีสถานะ "กำลังศึกษา" ในปี {config.academicYear} กรุณาตรวจสอบปีการศึกษาหรือนำเข้า DMC อีกครั้ง</span></div>}
      </div>
      <div className="bg-gradient-to-br from-blue-900 to-indigo-950 rounded-[40px] p-12 text-white relative overflow-hidden shadow-2xl">
         <div className="relative z-10">
            <h3 className="text-3xl font-black tracking-tight mb-2">สรุปสถิติจริงในฐานข้อมูล</h3>
            <p className="text-blue-300 font-bold uppercase tracking-widest text-xs opacity-80">ปีการศึกษา {config.academicYear} | รวมนักเรียนที่กำลังเรียนอยู่</p>
            <div className="flex flex-wrap gap-12 mt-10">
               <div><p className="text-6xl font-black tracking-tighter">{students.length}</p><p className="text-[10px] font-black text-blue-400 uppercase mt-2 tracking-widest">นักเรียนทั้งหมด (คน)</p></div>
               <div className="w-px h-16 bg-white/10 self-center hidden sm:block"></div>
               <div><p className="text-6xl font-black tracking-tighter text-orange-400">{students.filter(s => checkIsMale(s)).length}</p><p className="text-[10px] font-black text-blue-400 uppercase mt-2 tracking-widest">นักเรียนชาย</p></div>
               <div className="w-px h-16 bg-white/10 self-center hidden sm:block"></div>
               <div><p className="text-6xl font-black tracking-tighter text-teal-400">{students.filter(s => !checkIsMale(s)).length}</p><p className="text-[10px] font-black text-blue-400 uppercase mt-2 tracking-widest">นักเรียนหญิง</p></div>
            </div>
         </div>
         <Users size={280} className="absolute right-[-40px] bottom-[-60px] opacity-5 rotate-12" />
      </div>
    </div>
  );
}
