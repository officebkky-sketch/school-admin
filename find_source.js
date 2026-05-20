import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function findProjectSource() {
  console.log('Searching for the source of 13 projects (148,000 baht)...');
  
  // Search for the specific number "148,000" or projects mentioned
  const { data, error } = await supabase
    .from('school_knowledge')
    .select('document_name, chunk_text')
    .ilike('chunk_text', '%148,000%');

  if (error) {
    console.error(error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log('Found in document:', data[0].document_name);
    console.log('Snippet:', data[0].chunk_text.substring(0, 500));
  } else {
    console.log('Could not find "148,000" with ILIKE. Trying broad search...');
    const { data: allDocs } = await supabase.from('school_knowledge').select('document_name').limit(1000);
    const unique = [...new Set(allDocs.map(d => d.document_name))];
    console.log('All available documents in DB:', unique);
  }
}

findProjectSource();
