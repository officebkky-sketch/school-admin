-- 1. เพิ่มคอลัมน์ custom_sop สำหรับเก็บแนวปฏิบัติเฉพาะ (SOP) ในตาราง settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS custom_sop TEXT;

-- 2. สร้างตาราง RAG Knowledge Base สำหรับคลังคู่มือปฏิบัติงานเฉพาะทาง
CREATE TABLE IF NOT EXISTS school_knowledge (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'ทั่วไป', -- เช่น งานสารบรรณ, การเงิน, ทั่วไป
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- เปิดใช้งาน RLS บน school_knowledge
ALTER TABLE school_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select for authenticated users" ON school_knowledge
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all actions for authenticated users" ON school_knowledge
  USING (auth.uid() IS NOT NULL);

-- 3. สร้างตารางตรวจสอบเอกสาร AI Workflow Checklists
CREATE TABLE IF NOT EXISTS document_checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  required_elements JSONB, -- อาเรย์ของเช็คลิสต์ที่ต้องมี เช่น ["ลายเซ็น ผอ.", "ตราครุฑ", "ระบุงบประมาณ"]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- เปิดใช้งาน RLS บน document_checklists
ALTER TABLE document_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select for authenticated users" ON document_checklists
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all actions for authenticated users" ON document_checklists
  USING (auth.uid() IS NOT NULL);

-- 4. สร้างตารางสำหรับระบบ LINE Conversational Memory
CREATE TABLE IF NOT EXISTS line_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_user_id TEXT NOT NULL,
  message TEXT,
  reply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- สร้าง index เพื่อค้นหาการสนทนาย้อนหลังได้เร็วขึ้น
CREATE INDEX IF NOT EXISTS idx_line_chats_user ON line_chats(line_user_id, created_at DESC);
