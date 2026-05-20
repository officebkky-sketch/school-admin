-- ==========================================
-- SQL Script: แก้ไขสิทธิ์ Row Level Security (RLS) ของตาราง school_knowledge
-- วิธีใช้: คัดลอกข้อความทั้งหมดนี้ไปรันใน SQL Editor ของ Supabase
-- ==========================================

-- 1. ตรวจสอบให้แน่ใจว่า RLS ถูกเปิดใช้งาน
ALTER TABLE school_knowledge ENABLE ROW LEVEL SECURITY;

-- 2. ลบ Policy เดิมที่อาจกีดกันสิทธิ์ออกก่อน
DROP POLICY IF EXISTS "Enable read access for all users" ON school_knowledge;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON school_knowledge;
DROP POLICY IF EXISTS "Enable update/delete for authenticated users" ON school_knowledge;

-- 3. สร้างสิทธิ์การอ่านข้อมูลให้ทุกคน (SELECT)
-- เพื่อให้ AI และผู้ใช้สามารถค้นหาความรู้จากคลังได้ แม้ไม่ได้ล็อกอินหรือเป็นผู้ใช้ทั่วไป
CREATE POLICY "Enable read access for all users" ON school_knowledge
    FOR SELECT USING (true);

-- 4. สร้างสิทธิ์ให้ผู้ใช้ที่ล็อกอินแล้ว (Authenticated Users เช่น ครู/วิชาการ/ผอ.) สามารถนำเข้าไฟล์และบันทึกความรู้ใหม่ได้ (INSERT)
CREATE POLICY "Enable insert for authenticated users only" ON school_knowledge
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 5. สร้างสิทธิ์ให้ผู้ใช้ที่ล็อกอินแล้วสามารถลบหรือแก้ไขข้อมูลได้ (ALL = SELECT/INSERT/UPDATE/DELETE)
CREATE POLICY "Enable update/delete for authenticated users" ON school_knowledge
    FOR ALL USING (auth.uid() IS NOT NULL);
