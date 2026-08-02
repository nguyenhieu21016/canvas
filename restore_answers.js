import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.argv[2];

if (!serviceRoleKey) {
  console.error("=========================================================================");
  console.error("LỖI: Vui lòng cung cấp Supabase Service Role Key để bỏ qua RLS.");
  console.error("Cách chạy:");
  console.error("  SUPABASE_SERVICE_ROLE_KEY=your_key node restore_answers.js");
  console.error("Hoặc:");
  console.error("  node restore_answers.js your_key");
  console.error("=========================================================================");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const vennAnswers = {
  1: ["1170"],
  2: ["11"],
  3: ["11"],
  4: ["10"],
  5: ["20"],
  6: ["4"],
  7: ["16"],
  8: ["20"],
  9: ["84"],
  10: ["18"],
  11: ["18"],
  12: ["37/55", "0.67", "67.27%"],
  13: ["14"]
};

const hoanViAnswers = {
  1: ["24908083200"],
  2: ["48"],
  3: ["625"],
  4: ["240"],
  5: ["1152"],
  6: ["2880"],
  7: ["103680"],
  8: ["10080"],
  9: ["864"],
  10: ["1814400"],
  11: ["3600"],
  12: ["44"],
  13: ["265"]
};

async function restore(assignmentId, answersMap, label) {
  console.log(`\nKhôi phục đáp án cho đề: ${label} (${assignmentId})`);
  
  // 1. Fetch questions of this assignment ordered by sort_order
  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('id, sort_order')
    .eq('assignment_id', assignmentId)
    .order('sort_order', { ascending: true });
  
  if (qErr) {
    console.error(`Lỗi khi lấy danh sách câu hỏi:`, qErr);
    return;
  }
  
  console.log(`Tìm thấy ${questions.length} câu hỏi.`);
  
  const keyRows = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    // sort_order is 1-indexed for matching, or we can use physical index (i+1)
    const idx = q.sort_order;
    const ans = answersMap[idx];
    if (ans) {
      keyRows.push({
        question_id: q.id,
        correct_answer: null,
        accepted_answers: ans,
        points_map: []
      });
      console.log(`  Câu ${idx}: ID=${q.id} -> ${ans.join(', ')}`);
    } else {
      console.warn(`  Cảnh báo: Không tìm thấy đáp án phù hợp cho câu có sort_order=${idx}`);
    }
  }
  
  if (keyRows.length > 0) {
    const { error: keyErr } = await supabase
      .from('answer_keys')
      .upsert(keyRows, { onConflict: 'question_id' });
    
    if (keyErr) {
      console.error(`Lỗi khi lưu đáp án vào bảng answer_keys:`, keyErr);
    } else {
      console.log(`=> Đã khôi phục thành công đáp án cho ${keyRows.length} câu hỏi!`);
    }
  }
}

async function run() {
  await restore('bd409ea9-0ba4-4e49-b249-e6587b336594', vennAnswers, "Bài tập về nhà - Sơ đồ Venn (Đề số 1)");
  await restore('e013b4d1-4c6c-4a9c-a1bc-bf98c2cc2f6b', hoanViAnswers, "Bài tập về nhà - Hoán vị, hoán vị sai chỗ (Đề số 1)");
}

run();
