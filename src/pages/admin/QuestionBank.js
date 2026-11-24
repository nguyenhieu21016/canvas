import { state } from '../../store.js';
import { go, registerCleanup } from '../../router.js';
import { toast } from '../../lib/ui.js';
import { escapeHtml, renderLatexText } from '../../lib/html.js';
import { saveEditorDraft, loadEditorDraft, clearEditorDraft } from '../../lib/draft.js';
import {
  parseLatexAssignment,
  normalizeAssignmentEditor,
  buildAssignmentSeedFromBank,
  extractCategoryFromTitle,
} from '../../lib/assignment.js';
import {
  GEN_TYPES,
  GEN_LEVELS,
  EXAM_PRESETS,
  buildMatrixStats,
  buildPresetMatrix,
  pickFromMatrix,
  summarizePickedItems,
  exportQuestionsToLatex,
} from '../../lib/examGenerator.js';
import {
  fetchLearningPath,
  fetchAssignmentEditor,
  saveAssignmentWithQuestions,
  uploadAssignmentImage,
  fetchQuestionBank,
  deleteBankQuestion,
  batchInsertBankQuestions,
} from '../../services/lmsApi.js';

const LEVEL_TAGS = ['Nhận biết', 'Thông hiểu', 'Vận dụng'];
const CHAPTER_PREFIX = 'GĐ';

const PREPACKAGED_PACKS = [
  {
    packId: 'chude11-dondieu-cuctri',
    url: '/data/chude11-dondieu-cuctri.json',
    title: 'Chủ đề 11 · Tính đơn điệu & Cực trị (2025)',
    subtitle: '145 câu hỏi chuẩn LaTeX + 132 hình đồ thị/BBT sạch watermark, đã phân loại theo GĐ1 - Chương 1',
  },
  {
    packId: 'chude12-tiemcan',
    url: '/data/chude12-tiemcan.json',
    title: 'Chủ đề 12 · Đường tiệm cận (2025)',
    subtitle: '92 câu hỏi chuẩn LaTeX + hình đồ thị/BBT sạch watermark, đã phân loại theo GĐ1 - Chương 1 (Bài 4)',
  },
  {
    packId: 'chude13-gtln-gtnn',
    url: '/data/chude13-gtln-gtnn.json',
    title: 'Chủ đề 13 · GTLN - GTNN của hàm số (2025)',
    subtitle: '37 câu hỏi chuẩn LaTeX + hình đồ thị/BBT sạch watermark, đã phân loại theo GĐ1 - Chương 1 (Bài 3)',
  },
  {
    packId: 'chude14-khaosat',
    url: '/data/chude14-khaosat.json',
    title: 'Chủ đề 14 · Khảo sát hàm số (2025)',
    subtitle: '64 câu hỏi chuẩn LaTeX + 60 hình đồ thị/BBT sạch watermark, đã phân loại theo GĐ1 - Chương 1 (Bài 5 & Bài 6)',
  },
  {
    packId: 'tf4-hambacba',
    url: '/data/tf4-hambacba.json',
    title: 'Chủ đề 3 · Khảo sát hàm bậc ba — Đúng/Sai (2025)',
    subtitle: '29 câu Trắc nghiệm Đúng/Sai (4 mệnh đề) chuẩn LaTeX + 21 hình đồ thị/BBT sạch watermark',
  },
  {
    packId: 'tf4-hamphanthuc',
    url: '/data/tf4-hamphanthuc.json',
    title: 'Chủ đề 4 · Khảo sát hàm phân thức — Đúng/Sai (2025)',
    subtitle: '50 câu Trắc nghiệm Đúng/Sai (4 mệnh đề) chuẩn LaTeX + 20 hình đồ thị/BBT sạch watermark',
  },
  {
    packId: 'tf4-hamluonggiac',
    url: '/data/tf4-hamluonggiac.json',
    title: 'Chủ đề 5 · Khảo sát hàm lượng giác — Đúng/Sai (2025)',
    subtitle: '21 câu Trắc nghiệm Đúng/Sai (4 mệnh đề) chuẩn LaTeX, đã phân loại theo GĐ1 - Chương 1',
  },
  {
    packId: 'tf4-hamlogarit',
    url: '/data/tf4-hamlogarit.json',
    title: 'Chủ đề 6 · Khảo sát hàm Logarit - Mũ — Đúng/Sai (2025)',
    subtitle: '24 câu Trắc nghiệm Đúng/Sai (4 mệnh đề) chuẩn LaTeX, đã phân loại theo GĐ1 - Chương 1',
  },
  {
    packId: 'tf4-thucte',
    url: '/data/tf4-thucte.json',
    title: 'Chủ đề 7 · Ứng dụng đạo hàm thực tiễn — Đúng/Sai (2025)',
    subtitle: '49 câu Trắc nghiệm Đúng/Sai (4 mệnh đề) chuẩn LaTeX + 13 hình minh họa sạch watermark, đã phân loại Bài 6',
  },
  {
    packId: 'short-dothi',
    url: '/data/short-dothi.json',
    title: 'Chủ đề 9 · Đồ thị hàm số — Trả lời ngắn (2025)',
    subtitle: '39 câu Trả lời ngắn chuẩn LaTeX + 16 hình đồ thị/BBT sạch watermark, đã phân loại theo GĐ1 - Chương 1',
  },
  {
    packId: 'short-chuyendong',
    url: '/data/short-chuyendong.json',
    title: 'Chủ đề 10 · Chuyển động & Nồng độ - Quần thể — Trả lời ngắn (2025)',
    subtitle: '39 câu Trả lời ngắn chuẩn LaTeX + 8 hình minh họa sạch watermark, đã phân loại Bài 6',
  },
  {
    packId: 'short-hinhhoc',
    url: '/data/short-hinhhoc.json',
    title: 'Chủ đề 11 · Tối ưu Hình học — Trả lời ngắn (2025)',
    subtitle: '53 câu Trả lời ngắn chuẩn LaTeX + 50 hình minh họa sạch watermark, đã phân loại Bài 6',
  },
  {
    packId: 'short-kinhte',
    url: '/data/short-kinhte.json',
    title: 'Chủ đề 12 · Ứng dụng đạo hàm giải toán Kinh tế — Trả lời ngắn (2025)',
    subtitle: '65 câu Trả lời ngắn chuẩn LaTeX về doanh thu, chi phí & tối ưu lợi nhuận, đã phân loại Bài 6',
  },
];

const TYPE_META = {
  mcq: { label: 'Trắc nghiệm', order: 1 },
  tf4: { label: 'Đúng / Sai', order: 2 },
  short: { label: 'Trả lời ngắn', order: 3 },
};

function getTypeLabel(type) {
  return TYPE_META[type]?.label || 'Trắc nghiệm';
}

function formatAnswerSummary(question, keyObj) {
  if (!keyObj) return '';
  if (question.type === 'tf4') {
    const arr = Array.isArray(keyObj.correct_answer) ? keyObj.correct_answer : [];
    if (!arr.length) return '';
    return arr.map((v) => (v ? 'Đ' : 'S')).join(' - ');
  }
  if (question.type === 'short') {
    return (keyObj.accepted_answers || []).join(' / ');
  }
  return String(keyObj.correct_answer ?? '').toUpperCase();
}

