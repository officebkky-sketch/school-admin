import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
  const { data: students, error } = await supabase.from('students').select('*').limit(5);
  if (error) {
    console.error(error);
    return;
  }
  console.log('Sample Students:', JSON.stringify(students, null, 2));
  
  const { data: count } = await supabase.from('students').select('id', { count: 'exact' });
  console.log('Total Count:', count?.length);

  const { data: settings } = await supabase.from('settings').select('*').maybeSingle();
  console.log('Settings:', JSON.stringify(settings, null, 2));
}

checkData();
