-- ====================================================================
-- SQL MIGRATION: YEAR SYSTEM & LINE INTERACTIVE WORKFLOW
-- Date: 2026-05-27
-- Description:
-- 1. Create line_action_states table for bot interaction context
-- 2. Add doc_year and doc_sequence to main document tables
-- 3. Perform historical data migration based on created_at timestamp
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Create line_action_states table (For LINE Multi-step chatbot)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS line_action_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,          -- LINE userId
  action TEXT NOT NULL,           -- e.g., 'awaiting_instruction', 'awaiting_teacher_select'
  context JSONB DEFAULT '{}',     -- Context data (doc_id, teacher_id, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes')
);

-- Enable RLS and permissions for line_action_states
ALTER TABLE line_action_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role full access to line_action_states"
  ON line_action_states FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- --------------------------------------------------------------------
-- 2. Add doc_year and doc_sequence columns to the 4 document tables
-- --------------------------------------------------------------------

-- Incoming Documents (หนังสือรับ)
ALTER TABLE incoming_docs ADD COLUMN IF NOT EXISTS doc_year INTEGER;
ALTER TABLE incoming_docs ADD COLUMN IF NOT EXISTS doc_sequence INTEGER;

-- Outgoing Documents (หนังสือส่ง)
ALTER TABLE outgoing_docs ADD COLUMN IF NOT EXISTS doc_year INTEGER;
ALTER TABLE outgoing_docs ADD COLUMN IF NOT EXISTS doc_sequence INTEGER;

-- Orders (คำสั่ง)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS doc_year INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS doc_sequence INTEGER;

-- Memos (บันทึกข้อความ)
ALTER TABLE memos ADD COLUMN IF NOT EXISTS doc_year INTEGER;
ALTER TABLE memos ADD COLUMN IF NOT EXISTS doc_sequence INTEGER;

-- --------------------------------------------------------------------
-- 3. Historical Data Migration (บวกรันปี พ.ศ. และ ลำดับ sequence)
-- --------------------------------------------------------------------

-- Migrate incoming_docs
WITH numbered_incoming AS (
  SELECT 
    id, 
    (EXTRACT(YEAR FROM created_at) + 543)::INTEGER as calculated_year,
    ROW_NUMBER() OVER (
      PARTITION BY (EXTRACT(YEAR FROM created_at) + 543)::INTEGER 
      ORDER BY created_at ASC
    )::INTEGER as calculated_seq
  FROM incoming_docs
)
UPDATE incoming_docs
SET 
  doc_year = numbered_incoming.calculated_year,
  doc_sequence = numbered_incoming.calculated_seq
FROM numbered_incoming
WHERE incoming_docs.id = numbered_incoming.id;

-- Migrate outgoing_docs
WITH numbered_outgoing AS (
  SELECT 
    id, 
    (EXTRACT(YEAR FROM created_at) + 543)::INTEGER as calculated_year,
    ROW_NUMBER() OVER (
      PARTITION BY (EXTRACT(YEAR FROM created_at) + 543)::INTEGER 
      ORDER BY created_at ASC
    )::INTEGER as calculated_seq
  FROM outgoing_docs
)
UPDATE outgoing_docs
SET 
  doc_year = numbered_outgoing.calculated_year,
  doc_sequence = numbered_outgoing.calculated_seq
FROM numbered_outgoing
WHERE outgoing_docs.id = numbered_outgoing.id;

-- Migrate orders
WITH numbered_orders AS (
  SELECT 
    id, 
    (EXTRACT(YEAR FROM created_at) + 543)::INTEGER as calculated_year,
    ROW_NUMBER() OVER (
      PARTITION BY (EXTRACT(YEAR FROM created_at) + 543)::INTEGER 
      ORDER BY created_at ASC
    )::INTEGER as calculated_seq
  FROM orders
)
UPDATE orders
SET 
  doc_year = numbered_orders.calculated_year,
  doc_sequence = numbered_orders.calculated_seq
FROM numbered_orders
WHERE orders.id = numbered_orders.id;

-- Migrate memos
WITH numbered_memos AS (
  SELECT 
    id, 
    (EXTRACT(YEAR FROM created_at) + 543)::INTEGER as calculated_year,
    ROW_NUMBER() OVER (
      PARTITION BY (EXTRACT(YEAR FROM created_at) + 543)::INTEGER 
      ORDER BY created_at ASC
    )::INTEGER as calculated_seq
  FROM memos
)
UPDATE memos
SET 
  doc_year = numbered_memos.calculated_year,
  doc_sequence = numbered_memos.calculated_seq
FROM numbered_memos
WHERE memos.id = numbered_memos.id;
