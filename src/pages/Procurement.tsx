import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { extractProjectsFromKnowledge } from '../lib/aiService';
import { 
  Package, 
  ShoppingCart, 
  Store, 
  Plus,
  FileText,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  ArrowRight,
  TrendingUp,
  Wallet,
  Loader2,
  ArrowLeftRight,
  Calendar,
  FileBadge,
  Sparkles,
  Users,
  FileCheck
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
  const [transfers, setTransfers] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);

  // Form States
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isAddingBudgetSource, setIsAddingBudgetSource] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAddingProcurement, setIsAddingProcurement] = useState(false);
  const [isEditingProcurement, setIsEditingProcurement] = useState(false);
  const [selectedProcurementId, setSelectedProcurementId] = useState<string | null>(null);
  const [isDocumentCenterOpen, setIsDocumentCenterOpen] = useState(false);
  const [selectedProcurement, setSelectedProcurement] = useState<any>(null);
  const [activeDocId, setActiveDocId] = useState<string>('request');
  const [pastVendors, setPastVendors] = useState<any[]>([]);

  const PROCUREMENT_DOCS = [
    { id: 'request', name: 'รายงานขอซื้อขอจ้าง', icon: <FileText size={18} />, description: 'เอกสารเริ่มต้นขออนุมัติจัดซื้อจัดจ้าง' },
    { id: 'appointment', name: 'คำสั่งแต่งตั้งคณะกรรมการ', icon: <Users size={18} />, description: 'แต่งตั้งผู้ตรวจรับ/คณะกรรมการ' },
    { id: 'notice_winner', name: 'ประกาศผู้ชนะการเสนอราคา', icon: <CheckCircle2 size={18} />, description: 'แจ้งผลการคัดเลือกผู้ขาย/ผู้รับจ้าง' },
    { id: 'po', name: 'ใบสั่งซื้อ/ใบสั่งจ้าง (PO)', icon: <Package size={18} />, description: 'เอกสารยืนยันการสั่งซื้อกับร้านค้า' },
    { id: 'delivery', name: 'ใบส่งมอบพัสดุ', icon: <ArrowRight size={18} />, description: 'แบบฟอร์มสำหรับร้านค้าส่งของ' },
    { id: 'inspection', name: 'ใบตรวจรับพัสดุ', icon: <CheckCircle2 size={18} />, description: 'หลักฐานการตรวจรับพัสดุ' },
    { id: 'report_inspection', name: 'บันทึกรายงานผลการตรวจรับ', icon: <FileText size={18} />, description: 'รายงานผลให้ผู้บริหารทราบ' }
  ];

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
    delivery_days: 15,
    necessity_reason: '',
    evaluation_criteria: 'เกณฑ์ราคา',
    budget_source_detail: '',
    officer_id: '',
    head_officer_id: '',
    committees: [
      { teacher_id: '', role: 'ประธานกรรมการ' }
    ] as { teacher_id: string, role: string }[],
    document_set_id: 'material_egp',
    vendor_info: {
      name: '',
      address: '',
      tax_id: ''
    },
    doc_number: '',
    order_number: '',
    po_number: '',
    po_date: new Date().toISOString().split('T')[0],
    delivery_date: new Date().toISOString().split('T')[0],
    inspection_date: new Date().toISOString().split('T')[0],
    payment_approval_date: new Date().toISOString().split('T')[0]
  });

  const [procurementItems, setProcurementItems] = useState<any[]>([
    { item_name: '', quantity: 1, unit: 'รายการ', price_per_unit: 0, total_price: 0 }
  ]);

  // Local Transfer/Budget Source Data
  const [newTransfer, setNewTransfer] = useState({ from_project_id: '', to_project_id: '', amount: 0, reason: '' });
  const [newBudgetSource, setNewBudgetSource] = useState({ academic_year: '2569', budget_type: 'งบอุดหนุน', category_name: '', amount: 0 });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchTabData();
  }, [activeTab]);

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

  function addCommitteeMember() {
    setNewProcurement({
      ...newProcurement,
      committees: [...newProcurement.committees, { teacher_id: '', role: 'กรรมการ' }]
    });
  }

  function updateCommitteeMember(index: number, field: string, value: string) {
    const next = [...newProcurement.committees];
    next[index] = { ...next[index], [field]: value as any };
    setNewProcurement({ ...newProcurement, committees: next });
  }

  function removeCommitteeMember(index: number) {
    const next = [...newProcurement.committees];
    next.splice(index, 1);
    setNewProcurement({ ...newProcurement, committees: next });
  }

  async function fetchInitialData() {
    try {
      // ดึงข้อมูลพื้นฐานที่ต้องใช้ในหลายส่วนเพียงครั้งเดียว
      const [budRes, teachRes, procRes] = await Promise.all([
        supabase.from('budget_allocations').select('*'),
        supabase.from('teachers').select('*').order('first_name'),
        supabase.from('procurement_projects').select('vendor_info').order('created_at', { ascending: false })
      ]);

      if (budRes.data) setBudgets(budRes.data);
      if (teachRes.data) setTeachers(teachRes.data);

      if (procRes.data) {
        const uniqueVendors: any[] = [];
        const seenNames = new Set();
        procRes.data.forEach((p: any) => {
          if (p.vendor_info && p.vendor_info.name && p.vendor_info.name.trim() !== '') {
            const nameNormalized = p.vendor_info.name.trim().toLowerCase();
            if (!seenNames.has(nameNormalized)) {
              seenNames.add(nameNormalized);
              uniqueVendors.push(p.vendor_info);
            }
          }
        });
        setPastVendors(uniqueVendors);
      }
    } catch (err) {
      console.error('Initial Fetch Error:', err);
    }
  }

  async function fetchTabData() {
    setLoading(true);
    setFetchError(null);
    try {
      if (activeTab === 'overview') {
        const { data, error } = await supabase
          .from('procurement_projects')
          .select(`*, vendors(vendor_name), school_projects(project_name)`)
          .order('created_at', { ascending: false })
          .limit(10);
        if (error) throw error;
        setProcurements(data || []);
      } 
      
      else if (activeTab === 'projects') {
        const { data, error } = await supabase
          .from('school_projects')
          .select(`*, budget_allocations(category_name)`)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setProjects(data || []);
      } 
      
      else if (activeTab === 'transfers') {
        const { data, error } = await supabase
          .from('budget_transfers')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setTransfers(data || []);
      }
      
      // ข้อมูลอื่นๆ จะถูกโหลดเมื่อมีการใช้งานจริง
    } catch (err: any) {
      console.error('Tab Fetch Error:', err);
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // แผนสำรองสำหรับการดึงข้อมูลทั้งหมดเมื่อจำเป็น
  async function fetchData() {
    await fetchInitialData();
    await fetchTabData();
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
          // การจับคู่งบประมาณที่ฉลาดและยืดหยุ่นขึ้น
          const matchedBudget = budgets.find(b => {
            const bt = b.budget_type?.toLowerCase() || '';
            const cn = b.category_name?.toLowerCase() || '';
            const pbt = p.budget_type?.toLowerCase() || '';
            
            if (pbt.includes('อุดหนุน') || pbt.includes('รายหัว') || pbt.includes('เรียนฟรี')) {
              return bt.includes('อุดหนุน');
            }
            if (pbt.includes('รายได้') || pbt.includes('บำรุง')) {
              return bt.includes('รายได้') || cn.includes('รายได้');
            }
            
            return pbt.includes(bt) || bt.includes(pbt) || cn.includes(pbt) || pbt.includes(cn);
          });

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
    if (!user) {
      alert('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ครับ');
      return;
    }

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
    if (!confirm(`ยืนยันการลบโครงการ "${name}"? ข้อมูลการจัดซื้อที่เกี่ยวข้องจะถูกลบออกทั้งหมด`)) return;
    try {
      await supabase.from('school_projects').delete().eq('id', id);
      fetchData();
    } catch (err: any) { alert(err.message); }
  }

  async function handleDeleteProcurement(id: string, name: string) {
    if (!confirm(`ยืนยันการลบรายการจัดซื้อ "${name}"?`)) return;
    try {
      const { error } = await supabase.from('procurement_projects').delete().eq('id', id);
      if (error) throw error;
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
    if (!user) {
      alert('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ครับ');
      return;
    }

    if (!newTransfer.from_project_id || !newTransfer.to_project_id || newTransfer.amount <= 0) {
      alert('กรุณากรอกข้อมูลการโอนให้ครบถ้วนและถูกต้องครับ');
      return;
    }

    if (newTransfer.from_project_id === newTransfer.to_project_id) {
      alert('ไม่สามารถโอนเงินในโครงการเดียวกันได้ครับ');
      return;
    }

    setLoading(true);
    try {
      // ใช้ RPC (Stored Procedure) เพื่อให้ทำงานแบบ Transaction (Atomic)
      // ป้องกันยอดเงินไม่สมดุลหากเกิดข้อผิดพลาดระหว่างทาง
      const { error } = await supabase.rpc('transfer_budget', {
        p_from_project_id: newTransfer.from_project_id,
        p_to_project_id: newTransfer.to_project_id,
        p_amount: Number(newTransfer.amount),
        p_reason: newTransfer.reason || 'ถัวจ่ายงบประมาณ',
        p_user_id: user.id
      });

      if (error) throw error;

      alert('โอนงบประมาณสำเร็จเรียบร้อยแล้วครับ');
      setIsTransferring(false);
      setNewTransfer({ from_project_id: '', to_project_id: '', amount: 0, reason: '' });
      await fetchData();
    } catch (err: any) { 
      console.error('Transfer Error:', err);
      alert(err.message || 'เกิดข้อผิดพลาดในการโอนงบประมาณ'); 
    } finally {
      setLoading(false);
    }
  }

  async function openEditProcurementModal(procurement: any) {
    setSelectedProcurementId(procurement.id);
    
    // แปลงข้อมูลกรรมการจาก JSON ใน DB มาลง State
    const savedCommittees = procurement.committee_json || [];
    const initialCommittees = savedCommittees.length > 0 
      ? savedCommittees 
      : [{ teacher_id: '', role: 'ผู้ตรวจรับพัสดุ' }];

    setNewProcurement({
      project_id: procurement.project_id,
      vendor_id: procurement.vendor_id || '',
      project_name: procurement.project_name,
      academic_year: procurement.academic_year,
      method: procurement.method,
      procurement_type: procurement.procurement_type,
      order_date: procurement.order_date,
      delivery_days: procurement.delivery_days || 15,
      necessity_reason: procurement.necessity_reason || '',
      evaluation_criteria: procurement.evaluation_criteria || 'เกณฑ์ราคา',
      budget_source_detail: procurement.budget_source_detail || '',
      officer_id: procurement.officer_id || '',
      head_officer_id: procurement.head_officer_id || '',
      committees: initialCommittees,
      document_set_id: procurement.document_set_id || 'material_egp',
      vendor_info: procurement.vendor_info || { name: '', address: '', tax_id: '' },
      doc_number: procurement.doc_number || '',
      order_number: procurement.order_number || '',
      po_number: procurement.po_number || '',
      po_date: procurement.po_date || new Date().toISOString().split('T')[0],
      delivery_date: procurement.delivery_date || new Date().toISOString().split('T')[0],
      inspection_date: procurement.inspection_date || new Date().toISOString().split('T')[0],
      payment_approval_date: procurement.payment_approval_date || new Date().toISOString().split('T')[0]
    });

    // ดึงรายการสินค้าเดิม
    const { data: items } = await supabase.from('procurement_items').select('*').eq('procurement_id', procurement.id);
    setProcurementItems(items && items.length > 0 ? items : [{ item_name: '', quantity: 1, unit: 'รายการ', price_per_unit: 0, total_price: 0 }]);
    
    setIsEditingProcurement(true);
    setIsAddingProcurement(true);
  }

  async function handleCreateOrderFromProcurement(procurement: any) {
    if (!confirm(`คุณต้องการสร้างร่างคำสั่งแต่งตั้งคณะกรรมการจัดซื้อจัดจ้างสำหรับโครงการ "${procurement.project_name}" ใช่หรือไม่?`)) return;
    
    try {
      // 1. ตรวจสอบว่าเคยสร้างคำสั่งสำหรับโครงการนี้ไว้แล้วหรือยัง
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('status', 'pending')
        .contains('remark', `"source_procurement_id":"${procurement.id}"`)
        .maybeSingle();

      if (existingOrder) {
        if (confirm(`โครงการนี้เคยสร้างร่างคำสั่งไว้แล้ว (สถานะรออนุมัติ) ต้องการสลับไปยังหน้าคำสั่งเพื่อดูร่างนั้นทันทีหรือไม่?`)) {
          window.dispatchEvent(new CustomEvent('change-tab', { detail: 'orders' }));
        }
        return;
      }

      // ดึงข้อมูลการตั้งค่าโรงเรียน
      const { data: settings } = await supabase.from('settings').select('*').single();
      const schoolName = settings?.school_name || 'โรงเรียนบ้านควนโคกยา';
      const directorName = settings?.director_name || '';

      // ดึงข้อมูลกรรมการ
      const savedCommittees = procurement.committee_json || [];

      // 2. สร้างโครงร่างเนื้อหาคำสั่ง
      const projectType = procurement.procurement_type || 'ซื้อ';
      const buyMethod = procurement.method || 'เฉพาะเจาะจง';
      const totalAmountText = Number(procurement.total_amount || 0).toLocaleString();

      const orderContent = `ด้วย ${schoolName} มีความประสงค์จะดำเนินการจัด${projectType}พัสดุ ${procurement.project_name} โดยวิธี${buyMethod} เป็นเงินทั้งสิ้น ${totalAmountText} บาท (${bahtText(procurement.total_amount || 0)}) เพื่อให้เป็นไปตามกฎระเบียบและแนวทางปฏิบัติภาครัฐ\nอาศัยอำนาจตามความในมาตรา ๓๙ แห่งพระราชบัญญัติระเบียบบริหารราชการกระทรวงศึกษาธิการ พ.ศ. ๒๕๔๖ และมาตรา ๒๗ แห่งพระราชบัญญัติระเบียบข้าราชการครูและบุคลากรทางการศึกษา พ.ศ. ๒๕๔๗ จึงขอแต่งตั้งคณะกรรมการจัดซื้อจัดจ้างและตรวจรับพัสดุสำหรับโครงการดังกล่าว โดยมีรายชื่อและบทบาทหน้าที่ดังต่อไปนี้`;

      const extraData = {
        content: orderContent,
        committees: savedCommittees,
        legal_refs: [
          "พระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560",
          "ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560"
        ],
        source_procurement_id: procurement.id,
        sign_name: directorName,
        sign_position: `ผู้อำนวยการ${schoolName}`
      };

      // 3. แทรกข้อมูลร่างคำสั่งในตาราง orders
      const { error } = await supabase.from('orders').insert([{
        order_number: 'รออนุมัติ',
        subject: `แต่งตั้งคณะกรรมการจัดซื้อจัดจ้างและตรวจรับพัสดุ โครงการ ${procurement.project_name}`,
        issuer: schoolName,
        order_date: new Date().toISOString().split('T')[0],
        remark: JSON.stringify(extraData),
        status: 'pending',
        created_by: user?.id
      }]);

      if (error) throw error;

      alert('สร้างร่างคำสั่งแต่งตั้งคณะกรรมการในงานสารบรรณสำเร็จแล้ว! ระบบกำลังนำท่านไปยังหน้าทะเบียนคำสั่ง');
      // สั่งเปลี่ยนหน้า Tab ไปยังหน้า 'orders'
      window.dispatchEvent(new CustomEvent('change-tab', { detail: 'orders' }));

    } catch (err: any) {
      console.error(err);
      alert('สร้างคำสั่งไม่สำเร็จ: ' + err.message);
    }
  }

  function bahtText(num: number): string {
    if (!num || isNaN(num)) return 'ศูนย์บาทถ้วน';
    const thaiNums = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const thaiPositions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    
    let str = Math.floor(num).toString();
    let text = '';
    const len = str.length;
    
    for (let i = 0; i < len; i++) {
      const digit = parseInt(str.charAt(i));
      const pos = len - i - 1;
      if (digit !== 0) {
        if (pos % 6 === 1 && digit === 1) {
          text += 'เอ็ด';
        } else if (pos % 6 === 1 && digit === 2) {
          text += 'ยี่';
        } else if (pos % 6 === 0 && digit === 1 && i > 0) {
          text += 'เอ็ด';
        } else {
          text += thaiNums[digit];
        }
        text += thaiPositions[pos % 6];
      }
      if (pos % 6 === 0 && pos > 0) {
        text += 'ล้าน';
      }
    }
    
    text = text.replace('หนึ่งสิบ', 'สิบ');
    text = text.replace('สองสิบ', 'ยี่สิบ');
    text = text.replace('สิบหนึ่ง', 'สิบเอ็ด');
    
    return text + 'บาทถ้วน';
  }

  async function handleAddProcurement() {
    if (!user) {
      alert('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ครับ');
      return;
    }

    if (!newProcurement.project_id || !newProcurement.project_name || !newProcurement.officer_id) {
      alert('กรุณากรอกข้อมูลโครงการและระบุเจ้าหน้าที่ให้ครบถ้วนครับ');
      return;
    }

    const validCommittees = newProcurement.committees.filter(c => c.teacher_id !== '');
    if (validCommittees.length === 0) {
      alert('กรุณาระบุรายชื่อผู้ตรวจรับหรือคณะกรรมการอย่างน้อย 1 ท่านครับ');
      return;
    }

    setLoading(true);
    try {
      const procurementData = {
        project_id: newProcurement.project_id,
        vendor_id: newProcurement.vendor_id || null,
        project_name: newProcurement.project_name,
        academic_year: newProcurement.academic_year,
        method: newProcurement.method,
        procurement_type: newProcurement.procurement_type,
        order_date: newProcurement.order_date,
        delivery_days: newProcurement.delivery_days,
        necessity_reason: newProcurement.necessity_reason,
        evaluation_criteria: newProcurement.evaluation_criteria,
        budget_source_detail: newProcurement.budget_source_detail,
        officer_id: newProcurement.officer_id,
        head_officer_id: newProcurement.head_officer_id,
        committee_json: validCommittees,
        vendor_info: newProcurement.vendor_info,
        total_amount: procurementItems.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0),
        status: 'draft',
        created_by: user.id,
        doc_number: newProcurement.doc_number || null,
        order_number: newProcurement.order_number || null,
        po_number: newProcurement.po_number || null,
        po_date: newProcurement.po_date || null,
        delivery_date: newProcurement.delivery_date || null,
        inspection_date: newProcurement.inspection_date || null,
        payment_approval_date: newProcurement.payment_approval_date || null
      };

      let mainId = selectedProcurementId;

      if (isEditingProcurement && selectedProcurementId) {
        const { error } = await supabase.from('procurement_projects').update(procurementData).eq('id', selectedProcurementId);
        if (error) throw error;
        
        // ลบรายการเดิมทิ้งแล้วใส่ใหม่ (วิธีที่ง่ายและปลอดภัยที่สุดสำหรับชุดข้อมูลเล็ก)
        await supabase.from('procurement_items').delete().eq('procurement_id', selectedProcurementId);
      } else {
        const { data: mainData, error: mainErr } = await supabase
          .from('procurement_projects')
          .insert([procurementData])
          .select().single();
        if (mainErr) throw mainErr;
        mainId = mainData.id;
      }

      const itemsToInsert = procurementItems.map(item => ({
        procurement_id: mainId,
        item_name: item.item_name,
        quantity: item.quantity,
        unit: item.unit,
        price_per_unit: item.price_per_unit,
        total_price: item.total_price
      }));

      await supabase.from('procurement_items').insert(itemsToInsert);
      
      // ส่งแจ้งเตือน Line Proactive Alert หลังบันทึกข้อมูลจัดซื้อสำเร็จ
      const notifyLineUsers = async () => {
        try {
          const usersToNotify: { userId: string, msg: string }[] = [];
          
          const officer = teachers.find(t => t.id === newProcurement.officer_id);
          if (officer && officer.line_user_id) {
            usersToNotify.push({
              userId: officer.line_user_id,
              msg: `📢 แจ้งเตือนงานพัสดุ:\nคุณครูได้รับการบันทึกข้อมูลในโครงการ "${newProcurement.project_name}" เป็น "เจ้าหน้าที่พัสดุ" เรียบร้อยแล้วค่ะ 🌸\nเลขที่บันทึกข้อความ: ${newProcurement.doc_number || '-'}`
            });
          }

          const headOfficer = teachers.find(t => t.id === newProcurement.head_officer_id);
          if (headOfficer && headOfficer.line_user_id) {
            usersToNotify.push({
              userId: headOfficer.line_user_id,
              msg: `📢 แจ้งเตือนงานพัสดุ:\nคุณครูได้รับการบันทึกข้อมูลในโครงการ "${newProcurement.project_name}" เป็น "หัวหน้าเจ้าหน้าที่พัสดุ" เรียบร้อยแล้วค่ะ 🌸\nเลขที่บันทึกข้อความ: ${newProcurement.doc_number || '-'}`
            });
          }

          newProcurement.committees.forEach(c => {
            const commTeacher = teachers.find(t => t.id === c.teacher_id);
            if (commTeacher && commTeacher.line_user_id) {
              usersToNotify.push({
                userId: commTeacher.line_user_id,
                msg: `📢 แจ้งเตือนแต่งตั้งกรรมการ:\nแต่งตั้งคุณครูเป็น "${c.role || 'ผู้ตรวจรับพัสดุ'}" สำหรับโครงการ "${newProcurement.project_name}" แล้วนะคะ 🌸\nเลขที่คำสั่ง: ที่ ${newProcurement.order_number || '-'}`
              });
            }
          });

          for (const user of usersToNotify) {
            await fetch('https://school-admin-psi.vercel.app/api/line-webhook', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lineUserId: user.userId, message: user.msg })
            }).catch(err => console.error("Line notify fetch err:", err));
          }
        } catch (err) {
          console.error("Line notification trigger err:", err);
        }
      };

      alert(isEditingProcurement ? 'อัปเดตข้อมูลเรียบร้อยแล้วครับ' : 'บันทึกข้อมูลจัดซื้อเรียบร้อยแล้วครับ');
      notifyLineUsers();

      setIsAddingProcurement(false);
      setIsEditingProcurement(false);
      setSelectedProcurementId(null);
      fetchData();
    } catch (err: any) { 
      console.error('Procurement Error:', err);
      alert(err.message); 
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenDocumentCenter(procurement: any) {
    // ดึงข้อมูลรายการสินค้ามาด้วยเพื่อให้ AI มีข้อมูลครบ
    const { data: items } = await supabase.from('procurement_items').select('*').eq('procurement_id', procurement.id);
    setSelectedProcurement({ ...procurement, items: items || [] });
    setIsDocumentCenterOpen(true);
  }

  async function handleAIDraftDocument(docType: string) {
    if (!selectedProcurement) return;
    setIsExtracting(true);
    try {
      const { data: settings } = await supabase.from('settings').select('gemini_api_key, ai_cowork_api_key').single();
      const apiKey = settings?.ai_cowork_api_key || settings?.gemini_api_key;
      const { generateAIDraft } = await import('../lib/aiService');
      
      const itemsList = selectedProcurement.items.map((i: any) => `- ${i.item_name} จำนวน ${i.quantity} ${i.unit} ราคาหน่วยละ ${i.price_per_unit} บาท`).join('\n');
      
      const prompt = `เขียน "เนื้อหาภายใน" สำหรับเอกสารประเภท "${docType}" ของงานพัสดุโรงเรียน
      โดยใช้ข้อมูลดังนี้:
      - ชื่อรายการ/โครงการ: ${selectedProcurement.project_name}
      - รายการพัสดุ: ${itemsList}
      - งบประมาณรวม: ${selectedProcurement.total_amount} บาท
      - เหตุผลความจำเป็น: ${selectedProcurement.necessity_reason}
      
      กฎเหล็ก:
      1. ร่างเฉพาะ "เนื้อความส่วนเนื้อหา" เท่านั้น ห้ามใส่ส่วนหัว (เช่น บันทึกข้อความ, ส่วนราชการ, ที่, วันที่, เรื่อง, เรียน) เพราะระบบมีส่วนหัวอยู่แล้ว
      2. ห้ามใช้สัญลักษณ์ Markdown เช่น ** หรือ # 
      3. ห้ามมีคำนำหน้าหรือคำลงท้ายที่คุยกับผู้ใช้ (เช่น นี่คือร่างเนื้อหา...)
      4. ใช้ภาษาราชการที่เป็นทางการที่สุด
      5. แบ่งเป็นหัวข้อ 1. ความเป็นมา 2. รายละเอียด 3. งบประมาณ 4. ข้อเสนอพิจารณา ให้ชัดเจน`;
      
      const draft = await generateAIDraft(prompt, apiKey);
      
      // บันทึกร่างที่ AI สร้างไว้ในสถานะของโครงการ
      const updatedDrafts = { ...(selectedProcurement.ai_draft_content || {}), [docType]: draft };
      await supabase.from('procurement_projects').update({ ai_draft_content: updatedDrafts }).eq('id', selectedProcurement.id);
      
      setSelectedProcurement({ ...selectedProcurement, ai_draft_content: updatedDrafts });
      alert(`ร่างเนื้อหา ${docType} สำเร็จแล้วครับ`);
    } catch (err: any) { alert(err.message); }
    finally { setIsExtracting(false); }
  }

  async function handleDownloadPDF(docId: string) {
    if (!selectedProcurement) return;
    
    // บางใบอาจจะใช้ร่าง AI บางใบอาจใช้แบบฟอร์มตายตัว
    const draftContent = selectedProcurement.ai_draft_content?.[docId] || '';
    
    setLoading(true);
    try {
      const { generateProcurementDoc } = await import('../lib/ProcurementDocGenerator');
      
      const { data: settings } = await supabase.from('settings').select('director_name').single();
      
      const officer = teachers.find(t => t.id === selectedProcurement.officer_id);
      const officerName = officer ? `${officer.prefix}${officer.first_name} ${officer.last_name}` : '';
      
      const headOfficer = teachers.find(t => t.id === selectedProcurement.head_officer_id);
      const headOfficerName = headOfficer ? `${headOfficer.prefix}${headOfficer.first_name} ${headOfficer.last_name}` : '';

      // ดึงรายชื่อกรรมการพร้อมตำแหน่ง (แบบใหม่)
      const resolvedCommittees = (selectedProcurement.committee_json || []).map((c: any) => {
        const t = teachers.find(teach => teach.id === c.teacher_id);
        return {
          name: t ? `${t.prefix}${t.first_name} ${t.last_name}` : '................................................',
          role: c.role
        };
      });
      
      const blob = await generateProcurementDoc(
        docId,
        { 
          ...selectedProcurement, 
          officerName, 
          headOfficerName, 
          committees: resolvedCommittees,
          directorName: settings?.director_name || '................................................' 
        },
        draftContent
      );
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docId}_${selectedProcurement.project_name}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการสร้าง PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
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
                  <button onClick={() => {
                    setIsEditingProcurement(false);
                    setSelectedProcurementId(null);
                    setNewProcurement({
                      project_id: '',
                      vendor_id: '',
                      project_name: '',
                      academic_year: '2569',
                      method: 'เฉพาะเจาะจง',
                      procurement_type: 'ซื้อ',
                      order_date: new Date().toISOString().split('T')[0],
                      delivery_days: 15,
                      necessity_reason: '',
                      evaluation_criteria: 'เกณฑ์ราคา',
                      budget_source_detail: '',
                      officer_id: '',
                      head_officer_id: '',
                      committees: [{ teacher_id: '', role: 'ประธานกรรมการ' }],
                      document_set_id: 'material_egp',
                      vendor_info: { name: '', address: '', tax_id: '' },
                      doc_number: '',
                      order_number: '',
                      po_number: '',
                      po_date: new Date().toISOString().split('T')[0],
                      delivery_date: new Date().toISOString().split('T')[0],
                      inspection_date: new Date().toISOString().split('T')[0],
                      payment_approval_date: new Date().toISOString().split('T')[0]
                    });
                    setProcurementItems([{ item_name: '', quantity: 1, unit: 'รายการ', price_per_unit: 0, total_price: 0 }]);
                    setIsAddingProcurement(true);
                  }} className="bg-brand-primary text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-green-700 transition-all">+ เริ่มจัดซื้อใหม่</button>
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
                               <td className="px-8 py-5 text-right flex justify-end gap-2">
                                 <button onClick={() => handleOpenDocumentCenter(p)} className="p-2 text-brand-primary hover:bg-green-50 rounded-lg transition-all active:scale-90" title="จัดการเอกสาร"><FileText size={18} /></button>
                                 <button onClick={() => handleCreateOrderFromProcurement(p)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-all active:scale-90" title="ร่างคำสั่งแต่งตั้ง (งานสารบรรณ)"><FileCheck size={18} /></button>
                                 <button onClick={() => openEditProcurementModal(p)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all active:scale-90" title="แก้ไขข้อมูล"><Edit2 size={16} /></button>
                                 <button onClick={() => handleDeleteProcurement(p.id, p.project_name)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                               </td>
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
                <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3"><Sparkles className="text-brand-primary" size={28} /> {isEditingProcurement ? 'แก้ไขการจัดซื้ออัจฉริยะ' : 'เริ่มการจัดซื้ออัจฉริยะ'}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{isEditingProcurement ? 'ปรับปรุงข้อมูลเพื่อออกชุดเอกสารใหม่' : 'กรอกข้อมูลเพื่อสร้างชุดเอกสาร 17 รายการอัตโนมัติ'}</p>
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
                  
                  <div className="grid grid-cols-3 gap-4">
                    <select className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:bg-white transition-all" value={newProcurement.procurement_type} onChange={e => setNewProcurement({...newProcurement, procurement_type: e.target.value})}>
                      <option value="ซื้อ">ประเภท: ซื้อ</option>
                      <option value="จ้าง">ประเภท: จ้าง</option>
                    </select>
                    <select className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.document_set_id} onChange={e => setNewProcurement({...newProcurement, document_set_id: e.target.value})}>
                      {DOCUMENT_SETS.map(set => <option key={set.id} value={set.id}>{set.name}</option>)}
                    </select>
                    <input type="text" placeholder="แหล่งเงิน (เช่น เงินอุดหนุนรายหัว)..." className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.budget_source_detail} onChange={e => setNewProcurement({...newProcurement, budget_source_detail: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-4">
                   <label className="text-[10px] font-black text-brand-primary uppercase tracking-widest ml-2">2. เจ้าหน้าที่และคณะกรรมการ</label>
                   <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">เจ้าหน้าที่พัสดุ</label>
                        <select className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.officer_id} onChange={e => setNewProcurement({...newProcurement, officer_id: e.target.value})}>
                          <option value="">เลือกเจ้าหน้าที่...</option>
                          {teachers.map(t => <option key={t.id} value={t.id}>{t.prefix}{t.first_name} {t.last_name}</option>)}
                        </select>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">หัวหน้าเจ้าหน้าที่</label>
                        <select className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.head_officer_id} onChange={e => setNewProcurement({...newProcurement, head_officer_id: e.target.value})}>
                          <option value="">เลือกหัวหน้าเจ้าหน้าที่...</option>
                          {teachers.map(t => <option key={t.id} value={t.id}>{t.prefix}{t.first_name} {t.last_name}</option>)}
                        </select>
                     </div>
                   </div>

                   <div className="space-y-3">
                      <div className="flex items-center justify-between px-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ผู้ตรวจรับ / คณะกรรมการ</label>
                        <button onClick={addCommitteeMember} className="text-[9px] font-black text-brand-primary hover:text-green-700 bg-green-50 px-3 py-1 rounded-full">+ เพิ่มกรรมการ</button>
                      </div>
                      
                      <div className="space-y-2">
                        {newProcurement.committees.map((c, idx) => (
                          <div key={idx} className="flex gap-2 items-center animate-in slide-in-from-right-2">
                            <select 
                              className="flex-[2] px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none" 
                              value={c.teacher_id} 
                              onChange={e => updateCommitteeMember(idx, 'teacher_id', e.target.value)}
                            >
                              <option value="">เลือกรายชื่อ...</option>
                              {teachers.map(t => <option key={t.id} value={t.id}>{t.prefix}{t.first_name} {t.last_name}</option>)}
                            </select>
                            <select 
                              className="flex-1 px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-black text-[10px] uppercase outline-none"
                              value={c.role}
                              onChange={e => updateCommitteeMember(idx, 'role', e.target.value)}
                            >
                              <option>ผู้ตรวจรับพัสดุ</option>
                              <option>ประธานกรรมการ</option>
                              <option>กรรมการ</option>
                            </select>
                            {newProcurement.committees.length > 1 && (
                              <button onClick={() => removeCommitteeMember(idx)} className="p-2 text-red-300 hover:text-red-500"><Trash2 size={14} /></button>
                            )}
                          </div>
                        ))}
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4 pt-2">
                     <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">วันที่ขออนุมัติ</label>
                        <input type="date" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.order_date} onChange={e => setNewProcurement({...newProcurement, order_date: e.target.value})} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">ระยะเวลาส่งมอบ (วัน)</label>
                        <input type="number" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.delivery_days} onChange={e => setNewProcurement({...newProcurement, delivery_days: Number(e.target.value)})} />
                     </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">เกณฑ์การพิจารณา</label>
                      <select className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.evaluation_criteria} onChange={e => setNewProcurement({...newProcurement, evaluation_criteria: e.target.value})}>
                        <option>เกณฑ์ราคา</option>
                        <option>เกณฑ์ราคาประกอบประสิทธิภาพต่อประสิทธิภาพและคุณภาพ</option>
                      </select>
                   </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <label className="text-[10px] font-black text-brand-primary uppercase tracking-widest">3. เหตุผลความจำเป็นและความต้องการ</label>
                  <button 
                    onClick={async () => {
                      if (!newProcurement.project_name) return alert('กรุณาระบุชื่อรายการจัดซื้อก่อนครับ');
                      setIsExtracting(true);
                      try {
                        const { data: settings } = await supabase.from('settings').select('gemini_api_key, ai_cowork_api_key').single();
                        const apiKey = settings?.ai_cowork_api_key || settings?.gemini_api_key;
                        const { generateAIDraft } = await import('../lib/aiService');
                        const prompt = `เขียน "เหตุผลความจำเป็น" ในการจัดซื้อจัดจ้างสำหรับรายการ "${newProcurement.project_name}" เพื่อใช้ในโรงเรียนบ้านควนโคกยา ให้มีความยาวประมาณ 2-3 บรรทัด สำนวนราชการไทย`;
                        const draft = await generateAIDraft(prompt, apiKey);
                        setNewProcurement({...newProcurement, necessity_reason: draft});
                      } catch (err: any) { alert(err.message); }
                      finally { setIsExtracting(false); }
                    }}
                    className="text-[10px] font-black text-brand-primary hover:text-green-700 flex items-center gap-1 bg-green-50 px-3 py-1 rounded-full transition-all"
                  >
                    {isExtracting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} 🤖 ให้ AI ช่วยเขียนเหตุผล
                  </button>
                </div>
                <textarea 
                  placeholder="ระบุเหตุผลความจำเป็นในการจัดซื้อครั้งนี้..." 
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-[32px] font-bold text-sm outline-none focus:bg-white min-h-[100px] transition-all"
                  value={newProcurement.necessity_reason}
                  onChange={e => setNewProcurement({...newProcurement, necessity_reason: e.target.value})}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <label className="text-[10px] font-black text-brand-primary uppercase tracking-widest">4. รายการพัสดุที่ต้องการซื้อ/จ้าง</label>
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
                <div className="flex items-center justify-between px-2">
                  <label className="text-[10px] font-black text-brand-primary uppercase tracking-widest">4. ข้อมูลร้านค้า / ผู้ขาย (ถ้ามี)</label>
                  {pastVendors.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-slate-400">เลือกร้านค้าแนะนำ:</span>
                      <select 
                        className="px-4 py-1.5 bg-green-50 border border-green-100 rounded-full font-bold text-[10px] outline-none text-brand-primary cursor-pointer hover:bg-green-100 transition-colors"
                        value=""
                        onChange={e => {
                          const selectedName = e.target.value;
                          const vendor = pastVendors.find(v => v.name === selectedName);
                          if (vendor) {
                            setNewProcurement({
                              ...newProcurement,
                              vendor_info: {
                                name: vendor.name,
                                address: vendor.address || '',
                                tax_id: vendor.tax_id || ''
                              }
                            });
                          }
                        }}
                      >
                        <option value="">-- ดึงจากประวัติจัดซื้อเดิม --</option>
                        {pastVendors.map((v, i) => (
                          <option key={i} value={v.name}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <input type="text" placeholder="ชื่อร้านค้า..." className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.vendor_info.name} onChange={e => setNewProcurement({...newProcurement, vendor_info: {...newProcurement.vendor_info, name: e.target.value}})} />
                  <input type="text" placeholder="ที่อยู่ร้านค้า..." className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.vendor_info.address} onChange={e => setNewProcurement({...newProcurement, vendor_info: {...newProcurement.vendor_info, address: e.target.value}})} />
                  <input type="text" placeholder="เลขที่เสียภาษี / บัตรประชาชน..." className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.vendor_info.tax_id} onChange={e => setNewProcurement({...newProcurement, vendor_info: {...newProcurement.vendor_info, tax_id: e.target.value}})} />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-brand-primary uppercase tracking-widest ml-2">5. เลขที่หนังสือและวันที่ดำเนินการสำคัญ</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">เลขที่บันทึกข้อความ (ขอซื้อ/ขอจ้าง)</label>
                    <input type="text" placeholder="เช่น มค 72404/..." className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.doc_number} onChange={e => setNewProcurement({...newProcurement, doc_number: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">เลขที่คำสั่ง (แต่งตั้งกรรมการ)</label>
                    <input type="text" placeholder="เช่น 45/2569" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.order_number} onChange={e => setNewProcurement({...newProcurement, order_number: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">เลขที่สั่งซื้อ/สั่งจ้าง (PO)</label>
                    <input type="text" placeholder="เช่น 12/2569" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.po_number} onChange={e => setNewProcurement({...newProcurement, po_number: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">วันที่สั่งซื้อ/สั่งจ้าง (PO)</label>
                    <input type="date" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.po_date} onChange={e => setNewProcurement({...newProcurement, po_date: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">วันที่ส่งมอบพัสดุ</label>
                    <input type="date" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.delivery_date} onChange={e => setNewProcurement({...newProcurement, delivery_date: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">วันที่ตรวจรับพัสดุ</label>
                    <input type="date" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.inspection_date} onChange={e => setNewProcurement({...newProcurement, inspection_date: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 ml-2 uppercase">วันที่อนุมัติจ่ายเงิน</label>
                    <input type="date" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={newProcurement.payment_approval_date} onChange={e => setNewProcurement({...newProcurement, payment_approval_date: e.target.value})} />
                  </div>
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

      {/* AI Document Center Modal */}
      {isDocumentCenterOpen && selectedProcurement && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                  <FileText className="text-brand-primary" size={28} /> ศูนย์จัดการเอกสารอัจฉริยะ
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  โครงการ: {selectedProcurement.project_name} | งบประมาณ: {Number(selectedProcurement.total_amount).toLocaleString()} ฿
                </p>
              </div>
              <button onClick={() => setIsDocumentCenterOpen(false)} className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all">✕</button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Left: Document List */}
              <div className="w-full md:w-80 border-r border-slate-50 overflow-y-auto p-4 space-y-2 bg-slate-50/20">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-2 block">รายการเอกสารในชุด</label>
                {PROCUREMENT_DOCS.map(doc => (
                  <button 
                    key={doc.id}
                    onClick={() => {
                      setActiveDocId(doc.id);
                      handleAIDraftDocument(doc.id); // ใช้ id แทนชื่อเพื่อความแม่นยำ
                    }}
                    className={`w-full text-left p-4 rounded-[24px] hover:bg-white hover:shadow-md transition-all group border ${activeDocId === doc.id ? 'bg-white shadow-md border-slate-100' : 'border-transparent hover:border-slate-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center transition-colors ${activeDocId === doc.id ? 'text-brand-primary' : 'text-slate-400 group-hover:text-brand-primary'}`}>
                        {doc.icon}
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-700">{doc.name}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 line-clamp-1">{doc.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Right: Preview Area */}
              <div className="flex-1 bg-slate-50/30 overflow-y-auto p-8 relative">
                 {isExtracting ? (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                      <Loader2 className="animate-spin text-brand-primary mb-4" size={48} />
                      <p className="font-black text-[10px] text-slate-400 uppercase tracking-[0.2em]">AI กำลังร่างเนื้อหาเอกสารราชการ...</p>
                   </div>
                 ) : null}
                 
                 <div className="max-w-2xl mx-auto space-y-6">
                    <div className="bg-white p-12 rounded-[40px] shadow-xl border border-slate-100 min-h-[600px] relative">
                       <div className="absolute top-8 right-8 opacity-10">
                           <img src={import.meta.env.VITE_SCHOOL_LOGO_PATH || "logo.png"} alt="Watermark" className="w-20 h-20" />
                       </div>
                       <h4 className="text-center font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-4 mb-8">ตัวอย่างเนื้อหาที่ AI ร่าง</h4>
                       
                       <div className="prose prose-slate max-w-none">
                          {selectedProcurement.ai_draft_content?.[activeDocId] ? (
                            <div className="whitespace-pre-wrap font-serif text-slate-700 leading-relaxed">
                               {selectedProcurement.ai_draft_content[activeDocId]}
                            </div>
                          ) : (
                            <div className="h-96 flex flex-col items-center justify-center text-slate-300 text-center">
                               <Sparkles size={64} className="mb-4 opacity-20" />
                               <p className="font-bold uppercase tracking-widest text-xs">เลือกเอกสารทางด้านซ้าย<br/>เพื่อให้ AI เริ่มร่างเนื้อหาให้คุณ</p>
                            </div>
                          )}
                       </div>
                    </div>
                 </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-50 bg-slate-50/50 flex justify-between items-center">
              <p className="text-[10px] font-bold text-slate-400 italic">หมายเหตุ: เนื้อหาที่ AI ร่างควรได้รับการตรวจสอบความถูกต้องอีกครั้งตามระเบียบพัสดุ</p>
              <div className="flex gap-3">
                 <button 
                  onClick={() => {
                    const text = selectedProcurement.ai_draft_content?.[activeDocId];
                    if (text) {
                      navigator.clipboard.writeText(text);
                      alert('คัดลอกเนื้อหาเรียบร้อยแล้วครับ');
                    }
                  }}
                  className="px-8 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                 >
                  คัดลอกข้อความ
                 </button>
                 <button 
                  onClick={() => handleDownloadPDF(activeDocId)}
                  className="px-8 py-3 bg-brand-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-green-700 transition-all flex items-center gap-2"
                 >
                    <FileText size={16} /> พิมพ์เข้าแบบฟอร์ม PDF
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
