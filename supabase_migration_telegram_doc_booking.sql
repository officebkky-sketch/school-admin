-- ============================================================
-- SQL Migration: Telegram Document Booking & Smart Auto Numbering
-- โครงการ: school-admin-multischool
-- ============================================================

-- 1. เพิ่มฟิลด์รองรับการจองเลขแบบไม่มีเอกสาร และผู้ขอเลขในหนังสือรับ
ALTER TABLE incoming_docs 
ADD COLUMN IF NOT EXISTS is_reserved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reserved_by_telegram_id TEXT,
ADD COLUMN IF NOT EXISTS reserved_by_name TEXT;

-- 2. เพิ่มฟิลด์ในหนังสือส่ง
ALTER TABLE outgoing_docs 
ADD COLUMN IF NOT EXISTS is_reserved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reserved_by_telegram_id TEXT,
ADD COLUMN IF NOT EXISTS reserved_by_name TEXT;

-- 3. เพิ่มฟิลด์ในคำสั่งโรงเรียน
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS is_reserved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reserved_by_telegram_id TEXT,
ADD COLUMN IF NOT EXISTS reserved_by_name TEXT;

-- 4. เพิ่มฟิลด์ในบันทึกข้อความ
ALTER TABLE memos 
ADD COLUMN IF NOT EXISTS is_reserved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reserved_by_telegram_id TEXT,
ADD COLUMN IF NOT EXISTS reserved_by_name TEXT;

-- 5. เพิ่มฟิลด์สำหรับตั้งค่าเลขเริ่มต้นประจำปีของแต่ละประเภทหนังสือในตาราง settings
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS start_incoming_seq INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS start_outgoing_seq INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS start_memo_seq INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS start_order_seq INTEGER DEFAULT 1;
