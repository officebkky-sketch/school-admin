-- 1. Profiles Table (Extended User Info)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'guest', -- admin, director, teacher, guest, student
  status TEXT DEFAULT 'active',
  extra_permissions JSONB DEFAULT '{}',
  signature_url TEXT,
  line_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Students Table
CREATE TABLE students (
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

-- 3. Incoming Documents (หนังสือรับ)
CREATE TABLE incoming_docs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_number TEXT,
  from_agency TEXT,
  to_agency TEXT,
  subject TEXT,
  doc_date DATE,
  urgency TEXT,
  secrecy TEXT,
  doc_type TEXT,
  action_required TEXT,
  remark TEXT,
  file_url TEXT,
  attachment_urls JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending',
  ai_status TEXT,
  ai_suggestion TEXT,
  ai_score TEXT,
  doc_year INTEGER,
  doc_sequence INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users
);

-- 4. Outgoing Documents (หนังสือส่ง)
CREATE TABLE outgoing_docs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_number TEXT,
  from_agency TEXT,
  to_agency TEXT,
  subject TEXT,
  doc_date DATE,
  urgency TEXT,
  secrecy TEXT,
  sender_name TEXT,
  remark TEXT,
  file_url TEXT,
  status TEXT DEFAULT 'pending',
  doc_year INTEGER,
  doc_sequence INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users
);

-- 5. Orders (คำสั่ง)
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT,
  subject TEXT,
  issuer TEXT,
  order_date DATE,
  secrecy TEXT,
  remark TEXT,
  file_url TEXT,
  status TEXT DEFAULT 'pending',
  doc_year INTEGER,
  doc_sequence INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users
);

-- 6. Memos (บันทึกข้อความ)
CREATE TABLE memos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  memo_number TEXT,
  subject TEXT,
  requester TEXT,
  department TEXT,
  memo_date DATE,
  urgency TEXT,
  secrecy TEXT,
  remark TEXT,
  file_url TEXT,
  status TEXT DEFAULT 'pending',
  doc_year INTEGER,
  doc_sequence INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users
);

-- 7. Attendance Table
CREATE TABLE attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE,
  class_level TEXT,
  attendance_data JSONB, -- list of students and statuses
  summary JSONB, -- count of present, absent, etc.
  teacher_id UUID REFERENCES auth.users,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. WFH Logs
CREATE TABLE wfh_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  log_type TEXT, -- in, out
  location TEXT,
  details TEXT,
  gps TEXT,
  status TEXT DEFAULT 'active'
);

-- 9. Library Books
CREATE TABLE library_books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id TEXT UNIQUE,
  title TEXT,
  category TEXT,
  author TEXT,
  total_qty INTEGER DEFAULT 1,
  available_qty INTEGER DEFAULT 1,
  added_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'available'
);

-- 10. Library Borrow
CREATE TABLE library_borrow (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  borrow_date DATE DEFAULT CURRENT_DATE,
  book_id UUID REFERENCES library_books,
  borrower_id UUID, -- Can be student_id or user_id
  borrower_name TEXT,
  return_date DATE,
  status TEXT DEFAULT 'borrowing', -- borrowing, returned
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Library Usage Logs
CREATE TABLE library_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  time_in TIME DEFAULT CURRENT_TIME,
  time_out TIME,
  user_id UUID,
  student_id TEXT,
  name TEXT,
  level TEXT,
  purpose TEXT,
  notes TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 12. System Settings
CREATE TABLE settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_name TEXT,
  school_address TEXT,
  director_name TEXT,
  current_academic_year TEXT DEFAULT '2568',
  current_term TEXT DEFAULT '1',
  school_logo_url TEXT,
  phone_number TEXT,
  local_gov_name TEXT,
  line_channel_access_token TEXT,
  line_group_id TEXT,
  gemini_api_key TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Teachers Table
CREATE TABLE teachers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prefix TEXT,
  first_name TEXT,
  last_name TEXT,
  position TEXT,
  department TEXT,
  phone TEXT,
  email TEXT,
  photo_url TEXT,
  line_user_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Teacher Duties Table
CREATE TABLE teacher_duties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES teachers ON DELETE CASCADE,
  duty_day TEXT, -- Monday, Tuesday, ...
  duty_type TEXT DEFAULT 'เวรประจำวัน',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Document Assignments (ระบบติดตามงาน)
CREATE TABLE doc_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_id UUID REFERENCES incoming_docs ON DELETE CASCADE,
  assignee_id UUID REFERENCES teachers ON DELETE CASCADE,
  instruction TEXT,
  status TEXT DEFAULT 'pending', -- pending, acknowledged, completed, closed
  staff_report TEXT,
  report_file_urls JSONB DEFAULT '[]',
  reported_at TIMESTAMPTZ,
  director_feedback TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) - Basic Setup
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Settings are viewable by everyone." ON settings FOR SELECT USING (true);
CREATE POLICY "Only admins can update settings." ON settings FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- ==========================================
-- AI COWORK MODULE (เพิ่มใหม่ มค 69)
-- ==========================================

