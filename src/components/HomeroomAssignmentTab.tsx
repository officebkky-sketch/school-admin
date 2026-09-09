// src/components/HomeroomAssignmentTab.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { 
  Users, 
  UserCheck, 
  Plus, 
  Trash2, 
  Save, 
  ShieldCheck, 
  Loader2, 
  School,
  GraduationCap,
  Sparkles,
  Info
} from 'lucide-react';

interface TeacherItem {
  id: string;
  prefix: string;
  first_name: string;
  last_name: string;
  position: string;
  department: string;
  phone: string;
  email: string;
  photo_url?: string;
}

export interface ClassTeacherAssignment {
  teacherId: string;
  teacherName: string;
  roleType: 'หลัก' | 'ร่วม' | 'พี่เลี้ยง';
}

const CLASS_LEVELS = ['อ.2', 'อ.3', 'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'];

// ค่าเริ่มต้นอิงตามครูจริงของโรงเรียน
const DEFAULT_HOMEROOM_MAP: Record<string, ClassTeacherAssignment[]> = {
  'อ.2': [{ teacherId: '', teacherName: 'นางสาวณัฐหทัย สงแสง', roleType: 'หลัก' }],
  'อ.3': [{ teacherId: '', teacherName: 'นางสาวณัฐหทัย สงแสง', roleType: 'หลัก' }],
  'ป.1': [{ teacherId: '', teacherName: 'นางสุธัญญา เทพเกื้อ', roleType: 'หลัก' }],
  'ป.2': [{ teacherId: '', teacherName: 'นางกานดา เอียดหมุน', roleType: 'หลัก' }],
  'ป.3': [{ teacherId: '', teacherName: 'นางสาวสุมาลี บิลยะแม', roleType: 'หลัก' }],
  'ป.4': [{ teacherId: '', teacherName: 'นางสาวปาริชาติ แก้วนวน', roleType: 'หลัก' }],
  'ป.5': [{ teacherId: '', teacherName: 'นางสาวชูไฮลา  สุหรง', roleType: 'หลัก' }],
  'ป.6': [{ teacherId: '', teacherName: 'นางสาววัชรี พรหมช่วย', roleType: 'หลัก' }]
};

