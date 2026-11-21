export const GEN_TYPES = [
  { key: 'mcq', label: 'Phần I · Trắc nghiệm', shortLabel: 'Trắc nghiệm', code: 'TN', order: 1 },
  { key: 'tf4', label: 'Phần II · Đúng / Sai', shortLabel: 'Đúng / Sai', code: 'Đ/S', order: 2 },
  { key: 'short', label: 'Phần III · Trả lời ngắn', shortLabel: 'Trả lời ngắn', code: 'TLN', order: 3 },
];

export const GEN_LEVELS = ['Nhận biết', 'Thông hiểu', 'Vận dụng'];

export const EXAM_PRESETS = [
  {
    id: 'thpt-2025',
    label: 'Đề chuẩn 2025',
    badge: '12 TN · 4 Đ/S · 6 TLN',
    title: '[Chuẩn 2025] Đề kiểm tra Chương 1 — Ứng dụng đạo hàm',
    targets: { mcq: 12, tf4: 4, short: 6 },
    topicFilter: null,
    preferWeights: {
      short: { 'Bài 6': 4 },
      tf4: { 'Bài 6': 1 },
    },
  },
  {
    id: 'test-45',
    label: 'Kiểm tra 45 phút',
    badge: '12 TN · 2 Đ/S · 4 TLN',
    title: '[45 phút] Đề kiểm tra Chương 1 — Khảo sát hàm số',
    targets: { mcq: 12, tf4: 2, short: 4 },
    topicFilter: null,
    preferWeights: {
      short: { 'Bài 6': 3 },
    },
  },
  {
    id: 'test-15',
    label: 'Kiểm tra 15 phút',
    badge: '10 TN',
    title: '[15 phút] Đề trắc nghiệm nhanh Chương 1',
    targets: { mcq: 10, tf4: 0, short: 0 },
    topicFilter: null,
    preferWeights: {},
  },
  {
    id: 'practical-focus',
    label: 'Chuyên đề Thực tiễn',
    badge: '2 TN · 3 Đ/S · 5 TLN',
    title: '[Chuyên đề] Ứng dụng đạo hàm giải toán thực tiễn',
    targets: { mcq: 2, tf4: 3, short: 5 },
    topicFilter: (topic) => /^Bài\s+6\b/i.test(topic),
    preferWeights: {},
  },
];

export function shuffleList(list, rng = Math.random) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getQuestionTopic(question) {
  const tags = question?.tags || [];
  const specific = tags.find((t) => /^Bài\s+\d+/i.test(t));
  if (specific) return specific;
  const nonMeta = tags.find((t) => !GEN_LEVELS.includes(t) && !String(t).startsWith('GĐ'));
  return nonMeta || tags[0] || 'Chưa phân loại';
}

export function getQuestionLevel(question) {
  const tags = question?.tags || [];
  return tags.find((t) => GEN_LEVELS.includes(t)) || question?.settings?.level || '';
}

export function sortTopics(topics) {
  return [...topics].sort((a, b) => {
    const aBai = /^Bài\s+(\d+)/i.exec(a);
    const bBai = /^Bài\s+(\d+)/i.exec(b);
    if (aBai && !bBai) return -1;
    if (!aBai && bBai) return 1;
    return a.localeCompare(b, 'vi', { numeric: true });
  });
}

export function extractLessonGroup(topic) {
  const match = /^(Bài\s+\d+)/i.exec(topic);
  return match ? match[1] : 'Khác';
}

/**
 * Build topic × type pools filtered by single level (when levelMode is a specific level).
 * When levelMode is 'all' or 'ratio', all questions are included in the pool.
 */
export function buildMatrixStats(questions, levelMode = 'all') {
  const filterBySingleLevel = GEN_LEVELS.includes(levelMode);
  const topicMap = new Map();

  for (const q of questions || []) {
    if (filterBySingleLevel && getQuestionLevel(q) !== levelMode) continue;
    const topic = getQuestionTopic(q);
    const type = q.type || 'mcq';
    if (!topicMap.has(topic)) {
      topicMap.set(topic, {
        topic,
        group: extractLessonGroup(topic),
        pools: { mcq: [], tf4: [], short: [] },
        total: 0,
      });
    }
    const row = topicMap.get(topic);
    if (!row.pools[type]) row.pools[type] = [];
    row.pools[type].push(q);
    row.total += 1;
  }

  return sortTopics(Array.from(topicMap.keys())).map((topic) => topicMap.get(topic));
}

