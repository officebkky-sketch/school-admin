import { supabase, getActiveSchoolProfile } from './supabase';

export interface ARStep {
  id: string;
  lesson_id?: string;
  step_order: number;
  step_text: string;
  emoji: string;
}

export interface ARLesson {
  id: string;
  school_id: string;
  created_by: string;
  title: string;
  description: string;
  is_public: boolean;
  created_at?: string;
  steps: ARStep[];
  slotsCount?: number; // Calculated dynamically in client
}

const LOCAL_STORAGE_KEY = 'ar_lessons_local';

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Default lessons template to seed the app initially
const DEFAULT_LESSONS: ARLesson[] = [
  {
    id: 'd1111111-1111-1111-1111-111111111111',
    school_id: 'school_default',
    created_by: 'teacher_default',
    title: 'การตื่นนอนตอนเช้า ⏰',
    description: 'เรียงลำดับขั้นตอนการแก้ปัญหาการตื่นนอนให้เรียบร้อย',
    is_public: true,
    steps: [
      { id: 'f1111111-1111-1111-1111-111111111111', step_order: 1, step_text: 'ลืมตาตื่นนอน', emoji: '👀' },
      { id: 'f1111111-2222-1111-1111-111111111111', step_order: 2, step_text: 'พับผ้าห่มและจัดเตียง', emoji: '🛏️' },
      { id: 'f1111111-3333-1111-1111-111111111111', step_order: 3, step_text: 'ไปล้างหน้าและแปรงฟัน', emoji: '🧼' }
    ]
  },
  {
    id: 'd2222222-2222-2222-2222-222222222222',
    school_id: 'school_default',
    created_by: 'teacher_default',
    title: 'ขั้นตอนการแปรงฟัน 🪥',
    description: 'เรียงลำดับขั้นตอนการแปรงฟันให้ปากสะอาดสดชื่น',
    is_public: true,
    steps: [
      { id: 'f2222222-1111-2222-2222-222222222222', step_order: 1, step_text: 'บีบยาสีฟันใส่แปรง', emoji: '🧴' },
      { id: 'f2222222-2222-2222-2222-222222222222', step_order: 2, step_text: 'แปรงฟันให้ทั่วทุกซี่', emoji: '🦷' },
      { id: 'f2222222-3333-2222-2222-222222222222', step_order: 3, step_text: 'บ้วนปากด้วยน้ำสะอาด', emoji: '💧' }
    ]
  },
  {
    id: 'd3333333-3333-3333-3333-333333333333',
    school_id: 'school_default',
    created_by: 'teacher_default',
    title: 'เรียงตัวเลขจากน้อยไปมาก 🔢',
    description: 'เรียงลำดับขั้นตอนตามกระบวนการคิดในการเรียงลำดับตัวเลขจากน้อยไปหามาก',
    is_public: true,
    steps: [
      { id: 'f3333333-1111-3333-3333-333333333333', step_order: 1, step_text: 'เปรียบเทียบค่าตัวเลขทั้งหมด', emoji: '🔍' },
      { id: 'f3333333-2222-3333-3333-333333333333', step_order: 2, step_text: 'หาตัวเลขที่มีค่าน้อยที่สุด', emoji: '⬇️' },
      { id: 'f3333333-3333-3333-3333-333333333333', step_order: 3, step_text: 'เขียนตัวเลขจากน้อยไปหามาก', emoji: '✍️' },
      { id: 'f3333333-4444-3333-3333-333333333333', step_order: 4, step_text: 'ตรวจสอบความถูกต้องอีกครั้ง', emoji: '✅' }
    ]
  }
];

/**
 * ดึงรหัสโรงเรียนปัจจุบันที่แอคทีฟอยู่
 */
function getCurrentSchoolId(): string {
  const profile = getActiveSchoolProfile();
  return profile?.id || 'school_default';
}

/**
 * ดึงรายชื่อบทเรียนทั้งหมดสำหรับโรงเรียนและบัญชีครูที่ส่งมา
 */
export async function getARLessons(teacherId?: string): Promise<ARLesson[]> {
  const schoolId = getCurrentSchoolId();
  
  try {
    // 1. ลองดึงข้อมูลจาก Supabase Online
    const { data: lessons, error: lessonsError } = await supabase
      .from('ar_lessons')
      .select('*')
      .or(`school_id.eq.${schoolId},is_public.eq.true`);

    if (!lessonsError && lessons) {
      // ดึงรายละเอียดขั้นตอน (steps) ของทุกด่าน
      const lessonIds = lessons.map(l => l.id);
      if (lessonIds.length > 0) {
        const { data: steps, error: stepsError } = await supabase
          .from('ar_steps')
          .select('*')
          .in('lesson_id', lessonIds)
          .order('step_order', { ascending: true });

        if (!stepsError && steps) {
          // รวมร่างข้อมูล Lessons + Steps
          return lessons.map(lesson => {
            const lessonSteps = steps
              .filter(s => s.lesson_id === lesson.id)
              .map(s => ({
                id: s.id,
                lesson_id: s.lesson_id,
                step_order: s.step_order,
                step_text: s.step_text,
                emoji: s.emoji
              }));

            return {
              ...lesson,
              steps: lessonSteps,
              slotsCount: lessonSteps.length
            };
          });
        }
      } else {
        return [];
      }
    }
  } catch (e) {
    console.warn('Supabase not available or tables missing, falling back to LocalStorage:', e);
  }

  // 2. Fallback: ดึงจาก LocalStorage (ในกรณีออฟไลน์หรือไม่มี Supabase)
  try {
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    let lessons: ARLesson[] = localData ? JSON.parse(localData) : [];
    
    // ตรวจสอบและผสานด่านเริ่มต้นจาก DEFAULT_LESSONS ที่ยังไม่มีใน LocalStorage
    let hasNewDefault = false;
    DEFAULT_LESSONS.forEach(defLesson => {
      if (!lessons.some(l => l.id === defLesson.id)) {
        lessons.push(defLesson);
        hasNewDefault = true;
      }
    });
    
    if (hasNewDefault || lessons.length === 0) {
      if (lessons.length === 0) {
        lessons = [...DEFAULT_LESSONS];
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lessons));
    }
    
    // กรองเฉพาะของโรงเรียนนี้ หรือ ด่านที่เป็นสาธารณะ (is_public)
    const filtered = lessons.filter(l => l.school_id === schoolId || l.is_public);
    
    return filtered.map(l => ({
      ...l,
      slotsCount: l.steps.length
    }));
  } catch (e) {
    console.error('Error reading localStorage:', e);
  }

  // 3. ปลายทางสุดท้าย: ส่งข้อมูลเริ่มต้น
  return DEFAULT_LESSONS;
}

