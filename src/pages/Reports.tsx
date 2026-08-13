import { useState, useEffect, useRef } from 'react';
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
  Filter,
  GraduationCap,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
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
  const [mounted, setMounted] = useState(false);
  const [selectedYear, setSelectedYear] = useState('');
  const [schoolName, setSchoolName] = useState('');
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

  // ตารางสถิตินักเรียน แยกชั้น เพศ ศาสนา
  type ClassRow = {
    class_level: string;
    room: string;
    male: number;
    female: number;
    total: number;
    religions: Record<string, number>;
  };
  const [classRows, setClassRows] = useState<ClassRow[]>([]);
  const [allReligions, setAllReligions] = useState<string[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initReports();
    // รอ layout เสร็จก่อน render recharts ใน Electron
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (selectedYear) {
      fetchStats();
      fetchChartData();
      fetchStudentTableData();
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

      // 2. Fetch current year and school_name from settings as default
      const { data: settings } = await supabase.from('settings').select('current_academic_year, school_name').limit(1).maybeSingle();      
      const currentYear = settings?.current_academic_year || '2568';
      if (settings?.school_name) {
        setSchoolName(settings.school_name);
      }

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

  // ────────────────────────────────────────────────────────────────
  // ตารางสถิตินักเรียน แยกชั้น เพศ ศาสนา
  // ────────────────────────────────────────────────────────────────
  async function fetchStudentTableData() {
    setTableLoading(true);
    try {
      const { data: students } = await supabase
        .from('students')
        .select('class_level, room, gender, religion, prefix')
        .eq('academic_year', selectedYear)
        .or('graduation_status.ilike.%กำลังศึกษา%,graduation_status.eq.ปกติ');

      if (!students) return;

      // รวบรวมศาสนาทั้งหมด
      const religionSet = new Set<string>();
      students.forEach(s => {
        const r = s.religion?.trim() || 'ไม่ระบุ';
        religionSet.add(r);
      });
      const religions = Array.from(religionSet).sort();
      setAllReligions(religions);

      // group by class_level + room
      const map: Record<string, ClassRow> = {};
      students.forEach(s => {
        const lvl = s.class_level?.trim() || 'ไม่ระบุ';
        const rm  = s.room?.trim() || '-';
        const key = `${lvl}__${rm}`;
        if (!map[key]) {
          map[key] = { class_level: lvl, room: rm, male: 0, female: 0, total: 0, religions: {} };
        }
        const g = (s.gender?.trim() || '').toLowerCase();
        const p = (s.prefix?.trim() || '').toLowerCase();

        const isMale = g === 'ชาย' || g === 'male' || g === 'm' || g === 'ช' || p.includes('ชาย') || p.includes('นาย') || p.startsWith('ด.ช');
        const isFemale = g === 'หญิง' || g === 'female' || g === 'f' || g === 'ญ' || p.includes('หญิง') || p.includes('นาง') || p.startsWith('ด.ญ');

        if (isMale) map[key].male++;
        else if (isFemale) map[key].female++;

        map[key].total++;
        const rel = s.religion?.trim() || 'ไม่ระบุ';
        map[key].religions[rel] = (map[key].religions[rel] || 0) + 1;
      });

      // เรียงชั้น (รองรับทั้งชื่อย่อและชื่อเต็ม)
      const classOrder = [
        'อ.1', 'อ.2', 'อ.3',
        'อนุบาล 1', 'อนุบาล 2', 'อนุบาล 3',
        'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6',
        'ประถมศึกษาปีที่ 1', 'ประถมศึกษาปีที่ 2', 'ประถมศึกษาปีที่ 3', 'ประถมศึกษาปีที่ 4', 'ประถมศึกษาปีที่ 5', 'ประถมศึกษาปีที่ 6',
        'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6',
        'มัธยมศึกษาปีที่ 1', 'มัธยมศึกษาปีที่ 2', 'มัธยมศึกษาปีที่ 3', 'มัธยมศึกษาปีที่ 4', 'มัธยมศึกษาปีที่ 5', 'มัธยมศึกษาปีที่ 6'
      ];
      const rows = Object.values(map).sort((a, b) => {
        const ai = classOrder.indexOf(a.class_level);
        const bi = classOrder.indexOf(b.class_level);
        if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        return a.room.localeCompare(b.room, 'th');
      });
      setClassRows(rows);
    } catch (err) {
      console.error(err);
    } finally {
      setTableLoading(false);
    }
  }

  function exportStudentTableExcel() {
    const header = ['ชั้น', 'ห้อง', 'ชาย', 'หญิง', 'รวม', ...allReligions];
    const data = classRows.map(r => [
      r.class_level, r.room, r.male, r.female, r.total,
      ...allReligions.map(rel => r.religions[rel] || 0)
    ]);
    const totalMale   = classRows.reduce((s, r) => s + r.male, 0);
    const totalFemale = classRows.reduce((s, r) => s + r.female, 0);
    const totalAll    = classRows.reduce((s, r) => s + r.total, 0);
    const totalRel    = allReligions.map(rel => classRows.reduce((s, r) => s + (r.religions[rel] || 0), 0));
    data.push(['รวมทั้งหมด', '', totalMale, totalFemale, totalAll, ...totalRel]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'สถิตินักเรียน');
    XLSX.writeFile(wb, `สถิตินักเรียน_แยกชั้น_เพศ_ศาสนา_${selectedYear}.xlsx`);
    setExportMenuOpen(false);
  }

  async function exportStudentTablePNG() {
    if (!tableRef.current) return;
    setExporting(true);
    setExportMenuOpen(false);
    try {
      const dataUrl = await toPng(tableRef.current, { cacheBust: true, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `สถิตินักเรียน_แยกชั้น_เพศ_ศาสนา_${selectedYear}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export PNG failed:', err);
    } finally {
      setExporting(false);
    }
  }

  async function exportStudentTablePDF() {
    if (!tableRef.current) return;
    setExporting(true);
    setExportMenuOpen(false);
    try {
      const dataUrl = await toPng(tableRef.current, { cacheBust: true, backgroundColor: '#ffffff' });
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });
      const imgW = img.width;
      const imgH = img.height;
      const pdfW = 297;
      const pdfH = Math.round((imgH / imgW) * pdfW);
      const orientation = pdfH > 210 ? 'p' : 'l';
      const pdf = new jsPDF({ orientation, unit: 'mm', format: orientation === 'l' ? 'a4' : [pdfW, pdfH] });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageW / imgW, pageH / imgH);
      const drawW = imgW * ratio;
      const drawH = imgH * ratio;
      const offsetX = (pageW - drawW) / 2;
      const offsetY = (pageH - drawH) / 2;
      pdf.addImage(dataUrl, 'PNG', offsetX, offsetY, drawW, drawH);
      pdf.save(`สถิตินักเรียน_แยกชั้น_เพศ_ศาสนา_${selectedYear}.pdf`);
    } catch (err) {
      console.error('Export PDF failed:', err);
    } finally {
      setExporting(false);
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
            {mounted && <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
            </ResponsiveContainer>}
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
            {mounted && <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
            </ResponsiveContainer>}
          </div>
        </div>
      </div>

      {/* ── ตารางสถิตินักเรียน แยกชั้น เพศ ศาสนา ── */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <GraduationCap size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">สถิตินักเรียน แยกชั้น เพศ และศาสนา</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Student Statistics by Class, Gender &amp; Religion · {selectedYear}</p>
            </div>
          </div>
          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(v => !v)}
              disabled={tableLoading || classRows.length === 0 || exporting}
              className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-sm transition-colors shrink-0"
            >
              {exporting
                ? <><Loader2 size={16} className="animate-spin" /> กำลังสร้างไฟล์...</>
                : <><Download size={16} /> Export <ChevronRight size={14} className="rotate-90 ml-0.5" /></>}
            </button>
            {exportMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-20">
                  <button
                    onClick={exportStudentTableExcel}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-slate-700 font-bold text-sm transition-colors"
                  >
                    <FileSpreadsheet size={16} className="text-emerald-600" />
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={exportStudentTablePDF}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-slate-700 font-bold text-sm transition-colors"
                  >
                    <FileText size={16} className="text-red-500" />
                    PDF (.pdf)
                  </button>
                  <button
                    onClick={exportStudentTablePNG}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-slate-700 font-bold text-sm transition-colors"
                  >
                    <FileDown size={16} className="text-blue-500" />
                    PNG (.png)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        {tableLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-emerald-500" size={32} />
          </div>
        ) : classRows.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-bold">ไม่พบข้อมูลนักเรียนในปีการศึกษา {selectedYear}</div>
        ) : (() => {
          const totalMale   = classRows.reduce((s, r) => s + r.male, 0);
          const totalFemale = classRows.reduce((s, r) => s + r.female, 0);
          const totalAll    = classRows.reduce((s, r) => s + r.total, 0);

          // จัดกลุ่มตาม class_level เพื่อทำ rowspan
          const grouped: { level: string; rows: typeof classRows }[] = [];
          classRows.forEach(r => {
            const last = grouped[grouped.length - 1];
            if (last && last.level === r.class_level) last.rows.push(r);
            else grouped.push({ level: r.class_level, rows: [r] });
          });

          return (
            <div ref={tableRef} className="p-6 bg-white rounded-[32px]">
              {/* Header สรุปรายงานสำหรับไฟล์ Export/Print */}
              <div className="mb-6 pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">รายงานสถิตินักเรียน แยกชั้น เพศ และศาสนา</h2>
                  {schoolName && (
                    <p className="text-base font-black text-emerald-700 mt-1">
                      โรงเรียน{schoolName.replace(/^โรงเรียน/, '')}
                    </p>
                  )}
                  <p className="text-sm font-bold text-slate-500 mt-0.5">ปีการศึกษา {selectedYear} (ข้อมูล ณ วันที่ {new Date().toLocaleDateString('th-TH')})</p>
                </div>
                <div className="text-xs font-bold text-slate-400">
                  ระบบบริหารจัดการสถานศึกษา (School Admin Multischool)
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="px-4 py-3 text-left font-black text-xs uppercase tracking-wider whitespace-nowrap rounded-l-xl">ชั้น</th>
                      <th className="px-4 py-3 text-center font-black text-xs uppercase tracking-wider">ห้อง</th>
                      <th className="px-4 py-3 text-center font-black text-xs uppercase tracking-wider bg-blue-700/80">ชาย</th>
                      <th className="px-4 py-3 text-center font-black text-xs uppercase tracking-wider bg-rose-700/80">หญิง</th>
                      <th className="px-4 py-3 text-center font-black text-xs uppercase tracking-wider bg-emerald-700/80">รวม</th>
                      {allReligions.map((rel, idx) => (
                        <th key={rel} className={`px-4 py-3 text-center font-black text-xs uppercase tracking-wider whitespace-nowrap ${idx === allReligions.length - 1 ? 'rounded-r-xl' : ''}`}>{rel}</th>
                      ))}
                    </tr>
                  </thead>
                <tbody>
                  {grouped.map((group) => {
                    const grpMale   = group.rows.reduce((s, r) => s + r.male, 0);
                    const grpFemale = group.rows.reduce((s, r) => s + r.female, 0);
                    const grpTotal  = group.rows.reduce((s, r) => s + r.total, 0);
                    const grpRel    = allReligions.map(rel => group.rows.reduce((s, r) => s + (r.religions[rel] || 0), 0));

                    return [
                      // แถวข้อมูลแต่ละห้อง
                      ...group.rows.map((row, ri) => (
                        <tr key={`${group.level}-${row.room}-${ri}`}
                          className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors group">
                          {ri === 0 && (
                            <td
                              rowSpan={group.rows.length + 1}
                              className="px-4 py-3 font-black text-slate-800 text-base align-top border-r-2 border-slate-100 whitespace-nowrap"
                            >
                              <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-black">
                                {group.level}
                              </span>
                            </td>
                          )}
                          <td className="px-4 py-3 text-center font-bold text-slate-600">ห้อง {row.room}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-black text-sm">{row.male}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-50 text-rose-600 font-black text-sm">{row.female}</span>
                          </td>
                          <td className="px-4 py-3 text-center bg-emerald-50/40">
                            <span className="inline-flex items-center justify-center w-10 h-8 rounded-full bg-emerald-100 text-emerald-700 font-black text-sm">{row.total}</span>
                          </td>
                          {allReligions.map(rel => (
                            <td key={rel} className="px-4 py-3 text-center text-slate-600 font-semibold">
                              {row.religions[rel] || '-'}
                            </td>
                          ))}
                        </tr>
                      )),
                      // แถวรวมของชั้นนั้น (sub-total)
                      <tr key={`${group.level}-subtotal`} className="bg-slate-50/80 border-t border-slate-200">
                        <td className="px-4 py-2.5 text-center font-black text-slate-400 text-xs uppercase tracking-wider">รวมชั้น</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-7 rounded-full bg-blue-100 text-blue-700 font-black text-sm">{grpMale}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-7 rounded-full bg-rose-100 text-rose-600 font-black text-sm">{grpFemale}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center bg-emerald-50/60">
                          <span className="inline-flex items-center justify-center w-10 h-7 rounded-full bg-emerald-200 text-emerald-800 font-black text-sm">{grpTotal}</span>
                        </td>
                        {grpRel.map((cnt, ri) => (
                          <td key={ri} className="px-4 py-2.5 text-center font-bold text-slate-500 text-sm">{cnt || '-'}</td>
                        ))}
                      </tr>
                    ];
                  })}
                  {/* Grand Total */}
                  <tr className="bg-slate-800 text-white border-t-2 border-slate-300">
                    <td className="px-4 py-4 font-black text-white text-sm whitespace-nowrap" colSpan={2}>รวมทั้งหมด</td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-10 h-8 rounded-full bg-blue-400/30 text-blue-200 font-black">{totalMale}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-10 h-8 rounded-full bg-rose-400/30 text-rose-200 font-black">{totalFemale}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-12 h-8 rounded-full bg-emerald-400/30 text-emerald-200 font-black">{totalAll}</span>
                    </td>
                    {allReligions.map(rel => {
                      const cnt = classRows.reduce((s, r) => s + (r.religions[rel] || 0), 0);
                      return (
                        <td key={rel} className="px-4 py-4 text-center font-black text-slate-300">{cnt}</td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
        })()}
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
