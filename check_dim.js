import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkVectorDim() {
  console.log('Checking embedding dimension in school_knowledge...');
  const { data, error } = await supabase.from('school_knowledge').select('embedding').limit(1);
  if (error) {
    console.error(error.message);
  } else if (data && data.length > 0) {
    console.log('Dimension of existing embedding:', data[0].embedding.length);
  } else {
    console.log('No data in school_knowledge');
  }
}

checkVectorDim();
