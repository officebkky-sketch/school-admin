import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Zap, 
  Droplets, 
  Phone, 
  Globe, 
  Plus, 
  Save, 
  Printer, 
  Trash2,
  Loader2,
  X,
  Calculator,
  FileText,
  Bot,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { generateUtilityMemoHtml } from '../lib/UtilityDocGenerator';
import { generateAIDraft } from '../lib/aiService';
import garuda15mm from '../assets/saraban/garuda-1.5cm.png';

interface UtilityItem {
  id?: string;
  meter_number: string;
  book_number: string;
  receipt_number: string;
  units_used: string;
  amount: string;
}

export default function Utilities() {
  const { user, profile } = useAuth();
  const [bills, setUtilities] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDrafting, setIsDrafting] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    type: 'electricity',
    academic_year: (new Date().getFullYear() + 543).toString(),
    month: '',
    budget_source: 'เงินงบประมาณ',
    remark: '',
    requester_name: '',
    requester_position: ''
  });

  const [items, setItems] = useState<UtilityItem[]>([
    { meter_number: '', book_number: '', receipt_number: '', units_used: '', amount: '' }
  ]);

  const isDirectorOrAdmin = profile?.role === 'director' || profile?.role === 'admin';

  const fetchUtilities = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('utilities')
      .select('*, utility_items(*)')
      .order('created_at', { ascending: false });
    
    if (error) console.error(error);
    else setUtilities(data || []);
    setLoading(false);
  };

  const fetchInitialData = async () => {
    // 1. Fetch settings
    const { data: sets } = await supabase.from('settings').select('*').maybeSingle();
    setSettings(sets);

    // 2. Fetch teachers
    const { data: teacherData } = await supabase
      .from('teachers')
      .select('*')
      .eq('status', 'active')
      .order('first_name', { ascending: true });
    
    const activeTeachers = teacherData || [];
    setTeachers(activeTeachers);

    // 3. Auto-detect Finance/Budget Head
    const financeTeacher = activeTeachers.find(t => 
      (t.position && t.position.includes('หัวหน้าฝ่ายงบประมาณ')) ||
      (t.department && t.department.includes('หัวหน้าฝ่ายงบประมาณ'))
    ) || activeTeachers.find(t => 
      (t.position && (t.position.includes('การเงิน') || t.position.includes('พัสดุ'))) ||
      (t.department && (t.department.includes('การเงิน') || t.department.includes('งบประมาณ')))
    );

    if (financeTeacher) {
      setFormData(prev => ({
        ...prev,
        requester_name: `${financeTeacher.prefix}${financeTeacher.first_name} ${financeTeacher.last_name}`,
        requester_position: financeTeacher.position || financeTeacher.department || 'หัวหน้าฝ่ายงบประมาณ'
      }));
    }
  };

  useEffect(() => {
    fetchUtilities();
    fetchInitialData();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (!confirm(`ยืนยันการเปลี่ยนสถานะเป็น "${newStatus === 'approved' ? 'อนุมัติแล้ว' : newStatus}" ?`)) return;
    const { error } = await supabase.from('utilities').update({ status: newStatus }).eq('id', id);
    if (error) alert(error.message);
    else fetchUtilities();
  };

  const handleAIDraft = async (bill: any) => {
    setIsDrafting(bill.id);
    try {
      const typeLabel = getLabel(bill.type);
      const prompt = `เขียนเนื้อหาบันทึกข้อความขออนุมัติเบิกจ่ายเงินค่าสาธารณูปโภค ประเภท ${typeLabel} ประจำเดือน ${bill.month} ปีการศึกษา ${bill.academic_year} จำนวนเงินรวม ${bill.amount} บาท โดยมีรายละเอียดบิล ${bill.utility_items?.length} ใบ ให้เขียนด้วยภาษาทางการ สละสลวย ตามระเบียบงานสารบรรณไทย เน้นเหตุผลความจำเป็นและความถูกต้องของหลักฐาน และระบุว่าได้ตรวจสอบความถูกต้องเรียบร้อยแล้ว`;
      
      const draft = await generateAIDraft(prompt);
      if (draft) {
        const { error } = await supabase.from('utilities').update({ remark: draft }).eq('id', bill.id);
        if (error) throw error;
        alert('ร่างเนื้อหาด้วย AI สำเร็จแล้ว! เนื้อหาจะปรากฏในบันทึกข้อความเมื่อสั่งพิมพ์');
        fetchUtilities();
      }
    } catch (err: any) {
      alert('AI Draft Error: ' + err.message);
    } finally {
      setIsDrafting(null);
    }
  };

  const handleTeacherChange = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (teacher) {
      setFormData({
        ...formData,
        requester_name: `${teacher.prefix}${teacher.first_name} ${teacher.last_name}`,
        requester_position: teacher.position || 'ครู'
      });
    }
  };

  const handlePrintMemo = (bill: any) => {
    try {
      // Get current finance head for fallback
      const financeTeacher = teachers.find(t => 
        (t.position && t.position.includes('หัวหน้าฝ่ายงบประมาณ')) ||
        (t.department && t.department.includes('หัวหน้าฝ่ายงบประมาณ'))
      );

      const printSettings = {
        ...settings,
        finance_head_name: financeTeacher ? `${financeTeacher.prefix}${financeTeacher.first_name} ${financeTeacher.last_name}` : ''
      };

      const html = generateUtilityMemoHtml(bill, printSettings, garuda15mm);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
      } else {
        alert('ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาปิดตัวบล็อก Pop-up');
      }
    } catch (err) {
      console.error('Print error:', err);
      alert('เกิดข้อผิดพลาดในการสร้างเอกสาร');
    }
  };

  const addItem = () => {
    setItems([...items, { meter_number: '', book_number: '', receipt_number: '', units_used: '', amount: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof UtilityItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const totalUnits = items.reduce((sum, item) => sum + (parseFloat(item.units_used) || 0), 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้งาน');

      const { data: parent, error: pError } = await supabase
        .from('utilities')
        .insert([{
          ...formData,
          amount: totalAmount,
          units_used: totalUnits,
          created_by: user.id
        }])
        .select()
        .single();

      if (pError) throw pError;

      const itemsToInsert = items.map(item => ({
        utility_id: parent.id,
        meter_number: item.meter_number,
        book_number: item.book_number,
        receipt_number: item.receipt_number,
        units_used: parseFloat(item.units_used) || 0,
        amount: parseFloat(item.amount) || 0
      }));

      const { error: iError } = await supabase.from('utility_items').insert(itemsToInsert);
      if (iError) throw iError;

      setIsModalOpen(false);
      setItems([{ meter_number: '', book_number: '', receipt_number: '', units_used: '', amount: '' }]);
      fetchUtilities();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบรายการนี้?')) return;
    const { error } = await supabase.from('utilities').delete().eq('id', id);
    if (error) alert(error.message);
    else fetchUtilities();
  };

  const toThaiDigits = (num: string | number) => {
    const thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
    return num.toString().split('').map(d => isNaN(parseInt(d)) ? d : thaiDigits[parseInt(d)]).join('');
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'electricity': return <Zap size={20} className="text-yellow-500" />;
      case 'water': return <Droplets size={20} className="text-blue-500" />;
      case 'telephone': return <Phone size={20} className="text-green-500" />;
      case 'internet': return <Globe size={20} className="text-indigo-500" />;
      default: return <FileText size={20} />;
    }
  };

  const getLabel = (type: string) => {
    const map: any = { electricity: 'ค่าไฟฟ้า', water: 'ค่าน้ำประปา', telephone: 'ค่าโทรศัพท์', internet: 'อินเทอร์เน็ต' };
    return map[type] || type;
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'approved': return <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black border border-green-100 flex items-center justify-center gap-1"><CheckCircle2 size={12} /> อนุมัติแล้ว</span>;
      case 'paid': return <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black border border-blue-100 flex items-center justify-center gap-1">เบิกจ่ายแล้ว</span>;
      default: return <span className="px-3 py-1 bg-amber-50 text-orange-600 rounded-full text-[10px] font-black border border-orange-100">รอดำเนินการ</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <div className="bg-brand-primary/10 p-4 rounded-3xl text-brand-primary shadow-sm"><Zap size={32} /></div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">ระบบเบิกค่าสาธารณูปโภค</h2>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">จัดการสถานะการเบิกจ่ายและร่างบันทึกด้วย AI</p>
            </div>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-brand-primary text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-green-100 hover:bg-green-700 transition-all active:scale-95"
          >
            <Plus size={20} /> เพิ่มรายการเบิกใหม่
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="py-4">ประเภท / ประจำเดือน</th>
                <th className="py-4 text-center">จำนวนบิล</th>
                <th className="py-4 text-right">ยอดรวม (บาท)</th>
                <th className="py-4 text-center">สถานะ</th>
                <th className="py-4 text-center">จัดการและร่าง AI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {bills.map((bill) => (
                <tr key={bill.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="py-5">
                    <div className="flex items-center gap-3">
                      {getIcon(bill.type)}
                      <div>
                        <p className="font-bold text-slate-700 leading-none">{getLabel(bill.type)}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">{bill.month} / {toThaiDigits(bill.academic_year)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-5 text-center font-bold text-slate-600">{bill.utility_items?.length || 0} ใบ</td>
                  <td className="py-5 text-right font-black text-slate-800">{bill.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="py-5 text-center">
                    {getStatusBadge(bill.status)}
                  </td>
                  <td className="py-5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button 
                        onClick={() => handleAIDraft(bill)}
                        disabled={isDrafting === bill.id}
                        className={`p-2 rounded-xl transition-all ${bill.remark ? 'text-brand-primary bg-green-50' : 'text-slate-400 hover:text-brand-primary bg-slate-50'}`}
                        title="ร่างบันทึกข้อความด้วย AI"
                      >
                        {isDrafting === bill.id ? <Loader2 size={18} className="animate-spin" /> : <Bot size={18} />}
                      </button>
                      <button 
                        onClick={() => handlePrintMemo(bill)}
                        className="p-2 text-slate-400 hover:text-blue-500 bg-slate-50 rounded-xl transition-all" 
                        title="พิมพ์บันทึกข้อความ"
                      >
                        <Printer size={18} />
                      </button>
                      {bill.status === 'pending' && isDirectorOrAdmin && (
                        <button 
                          onClick={() => handleUpdateStatus(bill.id, 'approved')}
                          className="p-2 text-slate-400 hover:text-green-500 bg-slate-50 rounded-xl transition-all" 
                          title="อนุมัติรายการ"
                        >
                          <ShieldCheck size={18} />
                        </button>
                      )}
                      {(isDirectorOrAdmin || bill.created_by === user?.id) && (
                        <button onClick={() => handleDelete(bill.id)} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-xl transition-all" title="ลบรายการ"><Trash2 size={18} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {bills.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest">ไม่พบข้อมูลรายการเบิก</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal remains the same but with added fields if needed */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-4xl p-10 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-800">บันทึกรายการเบิกจ่าย</h3>
                <p className="text-sm font-bold text-slate-400">กรอกข้อมูลและรายละเอียดบิลแต่ละใบ</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400"><X size={24} /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ประเภทสาธารณูปโภค</label>
                  <select 
                    className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold"
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="electricity">ค่าไฟฟ้า</option>
                    <option value="water">ค่าน้ำประปา</option>
                    <option value="telephone">ค่าโทรศัพท์</option>
                    <option value="internet">อินเทอร์เน็ต</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ปีการศึกษา</label>
                  <input 
                    type="text" className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold"
                    value={formData.academic_year}
                    onChange={e => setFormData({...formData, academic_year: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ประจำเดือน</label>
                  <select 
                    className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold"
                    value={formData.month}
                    onChange={e => setFormData({...formData, month: e.target.value})}
                    required
                  >
                    <option value="">เลือกเดือน</option>
                    {['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <h4 className="font-black text-slate-700 text-sm uppercase tracking-widest border-l-4 border-blue-400 pl-3">รายละเอียดใบแจ้งหนี้ (บิล)</h4>
                  <button 
                    type="button" onClick={addItem}
                    className="text-xs font-black text-brand-primary hover:text-green-700 flex items-center gap-1"
                  >
                    <Plus size={14} /> เพิ่มบิลอีกใบ
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-3 p-6 bg-slate-50/50 rounded-3xl border border-slate-100 relative group">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">เลขที่มิเตอร์</label>
                        <input 
                          type="text" placeholder="มิเตอร์" className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                          value={item.meter_number} onChange={e => updateItem(index, 'meter_number', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">เล่มที่</label>
                        <input 
                          type="text" placeholder="เล่มที่" className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                          value={item.book_number} onChange={e => updateItem(index, 'book_number', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 md:col-span-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">เลขที่</label>
                        <input 
                          type="text" placeholder="เลขที่" className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                          value={item.receipt_number} onChange={e => updateItem(index, 'receipt_number', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">หน่วยที่ใช้</label>
                        <input 
                          type="number" placeholder="0" className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                          value={item.units_used} onChange={e => updateItem(index, 'units_used', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase">จำนวนเงิน (บาท)</label>
                        <input 
                          type="number" step="0.01" placeholder="0.00" className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                          value={item.amount} onChange={e => updateItem(index, 'amount', e.target.value)}
                          required
                        />
                      </div>
                      {items.length > 1 && (
                        <button 
                          type="button" onClick={() => removeItem(index)}
                          className="absolute -right-2 -top-2 bg-white text-red-500 p-1.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity border border-red-50"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-900 rounded-3xl p-8 text-white flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="bg-white/10 p-3 rounded-2xl"><Calculator size={28} /></div>
                  <div>
                    <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest leading-none mb-1">สรุปยอดรวมเบิกจ่าย</p>
                    <p className="text-3xl font-black tracking-tighter">{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-sm">บาท</span></p>
                  </div>
                </div>
                <div className="flex gap-8 text-right">
                  <div>
                    <p className="text-[10px] font-black text-blue-300 uppercase">รวมบิล</p>
                    <p className="text-xl font-black">{items.length} ใบ</p>
                  </div>
                  <div className="w-px h-10 bg-white/10"></div>
                  <div>
                    <p className="text-[10px] font-black text-blue-300 uppercase">รวมหน่วย</p>
                    <p className="text-xl font-black">{totalUnits.toLocaleString()} หน่วย</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ผู้เบิก (เลือกจากรายชื่อครู)</label>
                  <select 
                    className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold"
                    value={teachers.find(t => `${t.prefix}${t.first_name} ${t.last_name}` === formData.requester_name)?.id || ''}
                    onChange={e => handleTeacherChange(e.target.value)}
                    required
                  >
                    <option value="">เลือกครูผู้เบิก</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.prefix}{t.first_name} {t.last_name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">แหล่งงบประมาณ</label>
                  <select 
                    className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold"
                    value={formData.budget_source}
                    onChange={e => setFormData({...formData, budget_source: e.target.value})}
                  >
                    <option value="เงินงบประมาณ">เงินงบประมาณ</option>
                    <option value="เงินรายได้สถานศึกษา">เงินรายได้สถานศึกษา</option>
                    <option value="เงินนอกงบประมาณ">เงินนอกงบประมาณ</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-slate-50">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 hover:text-slate-600 transition-colors">ยกเลิกรายการ</button>
                <button 
                  type="submit" disabled={loading}
                  className="flex-1 bg-brand-primary text-white py-4 rounded-[24px] font-black text-lg shadow-xl shadow-green-100 flex items-center justify-center gap-2 hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />} บันทึกและสรุปยอด
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
