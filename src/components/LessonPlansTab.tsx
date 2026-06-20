import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { uploadToSupabase } from '../lib/storage';
import { 
  FileText, 
  Upload, 
  Send, 
  CheckCircle, 
  XCircle, 
  Edit2, 
  Trash2, 
  Download, 
  AlertCircle, 
  MessageSquare, 
  Clock, 
  User, 
  Filter, 
  RefreshCw, 
  Eye, 
  Plus, 
  Check, 
  ChevronRight,
  BookOpen,
  Printer
} from 'lucide-react';
import Modal from './Modal';
import garuda15mm from '../assets/saraban/garuda-1.5cm.png';

type LessonPlan = {
  id: string;
  teacher_id: string;
  title: string;
  subject_code: string;
  subject_name: string;
  class_level: string;
  term: string;
  file_url: string;
  status: 'Draft' | 'Pending_Academic' | 'Rejected_by_Academic' | 'Pending_Director' | 'Rejected_by_Director' | 'Approved';
  academic_comments: string | null;
  academic_reviewed_by: string | null;
  academic_reviewed_at: string | null;
  director_comments: string | null;
  director_approved_by: string | null;
  director_approved_at: string | null;
  created_at: string;
  profiles?: {
    display_name: string;
    signature_url?: string;
  };
};

type Subject = {
  id: string;
  code: string;
  name: string;
  class_level: string;
};

