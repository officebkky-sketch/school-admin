# 🧠 ทีมที่ ๔: School Intelligence Hub & RAG Architect (ทีมคลังปัญญา AI และผู้ช่วยครูอัจฉริยะ)

## 📌 ข้อมูลประจำทีม
* **รหัสทีมงาน:** `expert_intelligence_hub`
* **โมเดลขับเคลื่อนใน AiPASS:** `DeepSeek R1` / `Claude Sonnet 5` (Task Class: `math_research` / `code`)
* **สกิลที่ครอบครอง:**
  * `aipass-auto-router` (เราเตอร์จัดสรรโมเดลและประหยัดโควตาฟรี 10,000 เครดิต/วัน)
  * `hybrid-rag-knowledge-retriever` (ค้นหาผสม Vector + Keyword, Virtual Drive ครู 00-08 ผ่าน GAS, RLS Sandbox)
  * `agentic-school-tool-calling` (Tool Calling ค้นตาราง ทร.14/สถิตินักเรียน, Conversational Memory)
* **ไฟล์ที่รับผิดชอบ:**
  * `src/pages/AICowork.tsx`
  * `src/pages/KnowledgeBase.tsx`
  * `src/services/aiCoworkService.ts`
  * `src/lib/aiService.ts`
  * `ROADMAP.md`

---

## 🔍 บทวิเคราะห์ระบบ As-Is
1. **Virtual Drive 00-08:** ระบบจัดเก็บเอกสารและคลังความรู้ครูแยก 9 หมวดหมู่อย่างเป็นระเบียบ เชื่อมต่อกับ Google Drive ผ่าน GAS
2. **Robust Multi-Model Fallback:** ระบบแชท AI Cowork มี Fallback วนลูปโมเดล Gemini 2.0/1.5 เพื่อความต่อเนื่องเมื่อเจอปัญหาโควตาเต็ม
3. **Specialized Quick Action Personas:** มีการ์ดเครื่องมือด่วน 6 ด้าน (ออกแบบใบงาน, ร่างบันทึก, PR, วิเคราะห์ข้อมูล ฯลฯ)

## 💡 ข้อเสนอแนะเชิงกลยุทธ์และการปรับปรุง (Recommendations)
1. **Function/Tool Calling บนฐานข้อมูลจริง (ตาม ROADMAP):** ยกระดับ Chat Hub ให้ AI สามารถสั่ง Tool Query ข้อมูลจากตาราง `students`, `service_area_students` (ทร.14) และ `attendance` ได้เองอย่างปลอดภัย โดยไม่ต้องพึ่งพา Rule-based Keywords
2. **Local Token Sanitization (PDPA Filter):** ติดตั้งตัวกรองข้อมูลส่วนบุคคล (PII Scrubber) เพื่อถอดชื่อ-สกุลจริงของนักเรียน หรือเลขบัตร ปชช. ออกก่อนส่งเข้า Gemini API ภายนอก
3. **Metadata Filtering in RAG:** เพิ่มตัวกรองกลุ่มสาระวิชาและปีการศึกษาใน Vector Search เพื่อให้ AI ดึงเฉพาะคู่มือและแผนการสอนที่ตรงกับบริบทงานของครูแต่ละคน
