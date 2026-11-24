import { describe, it, expect } from 'vitest';
import {
  EXAM_PRESETS,
  buildMatrixStats,
  buildPresetMatrix,
  allocateLevelQuotas,
  pickFromMatrix,
  shuffleMcqChoices,
  summarizePickedItems,
  buildExamDescription,
  exportQuestionsToLatex,
} from '../src/lib/examGenerator.js';
import {
  normalizeAssignmentEditor,
  parseLatexAssignment,
  buildAssignmentSeedFromBank,
  applyCategoryToTitle,
  extractCategoryFromTitle,
} from '../src/lib/assignment.js';

function makeSampleBank() {
  const bank = [];
  let seq = 1;
  const specs = [
    ['Bài 1 · Dạng 1: Đơn điệu (Đồ thị / BBT)', 'mcq', 'Nhận biết', 10],
    ['Bài 1 · Dạng 1: Đơn điệu (Đồ thị / BBT)', 'tf4', 'Thông hiểu', 4],
    ['Bài 1 · Dạng 2: Đơn điệu (Biểu thức)', 'mcq', 'Thông hiểu', 8],
    ['Bài 1 · Dạng 2: Đơn điệu (Biểu thức)', 'short', 'Vận dụng', 3],
    ['Bài 2 · Dạng 1: Cực trị (Biểu thức)', 'mcq', 'Nhận biết', 6],
    ['Bài 2 · Dạng 1: Cực trị (Biểu thức)', 'tf4', 'Thông hiểu', 4],
    ['Bài 2 · Dạng 1: Cực trị (Biểu thức)', 'short', 'Nhận biết', 4],
    ['Bài 3 · Dạng 1: GTLN - GTNN (Biểu thức)', 'mcq', 'Thông hiểu', 6],
    ['Bài 3 · Dạng 1: GTLN - GTNN (Biểu thức)', 'tf4', 'Nhận biết', 5],
    ['Bài 6: Ứng dụng đạo hàm thực tiễn', 'mcq', 'Vận dụng', 5],
    ['Bài 6: Ứng dụng đạo hàm thực tiễn', 'tf4', 'Thông hiểu', 6],
    ['Bài 6: Ứng dụng đạo hàm thực tiễn', 'short', 'Nhận biết', 6],
    ['Bài 6: Ứng dụng đạo hàm thực tiễn', 'short', 'Thông hiểu', 6],
    ['Bài 6: Ứng dụng đạo hàm thực tiễn', 'short', 'Vận dụng', 6],
  ];

  for (const [topic, type, level, count] of specs) {
    for (let i = 0; i < count; i += 1) {
      const id = `q-${seq++}`;
      bank.push({
        id,
        type,
        prompt: `Câu hỏi ${id} (${topic})`,
        choices: type === 'mcq' ? ['1', '2', '3', '4'] : [],
        settings: {
          level,
          statements: type === 'tf4' ? ['a', 'b', 'c', 'd'] : undefined,
          explanation: `Lời giải ${id}`,
        },
        tags: ['GĐ1 · Chương 1', topic, level],
        answer_keys: [
          type === 'mcq'
            ? { correct_answer: 'B' }
            : type === 'tf4'
              ? { correct_answer: [true, false, true, false] }
              : { correct_answer: '42', accepted_answers: ['42'] },
        ],
      });
    }
  }
  return bank;
}

