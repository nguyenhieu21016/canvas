import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  // Fetch all assignments
  const { data: assignments, error: err1 } = await supabase
    .from('assignments')
    .select('*');
  
  if (err1) {
    console.error('Error fetching assignments:', err1);
    return;
  }
  
  const assignmentMap = new Map(assignments.map(a => [a.id, a]));
  
  // Fetch all questions
  const { data: questions, error: err2 } = await supabase
    .from('questions')
    .select('*, answer_keys(*)');
  
  if (err2) {
    console.error('Error fetching questions:', err2);
    return;
  }

  // Print the first few questions and their answer_keys
  console.log('Sample questions with their answer_keys:');
  const sampleQs = questions.filter(q => q.answer_keys);
  sampleQs.slice(0, 5).forEach(q => {
    console.log(`Question ID: ${q.id} | Type: ${q.type} | answer_keys:`, q.answer_keys, 'Is Array?', Array.isArray(q.answer_keys));
  });

  // Group questions by assignment_id
  const questionsByAssignment = new Map();
  for (const q of questions) {
    if (!questionsByAssignment.has(q.assignment_id)) {
      questionsByAssignment.set(q.assignment_id, []);
    }
    questionsByAssignment.get(q.assignment_id).push(q);
  }

  console.log('\n--- Questions grouped by Assignment ID ---');
  for (const [assignmentId, qs] of questionsByAssignment.entries()) {
    const assocAssignment = assignmentMap.get(assignmentId);
    if (assocAssignment) {
      console.log(`Assignment ID: ${assignmentId}`);
      console.log(`  Title: "${assocAssignment.title}"`);
      console.log(`  Total Questions: ${qs.length}`);
      const withAnswers = qs.filter(q => {
        const ak = q.answer_keys;
        if (!ak) return false;
        if (Array.isArray(ak)) {
          return ak.length > 0 && (ak[0].correct_answer !== null || (ak[0].accepted_answers && ak[0].accepted_answers.length > 0));
        }
        return ak.correct_answer !== null || (ak.accepted_answers && ak.accepted_answers.length > 0);
      });
      console.log(`  Questions with correct answers: ${withAnswers.length}`);
    }
  }
}

run();
