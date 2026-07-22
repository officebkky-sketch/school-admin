import React, { useState, useEffect } from 'react';
import { supabase, getActiveSchoolProfile } from '../lib/supabase';
import { 
  Plus, Search, FileDown, FileUp, Edit2, Trash2, Printer, ArrowLeft, Loader2, Save, MapPin
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Student {
  id?: string;
  school_id: string;
  national_id: string;
  prefix: string;
  first_name: string;
  last_name: string;
  gender: string;
  birth_date: string;
  age: number;
  nationality: string;
  house_id: string;
  house_no: string;
  moo: string;
  sub_district: string;
  district: string;
  province: string;
  father_name: string;
  father_nationality: string;
  mother_name: string;
  mother_nationality: string;
  move_in_date?: string;
  school_enrolled?: string; // สถานศึกษาที่เข้าเรียน
  guardian_name?: string;    // ชื่อผู้ปกครอง
  enroll_class?: string;     // ชั้นเรียนที่เข้าเรียน
}

export default function ServiceArea() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [printFilterYear, setPrintFilterYear] = useState<string>('2562'); // ปีเกิด พ.ศ.
  const [printFilterMoo, setPrintFilterMoo] = useState<string>('all'); // หมู่ที่สำหรับการกรองรายงาน
  const [serviceMooText, setServiceMooText] = useState<string>('1,9,14'); // กำหนดเขตบริการเริ่มต้น
  const [activeSchool, setActiveSchool] = useState<string>('');
  const [schoolName, setSchoolName] = useState('');

  // ฟอร์มสำหรับการกรอก/แก้ไข
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState<Partial<Student>>({});

  // ข้อมูลตั้งค่าสำหรับการพิมพ์รายงาน ป.1 (แนบ 386)
  const [reportType, setReportType] = useState<'pata03' | 'enroll_p1'>('pata03');
  const [subDistrict, setSubDistrict] = useState('เขาชัยสน');
  const [district, setDistrict] = useState('เขาชัยสน');
  const [province, setProvince] = useState('พัทลุง');
  const [verifierName, setVerifierName] = useState('');
  const [emailTarget, setEmailTarget] = useState('pl2158@phatthalung2.go.th');
  const [inlineData, setInlineData] = useState<{[key: string]: {class?: string; father?: string; mother?: string; guardian?: string; schoolEnrolled?: string}}>({});

  const updateInlineData = (studentId: string, field: string, value: string) => {
    setInlineData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  // ควบคุมการซ่อน Sidebar / Header และปลดล็อก Containers ชั้นนอกแบบไดนามิกผ่าน DOM เมื่อเข้าสู่โหมดพิมพ์
  useEffect(() => {
    if (isPrintMode) {
      const sidebar = document.querySelector('aside');
      const header = document.querySelector('header');
      const identityFooter = document.querySelector('.identity-footer');
      const mainContainer = document.querySelector('main');
      const scrollContainer = document.querySelector('.overflow-y-auto');

      let originalSidebarDisplay = '';
      let originalHeaderDisplay = '';
      let originalScrollHeight = '';
      let originalScrollOverflow = '';

      if (sidebar) {
        originalSidebarDisplay = (sidebar as HTMLElement).style.display;
        (sidebar as HTMLElement).style.setProperty('display', 'none', 'important');
      }
      if (header) {
        originalHeaderDisplay = (header as HTMLElement).style.display;
        (header as HTMLElement).style.setProperty('display', 'none', 'important');
      }
      if (identityFooter) {
        (identityFooter as HTMLElement).style.setProperty('display', 'none', 'important');
      }
      if (mainContainer) {
        (mainContainer as HTMLElement).style.setProperty('height', 'auto', 'important');
        (mainContainer as HTMLElement).style.setProperty('overflow', 'visible', 'important');
      }
      if (scrollContainer) {
        originalScrollHeight = (scrollContainer as HTMLElement).style.height;
        originalScrollOverflow = (scrollContainer as HTMLElement).style.overflow;
        (scrollContainer as HTMLElement).style.setProperty('height', 'auto', 'important');
        (scrollContainer as HTMLElement).style.setProperty('overflow', 'visible', 'important');
        (scrollContainer as HTMLElement).style.setProperty('padding', '0', 'important');
      }

      return () => {
        if (sidebar) (sidebar as HTMLElement).style.display = originalSidebarDisplay;
        if (header) (header as HTMLElement).style.display = originalHeaderDisplay;
        if (identityFooter) (identityFooter as HTMLElement).style.display = '';
        if (mainContainer) {
          (mainContainer as HTMLElement).style.removeProperty('height');
          (mainContainer as HTMLElement).style.removeProperty('overflow');
        }
        if (scrollContainer) {
          (scrollContainer as HTMLElement).style.height = originalScrollHeight;
          (scrollContainer as HTMLElement).style.overflow = originalScrollOverflow;
          (scrollContainer as HTMLElement).style.removeProperty('padding');
        }
      };
    }
  }, [isPrintMode]);

  useEffect(() => {
    fetchSchoolInfoAndStudents();
  }, []);

  const fetchSchoolInfoAndStudents = async () => {
    setLoading(true);
    try {
      const profile = getActiveSchoolProfile();
      const schoolId = profile?.id || 'school_default';
      setActiveSchool(schoolId);

      // ดึงข้อมูลการตั้งค่าโรงเรียน
      const { data: schoolSettings } = await supabase.from('settings').select('school_name').limit(1).maybeSingle();
      if (schoolSettings?.school_name) {
        setSchoolName(schoolSettings.school_name);
      }

      // ดึงข้อมูลเด็ก
      const { data, error } = await supabase
        .from('service_area_students')
        .select('*')
        .eq('school_id', schoolId)
        .order('birth_date', { ascending: true });

      if (error) throw error;
      
      const studentData = data || [];
      setStudents(studentData);

      // กำหนดค่าเริ่มต้นของตำบล อำเภอ จังหวัด จากเด็กคนแรกที่มีข้อมูลที่อยู่
      if (studentData.length > 0) {
        const firstWithAddress = studentData.find(s => s.sub_district || s.district);
        if (firstWithAddress) {
          setSubDistrict(firstWithAddress.sub_district || 'เขาชัยสน');
          setDistrict(firstWithAddress.district || 'เขาชัยสน');
          setProvince(firstWithAddress.province || 'พัทลุง');
        }
      }
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  };

  // คำนวณปีเกิด พ.ศ. จากวันเกิด YYYY-MM-DD
  const getBirthYearTH = (dob: string) => {
    if (!dob) return '';
    const date = new Date(dob);
    return date.getFullYear() + 543;
  };

  // คำนวณปีการศึกษาที่จะเข้าเรียน ป.1 (พ.ศ. เกิด + 7)
  const getEnrollYearTH = (dob: string) => {
    if (!dob) return '';
    return (new Date(dob).getFullYear() + 543) + 7;
  };

  // จัดการนำเข้าไฟล์ Excel (ทร.14)
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        // ฟังก์ชันแปลงรูปแบบวันที่แบบไทยและเทศ
        const parseDateString = (dateInput: any): string => {
          if (!dateInput) return '';
          const str = String(dateInput).trim();
          if (!str) return '';

          // 1. ตรวจสอบชื่อเดือนไทยย่อ/เต็ม เช่น "28 ก.พ. 2566" หรือ "1 มกราคม 2562"
          const thaiMonths: { [key: string]: string } = {
            'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04', 'พ.ค.': '05', 'มิ.ย.': '06',
            'ก.ค.': '07', 'ส.ค.': '08', 'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12',
            'มกราคม': '01', 'กุมภาพันธ์': '02', 'มีนาคม': '03', 'เมษายน': '04', 'พฤษภาคม': '05', 'มิถุนายน': '06',
            'กรกฎาคม': '07', 'สิงหาคม': '08', 'กันยายน': '09', 'ตุลาคม': '10', 'พฤศจิกายน': '11', 'ธันวาคม': '12'
          };

          const parts = str.split(/\s+/);
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const monthName = parts[1].replace(/,$/, '');
            const yearVal = parseInt(parts[2]);
            const month = thaiMonths[monthName];
            
            if (month && !isNaN(yearVal)) {
              const yearEN = yearVal > 2400 ? yearVal - 543 : yearVal;
              return `${yearEN}-${month}-${day}`;
            }
          }

          // 2. รูปแบบเครื่องหมายทับ เช่น 28/02/2566 หรือ 28/2/2566
          const slashParts = str.split('/');
          if (slashParts.length === 3) {
            const day = slashParts[0].padStart(2, '0');
            const month = slashParts[1].padStart(2, '0');
            const yearVal = parseInt(slashParts[2]);
            if (!isNaN(yearVal)) {
              const yearEN = yearVal > 2400 ? yearVal - 543 : yearVal;
              return `${yearEN}-${month}-${day}`;
            }
          }

          // 3. รูปแบบเครื่องหมายขีด เช่น 2023-02-28 หรือ 2566-02-28
          const dashParts = str.split('-');
          if (dashParts.length === 3) {
            const yearVal = parseInt(dashParts[0]);
            const month = dashParts[1].padStart(2, '0');
            const day = dashParts[2].padStart(2, '0');
            if (!isNaN(yearVal)) {
              const yearEN = yearVal > 2400 ? yearVal - 543 : yearVal;
              return `${yearEN}-${month}-${day}`;
            }
          }

          // 4. กรณีอ่านเลข Serial Number ของ Excel
          const num = Number(str);
          if (!isNaN(num) && num > 20000 && num < 60000) {
            const date = new Date((num - 25569) * 86400 * 1000);
            const yearEN = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${yearEN}-${month}-${day}`;
          }

          if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            return str;
          }

          return '';
        };

        const importedStudents: Student[] = data.map((row: any) => {
          const birthDateStr = parseDateString(row.วันเกิด);

          return {
            school_id: activeSchool,
            national_id: String(row.เลขประจำตัวประชาชน || row.national_id || '').trim(),
            prefix: row.คำนำหน้า || '',
            first_name: row.ชื่อ || row.first_name || '',
            last_name: row.นามสกุล || row.last_name || '',
            gender: row.เพศ || '',
            birth_date: birthDateStr || null as any,
            age: parseInt(row.อายุ || 0),
            nationality: row.สัญชาติ || row.สัญชาติเด็ก || 'ไทย',
            house_id: String(row.รหัสประจำบ้าน || row.เลขรหัสประจำบ้าน || '').trim(),
            house_no: String(row.บ้านเลขที่ || '').trim(),
            moo: String(row.หมู่ที่ || '').trim(),
            sub_district: row.ตำบล || '',
            district: row.อำเภอ || '',
            province: row.จังหวัด || '',
            father_name: row.ชื่อบิดา || row['ชื่อ-สกุลบิดา'] || '',
            father_nationality: row.สัญชาติบิดา || 'ไทย',
            mother_name: row.ชื่อมารดา || row['ชื่อ-สกุลมารดา'] || '',
            mother_nationality: row.สัญชาติมารดา || 'ไทย',
            school_enrolled: row.สถานศึกษาที่เข้าเรียน || row.สถานศึกษา || row.school_enrolled || '',
          };
        });

        if (window.confirm(`พบข้อมูลนักเรียน ${importedStudents.length} รายการ คุณครูต้องการนำเข้าระบบใช่หรือไม่?`)) {
          setLoading(true);
          const { error } = await supabase.from('service_area_students').insert(importedStudents);
          if (error) throw error;
          alert('นำเข้าข้อมูลเรียบร้อยแล้วค่ะ');
          fetchSchoolInfoAndStudents();
        }
      } catch (err: any) {
        alert('เกิดข้อผิดพลาดในการนำเข้าไฟล์: ' + err.message);
      } finally {
        setLoading(false);
        // Reset input
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // ส่งออกไฟล์ Excel
  const handleExportExcel = () => {
    const exportData = filteredStudents.map((s, index) => ({
      'ลำดับ': index + 1,
      'เลขประจำตัวประชาชน': s.national_id,
      'คำนำหน้า': s.prefix,
      'ชื่อ': s.first_name,
      'นามสกุล': s.last_name,
      'เพศ': s.gender,
      'วันเกิด': s.birth_date ? new Date(s.birth_date).toLocaleDateString('th-TH') : '',
      'ปี พ.ศ. เกิด': s.birth_date ? getBirthYearTH(s.birth_date) : '',
      'ปีการศึกษาเข้าเกณฑ์ ป.1': s.birth_date ? getEnrollYearTH(s.birth_date) : '',
      'อายุ': s.age,
      'บ้านเลขที่': s.house_no,
      'หมู่ที่': s.moo,
      'ตำบล': s.sub_district,
      'อำเภอ': s.district,
      'จังหวัด': s.province,
      'ชื่อ-สกุลบิดา': s.father_name,
      'ชื่อ-สกุลมารดา': s.mother_name
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'เด็กในเขตบริการ');
    const today = new Date().toLocaleDateString('th-TH').replace(/\//g, '-');
    Xsource: XLSX.writeFile(wb, `ข้อมูลเด็กในเขตพื้นที่บริการ_ทร14_${today}.xlsx`);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dataToSave = {
        ...formData,
        school_id: activeSchool,
        age: formData.birth_date ? calculateAge(formData.birth_date) : 0
      };

      if (editingStudent?.id) {
        const { error } = await supabase
          .from('service_area_students')
          .update(dataToSave)
          .eq('id', editingStudent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('service_area_students')
          .insert([dataToSave]);
        if (error) throw error;
      }

      setShowFormDialog(false);
      fetchSchoolInfoAndStudents();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (dob: string) => {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleDeleteStudent = async (id: string) => {
    if (window.confirm('คุณครูแน่ใจใช่ไหมคะว่าต้องการลบข้อมูลเด็กรายนี้ออกจากระบบ?')) {
      setLoading(true);
      try {
        const { error } = await supabase
          .from('service_area_students')
          .delete()
          .eq('id', id);
        if (error) throw error;
        fetchSchoolInfoAndStudents();
      } catch (err: any) {
        alert('เกิดข้อผิดพลาดในการลบข้อมูล: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const [savingPrintData, setSavingPrintData] = useState(false);

  const handleSavePrintData = async () => {
    const studentIds = Object.keys(inlineData);
    if (studentIds.length === 0) {
      alert('ไม่มีข้อมูลที่ถูกแก้ไขเพื่อบันทึกค่ะ');
      return;
    }

    setSavingPrintData(true);
    try {
      let updateCount = 0;

      const updatePromises = studentIds.map(async (studentId) => {
        const changes = inlineData[studentId];
        const updatePayload: any = {};

        if (changes.father !== undefined) updatePayload.father_name = changes.father;
        if (changes.mother !== undefined) updatePayload.mother_name = changes.mother;
        if (changes.guardian !== undefined) updatePayload.guardian_name = changes.guardian;
        if (changes.class !== undefined) updatePayload.enroll_class = changes.class;
        if (changes.schoolEnrolled !== undefined) updatePayload.school_enrolled = changes.schoolEnrolled;

        if (Object.keys(updatePayload).length > 0) {
          const { error } = await supabase
            .from('service_area_students')
            .update(updatePayload)
            .eq('id', studentId);
          
          if (error) throw error;
          updateCount++;
        }
      });

      await Promise.all(updatePromises);
      alert(`บันทึกข้อมูลการศึกษาและผู้ปกครอง ลงในระบบสำเร็จ ${updateCount} รายการเรียบร้อยแล้วค่ะ!`);
      
      fetchSchoolInfoAndStudents();
      setInlineData({});
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message);
    } finally {
      setSavingPrintData(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const fullName = `${s.prefix}${s.first_name} ${s.last_name}`;
    const query = searchQuery.toLowerCase();
    return (
      fullName.toLowerCase().includes(query) ||
      (s.national_id && s.national_id.includes(query)) ||
      (s.house_no && s.house_no.includes(query))
    );
  });

  // ตัวกรองสำหรับ พฐ.03 (กรองจากปีเกิด พ.ศ. และหมู่ที่ พร้อมเรียงลำดับตามหมู่และชื่อเด็ก)
  const printStudents = students
    .filter(s => {
      if (!s.birth_date) return false;
      const matchYear = getBirthYearTH(s.birth_date).toString() === printFilterYear;
      const matchMoo = printFilterMoo === 'all' || s.moo === printFilterMoo;
      return matchYear && matchMoo;
    })
    .sort((a, b) => {
      // 1. เรียงลำดับตามหมู่ที่ (moo) แบบเปรียบเทียบตัวเลข
      const mooA = a.moo || '';
      const mooB = b.moo || '';
      const mooCompare = mooA.localeCompare(mooB, undefined, { numeric: true });
      if (mooCompare !== 0) return mooCompare;

      // 2. หากอยู่หมู่เดียวกัน ให้เรียงตามชื่อจริง (first_name)
      const nameA = a.first_name || '';
      const nameB = b.first_name || '';
      return nameA.localeCompare(nameB, 'th');
    });

  // ดึงรายการหมู่ทั้งหมดจากข้อมูลที่มี (แบบไดนามิก)
  const uniqueMoos = Array.from(new Set(students.map(s => s.moo).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  // สลับเข้า/ออกโหมดพิมพ์รายงาน
  if (isPrintMode) {
    return (
      <div className="bg-white min-h-screen p-8 print:p-0">
        {/* แถบควบคุมรายงานสำหรับคุณครู (ซ่อนเมื่อสั่งพิมพ์) */}
        <div className="flex flex-col gap-4 mb-6 print:hidden bg-slate-50 p-5 rounded-3xl border border-slate-200/85 shadow-xs">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <button 
              onClick={() => setIsPrintMode(false)}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl font-bold border border-slate-200 shadow-sm transition-all"
            >
              <ArrowLeft size={16} /> ย้อนกลับ
            </button>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-600">รูปแบบรายงาน :</span>
                <select 
                  value={reportType} 
                  onChange={(e) => setReportType(e.target.value as any)}
                  className="p-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-700"
                >
                  <option value="pata03">แบบ พฐ. ๐๓ (เขตบริการเดิม)</option>
                  <option value="enroll_p1">รายงานเด็กเข้า ป.1 (แนบ 386)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-600">เลือกปีเกิด พ.ศ. :</span>
                <select 
                  value={printFilterYear} 
                  onChange={(e) => setPrintFilterYear(e.target.value)}
                  className="p-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-700"
                >
                  {Array.from({ length: 10 }, (_, i) => String(2562 - i)).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-600">เลือกหมู่ที่ :</span>
                <select 
                  value={printFilterMoo} 
                  onChange={(e) => setPrintFilterMoo(e.target.value)}
                  className="p-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-700"
                >
                  <option value="all">ทุกหมู่</option>
                  {uniqueMoos.map(moo => (
                    <option key={moo} value={moo}>หมู่ที่ {moo}</option>
                  ))}
                </select>
              </div>

              {reportType === 'pata03' && (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-600">กำหนดเขตบริการ :</span>
                  <input 
                    type="text" 
                    value={serviceMooText} 
                    onChange={(e) => setServiceMooText(e.target.value)}
                    className="p-2 border border-slate-300 rounded-xl font-bold bg-white w-28 text-center"
                    placeholder="เช่น 1,9,14"
                  />
                </div>
              )}

              {reportType === 'enroll_p1' && Object.keys(inlineData).length > 0 && (
                <button 
                  onClick={handleSavePrintData}
                  disabled={savingPrintData}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all disabled:bg-blue-400"
                >
                  {savingPrintData ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )} 
                  บันทึกข้อมูลที่แก้ไข
                </button>
              )}

              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg transition-all"
              >
                <Printer size={16} /> สั่งพิมพ์ (PDF/Printer)
              </button>
            </div>
          </div>

          {/* ปรับปรุงข้อมูลหัวกระดาษสำหรับรายงานแนบ 386 */}
          {reportType === 'enroll_p1' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 pt-3 border-t border-slate-200 text-xs font-bold text-slate-600">
              <div>
                <label className="block mb-1 text-slate-400">ชื่อโรงเรียน</label>
                <input 
                  type="text" 
                  value={schoolName} 
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block mb-1 text-slate-400">ตำบล</label>
                <input 
                  type="text" 
                  value={subDistrict} 
                  onChange={(e) => setSubDistrict(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block mb-1 text-slate-400">อำเภอ</label>
                <input 
                  type="text" 
                  value={district} 
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block mb-1 text-slate-400">จังหวัด</label>
                <input 
                  type="text" 
                  value={province} 
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block mb-1 text-slate-400">อีเมลส่งข้อมูล (หมายเหตุ)</label>
                <input 
                  type="text" 
                  value={emailTarget} 
                  onChange={(e) => setEmailTarget(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block mb-1 text-slate-400">ชื่อผู้รับรองข้อมูล</label>
                <input 
                  type="text" 
                  value={verifierName} 
                  onChange={(e) => setVerifierName(e.target.value)}
                  placeholder="เช่น นายปรีชา ผู้อำนวยการ"
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>
          )}
        </div>

        {reportType === 'pata03' ? (
          /* ==================== 1. แบบรายงาน พฐ.03 ขนาด A4 แนวนอน ==================== */
          <div className="max-w-[297mm] mx-auto p-[15mm] bg-white border border-slate-100 shadow-xl print:shadow-none print:border-none print:p-0 font-thai">
            <style dangerouslySetInnerHTML={{__html: `
              @media print {
                body { background: white; color: black; }
                header, .print-hidden, aside { display: none !important; }
                html, body, #root, main, .min-h-screen, .flex-1, .overflow-y-auto, .custom-scrollbar, .max-w-7xl {
                  height: auto !important;
                  min-height: 0 !important;
                  max-height: none !important;
                  overflow: visible !important;
                  position: static !important;
                  display: block !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  background: white !important;
                  box-shadow: none !important;
                }
                .max-w-[297mm] { 
                  width: 100% !important; 
                  max-width: none !important; 
                  border: none !important;
                  box-shadow: none !important;
                  padding: 0 !important;
                  margin: 0 !important;
                }
              }
              @page {
                size: A4 landscape;
                margin: 10mm 15mm 10mm 15mm;
              }
            `}} />
            
            {/* หัวรายงาน */}
            <div className="text-right text-[12px] font-bold mb-2">แบบ พฐ. ๐๓</div>
            <div className="flex flex-col items-center mb-6">
              <h2 className="text-center font-bold text-[18px] leading-tight">บัญชีรายชื่อเด็กที่มีอายุถึงเกณฑ์บังคับเข้าเรียนตามพระราชบัญญัติการศึกษาภาคบังคับ พ.ศ. 2545</h2>
              <h3 className="text-center font-bold text-[16px] mt-1.5">
                เข้าเรียนชั้นประถมศึกษาปีที่ 1 ปีการศึกษา {parseInt(printFilterYear) + 7} (เกิด พ.ศ. {printFilterYear}) สถานศึกษา {schoolName}
              </h3>
              <p className="text-center font-bold text-[14px] mt-3">
                พื้นที่เขตบริการหมู่ที่ {printFilterMoo === 'all' ? serviceMooText : printFilterMoo} ตำบล {subDistrict} อำเภอ {district} จังหวัด {province}
              </p>
              <p className="text-center font-bold text-[14px] mt-0.5">
                สังกัด สพป.พัทลุง เขต 2
              </p>
            </div>

            <table className="w-full border-collapse border border-black text-[12px] leading-tight mt-6">
              <thead>
                <tr>
                  <th className="border border-black p-1.5 text-center bg-slate-50/50" rowSpan={2}>ที่</th>
                  <th className="border border-black p-1.5 text-center bg-slate-50/50" rowSpan={2}>เลขประจำตัว<br/>ประชาชน</th>
                  <th className="border border-black p-1.5 text-center bg-slate-50/50" rowSpan={2}>ชื่อ - นามสกุล</th>
                  <th className="border border-black p-1.5 text-center bg-slate-50/50" rowSpan={2}>เพศ</th>
                  <th className="border border-black p-1.5 text-center bg-slate-50/50" rowSpan={2}>วัน เดือน ปีเกิด</th>
                  <th className="border border-black p-1.5 text-center bg-slate-50/50" colSpan={4}>ที่อยู่อาศัยตามหลักฐานทะเบียนบ้าน</th>
                  <th className="border border-black p-1.5 text-center bg-slate-50/50" rowSpan={2}>ชื่อ - สกุล บิดา</th>
                  <th className="border border-black p-1.5 text-center bg-slate-50/50" rowSpan={2}>ชื่อ - สกุล มารดา</th>
                  <th className="border border-black p-1.5 text-center bg-slate-50/50" rowSpan={2}>หมายเหตุ</th>
                </tr>
                <tr>
                  <th className="border border-black p-1 text-center bg-slate-50/50">บ้านเลขที่</th>
                  <th className="border border-black p-1 text-center bg-slate-50/50">หมู่ที่</th>
                  <th className="border border-black p-1 text-center bg-slate-50/50">ตำบล</th>
                  <th className="border border-black p-1 text-center bg-slate-50/50">อำเภอ</th>
                </tr>
              </thead>
              <tbody>
                {printStudents.length > 0 ? (
                  printStudents.map((s, idx) => (
                    <tr key={s.id}>
                      <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                      <td className="border border-black p-1.5 text-center font-mono text-xs">{s.national_id}</td>
                      <td className="border border-black p-1.5 text-left">{s.prefix}{s.first_name} {s.last_name}</td>
                      <td className="border border-black p-1.5 text-center">{s.gender === 'ชาย' ? 'ช' : 'ญ'}</td>
                      <td className="border border-black p-1.5 text-center">
                        {s.birth_date ? new Date(s.birth_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : ''}
                      </td>
                      <td className="border border-black p-1.5 text-center">{s.house_no}</td>
                      <td className="border border-black p-1.5 text-center">{s.moo || '-'}</td>
                      <td className="border border-black p-1.5 text-center">{s.sub_district}</td>
                      <td className="border border-black p-1.5 text-center">{s.district}</td>
                      <td className="border border-black p-1.5 text-left">{s.father_name || '-'}</td>
                      <td className="border border-black p-1.5 text-left">{s.mother_name || '-'}</td>
                      <td className="border border-black p-1.5 text-center">-</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} className="border border-black p-6 text-center text-slate-400 font-bold">ไม่พบข้อมูลรายชื่อเด็กที่เกิดปี พ.ศ. {printFilterYear} ในพื้นที่ตัวเลือก</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="flex justify-between items-start mt-12 text-[14px]">
              <div className="w-[45%] text-left">
                <p>จัดทำข้อมูล ณ วันที่ {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="w-[45%] text-center flex flex-col items-center">
                <p className="mb-12">ลงชื่อ ______________________________ ผู้สำรวจ</p>
                <p>( ___________________________________ )</p>
                <p className="mt-1">ตำแหน่ง _________________________________</p>
              </div>
            </div>
          </div>
        ) : (
          /* ==================== 2. แบบรายงานเด็กเข้า ป.1 (แนบ 386) ขนาด A4 แนวนอน ==================== */
          <div className="max-w-[297mm] mx-auto p-[10mm] bg-white border border-slate-100 shadow-xl print:shadow-none print:border-none print:p-0 font-thai">
            <style dangerouslySetInnerHTML={{__html: `
              @media print {
                body { background: white; color: black; }
                header, .print-hidden, aside { display: none !important; }
                html, body, #root, main, .min-h-screen, .flex-1, .overflow-y-auto, .custom-scrollbar, .max-w-7xl {
                  height: auto !important;
                  min-height: 0 !important;
                  max-height: none !important;
                  overflow: visible !important;
                  position: static !important;
                  display: block !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  background: white !important;
                  box-shadow: none !important;
                }
                .max-w-[297mm] { 
                  width: 100% !important; 
                  max-width: none !important; 
                  border: none !important;
                  box-shadow: none !important;
                  padding: 0 !important;
                  margin: 0 !important;
                }
                input { 
                  border: none !important; 
                  background: transparent !important; 
                  padding: 0 !important; 
                  outline: none !important;
                  box-shadow: none !important;
                }
              }
              @page {
                size: A4 landscape;
                margin: 8mm 10mm 8mm 10mm;
              }
            `}} />
            
            {/* หัวรายงาน */}
            <div className="flex flex-col items-center mb-4">
              <h2 className="text-center font-bold text-[16px] leading-tight">บัญชีรายชื่อเด็กที่มีอายุถึงเกณฑ์ภาคบังคับตามพระราชบัญญัติการศึกษาแห่งชาติ พ.ศ. 2545</h2>
              <h3 className="text-center font-bold text-[15px] mt-1">
                เข้าเรียนชั้นประถมศึกษาปีที่ 1 หรือเด็กชั้นอื่น ที่เกิด พ.ศ. {printFilterYear} ปีการศึกษา {parseInt(printFilterYear) + 7}
              </h3>
              <p className="text-center font-bold text-[13px] mt-1.5">
                โรงเรียน {schoolName} ตำบล {subDistrict} อำเภอ {district} จังหวัด {province}
              </p>
            </div>

            <table className="w-full border-collapse border border-black text-[11px] leading-normal mt-4">
              <thead>
                <tr>
                  <th className="border border-black p-1 text-center bg-slate-50/50" rowSpan={2} style={{ width: '3%' }}>ที่</th>
                  <th className="border border-black p-1 text-center bg-slate-50/50" rowSpan={2} style={{ width: '15%' }}>ชื่อ-สกุล</th>
                  <th className="border border-black p-1 text-center bg-slate-50/50" rowSpan={2} style={{ width: '4%' }}>ชั้น</th>
                  <th className="border border-black p-1 text-center bg-slate-50/50" rowSpan={2} style={{ width: '7%' }}>วัน เดือน ปีเกิด</th>
                  <th className="border border-black p-1 text-center bg-slate-50/50" rowSpan={2} style={{ width: '10%' }}>เลขประจำตัวประชาชน</th>
                  <th className="border border-black p-1 text-center bg-slate-50/50" rowSpan={2} style={{ width: '13%' }}>ที่อยู่ตาม ทร.14</th>
                  <th className="border border-black p-1 text-center bg-slate-50/50" colSpan={3} style={{ width: '36%' }}>ชื่อ - สกุล</th>
                  <th className="border border-black p-1 text-center bg-slate-50/50" rowSpan={2} style={{ width: '12%' }}>สถานศึกษาที่เข้าเรียน</th>
                </tr>
                <tr>
                  <th className="border border-black p-1 text-center bg-slate-50/50" style={{ width: '12%' }}>บิดา</th>
                  <th className="border border-black p-1 text-center bg-slate-50/50" style={{ width: '12%' }}>มารดา</th>
                  <th className="border border-black p-1 text-center bg-slate-50/50" style={{ width: '12%' }}>ผู้ปกครอง</th>
                </tr>
              </thead>
              <tbody>
                {printStudents.length > 0 ? (
                  printStudents.map((s, idx) => {
                    const studentId = s.id || `temp_${idx}`;
                    const currentClass = inlineData[studentId]?.class ?? (s.enroll_class || 'ป.1');
                    const currentFather = inlineData[studentId]?.father ?? (s.father_name || '');
                    const currentMother = inlineData[studentId]?.mother ?? (s.mother_name || '');
                    const currentGuardian = inlineData[studentId]?.guardian ?? (s.guardian_name || s.father_name || s.mother_name || '');
                    const currentSchool = inlineData[studentId]?.schoolEnrolled ?? (s.school_enrolled || schoolName);

                    // ประกอบที่อยู่ ทร.14
                    const addressParts = [];
                    if (s.house_no) addressParts.push(`เลขที่ ${s.house_no}`);
                    if (s.moo) addressParts.push(`ม.${s.moo}`);
                    if (s.sub_district) addressParts.push(`ต.${s.sub_district}`);
                    if (s.district) addressParts.push(`อ.${s.district}`);
                    if (s.province) addressParts.push(`จ.${s.province}`);
                    const fullAddress = addressParts.join(' ');

                    return (
                      <tr key={studentId}>
                        <td className="border border-black p-1 text-center">{idx + 1}</td>
                        <td className="border border-black p-1 text-left">{s.prefix}{s.first_name} {s.last_name}</td>
                        <td className="border border-black p-0.5 text-center">
                          <input 
                            type="text" 
                            value={currentClass} 
                            onChange={(e) => updateInlineData(studentId, 'class', e.target.value)} 
                            className="w-full text-center bg-transparent border-none outline-hidden focus:ring-1 focus:ring-emerald-500 rounded text-[11px] py-0.5 print:p-0 print:ring-0"
                          />
                        </td>
                        <td className="border border-black p-1 text-center">
                          {s.birth_date ? new Date(s.birth_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : ''}
                        </td>
                        <td className="border border-black p-1 text-center font-mono text-xs">{s.national_id}</td>
                        <td className="border border-black p-1 text-left leading-tight text-[10.5px]">{fullAddress || '-'}</td>
                        <td className="border border-black p-0.5 text-left">
                          <input 
                            type="text" 
                            value={currentFather} 
                            onChange={(e) => updateInlineData(studentId, 'father', e.target.value)} 
                            className="w-full text-left bg-transparent border-none outline-hidden focus:ring-1 focus:ring-emerald-500 rounded text-[11px] py-0.5 print:p-0 print:ring-0"
                          />
                        </td>
                        <td className="border border-black p-0.5 text-left">
                          <input 
                            type="text" 
                            value={currentMother} 
                            onChange={(e) => updateInlineData(studentId, 'mother', e.target.value)} 
                            className="w-full text-left bg-transparent border-none outline-hidden focus:ring-1 focus:ring-emerald-500 rounded text-[11px] py-0.5 print:p-0 print:ring-0"
                          />
                        </td>
                        <td className="border border-black p-0.5 text-left">
                          <input 
                            type="text" 
                            value={currentGuardian} 
                            onChange={(e) => updateInlineData(studentId, 'guardian', e.target.value)} 
                            className="w-full text-left bg-transparent border-none outline-hidden focus:ring-1 focus:ring-emerald-500 rounded text-[11px] py-0.5 print:p-0 print:ring-0"
                          />
                        </td>
                        <td className="border border-black p-0.5 text-left">
                          <input 
                            type="text" 
                            value={currentSchool} 
                            onChange={(e) => updateInlineData(studentId, 'schoolEnrolled', e.target.value)} 
                            className="w-full text-left bg-transparent border-none outline-hidden focus:ring-1 focus:ring-emerald-500 rounded text-[11px] py-0.5 print:p-0 print:ring-0"
                          />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="border border-black p-6 text-center text-slate-400 font-bold">ไม่พบข้อมูลรายชื่อเด็กที่เกิดปี พ.ศ. {printFilterYear} ในพื้นที่ตัวเลือก</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="mt-4 text-[11px] font-bold text-left leading-normal">
              หมายเหตุ ให้จัดทำข้อมูลด้วยโปรแกรม Microsoft Excel และจัดส่งทางไปรษณีย์อิเล็กทรอนิกส์ (E-mail) : {emailTarget}
            </div>

            <div className="flex justify-end mt-8 text-[13px]">
              <div className="w-[45%] text-center flex flex-col items-center">
                <p className="mb-5 font-bold">ผู้รับรองข้อมูล ______________________________</p>
                <p className="font-bold">( {verifierName || '___________________________________'} )</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ส่วนควบคุม */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">
            <MapPin size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">เด็กในเขตพื้นที่บริการ</h3>
            <p className="text-xs text-slate-400 font-medium">นำเข้าข้อมูล ทร.14 ค้นหา และพิมพ์รายงาน พฐ.03</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* นำเข้า Excel */}
          <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-600 rounded-2xl font-bold text-xs cursor-pointer transition-all">
            <FileUp size={16} /> นำเข้า ทร.14 (Excel)
            <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} className="hidden" />
          </label>

          {/* ส่งออก Excel */}
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-600 rounded-2xl font-bold text-xs transition-all"
          >
            <FileDown size={16} /> ส่งออก Excel
          </button>

          {/* พิมพ์ พฐ.03 */}
          <button 
            onClick={() => setIsPrintMode(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-bold text-xs transition-all"
          >
            <Printer size={16} /> พิมพ์รายงาน พฐ.03
          </button>

          {/* เพิ่มประวัติเด็กรายบุคคล */}
          <button 
            onClick={() => {
              setEditingStudent(null);
              setFormData({});
              setShowFormDialog(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-emerald-600/10 transition-all"
          >
            <Plus size={16} /> เพิ่มประวัติเด็ก
          </button>
        </div>
      </div>

      {/* แถบค้นหา */}
      <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-200/60 shadow-xs">
        <Search size={18} className="text-slate-400" />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ค้นหาด้วยชื่อ-นามสกุล, เลขประจำตัวประชาชน หรือที่อยู่บ้านเลขที่..." 
          className="w-full bg-transparent border-none outline-hidden text-sm font-bold text-slate-700 placeholder-slate-400"
        />
      </div>

      {/* รายชื่อและรายละเอียด */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-emerald-600" size={32} />
            <span className="text-sm font-bold text-slate-400">กำลังโหลดข้อมูลเด็ก...</span>
          </div>
        ) : filteredStudents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <th className="py-4 px-6 text-center">ลำดับ</th>
                  <th className="py-4 px-6">เลขประชาชน 13 หลัก</th>
                  <th className="py-4 px-6">ชื่อ - นามสกุล</th>
                  <th className="py-4 px-6 text-center">เพศ</th>
                  <th className="py-4 px-6">วันเกิด / พ.ศ. เกิด</th>
                  <th className="py-4 px-6 text-center">อายุ</th>
                  <th className="py-4 px-6">ที่อยู่</th>
                  <th className="py-4 px-6 text-center">ป.1 (พฐ.03)</th>
                  <th className="py-4 px-6 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-bold text-slate-600">
                {filteredStudents.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50/55 transition-colors">
                    <td className="py-4 px-6 text-center text-slate-400 text-xs">{idx + 1}</td>
                    <td className="py-4 px-6 font-mono text-xs">{s.national_id}</td>
                    <td className="py-4 px-6 text-slate-800">{s.prefix}{s.first_name} {s.last_name}</td>
                    <td className="py-4 px-6 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        s.gender === 'ชาย' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'
                      }`}>{s.gender}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs block">{s.birth_date ? new Date(s.birth_date).toLocaleDateString('th-TH') : '-'}</span>
                      <span className="text-[10px] text-slate-400">พ.ศ. {s.birth_date ? getBirthYearTH(s.birth_date) : '-'}</span>
                    </td>
                    <td className="py-4 px-6 text-center">{s.age} ปี</td>
                    <td className="py-4 px-6 text-xs text-slate-500 leading-normal">
                      บ้านเลขที่ {s.house_no} หมู่ที่ {s.moo || '-'} ต.{s.sub_district} อ.{s.district} จ.{s.province}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-xs">
                        ปีการศึกษา {s.birth_date ? getEnrollYearTH(s.birth_date) : '-'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => {
                            setEditingStudent(s);
                            setFormData(s);
                            setShowFormDialog(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-all"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteStudent(s.id!)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-20 text-center flex flex-col items-center justify-center gap-2">
            <span className="text-slate-300 font-bold">ไม่พบข้อมูลเด็กในเขตพื้นที่บริการ</span>
            <span className="text-xs text-slate-400">คุณครูสามารถคลิกปุ่มนำเข้าข้อมูล Excel ทร.14 หรือกดปุ่มเพิ่มประวัติได้ค่ะ</span>
          </div>
        )}
      </div>

      {/* แบบฟอร์มเพิ่ม/แก้ไขเด็ก (Dialog Overlay) */}
      {showFormDialog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[999]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-8 animate-in zoom-in-95 duration-200">
            <h3 className="font-bold text-slate-800 text-lg mb-6">
              {editingStudent ? '📝 แก้ไขข้อมูลประวัติเด็ก' : '➕ เพิ่มประวัติเด็กในเขตบริการ'}
            </h3>
            
            <form onSubmit={handleSaveStudent} className="space-y-6 text-sm font-bold text-slate-600">
              {/* ข้อมูลพื้นฐาน */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block mb-1 text-xs text-slate-400">เลขประชาชน 13 หลัก</label>
                  <input 
                    type="text" 
                    required 
                    maxLength={13}
                    value={formData.national_id || ''} 
                    onChange={(e) => setFormData({...formData, national_id: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-hidden"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs text-slate-400">คำนำหน้า</label>
                  <select 
                    value={formData.prefix || ''} 
                    onChange={(e) => setFormData({...formData, prefix: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-hidden"
                  >
                    <option value="">เลือกคำนำหน้า</option>
                    <option value="เด็กชาย">เด็กชาย</option>
                    <option value="เด็กหญิง">เด็กหญิง</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-xs text-slate-400">เพศ</label>
                  <select 
                    value={formData.gender || ''} 
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-hidden"
                  >
                    <option value="">เลือกเพศ</option>
                    <option value="ชาย">ชาย</option>
                    <option value="หญิง">หญิง</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block mb-1 text-xs text-slate-400">ชื่อจริง</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.first_name || ''} 
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-hidden"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs text-slate-400">นามสกุล</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.last_name || ''} 
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-hidden"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs text-slate-400">วัน เดือน ปีเกิด</label>
                  <input 
                    type="date" 
                    required 
                    value={formData.birth_date || ''} 
                    onChange={(e) => setFormData({...formData, birth_date: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-hidden"
                  />
                </div>
              </div>

              {/* ข้อมูลที่อยู่ */}
              <h4 className="border-b border-slate-100 pb-2 text-slate-800 text-xs uppercase tracking-wider">ที่อยู่อาศัยตามทะเบียนบ้าน</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block mb-1 text-xs text-slate-400">บ้านเลขที่</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.house_no || ''} 
                    onChange={(e) => setFormData({...formData, house_no: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-hidden"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs text-slate-400">หมู่ที่</label>
                  <input 
                    type="text" 
                    value={formData.moo || ''} 
                    onChange={(e) => setFormData({...formData, moo: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-hidden"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs text-slate-400">ตำบล</label>
                  <input 
                    type="text" 
                    value={formData.sub_district || ''} 
                    onChange={(e) => setFormData({...formData, sub_district: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-hidden"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs text-slate-400">อำเภอ</label>
                  <input 
                    type="text" 
                    value={formData.district || ''} 
                    onChange={(e) => setFormData({...formData, district: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block mb-1 text-xs text-slate-400">จังหวัด</label>
                  <input 
                    type="text" 
                    value={formData.province || ''} 
                    onChange={(e) => setFormData({...formData, province: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-hidden"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs text-slate-400">รหัสรหัสประจำบ้าน</label>
                  <input 
                    type="text" 
                    value={formData.house_id || ''} 
                    onChange={(e) => setFormData({...formData, house_id: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-hidden"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs text-slate-400">สัญชาติ</label>
                  <input 
                    type="text" 
                    value={formData.nationality || 'ไทย'} 
                    onChange={(e) => setFormData({...formData, nationality: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-hidden"
                  />
                </div>
              </div>

              {/* บิดา มารดา */}
              <h4 className="border-b border-slate-100 pb-2 text-slate-800 text-xs uppercase tracking-wider">ชื่อบิดา - มารดา</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-xs text-slate-400">ชื่อ - นามสกุลบิดา</label>
                  <input 
                    type="text" 
                    value={formData.father_name || ''} 
                    onChange={(e) => setFormData({...formData, father_name: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-hidden"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs text-slate-400">ชื่อ - นามสกุลมารดา</label>
                  <input 
                    type="text" 
                    value={formData.mother_name || ''} 
                    onChange={(e) => setFormData({...formData, mother_name: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-hidden"
                  />
                </div>
              </div>

              {/* สถานศึกษาที่เข้าเรียน */}
              <h4 className="border-b border-slate-100 pb-2 text-slate-800 text-xs uppercase tracking-wider">ข้อมูลการศึกษาและผู้ปกครองเพิ่มเติม</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block mb-1 text-xs text-slate-400">สถานศึกษาที่เข้าเรียน (ป.1)</label>
                  <input 
                    type="text" 
                    value={formData.school_enrolled || ''} 
                    onChange={(e) => setFormData({...formData, school_enrolled: e.target.value})}
                    placeholder="กรอกชื่อโรงเรียนที่เด็กเข้าเรียน"
                    className="w-full p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-hidden"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs text-slate-400">ชื่อ - นามสกุล ผู้ปกครอง</label>
                  <input 
                    type="text" 
                    value={formData.guardian_name || ''} 
                    onChange={(e) => setFormData({...formData, guardian_name: e.target.value})}
                    placeholder="กรอกชื่อผู้ปกครอง (ปล่อยว่างได้)"
                    className="w-full p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-hidden"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs text-slate-400">ชั้นเรียน (ป.1 / ชั้นอื่น)</label>
                  <input 
                    type="text" 
                    value={formData.enroll_class || 'ป.1'} 
                    onChange={(e) => setFormData({...formData, enroll_class: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowFormDialog(false)}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/10 transition-all"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
