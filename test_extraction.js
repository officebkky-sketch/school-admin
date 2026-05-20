import { extractProjectsFromKnowledge } from './src/lib/aiService.js';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read from .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const apiKey = env.VITE_GEMINI_API_KEY;

async function testExtraction() {
  console.log('Testing extractProjectsFromKnowledge...');
  try {
    const projects = await extractProjectsFromKnowledge(apiKey, '2569');
    console.log('Extracted projects:', JSON.stringify(projects, null, 2));
    console.log('Count:', projects.length);
  } catch (err) {
    console.error('Test error:', err);
  }
}

testExtraction();