-- 1. อัปเดตตารางโปรไฟล์เพื่อเก็บคำสั่งหลัก (Global Instructions)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_global_instructions TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_writing_style TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_preferred_model TEXT DEFAULT 'gemini-1.5-flash';

-- 2. ตารางเก็บทักษะเฉพาะทางของครู (AI Skills)
CREATE TABLE IF NOT EXISTS ai_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,          -- เช่น "ตรวจงานตามรูบริค", "ร่างแผนการสอน"
  description TEXT,                  -- รายละเอียดสั้นๆ ของทักษะ
  system_prompt TEXT NOT NULL,      -- คำสั่งเบื้องหลัง (System Instruction)
  required_folders TEXT[],          -- รายชื่อโฟลเดอร์ที่ต้องดึงมาอ่าน (เช่น ['01', '05'])
  is_public BOOLEAN DEFAULT FALSE,   -- แชร์ให้ครูคนอื่นใช้ได้หรือไม่
  icon_name TEXT DEFAULT 'Zap',      -- ไอคอนที่จะแสดงใน UI
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ตารางเก็บคลังความรู้ (AI Knowledge Base / Virtual Drive)
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  folder_id TEXT NOT NULL,           -- รหัสโฟลเดอร์ (00, 01, 02, ..., 08, 99)
  folder_name TEXT NOT NULL,         -- ชื่อโฟลเดอร์ตามมาตรฐาน (เช่น 02-แผนการสอน)
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,            -- ลิงก์ไปยัง Supabase Storage
  file_type TEXT,                    -- pdf, docx, md, txt
  content_text TEXT,                 -- ข้อความที่สกัดจากไฟล์ สำหรับให้ AI อ่านเร็วๆ
  is_shared BOOLEAN DEFAULT FALSE,   -- ผอ. หรือหัวหน้าฝ่ายวิชาการ เห็นได้หรือไม่
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ตั้งค่า RLS (Row Level Security) เพื่อความเป็นส่วนตัว
ALTER TABLE ai_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;

-- กฎสำหรับ ai_skills
CREATE POLICY "Users can manage their own skills" 
ON ai_skills FOR ALL 
USING (auth.uid() = teacher_id);

CREATE POLICY "Users can view public skills" 
ON ai_skills FOR SELECT 
USING (is_public = TRUE);

-- กฎสำหรับ ai_knowledge_base
CREATE POLICY "Users can manage their own knowledge files" 
ON ai_knowledge_base FOR ALL 
USING (auth.uid() = teacher_id);

CREATE POLICY "Directors can view shared files" 
ON ai_knowledge_base FOR SELECT 
USING (
  is_shared = TRUE AND 
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('director', 'admin')
);

-- อินเด็กซ์เพื่อความรวดเร็ว
CREATE INDEX IF NOT EXISTS idx_ai_skills_teacher ON ai_skills(teacher_id);
CREATE INDEX IF NOT EXISTS idx_ai_kb_teacher ON ai_knowledge_base(teacher_id);
CREATE INDEX IF NOT EXISTS idx_ai_kb_folder ON ai_knowledge_base(folder_id);

-- 15.5 Line Action States Table (สำหรับบอท LINE)
CREATE TABLE line_action_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,          -- LINE userId
  action TEXT NOT NULL,           -- e.g., 'awaiting_instruction', 'awaiting_teacher_select'
  context JSONB DEFAULT '{}',     -- Context data (doc_id, teacher_id, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes')
);

-- 16. Utility Bills (ระบบเบิกค่าสาธารณูปโภค)
CREATE TABLE IF NOT EXISTS utilities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL, -- electricity, water, telephone, internet
  academic_year TEXT,
  month TEXT,
  amount NUMERIC(10, 2),
  invoice_number TEXT,
  bill_date DATE,
  budget_source TEXT,
  status TEXT DEFAULT 'pending',
  remark TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users
);

ALTER TABLE utilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view utilities" ON utilities FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage utilities" ON utilities FOR ALL USING (auth.uid() = created_by);

-- Update Utilities to support units and multiple items
ALTER TABLE utilities ADD COLUMN IF NOT EXISTS units_used NUMERIC(10, 2);

