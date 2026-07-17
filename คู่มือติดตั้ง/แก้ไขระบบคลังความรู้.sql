-- ==========================================================
-- 🧠 คำสั่ง SQL สำหรับสร้างระบบคลังสมองส่วนกลาง (RAG Knowledge Base)
-- สำหรับรันใน Supabase SQL Editor เพื่อแก้ไข Error 404
-- ==========================================================

-- 1. เปิดการใช้งาน Extension สำหรับประมวลผล Vector ความรู้
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. สร้างตารางเก็บเวกเตอร์ความรู้และข้อความเอกสาร PDF
CREATE TABLE IF NOT EXISTS public.school_knowledge (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_name TEXT NOT NULL,
  page_number INTEGER,
  chunk_text TEXT NOT NULL,
  embedding vector(768),                         -- ขนาด 768 มิติสำหรับโมเดล gemini-embedding-2
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. สร้างวิวแสดงผลรายชื่อเอกสารที่ไม่ซ้ำ
CREATE OR REPLACE VIEW public.unique_knowledge_docs AS
  SELECT DISTINCT ON (document_name)
    id,
    document_name,
    created_at
  FROM public.school_knowledge
  ORDER BY document_name, created_at DESC;

-- 4. สร้างฟังก์ชันการค้นหาความรู้ความแม่นยำสูง (Cosine Similarity RPC)
CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  document_name TEXT,
  page_number INT,
  chunk_text TEXT,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sk.id,
    sk.document_name,
    sk.page_number,
    sk.chunk_text,
    (1 - (sk.embedding <=> query_embedding))::float AS similarity
  FROM public.school_knowledge sk
  WHERE (1 - (sk.embedding <=> query_embedding)) > match_threshold
  ORDER BY (sk.embedding <=> query_embedding) ASC
  LIMIT match_count;
END;
$$;

-- 5. เปิดใช้งานระบบสิทธิ์ RLS สำหรับตารางความรู้
ALTER TABLE public.school_knowledge ENABLE ROW LEVEL SECURITY;

-- 6. กำหนดนโยบาย RLS ให้ทุกคนเข้าอ่านได้
DROP POLICY IF EXISTS "Everyone can view school_knowledge" ON public.school_knowledge;
CREATE POLICY "Everyone can view school_knowledge" ON public.school_knowledge
  FOR SELECT USING (true);

-- 7. กำหนดนโยบาย RLS ให้เฉพาะ admin/director จัดการข้อมูลได้
DROP POLICY IF EXISTS "Admins and directors can manage school_knowledge" ON public.school_knowledge;
CREATE POLICY "Admins and directors can manage school_knowledge" ON public.school_knowledge
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'director')
    )
  );
