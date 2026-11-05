-- =================================================================================================
-- 🏫 MASTER ALL-IN-ONE DATABASE SETUP SCRIPT FOR NEW SCHOOL (SUPABASE POSTGRESQL)
-- ระบบบริหารจัดการข้อมูลสถานศึกษาอัจฉริยะ (School Admin Multischool)
-- 
-- วัตถุประสงค์: ติดตั้งฐานข้อมูลใหม่สำหรับโรงเรียนใหม่ใน Supabase แยก Instance 100%
-- รันครั้งเดียวจบ ครบทั้ง 53 ตาราง, Triggers, RLS Policies, Storage Buckets, และ Data API GRANTs (Rule J)
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- ส่วนที่ ๑: EXTENSIONS & STORAGE BUCKETS SETUP
-- -------------------------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- สร้าง Storage Buckets สำหรับจัดเก็บไฟล์ในระบบ (เปิด Public Read สำหรับโหลดภาพ/เอกสาร)
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('system', 'system', true),
  ('reports', 'reports', true),
  ('temp_docs', 'temp_docs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies
DROP POLICY IF EXISTS "Public Storage Read" ON storage.objects;
CREATE POLICY "Public Storage Read" ON storage.objects FOR SELECT USING (bucket_id IN ('system', 'reports', 'temp_docs'));

DROP POLICY IF EXISTS "Authenticated Storage Insert" ON storage.objects;
CREATE POLICY "Authenticated Storage Insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('system', 'reports', 'temp_docs'));

DROP POLICY IF EXISTS "Authenticated Storage Update" ON storage.objects;
CREATE POLICY "Authenticated Storage Update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('system', 'reports', 'temp_docs'));

DROP POLICY IF EXISTS "Authenticated Storage Delete" ON storage.objects;
CREATE POLICY "Authenticated Storage Delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('system', 'reports', 'temp_docs'));


-- -------------------------------------------------------------------------------------------------
-- ส่วนที่ ๒: ตาราง PROFILES (บัญชีผู้ใช้งานระบบ) & AUTH TRIGGER
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'teacher', -- admin, director, teacher, guest, student
  status TEXT DEFAULT 'active',
  extra_permissions JSONB DEFAULT '{}',
  signature_url TEXT,
  line_user_id TEXT,
  telegram_chat_id TEXT,
  ai_global_instructions TEXT,
  ai_writing_style TEXT,
  ai_preferred_model TEXT DEFAULT 'gemini-1.5-flash',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger สร้าง profile อัตโนมัติเมื่อมีการสมัครสมาชิกผ่าน Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'teacher')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- -------------------------------------------------------------------------------------------------
-- ส่วนที่ ๓: ตาราง SETTINGS (ข้อมูลอัตลักษณ์สถานศึกษา - 1 โรงเรียน = 1 แถวเสมอ ตาม Rule C)
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  school_name TEXT NOT NULL DEFAULT 'โรงเรียนตัวอย่าง',
  school_address TEXT DEFAULT '',
  school_tax_id TEXT DEFAULT '',
  school_phone TEXT DEFAULT '',
  school_email TEXT DEFAULT '',
  director_name TEXT DEFAULT '',
  director_position TEXT DEFAULT 'ผู้อำนวยการสถานศึกษา',
  deputy_director_name TEXT DEFAULT '',
  saraban_lead_name TEXT DEFAULT '',
  finance_lead_name TEXT DEFAULT '',
  academic_lead_name TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  stamp_url TEXT DEFAULT '',
  current_academic_year TEXT DEFAULT '2569',
  doc_code_prefix TEXT DEFAULT 'ที่ ศธ 04225.xxx/',
  telegram_bot_token TEXT DEFAULT '',
  telegram_bot_username TEXT DEFAULT '',
  telegram_group_id TEXT DEFAULT '',
  telegram_group_link TEXT DEFAULT '',
  line_channel_access_token TEXT DEFAULT '',
  line_channel_secret TEXT DEFAULT '',
  is_line_enabled BOOLEAN DEFAULT true,
  custom_sop TEXT DEFAULT '',
  start_incoming_seq INTEGER DEFAULT 1,
  start_outgoing_seq INTEGER DEFAULT 1,
  start_memo_seq INTEGER DEFAULT 1,
  start_order_seq INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- -------------------------------------------------------------------------------------------------