CREATE TABLE IF NOT EXISTS utility_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  utility_id UUID REFERENCES utilities(id) ON DELETE CASCADE,
  meter_number TEXT,
  receipt_number TEXT,
  units_used NUMERIC(10, 2),
  amount NUMERIC(10, 2),
  book_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE utility_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view utility_items" ON utility_items FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage utility_items" ON utility_items FOR ALL USING (auth.uid() IN (SELECT created_by FROM utilities WHERE id = utility_id));

-- Add requester info to utilities
ALTER TABLE utilities ADD COLUMN IF NOT EXISTS requester_name TEXT;
ALTER TABLE utilities ADD COLUMN IF NOT EXISTS requester_position TEXT;

-- ==========================================
-- PHASE 2: SMART FINANCE & PROCUREMENT
-- ==========================================

-- 1. แหล่งงบประมาณหลัก (Budget Sources)
CREATE TABLE IF NOT EXISTS budget_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year TEXT NOT NULL,
  budget_type TEXT NOT NULL, -- งบอุดหนุน, งบรายได้สถานศึกษา, งบอาหารกลางวัน
  category_name TEXT NOT NULL, -- ชื่อแหล่งเงิน
  amount NUMERIC(15, 2) DEFAULT 0,
  spent_amount NUMERIC(15, 2) DEFAULT 0,
  remaining_amount NUMERIC(15, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users
);

-- 1.1 โครงการตามแผนปฏิบัติการ (School Projects)
CREATE TABLE IF NOT EXISTS school_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_name TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  budget_id UUID REFERENCES budget_allocations(id), -- เชื่อมกับแหล่งเงิน
  planned_amount NUMERIC(15, 2) DEFAULT 0, -- งบตามแผน
  current_amount NUMERIC(15, 2) DEFAULT 0, -- งบปัจจุบัน (หลังถัวจ่าย)
  spent_amount NUMERIC(15, 2) DEFAULT 0,
  responsible_person UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'active', -- active, closed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ลบโครงสร้างเดิมเพื่อจัดลำดับใหม่
DROP TABLE IF EXISTS procurement_items CASCADE;
DROP TABLE IF EXISTS procurement_projects CASCADE;
DROP TABLE IF EXISTS budget_transfers CASCADE;
DROP TABLE IF EXISTS school_projects CASCADE;

-- 1. สร้างตารางโครงการ (School Projects)
CREATE TABLE school_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_name TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  budget_id UUID REFERENCES budget_allocations(id),
  planned_amount NUMERIC(15, 2) DEFAULT 0,
  current_amount NUMERIC(15, 2) DEFAULT 0,
  spent_amount NUMERIC(15, 2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users
);

-- 2. สร้างตารางถัวจ่ายเงิน (Budget Transfers)
CREATE TABLE budget_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_project_id UUID REFERENCES school_projects(id),
  to_project_id UUID REFERENCES school_projects(id),
  amount NUMERIC(15, 2) NOT NULL,
  reason TEXT,
  transfer_date DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 Vendors Table (ร้านค้า/คู่สัญญา)
CREATE TABLE vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_name TEXT NOT NULL,
  address TEXT,
  tax_id TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. สร้างตารางจัดซื้อจัดจ้าง (Procurement Tasks)
CREATE TABLE procurement_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES school_projects(id),
  vendor_id UUID REFERENCES vendors(id),
  project_name TEXT NOT NULL, -- ชื่อรายการซื้อ/จ้าง
  academic_year TEXT NOT NULL,
  method TEXT, -- เฉพาะเจาะจง, e-bidding
  procurement_type TEXT, -- ซื้อ, จ้าง, เช่า
  total_amount NUMERIC(15, 2),
  status TEXT DEFAULT 'draft',
  ref_doc_number TEXT,
  contract_number TEXT,
  order_date DATE,
  receive_date DATE,
  officer_id UUID, -- เจ้าหน้าที่พัสดุ
  head_officer_id UUID, -- หัวหน้าเจ้าหน้าที่
  inspector_id UUID, -- ประธานกรรมการ/ผู้ตรวจรับ
  committee_json JSONB, -- รายชื่อกรรมการเพิ่มเติม (Array)
  vendor_info JSONB, -- ข้อมูลผู้ขาย (name, address, tax_id)
  ai_check_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users
);

