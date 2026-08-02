import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('id, title, description, pdf_url, created_at');
  
  if (error) {
    console.error('Error fetching assignments:', error);
    return;
  }
  
  assignments.forEach(a => {
    console.log(`\n========================================`);
    console.log(`ID: ${a.id}`);
    console.log(`Title: "${a.title}"`);
    console.log(`PDF URL: "${a.pdf_url}"`);
    console.log(`Description Length: ${a.description?.length || 0}`);
    if (a.description) {
      console.log(`Description Snippet:\n${a.description.substring(0, 300)}...`);
    }
  });
}

run();
