# รายงานการตรวจสอบระบบสิทธิ์การเข้าถึงและความปลอดภัย (Access Control & Security Audit Report)
**โครงการ:** ระบบบริหารจัดการข้อมูลโรงเรียน (school-admin)  
**วันที่ตรวจสอบ:** 28 พฤษภาคม 2569  
**ผู้ตรวจสอบ:** Antigravity (AI Coding Assistant)  

---

## 📌 ภาพรวมการตรวจสอบ (Executive Summary)
จากการตรวจสอบโครงสร้างการจัดการสิทธิ์การเข้าถึงของผู้ใช้ (User Access & Permissions Roles) ทั้งในส่วนของฐานข้อมูล (Supabase Backend) และส่วนแสดงผลหน้าจอ (React Frontend) พบประเด็นสำคัญที่ต้องปรับปรุงเพื่อความปลอดภัยของข้อมูล และเพื่อให้เป็นไปตามนโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA) ของโรงเรียนบ้านควนโคกยา โดยสรุปดังนี้:

1. **ระดับฐานข้อมูล (Database Security - Supabase RLS):** พบว่าตารางข้อมูลที่สำคัญมาก เช่น ข้อมูลนักเรียน (`students`), ข้อมูลครู (`teachers`) และเอกสารราชการต่างๆ **ไม่ได้เปิดใช้งาน Row Level Security (RLS)** ทำให้เกิดช่องโหว่ที่ผู้ใช้ทั่วไปที่มี API Key สามารถดึงข้อมูลหรือแก้ไขข้อมูลได้โดยตรงผ่าน API
2. **ระดับหน้าจอใช้งาน (Frontend Authorization - React):** สิทธิ์พิเศษรายบุคคล เช่น `access_student_affairs` (งานทะเบียน/กิจการนักเรียน) มีการสร้างไว้ในหน้าจัดการสิทธิ์ แต่ในเมนู "ข้อมูลนักเรียน" ของหน้าจอหลัก (`App.tsx`) และหน้าแสดงผลข้อมูลนักเรียน (`Students.tsx`) กลับ **ไม่มีการตรวจสอบสิทธิ์นี้** ทำให้ผู้ใช้ทุกคนที่ไม่ใช่ Guest สามารถเข้าถึงและแก้ไขข้อมูลได้ทั้งหมด

---

## 📊 ตารางสรุปสิทธิ์การเข้าถึงเมนูและระบบงานต่างๆ ในปัจจุบัน (Current Permissions Matrix)