-- 4. สร้างตารางรายการสินค้า (Procurement Items)
CREATE TABLE procurement_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  procurement_id UUID REFERENCES procurement_projects(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity NUMERIC(10, 2),
  unit TEXT,
  price_per_unit NUMERIC(15, 2),
  total_price NUMERIC(15, 2),
  is_asset BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- เปิดใช้งานระบบความปลอดภัย (RLS)
ALTER TABLE school_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_items ENABLE ROW LEVEL SECURITY;

-- สร้าง Policies
CREATE POLICY "Everyone can view projects" ON school_projects FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage projects" ON school_projects FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Everyone can view transfers" ON budget_transfers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage transfers" ON budget_transfers FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Everyone can view procurement" ON procurement_projects FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage procurement" ON procurement_projects FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Everyone can view items" ON procurement_items FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage items" ON procurement_items FOR ALL USING (auth.uid() IS NOT NULL);


-- ==========================================
-- 17. Dashboard Stats RPC Function
-- ==========================================
CREATE OR REPLACE FUNCTION get_dashboard_stats(target_year TEXT, today_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  v_total_students INT;
  v_incoming_today INT;
  v_present_today INT;
BEGIN
  -- 1. นับจำนวนนักเรียนปัจจุบัน
  SELECT COUNT(*) INTO v_total_students
  FROM students
  WHERE academic_year = target_year 
    AND (graduation_status ILIKE '%กำลังศึกษา%' OR graduation_status = 'ปกติ');

  -- 2. นับหนังสือรับวันนี้
  SELECT COUNT(*) INTO v_incoming_today
  FROM incoming_docs
  WHERE doc_date = today_date;

  -- 3. รวมจำนวนนักเรียนที่มาเรียนวันนี้จากตารางบันทึกเวลาเรียน
  SELECT COALESCE(SUM((summary->>'present')::int), 0) INTO v_present_today
  FROM attendance
  WHERE date = today_date;

  -- 4. จัดรูปแบบผลลัพธ์เป็น JSON Object
  result := jsonb_build_object(
    'total_students', v_total_students,
    'incoming_today', v_incoming_today,
    'present_today', v_present_today
  );

  RETURN result;
END;
$$;


-- =====================================================================
-- DATABASE ACCESS SECURITY & RLS POLICIES FOR 13 TABLES + VENDORS + LINE STATES
-- =====================================================================

-- 1. Students Table (ข้อมูลนักเรียน)
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff to view students" ON students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role IN ('teacher', 'director', 'admin')
    )
  );

CREATE POLICY "Allow authorized staff to manage students" ON students
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_student_affairs')::boolean = true)
      )
    )
  );

-- 2. Teachers Table (ข้อมูลครู)
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view teachers" ON teachers
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authorized staff to manage teachers" ON teachers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_hr')::boolean = true)
      )
    )
  );

-- 3. Incoming Documents (หนังสือรับ)
ALTER TABLE incoming_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authorized staff to view incoming docs" ON incoming_docs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_administrative')::boolean = true)
      )
    )
  );

CREATE POLICY "Allow authorized staff to manage incoming docs" ON incoming_docs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_administrative')::boolean = true)
      )
    )
  );

-- 4. Outgoing Documents (หนังสือส่ง)
ALTER TABLE outgoing_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authorized staff to view outgoing docs" ON outgoing_docs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_administrative')::boolean = true)
      )
    )
  );

CREATE POLICY "Allow authorized staff to manage outgoing docs" ON outgoing_docs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_administrative')::boolean = true)
      )
    )
  );

-- 5. Orders Table (คำสั่ง)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff to view orders" ON orders
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow director/admin to manage orders" ON orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role IN ('director', 'admin')
    )
  );

-- 6. Memos Table (บันทึกข้อความ)
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff to view memos" ON memos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow owners and admin/director to manage memos" ON memos
  FOR ALL USING (
    auth.uid() = created_by 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role IN ('director', 'admin')
    )
  );

-- 7. Attendance Table (บันทึกเวลาเรียน)
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff to view attendance" ON attendance
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow teachers and student affairs to manage attendance" ON attendance
  FOR ALL USING (
    auth.uid() = teacher_id 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_student_affairs')::boolean = true)
      )
    )
  );

-- 8. WFH Logs Table (ลงเวลาปฏิบัติงาน WFH)
ALTER TABLE wfh_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to view own logs, staff to view all" ON wfh_logs
  FOR SELECT USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_hr')::boolean = true)
      )
    )
  );

CREATE POLICY "Allow users to manage own WFH logs" ON wfh_logs
  FOR ALL USING (auth.uid() = user_id);

-- 9. Library Books Table (หนังสือห้องสมุด)
ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view books" ON library_books
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow academic staff to manage books" ON library_books
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_academic')::boolean = true)
      )
    )
  );

-- 10. Library Borrow Table (การยืม-คืนหนังสือ)
ALTER TABLE library_borrow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view borrow logs" ON library_borrow
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow academic staff to manage borrow logs" ON library_borrow
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_academic')::boolean = true)
      )
    )
  );

-- 11. Library Usage Logs (บันทึกเข้าใช้ห้องสมุด)
ALTER TABLE library_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view usage logs" ON library_usage_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow academic staff to manage usage logs" ON library_usage_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_academic')::boolean = true)
      )
    )
  );

