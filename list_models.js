import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listModels() {
  const apiKey = 'AIzaSyBJdsm4VISTj2GzXpUjE5JdrHXis3cBwfI';
  console.log('--- Listing Available Models ---');
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    if (response.ok) {
      data.models.forEach(m => {
        console.log(`- ${m.name} [${m.supportedGenerationMethods.join(', ')}]`);
      });
    } else {
      console.log('Error:', data.error?.message);
    }
  } catch (e) {
    console.log('Fetch Error:', e.message);
  }
}

listModels();
