import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectEmbedding() {
  const { data, error } = await supabase.from('school_knowledge').select('embedding').limit(1);
  if (data && data[0]) {
    const emb = data[0].embedding;
    console.log('Type of embedding:', typeof emb);
    console.log('Is Array?', Array.isArray(emb));
    if (Array.isArray(emb)) {
      console.log('Array length:', emb.length);
      console.log('First 5 values:', emb.slice(0, 5));
    } else {
      console.log('Sample string:', String(emb).substring(0, 100));
    }
  }
}

inspectEmbedding();
