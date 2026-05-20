import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDeadlock() {
  console.log('--- 1. Testing budget_allocations ---');
  const { error: e1 } = await supabase.from('budget_allocations').select('*').limit(1);
  console.log('Result 1:', e1 ? 'Error: ' + e1.message : 'OK');

  console.log('\n--- 2. Testing school_projects ---');
  const { error: e2 } = await supabase.from('school_projects').select('*, budget_allocations(category_name)').limit(1);
  console.log('Result 2:', e2 ? 'Error: ' + e2.message : 'OK');

  console.log('\n--- 3. Testing budget_transfers ---');
  // เช็คว่าตารางนี้มีจริงไหม หรือชื่อผิด
  const { error: e3 } = await supabase.from('budget_transfers').select('*').limit(1);
  console.log('Result 3:', e3 ? 'Error: ' + e3.message : 'OK');

  console.log('\n--- 4. Testing procurement_projects join ---');
  const { error: e4 } = await supabase.from('procurement_projects').select(`
    *,
    vendors (vendor_name),
    school_projects (project_name)
  `).limit(1);
  console.log('Result 4:', e4 ? 'Error: ' + e4.message : 'OK');
}

checkDeadlock();
