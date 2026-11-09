// School Admin System - Certificates Management Page (ทะเบียนหนังสือรับรอง)
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { uploadFile, deleteFileFromDrive } from '../lib/storage';
import { useAuth } from '../contexts/AuthContext';
import { sendTelegramNotification, escapeHtml } from '../lib/telegramNotify';
import { generateAIDraft } from '../lib/aiService';
import { formatDateDMY } from '../lib/dateUtils';
import Modal from '../components/Modal';
import { DocVerificationCard } from '../components/DocVerificationCard';
import { DocumentNumberingService } from '../services/documentNumberingService';
import { getAccurateNextSequence } from '../lib/docSequence';

import { 
  Search, 
  ExternalLink,
  Loader2,
  Save,
  Trash2,
  Printer,
  FileText,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  Paperclip,
  QrCode,
  BookmarkCheck,
  FileCheck,
  Award,
  DollarSign,
  GraduationCap,
  Briefcase,
  UserCheck,
  ShieldCheck,
  Building,
  User,
  Filter,
  Eye,
  Check,
  Copy,
  Users,
  CheckSquare,
  Square
} from 'lucide-react';
import garuda3cm from '../assets/saraban/garuda-3cm.png';

// ประเภทหนังสือรับรอง
export type CertificateType = 
  | 'salary'        // รับรองเงินเดือนและรายได้
  | 'employment'    // รับรองการเป็นข้าราชการ/ลูกจ้าง
  | 'student'       // รับรองการเป็นนักเรียน
  | 'conduct'       // รับรองความประพฤติ
  | 'duty'          // รับรองการปฏิบัติงาน/หน้าที่ราชการ
  | 'experience'    // รับรองประสบการณ์การทำงาน
  | 'custom';       // เรื่องอื่นๆ / กำหนดเอง

export type HeaderType = 'garuda' | 'no_garuda' | 'school_logo';

const CERTIFICATE_TYPE_LABELS: Record<CertificateType, { label: string; icon: any; color: string; desc: string }> = {
  salary: { 
    label: 'รับรองเงินเดือน/รายได้', 
    icon: DollarSign, 
    color: 'emerald',
    desc: 'สำหรับกู้ยืม สหกรณ์ ธนาคาร หรือทำธุรกรรมการเงิน' 
  },
  employment: { 
    label: 'รับรองการเป็นบุคลากร', 
    icon: Briefcase, 
    color: 'blue',
    desc: 'รับรองสถานะการเป็นข้าราชการครู หรือลูกจ้างในสังกัด' 
  },
  student: { 
    label: 'รับรองการเป็นนักเรียน', 
    icon: GraduationCap, 
    color: 'indigo',
    desc: 'รับรองสถานภาพนักเรียนเพื่อสมัครสอบ ทุน หรือเบิกค่าเล่าเรียน' 
  },
  conduct: { 
    label: 'รับรองความประพฤติ', 
    icon: ShieldCheck, 
    color: 'amber',
    desc: 'รับรองความประพฤติดี ไม่เคยมีประวัติเสื่อมเสีย' 
  },
  duty: { 
    label: 'รับรองการปฏิบัติหน้าที่พิเศษ', 
    icon: Award, 
    color: 'purple',
    desc: 'รับรองการเป็นวิทยากร กรรมการ หรือภารกิจราชการพิเศษ' 
  },
  experience: { 
    label: 'รับรองประสบการณ์ทำงาน', 
    icon: UserCheck, 
    color: 'cyan',
    desc: 'รับรองอายุงาน ประสบการณ์สอน หรือการฝึกวิชาชีพ' 
  },
  custom: { 
    label: 'เรื่องอื่นๆ / กำหนดเอง', 
    icon: FileText, 
    color: 'slate',
    desc: 'กำหนดหัวข้อและข้อความรับรองอิสระ 100%' 
  }
};