-- 12. Teacher Duties Table (เวรครูประจำวัน)
ALTER TABLE teacher_duties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view teacher duties" ON teacher_duties
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow hr staff to manage teacher duties" ON teacher_duties
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_hr')::boolean = true)
      )
    )
  );

-- 13. Document Assignments (ระบบสั่งการ/ติดตามงาน)
ALTER TABLE doc_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view assignments" ON doc_assignments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authorized staff to manage assignments" ON doc_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_administrative')::boolean = true)
      )
    )
  );

-- 14. Vendors Table (ร้านค้า/คู่สัญญา)
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view vendors" ON vendors
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage vendors" ON vendors
  FOR ALL USING (auth.uid() IS NOT NULL);

-- 15. Line Action States Table (สำหรับบอท LINE)
ALTER TABLE line_action_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to line_action_states" ON line_action_states
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==========================================================
-- 🛠️ AUTOMATIC USER PROFILE CREATION & ADMIN ACCESS CONTROL (เพิ่มเติม)
-- ==========================================================

-- 1. สร้าง Function คัดลอกข้อมูลเมื่อมีผู้สมัครสมาชิกใหม่
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, role, status)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email,
    'guest',
    'active'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. สร้าง Trigger เพื่อผูกเหตุการณ์สมัครสมาชิกใหม่เข้ากับฟังก์ชันข้างต้น
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. สร้างฟังก์ชันเช็คสิทธิ์แอดมิน เพื่อป้องกันปัญหา Recursion ในระบบ RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. สร้างนโยบาย RLS ให้ Admin สามารถอัปเดตข้อมูลโปรไฟล์ของทุกคนได้
CREATE POLICY "Admins can update all profiles." ON profiles
  FOR UPDATE
  USING (public.is_admin());


-- ==========================================================
-- 📍 โมดูลเด็กในเขตพื้นที่บริการ (ทร.14/พฐ.03) - เพิ่มเติม 2026
-- ==========================================================

-- 1. ตารางเก็บข้อมูลเด็กในเขตพื้นที่บริการ
CREATE TABLE IF NOT EXISTS public.service_area_students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id TEXT NOT NULL,                   -- รองรับระบบ Multi-school แยกรายโรงเรียน
  national_id TEXT NOT NULL,                -- เลขประจำตัวประชาชน 13 หลัก
  prefix TEXT,                              -- คำนำหน้า (เด็กชาย / เด็กหญิง)
  first_name TEXT NOT NULL,                 -- ชื่อจริง
  last_name TEXT NOT NULL,                  -- นามสกุล
  gender TEXT,                              -- เพศ (ชาย / หญิง)
  birth_date DATE,                          -- วันเกิด (YYYY-MM-DD)
  age INTEGER,                              -- อายุ
  nationality TEXT DEFAULT 'ไทย',            -- สัญชาติ
  house_id TEXT,                            -- เลขรหัสประจำบ้าน
  house_no TEXT,                            -- บ้านเลขที่
  moo TEXT,                                 -- หมู่ที่
  sub_district TEXT,                        -- ตำบล
  district TEXT,                            -- อำเภอ
  province TEXT,                            -- จังหวัด
  father_name TEXT,                         -- ชื่อ-นามสกุลบิดา
  father_nationality TEXT DEFAULT 'ไทย',     -- สัญชาติบิดา
  mother_name TEXT,                         -- ชื่อ-นามสกุลมารดา
  mother_nationality TEXT DEFAULT 'ไทย',     -- สัญชาติมารดา
  move_in_date DATE,                        -- วันที่ย้ายเข้า (ถ้ามี)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. สร้าง Index เพื่อเพิ่มความเร็วในการสืบค้นข้อมูลรายโรงเรียนและตามเลขบัตรประชาชน
CREATE INDEX IF NOT EXISTS idx_service_area_school ON public.service_area_students(school_id);
CREATE INDEX IF NOT EXISTS idx_service_area_national_id ON public.service_area_students(national_id);

-- 3. เปิดใช้งาน Row Level Security (RLS) เพื่อความปลอดภัย
ALTER TABLE public.service_area_students ENABLE ROW LEVEL SECURITY;

-- 4. สร้างนโยบายการเข้าใช้งาน RLS ให้กับผู้ใช้งานที่ผ่านการยืนยันสิทธิ์แล้ว
CREATE POLICY "Allow authenticated users to manage service area students" ON public.service_area_students
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ==========================================================
-- 🎮 โมดูลด่านสื่อการเรียนรู้ AR (น้องชบาพาพิชิต) - เพิ่มเติม
-- ==========================================================

