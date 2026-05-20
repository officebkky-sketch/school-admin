import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function generateEmbedding(text, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: "models/text-embedding-004",
      content: { parts: [{ text }] }
    })
  });
  const data = await response.json();
  return data.embedding?.values;
}

async function testSearch() {
  const apiKey = process.env.GEMINI_API_KEY || ''; // ลบ API Key ที่รั่วไหลออกเพื่อความปลอดภัย
  const query = 'รายชื่อโครงการ โครงการจัดซื้อจัดจ้าง วงเงินงบประมาณ รายละเอียดโครงการ';
  
  console.log('--- Testing Vector Search ---');
  const embedding = await generateEmbedding(query, apiKey);
  if (!embedding) {
    console.error('Failed to generate embedding');
    return;
  }

  const { data, error } = await supabase.rpc('match_knowledge', {
    query_embedding: embedding,
    match_threshold: 0.1, // Test with lower threshold
    match_count: 5
  });

  if (error) {
    console.error('RPC Error:', error.message);
    return;
  }

  console.log('Matches Found:', data?.length);
  data?.forEach(m => console.log(`- [${m.document_name}]: ${m.chunk_text.slice(0, 100)}... (Similarity: ${m.similarity})`));
}

testSearch();
