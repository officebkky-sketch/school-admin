-- ==========================================
-- SQL Script: แก้ไขสิทธิ์ Row Level Security (RLS) ของตาราง school_knowledge (เวอร์ชัน 2)
-- วัตถุประสงค์: จำกัดให้เฉพาะผู้ใช้ที่มี role = 'admin' หรือ 'director' เท่านั้นที่มีสิทธิ์
--            ในการ เพิ่ม (Insert), แก้ไข (Update) หรือ ลบ (Delete) ข้อมูลคลังสมองส่วนกลาง
-- วิธีใช้: คัดลอกข้อความทั้งหมดนี้ไปรันใน SQL Editor ของ Supabase
-- ==========================================

-- 1. ตรวจสอบความแน่ใจในการเปิดใช้งาน RLS
ALTER TABLE school_knowledge ENABLE ROW LEVEL SECURITY;

-- 2. ลบ Policy เก่าออกทั้งหมดเพื่อไม่ให้ทับซ้อนกัน
DROP POLICY IF EXISTS "Enable read access for all users" ON school_knowledge;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON school_knowledge;
DROP POLICY IF EXISTS "Enable update/delete for authenticated users" ON school_knowledge;
DROP POLICY IF EXISTS "Enable insert for admins and directors only" ON school_knowledge;
DROP POLICY IF EXISTS "Enable update and delete for admins and directors only" ON school_knowledge;
DROP POLICY IF EXISTS "Enable modify for admins and directors only" ON school_knowledge;

-- 3. อนุญาตให้ทุกคนสามารถอ่านข้อมูลได้ (SELECT)
-- เพื่อให้ระบบวิเคราะห์ RAG ค้นหาข้อมูลมาตอบครู/ผู้ปกครองได้
CREATE POLICY "Enable read access for all users" ON school_knowledge
    FOR SELECT USING (true);

-- 4. จำกัดสิทธิ์การจัดการเอกสาร (INSERT, UPDATE, DELETE)
-- เฉพาะผู้ใช้ที่มีบทบาทเป็น admin หรือ director เท่านั้น
CREATE POLICY "Enable modify for admins and directors only" ON school_knowledge
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'director')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'director')
        )
    );