-- 1. ตารางบทเรียน AR
CREATE TABLE IF NOT EXISTS public.ar_lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ตารางขั้นตอนในบทเรียน AR
CREATE TABLE IF NOT EXISTS public.ar_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES public.ar_lessons(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_text TEXT NOT NULL,
  emoji TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. เปิดใช้งาน Row Level Security (RLS)
ALTER TABLE public.ar_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_steps ENABLE ROW LEVEL SECURITY;

-- 4. สร้างนโยบายการใช้งาน RLS สำหรับ ar_lessons
CREATE POLICY "Allow select for all authenticated users" ON public.ar_lessons
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow manage for creator and admin" ON public.ar_lessons
  FOR ALL USING (auth.uid() IS NOT NULL);

-- 5. สร้างนโยบายการใช้งาน RLS สำหรับ ar_steps
CREATE POLICY "Allow select for all authenticated users" ON public.ar_steps
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow manage for all authenticated users" ON public.ar_steps
  FOR ALL USING (auth.uid() IS NOT NULL);


-- ==========================================================
-- 🧠 คลังสมองส่วนกลางโรงเรียน (Central RAG Knowledge Base)
-- ==========================================================

-- 1. เปิดการใช้งานส่วนขยาย pgvector สำหรับประมวลผล Semantic Vector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. ตารางเก็บข้อมูล Chunk ของเอกสารและเวกเตอร์ความรู้ (Embedding)
CREATE TABLE IF NOT EXISTS public.school_knowledge (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_name TEXT NOT NULL,
  page_number INTEGER,
  chunk_text TEXT NOT NULL,
  embedding vector(768),                         -- เวกเตอร์ขนาด 768 มิติ สำหรับรุ่น gemini-embedding-2
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. วิวสำหรับดึงรายชื่อเอกสารคลังสมองส่วนกลางที่ไม่ซ้ำ (Unique Knowledge Documents)
CREATE OR REPLACE VIEW public.unique_knowledge_docs AS
  SELECT DISTINCT ON (document_name)
    id,
    document_name,
    created_at
  FROM public.school_knowledge
  ORDER BY document_name, created_at DESC;

-- 4. ฟังก์ชันสำหรับการสืบค้นความรู้ด้วยเวกเตอร์ (Cosine Similarity Search)
CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  document_name TEXT,
  page_number INT,
  chunk_text TEXT,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    school_knowledge.id,
    school_knowledge.document_name,
    school_knowledge.page_number,
    school_knowledge.chunk_text,
    1 - (school_knowledge.embedding <=> query_embedding) AS similarity
  FROM public.school_knowledge
  WHERE 1 - (school_knowledge.embedding <=> query_embedding) > match_threshold
  ORDER BY school_knowledge.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. เปิดใช้งานระบบความปลอดภัย (RLS) สำหรับตารางความรู้
ALTER TABLE public.school_knowledge ENABLE ROW LEVEL SECURITY;

-- 6. กำหนดนโยบาย RLS ให้ทุกคนเข้าอ่านได้ และเฉพาะ admin/director จัดการข้อมูลได้
CREATE POLICY "Everyone can view school_knowledge" ON public.school_knowledge
  FOR SELECT USING (true);

CREATE POLICY "Admins and directors can manage school_knowledge" ON public.school_knowledge
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'director')
    )
  );


-- ==========================================================
-- 📘 ตารางทะเบียนวิชาเรียน (subjects) - เพิ่มเติมสำหรับโมดูลงานวิชาการ
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,                         -- รหัสวิชา เช่น ท11101
  name TEXT NOT NULL,                         -- ชื่อวิชา เช่น ภาษาไทย
  credits NUMERIC(3, 1) DEFAULT 0.5,           -- หน่วยกิต เช่น 0.5, 1.0
  type TEXT DEFAULT 'พื้นฐาน',                 -- ประเภทวิชา (พื้นฐาน / เพิ่มเติม)
  class_level TEXT NOT NULL,                  -- ระดับชั้น เช่น ป.1, ม.1
  academic_year TEXT DEFAULT '2569',          -- ปีการศึกษา
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subjects_code ON public.subjects(code);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to view subjects" ON public.subjects;
CREATE POLICY "Allow authenticated users to view subjects" ON public.subjects
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authorized staff to manage subjects" ON public.subjects;
CREATE POLICY "Allow authorized staff to manage subjects" ON public.subjects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_academic')::boolean = true)
      )
    )
  );


