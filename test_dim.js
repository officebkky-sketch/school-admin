import { createClient } from '@supabase/supabase-js';

async function testEmbedding2() {
  const apiKey = process.env.GEMINI_API_KEY || ''; // ลบ API Key ที่รั่วไหลออกเพื่อความปลอดภัย
  const text = 'ทดสอบระบบ';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "models/gemini-embedding-2",
        content: { parts: [{ text }] }
      })
    });
    const data = await response.json();
    if (response.ok) {
      console.log('SUCCESS! Vector length:', data.embedding?.values?.length);
    } else {
      console.log('FAILED:', data.error?.message);
    }
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

testEmbedding2();
