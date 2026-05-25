import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Users,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

type AttendanceStats = {
  present: number;
  absent: number;
  late: number;
  total: number;
};

export default function AttendanceReport() {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  
  const getLocalDate = (date = new Date()) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [selectedMonth, setSelectedMonth] = useState(getLocalDate().slice(0, 7));
  const [reportData, setReportData] = useState<any[]>([]);
  const [summary, setSummary] = useState<AttendanceStats>({ present: 0, absent: 0, late: 0, total: 0 });
  const [settings, setSettings] = useState<any>(null);
  const [reporterName, setReporterName] = useState('');

  useEffect(() => {
    fetchReportData();
    fetchSettings();
  }, [viewMode, selectedDate, selectedMonth]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*').single();
    if (data) setSettings(data);
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      let startDate = selectedDate;
      let endDate = selectedDate;

      if (viewMode === 'monthly') {
        startDate = `${selectedMonth}-01`;
        const lastDay = new Date(new Date(selectedMonth).getFullYear(), new Date(selectedMonth).getMonth() + 1, 0).getDate();
        endDate = `${selectedMonth}-${lastDay}`;
      } else if (viewMode === 'weekly') {
        const date = new Date(selectedDate);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(new Date(selectedDate).setDate(diff)).toISOString().split('T')[0];
        endDate = new Date(new Date(selectedDate).setDate(diff + 6)).toISOString().split('T')[0];
      }

      // 1. ดึงสรุปผลผ่าน RPC (ประสิทธิภาพสูง)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_attendance_summary', {
        start_date: startDate,
        end_date: endDate
      });

      if (!rpcError && rpcData && rpcData.length > 0) {
        const res = rpcData[0];
        setSummary({
          present: Number(res.total_present),
          absent: Number(res.total_absent),
          late: Number(res.total_late),
          total: Number(res.total_present) + Number(res.total_absent) + Number(res.total_late)
        });
      }

      // 2. ดึงข้อมูลดิบมาแสดงในตารางตามปกติ
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('class_level', { ascending: true });

      if (error) throw error;
      setReportData(data || []);

      // หาก RPC ล้มเหลว (เช่น ยังไม่ได้สร้าง) ให้ใช้การคำนวณฝั่ง Client เป็น Fallback
      if (rpcError) {
        const stats = (data || []).reduce((acc, curr) => ({
          present: acc.present + (curr.summary?.present || 0),
          absent: acc.absent + (curr.summary?.absent || 0),
          late: acc.late + (curr.summary?.late || 0),
        }), { present: 0, absent: 0, late: 0 });

        setSummary({
          ...stats,
          total: stats.present + stats.absent + stats.late
        });
      }
    } catch (err) {
      console.error('Fetch Report Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toThaiDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return dateStr; }
  };

  const toThaiMonth = (monthStr: string) => {
    try {
      const date = new Date(monthStr);
      return date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    } catch (e) { return monthStr; }
  };

  const exportExcel = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(reportData.map(d => ({
        'วันที่': d.date,
        'ชั้นเรียน': d.class_level,
        'มา': d.summary?.present || 0,
        'ขาด': d.summary?.absent || 0,
        'สาย': d.summary?.late || 0,
        'รวมนักเรียน': (d.summary?.present || 0) + (d.summary?.absent || 0) + (d.summary?.late || 0)
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance");
      XLSX.writeFile(wb, `รายงานการมาเรียน_${viewMode}_${selectedDate}.xlsx`);
    } catch (err) {
      alert('ไม่สามารถส่งออก Excel ได้ กรุณาลองอีกครั้ง');
    }
  };

  const printReport = () => {
    const title = viewMode === 'daily' ? `รายงานสรุปจำนวนนักเรียนมาเรียนรายวัน` : 
                 viewMode === 'monthly' ? `รายงานสรุปจำนวนนักเรียนมาเรียนรายเดือน` :
                 `รายงานสรุปจำนวนนักเรียนมาเรียนรายสัปดาห์`;
    
    const subTitle = viewMode === 'daily' ? `ข้อมูล ณ วันที่ ${toThaiDate(selectedDate)}` :
                    viewMode === 'monthly' ? `ประจำเดือน ${toThaiMonth(selectedMonth)}` : '';

    const origin = window.location.origin;
    const logoSrc = settings?.school_logo_url || `${origin}${import.meta.env.VITE_SCHOOL_LOGO_PATH || '/logo.png'}`;

    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
            body { font-family: 'Sarabun', sans-serif; padding: 1.5cm; font-size: 14pt; line-height: 1.5; color: #000; }
            .header { text-align: center; margin-bottom: 1cm; }
            .logo { width: 2.5cm; height: 2.5cm; object-fit: contain; margin-bottom: 0.3cm; }
            h2, h3 { margin: 0; padding: 0; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid black; padding: 8px; text-align: center; }
            th { background: #f2f2f2 !important; font-weight: bold; -webkit-print-color-adjust: exact; }
            .summary-text { margin-top: 0.5cm; font-weight: bold; }
            .signature-section { margin-top: 2cm; display: flex; justify-content: space-between; align-items: flex-start; }
            .sig-block { text-align: center; width: 45%; }
            .no-print-btn { 
              position: fixed; top: 20px; right: 20px; 
              background: #16a34a; color: white; border: none; 
              padding: 12px 24px; border-radius: 12px; cursor: pointer;
              font-family: 'Sarabun', sans-serif; font-weight: bold;
              z-index: 100;
            }
            @media print { .no-print-btn { display: none; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <button class="no-print-btn" onclick="window.print()">🖨️ สั่งพิมพ์รายงาน</button>
          <div class="header">
            <img src="${logoSrc}" class="logo" />
            <h2>${title}</h2>
            <h3>${settings?.school_name || 'โรงเรียนบ้านควนโคกยา'}</h3>
            <p>${subTitle}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40%">วันที่ / ชั้นเรียน</th>
                <th>มา</th>
                <th>ขาด</th>
                <th>สาย</th>
                <th>รวม</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.map(d => `
                <tr>
                  <td style="text-align: left; padding-left: 15px;">${viewMode === 'daily' ? d.class_level : `${d.date} (${d.class_level})`}</td>
                  <td>${d.summary?.present || 0}</td>
                  <td>${d.summary?.absent || 0}</td>
                  <td>${d.summary?.late || 0}</td>
                  <td>${(d.summary?.present || 0) + (d.summary?.absent || 0) + (d.summary?.late || 0)}</td>
                </tr>
              `).join('')}
              <tr style="font-weight: bold; background: #fafafa;">
                <td>ยอดรวมทั้งหมด</td>
                <td>${summary.present}</td>
                <td>${summary.absent}</td>
                <td>${summary.late}</td>
                <td>${summary.total}</td>
              </tr>
            </tbody>
          </table>

          <div class="summary-text">
            สรุปผลการมาเรียน: คิดเป็นร้อยละ ${summary.total > 0 ? ((summary.present / summary.total) * 100).toFixed(2) : '0.00'} ของนักเรียนทั้งหมด
          </div>

          <div class="signature-section">
            <div class="sig-block">
              <p>ลงชื่อ..........................................................ผู้รายงาน</p>
              <p>( ${reporterName || '..........................................................'} )</p>
              <p>ตำแหน่ง ครูเวรประจำวัน</p>
            </div>
            <div class="sig-block">
              <p>ทราบ</p>
              <div style="margin-top: 0.5cm"></div>
              <p>ลงชื่อ..........................................................</p>
              <p>( ${settings?.director_name || '..........................................................'} )</p>
              <p>ตำแหน่ง ผู้อำนวยการ${settings?.school_name || 'โรงเรียนบ้านควนโคกยา'}</p>
            </div>
          </div>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800">รายงานเวลาเรียน</h1>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Attendance Analytics Report</p>
        </div>
        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
          {(['daily', 'weekly', 'monthly'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${viewMode === mode ? 'bg-brand-primary text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {mode === 'daily' ? 'รายวัน' : mode === 'weekly' ? 'รายสัปดาห์' : 'รายเดือน'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
             <button 
                onClick={() => {
                   const d = new Date(selectedDate);
                   d.setDate(d.getDate() - 1);
                   setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="p-3 hover:bg-slate-50 rounded-2xl border border-slate-100"
             >
                <ChevronLeft size={20} className="text-slate-400" />
             </button>
             
             <input 
                type={viewMode === 'monthly' ? 'month' : 'date'} 
                className="px-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-700 outline-hidden"
                value={viewMode === 'monthly' ? selectedMonth : selectedDate}
                onChange={e => viewMode === 'monthly' ? setSelectedMonth(e.target.value) : setSelectedDate(e.target.value)}
             />

             <button 
                onClick={() => {
                   const d = new Date(selectedDate);
                   d.setDate(d.getDate() + 1);
                   setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="p-3 hover:bg-slate-50 rounded-2xl border border-slate-100"
             >
                <ChevronRight size={20} className="text-slate-400" />
             </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Users size={16} className="absolute left-3 top-3 text-slate-400" />
              <input 
                type="text" 
                placeholder="ชื่อผู้รายงาน/ครูเวร" 
                className="pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-brand-primary outline-hidden"
                value={reporterName}
                onChange={e => setReporterName(e.target.value)}
              />
            </div>
            <div className="flex gap-2 border-l border-slate-100 pl-3">
              <button 
                onClick={exportExcel}
                className="p-3 bg-slate-50 text-slate-600 rounded-2xl font-bold text-xs flex items-center gap-2 hover:bg-slate-100 border border-slate-100"
                title="ส่งออก Excel"
              >
                <FileSpreadsheet size={20} />
              </button>
              <button 
                onClick={printReport}
                className="px-6 py-3 bg-brand-primary text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-green-100 hover:scale-[1.02] transition-transform"
              >
                <Printer size={18} /> พิมพ์รายงาน
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatMini label="มาเรียน" value={summary.present} color="text-green-600" bg="bg-green-50" />
          <StatMini label="ขาดเรียน" value={summary.absent} color="text-red-600" bg="bg-red-50" />
          <StatMini label="มาสาย" value={summary.late} color="text-orange-600" bg="bg-orange-50" />
          <StatMini label="ร้อยละการมา" value={summary.total > 0 ? ((summary.present / summary.total) * 100).toFixed(1) + '%' : '0%'} color="text-brand-primary" bg="bg-brand-primary/10" />
        </div>

        <div className="overflow-hidden border border-slate-50 rounded-3xl">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 border-b">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">รายละเอียด</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">มา</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">ขาด</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">สาย</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">ร้อยละ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-brand-primary" /></td></tr>
              ) : reportData.length === 0 ? (
                <tr><td colSpan={5} className="py-20 text-center text-slate-400 italic font-bold">ไม่พบข้อมูลบันทึกเวลาในช่วงเวลานี้</td></tr>
              ) : (
                reportData.map((d, i) => {
                  const total = (d.summary?.present || 0) + (d.summary?.absent || 0) + (d.summary?.late || 0);
                  const percent = total > 0 ? (d.summary?.present / total) * 100 : 0;
                  return (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-700">{d.class_level}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{d.date}</p>
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-green-600">{d.summary?.present || 0}</td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-red-500">{d.summary?.absent || 0}</td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-orange-500">{d.summary?.late || 0}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-bold ${percent >= 80 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          {percent.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatMini({ label, value, color, bg }: any) {
  return (
    <div className={`${bg} p-6 rounded-3xl border border-white shadow-xs`}>
       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
       <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}
