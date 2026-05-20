import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  console.log('--- 1. Testing teachers ---');
  const { error: e1 } = await supabase.from('teachers').select('*').limit(1);
  console.log('Teachers:', e1 ? 'Error: ' + e1.message : 'OK');

  console.log('\n--- 2. Testing procurement_projects ---');
  const { error: e2 } = await supabase.from('procurement_projects').select('*').limit(1);
  console.log('Procurement:', e2 ? 'Error: ' + e2.message : 'OK');
}

checkTables();
