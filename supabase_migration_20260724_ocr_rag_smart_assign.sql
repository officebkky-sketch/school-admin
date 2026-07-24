-- ============================================================
-- Supabase Migration: Upgrade Smart OCR, RAG Memory & Auto Task Assignment
-- Date: 2026-07-24
-- Description: เพิ่มคอลัมน์รองรับข้อความ OCR, กำหนดการงาน, ครูผู้รับมอบหมายที่ AI แนะนำ และสิทธิ์คลังความรู้
-- ============================================================

-- 1. เพิ่มคอลัมน์ในตาราง incoming_docs
ALTER TABLE incoming_docs 
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS action_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suggested_assignee_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_processed_at TIMESTAMPTZ;

-- 2. เพิ่มคอลัมน์ในตาราง school_knowledge สำหรับเชื่อมโยงหนังสือรับ (RAG)
ALTER TABLE school_knowledge
  ADD COLUMN IF NOT EXISTS source_doc_id UUID REFERENCES incoming_docs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual';

-- 3. เพิ่มคอลัมน์การตั้งค่า Cloud Vision API ในตาราง settings
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS google_vision_api_key TEXT;

-- 4. สร้าง Index เพื่อเพิ่มความเร็วในการค้นหา
CREATE INDEX IF NOT EXISTS idx_incoming_docs_action_deadline ON incoming_docs(action_deadline);
CREATE INDEX IF NOT EXISTS idx_school_knowledge_source_doc ON school_knowledge(source_doc_id);
