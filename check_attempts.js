import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: attempts, error } = await supabase
    .from('attempts')
    .select('*, assignments(*)');
  
  if (error) {
    console.error('Error fetching attempts:', error);
    return;
  }
  
  console.log(`Total attempts: ${attempts.length}`);
  attempts.forEach((att, idx) => {
    console.log(`Attempt ${idx+1}: ID: ${att.id} | Assignment: "${att.assignments?.title || 'Unknown'}" | Student: ${att.student_id} | Created: ${att.created_at}`);
  });
}

run();
