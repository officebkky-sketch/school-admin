-- ====================================================================
-- SQL MIGRATION V2: ATHLETICS REGISTRATION - ADD is_substitute COLUMN
-- Date: 2026-06-23
-- Description:
-- เพิ่มคอลัมน์ is_substitute เพื่อรองรับนักกีฬาตัวสำรอง
-- นักกีฬาบางคนอาจเป็นตัวจริงในรายการหนึ่ง แต่เป็นตัวสำรองในอีกรายการ
-- ====================================================================

-- เพิ่มคอลัมน์ is_substitute (ค่าเริ่มต้น false = ตัวจริง)
ALTER TABLE athletics_registrations
ADD COLUMN IF NOT EXISTS is_substitute BOOLEAN DEFAULT false;

-- สร้าง index สำหรับเร่งความเร็วการค้นหาตัวสำรอง
CREATE INDEX IF NOT EXISTS idx_athletics_is_substitute ON athletics_registrations(is_substitute);
