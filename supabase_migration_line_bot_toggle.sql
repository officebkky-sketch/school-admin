-- 1. เพิ่มคอลัมน์ is_line_enabled สำหรับเปิด/ปิด LINE Bot ในตาราง settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS is_line_enabled BOOLEAN DEFAULT true;
