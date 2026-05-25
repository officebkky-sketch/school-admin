-- 1. Profiles Table (Extended User Info)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'guest', -- admin, director, teacher, guest, student
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
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
  created_at TIMESTAMPTZ DEFAULT NOW()
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