export default function LessonPlansTab() {
  const { user, profile } = useAuth();
  
  // Roles detection
  const isAdmin = profile?.role === 'admin';
  const isDirector = profile?.role === 'director' || isAdmin;
  const isAcademic = profile?.extra_permissions?.access_academic || isDirector;
  const isTeacher = profile?.role === 'teacher' || isAdmin;

  // View state (Teacher workspace, Academic workspace, Director workspace)
  const [activeWorkspace, setActiveWorkspace] = useState<'my_plans' | 'academic_review' | 'director_approval'>('my_plans');
  
  // Data States
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<LessonPlan | null>(null);
  
  // Filter States
  const [filterTerm, setFilterTerm] = useState('2569');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Form States
  const [formId, setFormId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formSubjectCode, setFormSubjectCode] = useState('');
  const [formSubjectName, setFormSubjectName] = useState('');
  const [formClassLevel, setFormClassLevel] = useState('ป.1');
  const [formTerm, setFormTerm] = useState('1/2569');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState('');
  
  // Review Form States
  const [reviewComments, setReviewComments] = useState('');

  // Set default workspace depending on permissions
  useEffect(() => {
    if (isTeacher) {
      setActiveWorkspace('my_plans');
    } else if (isAcademic) {
      setActiveWorkspace('academic_review');
    } else if (isDirector) {
      setActiveWorkspace('director_approval');
    }
  }, [profile]);

  // Fetch plans and subjects on mount / workspace change / filter change
  useEffect(() => {
    fetchPlans();
    fetchSubjects();
  }, [activeWorkspace, filterTerm, filterClass, filterStatus]);

  async function fetchSubjects() {
    try {
      const { data } = await supabase.from('subjects').select('id, code, name, class_level').order('code');
      setSubjects(data || []);
    } catch (e) {
      console.error('Error fetching subjects:', e);
    }
  }

  async function fetchPlans() {
    try {
      setLoading(true);
      let query = supabase.from('lesson_plans').select('*, profiles:profiles(display_name, signature_url)');
      
      // Filter by workspace
      if (activeWorkspace === 'my_plans') {
        // Teacher sees only their own
        query = query.eq('teacher_id', user?.id);
      } else if (activeWorkspace === 'academic_review') {
        // Academic Head sees plans sent to academic or higher
        query = query.neq('status', 'Draft');
      } else if (activeWorkspace === 'director_approval') {
        // Director sees plans pending director approval, rejected by director, or approved
        query = query.in('status', ['Pending_Director', 'Rejected_by_Director', 'Approved']);
      }

      // Apply term filters (checking year in term e.g. 1/2569)
      if (filterTerm) {
        query = query.ilike('term', `%${filterTerm}%`);
      }
      
      // Apply status filters
      if (filterStatus) {
        query = query.eq('status', filterStatus);
      }

      // Apply class level filters
      if (filterClass) {
        query = query.eq('class_level', filterClass);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('relation "lesson_plans" does not exist')) {
          setPlans([]); // Table doesn't exist yet
        } else {
          throw error;
        }
      } else {
        setPlans(data || []);
      }
    } catch (err) {
      console.error('Error fetching lesson plans:', err);
    } finally {
      setLoading(false);
    }
  }

  // Handle subject change to autofill code/name
  const handleSubjectChange = (subjectCode: string) => {
    setFormSubjectCode(subjectCode);
    const sub = subjects.find(s => s.code === subjectCode);
    if (sub) {
      setFormSubjectName(sub.name);
      setFormClassLevel(sub.class_level);
    }
  };

  const handleOpenForm = (plan: LessonPlan | null = null) => {
    if (plan) {
      setFormId(plan.id);
      setFormTitle(plan.title);
      setFormSubjectCode(plan.subject_code);
      setFormSubjectName(plan.subject_name);
      setFormClassLevel(plan.class_level);
      setFormTerm(plan.term);
      setExistingFileUrl(plan.file_url);
      setFormFile(null);
    } else {
      setFormId(null);
      setFormTitle('');
      setFormSubjectCode('');
      setFormSubjectName('');
      setFormClassLevel('ป.1');
      setFormTerm('1/2569');
      setExistingFileUrl('');
      setFormFile(null);
    }
    setIsFormOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFile && !existingFileUrl) {
      alert('กรุณาอัปโหลดไฟล์แผนการสอน (PDF) ด้วยค่ะ');
      return;
    }

    setIsSaving(true);
    try {
      let fileUrl = existingFileUrl;
      
      // Upload file to Supabase Storage if a new one is selected
      if (formFile) {
        const fileExt = formFile.name.split('.').pop();
        const fileName = `lesson_plan_${Date.now()}.${fileExt}`;
        const filePath = `${user?.id}/${fileName}`;
        
        fileUrl = await uploadToSupabase(formFile, 'temp_docs', filePath);
      }

      const payload = {
        teacher_id: user?.id,
        title: formTitle,
        subject_code: formSubjectCode,
        subject_name: formSubjectName,
        class_level: formClassLevel,
        term: formTerm,
        file_url: fileUrl,
        status: 'Draft' // Always reset to Draft on save/edit
      };

      let result;
      if (formId) {
        result = await supabase.from('lesson_plans').update(payload).eq('id', formId);
      } else {
        result = await supabase.from('lesson_plans').insert([payload]).select();
      }

      if (result.error) throw result.error;
      
      // Log Action
      const planId = formId || result.data?.[0]?.id;
      if (planId) {
        await supabase.from('lesson_plan_logs').insert([{
          lesson_plan_id: planId,
          actor_id: user?.id,
          action: formId ? 'edit' : 'create',
          comments: formId ? 'แก้ไขรายละเอียดแผนการสอน' : 'สร้างร่างแผนการสอนใหม่'
        }]);
      }

      alert(formId ? 'แก้ไขข้อมูลแผนการสอนแล้วค่ะ' : 'บันทึกร่างแผนการสอนสำเร็จแล้วค่ะ');
      setIsFormOpen(false);
      fetchPlans();
    } catch (err: any) {
      alert('ไม่สามารถบันทึกข้อมูลได้: ' + err.message + '\n(โปรดตรวจสอบว่าได้สร้างตารางและสิทธิ์ RLS ในฐานข้อมูลแล้ว)');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlan = async (plan: LessonPlan) => {
    const isApproved = plan.status === 'Approved';
    const message = isApproved 
      ? 'แผนการสอนนี้ได้รับการอนุมัติใช้งานแล้ว! คุณครูยืนยันที่จะลบออกจากระบบจริงหรือไม่? (ข้อมูลประวัติการตรวจทั้งหมดจะถูกลบออกไปด้วย)'
      : 'คุณครูต้องการลบแผนการสอนนี้ใช่หรือไม่?';
      
    if (!window.confirm(message)) return;
    try {
      const { error } = await supabase.from('lesson_plans').delete().eq('id', plan.id);
      if (error) throw error;
      alert('ลบแผนการสอนเรียบร้อยแล้วค่ะ');
      fetchPlans();
    } catch (err: any) {
      alert('ไม่สามารถลบแผนการสอนได้: ' + err.message);
    }
  };

  const handleSubmitPlan = async (plan: LessonPlan) => {
    if (!window.confirm('ต้องการส่งแผนการสอนนี้ให้หัวหน้าวิชาการตรวจสอบใช่หรือไม่? \n(หลังจากส่งแล้ว คุณครูจะไม่สามารถแก้ไขข้อมูลได้ชั่วคราวจนกว่าจะมีการตีกลับ)')) return;
    try {
      const { error } = await supabase.from('lesson_plans').update({
        status: 'Pending_Academic'
      }).eq('id', plan.id);

      if (error) throw error;

      // Log Action
      await supabase.from('lesson_plan_logs').insert([{
        lesson_plan_id: plan.id,
        actor_id: user?.id,
        action: 'submit',
        comments: 'ส่งเสนอตรวจแผนการสอน'
      }]);

      alert('ส่งแผนการสอนสำเร็จแล้วค่ะ');
      fetchPlans();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการส่ง: ' + err.message);
    }
  };

  const handleOpenReview = (plan: LessonPlan) => {
    setSelectedPlan(plan);
    setReviewComments('');
    setIsReviewOpen(true);
  };

  const handleAcademicReview = async (action: 'approve' | 'reject') => {
    if (!selectedPlan) return;
    const confirmMsg = action === 'approve' 
      ? 'ยืนยันอนุมัติและส่งเสนอผู้อำนวยการ (ผอ.) ใช่หรือไม่?' 
      : 'ยืนยันส่งกลับแผนการสอนนี้ให้ครูแก้ไขใช่หรือไม่?';
    
    if (!window.confirm(confirmMsg)) return;

    setIsSaving(true);
    try {
      const payload = {
        status: action === 'approve' ? 'Pending_Director' : 'Rejected_by_Academic',
        academic_comments: reviewComments || null,
        academic_reviewed_by: user?.id,
        academic_reviewed_at: new Date().toISOString()
      };

      const { error } = await supabase.from('lesson_plans').update(payload).eq('id', selectedPlan.id);
      if (error) throw error;

      // Log Action
      await supabase.from('lesson_plan_logs').insert([{
        lesson_plan_id: selectedPlan.id,
        actor_id: user?.id,
        action: action === 'approve' ? 'academic_propose' : 'academic_reject',
        comments: reviewComments || (action === 'approve' ? 'ผ่านการตรวจสอบขั้นต้น เสนอ ผอ.' : 'ส่งกลับแก้ไข')
      }]);

      alert(action === 'approve' ? 'ส่งเสนอ ผอ. เรียบร้อยแล้วค่ะ' : 'ส่งกลับแก้ไขเรียบร้อยแล้วค่ะ');
      setIsReviewOpen(false);
      fetchPlans();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDirectorReview = async (action: 'approve' | 'reject') => {
    if (!selectedPlan) return;
    const confirmMsg = action === 'approve' 
      ? 'ยืนยันการอนุมัติใช้แผนการสอนนี้อย่างเป็นทางการใช่หรือไม่?' 
      : 'ยืนยันปฏิเสธและส่งกลับให้ครูแก้ไขใช่หรือไม่?';

    if (!window.confirm(confirmMsg)) return;

    setIsSaving(true);
    try {
      const payload = {
        status: action === 'approve' ? 'Approved' : 'Rejected_by_Director',
        director_comments: reviewComments || null,
        director_approved_by: user?.id,
        director_approved_at: new Date().toISOString()
      };

      const { error } = await supabase.from('lesson_plans').update(payload).eq('id', selectedPlan.id);
      if (error) throw error;

      // Log Action
      await supabase.from('lesson_plan_logs').insert([{
        lesson_plan_id: selectedPlan.id,
        actor_id: user?.id,
        action: action === 'approve' ? 'approve' : 'director_reject',
        comments: reviewComments || (action === 'approve' ? 'อนุมัติการใช้งาน' : 'ผอ. สั่งปรับปรุงแก้ไข')
      }]);

      alert(action === 'approve' ? 'อนุมัติแผนการสอนสำเร็จแล้วค่ะ' : 'ตีกลับแก้ไขสำเร็จแล้วค่ะ');
      setIsReviewOpen(false);
      fetchPlans();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const printApprovalSheet = async (plan: LessonPlan) => {
    // 1. Fetch school info/settings for Director's fallback name
    const { data: settings } = await supabase.from('settings').select('school_name, director_name').maybeSingle();
    const schoolNameStr = settings?.school_name || 'โรงเรียนบ้านควนโคกยา';

    // 2. Fetch Teacher signature
    let teacherSignatureHtml = '';
    if (plan.profiles?.signature_url) {
      teacherSignatureHtml = `<div style="position: absolute; left: 50%; transform: translateX(-50%); top: -0.8cm; width: 3.5cm; height: 1.2cm; z-index: 10; pointer-events: none;">
        <img src="${plan.profiles.signature_url}" style="width: 100%; height: 100%; object-fit: contain;" />
      </div>`;
    }

    // 3. Fetch Academic Head profile/signature (if reviewed)
    let academicName = '.............................................';
    let academicSignatureHtml = '';
    if (plan.academic_reviewed_by) {
      const { data: academicProfile } = await supabase.from('profiles').select('display_name, signature_url').eq('id', plan.academic_reviewed_by).maybeSingle();
      if (academicProfile) {
        academicName = academicProfile.display_name || '';
        if (academicProfile.signature_url) {
          academicSignatureHtml = `<div style="position: absolute; left: 50%; transform: translateX(-50%); top: -0.8cm; width: 3.5cm; height: 1.2cm; z-index: 10; pointer-events: none;">
            <img src="${academicProfile.signature_url}" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>`;
        }
      }
    }

    // 4. Fetch Director signature (if approved)
    let directorName = settings?.director_name || '.............................................';
    let directorSignatureHtml = '';
    if (plan.director_approved_by) {
      const { data: directorProfile } = await supabase.from('profiles').select('display_name, signature_url').eq('id', plan.director_approved_by).maybeSingle();
      if (directorProfile) {
        directorName = directorProfile.display_name || settings?.director_name || '';
        if (directorProfile.signature_url) {
          directorSignatureHtml = `<div style="position: absolute; left: 50%; transform: translateX(-50%); top: -0.8cm; width: 3.5cm; height: 1.2cm; z-index: 10; pointer-events: none;">
            <img src="${directorProfile.signature_url}" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>`;
        }
      }
    }

    const dateSubmitted = plan.created_at ? new Date(plan.created_at).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }) : '......./......./.......';

    const dateAcademic = plan.academic_reviewed_at ? new Date(plan.academic_reviewed_at).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }) : '......./......./.......';

    const dateDirector = plan.director_approved_at ? new Date(plan.director_approved_at).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }) : '......./......./.......';

    const html = `
      <html>
        <head>
          <title>บันทึกอนุมัติใช้แผนการสอน - ${plan.title}</title>
          <style>
            @font-face {
              font-family: 'THSarabunIT๙';
              src: local('THSarabunIT๙');
            }
            body { 
              font-family: 'THSarabunIT๙', 'TH Sarabun New', sans-serif; 
              padding: 0;
              margin: 0;
              background: #f0f0f0;
            }
            .page {
              background: white;
              width: 210mm;
              height: 297mm;
              margin: 10mm auto;
              padding: 1.5cm 1.5cm 2cm 2.5cm;
              box-sizing: border-box;
              position: relative;
              font-size: 16pt;
              line-height: 1.25;
            }
            .memo-header {
              display: flex;
              align-items: flex-end;
              justify-content: center;
              border-bottom: 2px solid black;
              padding-bottom: 5px;
              margin-bottom: 10px;
              position: relative;
            }
            .garuda {
              position: absolute;
              left: 0;
              bottom: 5px;
              width: 1.5cm;
              height: auto;
            }
            .header-title {
              font-size: 29pt;
              font-weight: bold;
              line-height: 1;
            }
            .info-line {
              margin: 5px 0;
              display: flex;
            }
            .info-label {
              font-weight: bold;
              margin-right: 5px;
            }
            .info-date {
              position: absolute;
              left: 11.0cm;
              display: flex;
            }
            .content-text {
              margin-top: 0.8cm;
              line-height: 1.25;
              text-align: justify;
              text-indent: 2.5cm;
            }
            .sig-block {
              margin-top: 1cm;
              display: flex;
              justify-content: flex-end;
            }
            .sig-name-block {
              width: 7cm;
              text-align: center;
              position: relative;
            }
            .grid-opinion {
              margin-top: 1.5cm;
              display: grid;
              grid-template-cols: 1fr 1fr;
              gap: 1.0cm;
              border-top: 1px dashed #ccc;
              padding-top: 1cm;
            }
            .opinion-box {
              font-size: 15pt;
              line-height: 1.4;
            }
            .opinion-title {
              font-weight: bold;
              margin-bottom: 10px;
              text-decoration: underline;
            }
            @media print {
              body { background: white; }
              .page { margin: 0; border: none; box-shadow: none; }
              .no-print { display: none; }
            }
            .no-print-btn {
              position: fixed;
              top: 20px;
              right: 20px;
              background: #007bff;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 8px;
              font-size: 14px;
              font-weight: bold;
              cursor: pointer;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              z-index: 1000;
            }
            .no-print-btn:hover {
              background: #0056b3;
            }
          </style>
        </head>
        <body>
          <button class="no-print-btn no-print" onclick="window.print()">🖨️ พิมพ์เอกสารเสนออนุมัติ</button>
          
          <div class="page">
            <div class="memo-header">
              <img src="${garuda15mm}" class="garuda" />
              <div class="header-title">บันทึกข้อความ</div>
            </div>
            
            <div class="info-line">
              <div style="flex: 1;"><span class="info-label">ส่วนราชการ</span> ${schoolNameStr}</div>
            </div>
            <div class="info-line">
              <div style="flex: 1;"><span class="info-label">ที่</span> วิชาการ / ๒๕๖๙</div>
              <div class="info-date"><span class="info-label">วันที่</span> ${dateSubmitted}</div>
            </div>
            <div class="info-line">
              <div style="flex: 1;"><span class="info-label">เรื่อง</span> เสนอขออนุมัติใช้แผนการจัดการเรียนรู้</div>
            </div>
            
            <div style="margin-top: 0.5cm;">
              <span class="info-label">เรียน</span> ผู้อำนวยการ${schoolNameStr}
            </div>
            
            <div class="content-text">
              ด้วย ข้าพเจ้า <strong>${plan.profiles?.display_name || '.............................................'}</strong> ตำแหน่งครู ได้จัดทำแผนการจัดการเรียนรู้/แผนการสอน รายวิชา <strong>${plan.subject_name} (${plan.subject_code})</strong> ระดับชั้น <strong>ชั้น${plan.class_level}</strong> ภาคเรียนที่ <strong>${plan.term}</strong> ซึ่งมีเนื้อหาสาระครบถ้วนตามหลักสูตรสถานศึกษาและมาตรฐานการเรียนรู้เรียบร้อยแล้ว จึงใคร่เสนอขออนุมัติแผนการสอนดังกล่าวเพื่อใช้เป็นแนวทางจัดกิจกรรมการเรียนรู้แก่นักเรียนต่อไป
            </div>
            
            <div class="sig-block">
              <div class="sig-name-block">
                ${teacherSignatureHtml}
                <br/>
                ลงชื่อ...................................................... ครูผู้เสนอ<br/>
                ( ${plan.profiles?.display_name || '.............................................'} )
              </div>
            </div>

            <div class="grid-opinion">
              <div class="opinion-box">
                <div class="opinion-title">การตรวจสอบของหัวหน้างานวิชาการ</div>
                <div>[ ${plan.status !== 'Draft' && plan.status !== 'Rejected_by_Academic' ? '✓' : '&nbsp;&nbsp;'} ] เห็นควรอนุมัติให้ใช้ในการสอนได้</div>
                <div>[ ${plan.status === 'Rejected_by_Academic' ? '✓' : '&nbsp;&nbsp;'} ] เห็นควรส่งกลับแก้ไขเพิ่มเติม</div>
                <div style="margin-top: 8px;">ข้อเสนอแนะ: ${plan.academic_comments || '................................................'}</div>
                <br/>
                <div style="text-align: center; position: relative;">
                  ${academicSignatureHtml}
                  ลงชื่อ...................................................... วิชาการ<br/>
                  ( ${academicName} )<br/>
                  วันที่ ${dateAcademic}
                </div>
              </div>
              
              <div class="opinion-box">
                <div class="opinion-title">การพิจารณาของผู้อำนวยการ</div>
                <div>[ ${plan.status === 'Approved' ? '✓' : '&nbsp;&nbsp;'} ] อนุมัติให้ใช้ในการจัดการเรียนรู้ได้</div>
                <div>[ ${plan.status === 'Rejected_by_Director' ? '✓' : '&nbsp;&nbsp;'} ] ส่งกลับเพื่อแก้ไขปรับปรุง</div>
                <div style="margin-top: 8px;">ข้อสั่งการ: ${plan.director_comments || '................................................'}</div>
                <br/>
                <div style="text-align: center; position: relative;">
                  ${directorSignatureHtml}
                  ลงชื่อ...................................................... ผู้อำนวยการ<br/>
                  ( ${directorName} )<br/>
                  วันที่ ${dateDirector}
                </div>
              </div>
            </div>

          </div>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
  };

  // Status Badge Helper
  const getStatusBadge = (status: LessonPlan['status']) => {
    switch (status) {
      case 'Draft':
        return <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-xl text-xs font-bold border border-slate-200">แบบร่าง</span>;
      case 'Pending_Academic':
        return <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-xl text-xs font-bold border border-blue-100 animate-pulse">รอวิชาการตรวจ</span>;
      case 'Rejected_by_Academic':
        return <span className="bg-red-50 text-red-600 px-3 py-1 rounded-xl text-xs font-bold border border-red-100">วิชาการตีกลับ</span>;
      case 'Pending_Director':
        return <span className="bg-yellow-50 text-yellow-600 px-3 py-1 rounded-xl text-xs font-bold border border-yellow-100">เสนอ ผอ. อนุมัติ</span>;
      case 'Rejected_by_Director':
        return <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-xl text-xs font-bold border border-orange-100">ผอ. ตีกลับแก้ไข</span>;
      case 'Approved':
        return <span className="bg-green-50 text-green-600 px-3 py-1 rounded-xl text-xs font-bold border border-green-100">อนุมัติใช้งาน</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Role Workspaces Navigation */}
      <div className="flex flex-wrap gap-3 border-b border-slate-200 pb-4">
        {isTeacher && (
          <button 
            type="button"
            onClick={() => setActiveWorkspace('my_plans')}
            className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${
              activeWorkspace === 'my_plans' 
                ? 'bg-slate-800 text-white shadow-lg shadow-slate-100' 
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <BookOpen size={16} /> แผนการสอนของฉัน
          </button>
        )}
        {isAcademic && (
          <button 
            type="button"
            onClick={() => setActiveWorkspace('academic_review')}
            className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${
              activeWorkspace === 'academic_review' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CheckCircle size={16} /> ตรวจสอบวิชาการ ({plans.filter(p => p.status === 'Pending_Academic').length})
          </button>
        )}
        {isDirector && (
          <button 
            type="button"
            onClick={() => setActiveWorkspace('director_approval')}
            className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${
              activeWorkspace === 'director_approval' 
                ? 'bg-green-600 text-white shadow-lg shadow-green-100' 
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CheckCircle size={16} /> อนุมัติแผน (ผอ.) ({plans.filter(p => p.status === 'Pending_Director').length})
          </button>
        )}
      </div>

      {/* Filter Options */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xs flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 text-slate-400 text-sm font-bold mr-2">
            <Filter size={16} /> กรองข้อมูล:
          </div>
          {/* Term Filter */}
          <select 
            value={filterTerm} 
            onChange={(e) => setFilterTerm(e.target.value)}
            className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
          >
            <option value="2569">ปีการศึกษา 2569</option>
            <option value="2568">ปีการศึกษา 2568</option>
            <option value="">ทุกปีการศึกษา</option>
          </select>

          {/* Class Filter */}
          <select 
            value={filterClass} 
            onChange={(e) => setFilterClass(e.target.value)}
            className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
          >
            <option value="">ทุกระดับชั้น</option>
            {['อ.1', 'อ.2', 'อ.3', 'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'].map(lvl => (
              <option key={lvl} value={lvl}>ชั้น {lvl}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
          >
            <option value="">ทุกสถานะ</option>
            <option value="Draft">แบบร่าง</option>
            <option value="Pending_Academic">รอวิชาการตรวจ</option>
            <option value="Rejected_by_Academic">วิชาการตีกลับ</option>
            <option value="Pending_Director">เสนอ ผอ. อนุมัติ</option>
            <option value="Rejected_by_Director">ผอ. ตีกลับแก้ไข</option>
            <option value="Approved">อนุมัติใช้งาน</option>
          </select>
        </div>

        {activeWorkspace === 'my_plans' && isTeacher && (
          <button 
            type="button"
            onClick={() => handleOpenForm()}
            className="bg-brand-primary text-white px-5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 active:scale-95 transition-all shadow-md shadow-green-50"
          >
            <Plus size={16} /> ส่งแผนการสอนใหม่
          </button>
        )}
      </div>

      {/* Plans List / Table */}
      {loading ? (
        <div className="py-20 text-center"><RefreshCw className="animate-spin mx-auto text-brand-primary" size={32} /></div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-[40px] p-20 text-center border border-dashed border-slate-200 shadow-inner">
          <FileText className="mx-auto text-slate-300 mb-4" size={48} />
          <h4 className="font-bold text-slate-600 text-lg">ไม่พบข้อมูลแผนการสอน</h4>
          <p className="text-xs text-slate-400 mt-2 font-medium">ยังไม่มีการส่งแผนการสอนตามตัวกรองที่เลือกไว้ หรือยังไม่ได้สร้างตารางในฐานข้อมูล</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
          {plans.map(plan => (
            <div key={plan.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xs hover:shadow-xl transition-all group relative flex flex-col justify-between">
              
              {/* Card Header */}
              <div>
                <div className="flex justify-between items-start mb-4">
                  {getStatusBadge(plan.status)}
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg">{plan.term}</span>
                </div>
                
                <h4 className="font-black text-slate-800 text-base leading-snug truncate" title={plan.title}>{plan.title}</h4>
                <p className="text-xs text-brand-primary font-bold mt-1">{plan.subject_code} - {plan.subject_name}</p>
                
                {/* Meta details */}
                <div className="mt-4 space-y-2 border-t border-slate-50 pt-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <User size={14} className="text-slate-300" />
                    <span>ผู้สอน: {plan.profiles?.display_name || 'ไม่พบรายชื่อ'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <Clock size={14} className="text-slate-300" />
                    <span>ระดับชั้น: {plan.class_level}</span>
                  </div>
                </div>

                {/* Return comments if rejected */}
                {(plan.status === 'Rejected_by_Academic' && plan.academic_comments) && (
                  <div className="mt-3 p-3 bg-red-50/50 rounded-2xl border border-red-100 flex gap-2">
                    <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <div className="text-[10px] text-red-600 font-medium">
                      <span className="font-bold">วิชาการให้แก้ไข:</span> {plan.academic_comments}
                    </div>
                  </div>
                )}
                {(plan.status === 'Rejected_by_Director' && plan.director_comments) && (
                  <div className="mt-3 p-3 bg-orange-50/50 rounded-2xl border border-orange-100 flex gap-2">
                    <AlertCircle size={14} className="text-orange-500 shrink-0 mt-0.5" />
                    <div className="text-[10px] text-orange-600 font-medium">
                      <span className="font-bold">ผอ. สั่งแก้ไข:</span> {plan.director_comments}
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer - Action Buttons */}
              <div className="mt-6 border-t border-slate-50 pt-4 flex gap-2 justify-end">
                {/* Universal: View File */}
                <a 
                  href={plan.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                  title="ดาวน์โหลด/เปิดดู PDF"
                >
                  <Eye size={16} />
                </a>

                {/* Print Approval Sheet Button (Visible if submitted or approved) */}
                {plan.status !== 'Draft' && (
                  <button 
                    type="button"
                    onClick={() => printApprovalSheet(plan)}
                    className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    title="พิมพ์ใบเสนออนุมัติแผนการสอน (A4)"
                  >
                    <Printer size={16} />
                  </button>
                )}

                {/* Teacher Actions */}
                {activeWorkspace === 'my_plans' && (
                  <>
                    {/* Edit button: Draft or Rejected */}
                    {(plan.status === 'Draft' || plan.status.startsWith('Rejected')) && (
                      <button 
                        type="button"
                        onClick={() => handleOpenForm(plan)} 
                        className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="แก้ไขแผนการสอน"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}

                    {/* Delete button: Draft, Rejected, or Approved */}
                    {(plan.status === 'Draft' || plan.status.startsWith('Rejected') || plan.status === 'Approved') && (
                      <button 
                        type="button"
                        onClick={() => handleDeletePlan(plan)}
                        className="p-2 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="ลบแผนการสอน"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}

                    {/* Submit button: Draft or Rejected */}
                    {(plan.status === 'Draft' || plan.status.startsWith('Rejected')) && (
                      <button 
                        type="button"
                        onClick={() => handleSubmitPlan(plan)}
                        className="bg-brand-primary text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 hover:shadow-md transition-all active:scale-95 ml-2"
                      >
                        <Send size={12} /> ส่งเสนอ
                      </button>
                    )}
                  </>
                )}

                {/* Academic Reviewer Actions */}
                {activeWorkspace === 'academic_review' && plan.status === 'Pending_Academic' && (
                  <button 
                    type="button"
                    onClick={() => handleOpenReview(plan)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-blue-700 transition-all ml-2"
                  >
                    <Check size={14} /> ตรวจสอบเอกสาร
                  </button>
                )}

                {/* Director Actions */}
                {activeWorkspace === 'director_approval' && plan.status === 'Pending_Director' && (
                  <button 
                    type="button"
                    onClick={() => handleOpenReview(plan)}
                    className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-green-700 transition-all ml-2"
                  >
                    <Check size={14} /> ตรวจสอบเพื่ออนุมัติ
                  </button>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      {/* ADD/EDIT LESSON PLAN FORM MODAL */}
      <Modal 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        title={formId ? 'แก้ไขข้อมูลแผนการสอน' : 'สร้างรายการส่งแผนการสอน'}
      >
        <form onSubmit={handleSavePlan} className="space-y-6">
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 ml-1">วิชาที่ประสงค์ส่งแผน</label>
            <select 
              value={formSubjectCode} 
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm"
              required
            >
              <option value="">เลือกวิชาในตารางวิชาเรียน</option>
              {subjects.map(s => (
                <option key={s.id} value={s.code}>{s.code} - {s.name} ({s.class_level})</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 font-bold ml-1">หมายเหตุ: หากไม่มีวิชา โปรดลงทะเบียนวิชาในแถบ "ทะเบียนวิชา" ก่อนค่ะ</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 ml-1">ชื่อเอกสาร / แผนการจัดการเรียนรู้</label>
            <input 
              type="text" 
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm" 
              placeholder="เช่น แผนการจัดการเรียนรู้วิชาภาษาไทย หน่วยที่ ๑-๕" 
              required 
              value={formTitle} 
              onChange={e => setFormTitle(e.target.value)} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <label className="text-xs font-bold text-slate-500 ml-1">ระดับชั้น</label>
               <input 
                 type="text" 
                 className="w-full p-3.5 bg-slate-200 border border-slate-200 rounded-2xl font-bold text-sm text-slate-500" 
                 readOnly 
                 value={formClassLevel} 
               />
             </div>
             <div className="space-y-2">
               <label className="text-xs font-bold text-slate-500 ml-1">ภาคเรียน/ปีการศึกษา</label>
               <input 
                 type="text" 
                 className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm" 
                 placeholder="เช่น 1/2569" 
                 required 
                 value={formTerm} 
                 onChange={e => setFormTerm(e.target.value)} 
               />
             </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 ml-1">ไฟล์เอกสารแผนการสอน (PDF เท่านั้น)</label>
            
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50/50 flex flex-col items-center justify-center relative hover:bg-slate-50 hover:border-slate-300 transition-colors">
              <Upload className="text-slate-300 mb-2" size={28} />
              <input 
                type="file" 
                accept=".pdf"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) setFormFile(files[0]);
                }}
              />
              <span className="text-xs font-bold text-slate-500">{formFile ? formFile.name : 'ลากไฟล์ PDF มาวางตรงนี้ หรือคลิกเพื่อค้นหา'}</span>
              <span className="text-[10px] text-slate-400 font-semibold mt-1">อัปโหลดไฟล์ขนาดไม่เกิน 20MB</span>
            </div>
            
            {existingFileUrl && (
              <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-500 w-fit">
                <FileText size={14} className="text-slate-400" />
                <span>มีไฟล์แนบเดิมในระบบแล้ว (อัปโหลดใหม่เพื่อทับไฟล์เดิม)</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
            <button 
              type="button" 
              onClick={() => setIsFormOpen(false)}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-2xl font-bold text-xs text-slate-500 transition-all"
            >
              ยกเลิก
            </button>
            <button 
              type="submit" 
              disabled={isSaving}
              className="px-6 py-3 bg-brand-primary text-white rounded-2xl font-bold text-xs transition-all flex items-center gap-2 hover:shadow-lg disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="animate-spin" size={14} /> : null}
              บันทึกร่างแผน
            </button>
          </div>

        </form>
      </Modal>

      {/* REVIEW / APPROVAL MODAL */}
      <Modal 
        isOpen={isReviewOpen} 
        onClose={() => setIsReviewOpen(false)} 
        title="แบบฟอร์มพิจารณาตรวจสอบแผนการสอน"
      >
        {selectedPlan && (
          <div className="space-y-6">
            
            {/* Quick Metadata Details */}
            <div className="bg-slate-50 p-4 rounded-2xl space-y-2 border border-slate-100">
              <h5 className="font-bold text-slate-700 text-sm">{selectedPlan.title}</h5>
              <div className="grid grid-cols-2 gap-y-2 text-xs font-semibold text-slate-500 pt-2 border-t border-slate-100">
                <div><span className="font-bold">วิชา:</span> {selectedPlan.subject_code} - {selectedPlan.subject_name}</div>
                <div><span className="font-bold">ระดับชั้น:</span> {selectedPlan.class_level}</div>
                <div><span className="font-bold">ภาคเรียน:</span> {selectedPlan.term}</div>
                <div><span className="font-bold">ครูผู้สอน:</span> {selectedPlan.profiles?.display_name || 'ไม่พบรายชื่อ'}</div>
              </div>
              
              {/* PDF Viewer/Download shortcut */}
              <div className="mt-3 pt-2">
                <a 
                  href={selectedPlan.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 hover:bg-slate-900 transition-all shadow-md"
                >
                  <Eye size={12} /> เปิดอ่านเอกสาร PDF ในแถบใหม่
                </a>
              </div>
            </div>

            {/* Display Academic review status/comments if current workspace is Director */}
            {activeWorkspace === 'director_approval' && selectedPlan.academic_comments && (
              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 flex gap-2">
                <MessageSquare size={16} className="text-blue-500 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-600 font-medium">
                  <span className="font-bold">ความเห็นของวิชาการ:</span> {selectedPlan.academic_comments}
                </div>
              </div>
            )}

            {/* Action Review Form */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 ml-1">
                {activeWorkspace === 'academic_review' ? 'บันทึกข้อเสนอแนะของหัวหน้าวิชาการ' : 'บันทึกข้อสั่งการ/ความเห็นของ ผอ.'}
              </label>
              <textarea 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-xs h-28" 
                placeholder="พิมพ์ความคิดเห็น เช่น ผ่านการประเมิน หรือ สิ่งที่ต้องปรับปรุงแก้ไขก่อนรับการอนุมัติ..."
                value={reviewComments}
                onChange={e => setReviewComments(e.target.value)}
              />
            </div>

            {/* Action buttons based on Role */}
            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => setIsReviewOpen(false)}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-2xl font-bold text-xs text-slate-500 transition-all"
              >
                ย้อนกลับ
              </button>

              {activeWorkspace === 'academic_review' && (
                <>
                  <button 
                    type="button"
                    onClick={() => handleAcademicReview('reject')}
                    disabled={isSaving}
                    className="px-5 py-3 bg-red-500 text-white hover:bg-red-600 rounded-2xl font-bold text-xs transition-all disabled:opacity-50"
                  >
                    🔴 ส่งกลับแก้ไข
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleAcademicReview('approve')}
                    disabled={isSaving}
                    className="px-5 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-2xl font-bold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-blue-50"
                  >
                    <ChevronRight size={14} /> ผ่านและเสนอ ผอ.
                  </button>
                </>
              )}

              {activeWorkspace === 'director_approval' && (
                <>
                  <button 
                    type="button"
                    onClick={() => handleDirectorReview('reject')}
                    disabled={isSaving}
                    className="px-5 py-3 bg-orange-500 text-white hover:bg-orange-600 rounded-2xl font-bold text-xs transition-all disabled:opacity-50"
                  >
                    🔴 ตีกลับแก้ไข
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleDirectorReview('approve')}
                    disabled={isSaving}
                    className="px-5 py-3 bg-green-600 text-white hover:bg-green-700 rounded-2xl font-bold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-green-50"
                  >
                    <Check size={14} /> อนุมัติแผนการสอน
                  </button>
                </>
              )}
            </div>

          </div>
        )}
      </Modal>

    </div>
  );
}
