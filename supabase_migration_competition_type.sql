-- ====================================================================
-- SQL MIGRATION: เพิ่ม competition_type สำหรับแยกรายการแข่งขัน
-- Date: 2026-06-24
-- Description:
-- เพิ่มคอลัมน์ competition_type เพื่อแยกข้อมูลระหว่าง:
-- 1. 'local' = กรีฑาเยาวชน ประชาชน ตำบลเขาชัยสน (เดิม)
-- 2. 'provincial' = กีฬานักเรียน นักศึกษา และประชาชน จังหวัดพัทลุง ครั้งที่ 77
-- ====================================================================

-- 1. เพิ่มคอลัมน์ competition_type
ALTER TABLE athletics_registrations 
ADD COLUMN IF NOT EXISTS competition_type TEXT DEFAULT 'local';

-- 2. อัปเดตข้อมูลเดิมทั้งหมดเป็น 'local' (กรีฑาตำบล)
UPDATE athletics_registrations SET competition_type = 'local' WHERE competition_type IS NULL;

-- 3. เพิ่ม index สำหรับ competition_type
CREATE INDEX IF NOT EXISTS idx_athletics_competition_type ON athletics_registrations(competition_type);

-- COMMENT: ค่าที่รองรับ
-- 'local'      = กรีฑาเยาวชน ประชาชน ตำบลเขาชัยสน
-- 'provincial'  = การแข่งขันกีฬานักเรียน นักศึกษา และประชาชน จังหวัดพัทลุง ครั้งที่ ๗๗ ประจำปี ๒๕๖๙
