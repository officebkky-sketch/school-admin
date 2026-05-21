/* 
==========================================
SQL Script: แก้ไขสิทธิ์ Row Level Security (RLS)
ของตาราง school_knowledge
==========================================
*/

/* 1. เปิดใช้งาน RLS */
ALTER TABLE school_knowledge ENABLE ROW LEVEL SECURITY;

/* 2. ลบ Policy เดิมออกก่อน */
DROP POLICY IF EXISTS "Enable read access for all users" ON school_knowledge;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON school_knowledge;
DROP POLICY IF EXISTS "Enable update/delete for authenticated users" ON school_knowledge;

/* 3. สิทธิ์การอ่านข้อมูลให้ทุกคน (SELECT) */
CREATE POLICY "Enable read access for all users" ON school_knowledge
    FOR SELECT USING (true);

/* 4. สิทธิ์การเพิ่มข้อมูล (INSERT) ให้ผู้ใช้ที่เข้าสู่ระบบ */
CREATE POLICY "Enable insert for authenticated users only" ON school_knowledge
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

/* 5. สิทธิ์การแก้ไข/ลบข้อมูล (ALL) ให้ผู้ใช้ที่เข้าสู่ระบบ */
CREATE POLICY "Enable update/delete for authenticated users" ON school_knowledge
    FOR ALL USING (auth.uid() IS NOT NULL);
