/**
 * ยูทิลิตีตรวจสอบความถูกต้องของข้อมูลราชการ (Thai Government Validation Utilities)
 * พัฒนาโดย ทีมทะเบียนและสารสนเทศโรงเรียน (expert_school_erp)
 */

export interface IdValidationResult {
  isValid: boolean;
  message: string;
  cleanId: string;
  idType?: 'thai_citizen' | 'non_thai_status' | 'g_code' | 'invalid';
}

/**
 * ตรวจสอบความถูกต้องของเลขประจำตัวประชาชน 13 หลัก ตามสูตร Modulo 11 ของกระทรวงมหาดไทย
 * และรองรับรหัสประจำตัวนักเรียน DMC (G-Code) รวมถึงรหัสบุคคลที่ไม่มีสถานะทางทะเบียน (หมวด 0 / 00)
 */
export function validateThaiNationalId(id: string | number | undefined | null): IdValidationResult {
  if (!id) {
    return { isValid: false, message: 'ยังไม่ได้ระบุเลขบัตรประชาชน', cleanId: '' };
  }

  const rawStr = String(id).trim().toUpperCase();

  // 1. รองรับ DMC G-Code (ขึ้นต้นด้วย G ตามด้วยตัวเลข 12 หลัก รวมเป็น 13 ตัวอักษร)
  if (/^G\d{12}$/.test(rawStr)) {
    return {
      isValid: true,
      message: 'รหัสประจำตัวนักเรียนไม่มีหลักฐานทางทะเบียน (G-Code จาก DMC)',
      cleanId: rawStr,
      idType: 'g_code'
    };
  }

  const cleanId = rawStr.replace(/\D/g, '');

  if (cleanId.length === 0) {
    return { isValid: false, message: 'กรุณากรอกเฉพาะตัวเลข หรือรหัส G-Code', cleanId: '' };
  }

  if (cleanId.length < 13) {
    return { isValid: false, message: `ยังไม่ครบ 13 หลัก (ปัจจุบัน ${cleanId.length}/13)`, cleanId };
  }

  if (cleanId.length > 13) {
    return { isValid: false, message: `ตัวเลขเกิน 13 หลัก (${cleanId.length} หลัก)`, cleanId };
  }

  // คำนวณ Modulo 11
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanId.charAt(i), 10) * (13 - i);
  }

  const checkDigit = (11 - (sum % 11)) % 10;
  const isModuloValid = checkDigit === parseInt(cleanId.charAt(12), 10);

  // ตรวจสอบประเภทบัตร: บัตรบุคคลที่ไม่มีสถานะทางทะเบียน (ขึ้นต้นด้วย 0 หรือ 00)
  if (cleanId.startsWith('00') || cleanId.startsWith('0')) {
    return {
      isValid: isModuloValid,
      message: isModuloValid
        ? 'เลขประจำตัวบุคคลที่ไม่มีสถานะทางทะเบียน (ถูกต้องตามสูตร Modulo 11)'
        : 'เลขประจำตัวบุคคลที่ไม่มีสถานะทางทะเบียน (หลักตรวจสอบไม่ตรงสูตร)',
      cleanId,
      idType: isModuloValid ? 'non_thai_status' : 'invalid'
    };
  }

  return {
    isValid: isModuloValid,
    message: isModuloValid 
      ? 'เลขบัตรประชาชนถูกต้องตามสูตร Modulo 11' 
      : 'เลขบัตรประชาชนไม่ถูกต้องตามสูตรคำนวณของกระทรวงมหาดไทย (หลักตรวจสอบไม่ตรง)',
    cleanId,
    idType: isModuloValid ? 'thai_citizen' : 'invalid'
  };
}

/**
 * ปิดบังข้อมูลส่วนบุคคล (PDPA Masking) สำหรับการส่งข้อความแจ้งเตือนหรือแสดงผลในที่สาธารณะ
 * - ปิดบังเลขบัตรประชาชน: 1-XXXX-XXXXX-XX-9
 * - ปิดบัง G-Code: G-68XX-XXXXX-XX-3
 * - ปิดบังเบอร์โทรศัพท์: 081-XXX-4567
 */
export function maskPDPA(text: string): string {
  if (!text) return '';
  // Mask G-Code: G689300000173 -> G-68XX-XXXXX-XX-3
  let result = text.replace(/(\bG)(\d{4})(\d{5})(\d{2})(\d\b)/gi, '$1-$2-XXXX-XX-$5');
  // Mask เลขบัตร ปชช. แบบมีขีด หรือไม่มีขีด 13 หลัก (รวมหมวด 0)
  result = result.replace(/(\b[0-8])(\d{4})(\d{5})(\d{2})(\d\b)/g, '$1-XXXX-XXXXX-XX-$5');
  result = result.replace(/(\b[0-8])-(\d{4})-(\d{5})-(\d{2})-(\d\b)/g, '$1-XXXX-XXXXX-XX-$5');
  
  // Mask เบอร์โทรศัพท์ 10 หลัก (เช่น 0812345678 หรือ 081-234-5678)
  result = result.replace(/(\b0\d{2})[-]?(\d{3})[-]?(\d{4}\b)/g, '$1-XXX-$3');
  return result;
}

/**
 * จัดรูปแบบเลขบัตรประชาชนให้เป็นรูปแบบมาตรฐานราชการ: X-XXXX-XXXXX-XX-X
 */
export function formatThaiNationalId(id: string | number | undefined | null): string {
  if (!id) return '';
  const rawStr = String(id).trim();
  if (/^G\d{12}$/i.test(rawStr)) {
    return `${rawStr.slice(0, 1).toUpperCase()}-${rawStr.slice(1, 5)}-${rawStr.slice(5, 10)}-${rawStr.slice(10, 12)}-${rawStr.slice(12)}`;
  }
  const clean = rawStr.replace(/\D/g, '');
  if (clean.length !== 13) return rawStr;
  return `${clean[0]}-${clean.slice(1, 5)}-${clean.slice(5, 10)}-${clean.slice(10, 12)}-${clean[12]}`;
}
