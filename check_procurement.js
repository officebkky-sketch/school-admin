import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkProcurement() {
  console.log('--- Checking procurement_projects ---');
  const { data: tasks, error: taskErr } = await supabase.from('procurement_projects').select('*');
  if (taskErr) console.error('Error fetching tasks:', taskErr.message);
  else console.log('Total tasks:', tasks.length, tasks);

  console.log('\n--- Checking procurement_items ---');
  const { data: items, error: itemErr } = await supabase.from('procurement_items').select('*');
  if (itemErr) console.error('Error fetching items:', itemErr.message);
  else console.log('Total items:', items.length, items);
}

checkProcurement();
