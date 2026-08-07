import { SupabaseClient } from '@supabase/supabase-js';

/**
 * คำนวณหาเลขลำดับถัดไป (Next Sequence Number) อย่างแม่นยำ
 * โดยสแกนหาตัวเลขสูงสุดจากทั้ง doc_sequence และการสกัด Regex จากเลขที่หนังสือจริง
 */
export async function getAccurateNextSequence(
  supabase: SupabaseClient,
  tableName: 'incoming_docs' | 'outgoing_docs' | 'memos' | 'orders',
  docYear: number,
  startingSeq: number = 1
): Promise<number> {
  try {
    let numberColumn = 'doc_number';
    if (tableName === 'memos') numberColumn = 'memo_number';
    if (tableName === 'orders') numberColumn = 'order_number';

    const { data: docs, error } = await supabase
      .from(tableName)
      .select(`doc_sequence, ${numberColumn}`)
      .eq('doc_year', docYear);

    if (error) {
      console.error(`[docSequence] Error fetching ${tableName}:`, error);
      return startingSeq > 0 ? startingSeq : 1;
    }

    let maxNum = 0;

    if (docs && docs.length > 0) {
      docs.forEach((item: any) => {
        // 1. ตรวจสอบจาก doc_sequence โดยตรง
        if (item.doc_sequence !== null && item.doc_sequence !== undefined) {
          const seqVal = Number(item.doc_sequence);
          if (!isNaN(seqVal) && seqVal > maxNum) {
            maxNum = seqVal;
          }
        }

        // 2. สกัดหาตัวเลขจาก String ของเลขหนังสือ (เพื่อป้องกันกรณี doc_sequence เป็น NULL)
        const strVal = item[numberColumn];
        if (strVal && typeof strVal === 'string') {
          // ดึงกลุ่มตัวเลขทั้งหมด เช่น "ศธ 04153/150" -> ["04153", "150"]
          // หรือ "150/2569" -> ["150", "2569"]
          const matches = strVal.match(/(\d+)/g);
          if (matches && matches.length > 0) {
            matches.forEach((numStr) => {
              const parsed = parseInt(numStr, 10);
              // กรองตัวเลขที่ไม่ใช่ปี พ.ศ. (เช่น 2568, 2569, 2026) และไม่ใช่วงศากระทรวงยาวๆ
              if (!isNaN(parsed) && parsed !== docYear && parsed < 2000) {
                if (parsed > maxNum) {
                  maxNum = parsed;
                }
              }
            });
          }
        }
      });
    }

    const nextSeq = maxNum + 1;
    // หากค่าที่คำนวณได้ยังน้อยกว่าเลขเริ่มต้นที่ตั้งค่าไว้ใน Settings ให้ใช้เลขเริ่มต้น
    return Math.max(nextSeq, startingSeq > 0 ? startingSeq : 1);
  } catch (err) {
    console.error('[docSequence] Unexpected error:', err);
    return startingSeq > 0 ? startingSeq : 1;
  }
}
