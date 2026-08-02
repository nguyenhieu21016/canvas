import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*');
  
  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }
  
  console.log('Profiles:', profiles);
}

run();