/**
 * บันทึกหรืออัปเดตบทเรียน
 */
export async function saveARLesson(lesson: Omit<ARLesson, 'school_id' | 'created_at'> & { school_id?: string }, teacherId: string): Promise<boolean> {
  const schoolId = lesson.school_id || getCurrentSchoolId();
  
  // Enforce UUID format for lesson id
  const isLessonUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lesson.id);
  const lessonUUID = isLessonUUID ? lesson.id : generateUUID();

  const fullLesson: ARLesson = {
    ...lesson,
    id: lessonUUID,
    school_id: schoolId,
    created_by: lesson.created_by || teacherId || 'teacher_default',
    slotsCount: lesson.steps.length
  };

  // 1. พยายามบันทึกลง Supabase Online
  try {
    // Insert/Update Lesson header
    const { error: lessonError } = await supabase
      .from('ar_lessons')
      .upsert({
        id: fullLesson.id,
        school_id: fullLesson.school_id,
        created_by: fullLesson.created_by,
        title: fullLesson.title,
        description: fullLesson.description,
        is_public: fullLesson.is_public
      });

    if (!lessonError) {
      // ลบขั้นตอนเก่าออกก่อนเพื่อเขียนขั้นตอนใหม่ทดแทน
      await supabase
        .from('ar_steps')
        .delete()
        .eq('lesson_id', fullLesson.id);

      // บันทึกขั้นตอนใหม่ลงไป โดยการแปลงหรือเจเนอเรต step ID ให้เป็น UUID
      const stepsToInsert = fullLesson.steps.map(s => {
        const isStepUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.id);
        return {
          id: isStepUUID ? s.id : generateUUID(),
          lesson_id: fullLesson.id,
          step_order: s.step_order,
          step_text: s.step_text,
          emoji: s.emoji
        };
      });

      const { error: stepsError } = await supabase
        .from('ar_steps')
        .insert(stepsToInsert);

      if (!stepsError) {
        console.log('Saved successfully to Supabase!');
        // ซิงค์ลง local storage ด้วยพร้อมข้อมูลที่แปลง ID เป็น UUID แล้ว
        fullLesson.steps = stepsToInsert.map(s => ({
          id: s.id,
          lesson_id: s.lesson_id,
          step_order: s.step_order,
          step_text: s.step_text,
          emoji: s.emoji
        }));
        syncToLocalStorage(fullLesson);
        return true;
      } else {
        console.error('Error inserting steps to Supabase:', stepsError);
      }
    } else {
      console.error('Error upserting lesson to Supabase:', lessonError);
    }
  } catch (e) {
    console.warn('Failed to save to Supabase, saving locally:', e);
  }

  // 2. บันทึกเก็บไว้ที่ LocalStorage แทน
  return syncToLocalStorage(fullLesson);
}

/**
 * ลบบทเรียน
 */
export async function deleteARLesson(lessonId: string): Promise<boolean> {
  // 1. ลบจาก Supabase
  try {
    const { error: stepsError } = await supabase
      .from('ar_steps')
      .delete()
      .eq('lesson_id', lessonId);

    const { error: lessonError } = await supabase
      .from('ar_lessons')
      .delete()
      .eq('id', lessonId);

    if (!lessonError && !stepsError) {
      console.log('Deleted successfully from Supabase!');
    }
  } catch (e) {
    console.warn('Failed to delete from Supabase, removing locally:', e);
  }

  // 2. ลบออกจาก LocalStorage
  try {
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (localData) {
      let lessons: ARLesson[] = JSON.parse(localData);
      lessons = lessons.filter(l => l.id !== lessonId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lessons));
      return true;
    }
  } catch (e) {
    console.error('Error deleting from localStorage:', e);
  }
  return false;
}

/**
 * ฟังก์ชันผู้ช่วยสำหรับเขียนทับหรือบันทึกข้อมูลบทเรียนลงใน LocalStorage
 */
function syncToLocalStorage(updatedLesson: ARLesson): boolean {
  try {
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    let lessons: ARLesson[] = localData ? JSON.parse(localData) : [...DEFAULT_LESSONS];
    
    const index = lessons.findIndex(l => l.id === updatedLesson.id);
    if (index !== -1) {
      lessons[index] = updatedLesson;
    } else {
      lessons.push(updatedLesson);
    }
    
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lessons));
    return true;
  } catch (e) {
    console.error('Failed to sync to LocalStorage:', e);
    return false;
  }
}
