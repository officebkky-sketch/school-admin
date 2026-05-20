import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function diagnose() {
  console.log('--- 1. Checking Table Structure (Select 1) ---');
  const { data: v, error: vErr } = await supabase.from('vendors').select('*').limit(1);
  console.log('Vendors Sample:', v, 'Error:', vErr?.message);

  const { data: p, error: pErr } = await supabase.from('school_projects').select('*').limit(1);
  console.log('School Projects Sample:', p, 'Error:', pErr?.message);

  const { data: pr, error: prErr } = await supabase.from('procurement_projects').select('*').limit(1);
  console.log('Procurement Projects Sample:', pr, 'Error:', prErr?.message);

  console.log('\n--- 2. Checking AI Knowledge Base ---');
  const { data: k, count } = await supabase.from('school_knowledge').select('document_name, chunk_text', { count: 'exact' }).limit(5);
  console.log('Total Chunks in Knowledge Base:', count);
  console.log('Sample Data Names:', k?.map(i => i.document_name));
}

diagnose();