-- ส่วนที่ ๔: ตาราง TEACHERS & TEACHER_DUTIES (ทะเบียนบุคลากรทางการ)
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id TEXT,
  prefix TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  position TEXT,
  academic_standing TEXT,
  department TEXT,
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.teacher_duties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
  duty_name TEXT NOT NULL,
  academic_year TEXT DEFAULT '2569',
  semester TEXT DEFAULT '1',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- -------------------------------------------------------------------------------------------------
-- ส่วนที่ ๕: ตาราง STUDENTS & SERVICE_AREA_STUDENTS (ทะเบียนนักเรียน)
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year TEXT,
  school_id TEXT,
  school_name TEXT,
  national_id TEXT,
  class_level TEXT,
  room TEXT,
  student_id TEXT,
  gender TEXT,
  prefix TEXT,
  first_name TEXT,
  last_name TEXT,
  birth_date DATE,
  weight NUMERIC,
  height NUMERIC,
  blood_group TEXT,
  religion TEXT,
  ethnicity TEXT,
  nationality TEXT,
  address_no TEXT,
  moo TEXT,
  soi_road TEXT,
  sub_district TEXT,
  district TEXT,
  province TEXT,
  parent_first_name TEXT,
  parent_last_name TEXT,
  parent_occupation TEXT,
  parent_relation TEXT,
  father_first_name TEXT,
  father_last_name TEXT,
  father_occupation TEXT,
  mother_first_name TEXT,
  mother_last_name TEXT,
  mother_occupation TEXT,
  disadvantage_status TEXT,
  graduation_status TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT students_student_id_academic_year_key UNIQUE (student_id, academic_year)
);

CREATE TABLE IF NOT EXISTS public.service_area_students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year TEXT NOT NULL,
  national_id TEXT,
  prefix TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT,
  birth_date DATE,
  address_no TEXT,
  moo TEXT,
  sub_district TEXT,
  district TEXT,
  province TEXT,
  status TEXT DEFAULT 'pending',
  school_enrolled TEXT,
  guardian_name TEXT,
  enroll_class TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- -------------------------------------------------------------------------------------------------
-- ส่วนที่ ๖: ตารางระบบสารบรรณ ๔ สาย (INCOMING, OUTGOING, ORDERS, MEMOS, DOC_ASSIGNMENTS)
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incoming_docs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_year INTEGER DEFAULT 2569,
  doc_sequence INTEGER,
  receive_no TEXT NOT NULL,
  receive_date DATE NOT NULL,
  doc_no TEXT NOT NULL,
  doc_date DATE NOT NULL,
  from_agency TEXT NOT NULL,
  to_agency TEXT NOT NULL,
  subject TEXT NOT NULL,
  practice_type TEXT DEFAULT 'normal',
  urgency TEXT DEFAULT 'normal',
  security TEXT DEFAULT 'normal',
  file_url TEXT,
  stamped_pdf_url TEXT,
  note TEXT,
  status TEXT DEFAULT 'pending',
  extracted_text TEXT,
  action_deadline TIMESTAMPTZ,
  suggested_assignee_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  auto_processed_at TIMESTAMPTZ,
  is_reserved BOOLEAN DEFAULT false,
  reserved_by_telegram_id TEXT,
  reserved_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.outgoing_docs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_year INTEGER DEFAULT 2569,
  doc_sequence INTEGER,
  doc_no TEXT NOT NULL,
  doc_date DATE NOT NULL,
  to_agency TEXT NOT NULL,
  subject TEXT NOT NULL,
  sender_name TEXT,
  file_url TEXT,
  urgency TEXT DEFAULT 'normal',
  security TEXT DEFAULT 'normal',
  note TEXT,
  is_reserved BOOLEAN DEFAULT false,
  reserved_by_telegram_id TEXT,
  reserved_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_year INTEGER DEFAULT 2569,
  doc_sequence INTEGER,
  order_no TEXT NOT NULL,
  order_date DATE NOT NULL,
  title TEXT NOT NULL,
  signatory_name TEXT,
  file_url TEXT,
  note TEXT,
  is_reserved BOOLEAN DEFAULT false,
  reserved_by_telegram_id TEXT,
  reserved_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.memos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_year INTEGER DEFAULT 2569,
  doc_sequence INTEGER,
  memo_no TEXT NOT NULL,
  memo_date DATE NOT NULL,
  from_person TEXT NOT NULL,
  to_person TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  is_reserved BOOLEAN DEFAULT false,
  reserved_by_telegram_id TEXT,
  reserved_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.doc_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_id UUID REFERENCES public.incoming_docs(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  comment TEXT,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);


