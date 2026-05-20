import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function parseEmbedding() {
  const { data } = await supabase.from('school_knowledge').select('embedding').limit(1);
  if (data && data[0]) {
    const embStr = data[0].embedding;
    try {
      const arr = JSON.parse(embStr);
      console.log('Parsed array length:', arr.length);
      console.log('First value:', arr[0]);
    } catch (e) {
      console.error('Parse error:', e.message);
      // Maybe it's already a vector and the output showed string because of how it was logged?
      // No, "Type of embedding: string" was explicit.
    }
  }
}

parseEmbedding();
