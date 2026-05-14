import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Printer, Users, CreditCard, Loader2, Filter } from 'lucide-react';

interface Student {
  id: string;
  prefix: string;
  first_name: string;
  last_name: string;
  class_level: string;
  room: string;
  academic_year: string;
}

const FreeEducation = () => {
  const [semester, setSemester] = useState('1');
  const [academicYear, setAcademicYear] = useState('');
  const [selectedClass, setSelectedClass] = useState('ทั้งหมด');
  const [selectedRoom, setSelectedRoom] = useState('ทั้งหมด');
  const [meetingDate, setMeetingDate] = useState('.......... พฤษภาคม ๒๕๖๘');
  const [schoolName, setSchoolName] = useState('โรงเรียนบ้านควนโคกยา');
  const [directorName, setDirectorName] = useState('');
  const [activeView, setActiveView] = useState<'registration' | 'payment'>('registration');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  // Amounts Config
  const [amounts, setAmounts] = useState({
    preschool: { uniform: 300, materials: 145 },
    primary: { uniform: 360, materials: 195 }
  });

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
    setLoading(true);
    try {
      let query = supabase
        .from('students')
        .select('*')
        .eq('academic_year', academicYear)
        .or('graduation_status.ilike.%กำลังศึกษา%,graduation_status.eq.ปกติ')
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
      
      // Deduplicate by student_id or national_id if they exist
      const uniqueData = data ? Array.from(new Map(data.map(s => [s.student_id || s.id, s])).values()) : [];
      setStudents(uniqueData as Student[]);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  const toThaiDigits = (num: string | number) => {
    const thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
    return num.toString().split('').map(d => isNaN(parseInt(d)) ? d : thaiDigits[parseInt(d)]).join('');
  };

  const getStudentAmounts = (classLevel: string) => {
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
    return students.reduce((sum, s) => sum + getStudentAmounts(s.class_level).total, 0);
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
    
    if (parseInt(fractional) === 0) {
      result += 'ถ้วน';
    } else {
      result += convert(fractional) + 'สตางค์';
    }
    
    return result;
  };

  const handlePrint = () => {
    window.print();
  };

  const classOptions = [
    'ทั้งหมด', 'อ.1', 'อ.2', 'อ.3', 
    'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'
  ];

  return (
    <div className="space-y-6">
      {/* Control Panel (Hidden during print) */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">ภาคเรียน</label>
            <select 
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary"
            >
              <option value="1">ภาคเรียนที่ ๑</option>
              <option value="2">ภาคเรียนที่ ๒</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">ปีการศึกษา</label>
            <input 
              type="number"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
              <Filter size={12} /> ระดับชั้น
            </label>
            <select 
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary"
            >
              {classOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
              <Filter size={12} /> ห้อง
            </label>
            <select 
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary"
            >
              <option value="ทั้งหมด">ทั้งหมด</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">วันที่ประชุม/จ่ายเงิน</label>
            <input 
              type="text"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary"
              placeholder="เช่น .......... พฤษภาคม ๒๕๖๘"
            />
          </div>
        </div>

        {/* Amounts Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
          <div className="space-y-4">
            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div> ระดับปฐมวัย (อนุบาล)
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">ค่าเครื่องแบบ</label>
                <input 
                  type="number" 
                  value={amounts.preschool.uniform}
                  onChange={(e) => setAmounts({...amounts, preschool: {...amounts.preschool, uniform: parseInt(e.target.value) || 0}})}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">ค่าอุปกรณ์</label>
                <input 
                  type="number" 
                  value={amounts.preschool.materials}
                  onChange={(e) => setAmounts({...amounts, preschool: {...amounts.preschool, materials: parseInt(e.target.value) || 0}})}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div> ระดับประถมศึกษา
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">ค่าเครื่องแบบ</label>
                <input 
                  type="number" 
                  value={amounts.primary.uniform}
                  onChange={(e) => setAmounts({...amounts, primary: {...amounts.primary, uniform: parseInt(e.target.value) || 0}})}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">ค่าอุปกรณ์</label>
                <input 
                  type="number" 
                  value={amounts.primary.materials}
                  onChange={(e) => setAmounts({...amounts, primary: {...amounts.primary, materials: parseInt(e.target.value) || 0}})}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t border-slate-50">
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveView('registration')}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${activeView === 'registration' ? 'bg-brand-primary text-white shadow-lg shadow-green-100' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
            >
              <Users size={18} /> ใบลงทะเบียน
            </button>
            <button 
              onClick={() => setActiveView('payment')}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${activeView === 'payment' ? 'bg-brand-primary text-white shadow-lg shadow-green-100' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
            >
              <CreditCard size={18} /> แบบหลักฐานการจ่ายเงิน
            </button>
          </div>

          <button 
            onClick={handlePrint}
            disabled={loading}
            className="ml-auto flex items-center gap-2 bg-slate-800 text-white px-8 py-3 rounded-2xl font-bold text-sm hover:bg-slate-700 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Printer size={18} />}
            พิมพ์เอกสาร ({students.length} รายชื่อ)
          </button>
        </div>
      </div>

      {/* Document Preview (Print Area) */}
      <div className="flex justify-center bg-slate-100 p-8 min-h-screen overflow-x-auto print:bg-white print:p-0 print:block">
        <div className="bg-white shadow-2xl print:shadow-none w-[210mm] min-h-[297mm] p-[15mm] box-border relative text-black">
          
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page { size: A4; margin: 10mm; }
              body { background: none; }
              .print-hidden { display: none !important; }
            }
            .sarabun { font-family: 'TH Sarabun New', 'THSarabunNew', sans-serif; }
            table td, table th { border: 1px solid black !important; padding: 4px 8px !important; line-height: 1.2 !important; }
          `}} />

          <div className="sarabun">
            {activeView === 'registration' ? (
              <>
                <div className="text-center mb-6 leading-tight">
                  <h1 className="text-[22pt] font-bold">ใบลงทะเบียนเข้าร่วมประชุมผู้ปกครอง</h1>
                  <h2 className="text-[18pt]">
                    ภาคเรียนที่ {toThaiDigits(semester)} ปีการศึกษา {toThaiDigits(academicYear)} 
                    {selectedClass !== 'ทั้งหมด' && ` (ชั้น ${selectedClass})`}
                  </h2>
                  <h2 className="text-[18pt]">ณ ห้องประชุม{schoolName}</h2>
                  <p className="text-[16pt] mt-2">วันที่ {meetingDate}</p>
                </div>

                <table className="w-full border-collapse border border-black">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="p-1 text-[16pt] w-12 text-center">ที่</th>
                      <th className="p-1 text-[16pt] w-[20%]">ชื่อ - สกุล นักเรียน</th>
                      <th className="p-1 text-[16pt] w-16 text-center">ชั้น</th>
                      <th className="p-1 text-[16pt] w-[28%]">ชื่อ - สกุล ผู้ปกครอง</th>
                      <th className="p-1 text-[16pt] w-24 text-center">ความสัมพันธ์</th>
                      <th className="p-1 text-[16pt] w-28 text-center">เบอร์โทรศัพท์</th>
                      <th className="p-1 text-[16pt] w-32 text-center">ลายมือชื่อ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, i) => (
                      <tr key={student.id}>
                        <td className="p-2 text-[16pt] text-center">{toThaiDigits(i + 1)}</td>
                        <td className="p-2 text-[16pt] whitespace-nowrap">{student.prefix}{student.first_name} {student.last_name}</td>
                        <td className="p-2 text-[16pt] text-center whitespace-nowrap">{student.class_level}/{student.room}</td>
                        <td className="p-2"></td>
                        <td className="p-2"></td>
                        <td className="p-2"></td>
                        <td className="p-2"></td>
                      </tr>
                    ))}
                    {/* Add empty rows if list is short */}
                    {students.length < 15 && [...Array(Math.max(0, 15 - students.length))].map((_, i) => (
                      <tr key={`empty-${i}`}>
                        <td className="p-2 text-[16pt] text-center">{toThaiDigits(students.length + i + 1)}</td>
                        <td className="p-2 whitespace-nowrap"></td>
                        <td className="p-2 text-center whitespace-nowrap"></td>
                        <td className="p-2"></td>
                        <td className="p-2"></td>
                        <td className="p-2"></td>
                        <td className="p-2"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="grid grid-cols-2 mt-12 text-[16pt]">
                  <div></div>
                  <div className="flex flex-col items-center">
                    <div className="flex items-center whitespace-nowrap">
                      <span className="w-12 text-right">ลงชื่อ</span>
                      <span className="px-1">...........................................................</span>
                      <span className="w-32">ครูประจำชั้น</span>
                    </div>
                    <div className="flex items-center whitespace-nowrap">
                      <span className="w-12"></span>
                      <span className="px-1">(...........................................................)</span>
                      <span className="w-32"></span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-6 leading-tight">
                  <h1 className="text-[20pt] font-bold">แบบหลักฐานการจ่ายเงินเงินอุดหนุนค่าเครื่องแบบนักเรียน และอุปกรณ์การเรียน</h1>
                  <h2 className="text-[18pt]">โครงการสนับสนุนค่าใช้จ่ายในการจัดการศึกษาตั้งแต่ระดับอนุบาลจนจบการศึกษาขั้นพื้นฐาน</h2>
                  <h2 className="text-[18pt]">
                    ภาคเรียนที่ {toThaiDigits(semester)} ปีการศึกษา {toThaiDigits(academicYear)}
                    {selectedClass !== 'ทั้งหมด' && ` (ชั้น ${selectedClass})`}
                  </h2>
                  <h2 className="text-[18pt]">{schoolName}</h2>
                </div>

                <table className="w-full border-collapse border border-black">
                  <thead>
                    <tr className="bg-slate-50">
                      <th rowSpan={2} className="p-1 text-[14pt] w-10 text-center">ที่</th>
                      <th rowSpan={2} className="p-1 text-[14pt]">ชื่อ - สกุล นักเรียน</th>
                      <th rowSpan={2} className="p-1 text-[14pt] w-16 text-center">ชั้น</th>
                      <th colSpan={2} className="p-1 text-[14pt] text-center">รายการที่ได้รับเงิน (บาท)</th>
                      <th rowSpan={2} className="p-1 text-[14pt] w-20 text-center">รวมเงิน<br/>(บาท)</th>
                      <th rowSpan={2} className="p-1 text-[14pt] w-24 text-center">วัน/เดือน/ปี<br/>ที่รับเงิน</th>
                      <th rowSpan={2} className="p-1 text-[14pt] w-32 text-center">ลายมือชื่อผู้รับเงิน<br/>(ผู้ปกครอง)</th>
                      <th rowSpan={2} className="p-1 text-[14pt] w-16 text-center">หมายเหตุ</th>
                    </tr>
                    <tr className="bg-slate-50">
                      <th className="p-1 text-[14pt] w-20 text-center">เครื่องแบบ</th>
                      <th className="p-1 text-[14pt] w-20 text-center">อุปกรณ์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, i) => {
                      const studentAmounts = getStudentAmounts(student.class_level);
                      return (
                        <tr key={student.id}>
                          <td className="p-2 text-[16pt] text-center">{toThaiDigits(i + 1)}</td>
                          <td className="p-2 text-[16pt] whitespace-nowrap">{student.prefix}{student.first_name} {student.last_name}</td>
                          <td className="p-2 text-[16pt] text-center whitespace-nowrap">{student.class_level}/{student.room}</td>
                          <td className="p-2 text-[16pt] text-right">{studentAmounts.uniform.toLocaleString()}</td>
                          <td className="p-2 text-[16pt] text-right">{studentAmounts.materials.toLocaleString()}</td>
                          <td className="p-2 text-[16pt] text-right">{studentAmounts.total.toLocaleString()}</td>
                          <td className="p-2 text-center text-[16pt]"></td>
                          <td className="p-2"></td>
                          <td className="p-2"></td>
                        </tr>
                      );
                    })}
                    {/* Grand Total Row */}
                    {students.length > 0 && (
                      <tr className="font-bold bg-slate-50">
                        <td colSpan={5} className="p-2 text-[16pt] text-right">รวมเป็นเงินทั้งสิ้น</td>
                        <td className="p-2 text-[16pt] text-right">{calculateGrandTotal().toLocaleString()}</td>
                        <td colSpan={3} className="p-2 text-[16pt]">บาท</td>
                      </tr>
                    )}
                    {students.length < 15 && [...Array(Math.max(0, 15 - students.length))].map((_, i) => (
                      <tr key={`empty-pay-${i}`}>
                        <td className="p-2 text-[16pt] text-center">{toThaiDigits(students.length + i + 1)}</td>
                        <td className="p-2 whitespace-nowrap"></td>
                        <td className="p-2 text-center whitespace-nowrap"></td>
                        <td className="p-2"></td>
                        <td className="p-2"></td>
                        <td className="p-2"></td>
                        <td className="p-2"></td>
                        <td className="p-2"></td>
                        <td className="p-2"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-6 text-[16pt]">
                  <p>รวมเงินตัวอักษร ({bahttext(calculateGrandTotal())})</p>
                </div>

                <div className="grid grid-cols-2 mt-10 text-[16pt]">
                  <div className="flex flex-col items-center">
                    <div className="flex items-center whitespace-nowrap">
                      <span className="w-12 text-right">ลงชื่อ</span>
                      <span className="px-1">...........................................................</span>
                      <span className="w-40 text-left">ผู้จ่ายเงิน</span>
                    </div>
                    <div className="flex items-center whitespace-nowrap">
                      <span className="w-12"></span>
                      <span className="px-1">(...........................................................)</span>
                      <span className="w-40"></span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="flex items-center whitespace-nowrap">
                      <span className="w-12 text-right">ลงชื่อ</span>
                      <span className="px-1">...........................................................</span>
                      <span className="w-40 text-left">ผู้อำนวยการสถานศึกษา</span>
                    </div>
                    <div className="flex items-center whitespace-nowrap">
                      <span className="w-12"></span>
                      <span className="px-1">( {directorName || '...........................................................'} )</span>
                      <span className="w-40"></span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FreeEducation;
