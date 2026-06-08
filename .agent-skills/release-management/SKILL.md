---
name: multi-school-release-management
description: >-
  Manages version bumping, compiling, Vercel deploying, and Electron building 
  for multiple schools (koko and school2) in the school-admin project.
---

# Skill: Multi-School Release & Deployment Management 🚀🏫

ทักษะนี้ระบุขั้นตอนการทำงานมาตรฐานสำหรับการอัปเดตเวอร์ชัน, การคอมไพล์โค้ด (Vite), การ Deploy ขึ้น Vercel Production และการสร้างตัวติดตั้งเดสก์ท็อป (Electron) แยกรายโรงเรียน พร้อมการอัปโหลดขึ้น GitHub Releases

---

## 🎯 วัตถุประสงค์
เพื่ออัปเดตระบบ หน้าเว็บ และปล่อยตัวติดตั้งแอปเดสก์ท็อปสำหรับทุกโรงเรียนในระบบให้เป็นเวอร์ชันเดียวกันอย่างปลอดภัย ป้องกันปัญหาข้อมูลชื่อโรงเรียนปะปนในตราประทับเกษียณ และรักษาเสถียรภาพการตรวจสอบประเภทข้อมูล (TypeScript)

## 📋 ขั้นตอนการทำงานมาตรฐาน (Standard Operating Procedure)

### ขั้นที่ 1: ตรวจสอบและอัปเดตเวอร์ชันในโค้ด (Version Bump)
ก่อนทำการเผยแพร่ ต้องอัปเดตเวอร์ชันเป็นเวอร์ชันเดียวกันใน 3 จุดนี้:
1. **`package.json`**: เปลี่ยนค่าคีย์ `"version": "x.y.z"`
2. **`.env`**: เปลี่ยนค่าตัวแปร `VITE_APP_VERSION=x.y.z`
3. **`src/pages/Settings.tsx`**: 
   * แก้ไขเวอร์ชันปัจจุบัน (Fallback) ให้ตรงกับเลขเวอร์ชันใหม่ (เช่น `{import.meta.env.VITE_APP_VERSION || 'x.y.z'}`)
   * เพิ่มรายการประวัติการแก้ไข (Changelog) ล่าสุดไว้บนสุด และเปลี่ยนจุดแสดงผลเวอร์ชันก่อนหน้าให้เป็นสีเทา (`bg-slate-300`)

### ขั้นที่ 2: ตรวจสอบและบิลด์ทดสอบความถูกต้อง (Vite Compile Check)
ทดสอบคอมไพล์โปรเจกต์ด้วยคำสั่งบิลด์หลักเพื่อตรวจสอบ syntax error และ TypeScript type error:
```powershell
npm run build
```
*กฎเหล็ก: ห้าม Deploy หากคำสั่งนี้แจ้งข้อผิดพลาดเด็ดขาด*

### ขั้นที่ 3: เผยแพร่เว็บแอป (Deploy Vercel Production)
เผยแพร่หน้าเว็บและระบบ Webhook ล่าสุดขึ้นสู่ Vercel Production:
```powershell
npx vercel --prod --yes
```

### ขั้นที่ 4: Commit และ Push ข้อมูลขึ้น Git
ส่งซอร์สโค้ดและข้อมูล Changelog เวอร์ชันใหม่ขึ้น GitHub:
```powershell
git add package.json .env src/pages/Settings.tsx
git commit -m "bump: version x.y.z"
git push origin multischool
```

### ขั้นที่ 5: Build และปล่อย Releases ของ Electron App (แยกรายโรงเรียน)
การทำ Multi-School ต้องทำการบิลด์แอปพลิเคชันแยกเป็น 2 ตัวติดตั้งเพื่อความเสถียรของแบรนดิ้งของแต่ละโรงเรียน โดยกำหนดค่า `GH_TOKEN` ชั่วคราวก่อนสั่งบิลด์:

```powershell
# 1. สำหรับโรงเรียนบ้านควนโคกยา (koko)
$env:GH_TOKEN="<your_github_token>"; npx tsc -b; if ($?) { npx vite build --mode koko }; if ($?) { npx electron-builder --config electron-builder-koko.json --publish always }

# 2. สำหรับโรงเรียนที่สอง (school2)
$env:GH_TOKEN="<your_github_token>"; npx tsc -b; if ($?) { npx vite build --mode school2 }; if ($?) { npx electron-builder --config electron-builder-school2.json --publish always }
```

---

## ⚠️ กฎสำคัญที่ต้องปฏิบัติตาม (Crucial Rules)
* **ความปลอดภัยของ Token:** ห้ามนำคีย์ `GH_TOKEN` หรือ API Keys ใดๆ ไปบันทึกเก็บไว้ในซอร์สโค้ดหรือเขียนลงในไฟล์ Config เด็ดขาด ให้กำหนดเป็น Environment variable ชั่วคราวใน Terminal เท่านั้น
* **การตั้งชื่อและรักษาสิทธิ์:** ตรวจสอบให้แน่ใจว่าได้ใช้ไฟล์คอนฟิกเฉพาะตัวติดตั้งที่ถูกต้องในการบิลด์ ได้แก่ `electron-builder-koko.json` และ `electron-builder-school2.json` เพื่อป้องกันชื่อโรงเรียนและชอร์ตคัตเกิดข้อขัดแย้งกันในเครื่องผู้ใช้
* **การจัดการ GitHub Release:** ตรวจสอบให้มั่นใจว่าไฟล์ตัวติดตั้ง `.exe` ของทุกโรงเรียนในเวอร์ชันนั้น ๆ อัปโหลดขึ้นไปรวมอยู่ใน Tag เดียวกันในหน้า GitHub Releases
