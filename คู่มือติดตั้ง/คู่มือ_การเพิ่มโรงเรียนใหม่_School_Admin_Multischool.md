# 🏫 คู่มือการติดตั้งและตั้งค่าระบบ: การเพิ่มโรงเรียนใหม่เข้าสู่ระบบบริหารสถานศึกษาอัจฉริยะ
> **ระบบ:** School Admin Multischool  
> **สถาปัตยกรรม:** แยกฐานข้อมูล (Dedicated Supabase Project) และแยกการ Deploy (Dedicated Vercel Deployment)  
> **แกนซอร์สโค้ด:** GitHub Repository: `officebkky-sketch/school-admin` (Branch: `multischool`)  
> **วันที่จัดทำ:** ๕ พฤศจิกายน ๒๕๖๙

---

## 📌 บทนำ: ทำไมต้องใช้สถาปัตยกรรม "แยกฐานข้อมูล แยก Vercel"?

ระบบบริหารสถานศึกษาอัจฉริยะออกแบบขึ้นภายใต้แนวคิด **Twin Schools / Multi-Tenant Isolation** โดยมีจุดเด่นสำคัญ ๔ ประการ:

1. **ความปลอดภัยและการแยกขาดของข้อมูล ๑๐๐% (Data Security & Zero Leakage)**:
   - ข้อมูลของแต่ละโรงเรียน (ทะเบียนนักเรียน, บัญชีผู้ใช้, คำสั่งแต่งตั้ง, เอกสารงบประมาณ และหนังสือราชการลับ) จะถูกจัดเก็บอยู่ใน **Supabase Project แยกต่างหากคนละฐานข้อมูล**
   - ไม่มีทางที่ข้อมูลของโรงเรียนหนึ่งจะรั่วไหลหรือปนเปื้อนไปยังอีกโรงเรียนหนึ่งเด็ดขาด
2. **ประหยัดค่าใช้จ่าย ๑๐๐% (Free Tier Maximization)**:
   - แต่ละโรงเรียนได้โควตาฟรีแยกเป็นเอกเทศ (Supabase Database 500 MB, Storage 1 GB, Vercel Bandwidth 100 GB)
   - ไม่มีการแย่งโควตากัน ทำให้ใช้งานได้ฟรีตลอดชีพตามเงื่อนไข Free Tier
3. **การดูแลรักษาโค้ดแบบจุดเดียว (Zero-Maintenance Codebase)**:
   - ทุกโรงเรียนใช้ซอร์สโค้ดชุดเดียวกันจาก GitHub Repo หลัก (`officebkky-sketch/school-admin` สาขา `multischool`)
   - เมื่อมีการพัฒนาฟีเจอร์ใหม่หรือแก้บั๊ก แล้ว Push โค้ดขึ้น GitHub ระบบ Vercel ของทุกโรงเรียนจะ Build และอัปเดตให้อัตโนมัติในไม่กี่วินาที
4. **ความยืดหยุ่นในการปรับแต่งอัตลักษณ์ (Independent School Identity)**:
   - แต่ละโรงเรียนมีชื่อ สังกัด ตราสัญลักษณ์ ลายเซ็น ผอ. รหัสหนังสือส่ง และกลุ่มแจ้งเตือน Telegram/LINE ของตนเองอย่างอิสระ

---

## 🛠️ ขั้นตอนที่ ๑: การติดตั้งฐานข้อมูล Supabase สำหรับโรงเรียนใหม่ (Database Setup)

> [!IMPORTANT]
> **กฎเหล็กเรื่องฐานข้อมูล:** ห้ามใช้ฐานข้อมูลร่วมกับโรงเรียนอื่นเด็ดขาด และต้องรันสคริปต์ Master Setup เพื่อให้มีตารางครบ ๕๓ ตาราง สิทธิ์ RLS และ Storage Buckets ครบถ้วน