-- ==========================================================
-- 🧠 ตารางเก็บข้อมูล Chunk ของเอกสารส่วนบุคคลครู (Private Knowledge Base Chunks)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.ai_private_knowledge_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID REFERENCES public.ai_knowledge_base(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  page_number INTEGER,
  chunk_text TEXT NOT NULL,
  embedding vector(768),                         -- ขนาด 768 มิติสำหรับโมเดล gemini-embedding-2
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_private_chunks_file ON public.ai_private_knowledge_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_ai_private_chunks_teacher ON public.ai_private_knowledge_chunks(teacher_id);

ALTER TABLE public.ai_private_knowledge_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own private chunks" ON public.ai_private_knowledge_chunks;
CREATE POLICY "Users can manage their own private chunks" ON public.ai_private_knowledge_chunks
  FOR ALL USING (auth.uid() = teacher_id);

-- ==========================================================
-- 🧠 ฟังก์ชันสืบค้นไฟล์เอกสารส่วนบุคคลความแม่นยำสูง (Private Cosine Similarity RPC)
-- ==========================================================
CREATE OR REPLACE FUNCTION public.match_private_knowledge(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_teacher_id uuid
)
RETURNS TABLE (
  id UUID,
  file_id UUID,
  page_number INT,
  chunk_text TEXT,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    apkc.id,
    apkc.file_id,
    apkc.page_number,
    apkc.chunk_text,
    (1 - (apkc.embedding <=> query_embedding))::float AS similarity
  FROM public.ai_private_knowledge_chunks apkc
  WHERE apkc.teacher_id = p_teacher_id
    AND (1 - (apkc.embedding <=> query_embedding)) > match_threshold
  ORDER BY (apkc.embedding <=> query_embedding) ASC
  LIMIT match_count;
END;
$$;


-- ==========================================================
-- 📝 โมดูลส่งแผนการสอน (Lesson Plans & Activity Logs) - เพิ่มเติม 2026
-- ==========================================================

-- 1. ตารางเก็บข้อมูลแผนการสอน
CREATE TABLE IF NOT EXISTS public.lesson_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,                                           -- หัวข้อ/ชื่อแผนการสอน
    subject_code VARCHAR(20) NOT NULL,                             -- รหัสวิชา (เช่น ท๑๑๑๐๑)
    subject_name VARCHAR(100) NOT NULL,                            -- ชื่อวิชา (เช่น ภาษาไทย)
    class_level VARCHAR(50) NOT NULL,                              -- ระดับชั้น (เช่น ประถมศึกษาปีที่ ๑)
    term VARCHAR(10) NOT NULL,                                     -- ภาคเรียน/ปีการศึกษา (เช่น ๑/๒๕๖๙)
    file_url TEXT NOT NULL,                                        -- ลิงก์ไฟล์ PDF แผนการสอน (Supabase Storage)
    
    -- ระบบตรวจสอบและอนุมัติ
    status VARCHAR(30) DEFAULT 'Draft' NOT NULL,                   -- Draft, Pending_Academic, Rejected_by_Academic, Pending_Director, Rejected_by_Director, Approved
    academic_comments TEXT,                                        -- บันทึกความเห็นจากหัวหน้าวิชาการ
    academic_reviewed_by UUID REFERENCES auth.users(id),            -- ผู้ตรวจสอบวิชาการ
    academic_reviewed_at TIMESTAMP WITH TIME ZONE,
    
    director_comments TEXT,                                        -- บันทึกข้อสั่งการ/ความเห็นจาก ผอ.
    director_approved_by UUID REFERENCES auth.users(id),           -- ผอ. ผู้อนุมัติ
    director_approved_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ตารางเก็บประวัติกิจกรรมอนุมัติแผนการสอน
CREATE TABLE IF NOT EXISTS public.lesson_plan_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lesson_plan_id UUID REFERENCES public.lesson_plans(id) ON DELETE CASCADE NOT NULL,
    actor_id UUID REFERENCES auth.users(id) NOT NULL,
    action VARCHAR(50) NOT NULL,                                   -- 'create', 'submit', 'academic_reject', 'academic_propose', 'director_reject', 'approve'
    comments TEXT,                                                 -- ข้อความอ้างอิงในกิจกรรมนั้นๆ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. อินเด็กซ์เพิ่มความเร็ว
CREATE INDEX IF NOT EXISTS idx_lesson_plans_teacher ON public.lesson_plans(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_status ON public.lesson_plans(status);

-- 4. ตั้งค่า RLS (Row Level Security)
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_plan_logs ENABLE ROW LEVEL SECURITY;

-- 5. สร้างนโยบาย RLS สำหรับ lesson_plans
DROP POLICY IF EXISTS "Allow teachers to manage their own plans" ON public.lesson_plans;
CREATE POLICY "Allow teachers to manage their own plans" ON public.lesson_plans
  FOR ALL USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Allow academic staff to view all plans" ON public.lesson_plans;
CREATE POLICY "Allow academic staff to view all plans" ON public.lesson_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_academic')::boolean = true)
      )
    )
  );

DROP POLICY IF EXISTS "Allow academic staff to update review status" ON public.lesson_plans;
CREATE POLICY "Allow academic staff to update review status" ON public.lesson_plans
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_academic')::boolean = true)
      )
    )
  );

