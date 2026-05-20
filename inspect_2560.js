import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect2560() {
  const { data, error } = await supabase
    .from('school_knowledge')
    .select('chunk_text')
    .eq('document_name', '2560~2.PDF')
    .limit(3);

  if (data) {
    console.log('Content of 2560~2.PDF:');
    data.forEach((c, i) => console.log(`Chunk ${i+1}: ${c.chunk_text.substring(0, 300)}...\n`));
  }
}

inspect2560();
