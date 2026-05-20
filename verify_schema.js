import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyColumns() {
  console.log('Verifying columns for "school_projects"...');
  const { data, error } = await supabase.from('school_projects').select('*').limit(1);
  if (error) {
    console.error('Error fetching school_projects:', error.message);
  } else {
    if (data && data.length > 0) {
      console.log('Existing columns:', Object.keys(data[0]));
    } else {
      console.log('Table is empty. Checking "created_by" column explicitly...');
      const { error: colError } = await supabase.from('school_projects').select('created_by').limit(1);
      if (colError) {
        console.error('Column "created_by" DOES NOT EXIST:', colError.message);
      } else {
        console.log('Column "created_by" exists.');
      }
    }
  }
}

verifyColumns();
