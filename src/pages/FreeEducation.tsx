import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Printer as PrinterIcon, 
  Users as UsersIcon, 
  CreditCard as CreditCardIcon, 
  Loader2 as Loader2Icon,
  Filter as FilterIcon
} from 'lucide-react';

interface Student {
  id: string;
  prefix: string;
  first_name: string;
  last_name: string;
  class_level: string;
  room: string;
  academic_year: string;
  parent_phone?: string;
}

const FreeEducation = () => {
  const [semester, setSemester] = useState('1');
  const [academicYear, setAcademicYear] = useState('');
  const [selectedClass, setSelectedClass] = useState('ทั้งหมด');
  const [selectedRoom, setSelectedRoom] = useState('ทั้งหมด');
  const [meetingDate, setMeetingDate] = useState('.......... พฤษภาคม ๒๕๖๘');
  const [schoolName, setSchoolName] = useState('โรงเรียนบ้านควนโคกยา');
  const [directorName, setDirectorName] = useState('');
  const [payerName, setPayerName] = useState('');
  const [paymentType, setPaymentType] = useState<'all' | 'uniform' | 'materials'>('all');
  const [payers, setPayers] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('free_education_payers');
    return saved ? JSON.parse(saved) : {};
  });
  const [activeView, setActiveView] = useState<'registration' | 'payment'>('registration');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  const [amounts, setAmounts] = useState(() => {
    const saved = localStorage.getItem('free_education_amounts');
    return saved ? JSON.parse(saved) : {
      preschool: { uniform: 300, materials: 145 },
      primary: { uniform: 360, materials: 195 }
    };
  });

  const saveAmounts = () => {
    localStorage.setItem('free_education_amounts', JSON.stringify(amounts));
    localStorage.setItem('free_education_payers', JSON.stringify(payers));
    alert('บันทึกการตั้งค่าจำนวนเงินและรายชื่อผู้จ่ายเงินเรียบร้อยแล้ว');
  };

  useEffect(() => {
    if (selectedClass !== 'ทั้งหมด') {
      setPayerName(payers[selectedClass] || '');
    } else {
      setPayerName('');
    }
  }, [selectedClass, payers]);

  const handlePayerChange = (name: string) => {
    setPayerName(name);
    if (selectedClass !== 'ทั้งหมด') {
      setPayers(prev => ({ ...prev, [selectedClass]: name }));
    }
  };

  useEffect(() => {
    async function fetchSettings() {
      const { data } = await supabase.from('settings').select('school_name, current_academic_year, director_name').single();
      if (data?.school_name) setSchoolName(data.school_name);
      if (data?.current_academic_year) setAcademicYear(data.current_academic_year);
      if (data?.director_name) setDirectorName(data.director_name);
    }
    fetchSettings();
  }, []);

  useEffect(() => {
    if (academicYear) {
      fetchStudents();
    }
  }, [academicYear, selectedClass, selectedRoom]);

  const fetchStudents = async () => {
    if (!academicYear) return;
    setLoading(true);
    try {
      let query = supabase
        .from('students')
        .select('*')
        .eq('academic_year', academicYear.toString())
        .order('class_level', { ascending: true })
        .order('room', { ascending: true })
        .order('first_name', { ascending: true });

      if (selectedClass !== 'ทั้งหมด') {
        query = query.eq('class_level', selectedClass);
      }
      
      if (selectedRoom !== 'ทั้งหมด') {
        query = query.eq('room', selectedRoom);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const filteredData = (data || []).filter(s => 
        !s.graduation_status || 
        s.graduation_status.includes('กำลังศึกษา') || 
        s.graduation_status === 'ปกติ'
      );

      const mappedData = filteredData.map(s => ({
        ...s,
        parent_phone: s.phone_number || s.parent_phone || ''
      }));

      const uniqueData = Array.from(new Map(mappedData.map(s => [s.student_id || s.id, s])).values());
      setStudents(uniqueData as Student[]);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  const toThaiDigits = (num: string | number) => {
    if (!num) return '';
    const thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
    return num.toString().split('').map(d => isNaN(parseInt(d)) ? d : thaiDigits[parseInt(d)]).join('');
  };

  const formatClassThai = (classLevel: string, room: string) => {
    if (!classLevel) return '';
    const match = classLevel.match(/([ก-ฮ]\.)(\d+)/);
    if (match) {
      return `${match[1]}${toThaiDigits(match[2])}/${toThaiDigits(room || '1')}`;
    }
    return `${toThaiDigits(classLevel)}/${toThaiDigits(room || '1')}`;
  };

  const getStudentAmounts = (classLevel: string) => {
    if (!classLevel) return { uniform: 0, materials: 0, total: 0 };
    if (classLevel.startsWith('อ')) {
      return {
        uniform: amounts.preschool.uniform,
        materials: amounts.preschool.materials,
        total: amounts.preschool.uniform + amounts.preschool.materials
      };
    }
    return {
      uniform: amounts.primary.uniform,
      materials: amounts.primary.materials,
      total: amounts.primary.uniform + amounts.primary.materials
    };
  };

  const calculateGrandTotal = () => {
    return students.reduce((sum, s) => {
      const amounts = getStudentAmounts(s.class_level);
      if (paymentType === 'uniform') return sum + amounts.uniform;
      if (paymentType === 'materials') return sum + amounts.materials;
      return sum + amounts.total;
    }, 0);
  };

  const bahttext = (amount: number) => {
    if (isNaN(amount) || amount === 0) return 'ศูนย์บาทถ้วน';
    const thaiNum = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const thaiUnit = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    const convert = (numStr: string) => {
      let subResult = '';
      const n = numStr.length;
      for (let i = 0; i < n; i++) {
        const d = parseInt(numStr[i]);
        const pos = n - 1 - i;
        if (d !== 0) {
          if (pos % 6 === 1 && d === 1) subResult += '';
          else if (pos % 6 === 1 && d === 2) subResult += 'ยี่';
          else if (pos % 6 === 0 && d === 1 && i > 0 && n > 1) subResult += 'เอ็ด';
          else subResult += thaiNum[d];
          subResult += thaiUnit[pos % 6];
        }
        if (pos !== 0 && pos % 6 === 0) subResult += 'ล้าน';
      }
      return subResult;
    };
    let [integer, fractional] = amount.toFixed(2).split('.');
    let result = convert(integer) + 'บาท';
    if (parseInt(fractional) === 0) result += 'ถ้วน';
    else result += convert(fractional) + 'สตางค์';
    return result;
  };

  const handlePrint = () => {
    const isPayment = activeView === 'payment';
    const totalAmount = calculateGrandTotal();
    
    // Dynamic Title and Headers based on paymentType
    let docTitle = isPayment ? 'แบบหลักฐานการจ่ายเงินอุดหนุนค่าเครื่องแบบนักเรียน และอุปกรณ์การเรียน' : 'ใบลงทะเบียนเข้าร่วมประชุมผู้ปกครอง';
    if (isPayment) {
      if (paymentType === 'uniform') docTitle = 'แบบหลักฐานการจ่ายเงินอุดหนุนค่าเครื่องแบบนักเรียน';
      if (paymentType === 'materials') docTitle = 'แบบหลักฐานการจ่ายเงินอุดหนุนค่าอุปกรณ์การเรียน';
    }

    const tableRows = students.map((student, i) => {
      const studentAmounts = getStudentAmounts(student.class_level);
      if (!isPayment) {
        return `
          <tr>
            <td style="text-align:center;">${toThaiDigits(i + 1)}</td>
            <td style="text-align:left; white-space:nowrap;">${student.prefix}${student.first_name} ${student.last_name}</td>
            <td style="text-align:center;">${formatClassThai(student.class_level, student.room)}</td>
            <td></td>
            <td></td>
            <td style="text-align:center;">${toThaiDigits(student.parent_phone || '')}</td>
            <td></td>
          </tr>
        `;
      }

      // Payment Rows - Dynamic columns
      let amountCols = '';
      if (paymentType === 'all') {
        amountCols = `
          <td style="text-align:right;">${toThaiDigits(studentAmounts.uniform.toLocaleString())}</td>
          <td style="text-align:right;">${toThaiDigits(studentAmounts.materials.toLocaleString())}</td>
          <td style="text-align:right;">${toThaiDigits(studentAmounts.total.toLocaleString())}</td>
        `;
      } else if (paymentType === 'uniform') {
        amountCols = `<td style="text-align:right;">${toThaiDigits(studentAmounts.uniform.toLocaleString())}</td>`;
      } else {
        amountCols = `<td style="text-align:right;">${toThaiDigits(studentAmounts.materials.toLocaleString())}</td>`;
      }

      return `
        <tr>
          <td style="text-align:center;">${toThaiDigits(i + 1)}</td>
          <td style="text-align:left; white-space:nowrap;">${student.prefix}${student.first_name} ${student.last_name}</td>
          <td style="text-align:center;">${formatClassThai(student.class_level, student.room)}</td>
          ${amountCols}
          <td style="text-align:center;"></td>
          <td></td>
          <td></td>
        </tr>
      `;
    }).join('');

    const headerRow = !isPayment ? `
      <tr>
        <th style="width: 25px;">ที่</th>
        <th style="width: 160px;">ชื่อ - สกุล นักเรียน</th>
        <th style="width: 50px;">ชั้น</th>
        <th style="width: 240px;">ชื่อ - สกุล ผู้ปกครอง</th>
        <th style="width: 65px;">ความสัมพันธ์</th>
        <th style="width: 120px;">เบอร์โทรศัพท์</th>
        <th style="width: 100px;">ลายมือชื่อ</th>
      </tr>
    ` : `
      <tr>
        <th ${paymentType === 'all' ? 'rowspan="2"' : ''} style="width: 25px;">ที่</th>
        <th ${paymentType === 'all' ? 'rowspan="2"' : ''} style="width: 210px;">ชื่อ - สกุล นักเรียน</th>
        <th ${paymentType === 'all' ? 'rowspan="2"' : ''} style="width: 50px;">ชั้น</th>
        <th ${paymentType === 'all' ? 'colspan="2"' : ''}>รายการที่ได้รับเงิน (บาท)</th>
        ${paymentType === 'all' ? '<th rowspan="2" style="width: 70px;">รวมเงิน<br/>(บาท)</th>' : ''}
        <th ${paymentType === 'all' ? 'rowspan="2"' : ''} style="width: 120px;">วัน/เดือน/ปี<br/>ที่รับเงิน</th>
        <th ${paymentType === 'all' ? 'rowspan="2"' : ''} style="width: 180px;">ลายมือชื่อผู้รับเงิน<br/>(ผู้ปกครอง)</th>
        <th ${paymentType === 'all' ? 'rowspan="2"' : ''} style="width: 50px;">หมายเหตุ</th>
      </tr>
      ${paymentType === 'all' ? `
        <tr>
          <th style="width: 60px;">เครื่องแบบ</th>
          <th style="width: 60px;">อุปกรณ์</th>
        </tr>
      ` : ''}
    `;

    const footerTotal = isPayment && students.length > 0 ? `
      <tr style="font-weight:bold; background:#f8fafc;">
        <td colspan="${paymentType === 'all' ? 5 : 3}" style="text-align:right;">รวมเป็นเงินทั้งสิ้น</td>
        <td style="text-align:right;">${toThaiDigits(totalAmount.toLocaleString())}</td>
        <td colspan="3" style="text-align:left;">บาท</td>
      </tr>
    ` : '';

    const html = `
      <html>
        <head>
          <title>${docTitle} - ${selectedClass}</title>
          <style>
            @media print {
              @page { size: A4; margin: 15mm 5mm 5mm 5mm; }
              body { background: white; margin: 0; padding: 0; }
              .no-print-btn { display: none !important; }
              .page { margin: 0 !important; box-shadow: none !important; width: 100% !important; height: auto !important; min-height: 0 !important; padding: 0 !important; }
            }
            .sarabun { font-family: 'TH Sarabun New', 'THSarabunNew', sans-serif; color: black; line-height: 1.1; }
            body { background: #f0f0f0; margin: 0; padding: 0; }
            .page { 
              background: white; width: 210mm; min-height: 297mm; 
              padding: 15mm 15mm 15mm 15mm; margin: 1cm auto; box-sizing: border-box; 
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              overflow: hidden;
            }
            .header { text-align: center; line-height: 1.1; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: auto; }
            th, td { border: 1px solid black !important; padding: 2px 4px !important; line-height: 1.1 !important; font-size: 14pt; }
            th { background: #f8fafc; font-weight: bold; text-align: center; vertical-align: middle; }
            .td-name { white-space: nowrap !important; text-align: left !important; }
            
            .footer-area { margin-top: 15px; font-size: 14pt; }
            .sign-block { display: flex; flex-direction: column; align-items: center; text-align: center; width: 100%; }
            .sign-line { display: flex; align-items: center; justify-content: center; width: 100%; white-space: nowrap; margin-bottom: 2px; }
            .sign-name { width: 100%; white-space: nowrap; margin-top: 2px; text-align: center; }

            .no-print-btn { 
              position: fixed; top: 20px; right: 20px; 
              background: #2563eb; color: white; border: none; 
              padding: 12px 24px; border-radius: 12px; cursor: pointer;
              font-weight: bold; font-family: sans-serif;
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
              z-index: 9999;
            }
          </style>
        </head>
        <body class="sarabun">
          <button class="no-print-btn" onclick="window.print()">🖨️ คลิกที่นี่เพื่อสั่งพิมพ์</button>
          <div class="page">
            ${!isPayment ? `
              <div class="header">
                <h1 style="font-size: 20pt; font-weight: bold; margin: 0;">${docTitle}</h1>
                <h2 style="font-size: 16pt; font-weight: normal; margin: 2px 0;">
                  ภาคเรียนที่ ${toThaiDigits(semester)} ปีการศึกษา ${toThaiDigits(academicYear)} 
                  ${selectedClass !== 'ทั้งหมด' ? ` (ชั้น ${selectedClass})` : ''}
                </h2>
                <h2 style="font-size: 16pt; font-weight: normal; margin: 2px 0;">ณ ห้องประชุม${schoolName}</h2>
                <p style="font-size: 15pt; margin-top: 2px;">วันที่ ${toThaiDigits(meetingDate)}</p>
              </div>
              <table>
                <thead>
                  ${headerRow}
                </thead>
                <tbody>
                  ${tableRows}
                </tbody>
              </table>
              <div class="footer-area">
                <div style="display: flex; justify-content: flex-end; margin-top: 1.2cm;">
                  <div style="width: 350px;">
                    <div class="sign-block">
                      <div class="sign-line">
                        <span>ลงชื่อ</span>
                        <span style="padding: 0 5px;">...........................................................</span>
                        <span>ครูประจำชั้น</span>
                      </div>
                      <div class="sign-name">( ........................................................... )</div>
                    </div>
                  </div>
                </div>
              </div>
            ` : `
              <div class="header">
                <h1 style="font-size: 18pt; font-weight: bold; margin: 0;">${docTitle}</h1>
                <h2 style="font-size: 16pt; font-weight: normal; margin: 2px 0;">โครงการสนับสนุนค่าใช้จ่ายในการจัดการศึกษาตั้งแต่ระดับอนุบาลจนจบการศึกษาขั้นพื้นฐาน</h2>
                <h2 style="font-size: 16pt; font-weight: normal; margin: 2px 0;">
                  ภาคเรียนที่ ${toThaiDigits(semester)} ปีการศึกษา ${toThaiDigits(academicYear)}
                  ${selectedClass !== 'ทั้งหมด' ? ` (ชั้น ${selectedClass})` : ''}
                </h2>
                <h2 style="font-size: 16pt; font-weight: normal; margin: 2px 0;">${schoolName}</h2>
              </div>
              <table>
                <thead>
                  ${headerRow}
                </thead>
                <tbody>
                  ${tableRows}
                  ${footerTotal}
                </tbody>
              </table>
              <div class="footer-area">
                <p style="margin: 5px 0;">รวมเงินตัวอักษร (${bahttext(totalAmount)})</p>
                <div style="display: flex; justify-content: flex-start; margin-top: 0.8cm; gap: 60px; padding-left: 10px;">
                  <div>
                    <div class="sign-block" style="align-items: flex-start;">
                      <div class="sign-line" style="justify-content: flex-start;">
                        <span>ลงชื่อ</span>
                        <span style="padding: 0 5px;">...........................................................</span>
                        <span>ผู้จ่ายเงิน</span>
                      </div>
                      <div class="sign-name" style="text-align: left; padding-left: 35px;">( ${payerName || '...........................................................'} )</div>
                    </div>
                  </div>
                  <div>
                    <div class="sign-block" style="align-items: flex-start;">
                      <div class="sign-line" style="justify-content: flex-start;">
                        <span>ลงชื่อ</span>
                        <span style="padding: 0 5px;">...........................................................</span>
                        <span style="white-space: nowrap;">ผู้อำนวยการสถานศึกษา</span>
                      </div>
                      <div class="sign-name" style="text-align: left; padding-left: 45px;">( ${directorName || '...........................................................'} )</div>
                    </div>
                  </div>
                </div>
              </div>
            `}
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

  const classOptions = [
    'ทั้งหมด', 'อ.1', 'อ.2', 'อ.3', 
    'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">ภาคเรียน</label>
            <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary">
              <option value="1">ภาคเรียนที่ ๑</option>
              <option value="2">ภาคเรียนที่ ๒</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">ปีการศึกษา</label>
            <input type="number" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
              <FilterIcon size={12} /> ระดับชั้น
            </label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary">
              {classOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
              <FilterIcon size={12} /> ห้อง
            </label>
            <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary">
              <option value="ทั้งหมด">ทั้งหมด</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">ชื่อผู้จ่ายเงิน</label>
            <input type="text" value={payerName} onChange={(e) => handlePayerChange(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary" placeholder="ชื่อ-สกุล ผู้จ่ายเงิน" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">รายการจ่ายเงิน</label>
            <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as any)} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary">
              <option value="all">ทั้งหมด (เครื่องแบบ + อุปกรณ์)</option>
              <option value="uniform">เฉพาะค่าเครื่องแบบนักเรียน</option>
              <option value="materials">เฉพาะค่าอุปกรณ์การเรียน</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">วันที่ประชุม/จ่ายเงิน</label>
            <input type="text" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary" placeholder="เช่น .......... พฤษภาคม ๒๕๖๘" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
          <div className="space-y-4">
            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 bg-blue-500 rounded-full"></div> ระดับปฐมวัย (อนุบาล)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">ค่าเครื่องแบบ</label>
                <input type="number" value={amounts.preschool.uniform} onChange={(e) => setAmounts({...amounts, preschool: {...amounts.preschool, uniform: parseInt(e.target.value) || 0}})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">ค่าอุปกรณ์</label>
                <input type="number" value={amounts.preschool.materials} onChange={(e) => setAmounts({...amounts, preschool: {...amounts.preschool, materials: parseInt(e.target.value) || 0}})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold" />
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full"></div> ระดับประถมศึกษา</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">ค่าเครื่องแบบ</label>
                <input type="number" value={amounts.primary.uniform} onChange={(e) => setAmounts({...amounts, primary: {...amounts.primary, uniform: parseInt(e.target.value) || 0}})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">ค่าอุปกรณ์</label>
                <input type="number" value={amounts.primary.materials} onChange={(e) => setAmounts({...amounts, primary: {...amounts.primary, materials: parseInt(e.target.value) || 0}})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold" />
              </div>
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button onClick={saveAmounts} className="bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all">บันทึกการตั้งค่าจำนวนเงิน</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t border-slate-50">
          <div className="flex gap-2">
            <button onClick={() => setActiveView('registration')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${activeView === 'registration' ? 'bg-brand-primary text-white shadow-lg shadow-green-100' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}><UsersIcon size={18} /> ใบลงทะเบียน</button>
            <button onClick={() => setActiveView('payment')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${activeView === 'payment' ? 'bg-brand-primary text-white shadow-lg shadow-green-100' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}><CreditCardIcon size={18} /> แบบหลักฐานการจ่ายเงิน</button>
          </div>
          <button onClick={handlePrint} disabled={loading} className="ml-auto flex items-center gap-2 bg-slate-800 text-white px-8 py-3 rounded-2xl font-bold text-sm hover:bg-slate-700 transition-all shadow-lg shadow-slate-200 disabled:opacity-50">
            {loading ? <Loader2Icon className="animate-spin" size={18} /> : <PrinterIcon size={18} />} พิมพ์เอกสาร ({students.length} รายชื่อ)
          </button>
        </div>
      </div>

      <div className="flex justify-center bg-slate-100 p-8 min-h-screen overflow-x-auto print:hidden">
        <div className="bg-white shadow-2xl w-[210mm] min-h-[297mm] p-[15mm] box-border relative text-black" style={{ fontFamily: "'TH Sarabun New', 'THSarabunNew', sans-serif" }}>
          <div className="sarabun">
            {activeView === 'registration' ? (
              <>
                <div className="text-center mb-6 leading-tight">
                  <h1 className="text-[20pt] font-bold">ใบลงทะเบียนเข้าร่วมประชุมผู้ปกครอง</h1>
                  <h2 className="text-[17pt]">ภาคเรียนที่ {toThaiDigits(semester)} ปีการศึกษา {toThaiDigits(academicYear)} {selectedClass !== 'ทั้งหมด' && ` (ชั้น ${selectedClass})`}</h2>
                  <h2 className="text-[17pt]">ณ ห้องประชุม{schoolName}</h2>
                  <p className="text-[15pt] mt-2">วันที่ {toThaiDigits(meetingDate)}</p>
                </div>
                <table className="w-full border-collapse border border-black table-auto">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border border-black p-1 text-[15pt] w-12 text-center">ที่</th>
                      <th className="border border-black p-1 text-[15pt] w-[180px]">ชื่อ - สกุล นักเรียน</th>
                      <th className="border border-black p-1 text-[15pt] w-16 text-center">ชั้น</th>
                      <th className="border border-black p-1 text-[15pt]">ชื่อ - สกุล ผู้ปกครอง</th>
                      <th className="border border-black p-1 text-[15pt] w-24 text-center">ความสัมพันธ์</th>
                      <th className="border border-black p-1 text-[15pt] w-32 text-center">เบอร์โทรศัพท์</th>
                      <th className="border border-black p-1 text-[15pt] w-28 text-center">ลายมือชื่อ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, i) => (
                      <tr key={student.id}>
                        <td className="border border-black p-1 text-[15pt] text-center">{toThaiDigits(i + 1)}</td>
                        <td className="border border-black p-1 text-[15pt] whitespace-nowrap">{student.prefix}{student.first_name} {student.last_name}</td>
                        <td className="border border-black p-1 text-[15pt] text-center whitespace-nowrap">{formatClassThai(student.class_level, student.room)}</td>
                        <td className="border border-black p-1 text-[15pt]"></td>
                        <td className="border border-black p-1 text-[15pt]"></td>
                        <td className="border border-black p-1 text-[15pt] text-center">{toThaiDigits(student.parent_phone || '')}</td>
                        <td className="border border-black p-1 text-[15pt]"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <>
                <div className="text-center mb-6 leading-tight">
                  <h1 className="text-[18pt] font-bold">
                    {paymentType === 'all' ? 'แบบหลักฐานการจ่ายเงินอุดหนุนค่าเครื่องแบบนักเรียน และอุปกรณ์การเรียน' : 
                     paymentType === 'uniform' ? 'แบบหลักฐานการจ่ายเงินอุดหนุนค่าเครื่องแบบนักเรียน' : 
                     'แบบหลักฐานการจ่ายเงินอุดหนุนค่าอุปกรณ์การเรียน'}
                  </h1>
                  <h2 className="text-[16pt]">โครงการสนับสนุนค่าใช้จ่ายในการจัดการศึกษาตั้งแต่ระดับอนุบาลจนจบการศึกษาขั้นพื้นฐาน</h2>
                  <h2 className="text-[16pt]">ภาคเรียนที่ {toThaiDigits(semester)} ปีการศึกษา {toThaiDigits(academicYear)} {selectedClass !== 'ทั้งหมด' && ` (ชั้น ${selectedClass})`}</h2>
                  <h2 className="text-[16pt]">{schoolName}</h2>
                </div>
                <table className="w-full border-collapse border border-black table-auto">
                  <thead>
                    <tr className="bg-slate-50">
                      <th rowSpan={paymentType === 'all' ? 2 : 1} className="border border-black p-1 text-[14pt] w-10 text-center">ที่</th>
                      <th rowSpan={paymentType === 'all' ? 2 : 1} className="border border-black p-1 text-[14pt] w-[180px]">ชื่อ - สกุล นักเรียน</th>
                      <th rowSpan={paymentType === 'all' ? 2 : 1} className="border border-black p-1 text-[14pt] w-16 text-center">ชั้น</th>
                      <th colSpan={paymentType === 'all' ? 2 : 1} className="border border-black p-1 text-[14pt] text-center">รายการที่ได้รับเงิน (บาท)</th>
                      {paymentType === 'all' && <th rowSpan={2} className="border border-black p-1 text-[14pt] w-20 text-center">รวมเงิน<br/>(บาท)</th>}
                      <th rowSpan={paymentType === 'all' ? 2 : 1} className="border border-black p-1 text-[14pt] w-32 text-center">วัน/เดือน/ปี<br/>ที่รับเงิน</th>
                      <th rowSpan={paymentType === 'all' ? 2 : 1} className="border border-black p-1 text-[14pt] w-32 text-center">ลายมือชื่อผู้รับเงิน<br/>(ผู้ปกครอง)</th>
                      <th rowSpan={paymentType === 'all' ? 2 : 1} className="border border-black p-1 text-[14pt] w-16 text-center">หมายเหตุ</th>
                    </tr>
                    {paymentType === 'all' && (
                      <tr className="bg-slate-50">
                        <th className="border border-black p-1 text-[14pt] w-16 text-center">เครื่องแบบ</th>
                        <th className="border border-black p-1 text-[14pt] w-16 text-center">อุปกรณ์</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {students.map((student, i) => {
                      const studentAmounts = getStudentAmounts(student.class_level);
                      return (
                        <tr key={student.id}>
                          <td className="border border-black p-1 text-[15pt] text-center">{toThaiDigits(i + 1)}</td>
                          <td className="border border-black p-1 text-[15pt] whitespace-nowrap">{student.prefix}{student.first_name} {student.last_name}</td>
                          <td className="border border-black p-1 text-[15pt] text-center whitespace-nowrap">{formatClassThai(student.class_level, student.room)}</td>
                          
                          {paymentType === 'all' ? (
                            <>
                              <td className="border border-black p-1 text-[15pt] text-right">{toThaiDigits(studentAmounts.uniform.toLocaleString())}</td>
                              <td className="border border-black p-1 text-[15pt] text-right">{toThaiDigits(studentAmounts.materials.toLocaleString())}</td>
                              <td className="border border-black p-1 text-[15pt] text-right">{toThaiDigits(studentAmounts.total.toLocaleString())}</td>
                            </>
                          ) : paymentType === 'uniform' ? (
                            <td className="border border-black p-1 text-[15pt] text-right">{toThaiDigits(studentAmounts.uniform.toLocaleString())}</td>
                          ) : (
                            <td className="border border-black p-1 text-[15pt] text-right">{toThaiDigits(studentAmounts.materials.toLocaleString())}</td>
                          )}

                          <td className="border border-black p-1 text-[15pt] text-center"></td>
                          <td className="border border-black p-1 text-[15pt]"></td>
                          <td className="border border-black p-1 text-[15pt]"></td>
                        </tr>
                      );
                    })}
                    {students.length > 0 && (
                      <tr className="font-bold bg-slate-50">
                        <td colSpan={paymentType === 'all' ? 5 : 3} className="border border-black p-1 text-[15pt] text-right">รวมเป็นเงินทั้งสิ้น</td>
                        <td className="border border-black p-1 text-[15pt] text-right">{toThaiDigits(calculateGrandTotal().toLocaleString())}</td>
                        <td colSpan={3} className="border border-black p-1 text-[15pt]">บาท</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FreeEducation;
