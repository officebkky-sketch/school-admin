import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { extractProjectsFromKnowledge } from '../lib/aiService';
import { 
  Package, 
  ShoppingCart, 
  Store, 
  Plus, 
  Search,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreVertical,
  Edit2,
  Trash2,
  Filter,
  ArrowRight,
  TrendingUp,
  Wallet,
  Loader2,
  History,
  Info,
  ArrowLeftRight,
  ChevronRight,
  Calendar,
  FileBadge,
  Sparkles,
  Users
} from 'lucide-react';

type ProcurementTab = 'overview' | 'projects' | 'transfers' | 'vendors' | 'assets';

const DOCUMENT_SETS = [
  { id: 'material_egp', name: 'ชุดซื้อวัสดุ (เกิน 5,000 ลงระบบ e-GP)', folder: 'แบบฟอร์มจัดซื้อวัสดุ (เกิน 5000 ลงระบบ e-GP)' },
  { id: 'service_w877', name: 'ชุดจ้างเหมาบริการ 12 เดือน (ว.877)', folder: 'จ้างเหมาบริการ 12 เดือน ตาม ว.877' },
  { id: 'repair_egp', name: 'ชุดจ้างปรับปรุง/ซ่อมแซม (ลงระบบ e-GP)', folder: 'จ้างปรับปรุงซ่อมแซม-ก่อสร้าง (เกิน 5000 ลงระบบ e-GP)' },
  { id: 'general_job', name: 'ชุดจ้างทำของ (ลงระบบ e-GP)', folder: 'แบบฟอร์มจัดจ้างทำของ (เกิน 5000 ลงระบบ e-GP)' }
];

