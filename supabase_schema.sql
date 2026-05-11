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
