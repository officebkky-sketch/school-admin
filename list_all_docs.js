import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listDocs() {
  const { data, error } = await supabase
    .from('school_knowledge')
    .select('document_name')
    .order('document_name');

  if (error) {
    console.error(error);
    return;
  }

  const uniqueDocs = [...new Set(data.map(d => d.document_name))];
  console.log('Unique Documents in Knowledge Base:');
  uniqueDocs.forEach(name => console.log(`- ${name}`));
  console.log('Total Chunks:', data.length);
}

listDocs();
