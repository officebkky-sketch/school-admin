import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkKnowledge() {
  console.log('Checking school_knowledge for year 2569...');
  
  // 1. Check all chunks to see what documents we have
  const { data: docs, error } = await supabase
    .from('school_knowledge')
    .select('document_name')
    .limit(100);

  if (error) {
    console.error('Error fetching knowledge:', error.message);
    return;
  }

  const uniqueDocs = [...new Set(docs.map(d => d.document_name))];
  console.log('Documents found in knowledge base:', uniqueDocs);

  // 2. Search for specifically 2569 or "โครงการ"
  const { data: projectChunks, count } = await supabase
    .from('school_knowledge')
    .select('document_name, chunk_text', { count: 'exact' })
    .or(`chunk_text.ilike.%2569%,chunk_text.ilike.%โครงการ%,document_name.ilike.%แผนปฏิบัติการ%`)
    .limit(5);

  console.log(`\nFound ${count} chunks matching project/2569 criteria.`);
  if (projectChunks && projectChunks.length > 0) {
    console.log('Sample text from first chunk:', projectChunks[0].chunk_text.substring(0, 200));
  }
}

checkKnowledge();
