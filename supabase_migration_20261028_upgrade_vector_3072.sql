-- ==============================================================================
-- 🧠 SQL Migration: ปรับปรุงมิติเวกเตอร์เป็น 3072 มิติ (Gemini Embedding Standard)
-- สำหรับระบบ Intelligence Hub คลังปัญญาโรงเรียน และ คลังความรู้ส่วนตัวครู
-- รองรับ: Supabase Postgres pgvector (Gemini embedding-001 / embedding-2)
-- วันที่ปรับปรุง: 28 ตุลาคม 2569
-- ==============================================================================

-- 1. ตรวจสอบ Extension pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. ปรับมิติคอลัมน์ embedding ในตาราง school_knowledge (คลังปัญญาส่วนกลาง)
DO $$
BEGIN
  -- หากมีตารางอยู่แล้ว ให้ปรับปรุง Type เป็น vector(3072)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'school_knowledge') THEN
    ALTER TABLE public.school_knowledge ALTER COLUMN embedding TYPE vector(3072);
  ELSE
    CREATE TABLE public.school_knowledge (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      document_name TEXT NOT NULL,
      page_number INTEGER,
      chunk_text TEXT NOT NULL,
      embedding vector(3072),
      created_by UUID REFERENCES auth.users,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 3. ปรับปรุงวิวแสดงผลรายชื่อเอกสารไม่ซ้ำ
CREATE OR REPLACE VIEW public.unique_knowledge_docs AS
  SELECT DISTINCT ON (document_name)
    id,
    document_name,
    created_at
  FROM public.school_knowledge
  ORDER BY document_name, created_at DESC;

-- 4. ปรับปรุงฟังก์ชันค้นหาคลังปัญญาส่วนกลาง (Cosine Similarity RPC 3072 มิติ)
-- ลบฟังก์ชันเดิมก่อนเพื่อป้องกัน signature ซ้ำซ้อน
DROP FUNCTION IF EXISTS public.match_knowledge(vector, float, int);
DROP FUNCTION IF EXISTS public.match_knowledge(vector(768), float, int);
DROP FUNCTION IF EXISTS public.match_knowledge(vector(3072), float, int);

CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding vector(3072),
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
  WHERE sk.embedding IS NOT NULL
    AND (1 - (sk.embedding <=> query_embedding)) > match_threshold
  ORDER BY (sk.embedding <=> query_embedding) ASC
  LIMIT match_count;
END;
$$;

-- 5. ปรับมิติคอลัมน์ embedding ในตาราง ai_private_knowledge_chunks (คลังส่วนตัวครู)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_private_knowledge_chunks') THEN
    ALTER TABLE public.ai_private_knowledge_chunks ALTER COLUMN embedding TYPE vector(3072);
  END IF;
END $$;

-- 6. ปรับปรุงฟังก์ชันค้นหาคลังส่วนตัวครู (Private Cosine Similarity RPC 3072 มิติ)
DROP FUNCTION IF EXISTS public.match_private_knowledge(vector, float, int, uuid);
DROP FUNCTION IF EXISTS public.match_private_knowledge(vector(768), float, int, uuid);
DROP FUNCTION IF EXISTS public.match_private_knowledge(vector(3072), float, int, uuid);

CREATE OR REPLACE FUNCTION public.match_private_knowledge(
  query_embedding vector(3072),
  match_threshold float,
  match_count int,
  p_teacher_id uuid
)
RETURNS TABLE (
  id UUID,
  file_id UUID,
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
    apkc.id,
    apkc.file_id,
    apkc.page_number,
    apkc.chunk_text,
    (1 - (apkc.embedding <=> query_embedding))::float AS similarity
  FROM public.ai_private_knowledge_chunks apkc
  WHERE apkc.teacher_id = p_teacher_id
    AND apkc.embedding IS NOT NULL
    AND (1 - (apkc.embedding <=> query_embedding)) > match_threshold
  ORDER BY (apkc.embedding <=> query_embedding) ASC
  LIMIT match_count;
END;
$$;

-- 7. กำหนดสิทธิ์ Explicit GRANT ตามข้อกำหนด Rule J (Supabase Data API Invariant)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_knowledge TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_knowledge TO service_role;
GRANT SELECT ON public.school_knowledge TO anon;

GRANT SELECT ON public.unique_knowledge_docs TO authenticated;
GRANT SELECT ON public.unique_knowledge_docs TO service_role;
GRANT SELECT ON public.unique_knowledge_docs TO anon;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_private_knowledge_chunks') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_private_knowledge_chunks TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_private_knowledge_chunks TO service_role;
  END IF;
END $$;

-- 8. เปิดการใช้งาน RLS และกำหนด Policies ที่ปลอดภัย
ALTER TABLE public.school_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view school_knowledge" ON public.school_knowledge;
CREATE POLICY "Everyone can view school_knowledge" ON public.school_knowledge
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins and directors can manage school_knowledge" ON public.school_knowledge;
CREATE POLICY "Admins and directors can manage school_knowledge" ON public.school_knowledge
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'director')
    )
  );
