import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { supabase } from './supabase';

export async function importStudentData(file: File, academicYear: string) {
  return new Promise((resolve, reject) => {
    const isCSV = file.name.toLowerCase().endsWith('.csv');

    if (isCSV) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const data = await processAndUpload(results.data, academicYear);
            resolve(data);
          } catch (err) {
            reject(err);
          }
        },
        error: (err) => reject(err),
      });
    } else {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          const data = await processAndUpload(jsonData, academicYear);
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  });
}

function parseThaiDate(dateVal: any) {
  if (!dateVal) return null;
  const dateStr = String(dateVal).trim();
  
  // Handle formats like "18/12/2562" or "18-12-2562"
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parseInt(parts[2]);

    // Convert Buddhist Era (BE) to Common Era (CE)
    if (year > 2400) {
      year = year - 543;
    }

    return `${year}-${month}-${day}`; // ISO Format: YYYY-MM-DD
  }
  
  // Fallback for Excel serial dates or other formats
  return dateStr;
}

async function processAndUpload(jsonData: any[], academicYear: string) {
  if (jsonData.length === 0) throw new Error('ไม่พบข้อมูลในไฟล์');

  const studentsToAdd = jsonData.map((row: any) => ({
    academic_year: academicYear,
    school_id: row['รหัสโรงเรียน'] || '',
    school_name: row['ชื่อโรงเรียน'] || '',
    national_id: String(row['เลขบัตรประชาชน'] || ''),
    class_level: row['ชั้นเรียน'] || '',
    room: String(row['ห้องเรียน'] || ''),
    student_id: String(row['เลขประจำตัวนักเรียน'] || ''),
    prefix: row['คำนำหน้าชื่อ'] || '',
    first_name: row['ชื่อ'] || '',
    last_name: row['นามสกุล'] || '',
    gender: row['เพศ'] || '',
    birth_date: parseThaiDate(row['วันเดือนปีเกิด']),
    weight: parseFloat(row['น้ำหนัก']) || null,
    height: parseFloat(row['ส่วนสูง']) || null,
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
    parent_first_name: `${row['คำนำหน้าชื่อผู้ปกครอง'] || ''}${row['ชื่อผู้ปกครอง'] || ''}`.trim(),
    parent_last_name: row['นามสกุลผู้ปกครอง'] || '',
    parent_occupation: row['อาชีพผู้ปกครอง'] || '',
    parent_relation: row['ความเกี่ยวข้อง'] || '',
    father_first_name: `${row['คำนำหน้าชื่อบิดา'] || ''}${row['ชื่อบิดา'] || ''}`.trim(),
    father_last_name: row['นามสกุลบิดา'] || '',
    father_occupation: row['อาชีพบิดา'] || '',
    mother_first_name: `${row['คำนำหน้าชื่อมารดา'] || ''}${row['ชื่อมารดา'] || ''}`.trim(),
    mother_last_name: row['นามสกุลมารดา'] || '',
    mother_occupation: row['อาชีพมารดา'] || '',
    disadvantage_status: row['สถานะด้อยโอกาส'] || '',
    graduation_status: row['สถานะจำหน่าย'] || 'ปกติ',
  }));

  const { error } = await supabase
    .from('students')
    .upsert(studentsToAdd, { onConflict: 'student_id, academic_year' });

  if (error) throw error;
  return { count: studentsToAdd.length };
}
