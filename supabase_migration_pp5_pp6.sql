-- ==============================================================================
-- สคริปต์ฐานข้อมูล Supabase: ระบบวัดผลและประเมินผล ปพ.5-6 ดิจิทัล (สพฐ.)
-- ไฟล์: supabase_migration_pp5_pp6.sql
-- รูปแบบ Pure SQL คลีน 100% ไม่มีคอมเมนต์ท้ายบรรทัด ป้องกันการตัดคำผิดพลาด
-- ==============================================================================

-- 1. ตารางรายวิชา (Subjects)
CREATE TABLE IF NOT EXISTS subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'พื้นฐาน',
  credits NUMERIC(3, 1) DEFAULT 1.0,
  hours_per_year INTEGER DEFAULT 40,
  class_level TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT subjects_code_class_year_key UNIQUE (code, class_level, academic_year)
);

-- 2. ตารางคะแนนและผลการเรียนรายบุคคล (Student Grades)
CREATE TABLE IF NOT EXISTS student_grades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  semester SMALLINT NOT NULL DEFAULT 1,
  formative1 NUMERIC(5, 2),
  midterm1 NUMERIC(5, 2),
  final1 NUMERIC(5, 2),
  total1 NUMERIC(5, 2),
  formative2 NUMERIC(5, 2),
  midterm2 NUMERIC(5, 2),
  final2 NUMERIC(5, 2),
  total2 NUMERIC(5, 2),
  yearly_total NUMERIC(5, 2),
  grade TEXT DEFAULT '-',
  is_passed BOOLEAN DEFAULT TRUE,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT student_subject_year_key UNIQUE (student_id, subject_id, academic_year)
);

-- 3. ตารางสรุปเวลาเรียนรายภาคเรียน (Student Attendance Summary)
CREATE TABLE IF NOT EXISTS student_attendance_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  semester SMALLINT NOT NULL DEFAULT 1,
  present_days INTEGER DEFAULT 0,
  leave_days INTEGER DEFAULT 0,
  sick_days INTEGER DEFAULT 0,
  absent_days INTEGER DEFAULT 0,
  total_school_days INTEGER DEFAULT 100,
  attendance_percent NUMERIC(5, 2) DEFAULT 100.0,
  has_exam_eligibility BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT student_attendance_year_sem_key UNIQUE (student_id, academic_year, semester)
);

-- 4. ตารางสุขภาพและการเจริญเติบโต (Student Health & Growth)
CREATE TABLE IF NOT EXISTS student_health_growth (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  semester SMALLINT NOT NULL DEFAULT 1,
  age_years SMALLINT,
  weight NUMERIC(5, 2) NOT NULL,
  height NUMERIC(5, 2) NOT NULL,
  bmi NUMERIC(4, 1),
  weight_for_height TEXT,
  height_for_age TEXT,
  weight_for_age TEXT,
  recorded_date DATE DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT student_growth_year_sem_key UNIQUE (student_id, academic_year, semester)
);

-- 5. ตารางประเมินคุณลักษณะอันพึงประสงค์และสมรรถนะ (Student Holistic Assessment)
CREATE TABLE IF NOT EXISTS student_holistic_assessment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  semester SMALLINT NOT NULL DEFAULT 1,
  desirable_traits_score SMALLINT DEFAULT 3,
  competency_score SMALLINT DEFAULT 3,
  reading_writing_eval TEXT DEFAULT 'ดีเยี่ยม',
  learner_activity_passed BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT student_holistic_year_sem_key UNIQUE (student_id, academic_year, semester)
);

-- ==============================================================================
-- นโยบายความปลอดภัย Row Level Security (RLS)
-- ==============================================================================
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_attendance_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_health_growth ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_holistic_assessment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access on subjects" ON subjects;
CREATE POLICY "Enable read access on subjects" ON subjects FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Enable read access on student_grades" ON student_grades;
CREATE POLICY "Enable read access on student_grades" ON student_grades FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Enable read access on student_attendance_summary" ON student_attendance_summary;
CREATE POLICY "Enable read access on student_attendance_summary" ON student_attendance_summary FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Enable read access on student_health_growth" ON student_health_growth;
CREATE POLICY "Enable read access on student_health_growth" ON student_health_growth FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Enable read access on student_holistic_assessment" ON student_holistic_assessment;
CREATE POLICY "Enable read access on student_holistic_assessment" ON student_holistic_assessment FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Enable all access on subjects" ON subjects;
CREATE POLICY "Enable all access on subjects" ON subjects FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access on student_grades" ON student_grades;
CREATE POLICY "Enable all access on student_grades" ON student_grades FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access on student_attendance_summary" ON student_attendance_summary;
CREATE POLICY "Enable all access on student_attendance_summary" ON student_attendance_summary FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access on student_health_growth" ON student_health_growth;
CREATE POLICY "Enable all access on student_health_growth" ON student_health_growth FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access on student_holistic_assessment" ON student_holistic_assessment;
CREATE POLICY "Enable all access on student_holistic_assessment" ON student_holistic_assessment FOR ALL TO public USING (true) WITH CHECK (true);

-- ดัชนีเพิ่มความเร็ว
CREATE INDEX IF NOT EXISTS idx_student_grades_lookup ON student_grades(student_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_subjects_class ON subjects(class_level, academic_year);
