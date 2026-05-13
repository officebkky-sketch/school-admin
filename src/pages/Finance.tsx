import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, 
  Loader2, 
  TrendingUp, 
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  ClipboardList,
  CheckCircle2,
  Printer
} from 'lucide-react';

export default function Finance() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'procurement'>('overview');
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalBudget: 0,
    spent: 0,
    remaining: 0,
    projectCount: 0
  });

  // Modal States
  const [, setIsProjectModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  async function fetchData() {
    setLoading(true);
    try {
      // 1. Fetch Projects
      const { data: projData } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      setProjects(projData || []);

      // 2. Calculate Stats
      const total = projData?.reduce((acc, p) => acc + (p.budget_allocated || 0), 0) || 0;
      const spent = projData?.reduce((acc, p) => acc + (p.budget_spent || 0), 0) || 0;
      
      setStats({
        totalBudget: total,
        spent: spent,
        remaining: total - spent,
        projectCount: projData?.length || 0
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const isDirector = profile?.role === 'director' || profile?.role === 'admin';

  return (
    <div className="space-y-8">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
           <h1 className="text-3xl font-black text-slate-800">งานงบประมาณและการเงิน</h1>
           <p className="text-slate-400 font-bold mt-1 uppercase tracking-tight">Financial & Procurement Management</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
           <button onClick={() => setActiveTab('overview')} className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === 'overview' ? 'bg-brand-primary text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>ภาพรวม</button>
           <button onClick={() => setActiveTab('projects')} className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === 'projects' ? 'bg-brand-primary text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>โครงการ (ผป.)</button>
           <button onClick={() => setActiveTab('procurement')} className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${activeTab === 'procurement' ? 'bg-brand-primary text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>จัดซื้อจัดจ้าง</button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4"><DollarSign size={24} /></div>
            <div className="text-2xl font-black text-slate-800">฿{stats.totalBudget.toLocaleString()}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">งบประมาณที่ได้รับ</div>
         </div>
         <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4"><ArrowUpRight size={24} /></div>
            <div className="text-2xl font-black text-slate-800">฿{stats.spent.toLocaleString()}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">เบิกจ่ายแล้ว</div>
         </div>
         <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-4"><ArrowDownRight size={24} /></div>
            <div className="text-2xl font-black text-slate-800">฿{stats.remaining.toLocaleString()}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">คงเหลือ</div>
         </div>
         <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-4"><ClipboardList size={24} /></div>
            <div className="text-2xl font-black text-slate-800">{stats.projectCount}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">โครงการทั้งหมด</div>
         </div>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
              <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><TrendingUp className="text-brand-primary" /> แนวโน้มการใช้งบประมาณ</h3>
              <div className="h-64 flex items-center justify-center text-slate-300 italic text-sm border-2 border-dashed border-slate-50 rounded-3xl">กราฟวิเคราะห์ข้อมูลกำลังประมวลผล...</div>
           </div>
           <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                 <h3 className="text-xl font-black text-slate-800">รายการจัดซื้อล่าสุด</h3>
                 <button className="text-xs font-black text-brand-primary uppercase hover:underline">ดูทั้งหมด</button>
              </div>
              <div className="space-y-4">
                 <div className="flex items-center justify-center py-10 text-slate-400 text-sm italic">ยังไม่มีรายการจัดซื้อในเดือนนี้</div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
           <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800">รายการโครงการตามแผนปฏิบัติการ (ผป.)</h3>
              {isDirector && (
                <button onClick={() => setIsProjectModalOpen(true)} className="bg-brand-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg hover:scale-105 transition-all">
                  <Plus size={18} /> เพิ่มโครงการใหม่
                </button>
              )}
           </div>
           <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-50">
                 <tr>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ชื่อโครงการ / ผู้รับผิดชอบ</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">งบประมาณ</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">สถานะ</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">จัดการ</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {loading ? (
                   <tr><td colSpan={4} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-brand-primary" /></td></tr>
                 ) : projects.length > 0 ? projects.map(p => (
                   <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6">
                         <div className="font-black text-slate-700 text-sm mb-1">{p.project_name}</div>
                         <div className="text-[10px] text-slate-400 font-bold uppercase">{p.responsible_person || 'ยังไม่ระบุ'}</div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="text-sm font-black text-slate-800">฿{(p.budget_allocated || 0).toLocaleString()}</div>
                         <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-brand-primary" style={{ width: `${Math.min(100, ((p.budget_spent || 0) / (p.budget_allocated || 1)) * 100)}%` }}></div>
                         </div>
                      </td>
                      <td className="px-8 py-6">
                         <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase">
                            <CheckCircle2 size={12} /> อนุมัติแล้ว
                         </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                         <button className="p-2 text-slate-300 hover:text-brand-primary transition-colors"><ChevronRight size={20} /></button>
                      </td>
                   </tr>
                 )) : (
                   <tr><td colSpan={4} className="py-20 text-center text-slate-400 font-bold italic">ยังไม่มีข้อมูลโครงการ</td></tr>
                 )}
              </tbody>
           </table>
        </div>
      )}

      {activeTab === 'procurement' && (
         <div className="bg-slate-800 p-12 rounded-[48px] text-white text-center relative overflow-hidden shadow-2xl">
            <div className="relative z-10">
               <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Printer size={40} className="text-brand-primary" />
               </div>
               <h2 className="text-3xl font-black mb-4">ระบบออกเอกสารจัดซื้อจัดจ้าง (มค 69)</h2>
               <p className="text-white/60 font-bold max-w-lg mx-auto mb-8 leading-relaxed">
                  เชื่อมโยงข้อมูลจากโครงการ ผป. เพื่อออกบันทึกข้อความขออนุมัติซื้อ/จ้าง, รายงานขอซื้อ/จ้าง, และใบตรวจรับพัสดุอัตโนมัติ ตามมาตรฐานใหม่ล่าสุด
               </p>
               <button className="bg-brand-primary text-white px-8 py-4 rounded-[24px] font-black text-lg shadow-xl shadow-green-900/20 hover:scale-105 transition-all">
                  เริ่มกระบวนการจัดซื้อใหม่
               </button>
            </div>
            <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-brand-primary/20 rounded-full blur-[100px]"></div>
         </div>
      )}
    </div>
  );
}
