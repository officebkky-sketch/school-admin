# 🏫 ทีมที่ ๓: School ERP, Student Registry & Matrix (ทีมทะเบียนนักเรียน การศึกษา และการเงินพัสดุโรงเรียน)

## 📌 ข้อมูลประจำทีม
* **รหัสทีมงาน:** `expert_school_erp`
* **โมเดลขับเคลื่อนใน AiPASS:** `DeepSeek R1` / `Claude Sonnet 5` (Task Class: `math_research` / `code`)
* **สกิลที่ครอบครอง:**
  * `parent-academic-telemetry` (สถิติการมาเรียน, รายงาน LEC-1/LEC-2, บัตรรายงานผล)
  * `school-portal-onboarding` (DMC Roster CSV/Excel Ingestion, การสลับปีการศึกษา Dynamic Year)
  * `spth-government-finance-engine` (คำนวณเงินอุดหนุนเรียนฟรี 15 ปี, Baht Text Converter, จัดซื้อจัดจ้าง e-GP)
  * `multi-tier-athletics-registry` (ระบบทะเบียนนักกีฬาเปตอง แยก State และรูปภาพ อบต. vs จังหวัด)
* **ไฟล์ที่รับผิดชอบ:**
  * `src/pages/Students.tsx`
  * `src/pages/ServiceArea.tsx` (สำมะโน ทร.14)
  * `src/pages/LECReports.tsx`, `src/pages/CustomStudentPrint.tsx`
  * `src/pages/Attendance.tsx`, `src/pages/AttendanceReport.tsx`
  * `src/pages/FreeEducation.tsx`, `src/pages/Finance.tsx`, `src/pages/Procurement.tsx`, `src/pages/Utilities.tsx`
  * `src/pages/Athletics.tsx`
  * `src/lib/studentImport.ts`, `src/lib/dmcImport.ts`

---

## 🔍 บทวิเคราะห์ระบบ As-Is
1. **DMC Ingestion & Promotion Matrix:** รองรับการนำเข้าไฟล์ข้อมูลนักเรียน 36 ฟิลด์ และมีระบบเลื่อนชั้นนักเรียนข้ามปีการศึกษาอัตโนมัติ
2. **ระบบเงินเรียนฟรี 15 ปี:** มีระบบแยกชุดเอกสาร ค่าเครื่องแบบ/อุปกรณ์ คำนวณเงินตามระดับชั้นและแปลงยอดเงินเป็นตัวอักษรภาษาไทย (Baht Text) ถูกต้องแม่นยำ
3. **ระบบจัดซื้อจัดจ้างและสาธารณูปโภค:** สร้างบันทึกข้อความและใบปะหน้าเบิกจ่ายตรงตามระเบียบกระทรวงการคลัง บังคับพิมพ์แนวตั้งพร้อมตราครุฑ

## 💡 ข้อเสนอแนะเชิงกลยุทธ์และการปรับปรุง (Recommendations)
1. **Modulo 11 National ID Validation:** เพิ่มระบบตรวจสอบความถูกต้องของเลขประจำตัวประชาชน 13 หลักด้วยฟังก์ชันคณิตศาสตร์ Modulo 11 ตั้งแต่ฝั่ง Client และ Database Constraint เพื่อป้องกันครูกรอกเลขบัตรผิด
2. **DMC Column Auto-Mapping & Preview:** เพิ่มหน้าจอตรวจสอบตัวอย่างข้อมูล (Data Preview Modal) ก่อนทำการกดยืนยันบันทึกลง Supabase เพื่อให้ครูเห็นจำนวนแถวที่ผ่านและแถวที่ข้อมูลไม่สมบูรณ์
3. **Double-Entry Budgeting Integration:** วางโครงสร้างบัญชีแยกประเภท (General Ledger) ระหว่างเงินอุดหนุนรายหัว, เงินเรียนฟรี 15 ปี, และเงินบริจาค เพื่อให้สามารถออกรายงานงบดุลประจำปีของสถานศึกษาได้ในคลิกเดียว
