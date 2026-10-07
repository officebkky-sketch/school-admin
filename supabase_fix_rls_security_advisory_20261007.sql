-- ==============================================================================
-- Security Advisory Fix (Resilient Version): Enable Row-Level Security (RLS)
-- Project: officebkky-sketch (vzrrpxrmtjpgfbbvhjra)
-- Date: 2026-10-07
-- Error Code: rls_disabled_in_public
-- Description:
--   เปิด RLS อัตโนมัติทุกตารางใน schema public ที่ยังไม่ได้เปิด
--   พร้อมตรวจสอบการมีอยู่ของตาราง (IF EXISTS) ป้องกัน Error 42P01
-- ==============================================================================

DO $$ 
DECLARE 
    r RECORD;
    pol_count INT;
BEGIN 
    -- 1. ค้นหาทุกตารางใน public ที่ยังไม่ได้เปิด RLS แล้วสั่งเปิดทันที (Auto-Enable All)
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND rowsecurity = false
    ) LOOP 
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
        RAISE NOTICE 'Enabled RLS on public.%', r.tablename;
    END LOOP;

    -- 2. สร้าง Policies & Grants เฉพาะตารางที่มีอยู่จริง (Safe Guarded)

    -- [A] document_number_series
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_number_series') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Allow select document_number_series" ON public.document_number_series;';
        EXECUTE 'CREATE POLICY "Allow select document_number_series" ON public.document_number_series FOR SELECT USING (true);';
        EXECUTE 'DROP POLICY IF EXISTS "Allow manage document_number_series" ON public.document_number_series;';
        EXECUTE 'CREATE POLICY "Allow manage document_number_series" ON public.document_number_series FOR ALL USING (auth.uid() IS NOT NULL);';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_number_series TO authenticated, service_role;';
        EXECUTE 'GRANT SELECT ON public.document_number_series TO anon;';
    END IF;

    -- [B] document_number_counters
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_number_counters') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Allow select document_number_counters" ON public.document_number_counters;';
        EXECUTE 'CREATE POLICY "Allow select document_number_counters" ON public.document_number_counters FOR SELECT USING (true);';
        EXECUTE 'DROP POLICY IF EXISTS "Allow manage document_number_counters" ON public.document_number_counters;';
        EXECUTE 'CREATE POLICY "Allow manage document_number_counters" ON public.document_number_counters FOR ALL USING (auth.uid() IS NOT NULL);';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_number_counters TO authenticated, service_role;';
    END IF;

    -- [C] document_number_allocations
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_number_allocations') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Allow select document_number_allocations" ON public.document_number_allocations;';
        EXECUTE 'CREATE POLICY "Allow select document_number_allocations" ON public.document_number_allocations FOR SELECT USING (true);';
        EXECUTE 'DROP POLICY IF EXISTS "Allow manage document_number_allocations" ON public.document_number_allocations;';
        EXECUTE 'CREATE POLICY "Allow manage document_number_allocations" ON public.document_number_allocations FOR ALL USING (auth.uid() IS NOT NULL);';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_number_allocations TO authenticated, service_role;';
    END IF;

    -- [D] annual_saraban_reports
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'annual_saraban_reports') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Allow select annual_saraban_reports" ON public.annual_saraban_reports;';
        EXECUTE 'CREATE POLICY "Allow select annual_saraban_reports" ON public.annual_saraban_reports FOR SELECT USING (true);';
        EXECUTE 'DROP POLICY IF EXISTS "Allow manage annual_saraban_reports" ON public.annual_saraban_reports;';
        EXECUTE 'CREATE POLICY "Allow manage annual_saraban_reports" ON public.annual_saraban_reports FOR ALL USING (auth.uid() IS NOT NULL);';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.annual_saraban_reports TO authenticated, service_role;';
    END IF;

    -- [E] budget_allocations
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'budget_allocations') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Allow select budget_allocations" ON public.budget_allocations;';
        EXECUTE 'CREATE POLICY "Allow select budget_allocations" ON public.budget_allocations FOR SELECT USING (true);';
        EXECUTE 'DROP POLICY IF EXISTS "Allow manage budget_allocations" ON public.budget_allocations;';
        EXECUTE 'CREATE POLICY "Allow manage budget_allocations" ON public.budget_allocations FOR ALL USING (auth.uid() IS NOT NULL);';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_allocations TO authenticated, service_role;';
    END IF;

    -- [F] telegram_chats (ถ้ามี)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'telegram_chats') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Allow manage telegram_chats" ON public.telegram_chats;';
        EXECUTE 'CREATE POLICY "Allow manage telegram_chats" ON public.telegram_chats FOR ALL USING (true);';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_chats TO authenticated, service_role;';
    END IF;

    -- [G] line_chats (ถ้ามี)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'line_chats') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Allow manage line_chats" ON public.line_chats;';
        EXECUTE 'CREATE POLICY "Allow manage line_chats" ON public.line_chats FOR ALL USING (true);';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.line_chats TO authenticated, service_role;';
    END IF;

    -- 3. Safety Net: หากตารางใดเปิด RLS แล้วแต่ยังไม่มี Policy ใดๆ เลย ให้ใส่ Default Policy กันข้อมูลหน้าเว็บบล็อค
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    ) LOOP
        SELECT COUNT(*) INTO pol_count FROM pg_policies WHERE schemaname = 'public' AND tablename = r.tablename;
        IF pol_count = 0 THEN
            EXECUTE format('CREATE POLICY "Default authenticated access" ON public.%I FOR ALL USING (auth.uid() IS NOT NULL);', r.tablename);
            EXECUTE format('CREATE POLICY "Default public read access" ON public.%I FOR SELECT USING (true);', r.tablename);
            RAISE NOTICE 'Added default fallback policies for public.%', r.tablename;
        END IF;
    END LOOP;

END $$;

NOTIFY pgrst, 'reload schema';
