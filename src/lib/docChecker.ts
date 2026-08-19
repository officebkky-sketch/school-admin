// ============================================================================
// AI Workflow Checklists & Document Structure Verification Engine
// ระบบตรวจสอบความถูกต้องและสมบูรณ์ของเอกสารก่อนเสนอผู้บริหาร
// (รองรับระบบจองเลขหนังสือแบบไม่มีไฟล์โดยไม่บล็อก 100%)
// ============================================================================

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  passed: boolean;
  severity: 'info' | 'warning' | 'error';
  recommendation?: string;
}

export interface VerificationResult {
  isReserved: boolean;
  score: number; // 0 - 100
  status: 'passed' | 'warning' | 'needs_attention' | 'reserved_pending_file';
  statusLabel: string;
  badgeColor: string;
  items: ChecklistItem[];
  summaryMessage: string;
}

export interface DocToCheck {
  subject?: string;
  doc_number?: string;
  doc_date?: string;
  from_agency?: string;
  to_agency?: string;
  file_url?: string | null;
  attachment_urls?: string[] | string | null;
  is_reserved?: boolean;
  status?: string;
  extracted_text?: string;
  remark?: any;
}

/**
 * ตรวจสอบความถูกต้องของโครงสร้างเอกสารราชการ
 * @param doc ข้อมูลหนังสือรับ/หนังสือส่ง/บันทึกข้อความ
 */
