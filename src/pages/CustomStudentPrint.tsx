import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Printer, 
  Filter, 
  CheckSquare, 
  Square,
  Loader2,
  LayoutGrid
} from 'lucide-react';

// ฝังฟอนต์ Base64 เพื่อให้หน้าต่างพิมพ์แสดงผลถูกต้อง 100% ใน Electron
const FONT_BASE64 = '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//sAEwAR//sAFAAR//sAFQAS//oAFgAT//oAFwAU//oAGAAV//oAGQAW//kAGgAX//kAGwAX//kAHAAY//kAHQAZ//gAHgAa//gAHwAb//gAIAAc//gAIQAd//cAIgAd//cAIwAe//cAJAAf//cAJQAg//YAJgAh//YAJwAi//YAKAAi//YAKQAj//UAKgAk//UAKwAl//UALAAm//UALQAn//QALgAo//QALwAo//QAMAAp//QAMQAq//MAMgAr//MAMwAs//MANAAt//MANQAu//IANgAu//IANwAv//IAOAAw//IAOQAx//EAOgAy//EAOwAz//EAPAAz//EAPQA0//AAPgA1//AAPwA2//AAQAA3//AAQQA4/+8AQgA5/+8AQwA5/+8ARAA6/+8ARQA7/+4ARgA8/+4ARwA9/+4ASAA+/+4ASQA//+0ASgA//+0ASwBA/+0ATABB/+0ATQBC/+wATgBD/+wATwBE/+wAUABE/+wAUQBF/+sAUgBG/+sAUwBH/+sAVABI/+sAVQBJ/+oAVgBK/+oAVwBK/+oAWABL/+oAWQBM/+kAWgBN/+kAWwBO/+kAXABP/+kAXQBQ/+gAXgBQ/+gAXwBR/+gAYABS/+gAYQBT/+cAYgBU/+cAYwBV/+cAZABV/+cAZQBW/+YAZgBX/+YAZwBY/+YAaABZ/+YAaQBa/+UAagBb/+UAawBb/+UAbABc/+UAbQBd/+QAbgBe/+QAbwBf/+QAcABg/+QAcQBh/+MAcgBh/+MAcwBi/+MAdABj/+MAdQBk/+IAdgBl/+IAdwBm/+IAeABm/+IAeQBn/+EAegBo/+EAewBp/+EAfABq/+EAfQBr/+AAfgBs/+AAfwBs/+AAgABt/+AAgQBu/98AggBv/98AgwBw/98AhABx/98AhQBy/94AhgBy/94AhwBz/94AiAB0/94AiQB1/90AigB2/90AiwB3/90AjAB3/90AjQB4/9wAjgB5/9wAjwB6/9wAkAB7/9wAkQB8/9sAkgB9/9sAkwB9/9sAlAB+/9sAlQB//9oAlgCA/9oAlwCB/9oAmACC/9oAmQCD/9kAmgCD/9kAmwCE/9kAnACF/9kAnQCG/9gAngCH/9gAnwCI/9gAoACI/9gAoQCJ/9cAogCK/9cAowCL/9cApACM/9cApQCN/9YApgCO/9YApwCO/9YAqACP/9YAqQCQ/9UAqgCR/9UAqwCS/9UArACT/9UArQCU/9QArgCU/9QArwCV/9QAsACW/9QAsQCX/9MAsgCY/9MAswCZ/9MAtACZ/9MAtQCa/9IAtgCb/9IAtwCc/9IAuACd/9IAuQCe/9EAugCf/9EAuwCf/9EAvACg/9EAvQCh/9AAvgCi/9AAvwCj/9AAwACk/9AAwQCl/88AwgCl/88AwwCm/88AxACn/88AxQCo/84AxgCp/84AxwCq/84AyACq/84AyQCr/80AygCs/80AywCt/80AzACu/80AzQCv/8wAzgCw/8wAzwCw/8wA0ACx/8wA0QCy/8sA0gCz/8sA0wC0/8sA1AC1/8sA1QC2/8oA1gC2/8oA1wC3/8oA2AC4/8oA2QC5/8kA2gC6/8kA2wC7/8kA3AC7/8kA3QC8/8gA3gC9/8gA3wC+/8gA4AC//8gA4QDA/8cA4gDB/8cA4wDB/8cA5ADC/8cA5QDD/8YA5gDE/8YA5wDF/8YA6ADG/8YA6QDH/8UA6gDH/8UA6wDI/8UA7ADJ/8UA7QDK/8QA7gDL/8QA7wDM/8QA8ADM/8QA8QDN/8MA8gDO/8MA8wDP/8MA9ADQ/8MA9QDR/8IA9gDS/8IA9wDS/8IA+ADT/8IA+QDU/8EA+gDV/8EA+wDW/8EA/ADX/8EA/QDY/8AA/gDY/8AA/gDZ/8AAAAADAAAAAwAABDYAAQAAAAAAHAADAAEAAAHmAAYBygAAACAA4AHwAAIAAwAEAAUABgAHAAgACQAKAAsADAANAA4ADwAQABEAEgATABQAFQAWABcAGAAZABoAGwAcAB0AHgAfACAAIQAiACMAJAAlACYAJwAoACkAKgArACwALQAuAC8AMAAxADIAMwA0ADUANgA3ADgAOQA6ADsAPAA9AD4APwBAAEEAQgBDAEQARQBGAEcASABJAEoASwBMAE0ATgBPAFAAUQBSAFMAVABVAFYAVwBYAFkAWgBbAFwAXQBeAF8AAAFDAAABNQDMATgBPAE5AToAzQE9AMcBQADFAAAAygAAAAABMwE0ATYBNwE7ATEBMgDTAUUAyAFBAMYAAADLAMkAAQBkAGUAZgBnAGgAaQBqAGsAbABtAG4AbwAOAHAAcQByAHMAdAB1AHYAdwB4AHkAegB7AHwAfQB+AH8AgACBAIIAgwCEAIUAhgCHAIgAiQCKAIsAjACNAI4AjwCQAJEAkgCTAJQAlQCWAJcAmACZAJoAmwCcAJ0AngCfAKAAoQCiAKMApAClAKYApwCoAKkAqgCrAKwArQCuAK8AsACxALIAswC0ALUAtgC3ALgAuQC6ALsAvAC9AL4AvwDAMEABAJQAAAAigCAAAYACgAgAH4AjgCeAKAArACtAP8BAwEHAQ0BEQEfASkBMQFCAVMBXwFhAWkBeAF+AZIBoQGwAscC3QMBAwMDCQMjDjoOWx75IA8gFCAaIB4gIiAmIDAgMyA6IEQgoyCsIRMhIiEmIS4hWiFeIgIiBiIPIhIiGiIeIisiSCJgImUlyiXM9xr3HfiC+wL//wAAACAAIQCOAJ4AoAChAK0ArgECAQYBDAEQAR4BKAEwAUEBUgFeAWABaAF4AX0BkgGgAa8CxgLYAwADAwMJAyMOAA4/HqAgDCATIBggHCAgICYgMCAyIDkgRCCjIKshEyEiISYhLiFTIVsiAiIGIg8iESIaIh4iKyJIImAiZCXKJcz3APcb+ID7Af//AAD/4QA8AC0AAP/DAAD/wgDQAM4AygDIALwAtAAA/4L/cwCB/2cAef9R/03/OgBDADb+B/33AAD+5f7e/sfy1fLR4tbhIeEe4RvhGuEZ4RbhDeEM4Qfg/uEtAADgMeAj4CDgGeCi4JHfRt9D3zvfOt8z3zDfJN8I3vHe7tuK24kKVgAACXEGcgABAIoAAAAAAAAAhAAAAIIAAAAAAAAAAAAAAAAAAAB0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAF4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAaAAAAAAAAAfAAAQAOAd4AwgHrAekB0QFDAfQBcQFyAAQCUAAAAIoAgAAYAAoAIAB+AI4AngCgAKwArQD/AQMBBwENAREBHwEpATEBQgFTAV8BYQFpAXgBfgGSAaEBsALHAt0DAQMDAwkDIw46Dlse+SAPIBQgGiAeICIgJiAwIDMgOiBEIKMgrCETISIhJiEuIVohXiICIgYiDyISIhoiHiIrIkgiYCJlJcolzPca9x34gvsC//8AAAAgACEAjgCeAKAAoQCtAK4BAgEGAQwBEAEeASgBMAFBAVIBXgFgAWgBeAF9AZIBoAGvAsYC2AMAAwMDCQMjDgAOPx6gIAwgEyAYIBwgICAmIDAgMiA5IEQgoyCrIRMhIiEmIS4hUyFbIgIiBiIPIhEiGiIeIisiSCJgImQlyiXM9wD3G/iA+wH//wAA/+EAPAAtAAD/wwAA/8IA0ADOAMoAyAC8ALQAAP+C/3MAgf9nAHn/Uf9N/zoAQwA2/gf99wAA/uX+3v7H8tXy0eLW4SHhHuEb4RrhGeEW4Q3hDOEH4P7hLQAA4DHgI+Ag4BngouCR30bfQ9873zrfM98w3yTfCN7x3u7bituJClYAAAlxBnIAAQCKAAAAAAAAAIQAAACCAAAAAAAAAAAAAAAAAAAAdAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAF4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAaAAAAAAAAAfAAAQAOAd4AwgHrAekB0QFDAfQBcQFyAAAuAAALEu4AAlQWLEBAY5ZuAH/hbgARB25AAkAA19eLbgAASwgIEVpRLABYC24AAIsuAABKiEtuAADLCBGsAMlRlJYI1kgiiCKSWSKIEYgaGFksAQlRiBoYWRSWCNlilkvILAAU1hpILAAVF==';
const FONT_BOLD_BASE64 = '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AQEBAQE3AQEBAQEBAQEBAQEBAQEBAQEBAQEBATsBOzcBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBOwEBAQEBAQEBAQEBAQEBAUwBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE7AQEBAQFMAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBOwEBAQEBAS8BAQEBAQEBAQEBAQEBAQEBAQEBAQFMAQFMTAEBAQEBAUxMATM7AUxMTEwBOy9MTExMTExMMwEBAQEBMwFMRAE7AQFEAQEBAUwBAQEBAQEBAQEFEAQEBAQEBAQEBAQEBAQEBREw3AQEBRAEBOwEBAQEBAQEBAQEBAQEBAQEBJgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAUwBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE7OzkBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAAAAAAAABAAAIAJCAYCAgMEAwcEAgICAgMEAgICAAMDAwMDAwMDAwICAQQEAgIFBAQEBAMDBAQBAwQDBQQGBAYFAwQEBAYEBAQCAgIEAwIDBAMEBAIDBAECAwIGBAUEBAIDAgQDBAMDAwICAgQEAAIAAgQEBAQBAwMFAgMEBQMDBAICAgQDAgICAwMFBQUDBAQEBAQEBQQDAwMDAQEBAQQEBQUFBQUEBgQEBAQEBQQDAwMDAwMGAwQEBAQBAQEBAwQEBAQEBAQFBAQEBAMFAwEDAgcGAwMEBAMEAgMDAgICAgMABQQEBQUEAwQEBAQGBgQFBAQGBgUFBAUEBQUFBQUFBQUEAwMEBAUDBQUEBQQEBAMDAAMEAAAAAAAAAAQCBAICAgIEAAAAAAAAAAAEBAUFBQQEBAUEBAYGAAAAAAMGAgICAwMDAwMCBQoBAgICAQUCBQQDAwQEBAQDBgIEBAQEBAQDAAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAAAAAEBAQECQQDBAMEAwQDBAMEAwQDBAMEAwQDBAMEAwMEAwQDBAMEAwQDBAMEAwQBAQEBBQQFBAUEBQQFBAUEBQQFBAUEBQQFBAUEBAQEBAQEBAQEBAQEBAQEAwQDBAMEAwQEBAMEAwQDBAQEAwEBAQMDBAQGBQQEAAAAAgAFBQUFAgQFBgQFBQUFBQUFBQAKCwcCAgMFBAgFAgICAwQCAgIDBAQEBAQEBAQFBAICBAQEAwYFBAQFBAQFBQIDBAQGBQYEBgUEBAUEBgQEBQIDAgQEAgQEAwQEAwMEAgIDAgYEBQQEAgMDBAQFAwQEAwIDBAQAAgACBQUFBQIEAwUDBAQFBAMEAwMDBAQCAgMDBAUFBQMFBQUFBQUGBAQEBAQCAgICBQUFBQUFBQQGBQUFBQQFBAQEBAQEBAYDBAQEBAICAgIEBAQEBAQEBAUEBAQEBAUEAgQCBwcEAwQFBAQCAwMCAwMDBAAFBAQFBQUDBAQEBAcHBAUEBQYHBQUEBQQFBQUFBQYGBQQEAwQEBQQFBQQFBQQFBAMAAwQAAAAAAAAABAIEAwMDAAgQAAAAAAAAAAAUFBQYGBQUFBgUFBgcAAAAAAwcDAwMEBAQEBAIFCwECAgIBBQMGBQMDBQUEBAQGAgQEBAQEBAQAAAAAAAAAAAAAAAAAAAcAAAAAAAAAAAAAAAQFBAUKBQQFBAUEBQQFBAUEBQQFBAUEBQQFBAUEBAQEBAQEBAQEBAQEBAQEBAICAgIFBAUEBQQFBAUEBQQFBAUEBQQFBAUEBQQFBAUEBQQFBAUEBQQFBAQEBAQEBAQEBAQFBAQDBAMFBAUDAgICBAMFBAYFBQQAAAACAAUFBQUCBAYGBQUFBQUFBQUFAAsLCAICAwUECAUCAwMEBQICAgMEBAQEBAQEBAUEAgIFBQUDBgUEBQUEBAUFAgMFBAYFBwQHBQQFBQUHBQQFAwMDBQQCBAUEBQQDBAUCAgQCBwUGBQUDAwMFBAUEBAQDAgMFBAACAAIFBQUFAgQEBgMEBQYEAwUDAwMFBAIDAwMEBgYGAwUFBQUFBQYFBAQEBAICAgIFBQYGBgYGBQcFBQUFBAUFBAQEBAQEBwQEBAQEAgICAgQFBQUFBQUFBGIBVwFYAVkBWgAAAAAAAAAAAAAAAAAAAAAAAAAAAAABaAFpAWoBawFsAW0BZwBjAAgBDQADAW4BbwFwAAgBBwABARYACADiAAQBZQAAAAABVgAAAZggAAABAAAACAAAAAYAAAAUAAABNgAAAVoAAAF8AAgA4wCOAAQABAABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAFAAUABQAAAAAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAIAAAABAAMAAAAA/////wACgAD/////AAIAAP////8AAAAAAAD//wAAAAAABAAIAOMAAgH0AXEAAAAAAoggAAABAAAACAAAAAYAAAAUAAACLAAAAlAAAAJwAAgAYAEJAAUAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAEAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAFAAUABQAFAAEAAQABAAEAAQABAAEAAQABAAEAAQAFAAUABQAAAAAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAIAAAABAAMAAAAA/////wACgAD/////AAIAAP////8AAAAAAAD//wAAAAQACAEBAAEBcg==';

