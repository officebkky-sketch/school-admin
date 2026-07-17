import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadFile } from '../lib/storage';
import { importStudentData } from '../lib/studentImport';
import Modal from '../components/Modal';
import Papa from 'papaparse';
import { 
  UserPlus, 
  Search, 
  Users, 
  Filter,
  Loader2,
  GraduationCap,
  Upload,
  Save,
  Camera,
  FileSpreadsheet,
  Trash2,
  Edit2,
  CalendarDays,
  RefreshCcw
} from 'lucide-react';

type Student = {
  id: string;
  student_id: string;
  prefix: string;
  first_name: string;
  last_name: string;
  class_level: string;
  room: string;
  photo_url: string;
  academic_year: string;
  national_id: string;
  gender: string;
};

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPromotionModalOpen, setIsPromotionModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Promotion State
  const [promoSourceYear, setPromoSourceYear] = useState('');
  const [promoTargetYear, setPromoTargetYear] = useState('');

  // Filter State
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterClass, setFilterClass] = useState<string>('ทั้งหมด');
  const [filterRoom, setFilterRoom] = useState<string>('ทั้งหมด');

  // Form State
  const [formData, setFormData] = useState<any>({
    student_id: '',
    prefix: 'ด.ช.',
    first_name: '',
    last_name: '',
    class_level: 'ป.1',
    room: '1',
    academic_year: '',
    national_id: '',
    gender: 'ชาย',
    birth_date: '',
    weight: '',
    height: '',
    blood_group: '',
    religion: '',
    ethnicity: '',
    nationality: '',
    address_no: '',
    moo: '',
    soi_road: '',
    sub_district: '',
    district: '',
    province: '',
    parent_first_name: '',
    parent_last_name: '',
    parent_occupation: '',
    parent_relation: '',
    father_first_name: '',
    father_last_name: '',
    father_occupation: '',
    mother_first_name: '',
    mother_last_name: '',
    mother_occupation: '',
    disadvantage_status: '',
    graduation_status: 'ปกติ',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [importYear, setImportYear] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('academic_year', { ascending: false })
        .order('class_level', { ascending: true })
        .order('student_id', { ascending: true });

      if (error) throw error;
      const studentData = data || [];
      setStudents(studentData);

      // Auto-set latest year as default filter
      if (studentData.length > 0) {
        const latestYear = Array.from(new Set(studentData.map(s => s.academic_year)))
          .sort((a, b) => b.localeCompare(a))[0];
        
        if (latestYear) {
          setFilterYear(prev => prev || latestYear);
          setImportYear(prev => prev || latestYear);
          setPromoSourceYear(prev => prev || latestYear);
          setPromoTargetYear(prev => prev || (parseInt(latestYear) + 1).toString());
          setFormData((prev: any) => ({ ...prev, academic_year: prev.academic_year || latestYear }));
        }
      } else {
        // Fallback to default if no data
        setFilterYear('2568');
        setImportYear('2568');
        setPromoSourceYear('2568');
        setPromoTargetYear('2569');
        setFormData((prev: any) => ({ ...prev, academic_year: '2568' }));
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleEdit = (student: any) => {
    setFormData({
      ...formData,
      ...student,
    });
    setPreviewUrl(student.photo_url);
    setEditingId(student.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ยืนยันการลบข้อมูลของ ${name}?`)) return;
    try {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
      alert('ลบข้อมูลเรียบร้อย');
      fetchStudents();
    } catch (err) {
      alert('ไม่สามารถลบข้อมูลได้');
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'รหัสโรงเรียน', 'ชื่อโรงเรียน', 'เลขบัตรประชาชน', 'ชั้นเรียน', 'ห้องเรียน', 'เลขประจำตัวนักเรียน', 'เพศ', 
      'คำนำหน้าชื่อ', 'ชื่อ', 'นามสกุล', 'วันเดือนปีเกิด', 'อายุ', 'น้ำหนัก', 'ส่วนสูง', 'กลุ่มเลือด', 'ศาสนา', 
      'เชื้อชาติ', 'สัญชาติ', 'บ้านเลขที่', 'หมู่', 'ถนนซอย', 'ตำบล', 'อำเภอ', 'จังหวัด', 
      'คำนำหน้าชื่อผู้ปกครอง', 'ชื่อผู้ปกครอง', 'นามสกุลผู้ปกครอง', 'อาชีพผู้ปกครอง', 'ความเกี่ยวข้อง', 
      'คำนำหน้าชื่อบิดา', 'ชื่อบิดา', 'นามสกุลบิดา', 'อาชีพบิดา', 
      'คำนำหน้าชื่อมารดา', 'ชื่อมารดา', 'นามสกุลมารดา', 'อาชีพมารดา', 
      'สถานะด้อยโอกาส', 'สถานะจำหน่าย'
    ];
    // Example data based on actual DMC row provided by user
    const exampleData = [
      '93010069', 'บ้านควนโคกยา', '1939901113318', 'อ.2', '1', '3865', 'ญ', 
      'เด็กหญิง', 'ณิรินทร์รดา', 'ไชยบัญดิษฐ์', '30/06/2564', '4', '20', '100', '-', 'อิสลาม', 
      'ไทย', 'ไทย', '82', '9', '-', 'เขาชัยสน', 'เขาชัยสน', 'พัทลุง', 
      'นางสาว', 'อรสรา', 'รุ่งวรดีสกุล', 'รับจ้าง', 'มารดา', 
      'นาย', 'วีรศักดิ์', 'ไชยบัญดิษฐ์', 'ไม่ได้ประกอบอาชีพ', 
      'นางสาว', 'อรสรา', 'รุ่งวรดีสกุล', 'รับจ้าง', 
      '-', 'ปกติ'
    ];
    const csv = Papa.unparse([headers, exampleData]);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'student_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      const result: any = await importStudentData(selectedFile, importYear);
      alert(`นำเข้าสำเร็จ ${result.count} รายการ`);
      setIsImportModalOpen(false);
      setSelectedFile(null);
      fetchStudents();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  const getNextLevel = (current: string) => {
    const levels: Record<string, string> = {
      'อ.1': 'อ.2',
      'อ.2': 'อ.3',
      'อ.3': 'ป.1',
      'ป.1': 'ป.2',
      'ป.2': 'ป.3',
      'ป.3': 'ป.4',
      'ป.4': 'ป.5',
      'ป.5': 'ป.6',
      'ป.6': 'จบการศึกษา'
    };
    return levels[current] || current;
  };

  async function handlePromotion(e: React.FormEvent) {
    e.preventDefault();
    if (promoSourceYear === promoTargetYear) return alert('ปีการศึกษาต้นทางและปลายทางต้องต่างกัน');
    if (!confirm(`คุณต้องการเลื่อนชั้นนักเรียนจากปี ${promoSourceYear} ไปยังปี ${promoTargetYear} ใช่หรือไม่?`)) return;

    setIsSaving(true);
    try {
      console.log('Starting promotion from:', promoSourceYear, 'to:', promoTargetYear);
      
      // 1. Fetch source students (Handle both 'ปกติ' and 'กำลังศึกษา' for robustness)
      const { data: sourceStudents, error: fetchErr } = await supabase
        .from('students')
        .select('*')
        .eq('academic_year', promoSourceYear)
        .or('graduation_status.eq.ปกติ,graduation_status.ilike.%กำลังศึกษา%');

      if (fetchErr) throw fetchErr;
      console.log('Found source students:', sourceStudents?.length);

      if (!sourceStudents || sourceStudents.length === 0) {
        throw new Error(`ไม่พบข้อมูลนักเรียนในปีการศึกษา ${promoSourceYear} ที่มีสถานะ "ปกติ" หรือ "กำลังศึกษา"`);
      }

      // 2. Map to new year
      const promotedData = sourceStudents.map(s => {
        const { id, created_at, ...rest } = s; // Omit id and created_at
        const nextLevel = getNextLevel(s.class_level);
        return {
          ...rest,
          academic_year: promoTargetYear,
          class_level: nextLevel === 'จบการศึกษา' ? s.class_level : nextLevel,
          graduation_status: nextLevel === 'จบการศึกษา' ? 'จบการศึกษา' : 'ปกติ'
        };
      });

      // 3. Upsert into DB
      const { error: upsertErr } = await supabase.from('students').upsert(promotedData, { onConflict: 'student_id, academic_year' });
      if (upsertErr) throw upsertErr;

      alert(`เลื่อนชั้นนักเรียนสำเร็จจำนวน ${promotedData.length} รายการ`);
      setIsPromotionModalOpen(false);
      fetchStudents();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      let photo_url = formData.photo_url || '';
      if (selectedFile) {
        photo_url = await uploadFile(selectedFile, 'students', 'photos');
      }

      const payload = { ...formData, photo_url };
      const currentId = editingId;
      
      // Clean payload for DB
      delete payload.id;
      delete payload.created_at;

      const { error } = currentId 
        ? await supabase.from('students').update(payload).eq('id', currentId)
        : await supabase.from('students').insert([payload]);

      if (error) throw error;
      
      // ซิงก์ข้อมูลที่อัปเดตไปยังระบบกีฬา (athletics_registrations)
      if (currentId) {
        try {
          const syncPayload = {
            prefix: payload.prefix,
            first_name: payload.first_name,
            last_name: payload.last_name,
            gender: payload.gender,
            birth_date: payload.birth_date,
            class_level: payload.class_level,
            room: payload.room,
            weight: payload.weight ? parseFloat(payload.weight.toString()) : null,
            height: payload.height ? parseFloat(payload.height.toString()) : null,
            photo_url: photo_url,
            citizen_id: payload.national_id
          };

          await supabase
            .from('athletics_registrations')
            .update(syncPayload)
            .eq('student_id', currentId);
        } catch (syncErr) {
          console.warn('⚠️ ไม่สามารถซิงก์ข้อมูลไปยังระบบกีฬาได้:', syncErr);
        }
      }

      alert(currentId ? 'อัปเดตข้อมูลสำเร็จ' : 'เพิ่มข้อมูลสำเร็จ');
      setIsModalOpen(false);
      resetForm();
      fetchStudents();
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setIsSaving(false);
    }
  }

  function resetForm() {
    setFormData({ 
      student_id: '', prefix: 'ด.ช.', first_name: '', last_name: '', class_level: 'ป.1', room: '1', academic_year: filterYear || '2568', national_id: '',
      gender: 'ชาย', birth_date: '', weight: '', height: '', blood_group: '', religion: '', ethnicity: '', nationality: '',
      address_no: '', moo: '', soi_road: '', sub_district: '', district: '', province: '',
      parent_first_name: '', parent_last_name: '', parent_occupation: '', parent_relation: '',
      father_first_name: '', father_last_name: '', father_occupation: '',
      mother_first_name: '', mother_last_name: '', mother_occupation: '',
      disadvantage_status: '', graduation_status: 'ปกติ'
    });
    setSelectedFile(null);
    setPreviewUrl(null);
    setEditingId(null);
  }

  const filteredStudents = students.filter(student => {
    const matchesSearch = `${student.first_name} ${student.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.student_id?.includes(searchTerm) ||
      student.national_id?.includes(searchTerm);
    
    const matchesYear = filterYear === 'ทั้งหมด' || student.academic_year === filterYear;
    const matchesClass = filterClass === 'ทั้งหมด' || student.class_level === filterClass;
    const matchesRoom = filterRoom === 'ทั้งหมด' || student.room === filterRoom;

    return matchesSearch && matchesYear && matchesClass && matchesRoom;
  });

  // Get Unique Years for Filter
  const uniqueYears = Array.from(new Set(students.map(s => s.academic_year))).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col xl:flex-row justify-between items-center gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 w-full xl:flex-1">
          <div className="relative col-span-1 md:col-span-1">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="ค้นหาชื่อ, รหัส..." 
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-hidden shadow-xs focus:ring-2 focus:ring-brand-primary/20 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-3 shadow-xs">
            <CalendarDays size={18} className="text-slate-400 mr-2 shrink-0" />
            <select 
              className="w-full py-3 bg-transparent font-bold text-xs outline-hidden"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
            >
              <option value="ทั้งหมด">ทุกปีการศึกษา</option>
              {uniqueYears.length > 0 ? uniqueYears.map(y => <option key={y} value={y}>ปี {y}</option>) : <option value="2568">ปี 2568</option>}
            </select>
          </div>

          <select 
            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-xs outline-hidden shadow-xs"
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
          >
            <option value="ทั้งหมด">ทุกชั้นเรียน</option>
            {['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'].map(l => <option key={l} value={l}>ชั้น {l}</option>)}
          </select>

          <select 
            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-xs outline-hidden shadow-xs"
            value={filterRoom}
            onChange={(e) => setFilterRoom(e.target.value)}
          >
            <option value="ทั้งหมด">ทุกห้อง</option>
            {['1','2','3','4','5'].map(r => <option key={r} value={r}>ห้อง {r}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap gap-2 w-full xl:w-auto shrink-0">
          <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="bg-white border border-slate-200 text-slate-600 px-4 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-all text-xs shadow-xs">
            {viewMode === 'grid' ? 'แสดงแบบตาราง' : 'แสดงแบบการ์ด'}
          </button>
          <button onClick={() => setIsPromotionModalOpen(true)} className="bg-blue-50 text-blue-600 border border-blue-100 px-4 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-100 transition-all text-xs shadow-xs">
            <RefreshCcw size={18} /> เลื่อนชั้นนักเรียน
          </button>
          <button onClick={() => setIsImportModalOpen(true)} className="bg-orange-50 text-brand-secondary border border-orange-100 px-4 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-orange-100 transition-all text-xs shadow-xs">
            <FileSpreadsheet size={18} /> นำเข้า DMC
          </button>
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-brand-primary text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-green-100 active:scale-95 transition-all text-xs">
            <UserPlus size={18} /> เพิ่มนักเรียน
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-[40px] p-20 text-center border border-slate-100 shadow-sm">
          <Loader2 className="animate-spin mx-auto text-brand-primary mb-4" size={32} />
          <p className="text-slate-400 font-medium">กำลังโหลดข้อมูลนักเรียน...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white rounded-[40px] p-20 text-center border border-slate-100 shadow-sm">
          <Users className="mx-auto text-slate-200 mb-4" size={64} />
          <p className="text-slate-400 font-medium italic">ไม่พบข้อมูลนักเรียนในระบบ</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {filteredStudents.map((student) => (
            <div key={student.id} className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden text-center">
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2">
                   <button onClick={() => handleEdit(student)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 shadow-xs"><Edit2 size={14} /></button>
                   <button onClick={() => handleDelete(student.id, student.first_name)} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 shadow-xs"><Trash2 size={14} /></button>
                </div>
                <div className="w-24 h-24 rounded-[28px] bg-slate-100 border-4 border-white flex items-center justify-center text-slate-300 overflow-hidden mx-auto mb-4 shadow-md">
                  {student.photo_url ? <img src={student.photo_url} className="w-full h-full object-cover" /> : <GraduationCap size={40} />}
                </div>
                <h3 className="font-bold text-slate-800 line-clamp-1">{student.prefix}{student.first_name} {student.last_name}</h3>
                <p className="text-[10px] font-bold text-brand-primary mt-1 uppercase tracking-wider">รหัส: {student.student_id}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold border border-slate-100">ชั้น {student.class_level}/{student.room}</span>
                  <span className="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-bold border border-green-100">{student.academic_year}</span>
                </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">นักเรียน</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">รหัส/เลขบัตร</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">ชั้นเรียน</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">ปีการศึกษา</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredStudents.map(student => (
                  <tr key={student.id} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 overflow-hidden border border-slate-100 shadow-xs">
                          {student.photo_url ? <img src={student.photo_url} className="w-full h-full object-cover" /> : <Users size={20} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-700">{student.prefix}{student.first_name} {student.last_name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">เพศ: {student.gender || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-600 tracking-tight">{student.student_id}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{student.national_id}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold border border-slate-100">ชั้น {student.class_level}/{student.room}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-bold border border-green-100">{student.academic_year}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => handleEdit(student)} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(student.id, student.first_name)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import Modal */}
      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="นำเข้าข้อมูลนักเรียน (DMC/CSV/Excel)">
        <form onSubmit={handleImport} className="space-y-6">
          <div className="bg-orange-50/50 p-6 rounded-[32px] border border-orange-100 text-orange-700 text-sm flex justify-between items-start gap-4">
             <div className="space-y-2">
               <p className="font-bold flex items-center gap-2"><Filter size={16} /> คำแนะนำการนำเข้า:</p>
               <ul className="list-disc list-inside space-y-1 text-xs font-medium">
                 <li>รองรับไฟล์ .csv และ .xlsx ตามมาตรฐาน DMC</li>
                 <li>กรุณาระบุปีการศึกษาที่จะนำเข้าข้อมูลให้ถูกต้อง</li>
                 <li>ใช้ไฟล์เทมเพลตมาตรฐานเพื่อให้ข้อมูลเข้าฟิลด์ที่ถูกต้อง</li>
               </ul>
             </div>
             <button 
               type="button"
               onClick={downloadTemplate}
               className="bg-brand-secondary text-white px-4 py-2 rounded-2xl font-bold text-[10px] flex items-center gap-2 hover:bg-orange-600 transition-all shadow-md shrink-0 active:scale-95"
             >
               <Upload size={14} className="rotate-180" /> โหลดเทมเพลต CSV
             </button>
          </div>
          
          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-700 ml-1">ปีการศึกษาที่นำเข้า</label>
            <div className="relative">
              <CalendarDays className="absolute left-4 top-3.5 text-slate-400" size={20} />
              <input 
                type="text" 
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-brand-primary/20 outline-hidden" 
                placeholder="เช่น 2568"
                value={importYear} 
                onChange={e => setImportYear(e.target.value)} 
                required 
              />
            </div>
          </div>

          <label className="block w-full p-12 border-2 border-dashed border-slate-200 rounded-[40px] text-center cursor-pointer hover:border-brand-primary hover:bg-green-50/30 transition-all group">
            <input type="file" className="hidden" accept=".csv, .xlsx, .xls" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:bg-brand-primary/10 group-hover:scale-110 transition-all">
              <FileSpreadsheet size={40} className="text-slate-400 group-hover:text-brand-primary" />
            </div>
            <p className="font-bold text-slate-600 group-hover:text-brand-primary">{selectedFile ? selectedFile.name : 'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่'}</p>
            <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest">รองรับไฟล์ CSV, XLSX, XLS</p>
          </label>

          <button type="submit" disabled={isSaving || !selectedFile} className="w-full bg-brand-primary text-white py-4.5 rounded-[24px] font-bold flex items-center justify-center gap-3 shadow-xl shadow-green-100 hover:bg-green-700 transition-all disabled:opacity-50 active:scale-[0.98]">
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />} เริ่มการนำเข้าข้อมูลนักเรียน
          </button>
        </form>
      </Modal>

      {/* Promotion Modal */}
      <Modal isOpen={isPromotionModalOpen} onClose={() => setIsPromotionModalOpen(false)} title="เลื่อนชั้นนักเรียน (สำหรับปีการศึกษาใหม่)">
        <form onSubmit={handlePromotion} className="space-y-6">
          <div className="bg-blue-50 p-6 rounded-[32px] border border-blue-100 text-blue-700 text-sm">
             <p className="font-bold flex items-center gap-2 mb-2"><RefreshCcw size={16} /> การทำงานของระบบเลื่อนชั้น:</p>
             <ul className="list-disc list-inside space-y-1 text-xs font-medium">
               <li>คัดลอกข้อมูลนักเรียนจากปีต้นทางไปยังปีปลายทาง</li>
               <li>ปรับระดับชั้นเพิ่มขึ้น 1 ระดับ (เช่น ป.1 {'->'} ป.2)</li>
               <li>นักเรียนชั้น ป.6 จะถูกเปลี่ยนสถานะเป็น "จบการศึกษา"</li>
               <li>ข้อมูลเดิมในปีต้นทางจะไม่ถูกลบหรือแก้ไข</li>
             </ul>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 ml-1">ปีการศึกษาต้นทาง</label>
              <input 
                type="text" 
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-center" 
                value={promoSourceYear} 
                onChange={e => setPromoSourceYear(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 ml-1">ปีการศึกษาปลายทาง</label>
              <input 
                type="text" 
                className="w-full p-3.5 bg-brand-primary/5 border border-brand-primary/20 rounded-2xl font-bold text-center text-brand-primary" 
                value={promoTargetYear} 
                onChange={e => setPromoTargetYear(e.target.value)} 
                required 
              />
            </div>
          </div>

          <button type="submit" disabled={isSaving} className="w-full bg-blue-600 text-white py-4.5 rounded-[24px] font-bold flex items-center justify-center gap-3 shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98]">
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <RefreshCcw size={20} />} ยืนยันการเลื่อนชั้นนักเรียนทั้งหมด
          </button>
        </form>
      </Modal>

      {/* Add/Edit Student Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingId ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มข้อมูลนักเรียนใหม่'}>
        <form onSubmit={handleSave} className="space-y-8">
          <div className="flex flex-col md:flex-row justify-center gap-8 items-center bg-slate-50 p-8 rounded-[40px] border border-slate-100">
            <div className="relative group">
              <div className="w-32 h-32 rounded-[32px] bg-white flex items-center justify-center text-slate-300 overflow-hidden shadow-md border-4 border-white transition-transform group-hover:scale-105">
                {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" /> : <Camera size={40} />}
              </div>
              <input type="file" className="hidden" id="photo" onChange={e => {
                const f = e.target.files?.[0];
                if(f) { setSelectedFile(f); setPreviewUrl(URL.createObjectURL(f)); }
              }} />
              <label htmlFor="photo" className="absolute -bottom-2 -right-2 bg-brand-primary text-white p-3 rounded-2xl shadow-xl cursor-pointer hover:bg-green-700 transition-all active:scale-90 shadow-green-200"><Upload size={18} /></label>
            </div>
            <div className="flex-1 space-y-6 w-full">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">รหัสประจำตัวนักเรียน</label>
                   <input type="text" className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-brand-primary/20 outline-hidden" required value={formData.student_id} onChange={e => setFormData({...formData, student_id: e.target.value})} />
                 </div>
                 <div>
                   <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">เลขบัตรประชาชน</label>
                   <input type="text" className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-brand-primary/20 outline-hidden" required value={formData.national_id} onChange={e => setFormData({...formData, national_id: e.target.value})} />
                 </div>
               </div>
            </div>
          </div>

          <div className="space-y-8 px-2">
            <div>
              <h4 className="font-bold text-slate-800 border-l-4 border-brand-primary pl-4 flex justify-between items-center mb-6">
                <span>ข้อมูลส่วนตัวและระดับชั้น</span>
                <div className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded-lg border border-green-100">
                  <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">ปีการศึกษา</span>
                  <input type="text" className="w-12 bg-transparent text-[10px] font-black text-green-700 outline-hidden" value={formData.academic_year} onChange={e => setFormData({...formData, academic_year: e.target.value})} />
                </div>
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="col-span-1">
                   <label className="text-xs font-bold text-slate-500 ml-1">คำนำหน้า</label>
                   <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl mt-1.5 font-bold outline-hidden" value={formData.prefix} onChange={e => setFormData({...formData, prefix: e.target.value})}>
                      <option value="ด.ช.">ด.ช.</option><option value="ด.ญ.">ด.ญ.</option><option value="นาย">นาย</option><option value="นางสาว">นางสาว</option>
                   </select>
                 </div>
                 <div className="col-span-1 md:col-span-1.5">
                   <label className="text-xs font-bold text-slate-500 ml-1">ชื่อต้น</label>
                   <input type="text" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl mt-1.5 font-bold outline-hidden" required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} />
                 </div>
                 <div className="col-span-1 md:col-span-1.5">
                   <label className="text-xs font-bold text-slate-500 ml-1">นามสกุล</label>
                   <input type="text" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl mt-1.5 font-bold outline-hidden" required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} />
                 </div>
              </div>

              <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mt-6">
                <div className="col-span-1">
                  <label className="text-xs font-bold text-slate-500 ml-1">เพศ</label>
                  <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl mt-1.5 font-bold outline-hidden" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                    <option value="ชาย">ชาย</option><option value="หญิง">หญิง</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-500 ml-1">วัน/เดือน/ปี เกิด</label>
                  <input type="date" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl mt-1.5 font-bold outline-hidden" value={formData.birth_date} onChange={e => setFormData({...formData, birth_date: e.target.value})} />
                </div>
                <div className="col-span-1">
                  <label className="text-xs font-bold text-slate-500 ml-1">ระดับชั้น</label>
                  <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl mt-1.5 font-black outline-hidden text-brand-primary" value={formData.class_level} onChange={e => setFormData({...formData, class_level: e.target.value})}>
                    {['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="text-xs font-bold text-slate-500 ml-1">ห้องเรียน</label>
                  <input type="text" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl mt-1.5 font-bold outline-hidden text-center" value={formData.room} onChange={e => setFormData({...formData, room: e.target.value})} />
                </div>
                <div className="col-span-1">
                  <label className="text-xs font-bold text-slate-500 ml-1">หมู่เลือด</label>
                  <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl mt-1.5 font-bold outline-hidden text-center" value={formData.blood_group} onChange={e => setFormData({...formData, blood_group: e.target.value})}>
                    <option value="">-</option><option value="A">A</option><option value="B">B</option><option value="O">O</option><option value="AB">AB</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 border-l-4 border-orange-400 pl-4 mb-6">ที่อยู่และข้อมูลการติดต่อ</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <input type="text" placeholder="บ้านเลขที่" className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-medium outline-hidden" value={formData.address_no} onChange={e => setFormData({...formData, address_no: e.target.value})} />
                 <input type="text" placeholder="หมู่ที่" className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-medium outline-hidden text-center" value={formData.moo} onChange={e => setFormData({...formData, moo: e.target.value})} />
                 <input type="text" placeholder="แขวง/ตำบล" className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-medium outline-hidden" value={formData.sub_district} onChange={e => setFormData({...formData, sub_district: e.target.value})} />
                 <input type="text" placeholder="เขต/อำเภอ" className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-medium outline-hidden" value={formData.district} onChange={e => setFormData({...formData, district: e.target.value})} />
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 border-l-4 border-blue-400 pl-4 mb-6">ข้อมูลครอบครัวและผู้ปกครอง</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50/20 p-6 rounded-[32px] border border-blue-100/50">
                 <div className="space-y-4">
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest ml-1">ข้อมูลผู้ปกครองหลัก</p>
                    <div className="flex gap-2">
                      <input type="text" placeholder="ชื่อผู้ปกครอง" className="flex-1 p-3.5 bg-white border border-slate-200 rounded-2xl font-medium outline-hidden" value={formData.parent_first_name} onChange={e => setFormData({...formData, parent_first_name: e.target.value})} />
                      <input type="text" placeholder="นามสกุล" className="flex-1 p-3.5 bg-white border border-slate-200 rounded-2xl font-medium outline-hidden" value={formData.parent_last_name} onChange={e => setFormData({...formData, parent_last_name: e.target.value})} />
                    </div>
                    <input type="text" placeholder="ความเกี่ยวข้อง (เช่น บิดา, มารดา, ปู่)" className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl font-medium outline-hidden" value={formData.parent_relation} onChange={e => setFormData({...formData, parent_relation: e.target.value})} />
                 </div>
                 <div className="space-y-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">สถานะทางการศึกษา</p>
                    <div className="bg-white p-2 rounded-2xl border border-slate-200">
                      <select className="w-full p-3 bg-transparent font-black text-slate-700 outline-hidden" value={formData.graduation_status} onChange={e => setFormData({...formData, graduation_status: e.target.value})}>
                        <option value="ปกติ">กำลังศึกษา (ปกติ)</option>
                        <option value="จบการศึกษา">จบการศึกษา</option>
                        <option value="ย้ายสถานศึกษา">ย้ายสถานศึกษา (โอนย้าย)</option>
                        <option value="ออกกลางคัน">ออกกลางคัน (Drop out)</option>
                        <option value="อื่นๆ">อื่นๆ</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                       <input type="number" placeholder="น้ำหนัก (กก.)" className="flex-1 p-3.5 bg-white border border-slate-200 rounded-2xl font-medium outline-hidden text-center" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} />
                       <input type="number" placeholder="ส่วนสูง (ซม.)" className="flex-1 p-3.5 bg-white border border-slate-200 rounded-2xl font-medium outline-hidden text-center" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} />
                    </div>
                 </div>
              </div>
            </div>
          </div>

          <div className="pt-4 px-2">
            <button type="submit" disabled={isSaving} className="w-full bg-brand-primary text-white py-5 rounded-[28px] font-black text-lg flex items-center justify-center gap-3 shadow-2xl shadow-green-200 hover:bg-green-700 hover:scale-[1.01] transition-all active:scale-95 disabled:opacity-50">
              {isSaving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />} 
              {editingId ? 'บันทึกการเปลี่ยนแปลงข้อมูล' : 'บันทึกข้อมูลนักเรียนใหม่'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