-- -------------------------------------------------------------------------------------------------
-- ส่วนที่ ๗: ตารางระบบการออกเลขสารบรรณมาตรฐานรวมศูนย์ & รายงานประจำปี
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_number_series (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_type TEXT NOT NULL,
  year_be INTEGER NOT NULL,
  prefix TEXT DEFAULT '',
  suffix TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.document_number_counters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  series_id UUID REFERENCES public.document_number_series(id) ON DELETE CASCADE,
  current_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.document_number_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  series_id UUID REFERENCES public.document_number_series(id) ON DELETE CASCADE,
  allocated_number INTEGER NOT NULL,
  allocated_to TEXT NOT NULL,
  doc_subject TEXT,
  channel TEXT DEFAULT 'web',
  status TEXT DEFAULT 'allocated',
  allocated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.annual_saraban_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year_be INTEGER NOT NULL,
  report_type TEXT NOT NULL,
  total_count INTEGER DEFAULT 0,
  details JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT NOW()
);


-- -------------------------------------------------------------------------------------------------
-- ส่วนที่ ๘: ตารางวิชาการ, วัดผล ปพ.๕/ปพ.๖, และ SCHOOL MIS
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_code TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  class_level TEXT NOT NULL,
  academic_year TEXT DEFAULT '2569',
  semester TEXT DEFAULT '1',
  credit NUMERIC(3, 1) DEFAULT 1.0,
  total_hours INTEGER DEFAULT 40,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_grades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  semester TEXT NOT NULL,
  formative1 NUMERIC(5, 2),
  midterm NUMERIC(5, 2),
  formative2 NUMERIC(5, 2),
  final NUMERIC(5, 2),
  total_score NUMERIC(5, 2),
  grade TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT student_grades_unique_key UNIQUE (student_id, subject_id, academic_year, semester)
);

