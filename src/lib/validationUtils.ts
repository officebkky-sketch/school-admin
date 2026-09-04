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
