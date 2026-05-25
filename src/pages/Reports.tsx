import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; 
import {
  FileSpreadsheet,
  FileDown,
  Users,
  ClipboardList,
  Calendar,
  ChevronRight,
  Loader2,
  TrendingUp,
  FileText,
  BarChart,
  PieChart as PieChartIcon,
  Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('');
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [stats, setStats] = useState({
    incomingCount: 0,
    outgoingCount: 0,
    orderCount: 0,
    memoCount: 0,
    teacherCount: 0,
    studentCount: 0,
    pendingTasks: 0,
    completedTasks: 0,
    totalTasks: 0
  });

  const [chartData, setChartData] = useState<any[]>([]);
  const [studentDistData, setStudentDistData] = useState<any[]>([]);

  useEffect(() => {
    initReports();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      fetchStats();
      fetchChartData();
    }
  }, [selectedYear]);

  async function initReports() {
    try {
      // 1. Fetch available years from students table
      const { data: yearsData } = await supabase.from('students').select('academic_year');
      let uniqueYears: string[] = [];
      if (yearsData) {
        uniqueYears = Array.from(new Set(yearsData.map(s => s.academic_year))).filter(Boolean) as string[];     
      }

      // 2. Fetch current year from settings as default
      const { data: settings } = await supabase.from('settings').select('current_academic_year').single();      
      const currentYear = settings?.current_academic_year || '2568';

      if (!uniqueYears.includes(currentYear)) {
        uniqueYears.push(currentYear);
      }

      const sortedYears = uniqueYears.sort().reverse();
      setAvailableYears(sortedYears);
      setSelectedYear(currentYear);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchStats() {
    setLoading(true);
    try {
      const yearCE = parseInt(selectedYear) - 543;
      const startDate = `${yearCE}-01-01`;
      const endDate = `${yearCE}-12-31`;

      const [
        { count: incCount },
        { count: outCount },
        { count: orderCount },
        { count: memoCount },
        { count: tCount },
        { count: sCount },
        { count: pTasks },
        { count: cTasks },
        { count: allTasks }
      ] = await Promise.all([
        supabase.from('incoming_docs').select('*', { count: 'exact', head: true }).gte('doc_date', startDate).lte('doc_date', endDate),
        supabase.from('outgoing_docs').select('*', { count: 'exact', head: true }).gte('doc_date', startDate).lte('doc_date', endDate),
        supabase.from('orders').select('*', { count: 'exact', head: true }).gte('order_date', startDate).lte('order_date', endDate),
        supabase.from('memos').select('*', { count: 'exact', head: true }).gte('memo_date', startDate).lte('memo_date', endDate),
        supabase.from('teachers').select('*', { count: 'exact', head: true }),
        supabase.from('students').select('*', { count: 'exact', head: true })
          .eq('academic_year', selectedYear)
          .or('graduation_status.ilike.%กำลังศึกษา%,graduation_status.eq.ปกติ'),
        supabase.from('doc_assignments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),   
        supabase.from('doc_assignments').select('*', { count: 'exact', head: true }).eq('status', 'completed'), 
        supabase.from('doc_assignments').select('*', { count: 'exact', head: true })
      ]);

      setStats({
        incomingCount: incCount || 0,
        outgoingCount: outCount || 0,
        orderCount: orderCount || 0,
        memoCount: memoCount || 0,
        teacherCount: tCount || 0,
        studentCount: sCount || 0,
        pendingTasks: pTasks || 0,
        completedTasks: cTasks || 0,
        totalTasks: allTasks || 0
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchChartData() {
    try {
      // 0. Year Setup
      const yearCE = parseInt(selectedYear) - 543;
      const startDate = `${yearCE}-01-01`;
      const endDate = `${yearCE}-12-31`;

      // 1. Student distribution by class level (filtered by selected year and status)
      const { data: students } = await supabase.from('students')
        .select('class_level')
        .eq('academic_year', selectedYear)
        .or('graduation_status.ilike.%กำลังศึกษา%,graduation_status.eq.ปกติ');

      if (students) {
        const dist: any = {};
        students.forEach(s => {
          const level = s.class_level || 'ไม่ระบุ';
          dist[level] = (dist[level] || 0) + 1;
        });
        const formattedDist = Object.keys(dist).map(key => ({
          name: key,
          value: dist[key]
        })).sort((a, b) => a.name.localeCompare(b.name));
        setStudentDistData(formattedDist);
      }

      // 2. Document trend (all types)
      const [
        { data: incoming },
        { data: outgoing },
        { data: orders },
        { data: memos }
      ] = await Promise.all([
        supabase.from('incoming_docs').select('doc_date').gte('doc_date', startDate).lte('doc_date', endDate),  
        supabase.from('outgoing_docs').select('doc_date').gte('doc_date', startDate).lte('doc_date', endDate),  
        supabase.from('orders').select('order_date').gte('order_date', startDate).lte('order_date', endDate),   
        supabase.from('memos').select('memo_date').gte('memo_date', startDate).lte('memo_date', endDate)        
      ]);

      const months: any[] = [];
      const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

      for (let i = 0; i < 12; i++) {
        months.push({
          month: thaiMonths[i],
          incoming: 0,
          outgoing: 0,
          orders: 0,
          memos: 0,
          index: i
        });
      }

      incoming?.forEach(doc => {
        if (!doc.doc_date) return;
        const d = new Date(doc.doc_date);
        if (d.getFullYear() === yearCE) months[d.getMonth()].incoming++;
      });

      outgoing?.forEach(doc => {
        if (!doc.doc_date) return;
        const d = new Date(doc.doc_date);
        if (d.getFullYear() === yearCE) months[d.getMonth()].outgoing++;
      });

      orders?.forEach(doc => {
        if (!doc.order_date) return;
        const d = new Date(doc.order_date);
        if (d.getFullYear() === yearCE) months[d.getMonth()].orders++;
      });

      memos?.forEach(doc => {
        if (!doc.memo_date) return;
        const d = new Date(doc.memo_date);
        if (d.getFullYear() === yearCE) months[d.getMonth()].memos++;
      });

      setChartData(months);
    } catch (err) {
      console.error(err);
    }
  }

  const exportToExcel = async (table: string, fileName: string) => {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw error;

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    }
  };

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const efficiencyRate = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;

  const reportCards = [
    {
      title: "งานสารบรรณ (Admin Docs)",
      description: "สรุปทะเบียนหนังสือรับ-ส่ง และสถิติเอกสาร",
      icon: <FileText className="text-blue-500" />,
      color: "bg-blue-50",
      actions: [
        { label: "Excel หนังสือรับ", onClick: () => exportToExcel('incoming_docs', 'ทะเบียนหนังสือรับ') },      
        { label: "Excel หนังสือส่ง", onClick: () => exportToExcel('outgoing_docs', 'ทะเบียนหนังสือส่ง') }       
      ]
    },
    {
      title: "บริหารงานบุคคล (HR)",
      description: "รายงานการมอบหมายงาน และสถิตัครู",
      icon: <Users className="text-purple-500" />,
      color: "bg-purple-50",
      actions: [
        { label: "สรุปการมอบหมายงาน", onClick: () => exportToExcel('doc_assignments', 'รายงานการมอบหมายงาน') }, 
        { label: "ทะเบียนประวัติครู", onClick: () => exportToExcel('teachers', 'ทะเบียนครูบุคลากร') }
      ]
    },
    {
      title: "กิจการนักเรียน (Students)",
      description: "สถิติการมาเรียน และข้อมูลพื้นฐานนักเรียน",
      icon: <Users className="text-green-500" />,
      color: "bg-green-50",
      actions: [
        { label: "ข้อมูลนักเรียนรายบุคคล", onClick: () => exportToExcel('students', 'ข้อมูลนักเรียน') },        
        { label: "สถิติการมาเรียน (LEC)", onClick: () => alert('ฟีเจอร์นี้เปิดใช้งานในหน้า LEC Reports') }      
      ]
    }
  ];

  if (loading && !selectedYear) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-brand-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800">ระบบรายงานอัจฉริยะ</h1>
          <p className="text-slate-400 font-bold mt-1 uppercase tracking-tight">SMART REPORTING & DATA ANALYTICS ปีการศึกษา {selectedYear}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Year Selector */}
          <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <Filter size={18} className="text-brand-primary" />
            <select
              className="bg-transparent border-none outline-none font-black text-slate-700 text-sm cursor-pointer"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {availableYears.map(year => (
                <option key={year} value={year}>ปีการศึกษา {year}</option>
              ))}
            </select>
          </div>

          <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
            <Calendar size={18} className="text-brand-primary" />
            <span className="text-sm font-black text-slate-600">ข้อมูล ณ วันที่ {new Date().toLocaleDateString('th-TH')}</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "หนังสือรับ", value: stats.incomingCount, icon: <FileDown size={24} />, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "หนังสือส่ง", value: stats.outgoingCount, icon: <FileDown size={24} />, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "คำสั่ง", value: stats.orderCount, icon: <FileText size={24} />, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "บันทึกข้อความ", value: stats.memoCount, icon: <FileText size={24} />, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "งานรอครูดำเนินการ", value: stats.pendingTasks, icon: <ClipboardList size={24} />, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "ครูและบุคลากร", value: stats.teacherCount, icon: <Users size={24} />, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "นักเรียนทั้งหมด", value: stats.studentCount, icon: <Users size={24} />, color: "text-green-600", bg: "bg-green-50" },
        ].map((item, i) => (
          <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 ${item.bg} ${item.color} rounded-2xl flex items-center justify-center mb-4`}>
              {item.icon}
            </div>
            <div className="text-3xl font-black text-slate-800">{item.value.toLocaleString()}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{item.label}</div> 
          </div>
        ))}
      </div>

      {/* Analytics Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Document Trends */}
        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <BarChart size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">สถิติงานสารบรรณ</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Document Processing Trends ({selectedYear})</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontWeight: 800, fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontWeight: 700, fontSize: '12px' }} />
                <Bar dataKey="incoming" name="รับ" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outgoing" name="ส่ง" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="orders" name="คำสั่ง" fill="#a855f7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="memos" name="บันทึก" fill="#10b981" radius={[4, 4, 0, 0]} />
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Student Distribution */}
        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
              <PieChartIcon size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">สัดส่วนนักเรียน</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Student Distribution by Level ({selectedYear})</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={studentDistData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {studentDistData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                   itemStyle={{ fontWeight: 800, fontSize: '12px' }}
                />
                <Legend iconType="circle" layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontWeight: 700, fontSize: '12px' }} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportCards.map((card, i) => (
          <div key={i} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col h-full">
            <div className={`w-16 h-16 ${card.color} rounded-[24px] flex items-center justify-center mb-6`}>    
              {card.icon}
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">{card.title}</h3>
            <p className="text-sm text-slate-400 font-medium mb-8 leading-relaxed">{card.description}</p>       

            <div className="mt-auto space-y-3">
              {card.actions.map((action, j) => (
                <button
                  key={j}
                  onClick={action.onClick}
                  className="w-full py-4 px-6 bg-slate-50 hover:bg-brand-primary hover:text-white rounded-2xl font-bold text-sm text-slate-600 flex items-center justify-between transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <FileSpreadsheet size={16} /> {action.label}
                  </span>
                  <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />   
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Advanced Analytics Banner */}
      <div className="bg-slate-800 p-10 rounded-[48px] text-white overflow-hidden relative shadow-2xl">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-white/10 rounded-2xl">
              <TrendingUp size={24} />
            </div>
            <h2 className="text-2xl font-black">Smart Analytics Engine</h2>
          </div>
          <p className="text-white/60 font-bold max-w-lg mb-8">
            ระบบวิเคราะห์ข้อมูลขั้นสูงกำลังประมวลผลแนวโน้มการมาเรียนและประสิทธิภาพการทำงานของบุคลากร เพื่อช่วยในการตัดสินใจเชิงกลยุทธ์สำหรับผู้บริหาร
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            <div>
              <div className="text-4xl font-black mb-1">{efficiencyRate}%</div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">อัตราความสำเร็จ</div>
            </div>
            <div>
              <div className="text-4xl font-black mb-1">{stats.incomingCount + stats.outgoingCount + stats.orderCount + stats.memoCount}</div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">จำนวนเอกสารที่ดำเนินการ</div>
            </div>
            <div>
              <div className="text-4xl font-black mb-1">{stats.studentCount}</div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">นักเรียนที่กำลังศึกษา</div>
            </div>
          </div>
        </div>
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-brand-primary/20 rounded-full blur-[100px]"></div>
        <div className="absolute top-10 right-10 opacity-10">
           <TrendingUp size={200} />
        </div>
      </div>
    </div>
  );
}