-- 6. สร้างนโยบาย RLS สำหรับ lesson_plan_logs
DROP POLICY IF EXISTS "Allow all users to view logs" ON public.lesson_plan_logs;
CREATE POLICY "Allow all users to view logs" ON public.lesson_plan_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow users to insert logs" ON public.lesson_plan_logs;
CREATE POLICY "Allow users to insert logs" ON public.lesson_plan_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- ====================================================================
-- 7. ATHLETICS REGISTRATION SYSTEM (ระบบลงทะเบียนนักกีฬาและกรีฑา)
-- Description:
-- - สร้างตาราง public.athletics_registrations เพื่อเก็บประวัตินักกีฬาและชนิดกีฬา
-- - ตั้งค่า Row Level Security (RLS) และสร้าง Index เพื่อเร่งความเร็วในการค้นหา
-- ====================================================================

-- สร้างตารางลงทะเบียนนักกีฬา
CREATE TABLE IF NOT EXISTS public.athletics_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL, -- อ้างอิงรหัสนักเรียน students.id
  academic_year TEXT NOT NULL, -- ปีการศึกษาที่สมัคร (เช่น '2569')
  prefix TEXT, -- ข้อมูล Snapshot ชื่อนักกีฬา ป้องกันข้อมูลเสียหายภายหลัง
  first_name TEXT,
  last_name TEXT,
  gender TEXT,
  birth_date DATE,
  class_level TEXT,
  room TEXT,
  weight NUMERIC,
  height NUMERIC,
  photo_url TEXT,
  citizen_id TEXT, -- เลขประจำตัวประชาชน 13 หลัก
  sport_id TEXT, -- รหัสหมายเลขนักกีฬา / โค้ดส่งตัว (เช่น '002')
  sport_type TEXT, -- ชนิดกีฬาที่สมัคร (เช่น 'วิ่ง 100 เมตร', 'ฟุตบอล')
  age_group TEXT, -- รุ่นอายุ (เช่น 'รุ่นอายุไม่เกิน 8 ปี')
  shirt_size TEXT, -- ขนาดเสื้อนักกีฬา
  status TEXT DEFAULT 'active',
  coach_name TEXT,
  coach_phone TEXT,
  is_substitute BOOLEAN DEFAULT false, -- ตัวจริง/ตัวสำรอง (ค่าเริ่มต้น false = ตัวจริง)
  competition_type TEXT DEFAULT 'local', -- ประเภทรายการแข่งขัน ('local' = กรีฑาตำบลเขาชัยสน, 'provincial' = กีฬาจังหวัดพัทลุง)
  registered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- เปิดการใช้งาน RLS
ALTER TABLE public.athletics_registrations ENABLE ROW LEVEL SECURITY;

-- สิทธิ์การเข้าถึง: ให้ครู ผู้ควบคุม และแอดมินทุกคน เรียกดู (SELECT) ข้อมูลได้
DROP POLICY IF EXISTS "Allow authenticated staff to view registrations" ON public.athletics_registrations;
CREATE POLICY "Allow authenticated staff to view registrations" ON public.athletics_registrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role IN ('teacher', 'director', 'admin')
    )
  );

-- สิทธิ์การเข้าถึง: ให้ Admin, ผู้อำนวยการ หรือ ครูที่ได้รับสิทธิ์พิเศษ 'access_athletics' สามารถจัดการข้อมูลได้ (ALL)
DROP POLICY IF EXISTS "Allow authorized staff to manage registrations" ON public.athletics_registrations;
CREATE POLICY "Allow authorized staff to manage registrations" ON public.athletics_registrations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_athletics')::boolean = true)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_athletics')::boolean = true)
      )
    )
  );

-- สร้างดัชนี (Indexes) เพื่อเพิ่มความเร็วในการสืบค้นข้อมูล
CREATE INDEX IF NOT EXISTS idx_athletics_student_id ON public.athletics_registrations(student_id);
CREATE INDEX IF NOT EXISTS idx_athletics_academic_year ON public.athletics_registrations(academic_year);
CREATE INDEX IF NOT EXISTS idx_athletics_sport_type ON public.athletics_registrations(sport_type);
CREATE INDEX IF NOT EXISTS idx_athletics_age_group ON public.athletics_registrations(age_group);
CREATE INDEX IF NOT EXISTS idx_athletics_citizen_id ON public.athletics_registrations(citizen_id);
CREATE INDEX IF NOT EXISTS idx_athletics_is_substitute ON public.athletics_registrations(is_substitute);
CREATE INDEX IF NOT EXISTS idx_athletics_competition_type ON public.athletics_registrations(competition_type);