export default function Procurement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ProcurementTab>('overview');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [projects, setProjects] = useState<any[]>([]);
  const [procurements, setProcurements] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Form States
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isAddingBudgetSource, setIsAddingBudgetSource] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAddingProcurement, setIsAddingProcurement] = useState(false);

  // New Project Data
  const [newProject, setNewProject] = useState({
    project_name: '',
    academic_year: '2569',
    budget_id: '',
    planned_amount: 0
  });

  // Procurement Data
  const [newProcurement, setNewProcurement] = useState({
    project_id: '',
    vendor_id: '',
    project_name: '',
    academic_year: '2569',
    method: 'เฉพาะเจาะจง',
    procurement_type: 'ซื้อ',
    order_date: new Date().toISOString().split('T')[0],
    officer_id: '',
    head_officer_id: '',
    inspector_id: '', // ประธาน
    committee_ids: ['', ''] as string[], // กรรมการอีก 2 คน
    document_set_id: 'material_egp',
    vendor_info: {
      name: '',
      address: '',
      tax_id: ''
    }
  });

  const [procurementItems, setProcurementItems] = useState<any[]>([
    { item_name: '', quantity: 1, unit: 'รายการ', price_per_unit: 0, total_price: 0 }
  ]);

  // Local Transfer/Budget Source Data
  const [newTransfer, setNewTransfer] = useState({ from_project_id: '', to_project_id: '', amount: 0, reason: '' });
  const [newBudgetSource, setNewBudgetSource] = useState({ academic_year: '2569', budget_type: 'งบอุดหนุน', category_name: '', amount: 0 });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  async function fetchData() {
    setLoading(true);
    setFetchError(null);
    try {
      // 1. แหล่งงบประมาณ
      const { data: budData, error: budErr } = await supabase.from('budget_allocations').select('*');
      if (budErr) throw budErr;
      setBudgets(budData || []);

      // 2. โครงการ
      const { data: projData, error: projErr } = await supabase
        .from('school_projects')
        .select(`*, budget_allocations(category_name)`)
        .order('created_at', { descending: true });
      if (projErr) throw projErr;
      setProjects(projData || []);
      
      // 3. ร้านค้า
      const { data: venData, error: venErr } = await supabase.from('vendors').select('*').order('vendor_name');
      if (venErr) throw venErr;
      setVendors(venData || []);

      // 4. ครู/บุคลากร
      const { data: teachData, error: teachErr } = await supabase.from('teachers').select('*').order('first_name');
      if (teachErr) throw teachErr;
      setTeachers(teachData || []);

      // 5. การจัดซื้อ
      const { data: procData, error: procErr } = await supabase
        .from('procurement_projects')
        .select(`*, vendors(vendor_name), school_projects(project_name)`)
        .order('created_at', { descending: true });
      if (procErr) throw procErr;
      setProcurements(procData || []);

      // 6. การถัวจ่าย
      const { data: transData, error: transErr } = await supabase
        .from('budget_transfers')
        .select('*')
        .order('created_at', { descending: true });
      if (transErr) throw transErr;
      setTransfers(transData || []);

    } catch (err: any) {
      console.error('Fetch Error:', err);
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAIFillProjects() {
    setIsExtracting(true);
    try {
      const { data: settings } = await supabase.from('settings').select('gemini_api_key, ai_cowork_api_key').single();
      const apiKey = settings?.ai_cowork_api_key || settings?.gemini_api_key;
      if (!apiKey) throw new Error('กรุณาตั้งค่า API Key ก่อนใช้ฟีเจอร์ AI');

      const extracted = await extractProjectsFromKnowledge(apiKey, '2569');
      if (extracted.length === 0) {
        alert('AI ยังไม่พบรายชื่อโครงการที่ระบุวงเงินชัดเจนในคลังสมองครับ');
        return;
      }

      if (window.confirm(`AI ค้นพบโครงการทั้งหมด ${extracted.length} รายการ ยืนยันการนำเข้าหรือไม่?`)) {
        for (const p of extracted) {
          const matchedBudget = budgets.find(b => p.budget_type?.toLowerCase().includes(b.budget_type?.toLowerCase()) || b.category_name?.includes(p.budget_type));
          await supabase.from('school_projects').insert([{
            project_name: p.project_name,
            academic_year: '2569',
            budget_id: matchedBudget?.id || budgets[0]?.id,
            planned_amount: Number(p.planned_amount) || 0,
            current_amount: Number(p.planned_amount) || 0,
            spent_amount: 0
          }]);
        }
        alert('นำเข้าข้อมูลสำเร็จแล้วครับ');
        fetchData();
      }
    } catch (err: any) { alert(err.message); }
    finally { setIsExtracting(false); }
  }

  async function handleAddBudgetSource() {
    try {
      const { error } = await supabase.from('budget_allocations').insert([{
        ...newBudgetSource,
        remaining_amount: newBudgetSource.amount,
        created_by: user?.id
      }]);
      if (error) throw error;
      setIsAddingBudgetSource(false);
      setNewBudgetSource({ academic_year: '2569', budget_type: 'งบอุดหนุน', category_name: '', amount: 0 });
      fetchData();
    } catch (err: any) { alert(err.message); }
  }

  async function handleDeleteBudgetSource(id: string, name: string) {
    if (!confirm(`ยืนยันการลบแหล่งเงิน "${name}"?`)) return;
    try {
      const { error } = await supabase.from('budget_allocations').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) { alert(err.message); }
  }

  async function handleAddProject() {
    if (!newProject.project_name || !newProject.budget_id) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วนครับ');
      return;
    }
    try {
      if (isEditingProject && selectedProjectId) {
        await supabase.from('school_projects').update({
          project_name: newProject.project_name,
          budget_id: newProject.budget_id,
          planned_amount: Number(newProject.planned_amount) || 0,
          current_amount: Number(newProject.planned_amount) || 0 
        }).eq('id', selectedProjectId);
      } else {
        await supabase.from('school_projects').insert([{
          project_name: newProject.project_name,
          academic_year: newProject.academic_year || '2569',
          budget_id: newProject.budget_id,
          planned_amount: Number(newProject.planned_amount) || 0,
          current_amount: Number(newProject.planned_amount) || 0,
          spent_amount: 0
        }]);
      }
      setIsAddingProject(false);
      setIsEditingProject(false);
      fetchData();
    } catch (err: any) { alert(err.message); }
  }

  async function handleDeleteProject(id: string, name: string) {
    if (!confirm(`ยืนยันการลบโครงการ "${name}"?`)) return;
    try {
      await supabase.from('school_projects').delete().eq('id', id);
      fetchData();
    } catch (err: any) { alert(err.message); }
  }

  function openEditModal(project: any) {
    setNewProject({
      project_name: project.project_name,
      academic_year: project.academic_year,
      budget_id: project.budget_id,
      planned_amount: project.planned_amount
    });
    setSelectedProjectId(project.id);
    setIsEditingProject(true);
    setIsAddingProject(true);
  }

  async function handleTransfer() {
    try {
      const fromProj = projects.find(p => p.id === newTransfer.from_project_id);
      if (Number(fromProj.current_amount) < newTransfer.amount) throw new Error('ยอดเงินไม่เพียงพอ');
      await supabase.from('budget_transfers').insert([{ ...newTransfer, created_by: user?.id }]);
      await supabase.from('school_projects').update({ current_amount: Number(fromProj.current_amount) - Number(newTransfer.amount) }).eq('id', newTransfer.from_project_id);
      const toProj = projects.find(p => p.id === newTransfer.to_project_id);
      await supabase.from('school_projects').update({ current_amount: Number(toProj.current_amount) + Number(newTransfer.amount) }).eq('id', newTransfer.to_project_id);
      setIsTransferring(false);
      fetchData();
    } catch (err: any) { alert(err.message); }
  }

  async function handleAddProcurement() {
    if (!newProcurement.project_id || !newProcurement.project_name || !newProcurement.officer_id || !newProcurement.inspector_id) {
      alert('กรุณากรอกข้อมูลโครงการและระบุเจ้าหน้าที่/ผู้ตรวจรับให้ครบถ้วนครับ');
      return;
    }
    try {
      const { data: mainData, error: mainErr } = await supabase
        .from('procurement_projects')
        .insert([{
          project_id: newProcurement.project_id,
          vendor_id: newProcurement.vendor_id || null,
          project_name: newProcurement.project_name,
          academic_year: newProcurement.academic_year,
          method: newProcurement.method,
          procurement_type: newProcurement.procurement_type,
          order_date: newProcurement.order_date,
          officer_id: newProcurement.officer_id,
          head_officer_id: newProcurement.head_officer_id,
          inspector_id: newProcurement.inspector_id,
          committee_json: newProcurement.committee_ids.filter(id => id !== ''),
          vendor_info: newProcurement.vendor_info,
          total_amount: procurementItems.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0),
          status: 'draft',
          created_by: user?.id
        }])
        .select().single();
      
      if (mainErr) throw mainErr;

      const itemsToInsert = procurementItems.map(item => ({
        procurement_id: mainData.id,
        item_name: item.item_name,
        quantity: item.quantity,
        unit: item.unit,
        price_per_unit: item.price_per_unit,
        total_price: item.total_price
      }));

      await supabase.from('procurement_items').insert(itemsToInsert);
      alert('บันทึกข้อมูลจัดซื้อเรียบร้อยแล้วครับ');
      setIsAddingProcurement(false);
      fetchData();
    } catch (err: any) { alert(err.message); }
  }

  function addItemRow() {
    setProcurementItems([...procurementItems, { item_name: '', quantity: 1, unit: 'รายการ', price_per_unit: 0, total_price: 0 }]);
  }

  function updateItem(index: number, field: string, value: any) {
    const newItems = [...procurementItems];
    newItems[index][field] = value;
    if (field === 'quantity' || field === 'price_per_unit') {
      newItems[index].total_price = Number(newItems[index].quantity) * Number(newItems[index].price_per_unit);
    }
    setProcurementItems(newItems);
  }

  const stats = {
    totalBudget: budgets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
    totalProjectPlanned: projects.reduce((sum, p) => sum + (Number(p.planned_amount) || 0), 0),
    totalSpent: procurements.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0),
    activeProjects: projects.length,
    transferCount: transfers.length
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-1">บริหารจัดการโครงการและพัสดุ</p>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Package className="text-brand-primary" size={32} /> ระบบพัสดุอัจฉริยะ
          </h1>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">       
          {[
            { id: 'overview', label: 'ภาพรวม', icon: <TrendingUp size={14} /> },
            { id: 'projects', label: 'โครงการ (แผนผด.)', icon: <Calendar size={14} /> },
            { id: 'transfers', label: 'การถัวจ่ายเงิน', icon: <ArrowLeftRight size={14} /> },
            { id: 'vendors', label: 'ร้านค้า/คู่สัญญา', icon: <Store size={14} /> },
            { id: 'assets', label: 'ทะเบียนครุภัณฑ์', icon: <FileBadge size={14} /> }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as ProcurementTab)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${activeTab === tab.id ? 'bg-brand-primary text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {fetchError && <div className="bg-red-50 border border-red-100 p-6 rounded-[32px] text-red-600 flex items-center justify-between"><div className="flex items-center gap-3"><AlertCircle size={24} /> {fetchError}</div><button onClick={fetchData} className="px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black">ลองใหม่</button></div>}

      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center text-slate-300">
          <Loader2 className="animate-spin mb-4" size={48} />
          <p className="font-bold uppercase tracking-widest text-[10px]">กำลังวิเคราะห์ข้อมูล...</p>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in duration-500">
              <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative group hover:shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors"><Wallet size={24} /></div>
                  <button onClick={() => setIsAddingBudgetSource(true)} className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"><Plus size={14} /></button>
                </div>
                <div className="text-2xl font-black text-slate-800">{stats.totalBudget.toLocaleString()} ฿</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">งบประมาณที่ได้รับ</div>
                <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                  {budgets.map(b => (
                    <div key={b.id} className="flex items-center justify-between group/item">
                      <div className="text-[9px] font-bold text-slate-500 truncate pr-2">• {b.category_name}</div>
                      <button onClick={() => handleDeleteBudgetSource(b.id, b.category_name)} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all"><Trash2 size={10} /></button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm transition-all">
                <div className="flex items-center justify-between mb-4"><div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center"><Calendar size={24} /></div></div>
                <div className="text-2xl font-black text-slate-800">{stats.totalProjectPlanned.toLocaleString()} ฿</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">วงเงินตามโครงการ</div>
              </div>
              <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm transition-all">
                <div className="flex items-center justify-between mb-4"><div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center"><ShoppingCart size={24} /></div></div>
                <div className="text-2xl font-black text-slate-800">{stats.totalSpent.toLocaleString()} ฿</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">ยอดเบิกจ่ายจริง</div>
              </div>
              <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm transition-all">
                <div className="flex items-center justify-between mb-4"><div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center"><ArrowLeftRight size={24} /></div></div>
                <div className="text-2xl font-black text-slate-800">{stats.transferCount}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">รายการถัวจ่ายเงิน</div>
              </div>

              <div className="md:col-span-3 bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                  <h3 className="text-lg font-black text-slate-800 tracking-tight">รายการจัดซื้อจัดจ้างล่าสุด</h3>
                  <button onClick={() => setIsAddingProcurement(true)} className="bg-brand-primary text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-green-700 transition-all">+ เริ่มจัดซื้อใหม่</button>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50/50 border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                         <tr><th className="px-8 py-4">รายการ</th><th className="px-8 py-4 text-right">จำนวนเงิน</th><th className="px-8 py-4 text-center">สถานะ</th><th className="px-8 py-4 text-right">จัดการ</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                         {procurements.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                               <td className="px-8 py-5">
                                  <div className="font-bold text-slate-700 text-sm">{p.project_name}</div>
                                  <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{p.school_projects?.project_name}</div>
                               </td>
                               <td className="px-8 py-5 text-right font-black text-slate-800">{Number(p.total_amount).toLocaleString()} ฿</td>
                               <td className="px-8 py-5 text-center"><span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest">ฉบับร่าง</span></td>
                               <td className="px-8 py-5 text-right"><button className="p-2 text-brand-primary hover:bg-green-50 rounded-lg"><FileText size={16} /></button></td>
                            </tr>
                         ))}
                         {procurements.length === 0 && <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-300 italic text-sm">ยังไม่มีรายการจัดซื้อ</td></tr>}
                      </tbody>
                   </table>
                </div>
              </div>
              <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8 flex flex-col items-center justify-center text-center">
                 <Sparkles size={48} className="text-yellow-400 mb-4 animate-pulse" />
                 <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">The Buyer AI</h4>
                 <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase leading-relaxed">เลือกโครงการ แล้วให้ AI ช่วยร่าง<br/>ชุดเอกสารจัดซื้อ 17 รายการให้คุณ</p>
                 <button onClick={() => setIsAddingProcurement(true)} className="mt-8 w-full py-4 bg-slate-900 text-white rounded-[24px] text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl transition-all active:scale-95">เปิดระบบจัดซื้อ</button>
              </div>
            </div>
          )}

          {activeTab === 'projects' && (
             <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
                <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div><h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase">ทะเบียนโครงการ</h3><p className="text-xs text-slate-400 font-bold uppercase mt-1 flex items-center gap-2"><Sparkles size={14} className="text-brand-primary" /> AI พร้อมสกัดข้อมูลจากแผนปฏิบัติการ</p></div>
                  <div className="flex gap-3">
                     <button onClick={handleAIFillProjects} disabled={isExtracting} className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg hover:bg-slate-800 disabled:opacity-50 transition-all">{isExtracting ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} className="text-yellow-400" />} AI สกัดแผนงาน</button>
                     <button onClick={() => { setIsEditingProject(false); setIsAddingProject(true); setNewProject({ project_name: '', academic_year: '2569', budget_id: '', planned_amount: 0 }); }} className="bg-brand-primary text-white px-8 py-3.5 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg hover:bg-green-700 transition-all active:scale-95"><Plus size={20} /> เพิ่มโครงการ</button>
                  </div>
                </div>
                <div className="flex-1 overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest"><tr><th className="px-8 py-5">โครงการ / แหล่งเงิน</th><th className="px-8 py-5 text-right">งบตามแผน</th><th className="px-8 py-5 text-right">งบปัจจุบัน</th><th className="px-8 py-5 text-right">จัดการ</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                         {projects.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50/30 transition-all">
                               <td className="px-8 py-6"><div className="font-black text-slate-800">{p.project_name}</div><div className="text-[10px] text-slate-400 font-bold uppercase mt-1">{p.budget_allocations?.category_name}</div></td>
                               <td className="px-8 py-6 text-right text-sm font-bold text-slate-400">{Number(p.planned_amount).toLocaleString()}</td>
                               <td className="px-8 py-6 text-right text-base font-black text-brand-primary">{Number(p.current_amount).toLocaleString()}</td>
                               <td className="px-8 py-6 text-right"><div className="flex justify-end gap-2"><button onClick={() => openEditModal(p)} className="p-2 text-blue-400 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={18} /></button><button onClick={() => handleDeleteProject(p.id, p.project_name)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button></div></td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
          )}

          {activeTab === 'transfers' && (
            <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-hidden min-h-[600px] flex flex-col animate-in fade-in">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <div><h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase">ประวัติการถัวจ่ายเงิน</h3><p className="text-xs text-slate-400 font-bold uppercase mt-1 flex items-center gap-2"><ArrowLeftRight size={14} className="text-brand-primary" /> บันทึกการโยกย้ายงบประมาณระหว่างโครงการ</p></div>
                <button onClick={() => setIsTransferring(true)} className="bg-green-600 text-white px-8 py-3.5 rounded-2xl font-black text-sm shadow-lg hover:bg-green-700 active:scale-95 transition-all">+ เริ่มการถัวจ่าย</button>
              </div>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest"><tr><th className="px-8 py-5">วันที่</th><th className="px-8 py-5">ต้นทาง</th><th className="px-8 py-5 text-center"><ArrowRight size={14} /></th><th className="px-8 py-5">ปลายทาง</th><th className="px-8 py-5 text-right">จำนวนเงิน</th></tr></thead>
                  <tbody className="divide-y divide-slate-50 text-sm font-bold text-slate-700">
                    {transfers.map(t => {
                      const fromP = projects.find(p => p.id === t.from_project_id);
                      const toP = projects.find(p => p.id === t.to_project_id);
                      return (<tr key={t.id} className="hover:bg-slate-50/50 transition-colors"><td className="px-8 py-5 text-slate-400 font-medium">{new Date(t.created_at).toLocaleDateString('th-TH')}</td><td className="px-8 py-5">{fromP?.project_name}</td><td className="px-8 py-5 text-center text-slate-300"><ArrowRight size={16} /></td><td className="px-8 py-5">{toP?.project_name}</td><td className="px-8 py-5 text-right font-black text-blue-600">{Number(t.amount).toLocaleString()} ฿</td></tr>);
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(activeTab === 'vendors' || activeTab === 'assets') && (
            <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl p-20 flex flex-col items-center justify-center text-slate-300 text-center animate-in fade-in duration-500">
               <Package size={80} className="mb-6 opacity-10" />
               <p className="text-xl font-black uppercase tracking-widest">ส่วนระบบ {activeTab}</p>
               <p className="text-sm font-bold mt-2 text-slate-400 italic">พร้อมเชื่อมต่อฐานข้อมูลโครงการชุดใหม่</p>
            </div>
          )}
        </>
      )}

      {/* Modals Section */}
      {isAddingBudgetSource && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30"><h3 className="text-xl font-black text-slate-800">เพิ่มแหล่งงบประมาณหลัก</h3></div>
            <div className="p-8 space-y-4">
              <input type="text" placeholder="ชื่อแหล่งเงิน..." className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newBudgetSource.category_name} onChange={e => setNewBudgetSource({...newBudgetSource, category_name: e.target.value})} />      
              <div className="grid grid-cols-2 gap-4">
                <select className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newBudgetSource.budget_type} onChange={e => setNewBudgetSource({...newBudgetSource, budget_type: e.target.value})}><option>งบอุดหนุน</option><option>งบรายได้สถานศึกษา</option><option>งบอาหารกลางวัน</option><option>งบอื่นๆ</option></select>
                <input type="number" placeholder="จำนวนเงิน..." className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newBudgetSource.amount} onChange={e => setNewBudgetSource({...newBudgetSource, amount: Number(e.target.value)})} />
              </div>
            </div>
            <div className="p-8 bg-slate-50/50 flex gap-3"><button onClick={() => setIsAddingBudgetSource(false)} className="flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-100">ยกเลิก</button><button onClick={handleAddBudgetSource} className="flex-[2] py-3.5 bg-brand-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-green-700 transition-all">บันทึกแหล่งเงิน</button></div>
          </div>
        </div>
      )}

      {isAddingProject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30"><h3 className="text-xl font-black text-slate-800">{isEditingProject ? 'แก้ไขโครงการ' : 'เพิ่มโครงการใหม่'}</h3></div>
            <div className="p-8 space-y-4">
              <input type="text" placeholder="ชื่อโครงการ..." className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProject.project_name} onChange={e => setNewProject({...newProject, project_name: e.target.value})} />
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">แหล่งงบประมาณที่ใช้</label>
                <select className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProject.budget_id} onChange={e => setNewProject({...newProject, budget_id: e.target.value})}><option value="">เลือกแหล่งเงิน...</option>{budgets.map(b => (<option key={b.id} value={b.id}>{b.category_name} (คงเหลือ {Number(b.remaining_amount).toLocaleString()} ฿)</option>))}</select>
              </div>
              <input type="number" placeholder="วงเงินตามแผน (บาท)..." className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProject.planned_amount || ''} onChange={e => setNewProject({...newProject, planned_amount: Number(e.target.value)})} />
            </div>
            <div className="p-8 bg-slate-50/50 flex gap-3"><button onClick={() => { setIsAddingProject(false); setIsEditingProject(false); }} className="flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-100">ยกเลิก</button><button onClick={handleAddProject} className="flex-[2] py-3.5 bg-brand-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-green-700">{isEditingProject ? 'บันทึกการแก้ไข' : 'บันทึกโครงการ'}</button></div>
          </div>
        </div>
      )}

      {isTransferring && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30"><h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><ArrowLeftRight className="text-brand-primary" size={24} /> รายการถัวจ่ายเงิน</h3></div>
            <div className="p-8 space-y-4">
              <select className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newTransfer.from_project_id} onChange={e => setNewTransfer({...newTransfer, from_project_id: e.target.value})}><option value="">จากโครงการ...</option>{projects.map(p => <option key={p.id} value={p.id}>{p.project_name} ({Number(p.current_amount).toLocaleString()} ฿)</option>)}</select>
              <select className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newTransfer.to_project_id} onChange={e => setNewTransfer({...newTransfer, to_project_id: e.target.value})}><option value="">ไปโครงการ...</option>{projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}</select>
              <div className="grid grid-cols-2 gap-4"><input type="number" placeholder="จำนวนเงิน..." className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newTransfer.amount} onChange={e => setNewTransfer({...newTransfer, amount: Number(e.target.value)})} /><input type="text" placeholder="เหตุผล..." className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newTransfer.reason} onChange={e => setNewTransfer({...newTransfer, reason: e.target.value})} /></div>
            </div>
            <div className="p-8 bg-slate-50/50 flex gap-3"><button onClick={() => setIsTransferring(false)} className="flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400">ยกเลิก</button><button onClick={handleTransfer} className="flex-[2] py-3.5 bg-green-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-green-700 transition-all">บันทึกการถัวจ่าย</button></div>
          </div>
        </div>
      )}

      {/* NEW: Smart Procurement Modal */}
      {isAddingProcurement && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in zoom-in-95 duration-200 overflow-y-auto">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl my-8 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3"><Sparkles className="text-brand-primary" size={28} /> เริ่มการจัดซื้ออัจฉริยะ</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">กรอกข้อมูลเพื่อสร้างชุดเอกสาร 17 รายการอัตโนมัติ</p>
              </div>
              <button onClick={() => setIsAddingProcurement(false)} className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all">✕</button>
            </div>
            
            <div className="p-8 overflow-y-auto max-h-[70vh] space-y-8 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-brand-primary uppercase tracking-widest ml-2">1. ข้อมูลโครงการและประเภทงาน</label>
                  <select className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:bg-white transition-all" value={newProcurement.project_id} onChange={e => setNewProcurement({...newProcurement, project_id: e.target.value})}>
                    <option value="">เลือกโครงการต้นสังกัด...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_name} (คงเหลือ {Number(p.current_amount).toLocaleString()} ฿)</option>)}
                  </select>
                  <input type="text" placeholder="ชื่อรายการที่จัดซื้อ (เช่น ซื้อวัสดุสำนักงาน 5 รายการ)..." className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.project_name} onChange={e => setNewProcurement({...newProcurement, project_name: e.target.value})} />
                  <select className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.document_set_id} onChange={e => setNewProcurement({...newProcurement, document_set_id: e.target.value})}>
                    {DOCUMENT_SETS.map(set => <option key={set.id} value={set.id}>{set.name}</option>)}
                  </select>
                </div>
                <div className="space-y-4">
                   <label className="text-[10px] font-black text-brand-primary uppercase tracking-widest ml-2">2. เจ้าหน้าที่และผู้อนุมัติ</label>
                   <select className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.officer_id} onChange={e => setNewProcurement({...newProcurement, officer_id: e.target.value})}>
                     <option value="">เลือกเจ้าหน้าที่พัสดุ...</option>
                     {teachers.map(t => <option key={t.id} value={t.id}>{t.prefix}{t.first_name} {t.last_name}</option>)}
                   </select>
                   <select className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.head_officer_id} onChange={e => setNewProcurement({...newProcurement, head_officer_id: e.target.value})}>
                     <option value="">เลือกหัวหน้าเจ้าหน้าที่...</option>
                     {teachers.map(t => <option key={t.id} value={t.id}>{t.prefix}{t.first_name} {t.last_name}</option>)}
                   </select>
                   <select className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.inspector_id} onChange={e => setNewProcurement({...newProcurement, inspector_id: e.target.value})}>
                     <option value="">เลือกผู้ตรวจรับ/ประธานกรรมการ...</option>
                     {teachers.map(t => <option key={t.id} value={t.id}>{t.prefix}{t.first_name} {t.last_name}</option>)}
                   </select>
                   <div className="flex gap-4">
                     <div className="flex-1">
                        <label className="text-[9px] font-bold text-slate-400 ml-2">วันที่ขออนุมัติ</label>
                        <input type="date" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.order_date} onChange={e => setNewProcurement({...newProcurement, order_date: e.target.value})} />
                     </div>
                   </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <label className="text-[10px] font-black text-brand-primary uppercase tracking-widest">3. รายการพัสดุที่ต้องการซื้อ/จ้าง</label>
                  <button onClick={addItemRow} className="text-[10px] font-black text-blue-500 hover:text-blue-700 flex items-center gap-1">+ เพิ่มรายการ</button>
                </div>
                <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 space-y-3">
                  {procurementItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-3 items-center animate-in slide-in-from-left-2">
                      <div className="col-span-5"><input type="text" placeholder="ชื่อรายการสินค้า..." className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-xl font-bold text-xs outline-none focus:border-brand-primary" value={item.item_name} onChange={e => updateItem(idx, 'item_name', e.target.value)} /></div>
                      <div className="col-span-2"><input type="number" placeholder="จำนวน" className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-xl font-bold text-xs outline-none" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} /></div>
                      <div className="col-span-2"><input type="text" placeholder="หน่วย" className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-xl font-bold text-xs outline-none" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} /></div>
                      <div className="col-span-2"><input type="number" placeholder="ราคาต่อหน่วย" className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-xl font-bold text-xs outline-none" value={item.price_per_unit} onChange={e => updateItem(idx, 'price_per_unit', e.target.value)} /></div>
                      <div className="col-span-1 flex justify-end">
                        <button onClick={() => { const next = [...procurementItems]; next.splice(idx, 1); setProcurementItems(next); }} className="text-red-300 hover:text-red-500"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center px-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">รวมงบประมาณทั้งสิ้น</span>
                    <span className="text-xl font-black text-brand-primary">{procurementItems.reduce((s, i) => s + (Number(i.total_price) || 0), 0).toLocaleString()} ฿</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-brand-primary uppercase tracking-widest ml-2">4. ข้อมูลร้านค้า / ผู้ขาย (ถ้ามี)</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <input type="text" placeholder="ชื่อร้านค้า..." className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.vendor_info.name} onChange={e => setNewProcurement({...newProcurement, vendor_info: {...newProcurement.vendor_info, name: e.target.value}})} />
                  <input type="text" placeholder="ที่อยู่ร้านค้า..." className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.vendor_info.address} onChange={e => setNewProcurement({...newProcurement, vendor_info: {...newProcurement.vendor_info, address: e.target.value}})} />
                  <input type="text" placeholder="เลขที่เสียภาษี / บัตรประชาชน..." className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.vendor_info.tax_id} onChange={e => setNewProcurement({...newProcurement, vendor_info: {...newProcurement.vendor_info, tax_id: e.target.value}})} />
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50/50 flex gap-4 border-t border-slate-50">
              <button onClick={() => setIsAddingProcurement(false)} className="flex-1 py-4 rounded-[24px] font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-100">ยกเลิก</button>
              <button onClick={handleAddProcurement} className="flex-[3] py-4 bg-brand-primary text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-green-700 transition-all flex items-center justify-center gap-2"><CheckCircle2 size={18} /> ยืนยันข้อมูลและเตรียมชุดเอกสารจัดซื้อ</button>
            </div>
          </div>
        </div>
      )}

      {/* Identity Footer */}
      <div className="mt-12 flex flex-col items-center justify-center gap-4 py-8 border-t border-slate-100">    
         <div className="flex items-center gap-4 opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
            <img src="logo.png" alt="School Logo" className="w-10 h-10" />
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="text-left">
               <p className="text-[10px] font-black text-slate-800 uppercase tracking-tighter">โรงเรียนบ้านควนโคกยา</p>
               <p className="text-[8px] font-bold text-brand-primary uppercase tracking-widest">Office of Primary Education</p>
            </div>
         </div>
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
            Smart School Admin © 2026 | <span className="text-slate-600">Phairot Makkaew & Gemini AI</span>     
         </p>
      </div>
    </div>
  );
}
