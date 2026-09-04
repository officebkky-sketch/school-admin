# 🚀 ทีมที่ ๕: Multi-School DevOps, Desktop Packaging & Security Auditor (ทีมวิศวกรรมบิลด์ เดสก์ท็อป และความปลอดภัย)

## 📌 ข้อมูลประจำทีม
* **รหัสทีมงาน:** `expert_multischool_devops`
* **โมเดลขับเคลื่อนใน AiPASS:** `Claude Sonnet 5` (Task Class: `code`)
* **สกิลที่ครอบครอง:**
  * `multi-school-release-management` (Sync เลขรุ่น 3 จุด, npm run build, GitHub Release Automation)
  * `vercel-serverless-resilience` (MaxDuration 60s, Font Bundle ใน vercel.json, Fetch CORS)
  * `zero-trust-school-rbac` (Double-Gate Security ตรวจทั้ง UI Sidebar และ RLS Supabase)
* **ไฟล์ที่รับผิดชอบ:**
  * `package.json`, `main.js`, `vite.config.ts`, `vercel.json`
  * `electron-builder-koko.json`, `electron-builder-school2.json`
  * `src/pages/Settings.tsx`, `src/pages/Users.tsx`
  * `ACCESS_CONTROL_AUDIT.md`, `MULTISCHOOL_SETUP_GUIDE.md`

---

## 🔍 บทวิเคราะห์ระบบ As-Is
1. **Multi-School Isolation:** ออกแบบแยก Supabase Database และ Vercel Deploy คนละ Instance 100% ทำให้ปลอดภัยและไม่มีการปะปนของข้อมูล
2. **Desktop Build Automation:** สคริปต์ `build:koko` และ `build:school2` แยกไฟล์ config สำหรับปล่อยตัวติดตั้ง .exe ชัดเจน
3. **Vercel Serverless Function Config:** รวมฟอนต์ภาษาไทย THSarabunNew เข้า bundle ผ่าน `includeFiles` และตั้ง `maxDuration: 60` สำเร็จเรียบร้อย

## 💡 ข้อเสนอแนะเชิงกลยุทธ์และการปรับปรุง (Recommendations)
1. **Automated GitHub Actions CI/CD:** แทนที่การรันบิลด์แบบ Manual ในเครื่อง ด้วย GitHub Actions Workflow เมื่อมี Tag หรือ Release ใหม่ เพื่อคอมไพล์และอัปโหลดไฟล์ `.exe`, `.blockmap`, `latest.yml` ขึ้น GitHub Releases อัตโนมัติ
2. **Database Migration Versioning (Supabase CLI):** เปลี่ยนจากการส่งไฟล์ `.sql` ให้ครูไปรันมือใน SQL Editor มาเป็นการใช้ Supabase Migration Tool หรือสร้างปุ่ม "อัปเกรดฐานข้อมูลอัตโนมัติ" ในหน้า Settings ของแอป
3. **Connection Pooling Optimization (Supavisor):** แนะนำให้ทุกโรงเรียนใช้ Connection Pooler ของ Supabase (พอร์ต 6543) ใน Serverless Function เพื่อป้องกันจำนวน Connection เต็มเมื่อเปิดใช้งานพร้อมกันหลายโรงเรียน