CREATE TABLE IF NOT EXISTS public.student_attendance_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  semester TEXT NOT NULL,
  present_days INTEGER DEFAULT 0,
  absent_days INTEGER DEFAULT 0,
  leave_days INTEGER DEFAULT 0,
  total_days INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_health_growth (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  weight NUMERIC(5, 2),
  height NUMERIC(5, 2),
  recorded_at DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS public.student_holistic_assessment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  character_assessment TEXT DEFAULT 'ดีเยี่ยม',
  reading_writing_thinking TEXT DEFAULT 'ดีเยี่ยม',
  activities_passed BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- -------------------------------------------------------------------------------------------------
-- ส่วนที่ ๙: ตารางแผนงาน, งบประมาณ และจัดซื้อจัดจ้าง V3
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budget_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year TEXT NOT NULL,
  budget_type TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  allocated_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.school_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year TEXT NOT NULL,
  project_name TEXT NOT NULL,
  allocated_budget NUMERIC(12, 2) DEFAULT 0,
  spent_budget NUMERIC(12, 2) DEFAULT 0,
  responsible_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'in_progress',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.budget_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year TEXT NOT NULL,
  from_project_id UUID REFERENCES public.school_projects(id) ON DELETE CASCADE,
  to_project_id UUID REFERENCES public.school_projects(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  transfer_date DATE DEFAULT CURRENT_DATE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_name TEXT NOT NULL,
  tax_id TEXT,
  phone TEXT,
  address TEXT,
  bank_name TEXT,
  bank_account_no TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.procurement_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year TEXT NOT NULL,
  project_name TEXT NOT NULL,
  budget_amount NUMERIC(12, 2) NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.procurement_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.procurement_projects(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL,
  unit TEXT NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  total_price NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- จัดซื้อจัดจ้างเวอร์ชัน ๓ (Procurement Clean V3)
CREATE TABLE IF NOT EXISTS public.procurement_cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number TEXT,
  case_title TEXT NOT NULL,
  budget_year INTEGER DEFAULT 2569,
  procurement_method TEXT DEFAULT 'เฉพาะเจาะจง',
  estimated_cost NUMERIC(12, 2) DEFAULT 0,
  contract_amount NUMERIC(12, 2) DEFAULT 0,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  current_status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.procurement_case_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.procurement_cases(id) ON DELETE CASCADE,
  item_description TEXT NOT NULL,
  quantity NUMERIC(10, 2) DEFAULT 1,
  unit_name TEXT DEFAULT 'รายการ',
  unit_cost NUMERIC(12, 2) DEFAULT 0,
  total_cost NUMERIC(12, 2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.procurement_case_milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.procurement_cases(id) ON DELETE CASCADE,
  milestone_name TEXT NOT NULL,
  target_date DATE,
  completed_date DATE,
  status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS public.procurement_case_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.procurement_cases(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  performed_by TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- -------------------------------------------------------------------------------------------------
-- ส่วนที่ ๑๐: ตารางสินทรัพย์ครุภัณฑ์ & คลังวัสดุสิ้นเปลือง
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asset_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_code TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  category TEXT,
  acquisition_date DATE,
  acquisition_cost NUMERIC(12, 2) DEFAULT 0,
  current_condition TEXT DEFAULT 'ใช้งานได้ปกติ',
  room_location TEXT,
  responsible_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplies_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_code TEXT,
  item_name TEXT NOT NULL,
  unit_name TEXT NOT NULL,
  stock_quantity NUMERIC(10, 2) DEFAULT 0,
  min_reorder_level NUMERIC(10, 2) DEFAULT 5,
  unit_cost NUMERIC(10, 2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplies_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supply_id UUID REFERENCES public.supplies_inventory(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- in, out
  quantity NUMERIC(10, 2) NOT NULL,
  requester_name TEXT,
  note TEXT,
  transaction_date TIMESTAMPTZ DEFAULT NOW()
);


-- -------------------------------------------------------------------------------------------------
-- ส่วนที่ ๑๑: ตารางการปฏิบัติงานสถานศึกษา (ATTENDANCE, WFH, UTILITIES, LIBRARY)
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
  check_date DATE NOT NULL,
  status TEXT DEFAULT 'present',
  time_in TIME,
  time_out TIME,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wfh_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
  wfh_date DATE NOT NULL,
  tasks_done TEXT,
  file_proof_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.utilities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  utility_type TEXT NOT NULL, -- water, electricity, internet
  bill_month TEXT NOT NULL,
  bill_amount NUMERIC(10, 2) NOT NULL,
  units_used NUMERIC(10, 2),
  requester_name TEXT,
  requester_position TEXT,
  payment_status TEXT DEFAULT 'pending',
  receipt_file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.utility_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  utility_id UUID REFERENCES public.utilities(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.library_books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_code TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  category TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.library_borrow (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID REFERENCES public.library_books(id) ON DELETE CASCADE,
  borrower_type TEXT DEFAULT 'student',
  borrower_id UUID,
  borrow_date DATE DEFAULT CURRENT_DATE,
  due_date DATE DEFAULT (CURRENT_DATE + 7),
  return_date DATE,
  status TEXT DEFAULT 'borrowed'
);

CREATE TABLE IF NOT EXISTS public.library_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usage_date DATE DEFAULT CURRENT_DATE,
  total_visitors INTEGER DEFAULT 0,
  notes TEXT
);


-- -------------------------------------------------------------------------------------------------
-- ส่วนที่ ๑๒: ตารางงานกีฬาและกิจกรรมนักเรียน (ATHLETICS)
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.athletics_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year TEXT DEFAULT '2569',
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  sport_category TEXT NOT NULL,
  sub_category TEXT,
  age_group TEXT,
  is_substitute BOOLEAN DEFAULT false,
  competition_type TEXT DEFAULT 'local',
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- -------------------------------------------------------------------------------------------------
-- ส่วนที่ ๑๓: ตารางคลังปัญญา AI, RAG VECTOR & LESSON PLANS
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_name TEXT NOT NULL,
  description TEXT,
  prompt_template TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_knowledge_base (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  embedding vector(3072),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.school_knowledge (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_file TEXT,
  embedding vector(3072),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_private_knowledge_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_title TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER DEFAULT 0,
  embedding vector(3072),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lesson_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
  subject_code TEXT NOT NULL,
  unit_name TEXT NOT NULL,
  plan_file_url TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lesson_plan_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
  log_type TEXT,
  log_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ar_lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_title TEXT NOT NULL,
  target_grade TEXT,
  marker_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ar_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES public.ar_lessons(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  instruction TEXT,
  model_3d_url TEXT
);

CREATE TABLE IF NOT EXISTS public.document_checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_type TEXT NOT NULL,
  item_text TEXT NOT NULL,
  is_mandatory BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 1
);


-- -------------------------------------------------------------------------------------------------
-- ส่วนที่ ๑๔: ตารางแจ้งเตือนและการสื่อสาร (TELEGRAM, LINE & SESSIONS)
-- -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telegram_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id TEXT NOT NULL UNIQUE,
  chat_title TEXT,
  chat_type TEXT DEFAULT 'group',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.line_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_user_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.line_action_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  session_data JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- -------------------------------------------------------------------------------------------------
-- ส่วนที่ ๑๕: การเปิดใช้งาน ROW LEVEL SECURITY (RLS) ครบทุกตาราง
-- -------------------------------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
  END LOOP;
END $$;

-- สร้าง Policies พื้นฐาน: Authenticated Users เข้าถึงข้อมูลได้เต็มรูปแบบ, Anon อ่านเฉพาะจุดที่จำเป็น
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated Manage ' || r.tablename || '" ON public.' || quote_ident(r.tablename) || ';';
    EXECUTE 'CREATE POLICY "Authenticated Manage ' || r.tablename || '" ON public.' || quote_ident(r.tablename) || ' TO authenticated USING (true) WITH CHECK (true);';
    
    EXECUTE 'DROP POLICY IF EXISTS "Service Role Manage ' || r.tablename || '" ON public.' || quote_ident(r.tablename) || ';';
    EXECUTE 'CREATE POLICY "Service Role Manage ' || r.tablename || '" ON public.' || quote_ident(r.tablename) || ' TO service_role USING (true) WITH CHECK (true);';
  END LOOP;
END $$;

-- นโยบายพิเศษสำหรับ settings, school_knowledge และ profiles
DROP POLICY IF EXISTS "Anon Read Settings" ON public.settings;
CREATE POLICY "Anon Read Settings" ON public.settings FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Anon Read Knowledge" ON public.school_knowledge;
CREATE POLICY "Anon Read Knowledge" ON public.school_knowledge FOR SELECT TO anon USING (true);


-- -------------------------------------------------------------------------------------------------
-- ส่วนที่ ๑๖: สิทธิ์ DATA API EXPLICIT GRANT (RULE J - SUPABASE POST-OCTOBER 30 REQUIREMENT)
-- -------------------------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;


-- -------------------------------------------------------------------------------------------------
-- ส่วนที่ ๑๗: ข้อมูลเริ่มต้นประจำสถานศึกษา (DEFAULT SETTINGS INITIALIZATION ROW)
-- -------------------------------------------------------------------------------------------------
INSERT INTO public.settings (
  id,
  school_name,
  school_address,
  director_name,
  director_position,
  doc_code_prefix,
  current_academic_year,
  start_incoming_seq,
  start_outgoing_seq,
  start_memo_seq,
  start_order_seq
)
VALUES (
  'default',
  'โรงเรียนใหม่ตัวอย่าง',
  'ตำบล... อำเภอ... จังหวัด... รหัสไปรษณีย์...',
  'นาย/นาง/นางสาว...',
  'ผู้อำนวยการสถานศึกษา',
  'ที่ ศธ 04225.xxx/',
  '2569',
  1,
  1,
  1,
  1
)
ON CONFLICT (id) DO NOTHING;

-- สำเร็จเรียบร้อย!