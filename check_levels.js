import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkLevels() {
  const { data, error } = await supabase.from('students').select('class_level, academic_year, graduation_status, gender');
  if (error) {
    console.error(error);
    return;
  }
  
  const years = [...new Set(data.map(d => d.academic_year))];
  const levels = [...new Set(data.map(d => d.class_level))];
  const statuses = [...new Set(data.map(d => d.graduation_status))];
  const genders = [...new Set(data.map(d => d.gender))];

  console.log('Years:', years);
  console.log('Levels:', levels);
  console.log('Statuses:', statuses);
  console.log('Genders:', genders);
  console.log('Total Records:', data.length);
}

checkLevels();
