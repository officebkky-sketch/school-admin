-- Migration: เพิ่ม column action_deadline และ suggested_assignee_id ใน incoming_docs
-- วันที่: 2026-07-31
-- วิธีใช้: นำไปรันใน Supabase Dashboard → SQL Editor

-- 1. เพิ่มคอลัมน์กำหนดส่งงาน (deadline) จาก OCR
ALTER TABLE incoming_docs 
  ADD COLUMN IF NOT EXISTS action_deadline TIMESTAMPTZ;

-- 2. เพิ่มคอลัมน์ครูผู้รับผิดชอบที่ AI แนะนำ
ALTER TABLE incoming_docs 
  ADD COLUMN IF NOT EXISTS suggested_assignee_id UUID REFERENCES teachers(id) ON DELETE SET NULL;

-- 3. สร้าง Index เพื่อเร่งความเร็วค้นหาตามวันกำหนด (Cron Job ใช้งาน)
CREATE INDEX IF NOT EXISTS idx_incoming_docs_action_deadline 
  ON incoming_docs (action_deadline) 
  WHERE action_deadline IS NOT NULL;

-- 4. สร้าง Index สำหรับ suggested_assignee_id
CREATE INDEX IF NOT EXISTS idx_incoming_docs_suggested_assignee 
  ON incoming_docs (suggested_assignee_id) 
  WHERE suggested_assignee_id IS NOT NULL;

-- ตรวจสอบผลลัพธ์ (เรียกดูโครงสร้างตาราง)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'incoming_docs'
  AND column_name IN ('action_deadline', 'suggested_assignee_id')
ORDER BY column_name;
