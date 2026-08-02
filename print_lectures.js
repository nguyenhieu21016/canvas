import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: lectures, error: err1 } = await supabase
    .from('lectures')
    .select('*, lecture_groups(*, modules(*, phases(*)))');
  
  if (err1) {
    console.error('Error fetching lectures:', err1);
    return;
  }
  
  console.log('Lectures list:');
  lectures.forEach(l => {
    console.log(`Lecture ID: ${l.id} | Title: "${l.title}" | Phase: "${l.lecture_groups?.modules?.phases?.title || 'none'}"`);
  });
}

run();
