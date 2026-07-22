-- Migration: Add school_enrolled, guardian_name, and enroll_class columns to service_area_students table
-- Created at: 2026-07-22

ALTER TABLE public.service_area_students 
ADD COLUMN IF NOT EXISTS school_enrolled TEXT,
ADD COLUMN IF NOT EXISTS guardian_name TEXT,
ADD COLUMN IF NOT EXISTS enroll_class TEXT;

COMMENT ON COLUMN public.service_area_students.school_enrolled IS 'สถานศึกษาที่เข้าเรียน (สำหรับรายงาน ป.1/ทร.14)';
COMMENT ON COLUMN public.service_area_students.guardian_name IS 'ชื่อ-สกุล ผู้ปกครอง (สำหรับรายงาน ป.1/ทร.14)';
COMMENT ON COLUMN public.service_area_students.enroll_class IS 'ชั้นเรียนที่เข้าเรียน (สำหรับรายงาน ป.1/ทร.14)';
