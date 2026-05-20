import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAllKnowledge() {
  console.log('--- Checking "school_knowledge" (Intelligence Hub) ---');
  const { data: sk, error: skErr } = await supabase.from('school_knowledge').select('document_name').limit(100);
  if (skErr) console.error(skErr.message);
  else console.log('Docs in school_knowledge:', [...new Set(sk.map(d => d.document_name))]);

  console.log('\n--- Checking "ai_knowledge_base" (Virtual Drive) ---');
  const { data: akb, error: akbErr } = await supabase.from('ai_knowledge_base').select('file_name, content_text').limit(100);
  if (akbErr) console.error(akbErr.message);
  else {
    console.log('Docs in ai_knowledge_base:', akb.map(d => d.file_name));
    akb.forEach(d => {
      if (d.content_text && (d.content_text.includes('2569') || d.content_text.includes('โครงการ'))) {
        console.log(`- File "${d.file_name}" contains relevant text (Length: ${d.content_text.length})`);
      }
    });
  }
}

checkAllKnowledge();