export default function HomeroomAssignmentTab() {
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [assignments, setAssignments] = useState<Record<string, ClassTeacherAssignment[]>>(() => {
    const saved = localStorage.getItem('homeroom_class_assignments');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_HOMEROOM_MAP;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTeachersAndAssignments();
  }, []);

  async function fetchTeachersAndAssignments() {
    try {
      setLoading(true);

      // 1. ดึงครูทั้งหมดจากฐานข้อมูลระบบหลัก
      const { data: teacherData, error: tErr } = await supabase
        .from('teachers')
        .select('*')
        .order('first_name', { ascending: true });

      if (tErr) throw tErr;
      const tList: TeacherItem[] = teacherData || [];
      setTeachers(tList);

      // 2. ดึงข้อมูลการแต่งตั้งจากตาราง teacher_duties ที่เป็นประเภท "ครูประจำชั้น"
      const { data: duties, error: dErr } = await supabase
        .from('teacher_duties')
        .select('*')
        .in('duty_type', ['ครูประจำชั้น', 'ครูประจำชั้นหลัก', 'ครูประจำชั้นร่วม', 'ครูพี่เลี้ยง']);

      if (!dErr && duties && duties.length > 0) {
        const mappedFromDb: Record<string, ClassTeacherAssignment[]> = {};
        CLASS_LEVELS.forEach(cls => { mappedFromDb[cls] = []; });

        duties.forEach((d: any) => {
          const cls = d.duty_day; // บันทึกระดับชั้นใน duty_day เช่น 'ป.1'
          if (CLASS_LEVELS.includes(cls)) {
            const matchedTeacher = tList.find(t => t.id === d.teacher_id);
            const tName = matchedTeacher 
              ? `${matchedTeacher.prefix}${matchedTeacher.first_name} ${matchedTeacher.last_name}`.trim()
              : 'ครูผู้สอน';

            let roleType: ClassTeacherAssignment['roleType'] = 'หลัก';
            if (d.duty_type.includes('ร่วม')) roleType = 'ร่วม';
            else if (d.duty_type.includes('พี่เลี้ยง')) roleType = 'พี่เลี้ยง';

            mappedFromDb[cls].push({
              teacherId: d.teacher_id,
              teacherName: tName,
              roleType
            });
          }
        });

        // หากห้องไหนมีข้อมูลใน DB ให้ใช้ข้อมูลจาก DB
        let hasAnyDb = false;
        CLASS_LEVELS.forEach(cls => {
          if (mappedFromDb[cls].length > 0) hasAnyDb = true;
        });

        if (hasAnyDb) {
          setAssignments(prev => ({ ...prev, ...mappedFromDb }));
          localStorage.setItem('homeroom_class_assignments', JSON.stringify(mappedFromDb));
        }
      }
    } catch (err: any) {
      console.error('Error loading assignments:', err);
    } finally {
      setLoading(false);
    }
  }

  // เพิ่มครูประจำชั้นในห้องนั้นๆ (1 ห้องมีได้มากกว่า 1 คน)
  const handleAddTeacherToClass = (classLevel: string) => {
    const currentList = assignments[classLevel] || [];
    const firstTeacher = teachers[0];
    const newAssignment: ClassTeacherAssignment = {
      teacherId: firstTeacher?.id || '',
      teacherName: firstTeacher ? `${firstTeacher.prefix}${firstTeacher.first_name} ${firstTeacher.last_name}`.trim() : '',
      roleType: currentList.length === 0 ? 'หลัก' : 'ร่วม'
    };

    const updated = {
      ...assignments,
      [classLevel]: [...currentList, newAssignment]
    };
    setAssignments(updated);
  };

  // เปลี่ยนครู หรือเปลี่ยนบทบาท
  const handleUpdateAssignment = (
    classLevel: string,
    index: number,
    field: 'teacherId' | 'roleType',
    value: string
  ) => {
    const currentList = [...(assignments[classLevel] || [])];
    if (!currentList[index]) return;

    if (field === 'teacherId') {
      const found = teachers.find(t => t.id === value);
      const tName = found ? `${found.prefix}${found.first_name} ${found.last_name}`.trim() : '';
      currentList[index] = { ...currentList[index], teacherId: value, teacherName: tName };
    } else {
      currentList[index] = { ...currentList[index], roleType: value as any };
    }

    setAssignments({
      ...assignments,
      [classLevel]: currentList
    });
  };

  // ลบครูออกจากห้อง
  const handleRemoveTeacherFromClass = (classLevel: string, index: number) => {
    const currentList = assignments[classLevel] || [];
    const updatedList = currentList.filter((_, i) => i !== index);
    setAssignments({
      ...assignments,
      [classLevel]: updatedList
    });
  };

  // บันทึกการแต่งตั้งครูประจำชั้นลง Supabase
  const handleSaveAssignments = async () => {
    setSaving(true);
    try {
      // 1. บันทึกลง localStorage เพื่อการเข้าถึงที่รวดเร็ว
      localStorage.setItem('homeroom_class_assignments', JSON.stringify(assignments));

      // 2. ซิงค์ลงตาราง teacher_duties ใน Supabase
      // ลบ duties ประเภทครูประจำชั้นเดิมออกก่อน
      const { error: delErr } = await supabase
        .from('teacher_duties')
        .delete()
        .in('duty_type', ['ครูประจำชั้น', 'ครูประจำชั้นหลัก', 'ครูประจำชั้นร่วม', 'ครูพี่เลี้ยง']);

      if (delErr) console.warn('Could not delete old homeroom duties:', delErr.message);

      // สร้าง payload ใหม่
      const dutiesPayload: any[] = [];
      const teacherAssignedClassesMap: Record<string, string[]> = {};

      Object.entries(assignments).forEach(([cls, list]) => {
        list.forEach(item => {
          if (item.teacherId) {
            dutiesPayload.push({
              teacher_id: item.teacherId,
              duty_day: cls, // ระบุชั้น เช่น 'ป.1'
              duty_type: `ครูประจำชั้น${item.roleType}`
            });

            if (!teacherAssignedClassesMap[item.teacherId]) {
              teacherAssignedClassesMap[item.teacherId] = [];
            }
            if (!teacherAssignedClassesMap[item.teacherId].includes(cls)) {
              teacherAssignedClassesMap[item.teacherId].push(cls);
            }
          }
        });
      });

      if (dutiesPayload.length > 0) {
        const { error: insErr } = await supabase.from('teacher_duties').insert(dutiesPayload);
        if (insErr) throw insErr;
      }

      toast.success('บันทึกการแต่งตั้งครูประจำชั้นเรียบร้อยแล้วค่ะ');
    } catch (err: any) {
      console.error('Error saving assignments:', err);
      toast.error('บันทึกไม่สำเร็จ', err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="animate-spin mx-auto text-brand-primary" size={36} />
        <p className="text-slate-400 font-bold text-sm mt-3">กำลังโหลดข้อมูลครูและคำสั่งแต่งตั้ง...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
            <UserCheck className="text-brand-primary" size={24} />
            แต่งตั้งครูประจำชั้น (Homeroom Teachers)
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-1">
            กำหนดครูผู้รับผิดชอบห้องเรียน • <strong>1 ระดับชั้นสามารถแต่งตั้งครูประจำชั้นได้มากกว่า 1 คน</strong> (เช่น ครูประจำชั้นหลัก, ครูประจำชั้นร่วม, ครูพี่เลี้ยง)
          </p>
        </div>

        <button
          onClick={handleSaveAssignments}
          disabled={saving}
          className="bg-brand-primary text-white px-8 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-green-100 hover:bg-green-700 active:scale-95 transition-all text-sm disabled:opacity-50 shrink-0"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          <span>บันทึกการแต่งตั้งทั้งหมด</span>
        </button>
      </div>

      {/* Classroom Cards Grid (8 Levels) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {CLASS_LEVELS.map((classLevel) => {
          const classTeachers = assignments[classLevel] || [];

          return (
            <div
              key={classLevel}
              className="bg-white rounded-[28px] border border-slate-100 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
            >
              <div>
                {/* Card Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-brand-primary flex items-center justify-center font-bold text-base border border-emerald-100">
                      {classLevel}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">ชั้น {classLevel}</h4>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {classTeachers.length} ท่านที่ได้รับมอบหมาย
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddTeacherToClass(classLevel)}
                    className="p-1.5 bg-emerald-50 text-brand-primary hover:bg-emerald-100 rounded-xl transition text-xs font-bold flex items-center gap-1"
                    title="เพิ่มครูประจำชั้นอีก 1 คน"
                  >
                    <Plus size={15} />
                    <span>เพิ่ม</span>
                  </button>
                </div>

                {/* Teachers List in this Class */}
                <div className="space-y-3">
                  {classTeachers.length === 0 ? (
                    <div className="py-6 text-center text-slate-300 text-xs italic border border-dashed border-slate-200 rounded-2xl">
                      ยังไม่ได้แต่งตั้งครูประจำชั้น
                    </div>
                  ) : (
                    classTeachers.map((assign, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/60 space-y-2 relative group"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            assign.roleType === 'หลัก'
                              ? 'bg-emerald-100 text-emerald-800'
                              : assign.roleType === 'ร่วม'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            ครูประจำชั้น{assign.roleType}
                          </span>

                          <button
                            onClick={() => handleRemoveTeacherFromClass(classLevel, idx)}
                            className="text-slate-300 hover:text-red-500 transition p-1"
                            title="ลบครูท่านนี้ออกจากห้อง"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* Select Teacher Dropdown */}
                        <select
                          value={assign.teacherId || ''}
                          onChange={(e) => handleUpdateAssignment(classLevel, idx, 'teacherId', e.target.value)}
                          className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl p-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-primary cursor-pointer"
                        >
                          <option value="">-- เลือกครูผู้สอน --</option>
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.prefix}{t.first_name} {t.last_name} ({t.position})
                            </option>
                          ))}
                        </select>

                        {/* Select Role Type */}
                        <div className="flex gap-1.5 text-[10px]">
                          {(['หลัก', 'ร่วม', 'พี่เลี้ยง'] as const).map((rType) => (
                            <button
                              key={rType}
                              type="button"
                              onClick={() => handleUpdateAssignment(classLevel, idx, 'roleType', rType)}
                              className={`flex-1 py-1 rounded-lg font-bold transition text-center ${
                                assign.roleType === rType
                                  ? 'bg-white text-slate-800 shadow-xs border border-slate-300'
                                  : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              {rType}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Bottom Quick Add Note */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span>มีครูประจำชั้น {classTeachers.length} คน</span>
                <button
                  onClick={() => handleAddTeacherToClass(classLevel)}
                  className="text-brand-primary hover:underline font-bold"
                >
                  + เพิ่มครูร่วม
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
