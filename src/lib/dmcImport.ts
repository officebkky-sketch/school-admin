import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

export async function importDMCExcel(file: File, academicYear: string) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          throw new Error('ไม่พบข้อมูลในไฟล์ Excel');
        }

        // Mapping DMC Columns to Supabase Table Columns
        // Note: Field names based on typical DMC export + original GAS headers
        const studentsToAdd = jsonData.map((row: any) => ({
          academic_year: academicYear,
          school_id: row['รหัสโรงเรียน'] || '',
          school_name: row['ชื่อโรงเรียน'] || '',
          national_id: String(row['เลขบัตรประชาชน'] || ''),
          class_level: row['ชั้นเรียน'] || '',
          room: String(row['ห้องเรียน'] || ''),
          student_id: String(row['เลขประจำตัวนักเรียน'] || ''),
          prefix: row['คำนำหน้าชื่อ'] || row['คำนำหน้า'] || '',
          first_name: row['ชื่อ'] || '',
          last_name: row['นามสกุล'] || '',
          gender: row['เพศ'] || '',
          birth_date: row['วันเดือนปีเกิด'] || null,
          weight: row['น้ำหนัก'] || null,
          height: row['ส่วนสูง'] || null,
          blood_group: row['กลุ่มเลือด'] || '',
          religion: row['ศาสนา'] || '',
          ethnicity: row['เชื้อชาติ'] || '',
          nationality: row['สัญชาติ'] || '',
          address_no: row['บ้านเลขที่'] || '',
          moo: row['หมู่'] || '',
          soi_road: row['ถนนซอย'] || '',
          sub_district: row['ตำบล'] || '',
          district: row['อำเภอ'] || '',
          province: row['จังหวัด'] || '',
          parent_first_name: row['ชื่อผู้ปกครอง'] || '',
          parent_last_name: row['นามสกุลผู้ปกครอง'] || '',
          parent_occupation: row['อาชีพผู้ปกครอง'] || '',
          parent_relation: row['ความเกี่ยวข้อง'] || '',
          father_first_name: row['ชื่อบิดา'] || '',
          father_last_name: row['นามสกุลบิดา'] || '',
          father_occupation: row['อาชีพบิดา'] || '',
          mother_first_name: row['ชื่อมารดา'] || '',
          mother_last_name: row['นามสกุลมารดา'] || '',
          mother_occupation: row['อาชีพมารดา'] || '',
          disadvantage_status: row['สถานะด้อยโอกาส'] || '',
          graduation_status: row['สถานะจำหน่าย'] || 'ปกติ',
        }));

        // Batch insert into Supabase
        // Upsert by student_id and academic_year if possible, or just insert
        const { error } = await supabase
          .from('students')
          .upsert(studentsToAdd, { onConflict: 'student_id, academic_year' }); // Need unique constraint on Supabase

        if (error) throw error;

        resolve({ success: true, count: studentsToAdd.length });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