/**
 * Distribute integer `target` across eligible topics respecting each topic's available cap.
 */
export function distributeCountsAcrossTopics(rows, typeKey, target, options = {}) {
  const { topicFilter = null, preferByPrefix = {} } = options;
  const result = {};
  rows.forEach((r) => {
    result[r.topic] = 0;
  });
  if (!target || target <= 0) return result;

  const eligible = rows.filter(
    (r) => (r.pools[typeKey]?.length || 0) > 0 && (!topicFilter || topicFilter(r.topic)),
  );
  if (!eligible.length) return result;

  let remaining = Math.min(
    target,
    eligible.reduce((sum, r) => sum + (r.pools[typeKey]?.length || 0), 0),
  );

  // 1) Allocate preferred quotas first (e.g., Bài 6 gets more short-answer problems in 2025 exams)
  for (const [prefix, wanted] of Object.entries(preferByPrefix || {})) {
    if (remaining <= 0) break;
    const matched = eligible.filter((r) => r.topic.startsWith(prefix));
    if (!matched.length) continue;
    let quota = Math.min(wanted, remaining);
    let idx = 0;
    while (quota > 0) {
      let progressed = false;
      for (const row of matched) {
        if (quota <= 0) break;
        const cap = row.pools[typeKey].length;
        if (result[row.topic] < cap) {
          result[row.topic] += 1;
          quota -= 1;
          remaining -= 1;
          progressed = true;
        }
      }
      idx += 1;
      if (!progressed || idx > 500) break;
    }
  }

  // 2) Round-robin the remaining quota evenly across all eligible topics (prioritizing topics with 0 first)
  let guard = 0;
  while (remaining > 0 && guard < 1000) {
    guard += 1;
    let progressed = false;
    // Sort by current allocation asc, then available desc so every topic gets represented evenly
    const ordered = [...eligible].sort((a, b) => {
      const diff = result[a.topic] - result[b.topic];
      if (diff !== 0) return diff;
      return b.pools[typeKey].length - a.pools[typeKey].length;
    });
    for (const row of ordered) {
      if (remaining <= 0) break;
      const cap = row.pools[typeKey].length;
      if (result[row.topic] < cap) {
        result[row.topic] += 1;
        remaining -= 1;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  return result;
}

export function buildPresetMatrix(rows, preset) {
  const matrix = {};
  rows.forEach((r) => {
    matrix[r.topic] = { mcq: 0, tf4: 0, short: 0 };
  });
  if (!preset) return matrix;

  for (const typeDef of GEN_TYPES) {
    const t = typeDef.key;
    const target = preset.targets?.[t] || 0;
    const dist = distributeCountsAcrossTopics(rows, t, target, {
      topicFilter: preset.topicFilter || null,
      preferByPrefix: preset.preferWeights?.[t] || {},
    });
    for (const [topic, val] of Object.entries(dist)) {
      if (matrix[topic]) matrix[topic][t] = val;
    }
  }
  return matrix;
}

/**
 * Largest-remainder integer allocation for NB / TH / VD ratios.
 */
export function allocateLevelQuotas(count, ratio) {
  const weights = GEN_LEVELS.map((lv) => Math.max(0, Number(ratio?.[lv]) || 0));
  const totalW = weights.reduce((a, b) => a + b, 0);
  if (count <= 0 || totalW <= 0) {
    return { 'Nhận biết': 0, 'Thông hiểu': 0, 'Vận dụng': 0 };
  }

  const exact = weights.map((w) => (count * w) / totalW);
  const floors = exact.map((v) => Math.floor(v));
  let rem = count - floors.reduce((a, b) => a + b, 0);

  const remainders = exact
    .map((v, idx) => ({ idx, frac: v - floors[idx] }))
    .sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < rem; i += 1) {
    floors[remainders[i % remainders.length].idx] += 1;
  }

  return {
    'Nhận biết': floors[0],
    'Thông hiểu': floors[1],
    'Vận dụng': floors[2],
  };
}

function pickFromPoolWithRatio(pool, count, ratio, rng = Math.random) {
  if (count <= 0 || !pool.length) return [];
  const targetCount = Math.min(count, pool.length);
  const quotas = allocateLevelQuotas(targetCount, ratio);

  const byLevel = {
    'Nhận biết': [],
    'Thông hiểu': [],
    'Vận dụng': [],
    other: [],
  };
  for (const q of pool) {
    const lv = getQuestionLevel(q);
    if (byLevel[lv]) byLevel[lv].push(q);
    else byLevel.other.push(q);
  }

  const picked = [];
  const pickedIds = new Set();

  for (const lv of GEN_LEVELS) {
    const want = quotas[lv] || 0;
    if (want <= 0) continue;
    const chosen = shuffleList(byLevel[lv], rng).slice(0, want);
    for (const q of chosen) {
      picked.push(q);
      pickedIds.add(q.id);
    }
  }

  // Fill any deficit from remaining unused questions in pool
  if (picked.length < targetCount) {
    const leftover = shuffleList(
      pool.filter((q) => !pickedIds.has(q.id)),
      rng,
    );
    for (const q of leftover) {
      if (picked.length >= targetCount) break;
      picked.push(q);
      pickedIds.add(q.id);
    }
  }

  return picked;
}

/**
 * Pick questions according to matrixCounts: { [topic]: { mcq, tf4, short } }.
 * Respects pinnedItems (keeping pinned questions intact and filling the rest).
 */
export function pickFromMatrix(questions, matrixCounts, options = {}) {
  const {
    levelMode = 'all',
    levelRatio = { 'Nhận biết': 40, 'Thông hiểu': 40, 'Vận dụng': 20 },
    pinnedItems = [],
    rng = Math.random,
  } = options;

  const rows = buildMatrixStats(questions, levelMode);
  const rowMap = new Map(rows.map((r) => [r.topic, r]));

  const usedIds = new Set();
  const pinnedByCell = new Map();

  for (const item of pinnedItems) {
    if (!item?.pinned || !item?.q) continue;
    const topic = item.topic || getQuestionTopic(item.q);
    const type = item.q.type || 'mcq';
    const cellKey = `${topic}::${type}`;
    const targetForCell = Number(matrixCounts?.[topic]?.[type]) || 0;
    if (targetForCell <= 0) continue;

    const currentPinned = pinnedByCell.get(cellKey) || [];
    if (currentPinned.length < targetForCell && !usedIds.has(item.q.id)) {
      currentPinned.push({ q: item.q, topic, pinned: true });
      pinnedByCell.set(cellKey, currentPinned);
      usedIds.add(item.q.id);
    }
  }

  const picked = [];

  for (const [topic, counts] of Object.entries(matrixCounts || {})) {
    const row = rowMap.get(topic);
    if (!row) continue;

    for (const typeDef of GEN_TYPES) {
      const type = typeDef.key;
      const wanted = Math.max(0, Number(counts?.[type]) || 0);
      if (wanted <= 0) continue;

      const cellKey = `${topic}::${type}`;
      const keptPinned = pinnedByCell.get(cellKey) || [];
      keptPinned.forEach((item) => picked.push(item));

      const needed = Math.max(0, wanted - keptPinned.length);
      if (needed <= 0) continue;

      const availablePool = (row.pools[type] || []).filter((q) => !usedIds.has(q.id));
      const chosen = levelMode === 'ratio'
        ? pickFromPoolWithRatio(availablePool, needed, levelRatio, rng)
        : shuffleList(availablePool, rng).slice(0, needed);

      for (const q of chosen) {
        usedIds.add(q.id);
        picked.push({ q, topic, pinned: false });
      }
    }
  }

  const orderOf = (type) => GEN_TYPES.find((t) => t.key === type)?.order || 1;
  picked.sort((a, b) => orderOf(a.q.type || 'mcq') - orderOf(b.q.type || 'mcq'));

  return picked;
}

const POSITIONAL_CHOICE_RE = /\b(cả\s+[abcd]|tất\s+cả|đáp\s+án\s+[abcd]|phương\s+án\s+[abcd])\b/i;

/**
 * Safely shuffle 4 MCQ choices and update correct_answer letter.
 * Skips shuffling if choices reference positions like "Cả A và B" or "Tất cả đáp án".
 */
export function shuffleMcqChoices(question, keyObj, rng = Math.random) {
  if ((question?.type || 'mcq') !== 'mcq') {
    return { choices: question?.choices || [], answerKey: keyObj };
  }
  const choices = Array.isArray(question?.choices) ? question.choices : [];
  if (choices.length !== 4 || choices.some((c) => POSITIONAL_CHOICE_RE.test(String(c)))) {
    return { choices, answerKey: keyObj };
  }
  const origLetter = String(keyObj?.correct_answer ?? '').trim().toUpperCase();
  const origIdx = ['A', 'B', 'C', 'D'].indexOf(origLetter);
  if (origIdx < 0) {
    return { choices, answerKey: keyObj };
  }

  const indexed = choices.map((text, idx) => ({ text, isCorrect: idx === origIdx }));
  const shuffled = shuffleList(indexed, rng);
  const newCorrectIdx = shuffled.findIndex((item) => item.isCorrect);
  const newLetter = ['A', 'B', 'C', 'D'][newCorrectIdx] || origLetter;

  return {
    choices: shuffled.map((item) => item.text),
    answerKey: {
      ...(keyObj || {}),
      correct_answer: newLetter,
    },
  };
}

export function summarizePickedItems(items) {
  const byType = { mcq: 0, tf4: 0, short: 0 };
  const byLevel = { 'Nhận biết': 0, 'Thông hiểu': 0, 'Vận dụng': 0 };
  for (const item of items || []) {
    const q = item.q || item;
    const t = q.type || 'mcq';
    byType[t] = (byType[t] || 0) + 1;
    const lv = getQuestionLevel(q);
    if (byLevel[lv] !== undefined) byLevel[lv] += 1;
  }
  return {
    total: (items || []).length,
    byType,
    byLevel,
  };
}

export function buildExamDescription(items) {
  const { byType, byLevel } = summarizePickedItems(items);
  const parts = [];
  if (byType.mcq) parts.push(`Phần I: ${byType.mcq} câu Trắc nghiệm`);
  if (byType.tf4) parts.push(`Phần II: ${byType.tf4} câu Đúng/Sai`);
  if (byType.short) parts.push(`Phần III: ${byType.short} câu Trả lời ngắn`);
  const levels = [];
  if (byLevel['Nhận biết']) levels.push(`NB: ${byLevel['Nhận biết']}`);
  if (byLevel['Thông hiểu']) levels.push(`TH: ${byLevel['Thông hiểu']}`);
  if (byLevel['Vận dụng']) levels.push(`VD: ${byLevel['Vận dụng']}`);
  return [parts.join(' · '), levels.length ? `Mức độ (${levels.join(' · ')})` : ''].filter(Boolean).join(' — ');
}

/**
 * Export generated questions to EX_TEST LaTeX format so teachers can print/compile directly.
 */
export function exportQuestionsToLatex(title, items) {
  const lines = [`% ${title || 'Đề thi tự động'}`];
  const groups = [
    { key: 'mcq', header: '% ===== PHẦN I. TRẮC NGHIỆM NHIỀU LỰA CHỌN =====' },
    { key: 'tf4', header: '% ===== PHẦN II. TRẮC NGHIỆM ĐÚNG SAI =====' },
    { key: 'short', header: '% ===== PHẦN III. TRẢ LỜI NGẮN =====' },
  ];

  for (const grp of groups) {
    const groupItems = (items || []).filter((item) => ((item.q || item).type || 'mcq') === grp.key);
    if (!groupItems.length) continue;
    lines.push('', grp.header);

    for (const item of groupItems) {
      const q = item.q || item;
      const keyObj = Array.isArray(q.answer_keys) ? q.answer_keys[0] : (q.answer_keys || q.answer_key);
      lines.push('\\begin{ex}');
      lines.push((q.prompt || '').trim());

      if (grp.key === 'mcq') {
        const correct = String(keyObj?.correct_answer ?? '').trim().toUpperCase();
        const choices = Array.isArray(q.choices) ? q.choices : [];
        lines.push('\\choice');
        choices.forEach((c, idx) => {
          const letter = ['A', 'B', 'C', 'D'][idx];
          const prefix = letter === correct ? '\\True ' : '';
          lines.push(`{${prefix}${c}}`);
        });
      } else if (grp.key === 'tf4') {
        const stmts = Array.isArray(q.settings?.statements) ? q.settings.statements : [];
        const ansArr = Array.isArray(keyObj?.correct_answer) ? keyObj.correct_answer : [];
        lines.push('\\choiceTF');
        stmts.forEach((s, idx) => {
          const prefix = ansArr[idx] ? '\\True ' : '';
          lines.push(`{${prefix}${s}}`);
        });
      } else if (grp.key === 'short') {
        const ans = keyObj?.correct_answer ?? keyObj?.accepted_answers?.[0] ?? '';
        lines.push(`\\shortans{${ans}}`);
      }

      if (q.settings?.explanation) {
        lines.push('\\loigiai{');
        lines.push(q.settings.explanation.trim());
        lines.push('}');
      }
      lines.push('\\end{ex}', '');
    }
  }

  return lines.join('\n').trim() + '\n';
}
