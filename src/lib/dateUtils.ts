/**
 * แปลงรูปแบบวันที่จาก YYYY-MM-DD หรือ ISO string เป็น DD-MM-YYYY (พ.ศ.)
 * เช่น '2026-08-27' -> '27-08-2569'
 */
export function formatDateDMY(dateInput?: string | null): string {
  if (!dateInput) return '-';
  try {
    const clean = String(dateInput).trim();
    if (!clean) return '-';
    
    // หากเป็น YYYY-MM-DD
    const match = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      const thaiYear = year < 2400 ? year + 543 : year;
      return day + '-' + month + '-' + thaiYear;
    }

    const d = new Date(clean.includes('T') ? clean : clean + 'T00:00:00');
    if (isNaN(d.getTime())) return clean;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear() < 2400 ? d.getFullYear() + 543 : d.getFullYear();
    return day + '-' + month + '-' + year;
  } catch {
    return dateInput;
  }
}