function renderQuestionChoicesHtml(question, keyObj) {
  if (question.type === 'tf4') {
    const stmts = Array.isArray(question.settings?.statements) ? question.settings.statements : [];
    if (!stmts.length) return '';
    const ansArr = Array.isArray(keyObj?.correct_answer) ? keyObj.correct_answer : [];
    return `
      <div class="qb-tf-list">
        ${stmts.map((stmt, sIdx) => {
          const letter = String.fromCharCode(97 + sIdx);
          const isTrue = Boolean(ansArr[sIdx]);
          return `
            <div class="qb-tf-row ${isTrue ? 'is-true' : 'is-false'}">
              <span class="qb-choice-letter">${letter})</span>
              <span class="qb-tf-text">${renderLatexText(stmt)}</span>
              <span class="qb-tf-pill ${isTrue ? 'is-true' : 'is-false'}">${isTrue ? 'Đúng' : 'Sai'}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
  if (question.type === 'short') {
    const ans = (keyObj?.accepted_answers || []).join(' / ');
    return ans ? `<div class="qb-short-ans">Đáp số: <strong>${renderLatexText(ans)}</strong></div>` : '';
  }
  if (Array.isArray(question.choices) && question.choices.length) {
    const correctAns = String(keyObj?.correct_answer ?? '').toUpperCase();
    return `
      <div class="qb-choices">
        ${question.choices.map((choice, cIdx) => {
          const letter = String.fromCharCode(65 + cIdx);
          const isOk = correctAns === letter;
          return `
            <div class="qb-choice ${isOk ? 'is-correct' : ''}">
              <span class="qb-choice-letter">${letter}</span>
              <span>${renderLatexText(choice)}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
  return '';
}

const QB_ICONS = {
  spark: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`,
  code: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
  trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>`,
  refresh: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  download: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
  pin: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>`,
  copy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`,
  arrowUp: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>`,
  arrowDown: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`,
  close: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
};

function shuffleArray(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getTopicTag(question) {
  const tags = question.tags || [];
  // Prefer specific "Bài ... · Dạng ..." tag
  const specific = tags.find((t) => /^Bài\s+\d+/i.test(t));
  if (specific) return specific;
  const nonMeta = tags.find((t) => !LEVEL_TAGS.includes(t) && !t.startsWith(CHAPTER_PREFIX));
  return nonMeta || tags[0] || 'Chưa phân loại';
}

function getLevelTag(question) {
  const tags = question.tags || [];
  return tags.find((t) => LEVEL_TAGS.includes(t)) || question.settings?.level || '';
}

function sortTopicTags(tags) {
  return [...tags].sort((a, b) => {
    const aBai = /^Bài\s+(\d+)/i.exec(a);
    const bBai = /^Bài\s+(\d+)/i.exec(b);
    if (aBai && !bBai) return -1;
    if (!aBai && bBai) return 1;
    return a.localeCompare(b, 'vi', { numeric: true });
  });
}

export function renderBankLatexPreviewCard(question, index, allQuestions = []) {
  const prevQ = index > 0 ? allQuestions[index - 1] : null;
  const isNewSection = !prevQ || prevQ.type !== question.type;

  let sectionHeaderHTML = '';
  if (isNewSection) {
    let sectionNum = 1;
    for (let i = 1; i <= index; i++) {
      if (allQuestions[i]?.type !== allQuestions[i - 1]?.type) sectionNum++;
    }
    const romanNumeral = ['I', 'II', 'III', 'IV', 'V'][sectionNum - 1] || sectionNum;
    let typeLabel = 'Trắc nghiệm nhiều lựa chọn';
    if (question.type === 'tf4') typeLabel = 'Trắc nghiệm đúng sai';
    if (question.type === 'short') typeLabel = 'Trắc nghiệm trả lời ngắn';

    sectionHeaderHTML = `
      <div style="display: flex; align-items: center; gap: 10px; padding: 4px 16px 4px 4px; background: #EBEDE6; border: 1px solid #E4E6DE; border-radius: 9999px; color: #181B16; font-weight: 700; font-size: 13.5px; margin-bottom: 8px; ${index > 0 ? 'margin-top: 14px;' : ''}">
        <span style="width: 24px; height: 24px; border-radius: 50%; background: #181B16; color: #F7F7F2; display: flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 700;">${romanNumeral}</span>
        <span>${typeLabel}</span>
      </div>
    `;
  }

  let correctAnswer = question.answer_key?.correct_answer ?? '';
  if (question.type === 'short') {
    correctAnswer = (question.answer_key?.accepted_answers || []).join(', ');
  }
  const cleanPrompt = question.prompt ? question.prompt.replace(/^Câu\s*\d+[.:\s]*/i, '') : '';
  const qNumStr = String(index + 1).padStart(2, '0');

  return `
    ${sectionHeaderHTML}
    <article class="latex-review-q-block" data-question-index="${index}" style="display: flex; flex-direction: column; gap: 12px; padding: 18px 20px; border-radius: 16px; border: 1px solid #E4E6DE; background: #ffffff; cursor: pointer;">
      <div style="font-size: 14.5px; color: #181B16; line-height: 1.6;">
        <span style="font-weight: 800; color: #181B16; font-size: 15px; margin-right: 8px;">CÂU ${qNumStr}</span>
        <span>${renderLatexText(cleanPrompt)}</span>
      </div>
      ${renderQuestionChoicesHtml(question, question.answer_key)}
      ${question.settings?.explanation ? `
        <div style="padding: 10px 14px; background: #F7F7F2; border-radius: 10px; font-size: 13.5px; line-height: 1.65; color: #2A2E27;">
          ${renderLatexText(question.settings.explanation)}
        </div>
      ` : ''}
    </article>
  `;
}

const QB_STYLES = `
  <style>
    .qb-hub {
      max-width: 920px;
      margin: 0 auto;
      padding: 28px 20px 72px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif;
      color: #181B16;
    }
    .qb-hero-meta {
      margin: 6px 0 0;
      font-size: 13.5px;
      color: rgba(247, 247, 242, 0.7);
      font-variant-numeric: tabular-nums;
    }
    .qb-hero-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .qb-btn-hero {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: 40px;
      padding: 0 18px;
      border: 0;
      border-radius: 9999px;
      background: #F7F7F2;
      color: #181B16;
      font-family: inherit;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    .qb-btn-hero:hover { background: #EBEDE6; }
    .qb-btn-hero--ghost {
      background: rgba(247, 247, 242, 0.12);
      color: #F7F7F2;
    }
    .qb-btn-hero--ghost:hover { background: rgba(247, 247, 242, 0.2); }

    /* Prepackaged pack import banner */
    .qb-pack-banner {
      background: #EBEDE6;
      border-radius: 20px;
      padding: 18px 22px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .qb-pack-title {
      font-size: 15px;
      font-weight: 700;
      color: #181B16;
    }
    .qb-pack-sub {
      margin-top: 3px;
      font-size: 13px;
      color: #64695F;
    }

    /* Generator Panel */
    .qb-gen-panel {
      display: none;
      background: #FFFFFF;
      border: 1px solid #E4E6DE;
      border-radius: 20px;
      padding: 20px 22px;
      flex-direction: column;
      gap: 16px;
    }
    .qb-gen-panel.open { display: flex; }
    .qb-gen-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding-bottom: 14px;
      border-bottom: 1px solid #EFEFE9;
    }
    .qb-gen-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
    }
    .qb-gen-sub {
      margin: 3px 0 0;
      font-size: 12.5px;
      color: #64695F;
    }
    .qb-gen-config {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      align-items: end;
    }
    .qb-pick-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 12px 16px;
      border-radius: 16px;
      background: #E9F2EC;
      border: 1px solid rgba(47, 111, 78, 0.28);
      color: #1F4E36;
      font-size: 13.5px;
      font-weight: 600;
    }
    .qb-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .qb-field label {
      font-size: 12px;
      font-weight: 600;
      color: #64695F;
    }
    .qb-input {
      width: 100%;
      height: 40px;
      padding: 0 14px;
      border-radius: 12px;
      border: 1px solid #E4E6DE;
      background: #F7F7F2;
      color: #181B16;
      font-family: inherit;
      font-size: 13.5px;
      box-sizing: border-box;
      outline: none;
    }
    .qb-input:focus {
      border-color: #181B16;
      background: #FFFFFF;
    }
    .qb-gen-section-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .qb-gen-row-label {
      font-size: 12px;
      font-weight: 600;
      color: #64695F;
      margin-bottom: 6px;
    }
    .qb-preset-bar {
      display: flex;
      align-items: center;
      gap: 7px;
      flex-wrap: wrap;
      flex: 1;
    }
    .qb-preset-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 34px;
      padding: 0 12px;
      border: 1px solid #E4E6DE;
      border-radius: 9999px;
      background: #F7F7F2;
      color: #181B16;
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .qb-preset-btn:hover {
      background: #EBEDE6;
      border-color: #D3D7CB;
    }
    .qb-preset-btn.active {
      background: #181B16;
      border-color: #181B16;
      color: #F7F7F2;
    }
    .qb-preset-badge {
      font-size: 11px;
      font-weight: 500;
      opacity: 0.72;
      font-variant-numeric: tabular-nums;
    }
    .qb-ratio-bar {
      display: none;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      padding: 10px 14px;
      border-radius: 12px;
      background: #F7F7F2;
      border: 1px solid #E4E6DE;
      font-size: 12.5px;
      color: #64695F;
    }
    .qb-ratio-bar.show { display: flex; }
    .qb-ratio-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      color: #181B16;
    }
    .qb-ratio-inp {
      width: 56px;
      height: 30px;
      border-radius: 8px;
      border: 1px solid #D3D7CB;
      background: #FFFFFF;
      text-align: center;
      font-family: inherit;
      font-size: 13px;
      font-weight: 700;
      color: #181B16;
      font-variant-numeric: tabular-nums;
    }
    .qb-ratio-note {
      margin-left: auto;
      font-size: 12px;
      color: #64695F;
      font-variant-numeric: tabular-nums;
    }
    /* Matrix Table */
    .qb-matrix-wrap {
      border: 1px solid #E4E6DE;
      border-radius: 14px;
      overflow-x: auto;
      background: #FFFFFF;
    }
    .qb-matrix {
      width: 100%;
      border-collapse: collapse;
      min-width: 620px;
      font-size: 13px;
    }
    .qb-matrix th {
      padding: 10px 12px;
      text-align: left;
      font-size: 12px;
      font-weight: 700;
      color: #64695F;
      background: #F7F7F2;
      border-bottom: 1px solid #E4E6DE;
      white-space: nowrap;
    }
    .qb-matrix th.is-num,
    .qb-matrix td.is-num {
      text-align: center;
      width: 136px;
    }
    .qb-matrix th.is-total,
    .qb-matrix td.is-total {
      text-align: center;
      width: 64px;
      font-variant-numeric: tabular-nums;
    }
    .qb-matrix td {
      padding: 9px 12px;
      border-bottom: 1px solid #EFEFE9;
      vertical-align: middle;
    }
    .qb-matrix tbody tr:last-child td { border-bottom: 0; }
    .qb-matrix tbody tr.has-val { background: #FAFBF7; }
    .qb-matrix-topic {
      font-weight: 600;
      color: #181B16;
      line-height: 1.35;
    }
    .qb-matrix-avail-sub {
      font-size: 11px;
      color: #8A8F84;
      margin-top: 2px;
      font-variant-numeric: tabular-nums;
    }
    .qb-matrix-th-sub {
      display: block;
      font-size: 11px;
      font-weight: 500;
      color: #8A8F84;
      margin-top: 1px;
      font-variant-numeric: tabular-nums;
    }
    .qb-stepper {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 2px;
      border-radius: 10px;
      border: 1px solid #D3D7CB;
      background: #FFFFFF;
    }
    .qb-stepper.is-active {
      border-color: #181B16;
    }
    .qb-step-btn {
      width: 24px;
      height: 26px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: #181B16;
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: inline-grid;
      place-items: center;
      transition: background-color 0.12s ease;
    }
    .qb-step-btn:hover:not(:disabled) { background: #EBEDE6; }
    .qb-step-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .qb-step-inp {
      width: 34px;
      height: 26px;
      border: 0;
      background: transparent;
      text-align: center;
      font-family: inherit;
      font-size: 13px;
      font-weight: 700;
      color: #181B16;
      outline: none;
      font-variant-numeric: tabular-nums;
      -moz-appearance: textfield;
    }
    .qb-step-inp::-webkit-outer-spin-button,
    .qb-step-inp::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .qb-step-cap {
      display: block;
      margin-top: 3px;
      font-size: 10.5px;
      color: #8A8F84;
      font-variant-numeric: tabular-nums;
    }
    .qb-step-na {
      color: #C2C6BC;
      font-size: 13px;
      user-select: none;
    }
    .qb-row-total {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 24px;
      padding: 0 7px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      background: #EBEDE6;
      color: #64695F;
    }
    .qb-row-total.is-active {
      background: #181B16;
      color: #F7F7F2;
    }
    .qb-gen-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding-top: 4px;
    }
    .qb-gen-summary {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 13.5px;
      color: #64695F;
      font-variant-numeric: tabular-nums;
    }
    .qb-gen-summary strong { color: #181B16; }
    .qb-gen-check {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 12.5px;
      font-weight: 600;
      color: #181B16;
      cursor: pointer;
      user-select: none;
      padding: 0 4px;
    }
    .qb-gen-check input {
      accent-color: #181B16;
      width: 15px;
      height: 15px;
      cursor: pointer;
    }
    .qb-gen-preview {
      display: none;
      flex-direction: column;
      gap: 12px;
      padding-top: 14px;
      border-top: 1px solid #EFEFE9;
    }
    .qb-gen-preview.open { display: flex; }
    .qb-gen-preview-bar {
      background: #E9F2EC;
      color: #1F4E36;
      border-radius: 14px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      font-size: 13.5px;
      font-weight: 600;
    }
    .qb-gen-preview-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .qb-gen-preview-sub {
      font-size: 12px;
      font-weight: 500;
      opacity: 0.85;
      font-variant-numeric: tabular-nums;
    }
    .qb-part-header {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 5px 14px 5px 5px;
      background: #EBEDE6;
      border: 1px solid #E4E6DE;
      border-radius: 9999px;
      color: #181B16;
      font-size: 13px;
      font-weight: 700;
      width: fit-content;
      margin-top: 6px;
    }
    .qb-part-num {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #181B16;
      color: #F7F7F2;
      display: grid;
      place-items: center;
      font-size: 11px;
      font-weight: 700;
    }
    .qb-card.is-pinned {
      border-color: #2F6F4E;
      background: #FCFDFB;
    }
    .qb-preview-actions {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
    .qb-mini-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 28px;
      padding: 0 9px;
      border: 1px solid #E4E6DE;
      border-radius: 9999px;
      background: #FFFFFF;
      color: #64695F;
      font-family: inherit;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;
    }
    .qb-mini-btn:hover:not(:disabled) {
      background: #EBEDE6;
      border-color: #D3D7CB;
      color: #181B16;
    }
    .qb-mini-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .qb-mini-btn.is-pinned {
      background: #E9F2EC;
      border-color: rgba(47, 111, 78, 0.35);
      color: #1F4E36;
    }
    .qb-mini-btn--icon {
      width: 28px;
      padding: 0;
      justify-content: center;
    }
    .qb-mini-btn--danger:hover:not(:disabled) {
      background: #F8EAE8;
      border-color: rgba(184, 67, 58, 0.28);
      color: #B8433A;
    }

    /* Buttons */
    .qb-btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: 38px;
      padding: 0 18px;
      border: 0;
      border-radius: 9999px;
      background: #181B16;
      color: #F7F7F2;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    .qb-btn-primary:hover { background: #2C3028; }
    .qb-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
    .qb-btn-secondary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 36px;
      padding: 0 14px;
      border: 0;
      border-radius: 9999px;
      background: #EBEDE6;
      color: #181B16;
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    .qb-btn-secondary:hover { background: #E2E5DC; }

    /* Toolbar */
    .qb-toolbar {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .qb-toolbar-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .qb-level-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .qb-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 34px;
      padding: 0 13px;
      border: 0;
      border-radius: 9999px;
      background: #EBEDE6;
      color: #181B16;
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .qb-pill:hover { background: #E2E5DC; }
    .qb-pill.active {
      background: #181B16;
      color: #F7F7F2;
    }
    .qb-pill-cnt {
      font-size: 11.5px;
      font-weight: 500;
      opacity: 0.72;
      font-variant-numeric: tabular-nums;
    }
    .qb-topic-bar {
      display: flex;
      align-items: center;
      gap: 7px;
      flex-wrap: wrap;
    }
    .qb-topic-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 13px;
      border: 1px solid #E4E6DE;
      border-radius: 9999px;
      background: #FFFFFF;
      color: #64695F;
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    }
    .qb-topic-chip:hover {
      background: #EBEDE6;
      border-color: #EBEDE6;
      color: #181B16;
    }
    .qb-topic-chip.active {
      background: #EBEDE6;
      border-color: #D3D7CB;
      color: #181B16;
      font-weight: 600;
    }
    .qb-search {
      width: 260px;
      height: 38px;
      padding: 0 15px;
      border-radius: 9999px;
      border: 1px solid transparent;
      background: #EBEDE6;
      color: #181B16;
      font-family: inherit;
      font-size: 13.5px;
      outline: none;
    }
    .qb-search:focus {
      background: #FFFFFF;
      border-color: #181B16;
    }
    .qb-selection-bar {
      display: none;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: #181B16;
      color: #F7F7F2;
      border-radius: 16px;
      padding: 12px 18px;
      font-size: 13.5px;
      font-weight: 600;
    }
    .qb-selection-bar.show { display: flex; }

    /* Question Cards */
    .qb-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .qb-card {
      background: #FFFFFF;
      border: 1px solid #E4E6DE;
      border-radius: 20px;
      padding: 20px 22px;
      display: flex;
      flex-direction: column;
      gap: 13px;
      transition: border-color 0.15s ease;
    }
    .qb-card.is-selected { border-color: #181B16; }
    .qb-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .qb-card-tags {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .qb-cb {
      accent-color: #181B16;
      width: 17px;
      height: 17px;
      cursor: pointer;
    }
    .qb-badge {
      display: inline-flex;
      align-items: center;
      height: 25px;
      padding: 0 10px;
      border-radius: 9999px;
      font-size: 11.5px;
      font-weight: 600;
      background: #EBEDE6;
      color: #181B16;
    }
    .qb-badge--dark { background: #181B16; color: #F7F7F2; }
    .qb-badge--ok { background: #E9F2EC; color: #1F4E36; }
    .qb-icon-btn {
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: 9999px;
      background: transparent;
      color: #64695F;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .qb-icon-btn:hover { background: #EBEDE6; color: #181B16; }
    .qb-icon-btn--danger:hover { background: #F8EAE8; color: #B8433A; }
    .qb-prompt {
      font-size: 14.5px;
      line-height: 1.65;
      color: #181B16;
    }
    .qb-prompt img,
    .qb-sol-body img {
      display: block;
      max-width: 100%;
      max-height: 230px;
      object-fit: contain;
      border-radius: 10px;
      border: 1px solid #EFEFE9;
      background: #FFFFFF;
      padding: 6px;
      margin: 10px 0 4px;
    }
    .qb-choices {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .qb-choice {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 9px 13px;
      border-radius: 12px;
      border: 1px solid #E4E6DE;
      background: #F7F7F2;
      font-size: 13.5px;
      color: #181B16;
    }
    .qb-choice.is-correct {
      background: #E9F2EC;
      border-color: rgba(47, 111, 78, 0.35);
      color: #1F4E36;
      font-weight: 600;
    }
    .qb-choice-letter {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #FFFFFF;
      border: 1px solid #E4E6DE;
      display: grid;
      place-items: center;
      font-size: 11.5px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .qb-choice.is-correct .qb-choice-letter {
      background: #2F6F4E;
      border-color: #2F6F4E;
      color: #FFFFFF;
    }
    .qb-tf-list {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .qb-tf-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 9px 13px;
      border-radius: 12px;
      border: 1px solid #E4E6DE;
      background: #F7F7F2;
      font-size: 13.5px;
      line-height: 1.55;
      color: #181B16;
    }
    .qb-tf-row.is-true {
      background: #F4F9F5;
      border-color: rgba(47, 111, 78, 0.25);
    }
    .qb-tf-text {
      flex: 1;
      min-width: 0;
    }
    .qb-tf-text img {
      display: block;
      max-width: 100%;
      max-height: 220px;
      object-fit: contain;
      border-radius: 10px;
      border: 1px solid #EFEFE9;
      background: #FFFFFF;
      padding: 6px;
      margin: 8px 0 4px;
    }
    .qb-tf-pill {
      flex-shrink: 0;
      padding: 2px 10px;
      border-radius: 9999px;
      font-size: 11.5px;
      font-weight: 700;
      margin-top: 1px;
    }
    .qb-tf-pill.is-true {
      background: #E9F2EC;
      color: #1F4E36;
    }
    .qb-tf-pill.is-false {
      background: #F8EAE8;
      color: #B8433A;
    }
    .qb-short-ans {
      padding: 9px 14px;
      border-radius: 12px;
      background: #E9F2EC;
      border: 1px solid rgba(47, 111, 78, 0.3);
      color: #1F4E36;
      font-size: 13.5px;
    }
    .qb-badge--type {
      background: #E8ECF2;
      color: #243B55;
    }
    .qb-sol {
      border-top: 1px solid #EFEFE9;
      padding-top: 10px;
    }
    .qb-sol summary {
      cursor: pointer;
      font-size: 12.5px;
      font-weight: 600;
      color: #64695F;
      user-select: none;
    }
    .qb-sol-body {
      margin-top: 10px;
      padding: 13px 15px;
      border-radius: 14px;
      background: #F7F7F2;
      font-size: 13.5px;
      line-height: 1.7;
      color: #2A2E27;
    }
    .qb-pager {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 4px;
      font-size: 13px;
      color: #64695F;
    }
    .qb-pager-btns {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .qb-empty {
      background: #FFFFFF;
      border: 1px solid #E4E6DE;
      border-radius: 20px;
      padding: 44px 24px;
      text-align: center;
      color: #64695F;
      font-size: 14px;
    }
    .qb-cm-wrapper {
      flex: 1;
      min-height: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    #qb-latex-modal .CodeMirror {
      height: 100% !important;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 13px;
      line-height: 1.6;
      border-radius: 12px;
      border: 1px solid #E4E6DE;
      background: #F7F7F2;
    }
    @media (max-width: 760px) {
      .qb-hub { padding: 20px 16px 56px; }
      .qb-gen-config, .qb-gen-grid, .qb-choices { grid-template-columns: 1fr; }
      .qb-search { width: 100%; }
    }
  </style>
`;

export async function mountQuestionBank(root) {
  const PAGE_SIZE = 15;
  let currentQuestions = [];
  let currentLectures = [];
  let selectedTopic = 'all';
  let selectedLevel = 'all';
  let selectedType = 'all';
  let searchQuery = '';
  let currentPage = 1;
  let selectedIds = new Set();
  let pickTargetId = null;
  try {
    pickTargetId = sessionStorage.getItem('lms:qbPickTarget') || null;
  } catch {
    pickTargetId = null;
  }
  let generatorOpen = Boolean(pickTargetId);
  let generatedItems = [];

  registerCleanup(() => {
    try {
      sessionStorage.removeItem('lms:qbPickTarget');
    } catch {
      // Ignore storage error
    }
  });

  root.innerHTML = `
    ${QB_STYLES}
    <section class="qb-hub">
      <header class="asg-overview-hero">
        <a href="#/manage" class="phase-back-link">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          <span>Trung tâm Quản trị</span>
        </a>
        <div class="asg-overview-hero-row">
          <div class="asg-overview-hero-left">
            <h1 class="phase-hero-title">Ngân hàng câu hỏi</h1>
            <p class="qb-hero-meta" id="qb-hero-meta">Đang tải ngân hàng...</p>
          </div>
          <div class="qb-hero-actions">
            <button type="button" id="qb-toggle-gen-btn" class="qb-btn-hero">
              ${QB_ICONS.spark}
              <span>Tạo đề tự động</span>
            </button>
            <button type="button" id="qb-open-latex-modal-btn" class="qb-btn-hero qb-btn-hero--ghost">
              ${QB_ICONS.code}
              <span>Nhập LaTeX</span>
            </button>
          </div>
        </div>
      </header>

      ${pickTargetId ? `
        <div class="qb-pick-banner" id="qb-pick-banner">
          <span>Đang chọn hoặc bốc câu hỏi để đưa vào đề đang soạn (${pickTargetId === 'new' ? 'Đề mới' : 'Đề đang chỉnh sửa'}).</span>
          <button type="button" id="qb-cancel-pick-target-btn" class="qb-btn-secondary" style="background:#FFFFFF;height:32px;">Quay lại đề</button>
        </div>
      ` : ''}

      <!-- Prepackaged Packs Import Banner -->
      <div id="qb-pack-host"></div>

      <!-- Auto Exam Generator Panel -->
      <section class="qb-gen-panel ${generatorOpen ? 'open' : ''}" id="qb-gen-panel">
        <div class="qb-gen-head">
          <div>
            <h2 class="qb-gen-title">Tạo đề tự động theo ma trận</h2>
            <p class="qb-gen-sub">Ghép đủ 3 phần Trắc nghiệm · Đúng/Sai · Trả lời ngắn rồi chỉnh tiếp hoặc lưu thành đề</p>
          </div>
          <button type="button" class="qb-btn-secondary" id="qb-close-gen-btn">Đóng</button>
        </div>

        <div class="qb-gen-config">
          <div class="qb-field">
            <label for="qb-gen-title-input">Tên đề thi mới</label>
            <input id="qb-gen-title-input" type="text" class="qb-input" value="Đề kiểm tra Chương 1 — Ứng dụng đạo hàm" placeholder="Nhập tên đề thi..." />
          </div>
          <div class="qb-field">
            <label for="qb-gen-category-input">Chủ đề / Phân loại</label>
            <input id="qb-gen-category-input" type="text" class="qb-input" list="qb-category-suggestions" value="Chuẩn 2025" placeholder="Ví dụ: Đại số, Hình học, Chuẩn 2025..." />
            <datalist id="qb-category-suggestions">
              <option value="Chuẩn 2025"></option>
              <option value="Đại số & Giải tích"></option>
              <option value="Hình học"></option>
              <option value="Xác suất & Thống kê"></option>
              <option value="Đề luyện tập"></option>
              <option value="Vận dụng cao"></option>
            </datalist>
          </div>
          <div class="qb-field">
            <label for="qb-gen-lecture-select">Chương liên kết</label>
            <select id="qb-gen-lecture-select" class="qb-input">
              <option value="">Bài tập tự do</option>
            </select>
          </div>
          <div class="qb-field">
            <label>Trạng thái khi lưu</label>
            <div class="qb-level-bar" id="qb-gen-publish-bar">
              <button type="button" class="qb-pill active" data-gen-pub="true">Xuất bản ngay</button>
              <button type="button" class="qb-pill" data-gen-pub="false">Lưu nháp</button>
            </div>
          </div>
        </div>

        <div>
          <div class="qb-gen-row-label">Mẫu đề nhanh</div>
          <div class="qb-gen-section-row">
            <div class="qb-preset-bar" id="qb-gen-presets"></div>
            <button type="button" class="qb-btn-secondary" id="qb-gen-reset-btn" style="height:34px;">Đặt lại về 0</button>
          </div>
        </div>

        <div>
          <div class="qb-gen-row-label">Phân bổ mức độ nhận thức</div>
          <div class="qb-level-bar" id="qb-gen-level-bar"></div>
        </div>

        <div class="qb-ratio-bar" id="qb-gen-ratio-bar">
          <span class="qb-ratio-item">
            <span>Nhận biết</span>
            <input type="number" min="0" max="100" value="40" class="qb-ratio-inp" data-ratio-lv="Nhận biết" />
            <span>%</span>
          </span>
          <span class="qb-ratio-item">
            <span>Thông hiểu</span>
            <input type="number" min="0" max="100" value="40" class="qb-ratio-inp" data-ratio-lv="Thông hiểu" />
            <span>%</span>
          </span>
          <span class="qb-ratio-item">
            <span>Vận dụng</span>
            <input type="number" min="0" max="100" value="20" class="qb-ratio-inp" data-ratio-lv="Vận dụng" />
            <span>%</span>
          </span>
          <span class="qb-ratio-note" id="qb-gen-ratio-note">Tổng tỉ lệ: 100%</span>
        </div>

        <div class="qb-matrix-wrap" id="qb-gen-slots"></div>

        <div class="qb-gen-footer">
          <div class="qb-gen-summary" id="qb-gen-summary">Tổng đã chọn: <strong>0 câu</strong></div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <label class="qb-gen-check" title="Xáo trộn thứ tự các phương án A, B, C, D cho câu trắc nghiệm khi lưu đề">
              <input type="checkbox" id="qb-gen-shuffle-choices" />
              <span>Đảo đáp án A/B/C/D</span>
            </label>
            <button type="button" class="qb-btn-primary" id="qb-pick-random-btn">
              ${QB_ICONS.spark}
              <span>Bốc câu hỏi</span>
            </button>
          </div>
        </div>

        <div class="qb-gen-preview" id="qb-gen-preview">
          <div class="qb-gen-preview-bar">
            <div class="qb-gen-preview-meta">
              <span id="qb-gen-preview-label">Đã bốc 0 câu</span>
              <span class="qb-gen-preview-sub" id="qb-gen-preview-sub"></span>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="qb-btn-secondary" id="qb-copy-latex-btn" style="background:#FFFFFF;">
                ${QB_ICONS.copy}
                <span>Sao chép LaTeX</span>
              </button>
              <button type="button" class="qb-btn-secondary" id="qb-reshuffle-btn" style="background:#FFFFFF;">
                ${QB_ICONS.refresh}
                <span id="qb-reshuffle-label">Trộn lại</span>
              </button>
              <button type="button" class="${pickTargetId ? 'qb-btn-primary' : 'qb-btn-secondary'}" id="qb-edit-generated-btn" style="${pickTargetId ? '' : 'background:#FFFFFF;'}">
                ${QB_ICONS.code}
                <span>${pickTargetId ? 'Đưa vào đề đang soạn' : 'Mở trong Trình tạo đề'}</span>
              </button>
              ${pickTargetId ? '' : `
                <button type="button" class="qb-btn-primary" id="qb-save-generated-btn">
                  ${QB_ICONS.check}
                  <span>Lưu &amp; Mở đề thi</span>
                </button>
              `}
            </div>
          </div>
          <div class="qb-list" id="qb-gen-preview-list"></div>
        </div>
      </section>

      <!-- Manual Selection Action Bar -->
      <div class="qb-selection-bar" id="qb-selection-bar">
        <span>Đã chọn <span id="qb-selected-count">0</span> câu hỏi</span>
        <div style="display:flex;gap:8px;">
          <button type="button" class="qb-btn-secondary" id="qb-clear-sel-btn">Bỏ chọn</button>
          <button type="button" class="qb-btn-hero" id="qb-create-from-sel-btn" style="height:34px;">${pickTargetId ? 'Đưa vào đề đang soạn' : 'Đưa vào Trình tạo đề'}</button>
        </div>
      </div>

      <!-- Filters & Search -->
      <div class="qb-toolbar">
        <div class="qb-toolbar-top">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div class="qb-level-bar" id="qb-type-bar"></div>
            <div class="qb-level-bar" id="qb-level-bar"></div>
          </div>
          <input type="search" id="qb-search-input" class="qb-search" placeholder="Tìm nội dung, trường thi..." />
        </div>
        <div class="qb-topic-bar" id="qb-topic-bar"></div>
      </div>

      <!-- Questions List -->
      <div class="qb-list" id="qb-questions-list">
        <div class="qb-empty">Đang tải ngân hàng câu hỏi...</div>
      </div>
      <div class="qb-pager" id="qb-pager"></div>
    </section>

    <!-- Modal: Nhập bằng mã LaTeX (EX_TEST Split-View) -->
    <div id="qb-latex-modal" style="display: none; position: fixed; inset: 0; background: rgba(24, 27, 22, 0.55); z-index: 9999; backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: 20px;">
      <div style="background: #F7F7F2; width: 100%; max-width: 1380px; height: 90vh; border-radius: 22px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #E4E6DE;">
        <div style="padding: 16px 24px; border-bottom: 1px solid #E4E6DE; display: flex; align-items: center; justify-content: space-between; background: #ffffff;">
          <div>
            <h2 style="margin: 0; font-size: 18px; color: #181B16; font-weight: 700;">Nhập câu hỏi bằng mã LaTeX (EX_TEST)</h2>
          </div>
          <button id="qb-latex-close-btn" type="button" class="qb-btn-secondary">Đóng</button>
        </div>

        <div style="flex: 1; min-height: 0; display: flex; gap: 18px; padding: 18px; overflow: hidden;">
          <div id="qb-latex-preview-pane" style="flex: 1; min-width: 360px; height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; background: #ffffff; border-radius: 16px; border: 1px solid #E4E6DE; padding: 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid #EFEFE9;">
              <strong style="font-size: 15px;">Xem trước</strong>
              <span id="qb-preview-count-badge" class="qb-badge">0 câu hỏi</span>
            </div>
            <div id="qb-latex-preview-list" style="display: flex; flex-direction: column; gap: 14px;"></div>
          </div>

          <div style="flex: 1.1; min-width: 400px; height: 100%; display: flex; flex-direction: column; background: #ffffff; border-radius: 16px; border: 1px solid #E4E6DE; padding: 18px; gap: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
              <input type="text" id="qb-latex-tag-input" value="GĐ1 · Chương 1, Bài 1 · Dạng 1: Đơn điệu (Đồ thị / BBT)" placeholder="Nhãn (phân cách bằng dấu phẩy)" class="qb-input" style="flex: 1; min-width: 220px; height: 34px; font-size: 12.5px;" />
              <div style="display: flex; align-items: center; gap: 6px;">
                <input type="file" id="qb-latex-tex-file" accept=".tex,.txt" style="display: none;" />
                <button type="button" id="qb-latex-upload-tex-btn" class="qb-btn-secondary" style="height:34px;">Tải .tex</button>
                <input type="file" id="qb-latex-img-file" accept="image/*" style="display: none;" />
                <button type="button" id="qb-latex-insert-img-btn" class="qb-btn-secondary" style="height:34px;">Chèn ảnh</button>
                <span id="qb-latex-img-status" style="font-size: 12px; display: none;">Đang tải...</span>
                <button type="button" id="qb-latex-refresh-preview-btn" class="qb-btn-primary" style="height:34px;">Làm mới</button>
              </div>
            </div>
            <div class="qb-cm-wrapper">
              <textarea id="qb-latex-code-input" style="flex: 1; width: 100%; padding: 14px; font-family: monospace; font-size: 13px; border: 1px solid #E4E6DE; border-radius: 12px; background: #F7F7F2; resize: none; outline: none;"></textarea>
            </div>
          </div>
        </div>

        <div style="padding: 14px 24px; border-top: 1px solid #E4E6DE; display: flex; justify-content: space-between; align-items: center; background: #ffffff;">
          <span style="font-size: 13.5px; color: #64695F;">Sẵn sàng: <strong id="qb-latex-count-text" style="color:#181B16;">0 câu hỏi</strong></span>
          <div style="display: flex; gap: 8px;">
            <button id="qb-latex-cancel-btn" type="button" class="qb-btn-secondary">Hủy</button>
            <button id="qb-latex-save-bank-btn" type="button" class="qb-btn-primary">Lưu vào Ngân hàng</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const heroMetaEl = root.querySelector('#qb-hero-meta');
  const packHostEl = root.querySelector('#qb-pack-host');
  const genPanelEl = root.querySelector('#qb-gen-panel');
  const genTitleInput = root.querySelector('#qb-gen-title-input');
  const genCategoryInput = root.querySelector('#qb-gen-category-input');
  const genLectureSelect = root.querySelector('#qb-gen-lecture-select');
  const genPublishBarEl = root.querySelector('#qb-gen-publish-bar');
  const genPresetsEl = root.querySelector('#qb-gen-presets');
  const genLevelBarEl = root.querySelector('#qb-gen-level-bar');
  const genRatioBarEl = root.querySelector('#qb-gen-ratio-bar');
  const genRatioNoteEl = root.querySelector('#qb-gen-ratio-note');
  const genSlotsEl = root.querySelector('#qb-gen-slots');
  const genSummaryEl = root.querySelector('#qb-gen-summary');
  const genShuffleChoicesCb = root.querySelector('#qb-gen-shuffle-choices');
  const genPreviewEl = root.querySelector('#qb-gen-preview');
  const genPreviewLabel = root.querySelector('#qb-gen-preview-label');
  const genPreviewSub = root.querySelector('#qb-gen-preview-sub');
  const genReshuffleLabel = root.querySelector('#qb-reshuffle-label');
  const genPreviewList = root.querySelector('#qb-gen-preview-list');
  const typeBarEl = root.querySelector('#qb-type-bar');
  const levelBarEl = root.querySelector('#qb-level-bar');
  const topicBarEl = root.querySelector('#qb-topic-bar');
  const searchInput = root.querySelector('#qb-search-input');
  const listEl = root.querySelector('#qb-questions-list');
  const pagerEl = root.querySelector('#qb-pager');
  const selBarEl = root.querySelector('#qb-selection-bar');
  const selCountEl = root.querySelector('#qb-selected-count');

  // Auto-generator state
  let genMatrix = {};
  let genMatrixInitialized = false;
  let genActivePreset = 'thpt-2025';
  let genLevelMode = 'all'; // 'all' | 'ratio' | 'Nhận biết' | 'Thông hiểu' | 'Vận dụng'
  let genLevelRatio = { 'Nhận biết': 40, 'Thông hiểu': 40, 'Vận dụng': 20 };
  let genPublishNow = true;

  function typeset(el) {
    if (window.MathJax && el) {
      window.MathJax.typesetPromise([el]).catch(() => {});
    }
  }

  function getTopicStats(levelFilter = 'all', typeFilter = 'all') {
    const map = new Map();
    for (const q of currentQuestions) {
      if (typeFilter !== 'all' && (q.type || 'mcq') !== typeFilter) continue;
      if (levelFilter !== 'all' && getLevelTag(q) !== levelFilter) continue;
      const topic = getTopicTag(q);
      if (!map.has(topic)) map.set(topic, []);
      map.get(topic).push(q);
    }
    return sortTopicTags(Array.from(map.keys())).map((topic) => ({
      topic,
      items: map.get(topic),
    }));
  }

  let dbBankAvailable = true;

  function renderPackBanners() {
    if (!dbBankAvailable) {
      packHostEl.innerHTML = '';
      return;
    }
    const importedPacks = new Set(
      currentQuestions.filter((q) => !q._localPack).map((q) => q.settings?.pack).filter(Boolean),
    );
    const pending = PREPACKAGED_PACKS.filter((p) => !importedPacks.has(p.packId));
    if (!pending.length) {
      packHostEl.innerHTML = '';
      return;
    }

    packHostEl.innerHTML = pending.map((pack) => `
      <div class="qb-pack-banner">
        <div>
          <div class="qb-pack-title">${escapeHtml(pack.title)}</div>
          <div class="qb-pack-sub">${escapeHtml(pack.subtitle)}</div>
        </div>
        <button type="button" class="qb-btn-primary" data-import-pack="${escapeHtml(pack.packId)}">
          ${QB_ICONS.download}
          <span>Đồng bộ lên Supabase</span>
        </button>
      </div>
    `).join('');

    packHostEl.querySelectorAll('[data-import-pack]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pack = PREPACKAGED_PACKS.find((p) => p.packId === btn.dataset.importPack);
        if (!pack) return;
        btn.disabled = true;
        const origHtml = btn.innerHTML;
        try {
          btn.textContent = 'Đang tải dữ liệu...';
          const res = await fetch(pack.url);
          if (!res.ok) throw new Error(`Không tải được gói (${res.status})`);
          const json = await res.json();
          const questions = Array.isArray(json) ? json : (json.questions || []);
          const chunkSize = 40;
          for (let i = 0; i < questions.length; i += chunkSize) {
            const slice = questions.slice(i, i + chunkSize);
            btn.textContent = `Đang nạp ${Math.min(i + chunkSize, questions.length)}/${questions.length} câu...`;
            await batchInsertBankQuestions(slice);
          }
          toast(`Đã lưu ${questions.length} câu hỏi vào Supabase!`, 'success');
          await loadQuestions();
        } catch (err) {
          toast(`Lỗi đồng bộ: ${err.message}`, 'error');
          btn.disabled = false;
          btn.innerHTML = origHtml;
        }
      });
    });
  }

  function ensureMatrixInitialized(rows) {
    if (!rows.length) return;
    if (!genMatrixInitialized) {
      const defaultPreset = EXAM_PRESETS.find((p) => p.id === genActivePreset) || EXAM_PRESETS[0];
      genMatrix = buildPresetMatrix(rows, defaultPreset);
      genMatrixInitialized = true;
      return;
    }
    // Clamp existing counts to available pools (preserves user's chosen numbers!)
    const next = {};
    for (const row of rows) {
      const prev = genMatrix[row.topic] || { mcq: 0, tf4: 0, short: 0 };
      next[row.topic] = {
        mcq: Math.min(Math.max(0, Number(prev.mcq) || 0), row.pools.mcq.length),
        tf4: Math.min(Math.max(0, Number(prev.tf4) || 0), row.pools.tf4.length),
        short: Math.min(Math.max(0, Number(prev.short) || 0), row.pools.short.length),
      };
    }
    genMatrix = next;
  }

  function renderGeneratorControls() {
    if (genPresetsEl) {
      genPresetsEl.innerHTML = EXAM_PRESETS.map((p) => `
        <button type="button" class="qb-preset-btn ${genActivePreset === p.id ? 'active' : ''}" data-preset-id="${escapeHtml(p.id)}">
          <span>${escapeHtml(p.label)}</span>
          <span class="qb-preset-badge">${escapeHtml(p.badge)}</span>
        </button>
      `).join('');

      genPresetsEl.querySelectorAll('[data-preset-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const preset = EXAM_PRESETS.find((p) => p.id === btn.dataset.presetId);
          if (!preset) return;
          genActivePreset = preset.id;
          const rows = buildMatrixStats(currentQuestions, genLevelMode);
          genMatrix = buildPresetMatrix(rows, preset);
          genMatrixInitialized = true;
          if (genTitleInput) {
            const parsedPresetTitle = extractCategoryFromTitle(preset.title);
            genTitleInput.value = parsedPresetTitle.cleanTitle || preset.title;
            if (genCategoryInput && parsedPresetTitle.category) {
              genCategoryInput.value = parsedPresetTitle.category;
            }
          }
          generatedItems = [];
          genPreviewEl.classList.remove('open');
          renderGeneratorSlots();
        });
      });
    }

    if (genLevelBarEl) {
      const modeOptions = [
        { key: 'all', label: 'Tất cả mức độ' },
        { key: 'ratio', label: 'Theo tỉ lệ NB / TH / VD' },
        { key: 'Nhận biết', label: 'Chỉ Nhận biết' },
        { key: 'Thông hiểu', label: 'Chỉ Thông hiểu' },
        { key: 'Vận dụng', label: 'Chỉ Vận dụng' },
      ];
      genLevelBarEl.innerHTML = modeOptions.map((m) => `
        <button type="button" class="qb-pill ${genLevelMode === m.key ? 'active' : ''}" data-gen-lvmode="${escapeHtml(m.key)}">
          <span>${escapeHtml(m.label)}</span>
        </button>
      `).join('');

      genLevelBarEl.querySelectorAll('[data-gen-lvmode]').forEach((btn) => {
        btn.addEventListener('click', () => {
          genLevelMode = btn.dataset.genLvmode;
          generatedItems = [];
          genPreviewEl.classList.remove('open');
          renderGeneratorSlots();
        });
      });
    }

    if (genRatioBarEl) {
      genRatioBarEl.classList.toggle('show', genLevelMode === 'ratio');
      const totalPct = GEN_LEVELS.reduce((sum, lv) => sum + (Number(genLevelRatio[lv]) || 0), 0);
      if (genRatioNoteEl) {
        genRatioNoteEl.textContent = totalPct === 100
          ? 'Tổng tỉ lệ: 100%'
          : `Tổng tỉ lệ: ${totalPct}% (tự quy đổi chuẩn hóa)`;
      }
    }
  }

  function syncMatrixSummary(rows) {
    const colTotals = { mcq: 0, tf4: 0, short: 0 };
    const colAvail = { mcq: 0, tf4: 0, short: 0 };
    let grand = 0;

    for (const row of rows) {
      const vals = genMatrix[row.topic] || { mcq: 0, tf4: 0, short: 0 };
      for (const td of GEN_TYPES) {
        const v = Number(vals[td.key]) || 0;
        colTotals[td.key] += v;
        colAvail[td.key] += row.pools[td.key].length;
        grand += v;
      }
    }

    // Update header counters & row totals in-place
    GEN_TYPES.forEach((td) => {
      const thSub = genSlotsEl.querySelector(`[data-col-sub="${td.key}"]`);
      if (thSub) thSub.textContent = `${colTotals[td.key]} / ${colAvail[td.key]} sẵn`;
    });

    for (const row of rows) {
      const vals = genMatrix[row.topic] || { mcq: 0, tf4: 0, short: 0 };
      const rTotal = (vals.mcq || 0) + (vals.tf4 || 0) + (vals.short || 0);
      const tr = genSlotsEl.querySelector(`tr[data-matrix-row="${CSS.escape(row.topic)}"]`);
      if (tr) {
        tr.classList.toggle('has-val', rTotal > 0);
        const badge = tr.querySelector('.qb-row-total');
        if (badge) {
          badge.textContent = String(rTotal);
          badge.classList.toggle('is-active', rTotal > 0);
        }
      }
    }

    const parts = [];
    if (colTotals.mcq > 0) parts.push(`<span class="qb-badge">${colTotals.mcq} TN</span>`);
    if (colTotals.tf4 > 0) parts.push(`<span class="qb-badge qb-badge--type">${colTotals.tf4} Đ/S</span>`);
    if (colTotals.short > 0) parts.push(`<span class="qb-badge qb-badge--ok">${colTotals.short} TLN</span>`);

    genSummaryEl.innerHTML = `
      <span>Tổng đã chọn: <strong>${grand} câu</strong></span>
      ${parts.join('')}
    `;
  }

  function renderGeneratorSlots() {
    renderGeneratorControls();
    const rows = buildMatrixStats(currentQuestions, genLevelMode);
    ensureMatrixInitialized(rows);

    if (!rows.length) {
      genSlotsEl.innerHTML = `<div class="qb-empty" style="border:0;padding:24px;">Chưa có câu hỏi phù hợp chế độ lọc này.</div>`;
      genSummaryEl.innerHTML = `<span>Tổng đã chọn: <strong>0 câu</strong></span>`;
      return;
    }

    const renderCell = (topic, typeKey, availCount) => {
      if (availCount <= 0) {
        return `<td class="is-num"><span class="qb-step-na" title="Chưa có câu hỏi loại này">—</span></td>`;
      }
      const val = Math.min(availCount, Math.max(0, Number(genMatrix[topic]?.[typeKey]) || 0));
      return `
        <td class="is-num">
          <div class="qb-stepper ${val > 0 ? 'is-active' : ''}" data-stepper-topic="${escapeHtml(topic)}" data-stepper-type="${typeKey}">
            <button type="button" class="qb-step-btn" data-step-delta="-1" ${val <= 0 ? 'disabled' : ''} aria-label="Giảm">−</button>
            <input type="number" class="qb-step-inp" min="0" max="${availCount}" value="${val}" data-cell-topic="${escapeHtml(topic)}" data-cell-type="${typeKey}" />
            <button type="button" class="qb-step-btn" data-step-delta="1" ${val >= availCount ? 'disabled' : ''} aria-label="Tăng">+</button>
          </div>
          <span class="qb-step-cap">/${availCount} sẵn</span>
        </td>
      `;
    };

    genSlotsEl.innerHTML = `
      <table class="qb-matrix">
        <thead>
          <tr>
            <th>Dạng bài (${rows.length})</th>
            ${GEN_TYPES.map((td) => `
              <th class="is-num">
                <span>${escapeHtml(td.shortLabel)}</span>
                <span class="qb-matrix-th-sub" data-col-sub="${td.key}">0 / 0 sẵn</span>
              </th>
            `).join('')}
            <th class="is-total">Tổng</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            const vals = genMatrix[row.topic] || { mcq: 0, tf4: 0, short: 0 };
            const rTotal = (vals.mcq || 0) + (vals.tf4 || 0) + (vals.short || 0);
            return `
              <tr class="${rTotal > 0 ? 'has-val' : ''}" data-matrix-row="${escapeHtml(row.topic)}">
                <td>
                  <div class="qb-matrix-topic">${escapeHtml(row.topic)}</div>
                  <div class="qb-matrix-avail-sub">Tổng sẵn: ${row.total} câu</div>
                </td>
                ${GEN_TYPES.map((td) => renderCell(row.topic, td.key, row.pools[td.key].length)).join('')}
                <td class="is-total">
                  <span class="qb-row-total ${rTotal > 0 ? 'is-active' : ''}">${rTotal}</span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    const updateCellValue = (topic, typeKey, rawVal, maxCap) => {
      const clamped = Math.max(0, Math.min(maxCap, Number(rawVal) || 0));
      if (!genMatrix[topic]) genMatrix[topic] = { mcq: 0, tf4: 0, short: 0 };
      genMatrix[topic][typeKey] = clamped;
      genActivePreset = null;
      genPresetsEl?.querySelectorAll('.qb-preset-btn.active').forEach((b) => b.classList.remove('active'));

      const stepper = genSlotsEl.querySelector(
        `.qb-stepper[data-stepper-topic="${CSS.escape(topic)}"][data-stepper-type="${typeKey}"]`,
      );
      if (stepper) {
        stepper.classList.toggle('is-active', clamped > 0);
        const inp = stepper.querySelector('.qb-step-inp');
        if (inp && Number(inp.value) !== clamped) inp.value = String(clamped);
        const decBtn = stepper.querySelector('[data-step-delta="-1"]');
        const incBtn = stepper.querySelector('[data-step-delta="1"]');
        if (decBtn) decBtn.disabled = clamped <= 0;
        if (incBtn) incBtn.disabled = clamped >= maxCap;
      }
      syncMatrixSummary(rows);
    };

    genSlotsEl.querySelectorAll('.qb-stepper').forEach((stepper) => {
      const topic = stepper.dataset.stepperTopic;
      const typeKey = stepper.dataset.stepperType;
      const inp = stepper.querySelector('.qb-step-inp');
      const maxCap = Number(inp?.max) || 0;

      stepper.querySelectorAll('[data-step-delta]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const delta = Number(btn.dataset.stepDelta) || 0;
          const current = Number(genMatrix[topic]?.[typeKey]) || 0;
          updateCellValue(topic, typeKey, current + delta, maxCap);
        });
      });

      inp?.addEventListener('input', () => {
        updateCellValue(topic, typeKey, inp.value, maxCap);
      });
    });

    syncMatrixSummary(rows);
  }

  function pickGeneratedQuestions(keepPinned = false) {
    const picked = pickFromMatrix(currentQuestions, genMatrix, {
      levelMode: genLevelMode,
      levelRatio: genLevelRatio,
      pinnedItems: keepPinned ? generatedItems : [],
    });

    if (!picked.length) {
      toast('Hãy chọn ít nhất 1 câu hỏi trong ma trận để tạo đề.', 'error');
      return;
    }

    generatedItems = picked;
    renderGeneratedPreview();
  }

  function renderGeneratedPreview() {
    if (!generatedItems.length) {
      genPreviewEl.classList.remove('open');
      return;
    }
    genPreviewEl.classList.add('open');

    const summary = summarizePickedItems(generatedItems);
    const pinnedCount = generatedItems.filter((x) => x.pinned).length;
    const partBits = [];
    if (summary.byType.mcq) partBits.push(`${summary.byType.mcq} TN`);
    if (summary.byType.tf4) partBits.push(`${summary.byType.tf4} Đ/S`);
    if (summary.byType.short) partBits.push(`${summary.byType.short} TLN`);

    genPreviewLabel.textContent = `Đã bốc ${summary.total} câu (${partBits.join(' · ')})`;
    if (genPreviewSub) {
      const lvBits = GEN_LEVELS
        .filter((lv) => summary.byLevel[lv] > 0)
        .map((lv) => `${lv}: ${summary.byLevel[lv]}`);
      const pinNote = pinnedCount > 0 ? ` · Đã ghim ${pinnedCount} câu` : '';
      genPreviewSub.textContent = `${lvBits.join(' · ')}${pinNote}`;
    }
    if (genReshuffleLabel) {
      genReshuffleLabel.textContent = pinnedCount > 0 ? `Trộn lại (giữ ${pinnedCount} ghim)` : 'Trộn lại';
    }

    const typeCountsByGroup = summary.byType;
    let html = '';
    let prevType = null;
    let partSeq = 0;
    const roman = ['I', 'II', 'III'];

    generatedItems.forEach((slot, idx) => {
      const { q, topic, pinned } = slot;
      const qType = q.type || 'mcq';
      if (qType !== prevType) {
        prevType = qType;
        const typeDef = GEN_TYPES.find((t) => t.key === qType);
        const titleText = typeDef?.shortLabel || getTypeLabel(qType);
        html += `
          <div class="qb-part-header">
            <span class="qb-part-num">${roman[partSeq] || partSeq + 1}</span>
            <span>Phần ${roman[partSeq] || partSeq + 1} · ${escapeHtml(titleText)} (${typeCountsByGroup[qType] || 0} câu)</span>
          </div>
        `;
        partSeq += 1;
      }

      const keyObj = Array.isArray(q.answer_keys) ? q.answer_keys[0] : q.answer_keys;
      const ansSummary = formatAnswerSummary(q, keyObj);
      const lvTag = getLevelTag(q);
      const canMoveUp = idx > 0 && (generatedItems[idx - 1].q.type || 'mcq') === qType;
      const canMoveDown = idx < generatedItems.length - 1 && (generatedItems[idx + 1].q.type || 'mcq') === qType;

      html += `
        <article class="qb-card ${pinned ? 'is-pinned' : ''}" style="padding:16px 18px;">
          <div class="qb-card-head">
            <div class="qb-card-tags">
              <span class="qb-badge qb-badge--dark">Câu ${idx + 1}</span>
              <span class="qb-badge">${escapeHtml(topic)}</span>
              ${lvTag ? `<span class="qb-badge qb-badge--type">${escapeHtml(lvTag)}</span>` : ''}
              ${ansSummary ? `<span class="qb-badge qb-badge--ok">Đáp án ${escapeHtml(ansSummary)}</span>` : ''}
            </div>
            <div class="qb-preview-actions">
              <button type="button" class="qb-mini-btn ${pinned ? 'is-pinned' : ''}" data-pin-idx="${idx}" title="${pinned ? 'Bỏ ghim câu này' : 'Ghim câu này để giữ lại khi trộn'}">
                ${QB_ICONS.pin}
                <span>${pinned ? 'Đã ghim' : 'Ghim'}</span>
              </button>
              <button type="button" class="qb-mini-btn qb-mini-btn--icon" data-move-idx="${idx}" data-move-dir="-1" ${canMoveUp ? '' : 'disabled'} title="Đưa lên trên">
                ${QB_ICONS.arrowUp}
              </button>
              <button type="button" class="qb-mini-btn qb-mini-btn--icon" data-move-idx="${idx}" data-move-dir="1" ${canMoveDown ? '' : 'disabled'} title="Đưa xuống dưới">
                ${QB_ICONS.arrowDown}
              </button>
              <button type="button" class="qb-mini-btn" data-swap-idx="${idx}" title="Đổi sang câu khác cùng dạng & loại">
                ${QB_ICONS.refresh}
                <span>Đổi câu</span>
              </button>
              <button type="button" class="qb-mini-btn qb-mini-btn--icon qb-mini-btn--danger" data-remove-idx="${idx}" title="Xóa khỏi đề">
                ${QB_ICONS.close}
              </button>
            </div>
          </div>
          <div class="qb-prompt">${renderLatexText(q.prompt)}</div>
          ${renderQuestionChoicesHtml(q, keyObj)}
          ${q.settings?.explanation ? `
            <details class="qb-sol">
              <summary>Xem lời giải chi tiết</summary>
              <div class="qb-sol-body">${renderLatexText(q.settings.explanation)}</div>
            </details>
          ` : ''}
        </article>
      `;
    });

    genPreviewList.innerHTML = html;
    typeset(genPreviewList);

    // Pin / Unpin
    genPreviewList.querySelectorAll('[data-pin-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.pinIdx);
        if (!generatedItems[idx]) return;
        generatedItems[idx].pinned = !generatedItems[idx].pinned;
        renderGeneratedPreview();
      });
    });

    // Move Up / Down within same section
    genPreviewList.querySelectorAll('[data-move-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.moveIdx);
        const dir = Number(btn.dataset.moveDir);
        const targetIdx = idx + dir;
        if (targetIdx < 0 || targetIdx >= generatedItems.length) return;
        const tmp = generatedItems[idx];
        generatedItems[idx] = generatedItems[targetIdx];
        generatedItems[targetIdx] = tmp;
        renderGeneratedPreview();
      });
    });

    // Swap individual question (same topic + same type; prefers same level when in ratio/single-level mode)
    genPreviewList.querySelectorAll('[data-swap-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.swapIdx);
        const slot = generatedItems[idx];
        if (!slot) return;
        const slotType = slot.q.type || 'mcq';
        const slotLevel = getLevelTag(slot.q);
        const usedIds = new Set(generatedItems.map((x) => x.q.id));

        const baseCandidates = currentQuestions.filter((cand) => {
          if (usedIds.has(cand.id)) return false;
          if (getTopicTag(cand) !== slot.topic) return false;
          if ((cand.type || 'mcq') !== slotType) return false;
          if (GEN_LEVELS.includes(genLevelMode) && getLevelTag(cand) !== genLevelMode) return false;
          return true;
        });

        if (!baseCandidates.length) {
          toast('Không còn câu khác cùng dạng & loại để đổi.', 'info');
          return;
        }
        const sameLevelPool = genLevelMode === 'ratio'
          ? baseCandidates.filter((c) => getLevelTag(c) === slotLevel)
          : [];
        const pool = sameLevelPool.length ? sameLevelPool : baseCandidates;
        const replacement = pool[Math.floor(Math.random() * pool.length)];
        generatedItems[idx] = { q: replacement, topic: slot.topic, pinned: slot.pinned };
        renderGeneratedPreview();
      });
    });

    // Remove question from preview & sync matrix count
    genPreviewList.querySelectorAll('[data-remove-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.removeIdx);
        const removed = generatedItems[idx];
        if (!removed) return;
        generatedItems.splice(idx, 1);
        const rType = removed.q.type || 'mcq';
        if (genMatrix[removed.topic]?.[rType] > 0) {
          genMatrix[removed.topic][rType] -= 1;
          genActivePreset = null;
          renderGeneratorSlots();
        }
        renderGeneratedPreview();
      });
    });
  }

  function getGeneratorConfig() {
    return {
      title: (genTitleInput?.value || '').trim(),
      category: (genCategoryInput?.value || '').trim(),
      lectureId: genLectureSelect?.value || '',
      published: genPublishNow,
      shuffleChoices: Boolean(genShuffleChoicesCb?.checked),
    };
  }

  function clearPickTarget() {
    pickTargetId = null;
    try {
      sessionStorage.removeItem('lms:qbPickTarget');
    } catch {
      // Ignore storage error
    }
  }

  function sendQuestionsToAssignmentEditor(list, options = {}) {
    if (!list?.length) return;
    const cfg = getGeneratorConfig();
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    const targetId = pickTargetId || 'new';

    let existingEditor = null;
    if (pickTargetId) {
      if (state.assignmentEditor && (pickTargetId === 'new' ? !state.assignmentEditor.assignment?.id : state.assignmentEditor.assignment?.id === pickTargetId)) {
        existingEditor = state.assignmentEditor;
      } else {
        existingEditor = loadEditorDraft(storage, state.profile?.id, pickTargetId);
      }
    }

    const seed = buildAssignmentSeedFromBank(list, {
      title: options.title ?? (cfg.title || `Đề luyện tập (${list.length} câu)`),
      category: options.category ?? cfg.category,
      lectureId: options.lectureId ?? cfg.lectureId,
      published: options.published ?? cfg.published,
      shuffleChoices: options.shuffleChoices ?? cfg.shuffleChoices,
      existingEditor,
    });

    state.assignmentEditor = seed;
    state.isEditingAssignment = true;
    saveEditorDraft(storage, state.profile?.id, targetId, seed);
    clearPickTarget();
    toast(
      existingEditor
        ? `Đã thêm ${list.length} câu vào đề đang soạn.`
        : `Đã nạp ${list.length} câu vào Trình tạo đề.`,
      'success',
    );
    go(`assignments/${targetId}`);
  }

  async function saveQuestionsAsAssignment(title, list, options = {}) {
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle || !list.length) return;
    const cfg = getGeneratorConfig();
    const seed = buildAssignmentSeedFromBank(list, {
      title: cleanTitle,
      category: options.category ?? cfg.category,
      lectureId: options.lectureId ?? cfg.lectureId,
      published: options.published ?? cfg.published,
      shuffleChoices: options.shuffleChoices ?? cfg.shuffleChoices,
    });
    const payload = {
      title: seed.assignment.title,
      published: seed.assignment.published,
      pdf_url: 'latex',
      description: seed.latexSource,
      lecture_id: seed.assignment.lecture_id || null,
      owner_id: state.profile?.id,
    };
    const saved = await saveAssignmentWithQuestions(payload, seed.questions);
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    clearEditorDraft(storage, state.profile?.id, 'new');
    clearPickTarget();

    toast(
      `Đã ${seed.assignment.published ? 'xuất bản' : 'lưu nháp'} đề "${seed.assignment.title}" (${list.length} câu)!`,
      'success',
    );

    if (saved?.id) {
      try {
        const savedEditor = await fetchAssignmentEditor(saved.id);
        state.assignmentEditor = {
          ...normalizeAssignmentEditor(savedEditor),
          latexSource: seed.latexSource,
        };
        state.isEditingAssignment = true;
        go(`assignments/${saved.id}`);
        return;
      } catch {
        // Fallback to list if immediate fetch fails
      }
    }
    go('assignments');
  }

  function renderFilterBars() {
    const typeCounts = { all: currentQuestions.length, mcq: 0, tf4: 0, short: 0 };
    for (const q of currentQuestions) {
      const t = q.type || 'mcq';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    const typesToShow = ['all', 'mcq', 'tf4', 'short'].filter((t) => t === 'all' || typeCounts[t] > 0);
    if (typeBarEl) {
      typeBarEl.innerHTML = typesToShow.length > 2
        ? typesToShow.map((t) => `
            <button type="button" class="qb-pill ${selectedType === t ? 'active' : ''}" data-qtype="${t}">
              <span>${t === 'all' ? 'Mọi loại' : escapeHtml(getTypeLabel(t))}</span>
              <span class="qb-pill-cnt">${typeCounts[t]}</span>
            </button>
          `).join('')
        : '';
      typeBarEl.querySelectorAll('[data-qtype]').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedType = btn.dataset.qtype;
          currentPage = 1;
          renderFilterBars();
          renderQuestionsList();
        });
      });
    }

    const typeFiltered = selectedType === 'all'
      ? currentQuestions
      : currentQuestions.filter((q) => (q.type || 'mcq') === selectedType);

    const levelCounts = { all: typeFiltered.length };
    LEVEL_TAGS.forEach((lv) => {
      levelCounts[lv] = typeFiltered.filter((q) => getLevelTag(q) === lv).length;
    });

    const levelsToShow = ['all', ...LEVEL_TAGS.filter((lv) => levelCounts[lv] > 0)];
    levelBarEl.innerHTML = levelsToShow.map((lv) => `
      <button type="button" class="qb-pill ${selectedLevel === lv ? 'active' : ''}" data-level="${escapeHtml(lv)}">
        <span>${lv === 'all' ? 'Tất cả' : escapeHtml(lv)}</span>
        <span class="qb-pill-cnt">${levelCounts[lv]}</span>
      </button>
    `).join('');

    levelBarEl.querySelectorAll('[data-level]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedLevel = btn.dataset.level;
        currentPage = 1;
        renderFilterBars();
        renderQuestionsList();
      });
    });

    const topicStats = getTopicStats(selectedLevel, selectedType);
    const totalForLevel = selectedLevel === 'all' ? typeFiltered.length : levelCounts[selectedLevel];
    topicBarEl.innerHTML = `
      <button type="button" class="qb-topic-chip ${selectedTopic === 'all' ? 'active' : ''}" data-topic="all">
        <span>Tất cả dạng</span>
        <span class="qb-pill-cnt">${totalForLevel}</span>
      </button>
      ${topicStats.map(({ topic, items }) => `
        <button type="button" class="qb-topic-chip ${selectedTopic === topic ? 'active' : ''}" data-topic="${escapeHtml(topic)}">
          <span>${escapeHtml(topic)}</span>
          <span class="qb-pill-cnt">${items.length}</span>
        </button>
      `).join('')}
    `;

    topicBarEl.querySelectorAll('[data-topic]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedTopic = btn.dataset.topic;
        currentPage = 1;
        renderFilterBars();
        renderQuestionsList();
      });
    });
  }

  function getFilteredQuestions() {
    const qLower = searchQuery.trim().toLowerCase();
    return currentQuestions.filter((q) => {
      if (selectedType !== 'all' && (q.type || 'mcq') !== selectedType) return false;
      if (selectedLevel !== 'all' && getLevelTag(q) !== selectedLevel) return false;
      if (selectedTopic !== 'all' && getTopicTag(q) !== selectedTopic) return false;
      if (!qLower) return true;
      return (
        (q.prompt || '').toLowerCase().includes(qLower) ||
        (q.tags || []).some((t) => t.toLowerCase().includes(qLower)) ||
        (q.choices || []).some((c) => c.toLowerCase().includes(qLower)) ||
        (q.settings?.statements || []).some((s) => s.toLowerCase().includes(qLower)) ||
        (q.settings?.source || '').toLowerCase().includes(qLower)
      );
    });
  }

  function syncSelectionBar() {
    selCountEl.textContent = String(selectedIds.size);
    selBarEl.classList.toggle('show', selectedIds.size > 0);
  }

  function renderQuestionsList() {
    const filtered = getFilteredQuestions();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="qb-empty">
          Không tìm thấy câu hỏi nào phù hợp.
        </div>
      `;
      pagerEl.innerHTML = '';
      return;
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);

    listEl.innerHTML = pageItems.map((q, idx) => {
      const isChecked = selectedIds.has(q.id);
      const keyObj = Array.isArray(q.answer_keys) ? q.answer_keys[0] : q.answer_keys;
      const ansSummary = formatAnswerSummary(q, keyObj);
      const topic = getTopicTag(q);
      const level = getLevelTag(q);

      return `
        <article class="qb-card ${isChecked ? 'is-selected' : ''}" data-qid="${escapeHtml(q.id)}">
          <div class="qb-card-head">
            <div class="qb-card-tags">
              <input type="checkbox" class="qb-cb" data-sel-id="${escapeHtml(q.id)}" ${isChecked ? 'checked' : ''} />
              <span class="qb-badge qb-badge--dark">Câu ${start + idx + 1}</span>
              ${q.type && q.type !== 'mcq' ? `<span class="qb-badge qb-badge--type">${escapeHtml(getTypeLabel(q.type))}</span>` : ''}
              <span class="qb-badge">${escapeHtml(topic)}</span>
              ${level ? `<span class="qb-badge qb-badge--ok">${escapeHtml(level)}</span>` : ''}
            </div>
            ${!q._localPack ? `
              <button type="button" class="qb-icon-btn qb-icon-btn--danger" data-del-id="${escapeHtml(q.id)}" title="Xóa câu hỏi">
                ${QB_ICONS.trash}
              </button>
            ` : ''}
          </div>

          <div class="qb-prompt">${renderLatexText(q.prompt)}</div>

          ${renderQuestionChoicesHtml(q, keyObj)}

          ${q.settings?.explanation ? `
            <details class="qb-sol">
              <summary>Xem lời giải chi tiết${ansSummary ? ` (Đáp án ${escapeHtml(ansSummary)})` : ''}</summary>
              <div class="qb-sol-body">${renderLatexText(q.settings.explanation)}</div>
            </details>
          ` : ''}
        </article>
      `;
    }).join('');

    typeset(listEl);

    listEl.querySelectorAll('[data-sel-id]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.selId;
        if (cb.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        cb.closest('.qb-card')?.classList.toggle('is-selected', cb.checked);
        syncSelectionBar();
      });
    });

    listEl.querySelectorAll('[data-del-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!window.confirm('Xóa câu hỏi này khỏi ngân hàng?')) return;
        try {
          await deleteBankQuestion(btn.dataset.delId);
          selectedIds.delete(btn.dataset.delId);
          currentQuestions = currentQuestions.filter((q) => q.id !== btn.dataset.delId);
          toast('Đã xóa câu hỏi.', 'success');
          updateHeroMeta();
          renderFilterBars();
          renderQuestionsList();
          renderGeneratorSlots();
          syncSelectionBar();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });

    pagerEl.innerHTML = `
      <span>Hiển thị ${start + 1}–${start + pageItems.length} / ${filtered.length} câu</span>
      ${totalPages > 1 ? `
        <div class="qb-pager-btns">
          <button type="button" class="qb-btn-secondary" id="qb-prev-page" ${currentPage <= 1 ? 'disabled' : ''}>← Trước</button>
          <span>Trang ${currentPage}/${totalPages}</span>
          <button type="button" class="qb-btn-secondary" id="qb-next-page" ${currentPage >= totalPages ? 'disabled' : ''}>Sau →</button>
        </div>
      ` : ''}
    `;

    pagerEl.querySelector('#qb-prev-page')?.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderQuestionsList();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    pagerEl.querySelector('#qb-next-page')?.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderQuestionsList();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  function updateHeroMeta() {
    const topicsCount = getTopicStats('all').length;
    heroMetaEl.textContent = `${currentQuestions.length} câu hỏi - ${topicsCount} dạng bài`;
  }

  async function loadPrepackagedQuestions(excludePackIds = new Set()) {
    const loaded = [];
    for (const pack of PREPACKAGED_PACKS) {
      if (excludePackIds.has(pack.packId)) continue;
      try {
        const res = await fetch(pack.url);
        if (!res.ok) continue;
        const json = await res.json();
        const items = Array.isArray(json) ? json : (json.questions || []);
        for (const item of items) {
          loaded.push({
            id: `pack-${pack.packId}-${item.source_num ?? item.sort_order}`,
            type: item.type || 'mcq',
            prompt: item.prompt,
            points: item.points || 1,
            choices: item.choices || [],
            settings: item.settings || {},
            tags: item.tags || [],
            answer_keys: [item.answer_key],
            _localPack: true,
          });
        }
      } catch {
        // Ignore single pack fetch error
      }
    }
    return loaded;
  }

  function syncGeneratorLectureSelect() {
    if (!genLectureSelect) return;
    const prevVal = genLectureSelect.value;
    genLectureSelect.innerHTML = [
      '<option value="">Bài tập tự do</option>',
      ...currentLectures.map((l) => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.title)}</option>`),
    ].join('');
    if (pickTargetId) {
      const storage = typeof localStorage !== 'undefined' ? localStorage : null;
      const draft = (state.assignmentEditor && (pickTargetId === 'new' ? !state.assignmentEditor.assignment?.id : state.assignmentEditor.assignment?.id === pickTargetId))
        ? state.assignmentEditor
        : loadEditorDraft(storage, state.profile?.id, pickTargetId);
      if (draft?.assignment) {
        const parsedT = extractCategoryFromTitle(draft.assignment.title || '');
        if (genTitleInput && parsedT.cleanTitle) genTitleInput.value = parsedT.cleanTitle;
        if (genCategoryInput && (draft.assignment.category || parsedT.category)) {
          genCategoryInput.value = draft.assignment.category || parsedT.category;
        }
        if (draft.assignment.lecture_id) genLectureSelect.value = draft.assignment.lecture_id;
        return;
      }
    }
    if (prevVal) genLectureSelect.value = prevVal;
  }

  async function loadQuestions() {
    let dbQuestions = [];
    const [bankResult, pathResult] = await Promise.all([
      fetchQuestionBank({ limit: 1000, offset: 0 }).catch(() => ({ questions: null })),
      fetchLearningPath(state.profile?.role).catch(() => ({ lectures: [] })),
    ]);
    if (bankResult?.questions) {
      dbQuestions = bankResult.questions;
      dbBankAvailable = true;
    } else {
      dbBankAvailable = false;
    }
    currentLectures = pathResult?.lectures || [];
    syncGeneratorLectureSelect();

    const dbPackIds = new Set(dbQuestions.map((q) => q.settings?.pack).filter(Boolean));
    const localQuestions = await loadPrepackagedQuestions(dbPackIds);
    currentQuestions = [...dbQuestions, ...localQuestions];

    updateHeroMeta();
    renderPackBanners();
    renderFilterBars();
    renderGeneratorSlots();
    renderQuestionsList();
  }

  root.querySelector('#qb-cancel-pick-target-btn')?.addEventListener('click', () => {
    const target = pickTargetId;
    clearPickTarget();
    go(target ? `assignments/${target}` : 'assignments');
  });

  // Toggle Generator Panel
  root.querySelector('#qb-toggle-gen-btn')?.addEventListener('click', () => {
    generatorOpen = !generatorOpen;
    genPanelEl.classList.toggle('open', generatorOpen);
    if (generatorOpen) renderGeneratorSlots();
  });
  root.querySelector('#qb-close-gen-btn')?.addEventListener('click', () => {
    generatorOpen = false;
    genPanelEl.classList.remove('open');
  });

  // Publish mode toggle
  genPublishBarEl?.querySelectorAll('[data-gen-pub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      genPublishNow = btn.dataset.genPub === 'true';
      genPublishBarEl.querySelectorAll('[data-gen-pub]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
    });
  });

  // Reset all matrix counts to 0
  root.querySelector('#qb-gen-reset-btn')?.addEventListener('click', () => {
    genActivePreset = null;
    const rows = buildMatrixStats(currentQuestions, genLevelMode);
    genMatrix = {};
    rows.forEach((r) => {
      genMatrix[r.topic] = { mcq: 0, tf4: 0, short: 0 };
    });
    genMatrixInitialized = true;
    generatedItems = [];
    genPreviewEl.classList.remove('open');
    renderGeneratorSlots();
  });

  // Level ratio inputs
  genRatioBarEl?.querySelectorAll('[data-ratio-lv]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const lv = inp.dataset.ratioLv;
      genLevelRatio[lv] = Math.max(0, Math.min(100, Number(inp.value) || 0));
      const totalPct = GEN_LEVELS.reduce((sum, k) => sum + (Number(genLevelRatio[k]) || 0), 0);
      if (genRatioNoteEl) {
        genRatioNoteEl.textContent = totalPct === 100
          ? 'Tổng tỉ lệ: 100%'
          : `Tổng tỉ lệ: ${totalPct}% (tự quy đổi chuẩn hóa)`;
      }
    });
  });

  root.querySelector('#qb-pick-random-btn')?.addEventListener('click', () => pickGeneratedQuestions(false));
  root.querySelector('#qb-reshuffle-btn')?.addEventListener('click', () => pickGeneratedQuestions(true));

  root.querySelector('#qb-copy-latex-btn')?.addEventListener('click', async () => {
    if (!generatedItems.length) return;
    const title = genTitleInput?.value || `Đề luyện tập (${generatedItems.length} câu)`;
    const tex = exportQuestionsToLatex(title, generatedItems);
    try {
      await navigator.clipboard.writeText(tex);
      toast(`Đã sao chép mã LaTeX của ${generatedItems.length} câu!`, 'success');
    } catch {
      toast('Trình duyệt không cho phép truy cập clipboard tự động.', 'error');
    }
  });

  root.querySelector('#qb-edit-generated-btn')?.addEventListener('click', () => {
    if (!generatedItems.length) return;
    sendQuestionsToAssignmentEditor(generatedItems);
  });

  root.querySelector('#qb-save-generated-btn')?.addEventListener('click', async (e) => {
    if (!generatedItems.length) return;
    const cfg = getGeneratorConfig();
    const title = cfg.title || `Đề luyện tập (${generatedItems.length} câu)`;
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await saveQuestionsAsAssignment(title, generatedItems);
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });

  // Manual selection actions
  root.querySelector('#qb-clear-sel-btn')?.addEventListener('click', () => {
    selectedIds.clear();
    syncSelectionBar();
    renderQuestionsList();
  });
  root.querySelector('#qb-create-from-sel-btn')?.addEventListener('click', () => {
    const selected = currentQuestions.filter((q) => selectedIds.has(q.id));
    if (!selected.length) return;
    sendQuestionsToAssignmentEditor(selected, {
      title: (genTitleInput?.value || '').trim() || `Đề kiểm tra (${selected.length} câu)`,
    });
  });

  // Search debounce
  let searchTimer;
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = e.target.value;
      currentPage = 1;
      renderQuestionsList();
    }, 220);
  });

  // ── LaTeX Composer Modal (EX_TEST) ──
  const qbLatexModal = root.querySelector('#qb-latex-modal');
  const qbLatexCodeInput = root.querySelector('#qb-latex-code-input');
  const qbLatexPreviewPane = root.querySelector('#qb-latex-preview-pane');
  const qbLatexPreviewList = root.querySelector('#qb-latex-preview-list');
  const qbPreviewCountBadge = root.querySelector('#qb-preview-count-badge');
  const qbLatexCountText = root.querySelector('#qb-latex-count-text');
  const qbLatexTagInput = root.querySelector('#qb-latex-tag-input');
  const qbTexFileInput = root.querySelector('#qb-latex-tex-file');
  const qbImgFileInput = root.querySelector('#qb-latex-img-file');
  const qbImgStatus = root.querySelector('#qb-latex-img-status');
  const qbSaveBankBtn = root.querySelector('#qb-latex-save-bank-btn');
  let qbCm = null;
  let qbDebounce = null;

  const defaultLatexSample = `\\begin{ex}
(Ví dụ) Cho hàm số $y = x^3 - 3x + 2$. Hàm số đồng biến trên khoảng nào?
\\choice
{$(-1; 1)$}
{$(-\\infty; 1)$}
{$(-1; +\\infty)$}
{\\True $(1; +\\infty)$}
\\loigiai{
\\textbf{Chọn D.} $y' = 3x^2 - 3 > 0 \\Leftrightarrow x \\in (-\\infty; -1) \\cup (1; +\\infty)$.
}
\\end{ex}`;

  function updateQbLatexPreview(showToast = false) {
    const text = qbCm ? qbCm.getValue() : (qbLatexCodeInput?.value || '');
    const parsed = parseLatexAssignment(text);
    if (qbPreviewCountBadge) qbPreviewCountBadge.textContent = `${parsed.length} câu hỏi`;
    if (qbLatexCountText) qbLatexCountText.textContent = `${parsed.length} câu hỏi`;
    if (!parsed.length) {
      qbLatexPreviewList.innerHTML = `<div class="qb-empty">Chưa nhận diện được câu hỏi dạng <code>\\begin{ex}...\\end{ex}</code>.</div>`;
      return false;
    }
    qbLatexPreviewList.innerHTML = parsed.map((q, idx) => renderBankLatexPreviewCard(q, idx, parsed)).join('');
    typeset(qbLatexPreviewList);
    if (showToast) toast(`Đã nhận diện ${parsed.length} câu hỏi.`, 'success');
    return true;
  }

  function initQbCodeMirror() {
    if (!qbCm && window.CodeMirror && qbLatexCodeInput) {
      if (!qbLatexCodeInput.value.trim()) qbLatexCodeInput.value = defaultLatexSample;
      qbCm = window.CodeMirror.fromTextArea(qbLatexCodeInput, {
        lineNumbers: true,
        mode: 'stex',
        lineWrapping: true,
        theme: 'default',
      });
      qbCm.on('change', () => {
        clearTimeout(qbDebounce);
        qbDebounce = setTimeout(() => updateQbLatexPreview(false), 300);
      });
    } else if (!qbCm && qbLatexCodeInput && !qbLatexCodeInput.value.trim()) {
      qbLatexCodeInput.value = defaultLatexSample;
    }
    setTimeout(() => {
      qbCm?.refresh();
      updateQbLatexPreview(false);
    }, 50);
  }

  const closeQbModal = () => { qbLatexModal.style.display = 'none'; };
  root.querySelector('#qb-open-latex-modal-btn')?.addEventListener('click', () => {
    qbLatexModal.style.display = 'flex';
    initQbCodeMirror();
  });
  root.querySelector('#qb-latex-close-btn')?.addEventListener('click', closeQbModal);
  root.querySelector('#qb-latex-cancel-btn')?.addEventListener('click', closeQbModal);
  root.querySelector('#qb-latex-refresh-preview-btn')?.addEventListener('click', () => updateQbLatexPreview(true));

  root.querySelector('#qb-latex-upload-tex-btn')?.addEventListener('click', () => qbTexFileInput?.click());
  qbTexFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (qbCm) qbCm.setValue(text);
      else qbLatexCodeInput.value = text;
      updateQbLatexPreview(true);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      qbTexFileInput.value = '';
    }
  });

  root.querySelector('#qb-latex-insert-img-btn')?.addEventListener('click', () => qbImgFileInput?.click());
  qbImgFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (qbImgStatus) qbImgStatus.style.display = 'inline';
    try {
      const url = await uploadAssignmentImage(file);
      const insertText = `\n![image](${url})\n`;
      if (qbCm) qbCm.getDoc().replaceRange(insertText, qbCm.getDoc().getCursor());
      else qbLatexCodeInput.value += insertText;
      updateQbLatexPreview(false);
      toast('Đã chèn ảnh.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      if (qbImgStatus) qbImgStatus.style.display = 'none';
      qbImgFileInput.value = '';
    }
  });

  qbSaveBankBtn?.addEventListener('click', async () => {
    const text = qbCm ? qbCm.getValue() : (qbLatexCodeInput?.value || '');
    const questions = parseLatexAssignment(text);
    if (!questions.length) {
      toast('Không tìm thấy câu hỏi \\begin{ex}...\\end{ex}.', 'error');
      return;
    }
    const tags = (qbLatexTagInput?.value || '').split(',').map((t) => t.trim()).filter(Boolean);
    qbSaveBankBtn.disabled = true;
    qbSaveBankBtn.textContent = `Đang lưu ${questions.length} câu...`;
    try {
      const formatted = questions.map((q, idx) => ({
        type: q.type,
        prompt: q.prompt,
        points: q.points || 1,
        sort_order: idx + 1,
        choices: q.choices,
        settings: q.settings || {},
        correct_answer: q.answer_key?.correct_answer ?? 'A',
        answer_key: q.answer_key,
        tags: tags.length ? tags : ['Chung'],
      }));
      await batchInsertBankQuestions(formatted);
      toast(`Đã lưu ${questions.length} câu hỏi vào Ngân hàng!`, 'success');
      closeQbModal();
      await loadQuestions();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      qbSaveBankBtn.disabled = false;
      qbSaveBankBtn.textContent = 'Lưu vào Ngân hàng';
    }
  });

  loadQuestions();
}
