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
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    incomingCount: 0,
    outgoingCount: 0,
    teacherCount: 0,
    studentCount: 0,
    pendingTasks: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    try {
      // 0. Fetch Settings for Current Year
      const { data: settings } = await supabase.from('settings').select('current_academic_year').single();
      const currentYear = settings?.current_academic_year || '2568';

      const [
        { count: incCount },
        { count: outCount },
        { count: tCount },
        { count: sCount },
        { count: pTasks }
      ] = await Promise.all([
        supabase.from('incoming_docs').select('*', { count: 'exact', head: true }),
        supabase.from('outgoing_docs').select('*', { count: 'exact', head: true }),
        supabase.from('teachers').select('*', { count: 'exact', head: true }),
        supabase.from('students').select('*', { count: 'exact', head: true })
          .eq('academic_year', currentYear)
          .or('graduation_status.ilike.%กำลังศึกษา%,graduation_status.eq.ปกติ'),
        supabase.from('doc_assignments').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      ]);

      setStats({
        incomingCount: incCount || 0,
        outgoingCount: outCount || 0,
        teacherCount: tCount || 0,
        studentCount: sCount || 0,
        pendingTasks: pTasks || 0
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-brand-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-800">ระบบรายงานอัจฉริยะ</h1>
          <p className="text-slate-400 font-bold mt-1">SMART REPORTING & DATA EXPORT</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <Calendar size={18} className="text-brand-primary" />
          <span className="text-sm font-black text-slate-600">ข้อมูล ณ วันที่ {new Date().toLocaleDateString('th-TH')}</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "หนังสือรับทั้งหมด", value: stats.incomingCount, icon: <FileDown size={24} />, color: "text-blue-600", bg: "bg-blue-50" },
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

      {/* Analytics Visualization Placeholder */}
      <div className="bg-slate-800 p-10 rounded-[48px] text-white overflow-hidden relative">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-white/10 rounded-2xl">
              <TrendingUp size={24} />
            </div>
            <h2 className="text-2xl font-black">Data Analytics Dashboard</h2>
          </div>
          <p className="text-white/60 font-bold max-w-lg mb-8">
            ระบบกำลังเตรียมการประมวลผลข้อมูลเชิงสถิติขั้นสูง เพื่อแสดงผลในรูปแบบกราฟและแผนภูมิสำหรับผู้บริหาร เร็วๆ นี้
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            <div>
              <div className="text-4xl font-black mb-1">98%</div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Efficiency Rate</div>
            </div>
            <div>
              <div className="text-4xl font-black mb-1">{stats.incomingCount + stats.outgoingCount}</div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Total Docs Processed</div>
            </div>
          </div>
        </div>
        {/* Abstract background element */}
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-brand-primary/20 rounded-full blur-[100px]"></div>
      </div>
    </div>
  );
}
