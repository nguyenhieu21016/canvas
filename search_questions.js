import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: questions, error } = await supabase
    .from('questions')
    .select('*, assignments(*)');
  
  if (error) {
    console.error('Error fetching questions:', error);
    return;
  }
  
  console.log(`Total questions: ${questions.length}`);
  
  const keywords = ['xác suất', 'xac suat', 'xs'];
  const matches = questions.filter(q => {
    const prompt = (q.prompt || '').toLowerCase();
    const title = (q.assignments?.title || '').toLowerCase();
    return keywords.some(k => prompt.includes(k) || title.includes(k));
  });
  
  console.log(`Found ${matches.length} matching questions.`);
  
  // Group by assignment
  const grouped = new Map();
  for (const q of matches) {
    const aId = q.assignment_id;
    if (!grouped.has(aId)) {
      grouped.set(aId, {
        assignment: q.assignments,
        questions: []
      });
    }
    grouped.get(aId).questions.push(q);
  }
  
  for (const [aId, data] of grouped.entries()) {
    console.log(`\nAssignment ID: ${aId}`);
    console.log(`Assignment Title: "${data.assignment?.title}"`);
    console.log(`Questions count: ${data.questions.length}`);
    data.questions.forEach((q, idx) => {
      console.log(`  Question ${idx+1} [ID: ${q.id}]: Prompt: "${q.prompt.substring(0, 100)}..."`);
    });
  }
}

run();
