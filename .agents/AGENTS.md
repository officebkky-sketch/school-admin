# ประวัติการพัฒนาและกฎเกณฑ์ของโปรเจกต์ (Project Rules & Development History)

## 🏫 กฎสถาปัตยกรรมและ API ของโปรเจกต์ school-admin-multischool

### Rule A — Vercel API Handler Pattern
- **ห้าม** `import type { VercelRequest, VercelResponse } from '@vercel/node'` เด็ดขาด เพราะ `@vercel/node` ไม่ได้ติดตั้งใน project
- ทุก API handler ใน `api/*.ts` ต้องใช้รูปแบบ Web Standard Fetch API นี้เท่านั้น:
  ```typescript
  declare const process: any;
  export default async function handler(req: Request): Promise<Response> {
    return new Response(JSON.stringify({ ... }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  ```

### Rule B — Telegram Group ID เป็น Pipe-Separated String
- `settings.telegram_group_id` เก็บข้อมูล 2 กลุ่มในรูปแบบ `"centralId|proposalId"` คั่นด้วย `|`
- ต้อง parse เสมอก่อนใช้งาน:
  - `.split('|')[0]?.trim()` → **กลุ่มส่วนกลาง** (แจ้งเตือนทั่วไป / Deadline Reminder)
  - `.split('|')[1]?.trim()` → **กลุ่มเสนอหนังสือ** (OCR เกษียณหนังสือ / Morning Digest)

### Rule C — Multi-School Architecture = Separate Supabase Projects
- แต่ละโรงเรียนมี Supabase Project และ Vercel Deploy **แยกกันคนละ instance** ไม่ได้ใช้ฐานข้อมูลร่วมกัน
- **ห้ามเพิ่ม** `school_id` ใน `settings` table หรือใช้ `.eq('school_id', ...)` filter ใน settings query
- `settings` table มีเพียง 1 row ต่อ 1 โรงเรียนเสมอ
- project ใช้ **Vercel Serverless Functions** (`api/*.ts`) ไม่ใช่ Supabase Edge Functions

### Rule D — Telegram Notification & Cron Digest Delivery Strategy
1. **Multi-Channel Delivery สำหรับ Morning Digest**:
   - การส่งสรุปหนังสือค้างเกษียณประจำวัน (08:00 น.) ต้องส่งเข้า **กลุ่มเสนอหนังสือ (Proposal Group)** เป็นช่องทางหลักเสมอ (`settings.telegram_group_id.split('|')[1]` หรือ `[0]` หากไม่ได้แยก)
   - ส่งตรงเข้า Telegram ส่วนตัวของ ผอ./แอดมิน (Direct Message) ควบคู่ไปด้วยหากมีการผูก `telegram_chat_id` ใน `profiles`
   - **ห้าม** ละเว้นการส่งเข้ากลุ่มเสนอหนังสือเพียงเพราะมีบัญชีส่วนตัวของ ผอ. ในระบบ
2. **HTML Parsing Fallback อัตโนมัติ**:
   - ทุกฟังก์ชันที่ยิงเข้า Telegram API (`sendMessage`) ต้องมีระบบ Fallback หาก Telegram ตอบกลับข้อผิดพลาดด้าน HTML tags/entities (`400 Bad Request`) ให้ถอด HTML tags ออก (`replace(/<\/?[^>]+(>|$)/g, '')`) แล้วส่งแบบ Plain Text ซ้ำทันที เพื่อป้องกันข้อความตกหล่น
3. **การตรวจสอบผลลัพธ์การส่ง (`res.ok`)**:
   - ต้องตรวจสอบ `res.ok === true` ก่อนนับจำนวนข้อความที่ส่งสำเร็จ (`sentCount++`) ห้ามนับล่วงหน้าก่อนทราบผล

### Rule E — Supabase Environment Variables Fallback Pattern
- ทุก API Handler ใน `api/*.ts` ต้องรองรับชื่อตัวแปร Supabase ทั้งแบบมาตรฐาน Vercel และแบบ Vite เสมอ:
  ```typescript
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                      process.env.SUPABASE_SERVICE_KEY || 
                      process.env.VITE_SUPABASE_ANON_KEY || 
                      process.env.SUPABASE_ANON_KEY;
  ```

