-- ==============================================================================
-- Migration: Add Certificates Module (ทะเบียนหนังสือรับรอง)
-- Date: 2026-11-06
-- Description:
--   1. ตาราง certificates สำหรับจัดเก็บทะเบียนหนังสือรับรองทุกประเภท
--   2. เพิ่มชุดเลข CERTIFICATE ใน document_number_series
--   3. Explicit GRANTs ตาม Rule J (Supabase Post-Oct 30 Invariant)
-- ==============================================================================

-- 1. ตาราง certificates
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  certificate_number TEXT NOT NULL,
  doc_year INTEGER NOT NULL,
  doc_sequence INTEGER NOT NULL,
  certificate_type TEXT NOT NULL DEFAULT 'employment', -- 'salary', 'employment', 'student', 'conduct', 'duty', 'experience', 'custom'
  custom_type_name TEXT,
  header_type TEXT NOT NULL DEFAULT 'garuda', -- 'garuda' | 'no_garuda' | 'school_logo'
  subject TEXT NOT NULL,
  recipient_type TEXT NOT NULL DEFAULT 'teacher', -- 'teacher' | 'student' | 'external' | 'organization'
  recipient_id UUID,
  recipient_name TEXT NOT NULL,
  recipient_id_card TEXT,
  recipient_position_or_grade TEXT,
  recipient_salary NUMERIC,
  recipient_department TEXT,
  certificate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL,
  purpose TEXT,
  issuer TEXT NOT NULL DEFAULT 'โรงเรียนบ้านควนโคกยา',
  sign_name TEXT DEFAULT 'นายเอกคณิต สิทธิศักดิ์',
  sign_position TEXT DEFAULT 'ผู้อำนวยการโรงเรียนบ้านควนโคกยา',
  status TEXT NOT NULL DEFAULT 'approved', -- 'pending' | 'approved' | 'rejected' | 'voided'
  file_url TEXT,
  remark TEXT,
  is_reserved BOOLEAN DEFAULT false,
  reserved_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Index สำหรับค้นหาตามปีและเลขลำดับ
CREATE INDEX IF NOT EXISTS idx_certificates_year_seq ON public.certificates(doc_year, doc_sequence);
CREATE INDEX IF NOT EXISTS idx_certificates_type ON public.certificates(certificate_type);

-- 2. เพิ่มหมวดชุดเลข CERTIFICATE ใน document_number_series
INSERT INTO public.document_number_series (series_code, name, description, format_pattern, padding_zeros)
VALUES ('CERTIFICATE', 'หนังสือรับรอง', 'ทะเบียนหนังสือรับรอง (บุคคล/บุคลากร/นักเรียน/ทั่วไป)', '{sequence}/{year}', 0)
ON CONFLICT (series_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- เพิ่มคอลัมน์การตั้งค่าหมวดเลขและเลขเริ่มต้นในตาราง settings
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS start_certificate_seq INTEGER DEFAULT 1;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS certificate_doc_prefix TEXT DEFAULT 'ศธ 04225.016/';

-- 3. Explicit GRANT ตาม Rule J (Supabase Post-October 30 Data API Invariant)
GRANT ALL ON TABLE public.certificates TO authenticated;
GRANT ALL ON TABLE public.certificates TO service_role;
GRANT SELECT ON TABLE public.certificates TO anon;

-- 4. เปิดใช้งาน Row Level Security (RLS)
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'certificates' AND policyname = 'Allow authenticated read certificates'
  ) THEN
    CREATE POLICY "Allow authenticated read certificates"
      ON public.certificates FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'certificates' AND policyname = 'Allow authenticated insert certificates'
  ) THEN
    CREATE POLICY "Allow authenticated insert certificates"
      ON public.certificates FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'certificates' AND policyname = 'Allow authenticated update certificates'
  ) THEN
    CREATE POLICY "Allow authenticated update certificates"
      ON public.certificates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'certificates' AND policyname = 'Allow authenticated delete certificates'
  ) THEN
    CREATE POLICY "Allow authenticated delete certificates"
      ON public.certificates FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
