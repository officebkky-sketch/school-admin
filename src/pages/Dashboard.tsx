import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Loader2, 
  Users, 
  FileText, 
  CalendarCheck, 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    incomingToday: 0,
    presentToday: 0,
    onDuty: 0,
    pendingTasks: 0,
    completedTasksToday: 0
  });
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [dutyTeachers, setDutyTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[new Date().getDay()];

      try {
        // 0. Fetch Settings
        const { data: settings } = await supabase
          .from('settings')
          .select('current_academic_year')
          .single();
        
        const currentYear = settings?.current_academic_year || '2569';

        // 1. ดึงสถิติรวมผ่าน RPC (ประสิทธิภาพสูง)
        let dashboardStats: any = null;
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_stats', {
            target_year: currentYear,
            today_date: today
          });
          if (!rpcError) dashboardStats = rpcData;
        } catch (e) {}

        // 2. Fetch ดั้งเดิมสำหรับข้อมูลอื่นๆ และ Fallback
        const { count: studentCount } = !dashboardStats ? await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('academic_year', currentYear)
          .or('graduation_status.ilike.%กำลังศึกษา%,graduation_status.eq.ปกติ') : { count: dashboardStats.total_students };

        const { count: incomingCount } = !dashboardStats ? await supabase
          .from('incoming_docs')
          .select('*', { count: 'exact', head: true })
          .eq('doc_date', today) : { count: dashboardStats.incoming_today };

        let totalPresent = 0;
        if (dashboardStats) {
          totalPresent = dashboardStats.present_today;
        } else {
          const { data: attendanceData } = await supabase
            .from('attendance')
            .select('summary')
            .eq('date', today);
          totalPresent = attendanceData?.reduce((sum, record: any) => sum + (record.summary?.present || 0), 0) || 0;
        }

        // 4. Duty Teachers (ดึงแยกเพราะต้องการ Object รายคน)
        const { data: duties } = await supabase
          .from('teacher_duties')
          .select('teachers(*)')
          .eq('duty_day', currentDay);

        const currentDutyTeachers = (duties?.map((d: any) => d.teachers) || []).filter(Boolean);

        // 5. Latest Documents
        const { data: latestDocs } = await supabase
          .from('incoming_docs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        // 6. Pending Tasks
        const { count: pendingTaskCount } = await supabase
          .from('doc_assignments')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'acknowledged']);

        // 7. Completed Tasks Today
        const { count: completedTodayCount } = await supabase
          .from('doc_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed')
          .gte('reported_at', `${today}T00:00:00Z`);

        setStats({
          totalStudents: studentCount || 0,
          incomingToday: incomingCount || 0,
          presentToday: totalPresent,
          onDuty: currentDutyTeachers.length,
          pendingTasks: pendingTaskCount || 0,
          completedTasksToday: completedTodayCount || 0
        });
        setRecentDocs(latestDocs || []);
        setDutyTeachers(currentDutyTeachers);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[40px] border border-slate-100 shadow-sm">
      <Loader2 className="animate-spin text-brand-primary mb-4" size={40} />
      <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">กำลังดึงข้อมูลสถิติล่าสุด...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="นักเรียนทั้งหมด" value={stats.totalStudents} color="bg-blue-500" icon={<Users size={28} />} />
        <StatCard label="หนังสือรับวันนี้" value={stats.incomingToday} color="bg-orange-500" icon={<FileText size={28} />} />
        <StatCard label="มาเรียนวันนี้" value={stats.presentToday} color="bg-green-500" icon={<CalendarCheck size={28} />} />
        <StatCard label="ครูเวรวันนี้" value={stats.onDuty} color="bg-purple-500" icon={<Clock size={28} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Tasks & Docs */}
        <div className="lg:col-span-2 space-y-8">
           {/* Task Overview */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                 <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                    <AlertCircle size={24} />
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">งานที่รอดำเนินการ</p>
                    <p className="text-2xl font-black text-slate-800">{stats.pendingTasks} รายการ</p>
                 </div>
              </div>
              <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                 <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
                    <CheckCircle2 size={24} />
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">รายงานผลวันนี้</p>
                    <p className="text-2xl font-black text-slate-800">{stats.completedTasksToday} รายการ</p>
                 </div>
              </div>
           </div>

           {/* Recent Docs */}
           <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><FileText size={20} className="text-orange-500" /> งานเอกสารล่าสุด</h3>
              <div className="space-y-4">
                  {recentDocs.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 italic font-bold">ไม่มีรายการเอกสารใหม่วันนี้</div>
                  ) : recentDocs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                      <div className="flex gap-4 items-center">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-xs group-hover:text-orange-500 transition-colors"><FileText size={18} /></div>
                        <div>
                          <p className="text-sm font-bold text-slate-700">{doc.subject}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">{doc.from_agency}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(doc.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  ))}
              </div>
           </div>
        </div>

        {/* Right: Duty Teachers & Info */}
        <div className="space-y-8">
           <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><Clock size={20} className="text-blue-500" /> ครูเวรประจำวัน</h3>
              <div className="space-y-4">
                  {dutyTeachers.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 italic font-bold">ไม่มีข้อมูลครูเวรวันนี้</div>
                  ) : dutyTeachers.map(teacher => (
                    <div key={teacher.id} className="bg-blue-50/50 p-4 rounded-[24px] border border-blue-100/50 flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-300 shadow-sm overflow-hidden shrink-0 border border-blue-100">
                        {teacher.photo_url ? (
                          <img src={teacher.photo_url} alt={teacher.first_name} className="w-full h-full object-cover" />
                        ) : (
                          <Users size={24} />
                        )}
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">ครูเวรปฏิบัติหน้าที่</p>
                        <p className="text-sm font-bold text-blue-900 leading-none mt-1">{teacher.prefix}{teacher.first_name} {teacher.last_name}</p>
                      </div>
                    </div>
                  ))}
              </div>
           </div>

           <div className="bg-brand-primary p-8 rounded-[40px] text-white shadow-xl shadow-green-100 relative overflow-hidden">
              <div className="relative z-10">
                <h4 className="font-black text-xl mb-2">ยินดีต้อนรับ</h4>
                <p className="text-xs text-green-100 font-bold leading-relaxed">ระบบบริหารจัดการข้อมูลโรงเรียนบ้านควนโคกยา V2 พร้อมสำหรับการทำงานในวันนี้ครับ</p>
                <div className="mt-6 flex items-center gap-2 bg-white/20 w-fit px-4 py-2 rounded-full backdrop-blur-sm">
                   <TrendingUp size={16} />
                   <span className="text-[10px] font-black uppercase tracking-widest">System Healthy</span>
                </div>
              </div>
              <Users className="absolute -right-8 -bottom-8 text-white/10" size={160} />
           </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }: any) {
  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex items-center gap-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
      <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 group-hover:scale-110 transition-transform`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-3xl font-black text-slate-800 tracking-tight">{value}</p>
      </div>
    </div>
  );
}