export default function Certificates() {
  const { user, profile } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYearBE = new Date().getFullYear() + 543;
  const [selectedYear, setSelectedYear] = useState<number | null>(currentYearBE);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [settings, setSettings] = useState<any>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);

  // Attach Modal
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [selectedDocForAttach, setSelectedDocForAttach] = useState<any>(null);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);

  // QR Modal
  const [selectedDocForQr, setSelectedDocForQr] = useState<any>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [copiedQrLink, setCopiedQrLink] = useState(false);

  // Print Preview Modal
  const [printDoc, setPrintDoc] = useState<any>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // --- Feature 1: Live A4 Preview State ---
  const [formTab, setFormTab] = useState<'editor' | 'preview'>('editor');

  // --- Feature 2: Smart Student Search State ---
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // --- Feature 3: Batch Classroom Issuance States ---
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchClassLevel, setBatchClassLevel] = useState<string>('');
  const [batchPurpose, setBatchPurpose] = useState<string>('เพื่อใช้เป็นหลักฐานในการศึกษาต่อ / สมัครเข้าเรียน');
  const [batchHeaderType, setBatchHeaderType] = useState<HeaderType>('garuda');
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set());
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchSuccessResult, setBatchSuccessResult] = useState<any[] | null>(null);
  const [isBulkPrintModalOpen, setIsBulkPrintModalOpen] = useState(false);
  const [bulkPrintDocs, setBulkPrintDocs] = useState<any[]>([]);
  const [printGarudaOption, setPrintGarudaOption] = useState<HeaderType>('garuda');
  const [printShowQr, setPrintShowQr] = useState(true);

  // Form State
  const initialFormState = {
    certificate_number: '',
    doc_year: currentYearBE,
    doc_sequence: 1,
    certificate_type: 'employment' as CertificateType,
    custom_type_name: '',
    header_type: 'garuda' as HeaderType,
    subject: 'หนังสือรับรองการเป็นบุคลากร',
    recipient_type: 'teacher' as 'teacher' | 'student' | 'external' | 'organization',
    recipient_id: '',
    recipient_name: '',
    recipient_id_card: '',
    recipient_position_or_grade: '',
    recipient_salary: '',
    recipient_department: 'กลุ่มงานบริหารวิชาการ',
    certificate_date: new Date().toISOString().split('T')[0],
    content: '',
    purpose: 'เพื่อใช้เป็นหลักฐานประกอบการดำเนินการตามความประสงค์',
    issuer: 'โรงเรียนบ้านควนโคกยา',
    sign_name: 'นายเอกคณิต สิทธิศักดิ์',
    sign_position: 'ผู้อำนวยการโรงเรียนบ้านควนโคกยา',
    status: 'approved',
    remark: '',
    is_reserved: false,
    reserved_by_name: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  // ดึงข้อมูลการตั้งค่าและทะเบียน
  useEffect(() => {
    fetchSettingsAndInitialData();
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [selectedYear]);

  const fetchSettingsAndInitialData = async () => {
    try {
      const { data: setRes } = await supabase.from('settings').select('*').maybeSingle();
      if (setRes) {
        setSettings(setRes);
        if (setRes.director_name) {
          initialFormState.sign_name = setRes.director_name;
        }
        if (setRes.school_name) {
          initialFormState.issuer = setRes.school_name;
        }
      }

      // ดึงรายชื่อครู
      const { data: tData } = await supabase
        .from('teachers')
        .select('*')
        .order('first_name', { ascending: true });
      if (tData) setTeachers(tData);

      // ดึงรายชื่อนักเรียนทั้งหมด
      const { data: sData, error: sErr } = await supabase
        .from('students')
        .select('*')
        .order('class_level', { ascending: true })
        .order('student_id', { ascending: true });
      if (sData && sData.length > 0) {
        setStudents(sData);
        // กำหนดชั้นเรียนเริ่มต้นสำหรับ Batch modal
        const firstClass = sData[0]?.class_level || sData[0]?.grade;
        if (firstClass) setBatchClassLevel(firstClass);
      } else if (sErr) {
        console.warn('Note on fetching students:', sErr.message);
      }

    } catch (err) {
      console.error('Error fetching settings/teachers:', err);
    }
  };

  const fetchDocs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('certificates')
        .select('*')
        .order('doc_sequence', { ascending: false });

      if (selectedYear !== null) {
        query = query.eq('doc_year', selectedYear);
      }

      const { data, error } = await query;
      if (error) {
        // หากตารางยังไม่ถูกสร้างใน Supabase ให้แจ้งเตือนนุ่มนวล
        if (error.code === '42P01') {
          console.warn('Table certificates does not exist yet. Please run migration script.');
          setDocs([]);
          return;
        }
        throw error;
      }
      setDocs(data || []);
    } catch (err) {
      console.error('Error fetching certificates:', err);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  // ดึงเลขถัดไปอัตโนมัติ
  const getNextNumber = async (year: number) => {
    try {
      const startingSeq = settings?.start_certificate_seq || 1;
      const nextSeq = await getAccurateNextSequence(supabase, 'certificates', year, startingSeq);
      // มาตรฐานงานสารบรรณ: หนังสือรับรองใช้รูปแบบ "เลข/ปี พ.ศ." (เช่น 1/2569)
      const prefix = (settings?.certificate_doc_prefix || '').trim();
      const formatted = prefix 
        ? `${prefix}${nextSeq}/${year}` 
        : `${nextSeq}/${year}`;

      return { sequence: nextSeq, formattedNumber: formatted };
    } catch (err) {
      console.error('Error getting next certificate number:', err);
      return { sequence: 1, formattedNumber: `1/${year}` };
    }
  };

  // สร้างข้อความแม่แบบอัตโนมัติเมื่อเลือกประเภท
  const generateTemplateContent = (
    type: CertificateType,
    name: string,
    positionOrGrade: string,
    idCard: string,
    salary: string,
    purpose: string
  ) => {
    const schoolName = settings?.school_name || 'โรงเรียนบ้านควนโคกยา';
    const recipientDisplay = name || '[ชื่อ-นามสกุล]';
    const idDisplay = idCard ? `เลขประจำตัวประชาชน ${idCard}` : '';
    
    switch (type) {
      case 'salary':
        return `หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า ${recipientDisplay} ${idDisplay} ปัจจุบันดำรงตำแหน่ง ${positionOrGrade || 'ข้าราชการครู'} สังกัด${schoolName} ได้รับเงินเดือนในอัตราเดือนละ ${salary ? Number(salary).toLocaleString() : '..........'} บาท (........................................) จริง ทั้งนี้ มีภาระงานสอนและการปฏิบัติราชการเป็นไปตามระเบียบของทางราชการด้วยความเรียบร้อยบริสุทธิ์ยุติธรรม`;
      
      case 'employment':
        return `หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า ${recipientDisplay} ${idDisplay} ปัจจุบันเป็นบุคลากรสังกัด${schoolName} ดำรงตำแหน่ง ${positionOrGrade || 'ครู'} ได้ปฏิบัติหน้าที่ราชการด้วยความวิริยะ อุตสาหะ และรับผิดชอบต่องานในหน้าที่อย่างดียิ่งมาโดยตลอด`;
      
      case 'student':
        return `หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า ${recipientDisplay} ${idCard ? `เลขประจำตัวนักเรียน ${idCard}` : ''} กำลังศึกษาอยู่ชั้น ${positionOrGrade || 'ประถมศึกษาปีที่ ...'} ของ${schoolName} ในปีการศึกษา ${currentYearBE} จริง`;
      
      case 'conduct':
        return `หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า ${recipientDisplay} ${idDisplay} เป็นผู้มีความประพฤติเรียบร้อย มีคุณธรรม จริยธรรม ปฏิบัติตนตามระเบียบแบบแผนของสถานศึกษาและสังคมอย่างเคร่งครัด ไม่เคยปรากฏประวัติเสื่อมเสียหรือต้องโทษทางวินัยใดๆ`;
      
      case 'duty':
        return `หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า ${recipientDisplay} ได้ปฏิบัติหน้าที่ราชการพิเศษอันเป็นประโยชน์ต่อการจัดการศึกษาของ${schoolName} โดยได้ทุ่มเทแรงกายและสติปัญญาจนสำเร็จลุล่วงด้วยความเรียบร้อย`;
      
      case 'experience':
        return `หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า ${recipientDisplay} ได้ปฏิบัติงานในตำแหน่ง ${positionOrGrade || 'ครูผู้สอน'} ณ ${schoolName} โดยมีประสบการณ์การจัดการเรียนรู้และการทำงานร่วมกับชุมชนอย่างมีประสิทธิภาพ`;
      
      case 'custom':
      default:
        return `หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า ${recipientDisplay} ${idDisplay} ได้ดำเนินการตามที่ปรากฏในบันทึกของสถานศึกษาจริงทุกประการ`;
    }
  };

  // เปิด Modal สร้างใหม่
  // เปิด Modal เพื่อจองเลขด่วน
  const handleOpenReserveModal = async () => {
    setEditingDocId(null);
    const { sequence, formattedNumber } = await getNextNumber(currentYearBE);

    setFormData({
      ...initialFormState,
      certificate_number: formattedNumber,
      doc_year: currentYearBE,
      doc_sequence: sequence,
      is_reserved: true,
      status: 'reserved',
      reserved_by_name: (user as any)?.display_name || (user as any)?.user_metadata?.full_name || user?.email || 'เจ้าหน้าที่ธุรการ/สารบรรณ',
      subject: 'ขอจองเลขหนังสือรับรอง (รอเอกสารฉบับสมบูรณ์)',
      content: 'จองเลขหนังสือรับรอง (รอเอกสารฉบับสมบูรณ์)'
    });
    setIsModalOpen(true);
  };

  const handleOpenCreateModal = async () => {
    setFormTab('editor');
    setStudentSearchQuery('');
    setEditingDocId(null);
    const { sequence, formattedNumber } = await getNextNumber(currentYearBE);
    
    const newForm = {
      ...initialFormState,
      certificate_number: formattedNumber,
      doc_year: currentYearBE,
      doc_sequence: sequence,
      issuer: settings?.school_name || 'โรงเรียนบ้านควนโคกยา',
      sign_name: settings?.director_name || 'นายเอกคณิต สิทธิศักดิ์',
      sign_position: 'ผู้อำนวยการ' + (settings?.school_name || 'โรงเรียนบ้านควนโคกยา'),
      content: generateTemplateContent(
        'employment',
        '',
        '',
        '',
        '',
        'เพื่อใช้เป็นหลักฐานประกอบการดำเนินการตามความประสงค์'
      )
    };

    setFormData(newForm);
    setIsModalOpen(true);
  };

  // จัดการเมื่อเปลี่ยนครูใน Dropdown
  const handleTeacherSelect = (teacherId: string) => {
    const t = teachers.find(item => item.id === teacherId);
    if (!t) return;

    const fullName = `${t.prefix || ''}${t.first_name} ${t.last_name}`.trim();
    const position = t.position || 'ครู';
    const dept = t.department || 'กลุ่มงานบริหารวิชาการ';
    const salary = t.salary ? String(t.salary) : '';

    const newContent = generateTemplateContent(
      formData.certificate_type,
      fullName,
      position,
      t.citizen_id || '',
      salary,
      formData.purpose
    );

    setFormData(prev => ({
      ...prev,
      recipient_id: t.id,
      recipient_name: fullName,
      recipient_position_or_grade: position,
      recipient_department: dept,
      recipient_salary: salary,
      recipient_id_card: t.citizen_id || prev.recipient_id_card,
      content: newContent
    }));
  };

  // จัดการเมื่อเปลี่ยนนักเรียน (Smart Student Selection)
  const handleStudentSelect = (studentId: string) => {
    const s = students.find(item => item.id === studentId);
    if (!s) return;

    const prefix = s.prefix || s.title || '';
    const fullName = `${prefix}${s.first_name} ${s.last_name}`.trim();
    const rawClass = s.class_level || s.grade || '';
    const gradeRoom = rawClass 
      ? (rawClass.startsWith('ป.') 
          ? `ชั้นประถมศึกษาปีที่ ${rawClass.replace('ป.', '')}${s.room ? `/${s.room}` : ''}`
          : rawClass.startsWith('อ.')
            ? `ชั้นอนุบาล ${rawClass.replace('อ.', '')}${s.room ? `/${s.room}` : ''}`
            : `ชั้น${rawClass}${s.room ? `/${s.room}` : ''}`)
      : 'นักเรียน';
    const idCard = s.national_id || s.citizen_id || s.student_id || '';

    const newContent = generateTemplateContent(
      formData.certificate_type,
      fullName,
      gradeRoom,
      idCard,
      '',
      formData.purpose
    );

    setFormData(prev => ({
      ...prev,
      recipient_id: s.id,
      recipient_name: fullName,
      recipient_position_or_grade: gradeRoom,
      recipient_id_card: idCard,
      content: newContent
    }));
  };

  // กรองรายชื่อนักเรียนสำหรับ Smart Search
  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return students.slice(0, 30);
    const q = studentSearchQuery.toLowerCase().trim();
    return students.filter(s => {
      const fullName = `${s.prefix || s.title || ''}${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
      const stdId = String(s.student_id || '').toLowerCase();
      const natId = String(s.national_id || s.citizen_id || '').toLowerCase();
      const cls = String(s.class_level || s.grade || '').toLowerCase();
      return fullName.includes(q) || stdId.includes(q) || natId.includes(q) || cls.includes(q);
    }).slice(0, 40);
  }, [students, studentSearchQuery]);

  // รายการระดับชั้นทั้งหมดสำหรับ Batch Modal
  const availableClassLevels = useMemo(() => {
    const classes = Array.from(new Set(students.map(s => s.class_level || s.grade).filter(Boolean)));
    return classes.sort();
  }, [students]);

  // รายชื่อนักเรียนในชั้นที่เลือกสำหรับ Batch
  const batchStudents = useMemo(() => {
    if (!batchClassLevel) return [];
    return students.filter(s => (s.class_level || s.grade) === batchClassLevel);
  }, [students, batchClassLevel]);

  // เมื่อเปลี่ยนห้องใน Batch ให้เลือกเด็กทั้งหมดในห้องเป็นค่าเริ่มต้น
  const handleBatchClassChange = (newClass: string) => {
    setBatchClassLevel(newClass);
    const inClass = students.filter(s => (s.class_level || s.grade) === newClass);
    setBatchSelectedIds(new Set(inClass.map(s => s.id)));
    setBatchSuccessResult(null);
  };

  // สลับเลือกทั้งหมด / ปลดทั้งหมด ใน Batch
  const handleToggleSelectAllBatch = () => {
    if (batchSelectedIds.size === batchStudents.length) {
      setBatchSelectedIds(new Set());
    } else {
      setBatchSelectedIds(new Set(batchStudents.map(s => s.id)));
    }
  };

  // สลับเลือกนักเรียนรายคนใน Batch
  const handleToggleStudentBatch = (id: string) => {
    setBatchSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // เปิด Batch Modal
  const handleOpenBatchModal = () => {
    const initialClass = batchClassLevel || availableClassLevels[0] || 'ป.6';
    setBatchClassLevel(initialClass);
    const inClass = students.filter(s => (s.class_level || s.grade) === initialClass);
    setBatchSelectedIds(new Set(inClass.map(s => s.id)));
    setBatchSuccessResult(null);
    setIsBatchModalOpen(true);
  };

  // ยืนยันการออกหนังสือรับรองยกห้องเรียน
  const handleBatchSubmit = async () => {
    if (batchSelectedIds.size === 0) {
      alert('กรุณาเลือกนักเรียนอย่างน้อย 1 คน');
      return;
    }

    setBatchSubmitting(true);
    try {
      const startingSeq = settings?.start_certificate_seq || 1;
      const nextSeq = await getAccurateNextSequence(supabase, 'certificates', currentYearBE, startingSeq);
      const prefix = (settings?.certificate_doc_prefix || '').trim();
      const schoolName = settings?.school_name || 'โรงเรียนบ้านควนโคกยา';
      const directorName = settings?.director_name || 'นายเอกคณิต สิทธิศักดิ์';
      const directorPos = settings?.director_position || 'ผู้อำนวยการโรงเรียนบ้านควนโคกยา';
      const todayIso = new Date().toISOString().split('T')[0];

      const selectedStudentsList = batchStudents.filter(s => batchSelectedIds.has(s.id));
      const newRecords = selectedStudentsList.map((s, idx) => {
        const seq = nextSeq + idx;
        const certNum = prefix ? `${prefix}${seq}/${currentYearBE}` : `${seq}/${currentYearBE}`;
        const pfx = s.prefix || s.title || '';
        const fullName = `${pfx}${s.first_name} ${s.last_name}`.trim();
        const rawClass = s.class_level || s.grade || batchClassLevel;
        const gradeRoom = rawClass 
          ? (rawClass.startsWith('ป.') 
              ? `ชั้นประถมศึกษาปีที่ ${rawClass.replace('ป.', '')}${s.room ? `/${s.room}` : ''}`
              : rawClass.startsWith('อ.')
                ? `ชั้นอนุบาล ${rawClass.replace('อ.', '')}${s.room ? `/${s.room}` : ''}`
                : `ชั้น${rawClass}${s.room ? `/${s.room}` : ''}`)
          : 'นักเรียน';
        const idCard = s.national_id || s.citizen_id || s.student_id || '';
        const content = generateTemplateContent('student', fullName, gradeRoom, idCard, '', batchPurpose);

        return {
          certificate_number: certNum,
          doc_year: currentYearBE,
          doc_sequence: seq,
          certificate_type: 'student',
          header_type: batchHeaderType,
          subject: `หนังสือรับรองการเป็นนักเรียน - ${fullName}`,
          recipient_type: 'student',
          recipient_id: s.id,
          recipient_name: fullName,
          recipient_id_card: idCard,
          recipient_position_or_grade: gradeRoom,
          recipient_department: 'ฝ่ายวิชาการ',
          certificate_date: todayIso,
          content,
          purpose: batchPurpose,
          issuer: schoolName,
          sign_name: directorName,
          sign_position: directorPos,
          status: 'approved',
          is_reserved: false
        };
      });

      const { data: inserted, error: insertErr } = await supabase
        .from('certificates')
        .insert(newRecords)
        .select('*');

      if (insertErr) throw insertErr;

      // ส่งแจ้งเตือน Telegram (Non-blocking)
      const firstNum = newRecords[0]?.certificate_number;
      const lastNum = newRecords[newRecords.length - 1]?.certificate_number;
      const batchMsg = `👥 <b>ออกหนังสือรับรองยกห้องเรียนสำเร็จ</b>\n` +
        `• 🏫 <b>${escapeHtml(schoolName)}</b>\n` +
        `• 📚 ชั้นเรียน: <b>${escapeHtml(batchClassLevel)}</b>\n` +
        `• 👥 จำนวน: <b>${newRecords.length} คน</b>\n` +
        `• 🔢 ช่วงเลขที่: <code>${firstNum}</code> ถึง <code>${lastNum}</code>\n` +
        `• 🎯 วัตถุประสงค์: ${escapeHtml(batchPurpose)}`;
      sendTelegramNotification(batchMsg).catch(e => console.warn('Telegram batch notify error:', e));

      setBatchSuccessResult(inserted || newRecords);
      fetchDocs();
    } catch (err: any) {
      console.error('Error batch issuing certificates:', err);
      alert('เกิดข้อผิดพลาดในการออกหนังสือรับรองยกห้อง: ' + err.message);
    } finally {
      setBatchSubmitting(false);
    }
  };

  // เปิดหน้าต่างสั่งพิมพ์ชุดใหญ่ (Bulk Print)
  const handleOpenBulkPrint = (docs: any[]) => {
    setBulkPrintDocs(docs);
    setIsBulkPrintModalOpen(true);
  };

  // จัดการเมื่อเปลี่ยนประเภทหนังสือรับรอง
  const handleTypeChange = (newType: CertificateType) => {
    const subLabel = CERTIFICATE_TYPE_LABELS[newType].label;
    const newContent = generateTemplateContent(
      newType,
      formData.recipient_name,
      formData.recipient_position_or_grade,
      formData.recipient_id_card,
      formData.recipient_salary,
      formData.purpose
    );

    setFormData(prev => ({
      ...prev,
      certificate_type: newType,
      subject: `หนังสือรับรอง${subLabel.replace('รับรอง', '')}`,
      content: newContent
    }));
  };

  // AI ช่วยร่าง/ขัดเกลาสำนวนราชการ
  const handleAIDraft = async () => {
    if (!formData.recipient_name) {
      alert('กรุณาระบุชื่อผู้ได้รับการรับรองก่อนให้ AI ช่วยร่างครับ');
      return;
    }

    setIsDrafting(true);
    try {
      const prompt = `คุณคือผู้เชี่ยวชาญงานสารบรรณสถานศึกษาไทย
โปรดเขียนหรือขัดเกลาข้อความ "หนังสือรับรอง" ตามระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ พ.ศ. ๒๕๒๖ ให้ถูกต้อง สละสลวย กระชับ และเป็นแบบแผนราชการ
- หน่วยงานที่ออก: ${formData.issuer}
- ผู้ได้รับการรับรอง: ${formData.recipient_name}
- ตำแหน่ง/ชั้นเรียน: ${formData.recipient_position_or_grade || '-'}
- เลขประจำตัว/บัตร: ${formData.recipient_id_card || '-'}
- ประเภทการรับรอง: ${CERTIFICATE_TYPE_LABELS[formData.certificate_type].label}
- ข้อมูลเพิ่มเติม/วัตถุประสงค์: ${formData.purpose} ${formData.recipient_salary ? `(เงินเดือน ${formData.recipient_salary} บาท)` : ''}
- เนื้อหาเดิมหรือใจความที่ต้องการ: "${formData.content}"

ข้อกำหนด: 
- ให้ขึ้นต้นด้วย "หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า..."
- ไม่ต้องใส่หัวเรื่องหรือลงชื่อท้ายจดหมาย ให้ตอบเฉพาะ "ตัวเนื้อความของหนังสือรับรอง" 1-2 ย่อหน้าเท่านั้น
- สำนวนภาษาต้องเป็นทางการ ถูกต้องตามพจนานุกรมราชบัณฑิตยสถาน`;

      const aiText = await generateAIDraft(prompt);
      if (aiText && aiText.trim()) {
        setFormData(prev => ({
          ...prev,
          content: aiText.trim()
        }));
      }
    } catch (err: any) {
      console.error('AI Draft Error:', err);
      alert('เกิดข้อผิดพลาดในการเรียก AI: ' + err.message);
    } finally {
      setIsDrafting(false);
    }
  };

  // บันทึกข้อมูล (DB-First & Instant UI)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.certificate_number || !formData.recipient_name) {
      alert('กรุณากรอกข้อมูลที่จำเป็น (เลขที่หนังสือรับรอง และ ชื่อผู้ขอรับรอง)');
      return;
    }
    if (!formData.is_reserved && !formData.content) {
      alert('กรุณากรอกข้อความรับรอง หรือเลือกทำรายการเป็น "จองเลขไว้ก่อน"');
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        certificate_number: formData.certificate_number,
        doc_year: formData.doc_year,
        doc_sequence: formData.doc_sequence,
        certificate_type: formData.certificate_type,
        custom_type_name: formData.custom_type_name || null,
        header_type: formData.header_type,
        subject: formData.subject,
        recipient_type: formData.recipient_type,
        recipient_id: formData.recipient_id || null,
        recipient_name: formData.recipient_name,
        recipient_id_card: formData.recipient_id_card || null,
        recipient_position_or_grade: formData.recipient_position_or_grade || null,
        recipient_salary: formData.recipient_salary ? parseFloat(formData.recipient_salary) : null,
        recipient_department: formData.recipient_department || null,
        certificate_date: formData.certificate_date,
        content: formData.content,
        purpose: formData.purpose,
        issuer: formData.issuer,
        sign_name: formData.sign_name,
        sign_position: formData.sign_position,
        status: formData.is_reserved ? 'reserved' : formData.status,
        is_reserved: formData.is_reserved || false,
        reserved_by_name: formData.reserved_by_name || null,
        remark: formData.remark || null,
        created_by: user?.id || null
      };

      if (editingDocId) {
        // อัปเดตรายการเดิม
        const { error } = await supabase
          .from('certificates')
          .update(payload)
          .eq('id', editingDocId);
        if (error) throw error;

        // Instant Optimistic UI
        setDocs(prev => prev.map(d => d.id === editingDocId ? { ...d, ...payload } : d));
      } else {
        // สร้างรายการใหม่
        const { data, error } = await supabase
          .from('certificates')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;

        // Instant Optimistic UI
        setDocs(prev => [data, ...prev]);

        // ยืนยันการใช้เลขใน centralized numbering (เบื้องหลัง)
        DocumentNumberingService.confirmNumber('ALLOC_' + data.id, 'certificates', data.id).catch(() => {});

        // ส่งแจ้งเตือน Telegram เบื้องหลัง (Non-blocking)
        const tgMsg = `📜 <b>ออกหนังสือรับรองใหม่</b>\n` +
          `• เลขที่: <code>${escapeHtml(payload.certificate_number)}</code>\n` +
          `• ประเภท: ${CERTIFICATE_TYPE_LABELS[payload.certificate_type as CertificateType]?.label || 'หนังสือรับรอง'}\n` +
          `• ออกให้: <b>${escapeHtml(payload.recipient_name)}</b>\n` +
          `• วัตถุประสงค์: ${escapeHtml(payload.purpose || '-')}`;
        sendTelegramNotification(tgMsg).catch(() => {});
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving certificate:', err);
      alert('บันทึกไม่สำเร็จ: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ลบรายการ
  const handleDelete = async (doc: any) => {
    if (!confirm(`คุณต้องการลบหนังสือรับรองเลขที่ "${doc.certificate_number}" ใช่หรือไม่?`)) return;

    try {
      const { error } = await supabase.from('certificates').delete().eq('id', doc.id);
      if (error) throw error;
      setDocs(prev => prev.filter(d => d.id !== doc.id));
    } catch (err: any) {
      alert('ลบไม่สำเร็จ: ' + err.message);
    }
  };

  // แนบไฟล์
  const handleAttachSubmit = async () => {
    if (!attachFile || !selectedDocForAttach) return;
    setIsAttaching(true);
    try {
      const fileUrl = await uploadFile(attachFile, 'certificates');
      if (fileUrl) {
        await supabase.from('certificates').update({ file_url: fileUrl, is_reserved: false, status: 'approved' }).eq('id', selectedDocForAttach.id);
        setDocs(prev => prev.map(d => d.id === selectedDocForAttach.id ? { ...d, file_url: fileUrl, is_reserved: false, status: 'approved' } : d));
      }
      setIsAttachModalOpen(false);
      setAttachFile(null);
    } catch (err: any) {
      alert('อัปโหลดไฟล์ไม่สำเร็จ: ' + err.message);
    } finally {
      setIsAttaching(false);
    }
  };

  // กรองข้อมูลในตาราง
  const filteredDocs = useMemo(() => {
    return docs.filter(doc => {
      const matchType = typeFilter === 'all' || doc.certificate_type === typeFilter;
      const search = searchTerm.trim().toLowerCase();
      const matchSearch = !search || 
        doc.certificate_number?.toLowerCase().includes(search) ||
        doc.recipient_name?.toLowerCase().includes(search) ||
        doc.subject?.toLowerCase().includes(search) ||
        doc.purpose?.toLowerCase().includes(search);
      return matchType && matchSearch;
    });
  }, [docs, typeFilter, searchTerm]);

  // สถิติหัวการ์ด
  const stats = useMemo(() => {
    const total = docs.length;
    const staffCount = docs.filter(d => d.certificate_type === 'salary' || d.certificate_type === 'employment').length;
    const studentCount = docs.filter(d => d.certificate_type === 'student' || d.certificate_type === 'conduct').length;
    const otherCount = total - staffCount - studentCount;
    return { total, staffCount, studentCount, otherCount };
  }, [docs]);

  // คำนวณวันที่ภาษาไทย
  const formatThaiFullDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = date.getDate();
    const months = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const month = months[date.getMonth()];
    const year = date.getFullYear() + 543;
    return `วันที่ ${day} เดือน ${month} พ.ศ. ${year}`;
  };

  // เปิดดูหน้าพิมพ์
  const handleOpenPrint = (doc: any) => {
    setPrintDoc(doc);
    setPrintGarudaOption(doc.header_type || 'garuda');
    setIsPrintModalOpen(true);
  };

  // สั่งพิมพ์ทันทีผ่านเบราว์เซอร์
  const handlePrintTrigger = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ส่วนหัวหน้าจอ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <FileCheck size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                ทะเบียนหนังสือรับรอง
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  งานสารบรรณ
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                ระบบออกเลข จัดทำ และพิมพ์หนังสือรับรองตามระเบียบสำนักนายกรัฐมนตรีฯ
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* เลือกปี พ.ศ. */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-2xs">
            <button
              onClick={() => setSelectedYear(currentYearBE)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                selectedYear === currentYearBE 
                  ? 'bg-white text-emerald-700 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ปี {currentYearBE}
            </button>
            <button
              onClick={() => setSelectedYear(currentYearBE - 1)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                selectedYear === currentYearBE - 1 
                  ? 'bg-white text-emerald-700 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ปี {currentYearBE - 1}
            </button>
            <button
              onClick={() => setSelectedYear(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                selectedYear === null 
                  ? 'bg-white text-emerald-700 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด
            </button>
          </div>

          <button
            onClick={handleOpenReserveModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            title="ขอจองเลขหนังสือรับรองไว้ล่วงหน้าโดยยังไม่ต้องกรอกข้อความสมบูรณ์"
          >
            <BookmarkCheck size={16} />
            <span>จองเลขรับรอง</span>
          </button>

          <button
            onClick={handleOpenBatchModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            title="ออกหนังสือรับรองนักเรียนยกห้องเรียน พร้อมรันเลขลำดับต่อเนื่องอัตโนมัติ"
          >
            <Users size={16} />
            <span>ออกรับรองยกห้องเรียน</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Plus size={16} />
            <span>ออกเลข / สร้างหนังสือรับรอง</span>
          </button>
        </div>
      </div>

      {/* สถิติสรุป (Stats Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold">หนังสือรับรองทั้งหมด</span>
            <FileCheck size={18} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {stats.total} <span className="text-xs font-normal text-slate-400">ฉบับ</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold">รับรองบุคลากร/เงินเดือน</span>
            <DollarSign size={18} className="text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 tracking-tight">
            {stats.staffCount} <span className="text-xs font-normal text-slate-400">ฉบับ</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold">รับรองนักเรียน/ความประพฤติ</span>
            <GraduationCap size={18} className="text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600 tracking-tight">
            {stats.studentCount} <span className="text-xs font-normal text-slate-400">ฉบับ</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold">เรื่องอื่นๆ/ภายนอก</span>
            <Award size={18} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 tracking-tight">
            {stats.otherCount} <span className="text-xs font-normal text-slate-400">ฉบับ</span>
          </div>
        </div>
      </div>

      {/* แถบค้นหาและตัวกรอง */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาเลขที่, ชื่อผู้รับรอง, เรื่อง..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
          />
        </div>

        {/* ฟิลเตอร์ประเภท */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <Filter size={14} className="text-slate-400 shrink-0 hidden sm:block mr-1" />
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              typeFilter === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            ทั้งหมด
          </button>
          {Object.entries(CERTIFICATE_TYPE_LABELS).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                typeFilter === key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {val.label}
            </button>
          ))}
        </div>
      </div>

      {/* ตารางทะเบียนหนังสือรับรอง */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[15%]" />
              <col className="w-[18%]" />
              <col className="w-[23%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">เลขที่หนังสือ</th>
                <th className="py-3.5 px-3">วันที่ออกหนังสือ</th>
                <th className="py-3.5 px-3">ประเภท</th>
                <th className="py-3.5 px-3">ผู้ได้รับการรับรอง</th>
                <th className="py-3.5 px-3">เรื่อง / วัตถุประสงค์</th>
                <th className="py-3.5 px-3 text-center">ไฟล์แนบ</th>
                <th className="py-3.5 px-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2 text-emerald-500" />
                    กำลังโหลดข้อมูลทะเบียนหนังสือรับรอง...
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FileText size={32} className="mx-auto mb-2 opacity-30" />
                    ไม่พบข้อมูลหนังสือรับรองตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredDocs.map(doc => {
                  const typeMeta = CERTIFICATE_TYPE_LABELS[doc.certificate_type as CertificateType] || CERTIFICATE_TYPE_LABELS.custom;
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 font-mono text-[11px]">
                            {doc.certificate_number}
                          </span>
                          {(doc.is_reserved || doc.status === 'reserved') && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[10px] font-black inline-flex items-center gap-1" title="จองเลขไว้ก่อน ยังไม่มีไฟล์เอกสารสมบูรณ์">
                              🟡 จองเลขแล้ว
                            </span>
                          )}
                        </div>
                        {doc.header_type === 'no_garuda' && (
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            (กระดาษหัวครุฑ)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 font-medium">
                        {formatDateDMY(doc.certificate_date)}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {typeMeta.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-bold text-slate-800">
                        <div className="truncate" title={doc.recipient_name}>
                          {doc.recipient_name}
                        </div>
                        {doc.recipient_position_or_grade && (
                          <div className="text-[10px] text-slate-400 font-normal truncate">
                            {doc.recipient_position_or_grade}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">
                        <div className="font-bold text-slate-800 line-clamp-1" title={doc.subject}>
                          {doc.subject}
                        </div>
                        <div className="text-[10px] text-slate-400 line-clamp-1" title={doc.purpose}>
                          {doc.purpose || '-'}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {doc.file_url ? (
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all"
                            title="ดูไฟล์แนบฉบับจริง"
                          >
                            <Paperclip size={12} />
                            <span>ดูไฟล์</span>
                          </a>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedDocForAttach(doc);
                              setIsAttachModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
                            title="แนบไฟล์สแกนฉบับลงนาม"
                          >
                            <Plus size={12} />
                            <span>แนบไฟล์</span>
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenPrint(doc)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="พิมพ์หนังสือรับรอง (A4 Portrait)"
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDocForQr(doc);
                              setIsQrModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="QR Code ตรวจสอบความถูกต้อง"
                          >
                            <QrCode size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(doc)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="ลบรายการ"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ฟอร์มสร้าง / แก้ไขหนังสือรับรอง                                   */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDocId ? 'แก้ไขหนังสือรับรอง' : 'ออกเลข & จัดทำหนังสือรับรองใหม่'}
      >
        <div className="space-y-4 max-h-[85vh] overflow-y-auto px-1">
          {/* Dual-Tab Control: Editor vs Live A4 Preview */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 sticky top-0 bg-white z-10">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setFormTab('editor')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  formTab === 'editor'
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📝 กรอกข้อมูล / ร่างเนื้อหา
              </button>
              <button
                type="button"
                onClick={() => setFormTab('preview')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  formTab === 'preview'
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye size={14} />
                <span>ดูตัวอย่าง A4 เสมือนจริง</span>
              </button>
            </div>
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              {formTab === 'preview' ? 'จำลองหน้ากระดาษ A4 เสมือนพิมพ์จริง' : 'จัดทำข้อมูลสารบรรณ'}
            </span>
          </div>

          {formTab === 'editor' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
          {/* แถบเลือกรูปแบบหัวเอกสาร (มีครุฑ / ไม่มีครุฑ / ตราโรงเรียน) */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              1. รูปแบบหัวเอกสารสำหรับพิมพ์ (Header Type)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label 
                className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  formData.header_type === 'garuda' 
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs font-bold' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input 
                  type="radio" 
                  name="header_type" 
                  value="garuda" 
                  checked={formData.header_type === 'garuda'}
                  onChange={() => setFormData(prev => ({ ...prev, header_type: 'garuda' }))}
                  className="text-emerald-600"
                />
                <span className="text-xs">🦅 มีตราครุฑ (กระดาษขาว A4)</span>
              </label>

              <label 
                className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  formData.header_type === 'no_garuda' 
                    ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-2xs font-bold' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input 
                  type="radio" 
                  name="header_type" 
                  value="no_garuda" 
                  checked={formData.header_type === 'no_garuda'}
                  onChange={() => setFormData(prev => ({ ...prev, header_type: 'no_garuda' }))}
                  className="text-amber-600"
                />
                <span className="text-xs">📄 ไม่มีตราครุฑ (หัวครุฑสำเร็จรูป)</span>
              </label>

              <label 
                className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  formData.header_type === 'school_logo' 
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-2xs font-bold' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input 
                  type="radio" 
                  name="header_type" 
                  value="school_logo" 
                  checked={formData.header_type === 'school_logo'}
                  onChange={() => setFormData(prev => ({ ...prev, header_type: 'school_logo' }))}
                  className="text-indigo-600"
                />
                <span className="text-xs">🏫 ตราสัญลักษณ์โรงเรียน</span>
              </label>
            </div>
            <p className="text-[10px] text-slate-400 italic">
              * หากพิมพ์ลงกระดาษที่มีตราครุฑพิมพ์สำเร็จรูปแล้ว ให้เลือก "ไม่มีตราครุฑ" ระบบจะเว้นระยะหัวกระดาษให้อัตโนมัติ
            </p>
          </div>

          {/* แถบเลือกประเภทหนังสือรับรอง */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              2. เลือกประเภทหนังสือรับรอง (Template Category)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(CERTIFICATE_TYPE_LABELS).map(([key, val]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => handleTypeChange(key as CertificateType)}
                  className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                    formData.certificate_type === key
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <val.icon size={14} />
                    <span className="truncate">{val.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ข้อมูลเลขที่และวันที่ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                เลขที่หนังสือรับรอง *
              </label>
              <input
                type="text"
                required
                value={formData.certificate_number}
                onChange={e => setFormData(prev => ({ ...prev, certificate_number: e.target.value }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
                placeholder="เช่น 1/2569 หรือ 15/2569"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                วันที่ออกหนังสือ *
              </label>
              <input
                type="date"
                required
                value={formData.certificate_date}
                onChange={e => setFormData(prev => ({ ...prev, certificate_date: e.target.value }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* ตัวเลือกดึงข้อมูลผู้ได้รับการรับรอง */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/40 border border-emerald-100 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <UserCheck size={14} />
                <span>3. ข้อมูลผู้ได้รับการรับรอง (Smart Auto-Fill)</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500">เลือกดึงจาก:</span>
                <select
                  value={formData.recipient_type}
                  onChange={e => setFormData(prev => ({ ...prev, recipient_type: e.target.value as any }))}
                  className="p-1 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800"
                >
                  <option value="teacher">ครู/บุคลากร (teachers)</option>
                  <option value="student">นักเรียน (students)</option>
                  <option value="external">บุคคลภายนอก/ทั่วไป</option>
                </select>
              </div>
            </div>

            {formData.recipient_type === 'teacher' && (
              <div className="space-y-1">
                <label className="text-[10px] text-slate-600 font-bold">เลือกครู/บุคลากรในโรงเรียน:</label>
                <select
                  onChange={e => handleTeacherSelect(e.target.value)}
                  className="w-full p-2 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-slate-800"
                  defaultValue=""
                >
                  <option value="" disabled>-- คลิกเลือกครูเพื่อเติมข้อมูลอัตโนมัติ --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.prefix}{t.first_name} {t.last_name} ({t.position || 'ครู'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.recipient_type === 'student' && (
              <div className="space-y-2 p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/80">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-emerald-900 font-bold flex items-center gap-1.5">
                    <Search size={13} className="text-emerald-600" />
                    <span>ค้นหานักเรียนอัจฉริยะ (รหัส / เลข ปชช. / ชื่อ-สกุล):</span>
                  </label>
                  {formData.recipient_name && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-white border border-emerald-300 px-2 py-0.5 rounded-md shadow-2xs">
                      ✓ เลือกแล้ว: {formData.recipient_name}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={e => setStudentSearchQuery(e.target.value)}
                    placeholder="พิมพ์ค้นหา เช่น 5402, 19302..., หรือชื่อนักเรียน..."
                    className="w-full pl-8 pr-7 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  {studentSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setStudentSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* กล่องผลการค้นหาแบบด่วน */}
                {studentSearchQuery.trim() && (
                  <div className="max-h-48 overflow-y-auto bg-white border border-emerald-300 rounded-xl shadow-lg divide-y divide-slate-100 z-10">
                    {filteredStudents.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400 font-medium">
                        ไม่พบข้อมูลนักเรียนที่ตรงกับ "{studentSearchQuery}"
                      </div>
                    ) : (
                      filteredStudents.map(s => {
                        const pfx = s.prefix || s.title || '';
                        const fullName = `${pfx}${s.first_name} ${s.last_name}`.trim();
                        const cls = s.class_level || s.grade || '';
                        const clsDisplay = cls ? `${cls}${s.room ? `/${s.room}` : ''}` : '-';
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              handleStudentSelect(s.id);
                              setStudentSearchQuery('');
                            }}
                            className="w-full p-2.5 text-left hover:bg-emerald-50/80 transition-colors flex items-center justify-between text-xs group cursor-pointer"
                          >
                            <div>
                              <div className="font-bold text-slate-800 group-hover:text-emerald-700">
                                {fullName}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                                  รหัส: {s.student_id || '-'}
                                </span>
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                                  ปชช: {s.national_id || s.citizen_id || '-'}
                                </span>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              {clsDisplay}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {/* ตัวเลือกลิสต์สำรองตามห้อง */}
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-[10px] text-slate-500 font-medium shrink-0">หรือเลือกจากรายชื่อ:</span>
                  <select
                    onChange={e => handleStudentSelect(e.target.value)}
                    value={formData.recipient_id || ''}
                    className="flex-1 p-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-slate-700"
                  >
                    <option value="" disabled>-- คลิกเลือกนักเรียน --</option>
                    {students.map(s => {
                      const pfx = s.prefix || s.title || '';
                      const cls = s.class_level || s.grade || '';
                      return (
                        <option key={s.id} value={s.id}>
                          {pfx}{s.first_name} {s.last_name} ({cls}{s.room ? `/${s.room}` : ''} | รหัส: {s.student_id || '-'})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold">ชื่อ-นามสกุล *</label>
                <input
                  type="text"
                  required
                  value={formData.recipient_name}
                  onChange={e => setFormData(prev => ({ ...prev, recipient_name: e.target.value }))}
                  placeholder="เช่น นายสมชาย ใจดี"
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold">ตำแหน่ง / ชั้นเรียน</label>
                <input
                  type="text"
                  value={formData.recipient_position_or_grade}
                  onChange={e => setFormData(prev => ({ ...prev, recipient_position_or_grade: e.target.value }))}
                  placeholder="เช่น ครูชำนาญการ หรือ ป.6/1"
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold">เลขบัตร ปชช. / เลขประจำตัว</label>
                <input
                  type="text"
                  value={formData.recipient_id_card}
                  onChange={e => setFormData(prev => ({ ...prev, recipient_id_card: e.target.value }))}
                  placeholder="เลข 13 หลัก หรือเลขประจำตัว"
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>
            </div>

            {formData.certificate_type === 'salary' && (
              <div className="space-y-1 pt-1">
                <label className="text-[10px] text-emerald-800 font-bold">จำนวนเงินเดือน (บาท):</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.recipient_salary}
                  onChange={e => setFormData(prev => ({ ...prev, recipient_salary: e.target.value }))}
                  placeholder="เช่น 28500"
                  className="w-full p-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900"
                />
              </div>
            )}
          </div>

          {/* เรื่อง / ชื่อหนังสือรับรอง */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              เรื่อง / ชื่อหนังสือรับรอง *
            </label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
              placeholder="เช่น หนังสือรับรองการเป็นข้าราชการครู"
            />
          </div>

          {/* ข้อความรับรอง (Content) พร้อมปุ่ม AI Assistant */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                ข้อความรับรอง (Body Text) *
              </label>
              <button
                type="button"
                onClick={handleAIDraft}
                disabled={isDrafting}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold border border-indigo-200 transition-all cursor-pointer"
              >
                {isDrafting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                <span>{isDrafting ? 'AI กำลังร่างข้อความ...' : '✨ AI ช่วยปรับสำนวนราชการ'}</span>
              </button>
            </div>
            <textarea
              required
              rows={5}
              value={formData.content}
              onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 text-xs leading-relaxed focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
              placeholder="หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า..."
            />
          </div>

          {/* วัตถุประสงค์ในการออกหนังสือ */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              วัตถุประสงค์ในการออกหนังสือ (ออกให้ ณ วันที่... เพื่อ...)
            </label>
            <input
              type="text"
              value={formData.purpose}
              onChange={e => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 text-xs"
              placeholder="เช่น เพื่อใช้เป็นหลักฐานในการสมัครศึกษาต่อ / ยื่นขอสินเชื่อสถาบันการเงิน"
            />
          </div>

          {/* ผู้ลงนาม */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                ชื่อผู้ลงนาม (ผู้อำนวยการ)
              </label>
              <input
                type="text"
                value={formData.sign_name}
                onChange={e => setFormData(prev => ({ ...prev, sign_name: e.target.value }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                ตำแหน่งผู้ลงนาม
              </label>
              <input
                type="text"
                value={formData.sign_position}
                onChange={e => setFormData(prev => ({ ...prev, sign_position: e.target.value }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
              />
            </div>
          </div>

          {/* ปุ่มควบคุมในแท็บกรอกข้อมูล */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setFormTab('preview')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 font-bold text-xs hover:bg-emerald-100 transition-all cursor-pointer"
            >
              <Eye size={14} />
              <span>ดูตัวอย่าง A4 (Live Preview)</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกหนังสือรับรอง'}</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* --- แท็บที่ 2: ดูตัวอย่าง A4 เสมือนจริง (Live A4 Preview Sheet) --- */
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">จำลองการแสดงผล A4 เสมือนจริง:</span>
              <span className="text-emerald-700 font-bold">
                {formData.header_type === 'garuda' 
                  ? '🦅 มีตราครุฑ (3 ซม.)' 
                  : formData.header_type === 'school_logo' 
                    ? '🏫 ตราสัญลักษณ์โรงเรียน' 
                    : '📄 กระดาษมีหัวสำเร็จรูป (เว้น 3 ซม.)'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFormTab('editor')}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
            >
              📝 กลับไปแก้ไขข้อมูล
            </button>
          </div>

          {/* แผ่นกระดาษ A4 จำลอง */}
          <div className="bg-white p-8 sm:p-12 border border-slate-300 rounded-lg shadow-sm max-h-[60vh] overflow-y-auto font-sarabun text-slate-900 leading-relaxed text-[15pt]">
            {/* ตราครุฑ / โลโก้ / ระยะเว้น */}
            {formData.header_type === 'garuda' ? (
              <div className="flex justify-center mb-3">
                <img src={garuda3cm} alt="ตราครุฑ" className="w-[3cm] h-auto object-contain" />
              </div>
            ) : formData.header_type === 'school_logo' && settings?.school_logo_url ? (
              <div className="flex justify-center mb-3">
                <img src={settings.school_logo_url} alt="ตราโรงเรียน" className="w-[2.5cm] h-auto object-contain" />
              </div>
            ) : (
              <div className="h-[3cm] mb-3 flex items-center justify-center border border-dashed border-amber-300 bg-amber-50/50 rounded-lg text-amber-700 text-xs font-sans">
                [เว้นระยะ 3 ซม. สำหรับกระดาษหัวครุฑพิมพ์สำเร็จรูป]
              </div>
            )}

            {/* ชื่อหนังสือรับรอง */}
            <div className="text-center font-bold text-[26pt] leading-tight mb-2">
              หนังสือรับรอง
            </div>

            {/* เลขที่ */}
            <div className="text-center font-bold text-[16pt] mb-6">
              เลขที่ {formData.certificate_number || '[ระบบจะออกเลขอัตโนมัติเมื่อกดบันทึก]'}
            </div>

            {/* คำขึ้นต้น */}
            <div className="mb-4 indent-8 text-[16pt] text-justify">
              หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า <strong className="font-bold">{formData.recipient_name || '[ชื่อ-นามสกุล]'}</strong>
              {formData.recipient_id_card ? ` เลขประจำตัวประชาชน ${formData.recipient_id_card}` : ''}
              {formData.recipient_position_or_grade ? ` ตำแหน่ง/ชั้นเรียน ${formData.recipient_position_or_grade}` : ''}
              {formData.recipient_department ? ` สังกัด${formData.recipient_department}` : ''} {formData.issuer || settings?.school_name || 'โรงเรียนบ้านควนโคกยา'}
            </div>

            {/* ข้อความรับรองรายละเอียด */}
            <div className="mb-6 indent-8 text-[16pt] text-justify leading-relaxed whitespace-pre-wrap">
              {formData.content || '[ยังไม่มีเนื้อหาหนังสือรับรอง]'}
            </div>

            {/* วัตถุประสงค์ (ถ้ามี) */}
            {formData.purpose && (
              <div className="mb-6 indent-8 text-[16pt] text-justify">
                ออกให้ ณ {formatThaiFullDate(formData.certificate_date)} {formData.purpose}
              </div>
            )}

            {/* วันที่ให้ไว้ */}
            <div className="text-center mb-10 text-[16pt]">
              ให้ไว้ ณ {formatThaiFullDate(formData.certificate_date)}
            </div>

            {/* กล่องลงนาม ผอ. */}
            <div className="flex justify-end pr-8 mb-6">
              <div className="text-center min-w-[200px]">
                <div className="h-16 flex items-center justify-center">
                  {settings?.director_signature_url ? (
                    <img src={settings.director_signature_url} alt="ลายเซ็น" className="max-h-14 object-contain" />
                  ) : (
                    <span className="text-slate-300 text-xs italic font-sans">[ลงนาม]</span>
                  )}
                </div>
                <div className="font-bold text-[16pt]">({formData.sign_name || settings?.director_name || 'นายเอกคณิต สิทธิศักดิ์'})</div>
                <div className="text-[14pt] text-slate-700">{formData.sign_position || settings?.director_position || 'ผู้อำนวยการโรงเรียนบ้านควนโคกยา'}</div>
              </div>
            </div>

            {/* ส่วนท้าย QR Code */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[10pt] text-slate-500 font-sans">
              <div className="flex items-center gap-2">
                <QrCode size={36} className="text-slate-700" />
                <div>
                  <div className="font-bold text-slate-800">ตรวจสอบความถูกต้องของเอกสารราชการฉบับนี้</div>
                  <div>สแกน QR Code หรือตรวจสอบผ่านระบบงานสารบรรณโรงเรียนบ้านควนโคกยา</div>
                </div>
              </div>
              <div className="text-right font-mono text-[9pt]">
                DOC-REF: PREVIEW | {formData.certificate_number || 'AUTO-SEQ'}
              </div>
            </div>
          </div>

          {/* ปุ่มควบคุมในแท็บตัวอย่าง */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setFormTab('editor')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
            >
              📝 กลับไปแก้ไขข้อมูล
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{isSaving ? 'กำลังบันทึก...' : 'ยืนยันและบันทึกหนังสือรับรอง'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: แนบไฟล์สแกนหนังสือรับรอง                                          */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAttachModalOpen}
        onClose={() => setIsAttachModalOpen(false)}
        title="แนบไฟล์สแกนหนังสือรับรองฉบับจริง (PDF / JPG)"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            แนบไฟล์เอกสารที่ลงนามและประทับตรายางเสร็จสมบูรณ์แล้ว เพื่อจัดเก็บเข้าสู่คลังดิจิทัลของโรงเรียน
          </p>
          <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-slate-50">
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={e => setAttachFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAttachModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={!attachFile || isAttaching}
              onClick={handleAttachSubmit}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 disabled:opacity-50"
            >
              {isAttaching ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{isAttaching ? 'กำลังอัปโหลด...' : 'บันทึกไฟล์'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: QR Code ตรวจสอบความถูกต้อง (Anti-Forgery)                        */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title="📱 QR Code ตรวจสอบความถูกต้องของหนังสือรับรอง"
      >
        {selectedDocForQr && (() => {
          const verifyUrl = selectedDocForQr.file_url 
            ? selectedDocForQr.file_url 
            : `${window.location.origin}/#/certificates?verify=${encodeURIComponent(selectedDocForQr.id || selectedDocForQr.certificate_number)}`;
          const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(verifyUrl)}&format=png`;

          return (
            <div className="space-y-5 text-center py-2">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left text-xs space-y-1">
                <p className="font-bold text-slate-800">📌 เลขที่รับรอง: <span className="text-emerald-600 font-mono font-bold">{selectedDocForQr.certificate_number}</span></p>
                <p className="font-bold text-slate-700">📄 เรื่อง: {selectedDocForQr.subject}</p>
                <p className="text-slate-600 font-semibold">👤 ผู้ขอรับการรับรอง: {selectedDocForQr.recipient_name} ({selectedDocForQr.recipient_position || 'ไม่ระบุ'})</p>
                <p className="text-slate-500">📅 ออกให้ ณ วันที่: {formatDateDMY(selectedDocForQr.certificate_date)}</p>
              </div>

              <div className="inline-block p-4 bg-white rounded-3xl border-2 border-slate-100 shadow-sm">
                <img src={qrImgUrl} alt="QR Code" className="w-44 h-44 mx-auto rounded-xl" />
                <p className="text-[11px] font-bold text-slate-400 mt-2">สแกนเพื่อตรวจสอบความถูกต้องของหนังสือรับรองฉบับจริง</p>
              </div>

              <DocVerificationCard
                doc={{
                  subject: selectedDocForQr.subject,
                  doc_number: selectedDocForQr.certificate_number,
                  doc_date: selectedDocForQr.certificate_date,
                  from_agency: selectedDocForQr.issuer,
                  to_agency: selectedDocForQr.recipient_name,
                  file_url: selectedDocForQr.file_url,
                  status: selectedDocForQr.status,
                  remark: selectedDocForQr.purpose
                }}
                compact={true}
              />

              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={verifyUrl} 
                  className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-mono select-all outline-hidden" 
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(verifyUrl);
                    setCopiedQrLink(true);
                    setTimeout(() => setCopiedQrLink(false), 2500);
                  }}
                  className="shrink-0 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 active:scale-95 transition-all"
                >
                  {copiedQrLink ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์'}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: พรีวิวและสั่งพิมพ์หนังสือรับรอง (A4 Portrait มาตรฐานระเบียบงานสารบรรณ) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="พิมพ์หนังสือรับรอง (A4 Portrait ราชการ)"
      >
        {printDoc && (
          <div className="space-y-4">
            {/* เมนูควบคุมก่อนพิมพ์ (Print Controls) */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-700">รูปแบบหัวเอกสาร:</span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="print_header_opt"
                    checked={printGarudaOption === 'garuda'}
                    onChange={() => setPrintGarudaOption('garuda')}
                  />
                  <span>มีตราครุฑ</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="print_header_opt"
                    checked={printGarudaOption === 'no_garuda'}
                    onChange={() => setPrintGarudaOption('no_garuda')}
                  />
                  <span className="text-amber-700 font-bold">ไม่มีตราครุฑ (กระดาษสำเร็จรูป)</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printShowQr}
                    onChange={e => setPrintShowQr(e.target.checked)}
                  />
                  <span>แสดง QR ยืนยันเอกสาร</span>
                </label>
                <button
                  onClick={handlePrintTrigger}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs cursor-pointer"
                >
                  <Printer size={14} />
                  <span>สั่งพิมพ์ทันที</span>
                </button>
              </div>
            </div>

            {/* แผ่นกระดาษจำลอง A4 Portrait (Print Preview Sheet) */}
            <div className="bg-white p-8 sm:p-12 border border-slate-300 rounded-lg shadow-sm max-h-[65vh] overflow-y-auto font-sarabun text-slate-900 leading-relaxed text-[15pt]">
              {/* ตราครุฑ 3 ซม. กลางหน้ากระดาษ (หรือเว้นระยะกรณีไม่มีครุฑ) */}
              {printGarudaOption === 'garuda' ? (
                <div className="flex justify-center mb-3">
                  <img src={garuda3cm} alt="ตราครุฑ" className="w-[3cm] h-auto object-contain" />
                </div>
              ) : printGarudaOption === 'school_logo' && settings?.school_logo_url ? (
                <div className="flex justify-center mb-3">
                  <img src={settings.school_logo_url} alt="ตราโรงเรียน" className="w-[2.5cm] h-auto object-contain" />
                </div>
              ) : (
                // เว้นระยะหัวกระดาษสำหรับกระดาษที่มีหัวครุฑพิมพ์อยู่แล้ว
                <div className="h-[3cm] mb-3 flex items-center justify-center border border-dashed border-amber-300 bg-amber-50/50 rounded-lg text-amber-700 text-xs print:border-none print:bg-transparent print:text-transparent">
                  [เว้นระยะสำหรับกระดาษที่มีหัวครุฑพิมพ์สำเร็จรูป]
                </div>
              )}

              {/* ชื่อหนังสือรับรอง */}
              <div className="text-center font-bold text-[26pt] leading-tight mb-2">
                หนังสือรับรอง
              </div>

              {/* เลขที่ และ ส่วนราชการ */}
              <div className="text-center font-bold text-[16pt] mb-6">
                เลขที่ {printDoc.certificate_number}
              </div>

              {/* คำขึ้นต้น */}
              <div className="mb-4 indent-8 text-[16pt] text-justify">
                หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า <strong className="font-bold">{printDoc.recipient_name}</strong>
                {printDoc.recipient_id_card ? ` เลขประจำตัวประชาชน ${printDoc.recipient_id_card}` : ''}
                {printDoc.recipient_position_or_grade ? ` ตำแหน่ง ${printDoc.recipient_position_or_grade}` : ''}
                {printDoc.recipient_department ? ` สังกัด${printDoc.recipient_department}` : ''} {printDoc.issuer || 'โรงเรียนบ้านควนโคกยา'}
              </div>

              {/* ข้อความรับรองรายละเอียด */}
              <div className="mb-6 indent-8 text-[16pt] text-justify leading-relaxed whitespace-pre-wrap">
                {printDoc.content}
              </div>

              {/* วัตถุประสงค์ (ถ้ามี) */}
              {printDoc.purpose && (
                <div className="mb-6 indent-8 text-[16pt] text-justify">
                  ออกให้ ณ {formatThaiFullDate(printDoc.certificate_date)} {printDoc.purpose}
                </div>
              )}

              {/* วันที่ให้ไว้ */}
              <div className="text-center mb-10 text-[16pt]">
                ให้ไว้ ณ {formatThaiFullDate(printDoc.certificate_date)}
              </div>

              {/* กล่องลงนาม ผอ. */}
              <div className="flex justify-end pr-8 mb-6">
                <div className="text-center min-w-[200px]">
                  {/* ช่องลายเซ็น */}
                  <div className="h-16 flex items-center justify-center">
                    {settings?.director_signature_url ? (
                      <img src={settings.director_signature_url} alt="ลายเซ็น" className="max-h-14 object-contain" />
                    ) : (
                      <span className="text-slate-300 text-xs italic">[ลงนาม]</span>
                    )}
                  </div>
                  <div className="font-bold text-[16pt]">({printDoc.sign_name})</div>
                  <div className="text-[14pt] text-slate-700">{printDoc.sign_position}</div>
                </div>
              </div>

              {/* ท้ายเอกสาร: QR Code ตรวจสอบความถูกต้อง */}
              {printShowQr && (
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[10pt] text-slate-500">
                  <div className="flex items-center gap-2">
                    <QrCode size={36} className="text-slate-700" />
                    <div>
                      <div className="font-bold text-slate-800">ตรวจสอบความถูกต้องของเอกสารราชการฉบับนี้</div>
                      <div>สแกน QR Code หรือตรวจสอบผ่านระบบงานสารบรรณโรงเรียนบ้านควนโคกยา</div>
                    </div>
                  </div>
                  <div className="text-right font-mono text-[9pt]">
                    DOC-REF: {printDoc.id?.slice(0, 8)} | {printDoc.certificate_number}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 5: ออกหนังสือรับรองแบบยกห้องเรียน (Batch Classroom Issuance)          */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        title="ออกหนังสือรับรองนักเรียนยกห้องเรียน (Batch Classroom Issuance)"
      >
        <div className="space-y-4 max-h-[85vh] overflow-y-auto px-1">
          {batchSuccessResult ? (
            /* ผลลัพธ์เมื่อออกชุดหนังสือรับรองสำเร็จ */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                <div className="flex items-center gap-2 font-black text-base text-emerald-800">
                  <CheckCircle size={22} className="text-emerald-600 shrink-0" />
                  <span>ออกหนังสือรับรองยกห้องเรียนสำเร็จเรียบร้อยแล้ว!</span>
                </div>
                <p className="text-xs text-emerald-700">
                  ระบบได้ออกเลขหนังสือรับรอง บันทึกลงฐานข้อมูล และแจ้งเตือนผ่าน Telegram แล้วจำนวน{' '}
                  <strong>{batchSuccessResult.length} ฉบับ</strong>
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
                  <span className="px-2.5 py-1 bg-white border border-emerald-200 rounded-lg font-mono font-bold text-emerald-800">
                    เลขที่เริ่มต้น: {batchSuccessResult[0]?.certificate_number}
                  </span>
                  <span className="text-emerald-600 font-bold">➔</span>
                  <span className="px-2.5 py-1 bg-white border border-emerald-200 rounded-lg font-mono font-bold text-emerald-800">
                    เลขที่สิ้นสุด: {batchSuccessResult[batchSuccessResult.length - 1]?.certificate_number}
                  </span>
                </div>
              </div>

              {/* ปุ่มสั่งพิมพ์ชุดเอกสารทั้งหมด (Bulk Print) */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenBulkPrint(batchSuccessResult)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  <Printer size={16} />
                  <span>สั่งพิมพ์ชุดเอกสารทั้งหมด ({batchSuccessResult.length} ฉบับ)</span>
                </button>
              </div>
            </div>
          ) : (
            /* ฟอร์มเลือกห้องและนักเรียน */
            <div className="space-y-4">
              {/* แถวตั้งค่าชั้นเรียน และหัวกระดาษ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    1. เลือกระดับชั้นเรียน *
                  </label>
                  <select
                    value={batchClassLevel}
                    onChange={e => handleBatchClassChange(e.target.value)}
                    className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl font-bold text-indigo-900 text-xs focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {availableClassLevels.map(cls => (
                      <option key={cls} value={cls}>
                        {cls.startsWith('ป.') ? `ชั้นประถมศึกษาปีที่ ${cls.replace('ป.', '')}` : cls.startsWith('อ.') ? `ชั้นอนุบาล ${cls.replace('อ.', '')}` : cls}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    2. รูปแบบหัวเอกสาร
                  </label>
                  <select
                    value={batchHeaderType}
                    onChange={e => setBatchHeaderType(e.target.value as any)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
                  >
                    <option value="garuda">🦅 มีตราครุฑ 3 ซม. (พิมพ์ลงกระดาษ A4 เปล่า)</option>
                    <option value="no_garuda">📄 ไม่มีตราครุฑ (พิมพ์ลงกระดาษมีหัวสำเร็จรูป)</option>
                    <option value="school_logo">🏫 ตราสัญลักษณ์โรงเรียน</option>
                  </select>
                </div>
              </div>

              {/* วัตถุประสงค์ในการออกหนังสือรับรอง */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  3. วัตถุประสงค์ในการออกหนังสือรับรอง
                </label>
                <input
                  type="text"
                  value={batchPurpose}
                  onChange={e => setBatchPurpose(e.target.value)}
                  placeholder="เช่น เพื่อใช้เป็นหลักฐานในการศึกษาต่อ / สมัครเข้าเรียน"
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-xs"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    'เพื่อใช้เป็นหลักฐานในการศึกษาต่อ / สมัครเข้าเรียน',
                    'เพื่อใช้เป็นหลักฐานในการขอรับทุนการศึกษา',
                    'เพื่อรับรองความประพฤติและผลการเรียน'
                  ].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBatchPurpose(preset)}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-medium transition-colors cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* ตารางเลือกรายชื่อนักเรียนในห้อง */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleSelectAllBatch}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                    >
                      {batchSelectedIds.size === batchStudents.length ? (
                        <>
                          <CheckSquare size={14} />
                          <span>ปลดเลือกทั้งหมด</span>
                        </>
                      ) : (
                        <>
                          <Square size={14} />
                          <span>เลือกทั้งหมด ({batchStudents.length} คน)</span>
                        </>
                      )}
                    </button>
                  </div>
                  <span className="text-slate-500 font-bold">
                    เลือกแล้ว: <strong className="text-indigo-600">{batchSelectedIds.size}</strong> จาก {batchStudents.length} คน
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                  {batchStudents.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      ไม่พบข้อมูลนักเรียนในชั้นเรียนที่เลือก
                    </div>
                  ) : (
                    batchStudents.map(s => {
                      const isSelected = batchSelectedIds.has(s.id);
                      const pfx = s.prefix || s.title || '';
                      const fullName = `${pfx}${s.first_name} ${s.last_name}`.trim();
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center justify-between p-2.5 text-xs cursor-pointer transition-colors ${
                            isSelected ? 'bg-indigo-50/60 font-bold text-indigo-900' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleStudentBatch(s.id)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                            />
                            <div>
                              <span>{fullName}</span>
                              <span className="text-[10px] text-slate-400 font-mono ml-2">
                                (รหัส: {s.student_id || '-'})
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">
                            {s.national_id || s.citizen_id || '-'}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ปุ่มยืนยันออกหนังสือรับรองยกห้อง */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleBatchSubmit}
                  disabled={batchSubmitting || batchSelectedIds.size === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {batchSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                  <span>
                    {batchSubmitting 
                      ? 'กำลังรันเลขและบันทึก...' 
                      : `ยืนยันออกหนังสือรับรองทั้งห้อง (${batchSelectedIds.size} ฉบับ)`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 6: พิมพ์ชุดหนังสือรับรองทั้งหมด (Continuous Bulk Print Modal)         */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isBulkPrintModalOpen}
        onClose={() => setIsBulkPrintModalOpen(false)}
        title={`พิมพ์ชุดหนังสือรับรอง (${bulkPrintDocs.length} ฉบับ)`}
      >
        <div className="space-y-4 max-h-[85vh] overflow-y-auto px-1">
          {/* แถบควบคุมก่อนพิมพ์ */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs sticky top-0 bg-white z-10">
            <div>
              <span className="font-bold text-slate-800">ชุดเอกสารพร้อมสั่งพิมพ์: </span>
              <span className="text-indigo-700 font-bold">{bulkPrintDocs.length} ฉบับต่อเนื่อง</span>
              <span className="text-[10px] text-slate-400 block sm:inline sm:ml-2">
                (ระบบแยก 1 แผ่น A4 ต่อ 1 คนอัตโนมัติ)
              </span>
            </div>
            <button
              type="button"
              onClick={handlePrintTrigger}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs cursor-pointer"
            >
              <Printer size={15} />
              <span>สั่งพิมพ์ทั้งชุดทันที</span>
            </button>
          </div>

          {/* รายการแผ่นกระดาษ A4 ต่อเนื่อง */}
          <div className="space-y-6">
            {bulkPrintDocs.map((doc, idx) => (
              <div
                key={doc.id || idx}
                className="bg-white p-8 sm:p-12 border border-slate-300 rounded-lg shadow-sm font-sarabun text-slate-900 leading-relaxed text-[15pt] print:break-after-page print:page-break-after-always print:p-0 print:border-none print:shadow-none"
              >
                {/* ตราครุฑ / โลโก้ / เว้นระยะ */}
                {doc.header_type === 'garuda' ? (
                  <div className="flex justify-center mb-3">
                    <img src={garuda3cm} alt="ตราครุฑ" className="w-[3cm] h-auto object-contain" />
                  </div>
                ) : doc.header_type === 'school_logo' && settings?.school_logo_url ? (
                  <div className="flex justify-center mb-3">
                    <img src={settings.school_logo_url} alt="ตราโรงเรียน" className="w-[2.5cm] h-auto object-contain" />
                  </div>
                ) : (
                  <div className="h-[3cm] mb-3 flex items-center justify-center border border-dashed border-amber-300 bg-amber-50/50 rounded-lg text-amber-700 text-xs print:border-none print:bg-transparent print:text-transparent font-sans">
                    [เว้นระยะสำหรับกระดาษที่มีหัวครุฑพิมพ์สำเร็จรูป]
                  </div>
                )}

                {/* ชื่อหนังสือรับรอง */}
                <div className="text-center font-bold text-[26pt] leading-tight mb-2">
                  หนังสือรับรอง
                </div>

                {/* เลขที่ */}
                <div className="text-center font-bold text-[16pt] mb-6">
                  เลขที่ {doc.certificate_number}
                </div>

                {/* คำขึ้นต้น */}
                <div className="mb-4 indent-8 text-[16pt] text-justify">
                  หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า <strong className="font-bold">{doc.recipient_name}</strong>
                  {doc.recipient_id_card ? ` เลขประจำตัวประชาชน ${doc.recipient_id_card}` : ''}
                  {doc.recipient_position_or_grade ? ` ตำแหน่ง/ชั้นเรียน ${doc.recipient_position_or_grade}` : ''}
                  {doc.recipient_department ? ` สังกัด${doc.recipient_department}` : ''} {doc.issuer || settings?.school_name || 'โรงเรียนบ้านควนโคกยา'}
                </div>

                {/* ข้อความรับรองรายละเอียด */}
                <div className="mb-6 indent-8 text-[16pt] text-justify leading-relaxed whitespace-pre-wrap">
                  {doc.content}
                </div>

                {/* วัตถุประสงค์ (ถ้ามี) */}
                {doc.purpose && (
                  <div className="mb-6 indent-8 text-[16pt] text-justify">
                    ออกให้ ณ {formatThaiFullDate(doc.certificate_date)} {doc.purpose}
                  </div>
                )}

                {/* วันที่ให้ไว้ */}
                <div className="text-center mb-10 text-[16pt]">
                  ให้ไว้ ณ {formatThaiFullDate(doc.certificate_date)}
                </div>

                {/* กล่องลงนาม ผอ. */}
                <div className="flex justify-end pr-8 mb-6">
                  <div className="text-center min-w-[200px]">
                    <div className="h-16 flex items-center justify-center">
                      {settings?.director_signature_url ? (
                        <img src={settings.director_signature_url} alt="ลายเซ็น" className="max-h-14 object-contain" />
                      ) : (
                        <span className="text-slate-300 text-xs italic font-sans">[ลงนาม]</span>
                      )}
                    </div>
                    <div className="font-bold text-[16pt]">({doc.sign_name || settings?.director_name || 'นายเอกคณิต สิทธิศักดิ์'})</div>
                    <div className="text-[14pt] text-slate-700">{doc.sign_position || settings?.director_position || 'ผู้อำนวยการโรงเรียนบ้านควนโคกยา'}</div>
                  </div>
                </div>

                {/* ท้ายเอกสาร QR Code */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[10pt] text-slate-500 font-sans">
                  <div className="flex items-center gap-2">
                    <QrCode size={36} className="text-slate-700" />
                    <div>
                      <div className="font-bold text-slate-800">ตรวจสอบความถูกต้องของเอกสารราชการฉบับนี้</div>
                      <div>สแกน QR Code หรือตรวจสอบผ่านระบบงานสารบรรณโรงเรียนบ้านควนโคกยา</div>
                    </div>
                  </div>
                  <div className="text-right font-mono text-[9pt]">
                    DOC-REF: {doc.id ? doc.id.slice(0, 8) : 'BULK'} | {doc.certificate_number}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