### ๑.๑ การสร้าง Supabase Project ใหม่
1. เข้าสู่ระบบที่ [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. คลิกปุ่ม **"New Project"**
3. กรอกข้อมูลสำคัญ:
   - **Name:** ตั้งชื่อตามโรงเรียนใหม่ เช่น `school-admin-school3` (หรือชื่อย่อโรงเรียน)
   - **Database Password:** ตั้งรหัสผ่านฐานข้อมูลที่มีความปลอดภัยสูง (ต้องจดบันทึกไว้)
   - **Region:** เลือก **Singapore (ap-southeast-1)** ซึ่งเป็นดาต้าเซ็นเตอร์ที่ใกล้ประเทศไทยที่สุด
   - **Pricing Plan:** เลือก **Free Tier** ($0/month)
4. รอระบบ Supabase ติดตั้งระบบประมาณ ๑-๒ นาที จนสถานะขึ้นสีเขียว

### ๑.๒ การรันสคริปต์ Master All-in-One SQL Setup
1. ในหน้า Dashboard ของโรงเรียนใหม่ ให้คลิกเมนู **"SQL Editor"** (ไอคอน `>_` ด้านซ้าย)
2. คลิกปุ่ม **"New query"**
3. เปิดไฟล์สคริปต์:
   `คู่มือติดตั้ง\00_MASTER_ALL_IN_ONE_NEW_SCHOOL_SETUP.sql`
4. คัดลอกเนื้อหาทั้งหมดในไฟล์มาวางในช่อง SQL Editor
5. กดปุ่ม **"Run"** (หรือกดปุ่ม `Ctrl + Enter`)
6. ระบบจะดำเนินการอัตโนมัติ:
   - ✅ เปิดใช้งาน Extensions: `uuid-ossp`, `pgcrypto`, `vector`
   - ✅ สร้างตารางครบทั้ง **๕๓ ตาราง** พร้อมฟิลด์ระบบล่าสุด (`doc_year`, `doc_sequence`, `action_deadline`, `is_reserved`)
   - ✅ สร้าง Storage Buckets: `system`, `reports`, `temp_docs` พร้อมนโยบายสิทธิ์การเข้าถึง
   - ✅ ผูก Trigger เชื่อมต่อ `auth.users` กับ `public.profiles` อัตโนมัติ
   - ✅ เปิดใช้งาน Row Level Security (RLS) ทุกตาราง
   - ✅ **กำหนดสิทธิ์ Data API Explicit GRANT ตามกฎ Rule J (Supabase Post-Oct 30 Requirement)** ให้กับ `authenticated`, `service_role`, และ `anon` ป้องกัน Error 401/403
   - ✅ สร้างข้อมูลเริ่มต้นในตาราง `settings` ๑ แถว (ตาม Rule C)

### ๑.๓ การคัดลอก API Keys ประจำโรงเรียนใหม่
ไปที่เมนู **Project Settings** (ไอคอนฟันเฟืองล่างซ้าย) ➔ เลือกแถบ **Data API**:
จดบันทึกค่า ๓ ค่านี้ไว้สำหรับนำไปใส่ใน Vercel:
- **Project URL:** เช่น `https://abcdefghijklm.supabase.co`
- **anon / public key:** คีย์สาธารณะสำหรับหน้าเว็บ
- **service_role key:** คีย์ลับสำหรับระบบเบื้องหลัง (กด Reveal secret ก่อนคัดลอก)

---

## 🌐 ขั้นตอนที่ ๒: การเชื่อมต่อและ Deploy บน Vercel (Dedicated Hosting)

### ๒.๑ การสร้าง Project บน Vercel
1. เข้าสู่ระบบที่ [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. คลิกปุ่ม **"Add New..." ➔ "Project"**
3. เลือก Import จาก Git Repository เดิม:
   - **Git Repository:** `officebkky-sketch/school-admin`
   - **Project Name:** ตั้งชื่อโปรเจกต์ของโรงเรียนใหม่ เช่น `school-admin-xxx`
   - **Framework Preset:** Vite (ระบบจะตรวจจับให้อัตโนมัติ)
   - **Root Directory:** `./`
4. ในส่วน **Build and Output Settings:**
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### ๒.๒ การกำหนดค่าตัวแปรระบบ (Environment Variables)
ในหัวข้อ **Environment Variables** ให้เพิ่มตัวแปรของโรงเรียนใหม่ให้ครบถ้วน:

| ตัวแปร (Key) | ค่าที่ต้องใส่ (Value) | คำอธิบาย |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | URL ของ Supabase โรงเรียนใหม่ |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | anon public key ของโรงเรียนใหม่ |
| `SUPABASE_URL` | `https://xxxx.supabase.co` | URL ของ Supabase (สำหรับ API Serverless) |
| `SUPABASE_ANON_KEY` | `eyJhbGciOi...` | anon key (สำหรับ API Serverless) |
| `SUPABASE_SERVICE_ROLE_KEY`| `eyJhbGciOi...` | service_role key ลับของโรงเรียนใหม่ |
| `GEMINI_API_KEY` | `AIzaSy...` | Google Gemini API Key สำหรับระบบ AI OCR |
| `CRON_SECRET` | `สุ่มรหัสผ่านยาว 16+ หลัก` | รหัสผ่านป้องกันบอทเรียกใช้ Cron เตือนเอกสาร |
| `TELEGRAM_BOT_TOKEN` | `7123456789:AA...` | โทเคนบอท Telegram สำหรับแจ้งเตือน |

### ๒.๓ การตรวจสอบ Branch และเริ่ม Deploy
1. ตรวจสอบให้แน่ใจว่าเลือก Production Branch เป็น **`multischool`**
2. กดปุ่ม **"Deploy"**
3. ระบบ Vercel จะดึงโค้ดและทำการคอมไพล์ประมาณ ๑ นาที เมื่อเสร็จแล้วจะได้รับ URL ประจำโรงเรียนใหม่ เช่น:
   `https://school-admin-xxx.vercel.app`

---

## 🏫 ขั้นตอนที่ ๓: การลงทะเบียนผู้ดูแลระบบและการตั้งค่าสถานศึกษา (School Onboarding)

### ๓.๑ การสร้างบัญชีผู้ดูแลระบบคนแรก (First Admin Setup)
1. เปิดหน้าเว็บระบบของโรงเรียนใหม่ (`https://school-admin-xxx.vercel.app`)
2. คลิกปุ่ม **"ลงทะเบียน / Sign Up"**
3. กรอกอีเมลและรหัสผ่านของผู้ดูแลระบบโรงเรียนใหม่
4. เมื่อสมัครสำเร็จ ระบบ Trigger ในฐานข้อมูลจะสร้างเรคอร์ดลงในตาราง `profiles` อัตโนมัติ
5. ใน Supabase SQL Editor ให้รันคำสั่งมอบสิทธิ์ Admin สูงสุดให้ผู้ใช้คนแรก:
   ```sql
   UPDATE public.profiles 
   SET role = 'admin' 
   WHERE email = 'อีเมลของผู้ดูแลระบบ';
   ```

### ๓.๒ การตั้งค่าข้อมูลสถานศึกษาในหน้า Settings
เข้าสู่ระบบด้วยบัญชี Admin แล้วไปที่เมนู **"ตั้งค่าสถานศึกษา (Settings)"**:
1. **ข้อมูลทั่วไป:**
   - **ชื่อสถานศึกษา:** กรอกชื่อเต็มของโรงเรียนใหม่ เช่น *โรงเรียนบ้าน...*
   - **สังกัด:** สำนักงานเขตพื้นที่การศึกษาประถมศึกษา... เขต ...
   - **รหัสหนังสือราชการ:** เช่น `ที่ ศธ 04225.xxx/` (เปลี่ยน `xxx` เป็นรหัสของโรงเรียนใหม่)
2. **ผู้บริหารและผู้รับผิดชอบงาน:**
   - **ชื่อ-สกุล ผู้อำนวยการโรงเรียน:** เพื่อนำไปแสดงในตรายางคำสั่ง ผอ. และหนังสือส่ง
   - **ตำแหน่ง:** ผู้อำนวยการสถานศึกษา
   - **เจ้าหน้าที่งานสารบรรณ:** ชื่อผู้รับผิดชอบงานธุรการ
   - **เจ้าหน้าที่การเงิน/พัสดุ:** ชื่อผู้รับผิดชอบงานการเงิน
3. **ตราสัญลักษณ์และลายเซ็นดิจิทัล:**
   - อัปโหลด **ภาพตราสัญลักษณ์โรงเรียน** (จะถูกเก็บใน bucket `system`)
   - อัปโหลด **ภาพตรายางประทับ** และ **ลายเซ็นดิจิทัล ผอ.**

### ๓.๓ การนำเข้าข้อมูลคุณครูและนักเรียน
1. ไปที่เมนู **"ข้อมูลครูและบุคลากร"**: เพิ่มรายชื่อครูประจำการและกลุ่มงานที่รับผิดชอบ
2. ไปที่เมนู **"ทะเบียนนักเรียน"**: นำเข้าไฟล์รายชื่อนักเรียน (CSV / Excel) แยกตามชั้นเรียน

---

## 📱 ขั้นตอนที่ ๔: การตั้งค่าระบบแจ้งเตือน Telegram / LINE

### ๔.๑ การตั้งค่ากลุ่ม Telegram ตามกฎ Rule B
ระบบรองรับการส่งแจ้งเตือน ๒ กลุ่มงานผ่านการคั่นด้วยเครื่องหมาย Pipe (`|`):
- ไปที่หน้า **Settings** ในระบบ
- ในช่อง **Telegram Group ID** ให้กรอกในรูปแบบ:
  `[Group ID ส่วนกลาง]|[Group ID เสนอหนังสือ]`
  - **กลุ่มส่วนกลาง (ด้านหน้า):** สำหรับรับแจ้งเตือนหนังสือเข้าทั่วไป, งานเร่งด่วน, แจ้งเตือนเช็คชื่อ
  - **กลุ่มเสนอหนังสือ (ด้านหลัง):** สำหรับแจ้งเตือนการเสนอแฟ้มและให้ ผอ. กดเกษียณสั่งการ
- ใส่ **Telegram Bot Token** ประจำโรงเรียนใหม่

---

## 💻 ขั้นตอนที่ ๕: (ทางเลือกเสริม) การสร้างตัวติดตั้ง Desktop App (.exe)

หากโรงเรียนใหม่ต้องการใช้งานในรูปแบบโปรแกรมเดสก์ท็อปประจำเครื่อง:
1. เปิดโปรเจกต์ `C:\Users\bkky9\OneDrive\Desktop\school-admin-multischool`
2. สร้างไฟล์คอนฟิก `electron-builder-school3.json`:
   ```json
   {
     "appId": "com.schooladmin.school3",
     "productName": "ชื่อโรงเรียนใหม่",
     "directories": { "output": "dist-installer" },
     "nsis": {
       "oneClick": false,
       "allowToChangeInstallationDirectory": true,
       "createDesktopShortcut": true,
       "shortcutName": "ชื่อโรงเรียนใหม่"
     },
     "win": {
       "target": "nsis",
       "icon": "public/logo.png",
       "artifactName": "${name}-school3-setup-${version}.${ext}"
     }
   }
   ```
3. สร้างไฟล์ `.env.school3` ระบุ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ของโรงเรียนใหม่
4. เพิ่ม Script ใน `package.json`:
   `"build:school3": "tsc -b && vite build --mode school3 && electron-builder --config electron-builder-school3.json"`
5. สั่งรัน `npm run build:school3` จะได้รับไฟล์ `.exe` สำหรับนำไปติดตั้งในเครื่องคอมพิวเตอร์ธุรการของโรงเรียนใหม่ทันที

---

## ✅ ตารางตรวจสอบความพร้อมก่อนส่งมอบงาน (Quality Checklist)

| ลำดับ | รายการตรวจสอบ | สถานะ |
| :---: | :--- | :---: |
| ๑ | สร้าง Supabase Project ใน Region Singapore สำเร็จ | [ ] |
| ๒ | รันสคริปต์ Master All-in-One SQL ครบ ๕๓ ตาราง ไม่พบ Error | [ ] |
| ๓ | Storage Buckets (`system`, `reports`, `temp_docs`) สร้างและเปิด Public แล้ว | [ ] |
| ๔ | สิทธิ์ Explicit GRANT ตาม Rule J ถูกต้อง (ไม่ติด Error 401/403) | [ ] |
| ๕ | Deploy บน Vercel ผ่านสำเร็จ และผูกกับ Branch `multischool` | [ ] |
| ๖ | ตั้งค่า Environment Variables ใน Vercel ครบทั้ง ๘ ตัวแปร | [ ] |
| ๗ | สมัครบัญชี Admin คนแรก และปรับสิทธิ์เป็น `admin` ในฐานข้อมูลแล้ว | [ ] |
| ๘ | ตั้งค่าชื่อโรงเรียน, รหัสหนังสือราชการ, และชื่อ ผอ. ในหน้า Settings เรียบร้อย | [ ] |
| ๙ | ทดสอบการลงรับหนังสือ ๑ ฉบับ และตรวจสอบการประทับตรายาง ๓ จุด | [ ] |
| ๑๐ | ทดสอบการแจ้งเตือนผ่าน Telegram เข้ากลุ่มของโรงเรียนใหม่ | [ ] |

---
*จัดทำโดย: ทีมวิศวกรรมระบบ School Admin Multischool*