export default function CustomStudentPrint() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [customColumns, setCustomColumns] = useState<string[]>([]);
  const [newColumnName, setNewColumnName] = useState('');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [config, setConfig] = useState({
    academicYear: '', classLevel: 'ทั้งหมด', room: 'ทั้งหมด', reportTitle: 'รายชื่อนักเรียน',
    showLogo: true, showSignatures: true, teacherName: '', directorName: '',
  });

  const [selectedColumns, setSelectedColumns] = useState({
    student_id: true, prefix_name: true, national_id: false, class_room: true,
    birth_date: false, parent_name: false, address: false, status: true,
  });

  const fetchInitialData = async () => {
    const { data: yearData } = await supabase.from('students').select('academic_year');
    if (yearData) {
      const years = Array.from(new Set(yearData.map(d => d.academic_year))).filter(Boolean).sort((a: any, b: any) => b.localeCompare(a));
      setAvailableYears(years as string[]);
    }
    const { data: settings } = await supabase.from('settings').select('current_academic_year').single();
    if (settings?.current_academic_year) setConfig(prev => ({ ...prev, academicYear: settings.current_academic_year }));
  };

  const fetchStudents = async () => {
    if (!config.academicYear) return;
    setLoading(true);
    let query = supabase.from('students').select('*').eq('academic_year', config.academicYear).or('graduation_status.ilike.%กำลังศึกษา%,graduation_status.eq.ปกติ');
    if (config.classLevel !== 'ทั้งหมด') query = query.eq('class_level', config.classLevel);
    if (config.room !== 'ทั้งหมด') query = query.eq('room', config.room);
    const { data, error } = await query.order('class_level', { ascending: true }).order('student_id', { ascending: true });
    if (error) console.error(error); else setStudents(data || []);
    setLoading(false);
  };

  const toThaiDigits = (num: string | number) => {
    if (!num) return '';
    const thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
    return num.toString().split('').map(d => isNaN(parseInt(d)) ? d : thaiDigits[parseInt(d)]).join('');
  };

  useEffect(() => { fetchInitialData(); }, []);
  useEffect(() => { fetchStudents(); }, [config.academicYear, config.classLevel, config.room]);

  const addCustomColumn = () => { if (newColumnName.trim()) { setCustomColumns([...customColumns, newColumnName.trim()]); setNewColumnName(''); } };
  const removeCustomColumn = (index: number) => { setCustomColumns(customColumns.filter((_, i) => i !== index)); };
  const toggleColumn = (col: string) => { setSelectedColumns(prev => ({ ...prev, [col]: !prev[col as keyof typeof selectedColumns] })); };

  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    return `${toThaiDigits(day)}/${toThaiDigits(month)}/${toThaiDigits(parseInt(year) + 543)}`;
  };

  const handlePrint = () => {
    const htmlRows = students.map((s, i) => `
      <tr>
        <td>${toThaiDigits(i + 1)}</td>
        ${selectedColumns.student_id ? `<td>${toThaiDigits(s.student_id || '-')}</td>` : ''}
        ${selectedColumns.prefix_name ? `<td style="text-align:left;">${s.prefix}${s.first_name} ${s.last_name}</td>` : ''}
        ${selectedColumns.national_id ? `<td>${toThaiDigits(s.national_id || '-')}</td>` : ''}
        ${selectedColumns.class_room ? `<td>${s.class_level}/${toThaiDigits(s.room)}</td>` : ''}
        ${selectedColumns.birth_date ? `<td>${formatThaiDate(s.birth_date)}</td>` : ''}
        ${selectedColumns.parent_name ? `<td style="text-align:left;">${s.parent_first_name} ${s.parent_last_name}</td>` : ''}
        ${selectedColumns.address ? `<td style="text-align:left; font-size: 13pt;">${toThaiDigits(s.address_no)} ม.${toThaiDigits(s.moo)} ต.${s.sub_district}</td>` : ''}
        ${selectedColumns.status ? `<td>${s.graduation_status}</td>` : ''}
        ${customColumns.map(() => `<td></td>`).join('')}
      </tr>
    `).join('');

    const headers = `
      <tr>
        <th style="width:50px;">ที่</th>
        ${selectedColumns.student_id ? '<th>เลขประจำตัว</th>' : ''}
        ${selectedColumns.prefix_name ? '<th>ชื่อ - นามสกุล</th>' : ''}
        ${selectedColumns.national_id ? '<th>เลขประชาชน</th>' : ''}
        ${selectedColumns.class_room ? '<th>ชั้น/ห้อง</th>' : ''}
        ${selectedColumns.birth_date ? '<th>วันเกิด</th>' : ''}
        ${selectedColumns.parent_name ? '<th>ผู้ปกครอง</th>' : ''}
        ${selectedColumns.address ? '<th>ที่อยู่</th>' : ''}
        ${selectedColumns.status ? '<th>สถานะ</th>' : ''}
        ${customColumns.map(col => `<th>${col}</th>`).join('')}
      </tr>
    `;

    const logoHtml = config.showLogo ? `<div style="text-align:center; margin-bottom: 10px;"><img src="/logo.png" style="width: 80px; height: auto;" /></div>` : '';

    const signatureHtml = config.showSignatures ? `
      <div style="margin-top: 1.5cm; display: flex; justify-content: space-between; width: 100%;">
        <div style="display: flex; flex-direction: column; align-items: center; width: 48%;">
          <table style="border: none !important; margin: 0 auto; border-spacing: 0;">
            <tr><td style="border: none !important; text-align: right; padding-right: 5px; font-size: 16pt;">ลงชื่อ</td><td style="border: none !important; text-align: center; font-size: 16pt;">...........................................................</td><td style="border: none !important; text-align: left; font-size: 16pt;">ผู้ให้ข้อมูล</td></tr>
            <tr><td style="border: none !important;"></td><td style="border: none !important; text-align: center; font-size: 16pt;">( ${config.teacherName || '.........................................................'} )</td><td style="border: none !important;"></td></tr>
          </table>
          <div style="font-size: 16pt;">ตำแหน่ง ครู</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; width: 48%;">
          <table style="border: none !important; margin: 0 auto; border-spacing: 0;">
            <tr><td style="border: none !important; text-align: right; padding-right: 5px; font-size: 16pt;">ลงชื่อ</td><td style="border: none !important; text-align: center; font-size: 16pt;">...........................................................</td><td style="border: none !important; text-align: left; font-size: 16pt;">ผู้รับรองข้อมูล</td></tr>
            <tr><td style="border: none !important;"></td><td style="border: none !important; text-align: center; font-size: 16pt;">( ${config.directorName || '.........................................................'} )</td><td style="border: none !important;"></td></tr>
          </table>
          <div style="font-size: 16pt;">ตำแหน่ง ผู้อำนวยการสถานศึกษา</div>
        </div>
      </div>
    ` : '';

    const html = `
      <html>
        <head>
          <title>${config.reportTitle}</title>
          <style>
            @font-face { font-family: 'TH Sarabun New'; src: url(data:font/truetype;charset=utf-8;base64,${FONT_BASE64}) format('truetype'); font-weight: normal; font-style: normal; }
            @font-face { font-family: 'TH Sarabun New'; src: url(data:font/truetype;charset=utf-8;base64,${FONT_BOLD_BASE64}) format('truetype'); font-weight: bold; font-style: normal; }
            @media print { @page { size: A4 ${orientation}; margin: 15mm; } .no-print-btn { display: none !important; } }
            .sarabun { font-family: 'TH Sarabun New', sans-serif; color: black; line-height: 1.0; }
            body { background: white; margin: 0; padding: 0; }
            .page { background: white; width: ${orientation === 'portrait' ? '210mm' : '297mm'}; padding: 1.5cm; margin: 0 auto; box-sizing: border-box; }
            .header { text-align: center; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black !important; padding: 4px 6px !important; text-align: center; font-size: 16pt; }
            th { background: #f8fafc; font-weight: bold; }
            .no-print-btn { position: fixed; top: 20px; right: 20px; background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 12px; cursor: pointer; font-weight: bold; z-index: 9999; }
          </style>
        </head>
        <body class="sarabun">
          <button class="no-print-btn" onclick="window.print()">🖨️ คลิกเพื่อสั่งพิมพ์</button>
          <div class="page">
            ${logoHtml}
            <div class="header">
              <h1 style="margin:0; font-size: 20pt; font-weight: bold;">${config.reportTitle}</h1>
              <p style="margin:5px 0; font-size: 16pt;">โรงเรียนบ้านควนโคกยา ปีการศึกษา ${toThaiDigits(config.academicYear)}</p>
              ${config.classLevel !== 'ทั้งหมด' ? `<p style="margin:0; font-size: 16pt;">ระดับชั้น ${config.classLevel} ${config.room !== 'ทั้งหมด' ? `ห้อง ${toThaiDigits(config.room)}` : ''}</p>` : ''}
            </div>
            <table><thead>${headers}</thead><tbody>${htmlRows}</tbody></table>
            ${signatureHtml}
          </div>
          <script>window.onload = function() { setTimeout(() => { window.print(); }, 800); }</script>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100 print:hidden">
        <div className="flex items-center gap-4 mb-10">
          <div className="bg-orange-50 p-4 rounded-3xl text-brand-secondary shadow-sm"><Printer size={32} /></div>
          <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">พิมพ์รายชื่อนักเรียน (กำหนดเอง)</h2><p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">เลือกและจัดรูปแบบรายงานได้ตามต้องการ</p></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1 space-y-8 border-r border-slate-50 pr-6">
            <div className="space-y-6">
              <h4 className="font-black text-slate-700 text-xs uppercase tracking-widest flex items-center gap-2"><Filter size={16} /> 1. กรองและตั้งค่ารายงาน</h4>
              <div className="space-y-4">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">ปีการศึกษา</label><select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 ring-brand-primary/20" value={config.academicYear} onChange={e => setConfig({...config, academicYear: e.target.value})}>{availableYears.map(y => <option key={y} value={y}>ปี {y}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">ชั้นเรียน</label><select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={config.classLevel} onChange={e => setConfig({...config, classLevel: e.target.value})}><option value="ทั้งหมด">ทั้งหมด</option>{['อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6'].map(l => <option key={l} value={l}>{l}</option>)}</select></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">ห้อง</label><select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={config.room} onChange={e => setConfig({...config, room: e.target.value})}><option value="ทั้งหมด">ทั้งหมด</option>{['1','2','3','4','5'].map(r => <option key={r} value={r}>{r}</option>)}</select></div></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">หัวข้อรายงาน</label><input type="text" className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl font-bold" value={config.reportTitle} onChange={e => setConfig({...config, reportTitle: e.target.value})} /></div>
                <div className="space-y-2 pt-4 border-t border-slate-50"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">การจัดวางหน้ากระดาษ</label><div className="flex gap-2"><button onClick={() => setOrientation('portrait')} className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${orientation === 'portrait' ? 'bg-brand-primary text-white' : 'bg-slate-50'}`}>แนวตั้ง</button><button onClick={() => setOrientation('landscape')} className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${orientation === 'landscape' ? 'bg-brand-primary text-white' : 'bg-slate-50'}`}>แนวนอน</button></div></div>
                <div className="space-y-4 pt-4 border-t border-slate-50"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ตัวเลือกการแสดงผล</p><div className="space-y-2"><label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer"><input type="checkbox" checked={config.showLogo} onChange={e => setConfig({...config, showLogo: e.target.checked})} /><span className="text-xs font-bold">แสดงโลโก้โรงเรียน</span></label><label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer"><input type="checkbox" checked={config.showSignatures} onChange={e => setConfig({...config, showSignatures: e.target.checked})} /><span className="text-xs font-bold">แสดงส่วนลงนาม</span></label></div></div>
                {config.showSignatures && <div className="space-y-3 pt-4 border-t border-slate-50 animate-in fade-in duration-300"><input type="text" placeholder="ชื่อครูผู้ให้ข้อมูล" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold" value={config.teacherName} onChange={e => setConfig({...config, teacherName: e.target.value})} /><input type="text" placeholder="ชื่อผู้อำนวยการ" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold" value={config.directorName} onChange={e => setConfig({...config, directorName: e.target.value})} /></div>}
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 space-y-8">
            <h4 className="font-black text-slate-700 text-xs uppercase tracking-widest flex items-center gap-2"><CheckSquare size={16} /> 2. เลือกคอลัมน์</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><ColumnToggle label="เลขประจำตัว" active={selectedColumns.student_id} onClick={() => toggleColumn('student_id')} /><ColumnToggle label="ชื่อ-นามสกุล" active={selectedColumns.prefix_name} onClick={() => toggleColumn('prefix_name')} /><ColumnToggle label="เลขประชาชน" active={selectedColumns.national_id} onClick={() => toggleColumn('national_id')} /><ColumnToggle label="ชั้น/ห้อง" active={selectedColumns.class_room} onClick={() => toggleColumn('class_room')} /><ColumnToggle label="วันเกิด" active={selectedColumns.birth_date} onClick={() => toggleColumn('birth_date')} /><ColumnToggle label="ผู้ปกครอง" active={selectedColumns.parent_name} onClick={() => toggleColumn('parent_name')} /><ColumnToggle label="ที่อยู่" active={selectedColumns.address} onClick={() => toggleColumn('address')} /><ColumnToggle label="สถานะ" active={selectedColumns.status} onClick={() => toggleColumn('status')} /></div>
            <div className="pt-8 space-y-4"><h4 className="font-black text-slate-700 text-xs uppercase tracking-widest flex items-center gap-2"><LayoutGrid size={16} /> 3. เพิ่มคอลัมน์เปล่า</h4><div className="flex gap-2"><input type="text" placeholder="ชื่อคอลัมน์ เช่น ลายมือชื่อ" className="flex-1 p-3.5 bg-white border border-slate-200 rounded-2xl font-bold" value={newColumnName} onChange={e => setNewColumnName(e.target.value)} /><button onClick={addCustomColumn} className="px-6 py-3 bg-slate-800 text-white rounded-2xl font-bold text-sm">เพิ่ม</button></div>{customColumns.length > 0 && <div className="flex flex-wrap gap-2 mt-4">{customColumns.map((col, index) => <div key={index} className="flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-xl font-bold text-xs border border-brand-primary/20">{col}<button onClick={() => removeCustomColumn(index)}>×</button></div>)}</div>}</div>
            <div className="pt-10 border-t border-slate-50 flex items-center justify-between"><div><p className="text-xl font-black text-slate-800">พบ {students.length} คน</p></div><button onClick={handlePrint} disabled={students.length === 0} className="bg-brand-primary text-white px-10 py-5 rounded-[28px] font-black text-lg flex items-center gap-3 shadow-xl"><Printer size={24} /> เริ่มพิมพ์รายงาน</button></div>
          </div>
        </div>
      </div>
      <div className="bg-slate-900 rounded-[40px] p-8 text-white"><div className="flex items-center gap-3 mb-6"><LayoutGrid size={20} className="text-brand-primary" /><h3 className="font-bold">ตัวอย่างข้อมูล</h3></div><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-white/10 text-slate-500 text-[10px] font-black uppercase tracking-widest"><th className="py-4">ที่</th>{selectedColumns.student_id && <th className="py-4">รหัส</th>}{selectedColumns.prefix_name && <th className="py-4">ชื่อ-สกุล</th>}{selectedColumns.class_room && <th className="py-4 text-center">ชั้น/ห้อง</th>}{selectedColumns.status && <th className="py-4 text-center">สถานะ</th>}</tr></thead><tbody className="divide-y divide-white/5">{loading ? <tr><td colSpan={5} className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-brand-primary" /></td></tr> : students.slice(0, 5).map((s, i) => <tr key={s.id} className="text-sm font-medium"><td className="py-4 text-slate-500">{i + 1}</td>{selectedColumns.student_id && <td className="py-4">{s.student_id}</td>}{selectedColumns.prefix_name && <td className="py-4">{s.prefix}{s.first_name} {s.last_name}</td>}{selectedColumns.class_room && <td className="py-4 text-center">{s.class_level}/{s.room}</td>}{selectedColumns.status && <td className="py-4 text-center"><span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded-md text-[10px]">{s.graduation_status}</span></td>}</tr>)}</tbody></table></div></div>
    </div>
  );
}

function ColumnToggle({ label, active, onClick }: any) { return <button onClick={onClick} className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${active ? 'bg-brand-primary/5 border-brand-primary text-brand-primary shadow-sm' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}>{active ? <CheckSquare size={18} /> : <Square size={18} />}<span className="text-xs font-black uppercase tracking-tight">{label}</span></button>; }
