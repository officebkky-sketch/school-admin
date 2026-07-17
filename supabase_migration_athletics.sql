-- ====================================================================
-- SQL MIGRATION: ATHLETICS REGISTRATION SYSTEM (ระบบลงทะเบียนนักกีฬา)
-- Date: 2026-06-23
-- Description:
-- 1. Create athletics_registrations table for student snapshot and sport registration
-- 2. Setup Row Level Security (RLS) policies
-- 3. Create indexes for optimization
-- ====================================================================

-- 1. Create athletics_registrations table
CREATE TABLE IF NOT EXISTS athletics_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL, -- Reference to students.id
  academic_year TEXT NOT NULL, -- Year of registration (e.g. '2568', '2569')
  prefix TEXT, -- Snapshot of student details
  first_name TEXT,
  last_name TEXT,
  gender TEXT,
  birth_date DATE,
  class_level TEXT,
  room TEXT,
  weight NUMERIC,
  height NUMERIC,
  photo_url TEXT,
  citizen_id TEXT, -- Thai National ID (13 digits) snapshot from students.national_id
  sport_id TEXT, -- Sport ID / Competitor ID (e.g., '002')
  sport_type TEXT, -- e.g., 'ฟุตบอล', 'วิ่ง 100 เมตร'
  age_group TEXT, -- e.g., 'รุ่นอายุไม่เกิน 10 ปี', 'รุ่นอายุไม่เกิน 12 ปี'
  shirt_size TEXT, -- e.g., 'S', 'M', 'L', 'XL'
  status TEXT DEFAULT 'active', -- active, inactive
  coach_name TEXT,
  coach_phone TEXT,
  registered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE athletics_registrations ENABLE ROW LEVEL SECURITY;

-- 2.1 Policy for SELECT: Allow authenticated staff (teacher, director, admin) to view registrations
CREATE POLICY "Allow authenticated staff to view registrations" ON athletics_registrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role IN ('teacher', 'director', 'admin')
    )
  );

-- 2.2 Policy for ALL (INSERT, UPDATE, DELETE): Allow admin, director, or teacher with 'access_athletics' permission
CREATE POLICY "Allow authorized staff to manage registrations" ON athletics_registrations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_athletics')::boolean = true)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_athletics')::boolean = true)
      )
    )
  );

-- 3. Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_athletics_student_id ON athletics_registrations(student_id);
CREATE INDEX IF NOT EXISTS idx_athletics_academic_year ON athletics_registrations(academic_year);
CREATE INDEX IF NOT EXISTS idx_athletics_sport_type ON athletics_registrations(sport_type);
CREATE INDEX IF NOT EXISTS idx_athletics_age_group ON athletics_registrations(age_group);
CREATE INDEX IF NOT EXISTS idx_athletics_citizen_id ON athletics_registrations(citizen_id);
