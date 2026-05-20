import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testEmbedding() {
  const apiKey = 'AIzaSyBJdsm4VISTj2GzXpUjE5JdrHXis3cBwfI'; // Use Co-work key
  const text = 'ทดสอบระบบ';
  
  const urls = [
    `https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent?key=${apiKey}`,
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`
  ];

  for (const url of urls) {
    console.log('Testing URL:', url.split('?')[0]);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text }] }
        })
      });
      const data = await response.json();
      if (response.ok) {
        console.log('SUCCESS! Vector length:', data.embedding?.values?.length);
        return;
      } else {
        console.log('FAILED:', JSON.stringify(data.error));
      }
    } catch (e) {
      console.log('ERROR:', e.message);
    }
  }
}

testEmbedding();
