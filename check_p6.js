import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkP6() {
  console.log('--- Checking P.6 Students in 2569 ---');
  const { data, error } = await supabase
    .from('students')
    .select('first_name, last_name, graduation_status, academic_year, gender, prefix')
    .eq('class_level', 'ป.6')
    .eq('academic_year', '2569');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Total P.6 in 2569: ${data.length}`);
  console.log('Sample Data (First 5):');
  console.log(JSON.stringify(data.slice(0, 5), null, 2));

  const statusCounts = data.reduce((acc, curr) => {
    const status = curr.graduation_status || 'ปกติ';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  console.log('Status Counts:', statusCounts);

  const genderCounts = data.reduce((acc, curr) => {
    const g = curr.gender || 'ไม่ระบุ';
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {});
  console.log('Gender Counts:', genderCounts);
}

checkP6();