### Rule F — Cross-Platform Client & Vercel API Integration (Electron Desktop & Web)
1. **มาตรฐานการเรียก API จากฝั่ง Client (`src/**/*.tsx`, `src/**/*.ts`)**:
   - **ห้าม** ใช้ Relative Path เช่น `fetch('/api/...')` โดยตรงเด็ดขาด เพราะเมื่อรันบนโปรแกรม Desktop (Electron) จะชี้ไปที่ `localhost` ทำให้เรียก API ไม่ติด
   - **ต้อง** ใช้ `getVercelBaseUrl()` นำหน้าเสมอ เช่น:
     ```typescript
     const vercelUrl = getVercelBaseUrl();
     await fetch(`${vercelUrl}/api/ocr-process`, { ... });
     ```
2. **มาตรฐาน CORS ในทุก Serverless API (`api/*.ts`)**:
   - ทุก API endpoint ที่รับ Request จาก Client ต้องมี CORS Headers และรองรับ HTTP `OPTIONS` Preflight เสมอ:
     ```typescript
     const corsHeaders = {
       'Access-Control-Allow-Origin': '*',
       'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
       'Access-Control-Allow-Headers': 'Content-Type, Authorization',
       'Content-Type': 'application/json'
     };

     if (req.method === 'OPTIONS') {
       return new Response(null, { status: 204, headers: corsHeaders });
     }
     ```

### Rule G — Google Drive Binary Download Conversion
- เมื่อฟังก์ชันใน `api/*.ts` ต้องดาวน์โหลดไฟล์เอกสารเพื่อนำมาทำ OCR หรือประมวลผล PDF/รูปภาพ:
  - **ห้าม** `fetch(fileUrl)` ตรง ๆ กับลิงก์ Google Drive Preview (`drive.google.com/file/d/.../view`) เพราะจะได้หน้า HTML แทนที่จะเป็นไฟล์ Binary
  - **ต้อง** แปลงเป็น Direct Download Link ก่อนเสมอ:
    ```typescript
    function getDirectDownloadUrl(url: string): string {
      if (!url) return '';
      if (url.includes('drive.google.com')) {
        const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        const fileId = match1?.[1] || match2?.[1];
        if (fileId) {
          return `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
      }
      return url;
    }
    ```

---

## 📌 ข้อมูลและประวัติการพัฒนา (Development History)
1. **ระบบทะเบียนรูปนักกีฬาเปตอง (หน้า [Athletics.tsx](file:///C:/Users/bkky9/OneDrive/Desktop/school-admin-multischool/src/pages/Athletics.tsx))**:
   * **การแยกระดับการแข่งขัน**: แยก State การจัดทีมเปตองและการเก็บรูปภาพ Base64 ระหว่าง **กีฬา อบต. (local)** และ **กีฬาจังหวัด (provincial)** อย่างเด็ดขาด ป้องกันข้อมูลและภาพ Base64 ทับซ้อนเมื่อเปลี่ยนระดับแข่ง
   * **ระบบ Preview และ Print (PDF)**: ทั้งฟอร์มแยกชาย/หญิง (`PETANQUE`) และฟอร์มผสมชาย/หญิง (`PETANQUE_MIXED`) จะดึงข้อมูล รายชื่อตัวเลือก และภาพ Base64 จาก State ของระดับแข่งขันที่สอดคล้องกับที่ผู้ใช้เลือกในขณะนั้นอย่างสมบูรณ์
   * **การแก้ไข JSX Bracket & HTML Tag Error**: ปิดแท็ก wrapper `print-mode-root`, `tbody`, `table`, และ block JSX `if (isPrintMode)` ครบถ้วน
   * **คำนำหน้านาม**: นักกีฬาทุกคนที่แสดงในตาราง, Dropdown, หน้า Preview, และหน้าพิมพ์เอกสารจริง จะต้องมีคำนำหน้านามนำหน้าชื่อจริงเสมอ ("ด.ช." / "ด.ญ.")
   * **การคงอยู่ของรูปภาพ**: รูปภาพของเปตองแยกตามระดับแข่งขัน และจะไม่หายหรือโหลดทับกันเมื่อมีการสลับการทำงาน