describe('examGenerator', () => {
  it('builds a balanced 2025 preset matrix (12 TN, 4 TF4, 6 Short)', () => {
    const bank = makeSampleBank();
    const rows = buildMatrixStats(bank, 'all');
    const preset2025 = EXAM_PRESETS.find((p) => p.id === 'thpt-2025');
    const matrix = buildPresetMatrix(rows, preset2025);

    const picked = pickFromMatrix(bank, matrix, { levelMode: 'all' });
    const summary = summarizePickedItems(picked);

    expect(summary.byType.mcq).toBe(12);
    expect(summary.byType.tf4).toBe(4);
    expect(summary.byType.short).toBe(6);
    expect(summary.total).toBe(22);

    // No duplicate question IDs
    const uniqueIds = new Set(picked.map((x) => x.q.id));
    expect(uniqueIds.size).toBe(22);
  });

  it('allocates NB/TH/VD quotas with largest-remainder method and respects them during picking', () => {
    const quotas = allocateLevelQuotas(10, { 'Nhận biết': 40, 'Thông hiểu': 40, 'Vận dụng': 20 });
    expect(quotas).toEqual({ 'Nhận biết': 4, 'Thông hiểu': 4, 'Vận dụng': 2 });

    const bank = makeSampleBank();
    const matrix = {
      'Bài 6: Ứng dụng đạo hàm thực tiễn': { mcq: 0, tf4: 0, short: 10 },
    };
    const picked = pickFromMatrix(bank, matrix, {
      levelMode: 'ratio',
      levelRatio: { 'Nhận biết': 40, 'Thông hiểu': 40, 'Vận dụng': 20 },
    });
    const summary = summarizePickedItems(picked);
    expect(summary.total).toBe(10);
    expect(summary.byLevel['Nhận biết']).toBe(4);
    expect(summary.byLevel['Thông hiểu']).toBe(4);
    expect(summary.byLevel['Vận dụng']).toBe(2);
  });

  it('preserves pinned questions when reshuffling the remaining slots', () => {
    const bank = makeSampleBank();
    const matrix = {
      'Bài 6: Ứng dụng đạo hàm thực tiễn': { mcq: 0, tf4: 0, short: 6 },
    };
    const firstPick = pickFromMatrix(bank, matrix, { levelMode: 'all' });
    firstPick[0].pinned = true;
    firstPick[1].pinned = true;
    const pinnedIds = [firstPick[0].q.id, firstPick[1].q.id];

    const secondPick = pickFromMatrix(bank, matrix, {
      levelMode: 'all',
      pinnedItems: firstPick,
    });
    expect(secondPick).toHaveLength(6);
    const secondIds = secondPick.map((x) => x.q.id);
    expect(secondIds).toContain(pinnedIds[0]);
    expect(secondIds).toContain(pinnedIds[1]);
    expect(new Set(secondIds).size).toBe(6);
  });

  it('shuffles MCQ choices safely and keeps correct_answer pointing to the right option', () => {
    const q = {
      type: 'mcq',
      choices: ['Đáp án sai 1', 'Đáp án đúng thật', 'Đáp án sai 2', 'Đáp án sai 3'],
    };
    const key = { correct_answer: 'B' };
    // Deterministic rng that rotates positions
    const res = shuffleMcqChoices(q, key, () => 0.1);
    const letterIdx = ['A', 'B', 'C', 'D'].indexOf(res.answerKey.correct_answer);
    expect(letterIdx).toBeGreaterThanOrEqual(0);
    expect(res.choices[letterIdx]).toBe('Đáp án đúng thật');

    // Positional choice text should NOT be shuffled
    const positionalQ = {
      type: 'mcq',
      choices: ['Phương án 1', 'Phương án 2', 'Cả A và B đều đúng', 'Không có đáp án'],
    };
    const skipped = shuffleMcqChoices(positionalQ, { correct_answer: 'C' }, () => 0.1);
    expect(skipped.choices).toEqual(positionalQ.choices);
    expect(skipped.answerKey.correct_answer).toBe('C');
  });

  it('exports generated exam items into EX_TEST LaTeX format and builds summary description', () => {
    const bank = makeSampleBank();
    const matrix = {
      'Bài 1 · Dạng 1: Đơn điệu (Đồ thị / BBT)': { mcq: 1, tf4: 1, short: 0 },
      'Bài 6: Ứng dụng đạo hàm thực tiễn': { mcq: 0, tf4: 0, short: 1 },
    };
    const picked = pickFromMatrix(bank, matrix, { levelMode: 'all' });
    const desc = buildExamDescription(picked);
    expect(desc).toContain('Phần I: 1 câu Trắc nghiệm');
    expect(desc).toContain('Phần II: 1 câu Đúng/Sai');
    expect(desc).toContain('Phần III: 1 câu Trả lời ngắn');

    const tex = exportQuestionsToLatex('Đề thử nghiệm', picked);
    expect(tex).toContain('\\begin{ex}');
    expect(tex).toContain('\\choice');
    expect(tex).toContain('\\choiceTF');
    expect(tex).toContain('\\shortans{42}');
    expect(tex).toContain('\\True ');
  });

  it('normalizes Question Bank assignments into editable EX_TEST LaTeX source when description is summary text', () => {
    const bank = makeSampleBank();
    const picked = pickFromMatrix(
      bank,
      {
        'Bài 1 · Dạng 1: Đơn điệu (Đồ thị / BBT)': { mcq: 1, tf4: 1, short: 0 },
        'Bài 6: Ứng dụng đạo hàm thực tiễn': { mcq: 0, tf4: 0, short: 1 },
      },
      { levelMode: 'all' },
    );

    const normalized = normalizeAssignmentEditor({
      assignment: {
        id: 'asg-1',
        title: 'Đề từ ngân hàng câu hỏi',
        pdf_url: 'latex',
        description: buildExamDescription(picked),
      },
      questions: picked.map((x) => x.q),
    });

    expect(normalized.latexSource).toContain('\\begin{ex}');
    const reparsed = parseLatexAssignment(normalized.latexSource);
    expect(reparsed).toHaveLength(3);
    expect(reparsed.map((q) => q.type)).toEqual(['mcq', 'tf4', 'short']);
    expect(reparsed[0].answer_key.correct_answer).toBe('B');
    expect(reparsed[1].answer_key.correct_answer).toEqual([true, false, true, false]);
    expect(reparsed[2].answer_key.accepted_answers).toEqual(['42']);
  });

  it('preserves explicit EX_TEST LaTeX description without overwriting', () => {
    const rawLatex = '\\begin{ex}\n$1+1=$\n\\choice\n{\\True $2$}\n{$3$}\n{$4$}\n{$5$}\n\\end{ex}';
    const normalized = normalizeAssignmentEditor({
      assignment: {
        id: 'asg-2',
        title: 'Đề LaTeX thủ công',
        pdf_url: 'latex',
        description: rawLatex,
      },
      questions: [],
    });
    expect(normalized.latexSource).toBe(rawLatex);
  });

  it('builds a full assignment editor seed (title, category, lecture_id, EX_TEST LaTeX) from bank items and appends cleanly', () => {
    expect(extractCategoryFromTitle('[Đại số] Đề số 1')).toEqual({
      category: 'Đại số',
      cleanTitle: 'Đề số 1',
    });
    expect(applyCategoryToTitle('Đề số 1', 'Hình học')).toBe('[Hình học] Đề số 1');
    expect(applyCategoryToTitle('[Đại số] Đề số 1', '')).toBe('Đề số 1');

    const bank = makeSampleBank();
    const picked = pickFromMatrix(
      bank,
      { 'Bài 1 · Dạng 1: Đơn điệu (Đồ thị / BBT)': { mcq: 1, tf4: 1, short: 0 } },
      { levelMode: 'all' },
    );

    const seed = buildAssignmentSeedFromBank(picked, {
      title: 'Đề kiểm tra 15 phút',
      category: 'Giải tích',
      lectureId: 'lec-1',
      published: false,
    });

    expect(seed.assignment.title).toBe('[Giải tích] Đề kiểm tra 15 phút');
    expect(seed.assignment.category).toBe('Giải tích');
    expect(seed.assignment.lecture_id).toBe('lec-1');
    expect(seed.assignment.published).toBe(false);
    expect(seed.questions).toHaveLength(2);
    expect(seed.latexSource).toContain('\\begin{ex}');

    // Appending extra short-answer question preserves existing metadata and merges LaTeX
    const shortQ = bank.find((q) => q.type === 'short');
    const merged = buildAssignmentSeedFromBank([shortQ], { existingEditor: seed });
    expect(merged.assignment.lecture_id).toBe('lec-1');
    expect(merged.assignment.title).toBe('[Giải tích] Đề kiểm tra 15 phút');
    expect(merged.questions).toHaveLength(3);
    expect(merged.questions.map((q) => q.type)).toEqual(['mcq', 'tf4', 'short']);
  });
});
