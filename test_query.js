import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('URL:', supabaseUrl);
console.log('Key length:', supabaseAnonKey?.length);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('*');
  
  if (error) {
    console.error('Error fetching assignments:', error);
    return;
  }
  
  console.log('Total assignments:', assignments.length);
  assignments.forEach(a => {
    console.log(`ID: ${a.id} | Title: "${a.title}" | Lecture ID: ${a.lecture_id} | Created: ${a.created_at}`);
  });
}

run();
