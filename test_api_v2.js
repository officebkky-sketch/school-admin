import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testEmbedding() {
  const apiKey = 'AIzaSyBJdsm4VISTj2GzXpUjE5JdrHXis3cBwfI';
  const text = 'ทดสอบระบบ';
  
  const models = ["models/text-embedding-004", "models/embedding-001"];
  const versions = ["v1", "v1beta"];

  for (const model of models) {
    for (const version of versions) {
      console.log(`Testing ${model} on ${version}...`);
      try {
        const url = `https://generativelanguage.googleapis.com/${version}/${model}:embedContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model,
            content: { parts: [{ text }] }
          })
        });
        const data = await response.json();
        if (response.ok) {
          console.log(`SUCCESS! Model: ${model}, Version: ${version}, Dim: ${data.embedding?.values?.length}`);
          return;
        } else {
          console.log(`FAILED: ${data.error?.message?.slice(0, 50)}...`);
        }
      } catch (e) {
        console.log('ERROR:', e.message);
      }
    }
  }
}

testEmbedding();