export function verifyDocumentStructure(doc: DocToCheck): VerificationResult {
  // ── 1. กรณีจองเลขหนังสือไว้ก่อน (ยังไม่มีไฟล์เอกสาร) ─────────────────────────
  // กฎสำคัญ: ต้องไม่บล็อกระบบจองเลข และไม่แจ้งเตือนว่าเป็นข้อผิดพลาด
  const isReserved = doc.is_reserved === true || doc.status === 'reserved' || (!doc.file_url && doc.doc_number);

  if (isReserved && !doc.file_url) {
    return {
      isReserved: true,
      score: 100,
      status: 'reserved_pending_file',
      statusLabel: '🟡 จองเลขแล้ว (รอแนบไฟล์เอกสาร)',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      items: [
        {
          id: 'booking_status',
          title: 'สถานะการจองเลขฉุกเฉิน',
          description: 'หนังสืออยู่ในสถานะจองเลขเรียบร้อยแล้ว ท่านสามารถนำเลขนี้ไปร่างเอกสารต่อได้ทันที',
          passed: true,
          severity: 'info'
        },
        {
          id: 'attachment_pending',
          title: 'การแนบไฟล์เอกสารจริง',
          description: 'เมื่อจัดทำเอกสารเสร็จ สามารถแนบไฟล์ PDF ผ่านปุ่ม "📎 แนบไฟล์" หรือพิมพ์ /แนบเอกสาร ใน Telegram ได้ค่ะ',
          passed: true,
          severity: 'info'
        }
      ],
      summaryMessage: '🟡 จองเลขหนังสือเรียบร้อยแล้วค่ะ ระบบพร้อมรับไฟล์เอกสารจริงย้อนหลัง'
    };
  }

  // ── 2. กรณีมีไฟล์เอกสารแนบแล้ว -> เริ่มกระบวนการตรวจสอบคุณภาพเอกสาร ────────
  const items: ChecklistItem[] = [];

  // Check 1: หัวข้อเรื่อง (Subject)
  const hasValidSubject = !!(doc.subject && doc.subject.trim().length >= 4);
  items.push({
    id: 'check_subject',
    title: 'หัวข้อเรื่องเอกสาร',
    description: hasValidSubject ? `ระบุหัวข้อชัดเจน: "${doc.subject?.trim()}"` : 'หัวข้อเรื่องสั้นเกินไปหรือไม่ระบุ',
    passed: hasValidSubject,
    severity: hasValidSubject ? 'info' : 'error',
    recommendation: hasValidSubject ? undefined : 'กรุณาระบุชื่อเรื่องของหนังสือให้ชัดเจนเพื่อความสะดวกในการสืบค้น'
  });

  // Check 2: เลขที่หนังสือ (Doc Number)
  const hasDocNumber = !!(doc.doc_number && doc.doc_number.trim() !== '' && doc.doc_number !== '-');
  items.push({
    id: 'check_number',
    title: 'เลขที่หนังสือ/เลขรับ',
    description: hasDocNumber ? `เลขที่หนังสือ: ${doc.doc_number}` : 'ยังไม่ระบุเลขที่หนังสือ',
    passed: hasDocNumber,
    severity: hasDocNumber ? 'info' : 'warning',
    recommendation: hasDocNumber ? undefined : 'ตรวจสอบการลงรับหรือออกเลขหนังสือ'
  });

  // Check 3: วันที่เอกสาร (Doc Date)
  const hasDocDate = !!(doc.doc_date && doc.doc_date.trim() !== '');
  items.push({
    id: 'check_date',
    title: 'การลงวันที่ออกหนังสือ',
    description: hasDocDate ? `ลงวันที่: ${doc.doc_date}` : 'ไม่ได้ระบุวันที่ของเอกสาร',
    passed: hasDocDate,
    severity: hasDocDate ? 'info' : 'warning',
    recommendation: hasDocDate ? undefined : 'ควรระบุวันที่ในหนังสือเพื่อใช้ในการอ้างอิงและคำนวณอายุเอกสาร'
  });

  // Check 4: ความสอดคล้องของเอกสารแนบ (Attachment Consistency)
  let attList: string[] = [];
  if (Array.isArray(doc.attachment_urls)) {
    attList = doc.attachment_urls.filter(Boolean);
  } else if (typeof doc.attachment_urls === 'string' && doc.attachment_urls.startsWith('[')) {
    try { attList = JSON.parse(doc.attachment_urls).filter(Boolean); } catch {}
  }

  const subjectOrText = `${doc.subject || ''} ${doc.extracted_text || ''}`;
  const mentionsAttachments = /(สิ่งที่ส่งมาด้วย|เอกสารแนบ|แนบไฟล์|สิ่งที่ส่งมา)/.test(subjectOrText);
  const attachmentConsistent = !mentionsAttachments || (mentionsAttachments && attList.length > 0);

  items.push({
    id: 'check_attachments',
    title: 'ความครบถ้วนของเอกสารแนบ',
    description: attList.length > 0 
      ? `แนบไฟล์หลักฐาน/สิ่งที่ส่งมาด้วยครบ ${attList.length} รายการ`
      : mentionsAttachments 
        ? '⚠️ มีการกล่าวถึงสิ่งที่ส่งมาด้วย แต่ยังไม่ได้อัปโหลดไฟล์แนบ' 
        : 'ไม่มีสิ่งที่ส่งมาด้วยเพิ่มเติม (เฉพาะหนังสือนำหลัก)',
    passed: attachmentConsistent,
    severity: attachmentConsistent ? 'info' : 'warning',
    recommendation: !attachmentConsistent 
      ? 'ตรวจพบข้อความอ้างอิงเอกสารแนบ แนะนำให้อัปโหลดไฟล์สิ่งที่ส่งมาด้วยเพื่อความสมบูรณ์' 
      : undefined
  });

  // Check 5: ลิงก์ไฟล์หนังสือนำหลัก (Main File URL)
  const hasMainFile = !!(doc.file_url && doc.file_url.startsWith('http'));
  items.push({
    id: 'check_main_file',
    title: 'ไฟล์ต้นฉบับหนังสือหลัก',
    description: hasMainFile ? 'อัปโหลดไฟล์หนังสือนำเข้าสู่ระบบเรียบร้อย' : 'ไม่พบไฟล์หนังสือนำส่งหลัก',
    passed: hasMainFile,
    severity: hasMainFile ? 'info' : 'error',
    recommendation: hasMainFile ? undefined : 'กรุณาอัปโหลดไฟล์ต้นฉบับเพื่อเสนอ ผอ. เกษียณสั่งการ'
  });

  // ── คำนวณคะแนนความสมบูรณ์ ───────────────────────────────────────────────
  const passedCount = items.filter(i => i.passed).length;
  const score = Math.round((passedCount / items.length) * 100);

  let status: VerificationResult['status'] = 'passed';
  let statusLabel = '🟢 เอกสารสมบูรณ์พร้อมเสนอ';
  let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let summaryMessage = 'เอกสารมีองค์ประกอบครบถ้วนตามระเบียบงานสารบรรณ พร้อมเสนอผู้บริหารค่ะ 🌸';

  const hasError = items.some(i => !i.passed && i.severity === 'error');
  const hasWarning = items.some(i => !i.passed && i.severity === 'warning');

  if (hasError) {
    status = 'needs_attention';
    statusLabel = '🔴 เอกสารยังไม่สมบูรณ์';
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
    summaryMessage = 'พบข้อบกพร่องสำคัญ กรุณาตรวจสอบข้อมูลก่อนส่งเสนอเกษียณสั่งการค่ะ';
  } else if (hasWarning) {
    status = 'warning';
    statusLabel = '🟡 มีข้อสังเกตเพิ่มเติม';
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
    summaryMessage = 'เอกสารสามารถเสนอได้ แต่อาจมีข้อสังเกตเล็กน้อยที่ควรตรวจสอบเพิ่มเติมค่ะ';
  }

  return {
    isReserved: false,
    score,
    status,
    statusLabel,
    badgeColor,
    items,
    summaryMessage
  };
}