| เมนู / ระบบงาน | ผู้ดูแลระบบ (Admin) | ผู้บริหาร (Director) | ครูทั่วไป (Teacher) | ครูที่มีสิทธิ์พิเศษ (Teacher with Custom Perms) | ผู้ใช้รออนุมัติ (Guest) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **แดชบอร์ด** | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ (เมนูเดียวที่เข้าได้) |
| **ข้อมูลส่วนตัว & ลายเซ็น** | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ❌ เข้าไม่ได้ |
| **ระบบรายงานอัจฉริยะ** | ✅ เข้าได้ | ✅ เข้าได้ | ❌ เข้าไม่ได้ | ✅ เข้าได้ (เมื่อมี `access_reports`) | ❌ เข้าไม่ได้ |
| **หนังสือรับ / หนังสือส่ง** | ✅ เข้าได้ | ✅ เข้าได้ | ❌ เข้าไม่ได้ | ✅ เข้าได้ (เมื่อมี `access_administrative`) | ❌ เข้าไม่ได้ |
| **คำสั่งโรงเรียน** | ✅ เข้าได้ | ✅ เข้าได้ | ❌ เข้าไม่ได้ | ❌ เข้าไม่ได้ (ไม่มีสิทธิ์พิเศษผูกไว้) | ❌ เข้าไม่ได้ |
| **บันทึกข้อความ** | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ❌ เข้าไม่ได้ |
| **ระบบติดตามงาน / สั่งการ** | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ❌ เข้าไม่ได้ |
| **AI Cowork** | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ❌ เข้าไม่ได้ |
| **ระบบวิชาการ / ระบบห้องสมุด** | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ❌ เข้าไม่ได้ |
| **การเงิน / พัสดุ** | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ❌ เข้าไม่ได้ |
| **เบิกค่าสาธารณูปโภค** | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ❌ เข้าไม่ได้ |
| **จ่ายเงินเรียนฟรี** | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ❌ เข้าไม่ได้ |
| **จัดการข้อมูลครู (งานบุคคล)** | ✅ เข้าได้ | ✅ เข้าได้ | ❌ เข้าไม่ได้ | ✅ เข้าได้ (เมื่อมี `access_hr`) | ❌ เข้าไม่ได้ |
| **ลงเวลาปฏิบัติงาน (WFH)** | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ❌ เข้าไม่ได้ |
| **ข้อมูลนักเรียน** | ✅ เข้าได้ | ✅ เข้าได้ | ⚠️ **เข้าได้** *(ช่องโหว่)* | ⚠️ **เข้าได้** *(ไม่ได้ตรวจสอบสิทธิ์พิเศษ)* | ❌ เข้าไม่ได้ |
| **พิมพ์รายชื่อ / รายงาน LEC** | ✅ เข้าได้ | ✅ เข้าได้ | ❌ เข้าไม่ได้ | ❌ เข้าไม่ได้ | ❌ เข้าไม่ได้ |
| **บันทึกเวลาเรียน / รายงานเวลา** | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ✅ เข้าได้ | ❌ เข้าไม่ได้ |
| **จัดการสิทธิ์ผู้ใช้ (User Management)**| ✅ เข้าได้ | ❌ เข้าไม่ได้ | ❌ เข้าไม่ได้ | ❌ เข้าไม่ได้ | ❌ เข้าไม่ได้ |
| **ตั้งค่าระบบ (System Settings)** | ✅ เข้าได้ | ❌ เข้าไม่ได้ | ❌ เข้าไม่ได้ | ❌ เข้าไม่ได้ | ❌ เข้าไม่ได้ |

**หมายเหตุเพิ่มเติม:**
* ⚠️ **ข้อมูลนักเรียน:** หน้าหลักไม่ได้ดึงตัวแปร `access_student_affairs` ไปบังคับปิดกั้นเมนู ทำให้ครูทุกคนในระบบที่ผ่านการอนุมัติเข้าใช้งานได้ตามปกติ
* **การเช็คสิทธิ์แบบละเอียดภายในหน้าเพจ:** ในเพจการเงิน (`Finance.tsx`) จะมีเงื่อนไข `profile?.role === 'director' || profile?.role === 'admin'` สำหรับซ่อนปุ่มลบหรือแก้ไขบางประการ

---

## 🔍 รายละเอียดผลการตรวจสอบรายส่วน

### 1. การควบคุมการเข้าถึงในส่วนแสดงผลหน้าจอ (React Frontend)

