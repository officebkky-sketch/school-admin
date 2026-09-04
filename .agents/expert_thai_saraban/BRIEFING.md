# 📜 ทีมที่ ๑: Thai Saraban & PDF Stamping Master (ทีมงานสารบรรณและตราประทับดิจิทัล)

## 📌 ข้อมูลประจำทีม
* **รหัสทีมงาน:** `expert_thai_saraban`
* **โมเดลขับเคลื่อนใน AiPASS:** `Pathumma ThaiLLM` / `Claude Sonnet 5` (Task Class: `thai_creative` / `code`)
* **สกิลที่ครอบครอง:**
  * `nong-chaba-school-assistant` (มาตรฐานเลขไทย ๑๐๐%, Signature Balancing, ตราโรงเรียน 80px -20px)
  * `thai-saraban-pdf-engine` (พิกัดตราเกษียณหน้าสุดท้าย, ระบบป้องกัน Double Stamping, Cache-Busting `?t=timestamp`)
  * `thai-arabic-numeral-harmonizer` (แปลงเลขไทยหน้าพิมพ์ - บันทึกเลขอารบิกใน Database)
* **ไฟล์ที่รับผิดชอบ:**
  * `src/pages/IncomingDocs.tsx` (กฎเหล็ก: ห้ามแก้ไขหากไม่ได้รับคำสั่งโดยตรง)
  * `src/pages/OutgoingDocs.tsx`
  * `src/pages/Memos.tsx`
  * `src/pages/Orders.tsx`
  * `src/lib/pdfService.ts`
  * `src/lib/docSequence.ts`
  * `src/lib/docChecker.ts`

---

## 🔍 บทวิเคราะห์ระบบ As-Is
1. **ระบบประทับตราดิจิทัล (PDF Stamping):** ทำงานได้แม่นยำในหน้าสุดท้าย ป้องกันการประทับซ้ำซ้อน และใช้เทคนิค Cache-Busting เพื่อข้ามแคชเบราว์เซอร์
2. **การออกเลขทะเบียนหนังสือ:** รองรับการจัดลำดับเลขรับ เลขส่ง และเลขบันทึกข้อความแยกตามปีปฏิทินและปีงบประมาณ
3. **การแสดงผลเอกสารราชการ:** จัดวางฟอนต์ TH Sarabun New พร้อมแปลงตัวเลขเป็นเลขไทย ๑๐๐% ในรายงานและใบสำคัญจ่าย

## 💡 ข้อเสนอแนะเชิงกลยุทธ์และการปรับปรุง (Recommendations)
1. **Atomic Sequence Locking:** ในการออกเลขที่หนังสือราชการ ให้ใช้ Database Function หรือ Transaction Lock เพื่อป้องกัน Race Condition เมื่อมีครูหรือบอทกดลงรับหนังสือพร้อมกันในเสี้ยววินาที
2. **QR Code Verification Link:** เพิ่ม QR Code ขนาดเล็ก (1.5x1.5 cm) บนมุมขวาบนของเอกสารคำสั่งและหนังสือรับ เพื่อให้สแกนตรวจสอบความถูกต้อง (Verification Portal) เทียบ Hash (SHA-256) ของไฟล์กับ Supabase
3. **Smart PDF Compression:** ตรวจสอบขนาดไฟล์ PDF ก่อนบันทึกเข้า Google Drive/Supabase Storage หากไฟล์เกิน 10MB ให้ทำการบีบอัดหน้าเอกสารอัตโนมัติ เพื่อป้องกันปัญหา 504 Timeout จากภายนอก
