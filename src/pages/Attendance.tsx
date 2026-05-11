import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { sendLineNotification } from '../lib/lineNotify';
import { 
  Calendar, 
  Loader2,
  Save
} from 'lucide-react';

export default function Attendance() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [classLevel, setClassLevel] = useState('ป.1');
  const [academicYear, setAcademicYear] = useState('');
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    try {
      const { data: yearData } = await supabase.from('students').select('academic_year');
      if (yearData) {
        const years = Array.from(new Set(yearData.map(s => s.academic_year))).sort((a, b) => b.localeCompare(a));
        setAvailableYears(years);
        if (years.length > 0) setAcademicYear(years[0]);
      }
    } catch (err) { console.error(err); }
  }

  async function fetchStudents() {
    if (!academicYear) return;
    setLoading(true);
    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('class_level', classLevel)
      .eq('academic_year', academicYear)
      .eq('graduation_status', 'ปกติ')
      .order('student_id', { ascending: true });
    
    setStudents(data || []);
    // Initialize attendance with 'present'
    const initial: Record<string, string> = {};
    data?.forEach(s => initial[s.id] = 'มา');
    setAttendance(initial);
    setLoading(false);
  }

  useEffect(() => { fetchStudents(); }, [classLevel, academicYear]);

  const toggleStatus = (id: string, status: string) => {
    setAttendance(prev => ({ ...prev, [id]: status }));
  };

  const { user } = useAuth(); // Need to import and use useAuth

  async function saveAttendance() {
    setIsSaving(true);
    try {
      const now = new Date();
      const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      
      const summary = {
        present: Object.values(attendance).filter(v => v === 'มา').length,
        absent: Object.values(attendance).filter(v => v === 'ขาด').length,
        late: Object.values(attendance).filter(v => v === 'สาย').length,
      };

      const { error } = await supabase.from('attendance').insert([{
        date: localDate,
        class_level: classLevel,
        attendance_data: attendance,
        summary,
        teacher_id: user?.id
      }]);
      if (error) throw error;

      // 1. Send Group Notification
      const lineMessage = `\n📊 สรุปการมาเรียนประจำวัน\nชั้น: ${classLevel}\nวันที่: ${new Date().toLocaleDateString('th-TH')}\n\n✅ มา: ${summary.present} คน\n❌ ขาด: ${summary.absent} คน\n⏰ สาย: ${summary.late} คน`;
      sendLineNotification(lineMessage);

      // 2. Send Individual Notifications to Teachers on Duty
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[new Date().getDay()];
      
      const { data: duties } = await supabase
        .from('teacher_duties')
        .select('teachers(line_user_id, prefix, first_name)')
        .eq('duty_day', currentDay);

      if (duties) {
        duties.forEach((d: any) => {
          if (d.teachers?.line_user_id) {
            const personalMessage = `\n🔔 สวัสดีครับคุณครู ${d.teachers.prefix}${d.teachers.first_name}\nวันนี้คุณครูมีเวรปฏิบัติหน้าที่ และนี่คือสรุปยอดนักเรียนชั้น ${classLevel} ครับ\n\n✅ มา: ${summary.present}\n❌ ขาด: ${summary.absent}\n⏰ สาย: ${summary.late}`;
            sendLineNotification(personalMessage, d.teachers.line_user_id);
          }
        });
      }

      alert('บันทึกเวลาเรียนเรียบร้อย');
    } catch (err: any) {
      console.error('Attendance Save Error:', err);
      alert('บันทึกไม่สำเร็จ: ' + (err.message || 'เกิดข้อผิดพลาดที่ไม่รู้จัก'));
    } finally { setIsSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="bg-brand-primary/10 p-3 rounded-2xl text-brand-primary">
            <Calendar size={24} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">บันทึกเวลาเรียนประจำวัน</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3">
            <select 
              className="py-2 bg-transparent font-bold text-xs outline-hidden"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
            >
              {availableYears.map(y => <option key={y} value={y}>ปี {y}</option>)}
            </select>
          </div>
          <select 
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-hidden"
            value={classLevel}
            onChange={(e) => setClassLevel(e.target.value)}
          >
            {['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'].map(l => <option key={l} value={l}>ชั้น {l}</option>)}
          </select>
          <button 
            onClick={saveAttendance}
            disabled={isSaving}
            className="bg-brand-primary text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-100 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            บันทึกทั้งหมด
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-brand-primary" /></div>
        ) : students.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-400 italic bg-white rounded-3xl border border-dashed">ไม่พบข้อมูลนักเรียนในชั้นนี้</div>
        ) : (
          students.map(student => (
            <div key={student.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between group hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 font-bold overflow-hidden border border-slate-100">
                  {student.photo_url ? <img src={student.photo_url} className="w-full h-full object-cover" /> : student.student_id?.slice(-2)}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{student.first_name} {student.last_name}</p>
                  <p className="text-[10px] text-slate-400 font-bold">รหัส: {student.student_id}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <StatusBtn active={attendance[student.id] === 'มา'} color="bg-green-500" label="มา" onClick={() => toggleStatus(student.id, 'มา')} />
                <StatusBtn active={attendance[student.id] === 'สาย'} color="bg-orange-500" label="สาย" onClick={() => toggleStatus(student.id, 'สาย')} />
                <StatusBtn active={attendance[student.id] === 'ขาด'} color="bg-red-500" label="ขาด" onClick={() => toggleStatus(student.id, 'ขาด')} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatusBtn({ active, color, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-10 h-10 rounded-xl font-bold text-[10px] transition-all border-2 ${active ? `${color} text-white border-transparent shadow-md scale-110` : 'bg-white text-slate-300 border-slate-50 hover:border-slate-200'}`}
    >
      {label}
    </button>
  );
}
