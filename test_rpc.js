import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzrrpxrmtjpgfbbvhjra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cnJweHJtdGpwZ2ZiYnZoanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzIzODAsImV4cCI6MjA5MzI0ODM4MH0.1R5UNgnEFCm1TaHWgUuphBlKxUEZCGfkUD4qvBIe6u4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRPC() {
  console.log('Testing "match_knowledge" RPC...');
  // Since I don't have an embedding handy, I'll just try to call it with a zero vector 
  // to see if the RPC exists and what error it gives.
  const zeroVector = new Array(1536).fill(0); // Common dim, or 768/3072
  
  const { data, error } = await supabase.rpc('match_knowledge', {
    query_embedding: zeroVector,
    match_threshold: 0.1,
    match_count: 1
  });

  if (error) {
    console.error('RPC Error:', error.message);
    if (error.message.includes('does not exist')) {
       console.log('Trying "match_school_knowledge"...');
       const { error: error2 } = await supabase.rpc('match_school_knowledge', {
         query_embedding: zeroVector,
         match_threshold: 0.1,
         match_count: 1
       });
       if (error2) console.error('RPC 2 Error:', error2.message);
       else console.log('"match_school_knowledge" exists!');
    }
  } else {
    console.log('RPC exists and returned:', data);
  }
}

testRPC();
