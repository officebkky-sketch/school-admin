-- ============================================================
-- Supabase Migration: Telegram Integration Setup
-- สำหรับระบบ School Admin (Non-Hybrid / 1 Project per School)
-- รันสคริปต์นี้ใน Supabase SQL Editor ของแต่ละโรงเรียน
-- ============================================================

-- 1. เพิ่มฟิลด์ของ Telegram Bot API ไปยังตาราง settings
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT,
  ADD COLUMN IF NOT EXISTS telegram_bot_username TEXT,
  ADD COLUMN IF NOT EXISTS telegram_group_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_group_link TEXT;

-- 2. เพิ่มฟิลด์ของ Telegram Chat ID ไปยังตาราง profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- 3. สร้าง Index เพื่อเพิ่มความเร็วในการสืบค้นข้อมูลของบอทและแจ้งเตือน
CREATE INDEX IF NOT EXISTS idx_profiles_telegram ON public.profiles(telegram_chat_id);
