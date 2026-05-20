import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAllCols() {
  const cols = ['project_name', 'academic_year', 'budget_id', 'planned_amount', 'current_amount', 'spent_amount', 'created_by'];
  console.log('Checking school_projects columns...');
  for (const col of cols) {
    const { error } = await supabase.from('school_projects').select(col).limit(1);
    if (error) {
      console.log(`[X] Column "${col}" is MISSING: ${error.message}`);
    } else {
      console.log(`[OK] Column "${col}" exists.`);
    }
  }
}

checkAllCols();
