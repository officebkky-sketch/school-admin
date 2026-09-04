# 🤖 ทีมที่ ๒: Multi-Channel Bot & Workflow Agent (ทีมนวัตกรรมบอท Telegram/LINE อัจฉริยะ)

## 📌 ข้อมูลประจำทีม
* **รหัสทีมงาน:** `expert_bot_workflow`
* **โมเดลขับเคลื่อนใน AiPASS:** `Claude Sonnet 5` / `DeepSeek R1` (Task Class: `code` / `math_research`)
* **สกิลที่ครอบครอง:**
  * `telegram_agent_framework` (2-Way Interactive State Machine, Inline Keyboards, Webhook Routing)
  * `two-way-doc-approval-agent` (คิวสั่งการต่อเนื่อง Inbox Zero, Pipe-separated Telegram Group ID, HTML Fallback)
  * `ocr-smart-assigner` (Gemini Vision OCR, Fuzzy Name Match 2 ชั้น, Fallback-Only Overwrite)
* **ไฟล์ที่รับผิดชอบ:**
  * `api/telegram-webhook.ts`
  * `api/line-webhook.ts`
  * `api/ocr-process.ts`
  * `api/director-pending-reminder.ts`
  * `api/deadline-reminder.ts`
  * `src/lib/telegramNotify.ts`
  * `src/lib/lineNotify.ts`

---

## 🔍 บทวิเคราะห์ระบบ As-Is
1. **2-Way Approval Flow:** สามารถเสนอหนังสือและให้ ผอ. สั่งการผ่านปุ่ม Inline บน Telegram ได้อย่างสมบูรณ์แบบ
2. **Auto-Next Queue (Inbox Zero):** เมื่อ ผอ. สั่งการฉบับหนึ่งแล้ว ระบบจะคิวรี่ฉบับถัดไปมาแสดงผลทันที ช่วยประหยัดเวลาอย่างมาก
3. **Multi-Channel Morning Digest:** สรุปหนังสือค้างสั่งการตอน 08:00 น. ส่งเข้าทั้งกลุ่มเสนอหนังสือ และ Telegram ส่วนตัวของ ผอ.
4. **ความทนทานของ Webhook:** มีการจัดการ Fallback ถอด HTML Tag อัตโนมัติเมื่อ Telegram API ตอบกลับ 400 Bad Request

## 💡 ข้อเสนอแนะเชิงกลยุทธ์และการปรับปรุง (Recommendations)
1. **Asynchronous Non-blocking Webhook:** ปรับให้ Webhook ส่ง HTTP 200 OK กลับไปยัง Telegram/LINE ภายใน 1.5 วินาที แล้วใช้ background promise หรือ Edge trigger ทำงานต่อ เพื่อป้องกัน timeout 10 วินาที
2. **PDPA Redaction on Public Groups:** ในกลุ่มกลางหรือกลุ่มรวมของโรงเรียน ข้อความแจ้งเตือนที่มีข้อมูลส่วนบุคคลของเด็ก (เช่น รหัสบัตร ปชช. หรือสถานะครอบครัว) ต้องทำการ Masking (เช่น `1-XXXX-XXXXX-XX-X`) เสมอ
3. **Interactive Teacher Task Update:** เพิ่มปุ่ม "รับทราบงาน" และ "ส่งรายงานความคืบหน้า" ให้ครูผู้รับมอบหมายงานสามารถกดตอบรับผ่าน Telegram ได้โดยตรง ไม่ต้องเปิดคอมพิวเตอร์
