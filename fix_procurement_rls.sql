-- 1. ตรวจสอบและเปิดใช้งาน RLS ให้กับตารางที่เกี่ยวข้อง
ALTER TABLE procurement_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_items ENABLE ROW LEVEL SECURITY;

-- 2. ลบ Policy เดิม (ถ้ามี) เพื่อป้องกันการซ้ำซ้อน
DROP POLICY IF EXISTS "Everyone can view procurement" ON procurement_projects;
DROP POLICY IF EXISTS "Authenticated users can manage procurement" ON procurement_projects;
DROP POLICY IF EXISTS "Everyone can view items" ON procurement_items;
DROP POLICY IF EXISTS "Authenticated users can manage items" ON procurement_items;

-- 3. สร้าง Policy ใหม่สำหรับ procurement_projects
-- อนุญาตให้ทุกคนในโรงเรียนดูข้อมูลได้
CREATE POLICY "Enable read access for all users" ON procurement_projects
    FOR SELECT USING (true);

-- อนุญาตให้ผู้ที่ Login แล้วสามารถเพิ่มข้อมูลได้ (INSERT)
CREATE POLICY "Enable insert for authenticated users only" ON procurement_projects
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- อนุญาตให้ผู้ที่ Login แล้วสามารถแก้ไขและลบข้อมูลได้ (UPDATE/DELETE)
CREATE POLICY "Enable update/delete for authenticated users" ON procurement_projects
    FOR ALL USING (auth.uid() IS NOT NULL);

-- 4. สร้าง Policy ใหม่สำหรับ procurement_items
CREATE POLICY "Enable read access for items" ON procurement_items
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for items" ON procurement_items
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable update/delete for items" ON procurement_items
    FOR ALL USING (auth.uid() IS NOT NULL);
