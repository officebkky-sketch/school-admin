/**
 * ยูทิลิตีตรวจสอบความถูกต้องของข้อมูลราชการ (Thai Government Validation Utilities)
 * พัฒนาโดย ทีมทะเบียนและสารสนเทศโรงเรียน (expert_school_erp)
 */

/**
 * ตรวจสอบความถูกต้องของเลขประจำตัวประชาชน 13 หลัก ตามสูตร Modulo 11 ของกระทรวงมหาดไทย
 * 
 * สูตร:
 * 1. ผลรวม = (หลักที่ 1 × 13) + (หลักที่ 2 × 12) + ... + (หลักที่ 12 × 2)
 * 2. เศษ = ผลรวม % 11
 * 3. เลขตรวจสอบ = (11 - เศษ) % 10
 * 4. เลขตรวจสอบต้องเท่ากับหลักที่ 13
 */
export function validateThaiNationalId(id: string | number | undefined | null): {
  isValid: boolean;
  message: string;
  cleanId: string;
} {
  if (!id) {
    return { isValid: false, message: 'ยังไม่ได้ระบุเลขบัตรประชาชน', cleanId: '' };
  }

  const cleanId = String(id).replace(/\D/g, '');

  if (cleanId.length === 0) {
    return { isValid: false, message: 'กรุณากรอกเฉพาะตัวเลข', cleanId: '' };
  }

  if (cleanId.length < 13) {
    return { isValid: false, message: `ยังไม่ครบ 13 หลัก (ปัจจุบัน ${cleanId.length}/13)`, cleanId };
  }

  if (cleanId.length > 13) {
    return { isValid: false, message: `ตัวเลขเกิน 13 หลัก (${cleanId.length} หลัก)`, cleanId };
  }

  // ตัวเลขหลักแรกของบัตร ปชช. ไทย (1-8) ต้องไม่เป็น 0 หรือ 9
  if (cleanId.charAt(0) === '0') {
    return { isValid: false, message: 'เลขหลักแรกของบัตรประชาชนต้องไม่เป็น 0', cleanId };
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanId.charAt(i), 10) * (13 - i);
  }

  const checkDigit = (11 - (sum % 11)) % 10;
  const isValid = checkDigit === parseInt(cleanId.charAt(12), 10);

  return {
    isValid,
    message: isValid 
      ? 'เลขบัตรประชาชนถูกต้องตามสูตร Modulo 11' 
      : 'เลขบัตรประชาชนไม่ถูกต้องตามสูตรคำนวณของกระทรวงมหาดไทย (หลักตรวจสอบไม่ตรง)',
    cleanId
  };
}

/**
 * ปิดบังข้อมูลส่วนบุคคล (PDPA Masking) สำหรับการส่งข้อความแจ้งเตือนหรือแสดงผลในที่สาธารณะ
 * - ปิดบังเลขบัตรประชาชน: 1-XXXX-XXXXX-XX-9
 * - ปิดบังเบอร์โทรศัพท์: 081-XXX-4567
 */
export function maskPDPA(text: string): string {
  if (!text) return '';
  // Mask เลขบัตร ปชช. แบบมีขีด หรือไม่มีขีด 13 หลัก
  let result = text.replace(/(\b[1-8])(\d{4})(\d{5})(\d{2})(\d\b)/g, '$1-XXXX-XXXXX-XX-$5');
  result = result.replace(/(\b[1-8])-(\d{4})-(\d{5})-(\d{2})-(\d\b)/g, '$1-XXXX-XXXXX-XX-$5');
  
  // Mask เบอร์โทรศัพท์ 10 หลัก (เช่น 0812345678 หรือ 081-234-5678)
  result = result.replace(/(\b0\d{2})[-]?(\d{3})[-]?(\d{4}\b)/g, '$1-XXX-$3');
  return result;
}

/**
 * จัดรูปแบบเลขบัตรประชาชนให้เป็นรูปแบบมาตรฐานราชการ: X-XXXX-XXXXX-XX-X
 */
export function formatThaiNationalId(id: string | number | undefined | null): string {
  if (!id) return '';
  const clean = String(id).replace(/\D/g, '');
  if (clean.length !== 13) return String(id);
  return `${clean[0]}-${clean.slice(1, 5)}-${clean.slice(5, 10)}-${clean.slice(10, 12)}-${clean[12]}`;
}