#### 1.1 สิทธิ์พิเศษ `access_student_affairs` ถูกละเลยในโครงสร้างเมนู
* **ปัญหาที่พบ:** ในไฟล์ `src/pages/Users.tsx` มีการตั้งค่าสิทธิ์พิเศษรายบุคคล (Granular Permissions) ชื่อ `access_student_affairs` (งานทะเบียน/กิจการนักเรียน) เพื่อให้แอดมินสามารถกำหนดให้ครูบางรายดูแลงานทะเบียนได้ แต่ในไฟล์ [App.tsx](file:///C:/Users/Phairot%20M/Desktop/school-admin/src/App.tsx#L242) กลับแสดงเมนูนี้แก่ครูและบุคลากรทุกคนที่ผ่านการอนุมัติ (`!isGuest`) โดยไม่มีการตรวจสอบสิทธิ์นี้เลย
* **ผลกระทบ:** คุณครูทุกคนที่ได้รับการอนุมัติบัญชีสามารถเข้าดูและแก้ไขข้อมูลนักเรียนได้ทั้งหมด แม้ว่าจะไม่ได้เป็นผู้รับผิดชอบงานทะเบียนก็ตาม

#### 1.2 คอมโพเนนต์ภายในเพจไม่มีการตรวจสอบสิทธิ์ซ้ำ (Double-Gate Verification)
* **ปัญหาที่พบ:** หน้าเพจสำคัญ เช่น [Students.tsx](file:///C:/Users/Phairot%20M/Desktop/school-admin/src/pages/Students.tsx), [Procurement.tsx](file:///C:/Users/Phairot%20M/Desktop/school-admin/src/pages/Procurement.tsx), และ [Utilities.tsx](file:///C:/Users/Phairot%20M/Desktop/school-admin/src/pages/Utilities.tsx) ไม่มีการใช้ context `useAuth` เพื่อดึงบทบาทของผู้ใช้ปัจจุบันมาป้องกันปุ่มเพิ่ม ลบ หรือแก้ไขข้อมูล มีเพียงบางหน้าอย่าง `Finance.tsx` และ `IncomingDocs.tsx` ที่มีการซ่อน/แสดงปุ่มเบื้องต้น
* **ผลกระทบ:** หากผู้ใช้เข้าถึงหน้านั้นๆ ได้ด้วยการปรับเปลี่ยนสถานะภายในเบราว์เซอร์ (Client-side State manipulation) จะสามารถสั่งดำเนินการแก้ไขหรือลบข้อมูลได้ทันทีโดยไม่มีการตรวจสอบซ้ำในระดับคอมโพเนนต์

---

### 2. ความปลอดภัยในระดับฐานข้อมูล (Supabase RLS Gaps)

ในไฟล์ [supabase_schema.sql](file:///C:/Users/Phairot%20M/Desktop/school-admin/supabase_schema.sql) พบว่ามีเพียงตาราง `profiles`, `settings`, `ai_skills`, `ai_knowledge_base`, `utilities`, `utility_items`, และกลุ่มตารางงบประมาณ/พัสดุ เท่านั้นที่เปิดใช้งาน Row Level Security (RLS) 

มีตารางสำคัญ **13 ตาราง** ต่อไปนี้ที่ **ยังไม่ได้เปิดใช้งาน RLS** และไม่มีนโยบายการเข้าถึง (Security Policies) ส่งผลให้ข้อมูลรั่วไหลหรือถูกแก้ไขได้ง่ายหาก API Key รั่วไหล:

| ชื่อตาราง | ประเภทข้อมูล | สถานะ RLS ใน Schema | ความเสี่ยง |
| :--- | :--- | :---: | :--- |
| `students` | ข้อมูลนักเรียน (บัตร ปชช., ที่อยู่, ข้อมูลครอบครัว) | ❌ **ไม่มีการป้องกัน** | **สูงมาก** (ผิดหลัก PDPA ข้อมูลส่วนบุคคลรั่วไหล) |
| `teachers` | ข้อมูลครูและบุคลากร (เบอร์โทร, อีเมล, รูปถ่าย) | ❌ **ไม่มีการป้องกัน** | **สูง** (ข้อมูลติดต่อภายในรั่วไหล) |
| `incoming_docs` | หนังสือรับราชการ (อาจมีเอกสารลับ/เอกสารภายใน) | ❌ **ไม่มีการป้องกัน** | **สูง** (เอกสารราชการภายนอกเข้าถึงได้โดยไม่ได้รับอนุญาต) |
| `outgoing_docs` | หนังสือส่งราชการ | ❌ **ไม่มีการป้องกัน** | **สูง** (เอกสารออกของโรงเรียนถูกแก้ไข/ปลอมแปลง) |
| `orders` | คำสั่งโรงเรียน | ❌ **ไม่มีการป้องกัน** | **ปานกลาง-สูง** |
| `memos` | บันทึกข้อความภายใน | ❌ **ไม่มีการป้องกัน** | **ปานกลาง** |
| `attendance` | ข้อมูลการเช็คชื่อเข้าเรียนรายวัน | ❌ **ไม่มีการป้องกัน** | **ปานกลาง** |
| `wfh_logs` | ข้อมูลการลงเวลาปฏิบัติงานและพิกัด GPS | ❌ **ไม่มีการป้องกัน** | **ปานกลาง** |
| `library_books` | ข้อมูลหนังสือในห้องสมุด | ❌ **ไม่มีการป้องกัน** | **ต่ำ** |
| `library_borrow` | ข้อมูลการยืม-คืนหนังสือ | ❌ **ไม่มีการป้องกัน** | **ต่ำ** |
| `library_usage_logs` | บันทึกการเข้าใช้งานห้องสมุด | ❌ **ไม่มีการป้องกัน** | **ต่ำ** |
| `teacher_duties` | ข้อมูลตารางเวรครูประจำวัน | ❌ **ไม่มีการป้องกัน** | **ต่ำ** |
| `doc_assignments` | ระบบสั่งการและมอบหมายงานผู้บริหาร | ❌ **ไม่มีการป้องกัน** | **สูง** (แก้ไขรายงานการปฏิบัติตามคำสั่งของครูท่านอื่น) |

---

## 🛠️ แนวทางการปรับปรุงแก้ไขที่เสนอแนะ

เพื่อให้ระบบสารสนเทศของโรงเรียนบ้านควนโคกยามีความปลอดภัยสูงสุด ขอเสนอขั้นตอนในการแก้ไขแบ่งออกเป็น 2 เฟส ดังนี้:

### เฟสที่ 1: แก้ไขระดับ Frontend (ปรับสิทธิ์การเข้าถึงเมนู)
1. **ปรับปรุง `src/App.tsx`:**
   * เพิ่มการตรวจสอบสิทธิ์ `canAccessStudentAffairs` ดังนี้:
     ```typescript
     const canAccessStudentAffairs = !isGuest && (!isTeacher || extraPerms.access_student_affairs);
     ```
   * ใช้ `canAccessStudentAffairs` ในการควบคุมการแสดงผลเมนู **"ข้อมูลนักเรียน"** ใน Sidebar:
     ```tsx
     {canAccessStudentAffairs && (
       <SidebarItem icon={<Users size={20} />} label="ข้อมูลนักเรียน" active={activeTab === 'students'} onClick={() => setActiveTab('students')} />
     )}
     ```
2. **จำกัดสิทธิ์ในหน้าแก้ไข/ลบข้อมูล:**
   * นำเข้า `useAuth` ในหน้าจอที่มีการเพิ่ม ลบ หรือแก้ไขข้อมูล เช่น `Students.tsx` และตรวจสอบบทบาทของผู้ใช้ก่อนดำเนินการเรนเดอร์ปุ่มดำเนินการ (Actions Buttons) เช่น ปุ่มแก้ไข (`Edit`) และปุ่มลบ (`Delete`)

---

### เฟสที่ 2: ปรับปรุงระดับ Database (เปิด RLS และสร้าง Policy ทั้ง 13 ตาราง)
เพิ่มคำสั่ง SQL ชุดสมบูรณ์นี้เพื่อเปิดใช้งาน RLS และสร้างนโยบายความปลอดภัย (Security Policies) สำหรับตารางที่ขาดหายไปทั้งหมด 13 ตาราง โดยคัดลอกไปรันผ่าน **SQL Editor** ใน Supabase Dashboard:

```sql
-- ====================================================================
-- SQL MIGRATION: COMPLETE DATABASE ACCESS SECURITY & RLS POLICIES
-- Date: 2026-05-28
-- Description:
-- 1. Enable Row Level Security (RLS) for 13 remaining tables
-- 2. Create strict access and manage policies based on Roles & Custom Permissions
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Students Table (ข้อมูลนักเรียน)
-- --------------------------------------------------------------------
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff to view students" ON students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role IN ('teacher', 'director', 'admin')
    )
  );

CREATE POLICY "Allow authorized staff to manage students" ON students
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_student_affairs')::boolean = true)
      )
    )
  );

-- --------------------------------------------------------------------
-- 2. Teachers Table (ข้อมูลครู)
-- --------------------------------------------------------------------
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view teachers" ON teachers
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authorized staff to manage teachers" ON teachers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_hr')::boolean = true)
      )
    )
  );

-- --------------------------------------------------------------------
-- 3. Incoming Documents (หนังสือรับ)
-- --------------------------------------------------------------------
ALTER TABLE incoming_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authorized staff to view incoming docs" ON incoming_docs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_administrative')::boolean = true)
      )
    )
  );

CREATE POLICY "Allow authorized staff to manage incoming docs" ON incoming_docs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_administrative')::boolean = true)
      )
    )
  );

-- --------------------------------------------------------------------
-- 4. Outgoing Documents (หนังสือส่ง)
-- --------------------------------------------------------------------
ALTER TABLE outgoing_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authorized staff to view outgoing docs" ON outgoing_docs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_administrative')::boolean = true)
      )
    )
  );

CREATE POLICY "Allow authorized staff to manage outgoing docs" ON outgoing_docs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_administrative')::boolean = true)
      )
    )
  );

-- --------------------------------------------------------------------
-- 5. Orders Table (คำสั่ง)
-- --------------------------------------------------------------------
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff to view orders" ON orders
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow director/admin to manage orders" ON orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role IN ('director', 'admin')
    )
  );

-- --------------------------------------------------------------------
-- 6. Memos Table (บันทึกข้อความ)
-- --------------------------------------------------------------------
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff to view memos" ON memos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow owners and admin/director to manage memos" ON memos
  FOR ALL USING (
    auth.uid() = created_by 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role IN ('director', 'admin')
    )
  );

-- --------------------------------------------------------------------
-- 7. Attendance Table (บันทึกเวลาเรียน)
-- --------------------------------------------------------------------
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff to view attendance" ON attendance
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow teachers and student affairs to manage attendance" ON attendance
  FOR ALL USING (
    auth.uid() = teacher_id 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_student_affairs')::boolean = true)
      )
    )
  );

-- --------------------------------------------------------------------
-- 8. WFH Logs Table (ลงเวลาปฏิบัติงาน WFH)
-- --------------------------------------------------------------------
ALTER TABLE wfh_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to view own logs, staff to view all" ON wfh_logs
  FOR SELECT USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_hr')::boolean = true)
      )
    )
  );

CREATE POLICY "Allow users to manage own WFH logs" ON wfh_logs
  FOR ALL USING (auth.uid() = user_id);

-- --------------------------------------------------------------------
-- 9. Library Books Table (หนังสือห้องสมุด)
-- --------------------------------------------------------------------
ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view books" ON library_books
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow academic staff to manage books" ON library_books
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_academic')::boolean = true)
      )
    )
  );

-- --------------------------------------------------------------------
-- 10. Library Borrow Table (การยืม-คืนหนังสือ)
-- --------------------------------------------------------------------
ALTER TABLE library_borrow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view borrow logs" ON library_borrow
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow academic staff to manage borrow logs" ON library_borrow
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_academic')::boolean = true)
      )
    )
  );

-- --------------------------------------------------------------------
-- 11. Library Usage Logs (บันทึกเข้าใช้ห้องสมุด)
-- --------------------------------------------------------------------
ALTER TABLE library_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view usage logs" ON library_usage_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow academic staff to manage usage logs" ON library_usage_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_academic')::boolean = true)
      )
    )
  );

-- --------------------------------------------------------------------
-- 12. Teacher Duties Table (เวรครูประจำวัน)
-- --------------------------------------------------------------------
ALTER TABLE teacher_duties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view teacher duties" ON teacher_duties
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow hr staff to manage teacher duties" ON teacher_duties
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_hr')::boolean = true)
      )
    )
  );

-- --------------------------------------------------------------------
-- 13. Document Assignments (ระบบสั่งการ/ติดตามงาน)
-- --------------------------------------------------------------------
ALTER TABLE doc_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view assignments" ON doc_assignments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authorized staff to manage assignments" ON doc_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND (
        profiles.role IN ('director', 'admin') 
        OR (profiles.role = 'teacher' AND (profiles.extra_permissions->>'access_administrative')::boolean = true)
      )
    )
  );
```

---

## 💬 ขั้นตอนถัดไป
หากท่านเห็นชอบกับรายงานการตรวจสอบนี้และต้องการให้ดำเนินการแก้ไขเพื่ออุดช่องโหว่ความปลอดภัยดังกล่าว กรุณาแจ้งให้ทราบ เพื่อที่ผมจะจัดทำ **แผนการดำเนินงาน (Implementation Plan)** และดำเนินการอัปเดตโค้ดและฐานข้อมูลให้ทันทีครับ
