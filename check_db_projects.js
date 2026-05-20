import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkProjectsInDB() {
  console.log('Checking school_projects in database...');
  const { data, error, count } = await supabase
    .from('school_projects')
    .select('*, budget_allocations(category_name)', { count: 'exact' });

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log(`Total projects in DB: ${count}`);
    console.log('Project details:', data.map(p => ({
      name: p.project_name,
      amount: p.planned_amount,
      budget: p.budget_allocations?.category_name
    })));
  }
}

checkProjectsInDB();
