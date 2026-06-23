-- ====================================================================
-- SQL MIGRATION: FIX PROFILES RLS POLICY FOR DIRECTORS & ADMINS
-- Date: 2026-06-23
-- Description:
-- ปรับปรุงสิทธิ์ RLS ในตาราง profiles เพื่อให้ผู้ใช้ที่มีบทบาทเป็น "ผู้อำนวยการ" (director) 
-- สามารถอัปเดตข้อมูลผู้ใช้คนอื่นได้ เช่น อนุมัติสิทธิ์เข้าใช้งาน, เปลี่ยน Role, และการปรับสิทธิ์เฉพาะบุคคล (extra_permissions)
-- ====================================================================

BEGIN;

-- 1. ลบนโยบายอัปเดตเดิมของ profiles (ที่จำกัดเฉพาะ admin เท่านั้น)
DROP POLICY IF EXISTS "Admins can update all profiles." ON public.profiles;

-- 2. สร้างนโยบายอัปเดตใหม่ ให้ครอบคลุมทั้งบทบาท 'admin' และ 'director'
CREATE POLICY "Admins and Directors can update all profiles" ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'director')
    )
  );

COMMIT;
