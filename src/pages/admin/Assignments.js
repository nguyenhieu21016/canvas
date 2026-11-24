import { state, pageRoot } from '../../store.js';
import { wireRouteRetry, registerCleanup, go, route } from '../../router.js';
import { toast, renderSkeletonAssignments, renderErrorState } from '../../lib/ui.js';
import { escapeHtml, renderLatexText, option, setButtonLoading } from '../../lib/html.js';
import { toDrivePreviewUrl } from '../../lib/drive.js';
import {
  normalizeAssignmentEditor,
  parseLatexAssignment,
  applyCategoryToTitle,
  extractCategoryFromTitle,
} from '../../lib/assignment.js';
import { saveEditorDraft, loadEditorDraft, clearEditorDraft } from '../../lib/draft.js';
import { exportQuestionsToLatex } from '../../lib/examGenerator.js';
import {
  fetchLearningPath,
  fetchAssignmentsForManager,
  fetchAssignmentEditor,
  saveAssignmentWithQuestions,
  regradeAssignment,
  deleteAssignment,
  uploadAssignmentImage,
} from '../../services/lmsApi.js';

const ASG_ICONS = {
  plus: `<svg class="lucide lucide-plus" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
  arrowLeft: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  sliders: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></svg>`,
  check: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
  listTree: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12h-8"/><path d="M21 6H8"/><path d="M21 18h-8"/><path d="M3 6v4c0 1.1.9 2 2 2h3"/><path d="M3 10v6c0 1.1.9 2 2 2h3"/></svg>`,
  eye: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>`,
  code2: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>`,
  imagePlus: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 5h6"/><path d="M19 2v6"/><path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/><circle cx="9" cy="9" r="2"/></svg>`,
  refreshCw: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`,
  sparkles: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`,
  chevronDown: `<svg class="lucide lucide-chevron-down nh-asg-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`,
  chevronLeft: `<svg class="lucide lucide-chevron-left" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>`,
  chevronRight: `<svg class="lucide lucide-chevron-right" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`,
  squarePen: `<svg class="lucide lucide-square-pen" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/></svg>`,
  trash2: `<svg class="lucide lucide-trash-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`,
};

function formatShortDate(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{2}\/\d{2}$/.test(value.trim())) return value.trim();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

export function normalizeAssignmentListItem(assignment, pathAssignmentsMap = new Map()) {
  const rawTitle = String(assignment?.title ?? '').trim();
  const lectureTitle = assignment?.lectures?.title ? String(assignment.lectures.title).trim() : '';
  const kind = assignment?.lecture_id || lectureTitle ? 'lecture' : 'free';
  const bracketMatch = rawTitle.match(/^\[([^\]]+)\]\s*(.*)$/);

  let badge = '';
  let cleanTitle = rawTitle;
  let badgeTone = 'neutral';
  let topicLabel = '';

  if (bracketMatch) {
    badge = bracketMatch[1].trim();
    cleanTitle = bracketMatch[2].trim() || rawTitle;
    badgeTone = /ôn thi|giữa kì|cuối kì|thi thử/i.test(badge) ? 'warning' : 'primary';
    topicLabel = badge;
  } else {
    cleanTitle = rawTitle;
    badge = kind === 'lecture' ? 'Bài giảng' : 'Tự do';
    badgeTone = 'neutral';
    const combinedText = `${rawTitle} ${lectureTitle}`;
    if (/khảo sát|đạo hàm|cực trị|tiệm cận|đồng biến/i.test(combinedText)) {
      topicLabel = 'Khảo sát hàm số';
    } else if (/vectơ|tọa độ|không gian/i.test(combinedText)) {
      topicLabel = 'Vectơ không gian';
    } else if (/nguyên hàm|tích phân/i.test(combinedText)) {
      topicLabel = 'Nguyên hàm & Tích phân';
    } else if (/xác suất|thống kê/i.test(combinedText)) {
      topicLabel = 'Xác suất & Thống kê';
    } else {
      topicLabel = badge;
    }
  }

  const fromPath = pathAssignmentsMap.get(assignment?.id);
  let questionsCount = Number(
    assignment?.questions_count ?? fromPath?.questions_count ?? NaN,
  );
  if (!Number.isFinite(questionsCount)) {
    const desc = String(assignment?.description ?? '');
    questionsCount = (desc.match(/\\begin\{ex\}/g) || []).length;
  }

  const format = !assignment?.pdf_url || assignment.pdf_url === 'latex' ? 'LaTeX' : 'PDF';
  const updated = formatShortDate(assignment?.updated || assignment?.updated_at || assignment?.created_at);

  return {
    id: assignment?.id,
    rawTitle,
    cleanTitle,
    badge,
    badgeTone,
    topicLabel,
    kind,
    lectureLabel: lectureTitle || 'Bài tập tự do',
    questionsCount,
    format,
    updated,
  };
}

const ASG_STYLES = `
  <style>
    .nh-asg-page {
      min-height: calc(100vh - 110px);
      background: #F7F7F2;
      padding-bottom: 56px;
      font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif;
      color: #181B16;
    }

    .nh-asg-wrap {
      max-width: 920px;
      width: 100%;
      margin: 0 auto;
      padding: 28px 20px 0;
      display: flex;
      flex-direction: column;
      gap: 20px;
      box-sizing: border-box;
    }

    .nh-asg-hero-meta {
      margin: 6px 0 0;
      font-size: 13.5px;
      line-height: 1.4;
      color: rgba(247, 247, 242, 0.7);
      font-variant-numeric: tabular-nums;
    }

    .nh-asg-create-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
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
      flex-shrink: 0;
      outline: none;
      transition: background-color 0.15s ease;
    }

    .nh-asg-create-btn:hover {
      background: #EBEDE6;
    }

    .nh-asg-create-btn--dark {
      background: #181B16;
      color: #F7F7F2;
    }

    .nh-asg-create-btn--dark:hover {
      background: #2C3028;
    }

    .nh-asg-toolbar {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .nh-asg-toolbar-top {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    @media (min-width: 640px) {
      .nh-asg-toolbar-top {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
    }

    .nh-asg-tabs {
      display: none;
      align-items: center;
      gap: 6px;
    }

    @media (min-width: 640px) {
      .nh-asg-tabs {
        display: flex;
      }
    }

    .nh-asg-tab {
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
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      outline: none;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .nh-asg-tab:hover {
      background: #E2E5DC;
    }

    .nh-asg-tab[aria-selected="true"] {
      background: #181B16;
      color: #F7F7F2;
    }

    .nh-asg-tab-count {
      font-size: 12px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: #64695F;
    }

    .nh-asg-tab[aria-selected="true"] .nh-asg-tab-count {
      color: rgba(247, 247, 242, 0.72);
    }

    .nh-asg-mobile-opt .nh-asg-tab-count {
      font-weight: inherit;
      color: #64695F;
    }

    .nh-asg-mobile-kind {
      position: relative;
      display: block;
    }

    @media (min-width: 640px) {
      .nh-asg-mobile-kind {
        display: none;
      }
    }

    .nh-asg-mobile-kind > summary {
      list-style: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 40px;
      width: fit-content;
      padding: 0 16px;
      border-radius: 9999px;
      border: 0;
      background: #EBEDE6;
      color: #181B16;
      font-size: 14px;
      cursor: pointer;
      outline: none;
      transition: background-color 0.15s ease;
    }

    .nh-asg-mobile-kind > summary::-webkit-details-marker {
      display: none;
    }

    .nh-asg-mobile-kind > summary:hover {
      background: #E2E5DC;
    }

    .nh-asg-mobile-kind .nh-asg-chevron {
      color: #64695F;
      transition: transform 0.15s ease;
    }

    .nh-asg-mobile-kind[open] .nh-asg-chevron {
      transform: rotate(180deg);
    }

    .nh-asg-mobile-kind-label {
      color: #64695F;
    }

    .nh-asg-mobile-kind-val {
      font-weight: 600;
    }

    .nh-asg-mobile-popover {
      position: absolute;
      left: 0;
      top: calc(100% + 6px);
      z-index: 30;
      min-width: 210px;
      border-radius: 16px;
      border: 1px solid #E4E6DE;
      background: #FFFFFF;
      padding: 6px;
      box-shadow: 0 12px 28px rgba(24, 27, 22, 0.08);
      display: grid;
      gap: 4px;
    }

    .nh-asg-mobile-opt {
      display: flex;
      width: 100%;
      height: 36px;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: #64695F;
      font-family: inherit;
      font-size: 14px;
      cursor: pointer;
      outline: none;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .nh-asg-mobile-opt:hover {
      background: #EBEDE6;
      color: #181B16;
    }

    .nh-asg-mobile-opt[data-active="true"] {
      background: #EBEDE6;
      font-weight: 600;
      color: #181B16;
    }

    .nh-asg-search-wrap {
      position: relative;
      width: 100%;
      flex-shrink: 0;
    }

    @media (min-width: 640px) {
      .nh-asg-search-wrap {
        width: auto;
        flex: 0 1 280px;
        min-width: 180px;
      }
    }

    .nh-asg-search-input {
      width: 100%;
      height: 40px;
      box-sizing: border-box;
      padding: 0 16px;
      border-radius: 9999px;
      border: 1px solid transparent;
      background: #EBEDE6;
      font-family: inherit;
      font-size: 16px;
      color: #181B16;
      outline: none;
      transition: background-color 0.15s ease, border-color 0.15s ease;
    }

    @media (min-width: 768px) {
      .nh-asg-search-input {
        font-size: 14px;
      }
    }

    .nh-asg-search-input::placeholder {
      color: #64695F;
    }

    .nh-asg-search-input:focus {
      background: #FFFFFF;
      border-color: #181B16;
    }

    .nh-asg-topics-outer {
      position: relative;
      min-width: 0;
    }

    .nh-asg-topics-scroller {
      overflow-x: auto;
      padding: 2px 0;
    }

    .nh-asg-topics-track {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-right: 4px;
    }

    .nh-asg-topic-chip {
      display: inline-flex;
      height: 32px;
      flex-shrink: 0;
      align-items: center;
      gap: 6px;
      padding: 0 13px;
      border: 1px solid #E4E6DE;
      border-radius: 9999px;
      background: #FFFFFF;
      color: #64695F;
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 500;
      cursor: pointer;
      outline: none;
      transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    }

    .nh-asg-topic-chip:hover {
      background: #EBEDE6;
      border-color: #EBEDE6;
      color: #181B16;
    }

    .nh-asg-topic-chip[aria-pressed="true"] {
      background: #EBEDE6;
      border-color: #D3D7CB;
      color: #181B16;
      font-weight: 600;
    }

    .nh-asg-topic-chip-count {
      font-size: 11.5px;
      font-weight: 500;
      color: #8A8F84;
      font-variant-numeric: tabular-nums;
    }

    .nh-asg-topic-chip[aria-pressed="true"] .nh-asg-topic-chip-count {
      color: #64695F;
    }

    .nh-asg-topic-arrow-wrap {
      pointer-events: none;
      position: absolute;
      top: 0;
      bottom: 0;
      display: none;
      align-items: center;
    }

    .nh-asg-topic-arrow-wrap--left { left: 0; }
    .nh-asg-topic-arrow-wrap--right { right: 0; }

    @media (any-pointer: fine) {
      .nh-asg-topic-arrow-wrap {
        display: flex;
      }
    }

    .nh-asg-topic-arrow-btn {
      pointer-events: auto;
      display: inline-flex;
      width: 32px;
      height: 32px;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
      border: 1px solid #E4E6DE;
      background: #FFFFFF;
      color: #181B16;
      cursor: pointer;
      outline: none;
      transition: background-color 0.15s ease;
    }

    .nh-asg-topic-arrow-btn:hover {
      background: #EBEDE6;
    }

    .nh-asg-card {
      border-radius: 20px;
      border: 1px solid #E4E6DE;
      background: #FFFFFF;
      overflow: hidden;
    }

    .nh-asg-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .nh-asg-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: background-color 0.14s ease;
    }

    .nh-asg-row:hover {
      background: #F7F7F2;
    }

    .nh-asg-row + .nh-asg-row {
      border-top: 1px solid #EFEFE9;
    }

    .nh-asg-row-link {
      min-width: 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 5px;
      padding: 15px 16px;
      text-decoration: none;
      color: #181B16;
      outline: none;
    }

    @media (min-width: 640px) {
      .nh-asg-row-link {
        padding: 15px 20px;
      }
    }

    .nh-asg-row-title {
      display: block;
      min-width: 0;
      font-size: 14.5px;
      font-weight: 600;
      line-height: 1.4;
      color: #181B16;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .nh-asg-row-meta {
      display: flex;
      min-width: 0;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      line-height: 1.4;
      color: #64695F;
    }

    .nh-asg-badge {
      flex-shrink: 0;
      border-radius: 9999px;
      padding: 2px 9px;
      font-size: 11.5px;
      font-weight: 500;
      line-height: 1.35;
    }

    .nh-asg-badge--warning {
      background: #EBEDE6;
      color: #181B16;
      font-weight: 600;
    }

    .nh-asg-badge--primary {
      background: #EBEDE6;
      color: #181B16;
    }

    .nh-asg-badge--neutral {
      background: #F2F3EE;
      color: #64695F;
    }

    .nh-asg-row-sub {
      min-width: 0;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .nh-asg-row-right {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      gap: 10px;
      padding-right: 12px;
    }

    @media (min-width: 640px) {
      .nh-asg-row-right {
        padding-right: 20px;
      }
    }

    .nh-asg-row-count {
      font-size: 12px;
      font-weight: 400;
      font-variant-numeric: tabular-nums;
      color: #64695F;
      white-space: nowrap;
    }

    .nh-asg-row-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .nh-asg-icon-btn {
      display: inline-flex;
      width: 32px;
      height: 32px;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 9999px;
      background: transparent;
      color: #64695F;
      cursor: pointer;
      outline: none;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .nh-asg-icon-btn:hover,
    .nh-asg-icon-btn:focus-visible {
      background: #EBEDE6;
      color: #181B16;
    }

    .nh-asg-icon-btn--danger:hover,
    .nh-asg-icon-btn--danger:focus-visible {
      background: #F8EAE8;
      color: #B8433A;
    }

    .nh-asg-mobile-only { display: inline; }
    .nh-asg-desktop-only { display: none; }

    @media (min-width: 640px) {
      .nh-asg-mobile-only { display: none; }
      .nh-asg-desktop-only { display: inline; }
    }

    .nh-asg-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border-top: 1px solid #E4E6DE;
      padding: 12px 16px;
    }

    @media (min-width: 640px) {
      .nh-asg-pagination {
        padding: 12px 20px;
      }
    }

    .nh-asg-page-info {
      margin: 0;
      font-size: 13px;
      font-variant-numeric: tabular-nums;
      color: #64695F;
    }

    .nh-asg-page-nav {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      gap: 4px;
    }

    .nh-asg-page-btn {
      display: inline-flex;
      min-width: 32px;
      height: 32px;
      padding: 0 8px;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 9999px;
      background: transparent;
      color: #64695F;
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      cursor: pointer;
      outline: none;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .nh-asg-page-btn:hover:not(:disabled) {
      background: #EBEDE6;
      color: #181B16;
    }

    .nh-asg-page-btn[aria-current="page"] {
      background: #181B16;
      color: #F7F7F2;
    }

    .nh-asg-page-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      color: #64695F;
    }

    .nh-asg-page-num { display: none; }
    .nh-asg-page-mobile-label {
      padding: 0 6px;
      font-size: 13px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: #181B16;
    }

    @media (min-width: 640px) {
      .nh-asg-page-num { display: inline-flex; }
      .nh-asg-page-mobile-label { display: none; }
    }

    .nh-asg-empty {
      padding: 40px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .nh-asg-empty-title {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #181B16;
    }

    .nh-asg-empty-sub {
      margin: 0;
      font-size: 13px;
      color: #64695F;
    }

    .nh-asg-reset-btn {
      display: inline-flex;
      height: 36px;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
      border-radius: 9999px;
      border: 0;
      background: #EBEDE6;
      color: #181B16;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      outline: none;
      transition: background-color 0.15s ease;
    }

    .nh-asg-reset-btn:hover {
      background: #E2E5DC;
    }
  </style>
`;

export function renderAssignmentsListView(root, assignments = [], path = { lectures: [], assignments: [] }, options = {}) {
  const pathAssignmentsMap = new Map((path?.assignments ?? []).map((a) => [a.id, a]));
  const items = assignments.map((a) => normalizeAssignmentListItem(a, pathAssignmentsMap));

  const actualTotal = items.length;
  const actualLecture = items.filter((i) => i.kind === 'lecture').length;
  const actualFree = items.filter((i) => i.kind === 'free').length;

  const totalCount = options.totalOverride ?? actualTotal;
  const lectureCount = options.lectureOverride ?? actualLecture;
  const freeCount = options.freeOverride ?? actualFree;

  const topicCountMap = new Map();
  items.forEach((item) => {
    if (!item.topicLabel) return;
    topicCountMap.set(item.topicLabel, (topicCountMap.get(item.topicLabel) || 0) + 1);
  });

  const topicDefs = [{ id: 'all', name: 'Tất cả chủ đề', count: totalCount }];
  if (options.topicCountsOverride) {
    Object.entries(options.topicCountsOverride).forEach(([name, cnt]) => {
      topicDefs.push({ id: name, name, count: cnt });
    });
  } else {
    Array.from(topicCountMap.entries()).forEach(([name, cnt]) => {
      topicDefs.push({ id: name, name, count: cnt });
    });
  }

  const pageSize = options.pageSize ?? 8;
  const filterState = {
    kind: 'all',
    topic: 'all',
    q: '',
    page: 1,
  };

  if (!items.length) {
    root.innerHTML = `
      ${ASG_STYLES}
      <section class="nh-asg-page">
        <div class="nh-asg-wrap">
          <header class="asg-overview-hero">
            <a href="#/manage" class="phase-back-link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>Trung tâm Quản trị</span>
            </a>
            <div class="asg-overview-hero-row">
              <div class="asg-overview-hero-left">
                <h1 class="phase-hero-title">Đề thi &amp; Bài tập</h1>
              </div>
              <button type="button" id="new-assignment" class="nh-asg-create-btn">
                ${ASG_ICONS.plus}
                <span>Tạo đề mới</span>
              </button>
            </div>
          </header>
          <section class="nh-asg-card">
            <div class="nh-asg-empty" style="padding: 48px 24px;">
              <p class="nh-asg-empty-title" style="font-size: 16px; font-weight: 600;">Chưa có đề thi hoặc bài tập nào</p>
            </div>
          </section>
        </div>
      </section>
    `;

    root.querySelector('#new-assignment')?.addEventListener('click', () => {
      options.onCreate?.();
    });
    return () => { };
  }

  const tabDefs = [
    { id: 'all', label: 'Tất cả', count: totalCount },
    { id: 'lecture', label: 'Theo bài giảng', count: lectureCount },
    { id: 'free', label: 'Bài tập tự do', count: freeCount },
  ];
  const kindLabelMap = {
    all: `Tất cả - ${totalCount}`,
    lecture: `Theo bài giảng - ${lectureCount}`,
    free: `Bài tập tự do - ${freeCount}`,
  };

  root.innerHTML = `
    ${ASG_STYLES}
    <section class="nh-asg-page">
      <div class="nh-asg-wrap">
        <header class="asg-overview-hero">
          <a href="#/manage" class="phase-back-link">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            <span>Trung tâm Quản trị</span>
          </a>
          <div class="asg-overview-hero-row">
            <div class="asg-overview-hero-left">
              <h1 class="phase-hero-title">Đề thi &amp; Bài tập</h1>
            </div>
            <button type="button" id="new-assignment" class="nh-asg-create-btn">
              ${ASG_ICONS.plus}
              <span>Tạo đề mới</span>
            </button>
          </div>
        </header>

        <div class="nh-asg-toolbar">
          <div class="nh-asg-toolbar-top">
            <div role="tablist" aria-label="Loại đề thi" class="nh-asg-tabs" id="nh-asg-tabs">
              ${tabDefs.map((tab) => `
                <button
                  type="button"
                  role="tab"
                  aria-selected="${filterState.kind === tab.id ? 'true' : 'false'}"
                  tabindex="${filterState.kind === tab.id ? '0' : '-1'}"
                  data-asg-kind="${tab.id}"
                  class="nh-asg-tab"
                >
                  <span>${escapeHtml(tab.label)}</span>
                  <span class="nh-asg-tab-count">${tab.count}</span>
                </button>
              `).join('')}
            </div>

            <details class="nh-asg-mobile-kind" id="nh-asg-mobile-kind">
              <summary>
                <span class="nh-asg-mobile-kind-label">Loại đề:</span>
                <span class="nh-asg-mobile-kind-val" id="nh-asg-mobile-kind-val">${escapeHtml(kindLabelMap.all)}</span>
                ${ASG_ICONS.chevronDown}
              </summary>
              <div class="nh-asg-mobile-popover">
                ${tabDefs.map((tab) => `
                  <button
                    type="button"
                    data-asg-kind="${tab.id}"
                    data-active="${filterState.kind === tab.id ? 'true' : 'false'}"
                    class="nh-asg-mobile-opt"
                  >
                    <span>${escapeHtml(tab.label)}</span>
                    <span class="nh-asg-tab-count">${tab.count}</span>
                  </button>
                `).join('')}
              </div>
            </details>

            <div class="nh-asg-search-wrap">
              <input
                type="search"
                id="assignment-search"
                placeholder="Tìm tên đề hoặc bài giảng..."
                class="nh-asg-search-input"
              />
            </div>
          </div>

          <div class="nh-asg-topics-outer" id="nh-asg-topics-outer">
            <div id="nh-asg-topic-scroller" class="scrollbar-clean nh-asg-topics-scroller">
              <div class="nh-asg-topics-track" id="nh-asg-topics-track">
                ${topicDefs.map((t) => `
                  <button
                    type="button"
                    aria-pressed="${filterState.topic === t.id ? 'true' : 'false'}"
                    data-asg-topic="${escapeHtml(t.id)}"
                    class="nh-asg-topic-chip"
                  >
                    <span>${escapeHtml(t.name)}</span>
                    <span class="nh-asg-topic-chip-count">${t.count}</span>
                  </button>
                `).join('')}
              </div>
            </div>
            <div id="nh-asg-topic-prev" style="display:none" class="nh-asg-topic-arrow-wrap nh-asg-topic-arrow-wrap--left">
              <button type="button" aria-label="Cuộn sang trái" data-asg-topic-scroll="-1" class="nh-asg-topic-arrow-btn">
                ${ASG_ICONS.chevronLeft}
              </button>
            </div>
            <div id="nh-asg-topic-next" style="display:none" class="nh-asg-topic-arrow-wrap nh-asg-topic-arrow-wrap--right">
              <button type="button" aria-label="Cuộn sang phải" data-asg-topic-scroll="1" class="nh-asg-topic-arrow-btn">
                ${ASG_ICONS.chevronRight}
              </button>
            </div>
          </div>
        </div>

        <section aria-label="Danh sách đề thi" class="nh-asg-card">
          <div id="assignment-list-container"></div>
          <div id="nh-asg-pagination-wrap"></div>
        </section>
      </div>
    </section>
  `;

  function getFilteredItems() {
    const q = filterState.q.trim().toLowerCase();
    return items.filter((item) => {
      if (filterState.kind !== 'all' && item.kind !== filterState.kind) return false;
      if (filterState.topic !== 'all' && item.topicLabel !== filterState.topic) return false;
      if (!q) return true;
      return (
        item.cleanTitle.toLowerCase().includes(q) ||
        item.rawTitle.toLowerCase().includes(q) ||
        item.badge.toLowerCase().includes(q) ||
        item.lectureLabel.toLowerCase().includes(q)
      );
    });
  }

  function renderRowsAndPagination() {
    const listContainer = root.querySelector('#assignment-list-container');
    const paginationWrap = root.querySelector('#nh-asg-pagination-wrap');
    if (!listContainer || !paginationWrap) return;

    const filtered = getFilteredItems();
    const isUnfilteredWithOverride =
      Boolean(options.totalOverride) &&
      filterState.kind === 'all' &&
      filterState.topic === 'all' &&
      !filterState.q.trim();

    const displayTotal = isUnfilteredWithOverride ? options.totalOverride : filtered.length;
    const totalPages = Math.max(1, Math.ceil(displayTotal / pageSize));
    if (filterState.page > totalPages) filterState.page = totalPages;

    const startIdx = (filterState.page - 1) * pageSize;
    const pageItems = filtered.slice(startIdx, startIdx + pageSize);

    if (!filtered.length) {
      listContainer.innerHTML = `
        <div class="nh-asg-empty">
          <p class="nh-asg-empty-title">Không tìm thấy đề thi phù hợp</p>
          <button type="button" data-asg-reset-filter class="nh-asg-reset-btn">
            Xoá bộ lọc
          </button>
        </div>
      `;
      paginationWrap.innerHTML = '';
      return;
    }

    listContainer.innerHTML = `
      <ul class="nh-asg-list">
        ${pageItems.map((item) => `
          <li class="nh-asg-row">
            <a
              href="#/assignments"
              data-load-assignment="${escapeHtml(item.id)}"
              title="${escapeHtml(item.cleanTitle)}"
              class="nh-asg-row-link"
            >
              <span class="nh-asg-row-title">${escapeHtml(item.cleanTitle)}</span>
              <div class="nh-asg-row-meta">
                <span class="nh-asg-badge nh-asg-badge--${item.badgeTone}">${escapeHtml(item.badge)}</span>
                <span class="nh-asg-row-sub">
                  ${escapeHtml(item.lectureLabel)}<span class="nh-asg-mobile-only"> - ${item.questionsCount} câu - ${item.format}</span>${item.updated ? `<span class="nh-asg-desktop-only"> - Cập nhật ${escapeHtml(item.updated)}</span>` : ''}
                </span>
              </div>
            </a>
            <div class="nh-asg-row-right">
              <span class="nh-asg-row-count nh-asg-desktop-only">${item.questionsCount} câu - ${item.format}</span>
              <div class="nh-asg-row-actions">
                <button
                  type="button"
                  data-load-assignment="${escapeHtml(item.id)}"
                  title="Chỉnh sửa đề"
                  aria-label="Chỉnh sửa ${escapeHtml(item.cleanTitle)}"
                  class="nh-asg-icon-btn"
                >
                  ${ASG_ICONS.squarePen}
                </button>
                <button
                  type="button"
                  data-delete-assignment="${escapeHtml(item.id)}"
                  title="Xóa đề"
                  aria-label="Xóa ${escapeHtml(item.cleanTitle)}"
                  class="nh-asg-icon-btn nh-asg-icon-btn--danger"
                >
                  ${ASG_ICONS.trash2}
                </button>
              </div>
            </div>
          </li>
        `).join('')}
      </ul>
    `;

    const fromNum = startIdx + 1;
    const toNum = startIdx + pageItems.length;

    if (totalPages <= 1) {
      paginationWrap.innerHTML = `
        <div class="nh-asg-pagination">
          <p class="nh-asg-page-info">${displayTotal} đề thi</p>
        </div>
      `;
    } else {
      const pageNumbers = Array.from({ length: totalPages }, (_, idx) => idx + 1);
      paginationWrap.innerHTML = `
        <div class="nh-asg-pagination">
          <p class="nh-asg-page-info">
            <span class="nh-asg-desktop-only">${fromNum} tới ${toNum} trong </span>${displayTotal} đề thi
          </p>
          <nav aria-label="Phân trang" class="nh-asg-page-nav">
            <button
              type="button"
              ${filterState.page <= 1 ? 'disabled' : ''}
              data-asg-page="${filterState.page - 1}"
              aria-label="Trang trước"
              class="nh-asg-page-btn"
            >
              ${ASG_ICONS.chevronLeft}
            </button>
            ${pageNumbers.map((num) => `
              <button
                type="button"
                data-asg-page="${num}"
                ${num === filterState.page ? 'aria-current="page"' : ''}
                class="nh-asg-page-btn nh-asg-page-num"
              >${num}</button>
            `).join('')}
            <span class="nh-asg-page-mobile-label">${filterState.page} / ${totalPages}</span>
            <button
              type="button"
              ${filterState.page >= totalPages ? 'disabled' : ''}
              data-asg-page="${filterState.page + 1}"
              aria-label="Trang sau"
              class="nh-asg-page-btn"
            >
              ${ASG_ICONS.chevronRight}
            </button>
          </nav>
        </div>
      `;
    }
  }

  function syncFilterControls() {
    root.querySelectorAll('#nh-asg-tabs [data-asg-kind]').forEach((tabBtn) => {
      const active = tabBtn.dataset.asgKind === filterState.kind;
      tabBtn.setAttribute('aria-selected', active ? 'true' : 'false');
      tabBtn.setAttribute('tabindex', active ? '0' : '-1');
    });
    const mobileVal = root.querySelector('#nh-asg-mobile-kind-val');
    if (mobileVal) mobileVal.textContent = kindLabelMap[filterState.kind] || kindLabelMap.all;
    root.querySelectorAll('#nh-asg-mobile-kind [data-asg-kind]').forEach((optBtn) => {
      optBtn.dataset.active = optBtn.dataset.asgKind === filterState.kind ? 'true' : 'false';
    });
    root.querySelectorAll('[data-asg-topic]').forEach((chip) => {
      chip.setAttribute('aria-pressed', chip.dataset.asgTopic === filterState.topic ? 'true' : 'false');
    });
    const searchEl = root.querySelector('#assignment-search');
    if (searchEl && searchEl.value !== filterState.q) {
      searchEl.value = filterState.q;
    }
  }

  function updateTopicScrollMask() {
    const scroller = root.querySelector('#nh-asg-topic-scroller');
    if (!scroller) return;
    const maxScroll = scroller.scrollWidth - scroller.clientWidth;
    const canLeft = scroller.scrollLeft > 2;
    const canRight = maxScroll > 2 && scroller.scrollLeft < maxScroll - 2;
    let mask = 'none';
    if (canLeft && canRight) {
      mask = 'linear-gradient(to right, transparent, black 32px, black calc(100% - 32px), transparent)';
    } else if (canRight) {
      mask = 'linear-gradient(to right, black 0px, black calc(100% - 32px), transparent)';
    } else if (canLeft) {
      mask = 'linear-gradient(to right, transparent, black 32px, black 100%)';
    }
    scroller.style.webkitMaskImage = mask;
    scroller.style.maskImage = mask;

    const prevBtn = root.querySelector('#nh-asg-topic-prev');
    const nextBtn = root.querySelector('#nh-asg-topic-next');
    if (prevBtn) prevBtn.style.display = canLeft ? '' : 'none';
    if (nextBtn) nextBtn.style.display = canRight ? '' : 'none';
  }

  const pageEl = root.querySelector('.nh-asg-page');
  const mobileDetails = root.querySelector('#nh-asg-mobile-kind');
  const topicScroller = root.querySelector('#nh-asg-topic-scroller');
  const searchInput = root.querySelector('#assignment-search');

  const onPageClick = (event) => {
    const newBtn = event.target.closest('#new-assignment');
    if (newBtn) {
      options.onCreate?.();
      return;
    }

    const kindBtn = event.target.closest('[data-asg-kind]');
    if (kindBtn) {
      filterState.kind = kindBtn.dataset.asgKind;
      filterState.page = 1;
      if (mobileDetails) mobileDetails.open = false;
      syncFilterControls();
      renderRowsAndPagination();
      return;
    }

    const topicBtn = event.target.closest('[data-asg-topic]');
    if (topicBtn) {
      filterState.topic = topicBtn.dataset.asgTopic;
      filterState.page = 1;
      syncFilterControls();
      renderRowsAndPagination();
      return;
    }

    const scrollBtn = event.target.closest('[data-asg-topic-scroll]');
    if (scrollBtn && topicScroller) {
      const dir = Number(scrollBtn.dataset.asgTopicScroll);
      topicScroller.scrollBy({ left: dir * topicScroller.clientWidth * 0.8, behavior: 'smooth' });
      return;
    }

    const resetBtn = event.target.closest('[data-asg-reset-filter]');
    if (resetBtn) {
      filterState.kind = 'all';
      filterState.topic = 'all';
      filterState.q = '';
      filterState.page = 1;
      syncFilterControls();
      renderRowsAndPagination();
      return;
    }

    const pageBtn = event.target.closest('[data-asg-page]');
    if (pageBtn && !pageBtn.disabled) {
      const nextPage = Number(pageBtn.dataset.asgPage);
      if (Number.isFinite(nextPage) && nextPage >= 1) {
        filterState.page = nextPage;
        renderRowsAndPagination();
      }
      return;
    }

    const deleteBtn = event.target.closest('[data-delete-assignment]');
    if (deleteBtn) {
      event.preventDefault();
      event.stopPropagation();
      options.onDelete?.(deleteBtn.dataset.deleteAssignment);
      return;
    }

    const loadEl = event.target.closest('[data-load-assignment]');
    if (loadEl) {
      event.preventDefault();
      options.onOpen?.(loadEl.dataset.loadAssignment);
    }
  };

  const tabsContainer = root.querySelector('#nh-asg-tabs');
  const onTabsKeyDown = (event) => {
    const tabButtons = Array.from(tabsContainer?.querySelectorAll('[role="tab"]') || []);
    if (!tabButtons.length) return;
    const currentIndex = tabButtons.indexOf(document.activeElement);
    if (currentIndex < 0) return;

    let targetIndex = -1;
    if (event.key === 'ArrowRight') targetIndex = (currentIndex + 1) % tabButtons.length;
    else if (event.key === 'ArrowLeft') targetIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;
    else if (event.key === 'Home') targetIndex = 0;
    else if (event.key === 'End') targetIndex = tabButtons.length - 1;

    if (targetIndex >= 0) {
      event.preventDefault();
      const targetTab = tabButtons[targetIndex];
      filterState.kind = targetTab.dataset.asgKind;
      filterState.page = 1;
      syncFilterControls();
      renderRowsAndPagination();
      targetTab.focus();
    }
  };

  const onSearchInput = () => {
    filterState.q = searchInput?.value || '';
    filterState.page = 1;
    renderRowsAndPagination();
  };

  const onDocClick = (event) => {
    if (mobileDetails?.open && !mobileDetails.contains(event.target)) {
      mobileDetails.open = false;
    }
  };

  const onDocKeyDown = (event) => {
    if (event.key === 'Escape' && mobileDetails?.open) {
      mobileDetails.open = false;
    }
  };

  pageEl?.addEventListener('click', onPageClick);
  tabsContainer?.addEventListener('keydown', onTabsKeyDown);
  searchInput?.addEventListener('input', onSearchInput);
  topicScroller?.addEventListener('scroll', updateTopicScrollMask, { passive: true });
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onDocKeyDown);
  window.addEventListener('resize', updateTopicScrollMask);

  renderRowsAndPagination();
  requestAnimationFrame(() => {
    updateTopicScrollMask();
    requestAnimationFrame(updateTopicScrollMask);
  });

  return () => {
    pageEl?.removeEventListener('click', onPageClick);
    tabsContainer?.removeEventListener('keydown', onTabsKeyDown);
    searchInput?.removeEventListener('input', onSearchInput);
    topicScroller?.removeEventListener('scroll', updateTopicScrollMask);
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onDocKeyDown);
    window.removeEventListener('resize', updateTopicScrollMask);
  };
}

export function emptyEditor() {
  return {
    assignment: {
      title: '',
      description: '',
      pdf_url: 'latex',
      lecture_id: '',
      sort_order: 0,
      published: true,
    },
    questions: [],
    latexSource: '',
  };
}

function getEditorStorage() {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

function currentEditorDraftId(editor = state.assignmentEditor) {
  return editor?.assignment?.id || route().id || 'new';
}

function persistCurrentEditorDraft() {
  if (!state.isEditingAssignment || !state.assignmentEditor) return;
  saveEditorDraft(getEditorStorage(), state.profile?.id, currentEditorDraftId(), state.assignmentEditor);
}

export async function mountAssignmentManager(routeId, options = {}) {
  const { skipSkeleton = false } = options;
  const root = pageRoot();
  const resolvedRouteId = routeId !== undefined ? routeId : route().id;
  if (!skipSkeleton) {
    root.innerHTML = renderSkeletonAssignments();
  }
  try {
    const storage = getEditorStorage();
    const userId = state.profile?.id;
    const [path, assignments] = await Promise.all([
      fetchLearningPath(state.profile.role),
      fetchAssignmentsForManager(),
    ]);

    if (resolvedRouteId === 'new') {
      state.isEditingAssignment = true;
      if (!state.assignmentEditor || state.assignmentEditor.assignment?.id) {
        const draft = loadEditorDraft(storage, userId, 'new');
        const base = emptyEditor();
        state.assignmentEditor = draft
          ? { ...base, ...draft, assignment: { ...base.assignment, ...draft.assignment } }
          : base;
      }
    } else if (resolvedRouteId) {
      state.isEditingAssignment = true;
      if (state.assignmentEditor?.assignment?.id !== resolvedRouteId) {
        const editor = await fetchAssignmentEditor(resolvedRouteId);
        const normalized = normalizeAssignmentEditor(editor);
        const draft = loadEditorDraft(storage, userId, resolvedRouteId);
        state.assignmentEditor = draft
          ? {
            ...normalized,
            ...draft,
            assignment: { ...normalized.assignment, ...draft.assignment, id: normalized.assignment.id },
          }
          : normalized;
      }
    } else {
      state.isEditingAssignment = false;
    }

    if (!state.assignmentEditor) state.assignmentEditor = emptyEditor();
    if (state.isEditingAssignment) {
      root.innerHTML = `
        <section class="nh-ed-page">
          <div class="nh-ed-wrap">
            <form id="assignment-editor" style="display: flex; flex-direction: column; gap: 16px;">
              ${renderAssignmentEditor(path.lectures)}
            </form>
          </div>
        </section>
      `;
      wireAssignmentEditor(path.lectures);
    } else {
      const cleanup = renderAssignmentsListView(root, assignments, path, {
        onCreate: () => {
          clearEditorDraft(storage, userId, 'new');
          state.assignmentEditor = emptyEditor();
          state.isEditingAssignment = true;
          go('assignments/new');
        },
        onOpen: async (assignmentId) => {
          try {
            clearEditorDraft(storage, userId, assignmentId);
            const editor = await fetchAssignmentEditor(assignmentId);
            state.assignmentEditor = normalizeAssignmentEditor(editor);
            state.isEditingAssignment = true;
            go(`assignments/${assignmentId}`);
          } catch (error) {
            toast(error.message, 'error');
          }
        },
        onDelete: async (assignmentId) => {
          if (!window.confirm('Xóa đề này?')) return;
          try {
            await deleteAssignment(assignmentId);
            clearEditorDraft(storage, userId, assignmentId);
            toast('Đã xóa đề thi.', 'success');
            await mountAssignmentManager(null);
          } catch (error) {
            toast(error.message, 'error');
          }
        },
      });
      registerCleanup(cleanup);
    }
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

export function renderPdfPreview(url) {
  if (!url) {
    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 40px; text-align: center; color: #94a3b8; height: 100%; width: 100%;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
        <p style="margin: 0; font-weight: 500; font-size: 0.9rem;">Chưa có link PDF đề thi</p>
        <p style="margin: 0; font-size: 0.8rem; max-width: 250px; color: #64748b;">Hãy nhập link PDF Google Drive ở ô thông tin phía trên để hiển thị bản xem trước tại đây.</p>
      </div>
    `;
  }
  const preview = toDrivePreviewUrl(url);
  if (!preview) {
    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 40px; text-align: center; color: #94a3b8; height: 100%; width: 100%;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        <p style="margin: 0; font-weight: 500; font-size: 0.9rem;">Không thể nhúng link PDF này</p>
        <a class="text-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer noopener" style="font-weight: 600;">Mở liên kết trong tab mới</a>
      </div>
    `;
  }
  return `<iframe src="${escapeHtml(preview)}" style="width: 100%; height: 100%; border: 0; border-radius: 8px;" loading="lazy"></iframe>`;
}

function summarizeQuestionsCompact(questions = []) {
  const counts = { mcq: 0, tf4: 0, short: 0 };
  for (const q of questions) {
    const t = q?.type || 'mcq';
    counts[t] = (counts[t] || 0) + 1;
  }
  const parts = [];
  if (counts.mcq) parts.push(`${counts.mcq} TN`);
  if (counts.tf4) parts.push(`${counts.tf4} Đ/S`);
  if (counts.short) parts.push(`${counts.short} TLN`);
  return { total: questions.length, counts, text: parts.join(' · ') };
}

function getShortAnswerPreview(question) {
  const key = question?.answer_key || {};
  if (question?.type === 'tf4') {
    const arr = Array.isArray(key.correct_answer) ? key.correct_answer : [];
    return arr.length ? arr.map((v) => (v ? 'Đ' : 'S')).join('') : 'Đ/S';
  }
  if (question?.type === 'short') {
    const first = (key.accepted_answers || [])[0] ?? key.correct_answer ?? '';
    return String(first).slice(0, 8) || 'TLN';
  }
  return String(key.correct_answer || 'A').toUpperCase();
}

function stripLatexForSnippet(text = '') {
  return String(text)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '[Hình]')
    .replace(/^\([^)]+\)\s*/, '')
    .replace(/\\(?:textbf|textit|dfrac|frac|sqrt|cdot|times|infty|le|ge|ne|approx|Leftrightarrow|Rightarrow)\b/g, ' ')
    .replace(/[$\\{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function renderOutlineListHtml(questions = [], activeIndex = 0) {
  if (!questions.length) {
    return `<div class="nh-ed-outline-empty">Chưa có câu hỏi</div>`;
  }
  const roman = ['I', 'II', 'III', 'IV', 'V'];
  const partTitles = { mcq: 'Trắc nghiệm', tf4: 'Đúng / Sai', short: 'Trả lời ngắn' };
  let html = '';
  let prevType = null;
  let partNum = 0;

  questions.forEach((q, idx) => {
    const qType = q?.type || 'mcq';
    if (qType !== prevType) {
      prevType = qType;
      partNum += 1;
      let groupCount = 0;
      for (let i = idx; i < questions.length && (questions[i]?.type || 'mcq') === qType; i += 1) {
        groupCount += 1;
      }
      html += `<div class="nh-ed-outline-sec">Phần ${roman[partNum - 1] || partNum} · ${partTitles[qType] || 'Câu hỏi'} (${groupCount})</div>`;
    }
    let typeSeq = 1;
    for (let i = idx - 1; i >= 0 && (questions[i]?.type || 'mcq') === qType; i -= 1) typeSeq += 1;
    const qNumStr = String(typeSeq).padStart(2, '0');
    const snippet = stripLatexForSnippet(q.prompt || '');
    const label = snippet ? `Câu ${qNumStr} · ${snippet}` : `Câu ${qNumStr}`;
    const ans = getShortAnswerPreview(q);

    html += `
      <button type="button" class="nh-ed-outline-row" data-outline-idx="${idx}" aria-current="${idx === activeIndex ? 'true' : 'false'}" title="${escapeHtml(label)}">
        <span class="nh-ed-outline-txt">${escapeHtml(label)}</span>
        <span class="nh-ed-outline-ans">${escapeHtml(ans)}</span>
      </button>
    `;
  });

  return html;
}

const ED_STYLES = `
  <style>
    .nh-ed-page {
      min-height: calc(100vh - 110px);
      background: #F7F7F2;
      padding: 20px 20px 56px;
      font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif;
      color: #181B16;
    }
    .nh-ed-wrap {
      width: 100%;
      max-width: 1480px;
      margin: 0 auto;
    }
    .nh-ed-hero-title {
      width: 100%;
      margin: 0;
      padding: 4px 10px;
      margin-left: -10px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: transparent;
      color: #F7F7F2;
      font-family: var(--md-ref-typeface-brand, 'Google Sans', sans-serif);
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.015em;
      line-height: 1.25;
      outline: none;
      box-sizing: border-box;
      transition: background-color 0.14s ease, border-color 0.14s ease;
    }
    .nh-ed-hero-title::placeholder { color: rgba(247, 247, 242, 0.45); }
    .nh-ed-hero-title:hover { background: rgba(247, 247, 242, 0.08); }
    .nh-ed-hero-title:focus {
      background: rgba(247, 247, 242, 0.12);
      border-color: rgba(247, 247, 242, 0.38);
    }
    .nh-ed-hero-meta {
      margin: 0;
      font-size: 13px;
      color: rgba(247, 247, 242, 0.74);
      font-variant-numeric: tabular-nums;
    }
    .nh-ed-hero-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      flex-shrink: 0;
    }
    .nh-ed-btn-hero {
      display: inline-flex;
      align-items: center;
      justify-content: center;
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
      white-space: nowrap;
      transition: background-color 0.15s ease;
    }
    .nh-ed-btn-hero:hover { background: #EBEDE6; }
    .nh-ed-btn-hero:disabled { opacity: 0.6; cursor: not-allowed; }
    .nh-ed-btn-hero--ghost {
      background: rgba(247, 247, 242, 0.14);
      color: #F7F7F2;
    }
    .nh-ed-btn-hero--ghost:hover { background: rgba(247, 247, 242, 0.22); }
    .nh-ed-btn-hero--ghost[aria-expanded="true"] {
      background: rgba(247, 247, 242, 0.26);
    }
    .nh-ed-btn-hero--danger-icon {
      width: 40px;
      padding: 0;
      background: rgba(247, 247, 242, 0.11);
      color: #F8D4D1;
    }
    .nh-ed-btn-hero--danger-icon:hover {
      background: rgba(184, 67, 58, 0.36);
      color: #FFFFFF;
    }

    /* Meta Drawer (smooth grid-row accordion) */
    .nh-ed-meta-drawer {
      display: grid;
      grid-template-rows: 0fr;
      opacity: 0;
      margin-top: -16px;
      pointer-events: none;
      transition:
        grid-template-rows 380ms cubic-bezier(0.32, 0.72, 0, 1),
        opacity 300ms cubic-bezier(0.4, 0, 0.2, 1),
        margin-top 380ms cubic-bezier(0.32, 0.72, 0, 1);
    }
    .nh-ed-meta-drawer.open {
      grid-template-rows: 1fr;
      opacity: 1;
      margin-top: 0;
      pointer-events: auto;
    }
    .nh-ed-meta-drawer-inner {
      min-height: 0;
      overflow: hidden;
    }
    .nh-ed-meta-drawer.open .nh-ed-meta-drawer-inner {
      overflow: visible;
    }
    .nh-ed-meta-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      align-items: start;
      background: #FFFFFF;
      border: 1px solid #E4E6DE;
      border-radius: 20px;
      padding: 18px 20px;
    }
    .nh-ed-field-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #64695F;
      margin-bottom: 6px;
    }
    .nh-ed-input {
      width: 100%;
      height: 38px;
      padding: 0 12px;
      border-radius: 11px;
      border: 1px solid #E4E6DE;
      background: #F7F7F2;
      color: #181B16;
      font-family: inherit;
      font-size: 13.5px;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.14s ease, background-color 0.14s ease;
    }
    .nh-ed-input:focus {
      background: #FFFFFF;
      border-color: #181B16;
    }
    .nh-ed-seg {
      display: inline-flex;
      padding: 3px;
      gap: 4px;
      border-radius: 9999px;
      background: #EBEDE6;
      height: 38px;
      box-sizing: border-box;
      align-items: center;
    }
    .nh-ed-seg-btn {
      height: 32px;
      padding: 0 13px;
      border: 0;
      border-radius: 9999px;
      background: transparent;
      color: #64695F;
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background-color 0.14s ease, color 0.14s ease;
    }
    .nh-ed-seg-btn[aria-pressed="true"] {
      background: #FFFFFF;
      color: #181B16;
    }
    .nh-ed-combo-dropdown {
      display: none;
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      max-height: 240px;
      overflow-y: auto;
      background: #FFFFFF;
      border-radius: 12px;
      z-index: 100;
      box-shadow: 0 10px 28px rgba(24, 27, 22, 0.10);
      border: 1px solid #E4E6DE;
      padding: 4px;
    }
    .nh-ed-combo-opt {
      padding: 9px 11px;
      cursor: pointer;
      font-size: 13px;
      color: #181B16;
      border-radius: 8px;
    }
    .nh-ed-combo-opt:hover { background: #EBEDE6; }

    /* Shared Buttons & Badges inside workspace */
    .nh-ed-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 32px;
      padding: 0 12px;
      border-radius: 9999px;
      border: 1px solid transparent;
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background-color 0.14s ease, border-color 0.14s ease;
    }
    .nh-ed-btn--primary { background: #181B16; color: #F7F7F2; }
    .nh-ed-btn--primary:hover { background: #2C3028; }
    .nh-ed-btn--outline { background: #FFFFFF; border-color: #E4E6DE; color: #181B16; }
    .nh-ed-btn--outline:hover { background: #EBEDE6; border-color: #D3D7CB; }
    .nh-ed-btn--secondary { background: #EBEDE6; color: #181B16; }
    .nh-ed-btn--secondary:hover { background: #E2E5DC; }
    .nh-ed-btn:disabled { opacity: 0.55; cursor: not-allowed; }

    .nh-ed-badge {
      display: inline-flex;
      align-items: center;
      height: 24px;
      padding: 0 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      background: #EBEDE6;
      color: #181B16;
      white-space: nowrap;
    }
    .nh-ed-badge--dark { background: #181B16; color: #F7F7F2; }
    .nh-ed-badge--ok { background: #E9F2EC; color: #1F4E36; }

    /* 3-Column Variant B Grid */
    .nh-ed-grid-b {
      display: grid;
      grid-template-columns: 224px minmax(0, 1fr) minmax(0, 1fr);
      gap: 14px;
      align-items: stretch;
    }
    .nh-ed-grid-pdf {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 16px;
      align-items: stretch;
    }
    .nh-ed-pane {
      background: #FFFFFF;
      border: 1px solid #E4E6DE;
      border-radius: 20px;
      display: flex;
      flex-direction: column;
      min-width: 0;
      height: calc(100vh - 210px);
      min-height: 540px;
      overflow: hidden;
    }
    .nh-ed-pane-head {
      padding: 12px 16px;
      border-bottom: 1px solid #EFEFE9;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
      background: #FFFFFF;
      flex-shrink: 0;
    }
    .nh-ed-pane-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      color: #181B16;
      margin: 0;
    }
    .nh-ed-pane-icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: #EBEDE6;
      color: #181B16;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .nh-ed-pane-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 16px 18px;
    }

    /* Left Outline Column */
    .nh-ed-outline-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .nh-ed-outline-sec {
      flex-shrink: 0;
      font-size: 11.5px;
      font-weight: 700;
      line-height: 1.4;
      color: #64695F;
      padding: 8px 8px 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .nh-ed-outline-row {
      flex-shrink: 0;
      width: 100%;
      min-height: 34px;
      border: 0;
      background: transparent;
      color: #181B16;
      font-family: inherit;
      font-size: 12.5px;
      padding: 5px 8px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      cursor: pointer;
      text-align: left;
      transition: background-color 0.12s ease;
    }
    .nh-ed-outline-row:hover { background: #F7F7F2; }
    .nh-ed-outline-row[aria-current="true"] {
      background: #EBEDE6;
      font-weight: 600;
    }
    .nh-ed-outline-txt {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
    .nh-ed-outline-ans {
      flex-shrink: 0;
      height: 21px;
      padding: 0 7px;
      border-radius: 9999px;
      background: #E9F2EC;
      color: #1F4E36;
      font-size: 11px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      display: inline-flex;
      align-items: center;
    }
    .nh-ed-outline-empty {
      padding: 28px 12px;
      text-align: center;
      font-size: 12.5px;
      color: #64695F;
    }

    /* Preview Question Cards (Gọn chữ) */
    .nh-ed-part-pill {
      display: inline-flex;
      align-items: center;
      align-self: flex-start;
      flex-shrink: 0;
      gap: 8px;
      padding: 4px 14px 4px 4px;
      border-radius: 9999px;
      background: #EBEDE6;
      border: 1px solid #E4E6DE;
      font-size: 13px;
      font-weight: 700;
      color: #181B16;
      margin: 4px 0 12px;
    }
    .nh-ed-part-num {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #181B16;
      color: #F7F7F2;
      font-size: 11.5px;
      font-weight: 700;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .nh-ed-q-card {
      padding: 16px;
      border-radius: 16px;
      border: 1px solid #E4E6DE;
      background: #FFFFFF;
      display: flex;
      flex-direction: column;
      gap: 11px;
      cursor: pointer;
      transition: border-color 220ms ease, background-color 220ms ease, box-shadow 220ms ease;
    }
    .nh-ed-q-card:hover { border-color: #D3D7CB; }
    .nh-ed-q-card.active-q {
      background: #F7F7F2;
      border-color: #181B16;
      box-shadow: 0 2px 10px rgba(24, 27, 22, 0.05);
    }
    .nh-ed-sol[open] .nh-ed-sol-body {
      animation: details-enter 280ms cubic-bezier(0.32, 0.72, 0, 1) both;
    }
    .nh-ed-btn,
    .nh-ed-btn-hero,
    .nh-ed-seg-btn {
      transition: background-color 200ms ease, border-color 200ms ease, color 200ms ease, transform 180ms ease;
    }
    .nh-ed-btn:active,
    .nh-ed-btn-hero:active,
    .nh-ed-seg-btn:active {
      transform: scale(0.985);
    }
    .nh-ed-q-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .nh-ed-q-prompt {
      font-size: 14px;
      line-height: 1.62;
      color: #181B16;
    }
    .nh-ed-q-prompt img,
    .nh-ed-sol-body img {
      display: block;
      max-width: 100%;
      max-height: 230px;
      object-fit: contain;
      border-radius: 10px;
      border: 1px solid #EFEFE9;
      background: #FFFFFF;
      padding: 6px;
      margin: 8px 0 2px;
    }
    .nh-ed-choices {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7px;
    }
    .nh-ed-choice {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 11px;
      border-radius: 10px;
      border: 1px solid #E4E6DE;
      background: #F7F7F2;
      font-size: 13.5px;
      color: #181B16;
    }
    .nh-ed-choice.is-ok {
      background: #E9F2EC;
      border-color: rgba(47, 111, 78, 0.35);
      color: #1F4E36;
      font-weight: 600;
    }
    .nh-ed-choice-dot {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 1px solid #D3D7CB;
      background: #FFFFFF;
      display: grid;
      place-items: center;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .nh-ed-choice.is-ok .nh-ed-choice-dot {
      background: #2F6F4E;
      border-color: #2F6F4E;
      color: #FFFFFF;
    }
    .nh-ed-tf-list { display: flex; flex-direction: column; gap: 6px; }
    .nh-ed-tf-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 11px;
      border-radius: 10px;
      border: 1px solid #E4E6DE;
      background: #F7F7F2;
      font-size: 13px;
      line-height: 1.5;
    }
    .nh-ed-tf-pill {
      flex-shrink: 0;
      padding: 2px 9px;
      border-radius: 9999px;
      font-size: 11.5px;
      font-weight: 700;
    }
    .nh-ed-tf-pill.is-t { background: #E9F2EC; color: #1F4E36; }
    .nh-ed-tf-pill.is-f { background: #F8EAE8; color: #B8433A; }
    .nh-ed-sol {
      border-top: 1px solid #EFEFE9;
      padding-top: 8px;
    }
    .nh-ed-sol summary {
      cursor: pointer;
      font-size: 12.5px;
      font-weight: 600;
      color: #64695F;
      user-select: none;
    }
    .nh-ed-sol-body {
      margin-top: 8px;
      padding: 10px 12px;
      border-radius: 10px;
      background: #F7F7F2;
      font-size: 13px;
      line-height: 1.65;
      color: #2A2E27;
      max-width: 100%;
      overflow-x: auto;
    }

    /* CodeMirror Container */
    .nh-ed-cm-box {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      background: #F7F7F2;
    }
    .nh-ed-cm-box .CodeMirror {
      height: 100% !important;
      flex: 1;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 13px;
      line-height: 1.65;
      border: 0;
      border-radius: 0;
      background: #F7F7F2;
      color: #181B16;
    }
    .nh-ed-cm-box .CodeMirror-gutters {
      background: #EFEFE9;
      border-right: 1px solid #E4E6DE;
    }
    .nh-ed-cm-box .CodeMirror-scroll {
      height: 100% !important;
      overflow-y: auto !important;
      overflow-x: auto !important;
    }
    .cm-question-marker-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #181B16;
      color: #F7F7F2;
      font-family: 'Google Sans', sans-serif;
      font-weight: 700;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 6px;
      margin: 6px 0 4px;
      user-select: none;
    }
    .nh-ed-code-foot {
      padding: 8px 14px;
      border-top: 1px solid #EFEFE9;
      background: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 12px;
      color: #64695F;
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }

    /* Mobile tab switcher */
    .nh-ed-mob-tabs { display: none; }
    .nh-ed-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 10px;
      padding: 40px 20px;
      height: 100%;
      box-sizing: border-box;
      color: #64695F;
    }
    .nh-ed-empty h3 { margin: 0; font-size: 15px; font-weight: 700; color: #181B16; }
    .nh-ed-empty p { margin: 0; max-width: 320px; font-size: 13px; }

    @media (max-width: 960px) {
      .nh-ed-page { padding: 14px 12px 48px; }
      .nh-ed-hero-title { font-size: 19px; }
      .nh-ed-meta-grid { grid-template-columns: minmax(0, 1fr); }
      .nh-ed-grid-b, .nh-ed-grid-pdf { grid-template-columns: minmax(0, 1fr); }
      .nh-ed-pane { height: auto; min-height: 440px; max-height: none; }
      .nh-ed-cm-box .CodeMirror { height: 460px !important; }
      .nh-ed-choices { grid-template-columns: minmax(0, 1fr); }
      .nh-ed-mob-tabs { display: flex; width: 100%; }
      .nh-ed-mob-hide { display: none !important; }
    }
  </style>
`;

export function renderAssignmentEditor(lectures) {
  const { assignment, questions } = state.assignmentEditor;
  const isLatexMode = assignment.pdf_url === 'latex' || !assignment.pdf_url;
  const stats = summarizeQuestionsCompact(questions);
  const currentLectureTitle = assignment.lecture_id && lectures.find((l) => l.id === assignment.lecture_id)
    ? lectures.find((l) => l.id === assignment.lecture_id).title
    : (assignment.lecture_id ? '' : 'Bài tập tự do');
  const extractedTitleCat = extractCategoryFromTitle(assignment.title).category;
  const categoryVal = assignment.category || extractedTitleCat || (assignment.description && assignment.description.startsWith('__CAT__:') ? assignment.description.replace('__CAT__:', '').trim() : '');
  const metaSummaryParts = [`${stats.total} câu`];
  if (stats.text) metaSummaryParts.push(stats.text);
  metaSummaryParts.push(currentLectureTitle || 'Bài tập tự do');
  const latexLinesCount = (state.assignmentEditor.latexSource || '').split('\n').length;

  return `
    ${ED_STYLES}

    <!-- Obsidian Hero Header (matches QuestionBank, Assignments list, Courses, Salary) -->
    <header class="asg-overview-hero">
      <button type="button" id="back-to-list-btn" class="phase-back-link" style="background:transparent;border:0;padding:0;cursor:pointer;font-family:inherit;">
        ${ASG_ICONS.arrowLeft}
        <span>Đề thi &amp; Bài tập</span>
      </button>
      <div class="asg-overview-hero-row">
        <div class="asg-overview-hero-left">
          <input
            class="nh-ed-hero-title"
            name="title"
            value="${escapeHtml(assignment.title)}"
            placeholder="Nhập tên đề thi..."
            aria-label="Tên đề thi"
            required
          />
          <p class="nh-ed-hero-meta" id="nh-ed-hero-meta">${escapeHtml(metaSummaryParts.join(' · '))}</p>
        </div>
        <div class="nh-ed-hero-actions">
          <button type="button" id="nh-ed-meta-toggle" class="nh-ed-btn-hero nh-ed-btn-hero--ghost" aria-expanded="false">
            ${ASG_ICONS.sliders}
            <span>Thông tin đề</span>
          </button>
          ${assignment.id ? `
            <button type="button" id="delete-assignment" class="nh-ed-btn-hero nh-ed-btn-hero--danger-icon" title="Xóa đề thi" aria-label="Xóa đề thi">
              ${ASG_ICONS.trash2}
            </button>
          ` : ''}
          <button type="submit" id="nh-ed-save-btn" class="nh-ed-btn-hero">
            ${ASG_ICONS.check}
            <span>Lưu đề thi</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Collapsible Metadata Drawer -->
    <div class="nh-ed-meta-drawer" id="nh-ed-meta-drawer">
      <div class="nh-ed-meta-drawer-inner">
        <div class="nh-ed-meta-grid">
        <div>
          <label class="nh-ed-field-label" for="nh-ed-category-inp">Chủ đề / Phân loại</label>
          <input
            id="nh-ed-category-inp"
            class="nh-ed-input"
            name="category_tag"
            list="category-suggestions"
            value="${escapeHtml(categoryVal)}"
            placeholder="Ví dụ: Đại số, Hình học, Luyện đề..."
          />
          <datalist id="category-suggestions">
            <option value="Đại số & Giải tích"></option>
            <option value="Hình học"></option>
            <option value="Xác suất & Thống kê"></option>
            <option value="Đề luyện tập"></option>
            <option value="Vận dụng cao"></option>
          </datalist>
        </div>

        <div class="custom-combobox" style="position: relative;">
          <input type="hidden" name="lecture_id" value="${escapeHtml(assignment.lecture_id ?? '')}" />
          <label class="nh-ed-field-label" for="lecture-search-input">Chương liên kết</label>
          <input
            class="nh-ed-input"
            id="lecture-search-input"
            autocomplete="off"
            placeholder="Gõ để tìm chương..."
            value="${escapeHtml(currentLectureTitle)}"
            style="cursor: pointer;"
          />
          <div class="combobox-dropdown nh-ed-combo-dropdown">
            <div class="combo-option nh-ed-combo-opt" data-value="">Bài tập tự do</div>
            ${lectures.map((lecture) => `<div class="combo-option nh-ed-combo-opt" data-value="${escapeHtml(lecture.id)}" data-label="${escapeHtml(lecture.title).toLowerCase()}">${escapeHtml(lecture.title)}</div>`).join('')}
          </div>
        </div>

        <div>
          <label class="nh-ed-field-label">Hiển thị &amp; Định dạng</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <div class="nh-ed-seg" id="nh-ed-pub-seg">
              <button type="button" class="nh-ed-seg-btn" data-pub-val="true" aria-pressed="${assignment.published !== false ? 'true' : 'false'}">Xuất bản</button>
              <button type="button" class="nh-ed-seg-btn" data-pub-val="false" aria-pressed="${assignment.published === false ? 'true' : 'false'}">Nháp</button>
            </div>
            <div class="nh-ed-seg" id="nh-ed-mode-seg">
              <button type="button" class="nh-ed-seg-btn" data-mode-val="latex" aria-pressed="${isLatexMode ? 'true' : 'false'}">LaTeX</button>
              <button type="button" class="nh-ed-seg-btn" data-mode-val="pdf" aria-pressed="${!isLatexMode ? 'true' : 'false'}">PDF</button>
            </div>
          </div>
        </div>

        ${!isLatexMode ? `
          <div style="grid-column: 1 / -1;">
            <label class="nh-ed-field-label" for="assignment-pdf-input">Link tài liệu PDF (Google Drive) *</label>
            <input class="nh-ed-input" id="assignment-pdf-input" name="pdf_url" value="${escapeHtml(assignment.pdf_url)}" placeholder="https://drive.google.com/..." required />
          </div>
        ` : ''}
        </div>
      </div>
    </div>

    <input type="hidden" name="id" value="${escapeHtml(assignment.id ?? '')}" />
    <input type="hidden" name="description" value="${escapeHtml(assignment.description ?? '')}" />
    <input type="hidden" name="sort_order" value="${Number(assignment.sort_order ?? 0)}" />
    <input type="hidden" name="published" value="${assignment.published === false ? 'false' : 'true'}" />

    ${isLatexMode ? `
      <div class="nh-ed-mob-tabs">
        <div class="nh-ed-seg" style="width:100%;">
          <button type="button" class="nh-ed-seg-btn" style="flex:1;" data-mob-pane="preview" aria-pressed="true">Xem trước (${stats.total})</button>
          <button type="button" class="nh-ed-seg-btn" style="flex:1;" data-mob-pane="code" aria-pressed="false">Mã LaTeX</button>
          <button type="button" class="nh-ed-seg-btn" style="flex:1;" data-mob-pane="outline" aria-pressed="false">Mục lục</button>
        </div>
      </div>

      <div class="nh-ed-grid-b">
        <!-- Col 1: Mục lục -->
        <aside class="nh-ed-pane nh-ed-mob-hide" data-ed-pane="outline">
          <div class="nh-ed-pane-head">
            <h2 class="nh-ed-pane-title">
              <span class="nh-ed-pane-icon">${ASG_ICONS.listTree}</span>
              <span>Mục lục</span>
            </h2>
            <span class="nh-ed-badge" id="nh-ed-outline-count">${stats.total}</span>
          </div>
          <div class="nh-ed-outline-body" id="nh-ed-outline-list">
            ${renderOutlineListHtml(questions, 0)}
          </div>
        </aside>

        <!-- Col 2: Xem trước -->
        <section class="nh-ed-pane" data-ed-pane="preview">
          <div class="nh-ed-pane-head">
            <h2 class="nh-ed-pane-title">
              <span class="nh-ed-pane-icon">${ASG_ICONS.eye}</span>
              <span>Xem trước</span>
            </h2>
            <span class="nh-ed-badge" id="nh-ed-preview-count">${stats.total} câu</span>
          </div>
          <div class="nh-ed-pane-body left-pane">
            <div class="latex-review-list">
              <div class="question-builder" style="display:flex;flex-direction:column;gap:12px;">
                ${questions.length
        ? questions.map((question, index) => renderQuestionEditor(question, index)).join('')
        : `
                    <div class="nh-ed-empty">
                      <h3>Chưa có câu hỏi nào</h3>
                      <p>Bốc câu từ Ngân hàng câu hỏi, dán mã EX_TEST bên phải hoặc chèn câu mẫu.</p>
                      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
                        <button type="button" class="nh-ed-btn nh-ed-btn--primary" data-pick-bank="true">
                          ${ASG_ICONS.sparkles}
                          <span>Bốc từ Ngân hàng</span>
                        </button>
                        <button type="button" id="nh-ed-insert-sample-btn" class="nh-ed-btn nh-ed-btn--secondary">
                          <span>Chèn câu mẫu</span>
                        </button>
                      </div>
                    </div>
                  `
      }
              </div>
            </div>
          </div>
        </section>

        <!-- Col 3: Soạn thảo LaTeX -->
        <section class="nh-ed-pane right-pane nh-ed-mob-hide" data-ed-pane="code">
          <div class="nh-ed-pane-head">
            <h2 class="nh-ed-pane-title">
              <span class="nh-ed-pane-icon">${ASG_ICONS.code2}</span>
              <span>LaTeX (EX_TEST)</span>
            </h2>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <button type="button" id="nh-ed-pick-bank-btn" class="nh-ed-btn nh-ed-btn--outline" data-pick-bank="true" title="Chọn hoặc bốc câu hỏi từ Ngân hàng">
                ${ASG_ICONS.sparkles}
                <span>Ngân hàng</span>
              </button>
              <input type="file" id="latex-image-upload" accept="image/*" style="display:none;" />
              <button type="button" id="latex-image-btn" class="nh-ed-btn nh-ed-btn--outline">
                ${ASG_ICONS.imagePlus}
                <span>Chèn ảnh</span>
              </button>
              <span id="latex-upload-status" style="font-size:12px;color:#64695F;display:none;">Đang tải...</span>
              <button type="button" id="latex-live-parse-btn" class="nh-ed-btn nh-ed-btn--primary">
                ${ASG_ICONS.refreshCw}
                <span>Cập nhật</span>
              </button>
            </div>
          </div>
          <div class="nh-ed-cm-box">
            <textarea id="latex-live-input" style="flex:1;min-height:480px;width:100%;box-sizing:border-box;padding:16px;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.65;border:0;background:#F7F7F2;color:#181B16;resize:none;outline:none;" placeholder="Dán mã LaTeX chuẩn EX_TEST vào đây...">${escapeHtml(state.assignmentEditor.latexSource || '')}</textarea>
          </div>
          <div class="nh-ed-code-foot">
            <span id="nh-ed-code-lines">${latexLinesCount} dòng · Tự đồng bộ 0,4s</span>
            <span>Ctrl/Cmd + S để cập nhật</span>
          </div>
        </section>
      </div>
    ` : `
      <div class="nh-ed-grid-pdf">
        <section class="nh-ed-pane">
          <div class="nh-ed-pane-head">
            <h2 class="nh-ed-pane-title">
              <span class="nh-ed-pane-icon">${ASG_ICONS.listTree}</span>
              <span>Phiếu đáp án (<span class="qb-count">${stats.total} câu</span>)</span>
            </h2>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button type="button" class="nh-ed-btn nh-ed-btn--outline" data-add-question="mcq">+ TN</button>
              <button type="button" class="nh-ed-btn nh-ed-btn--outline" data-add-question="tf4">+ Đ/S</button>
              <button type="button" class="nh-ed-btn nh-ed-btn--outline" data-add-question="short">+ TLN</button>
            </div>
          </div>
          <div class="nh-ed-pane-body left-pane">
            <div class="question-builder" style="display:flex;flex-direction:column;gap:12px;">
              ${questions.length
      ? questions.map((question, index) => renderQuestionEditor(question, index)).join('')
      : `<div class="nh-ed-empty"><h3>Chưa có câu hỏi nào</h3><p>Bấm + TN, + Đ/S hoặc + TLN ở góc trên để thêm đáp án cho đề PDF.</p></div>`
    }
            </div>
          </div>
        </section>

        <section class="nh-ed-pane">
          <div class="nh-ed-pane-head">
            <h2 class="nh-ed-pane-title">
              <span class="nh-ed-pane-icon">${ASG_ICONS.eye}</span>
              <span>Xem trước PDF</span>
            </h2>
          </div>
          <div class="nh-ed-pane-body pdf-preview-container" style="padding:12px;">
            ${renderPdfPreview(assignment.pdf_url)}
          </div>
        </section>
      </div>
    `}
  `;
}

export function renderQuestionEditor(question, index) {
  const isLatex = state.assignmentEditor.assignment.pdf_url === 'latex' || !state.assignmentEditor.assignment.pdf_url;

  if (isLatex) {
    const allQuestions = state.assignmentEditor.questions;
    const prevQ = index > 0 ? allQuestions[index - 1] : null;
    const isNewSection = !prevQ || prevQ.type !== question.type;

    let typeCount = 1;
    for (let i = index - 1; i >= 0; i -= 1) {
      if (allQuestions[i].type === question.type) typeCount += 1;
      else break;
    }
    const displayIndex = typeCount - 1;

    let sectionHeaderHTML = '';
    if (isNewSection) {
      let sectionNum = 1;
      for (let i = 1; i <= index; i += 1) {
        if (allQuestions[i].type !== allQuestions[i - 1].type) sectionNum += 1;
      }
      const romanNumeral = ['I', 'II', 'III', 'IV', 'V'][sectionNum - 1] || sectionNum;
      let typeLabel = 'Phần I · Trắc nghiệm';
      if (question.type === 'tf4') typeLabel = `Phần ${romanNumeral} · Đúng / Sai`;
      else if (question.type === 'short') typeLabel = `Phần ${romanNumeral} · Trả lời ngắn`;
      else typeLabel = `Phần ${romanNumeral} · Trắc nghiệm`;

      sectionHeaderHTML = `
        <div class="nh-ed-part-pill">
          <span class="nh-ed-part-num">${romanNumeral}</span>
          <span>${typeLabel}</span>
        </div>
      `;
    }

    let correctAnswer = question.answer_key?.correct_answer ?? '';
    if (question.type === 'short') {
      correctAnswer = (question.answer_key?.accepted_answers || []).join(' / ');
    }
    const cleanPrompt = question.prompt ? question.prompt.replace(/^Câu\s*\d+[.:\s]*/i, '') : '';
    const qNumStr = String(displayIndex + 1).padStart(2, '0');
    const ansSummary = getShortAnswerPreview(question);

    return `
      ${sectionHeaderHTML}
      <article class="nh-ed-q-card latex-review-q-block" data-question-index="${index}" data-source-index="${question.startIndex ?? ''}" title="Bấm để nhảy tới mã LaTeX tương ứng">
        <div class="nh-ed-q-head">
          <span class="nh-ed-badge nh-ed-badge--dark">Câu ${qNumStr}</span>
          <span class="nh-ed-badge nh-ed-badge--ok">Đáp án ${escapeHtml(ansSummary)}</span>
        </div>

        <div class="nh-ed-q-prompt">${renderLatexText(cleanPrompt)}</div>

        ${question.type === 'mcq' && question.choices?.length ? `
          <div class="nh-ed-choices">
            ${question.choices.map((choice, cIdx) => {
      const letter = String.fromCharCode(65 + cIdx);
      const isOk = String(correctAnswer).toUpperCase() === letter;
      const cleanChoice = choice.replace(/^[A-D]\.\s*/i, '').trim();
      return `
                <div class="nh-ed-choice ${isOk ? 'is-ok' : ''}">
                  <span class="nh-ed-choice-dot">${letter}</span>
                  <span>${renderLatexText(cleanChoice)}</span>
                </div>
              `;
    }).join('')}
          </div>
        ` : ''}

        ${question.type === 'tf4' ? `
          <div class="nh-ed-tf-list">
            ${(question.settings?.statements || []).map((statement, cIdx) => {
      const letter = String.fromCharCode(97 + cIdx);
      const isTrue = Boolean(question.answer_key?.correct_answer?.[cIdx]);
      return `
                <div class="nh-ed-tf-row">
                  <div style="flex:1;min-width:0;"><strong>${letter})</strong> ${renderLatexText(statement)}</div>
                  <span class="nh-ed-tf-pill ${isTrue ? 'is-t' : 'is-f'}">${isTrue ? 'Đúng' : 'Sai'}</span>
                </div>
              `;
    }).join('')}
          </div>
        ` : ''}

        ${question.type === 'short' ? `
          <div style="padding:8px 12px;border-radius:10px;background:#E9F2EC;color:#1F4E36;font-size:13px;font-weight:600;">
            Đáp số: ${correctAnswer ? renderLatexText(correctAnswer) : '(Chưa có đáp án)'}
          </div>
        ` : ''}

        ${question.settings?.explanation ? `
          <details class="nh-ed-sol">
            <summary>Lời giải chi tiết</summary>
            <div class="nh-ed-sol-body">${renderLatexText(question.settings.explanation)}</div>
          </details>
        ` : ''}

        <input type="hidden" name="question-id-${index}" value="${escapeHtml(question.id ?? '')}" />
      </article>
    `;
  }

  return `
    <article class="nh-ed-q-card question-editor" data-index="${index}">
      <div class="nh-ed-q-head">
        <strong style="font-size:14px;color:#181B16;">Câu ${index + 1}</strong>
        <div style="display:flex;gap:8px;align-items:center;">
          <select name="question-type-${index}" class="nh-ed-input" style="width:110px;height:32px;font-size:12.5px;">
            ${['mcq', 'tf4', 'short'].map((type) => `<option value="${type}" ${question.type === type ? 'selected' : ''}>${type.toUpperCase()}</option>`).join('')}
          </select>
          <input type="number" class="nh-ed-input" name="question-sort-${index}" value="${Number(question.sort_order ?? index + 1)}" style="width:64px;height:32px;font-size:12.5px;text-align:center;" />
          <button type="button" data-remove-question="${index}" aria-label="Xóa câu" class="nh-ed-btn nh-ed-btn--outline" style="width:32px;padding:0;color:#B8433A;">
            ${ASG_ICONS.trash2}
          </button>
        </div>
      </div>
      <input type="hidden" name="question-id-${index}" value="${escapeHtml(question.id ?? '')}" />
      <div>${renderQuestionKeyEditor(question, index)}</div>
    </article>
  `;
}

export function renderQuestionKeyEditor(question, index) {
  const key = question.answer_key ?? {};
  if (question.type === 'tf4') {
    const statements = question.settings?.statements ?? ['', '', '', ''];
    const correct = key.correct_answer ?? [true, true, true, true];
    return `
      <div class="tf-editor">
        ${[0, 1, 2, 3]
        .map(
          (itemIndex) => `
              <div class="tf-row">
                <input class="field" name="tf-statement-${index}-${itemIndex}" value="${escapeHtml(statements[itemIndex] ?? '')}" placeholder="Ý ${itemIndex + 1}">
                <select class="field" name="tf-answer-${index}-${itemIndex}">
                  ${option('true', 'Đúng', String(correct[itemIndex] ?? true))}
                  ${option('false', 'Sai', String(correct[itemIndex] ?? true))}
                </select>
              </div>
            `,
        )
        .join('')}
      </div>
    `;
  }

  if (question.type === 'short') {
    return `<input class="field" name="short-answers-${index}" value="${escapeHtml((key.accepted_answers ?? []).join(', '))}" placeholder="Đáp án chấp nhận, cách nhau bằng dấu phẩy">`;
  }

  return `
    <select class="field" name="mcq-answer-${index}">
      ${['A', 'B', 'C', 'D'].map((letter) => option(letter, `Đáp án ${letter}`, key.correct_answer ?? 'A')).join('')}
    </select>
  `;
}

export function refreshQuestionBuilder(lectures) {
  const questions = state.assignmentEditor.questions;
  const heading = document.querySelector('.qb-count');
  const builder = document.querySelector('.question-builder');
  if (heading) heading.textContent = `${questions.length} câu`;

  const heroMeta = document.querySelector('#nh-ed-hero-meta');
  if (heroMeta) {
    const stats = summarizeQuestionsCompact(questions);
    const lectureId = document.querySelector('input[name="lecture_id"]')?.value || '';
    const lectureTitle = lectureId && lectures.find((l) => l.id === lectureId)
      ? lectures.find((l) => l.id === lectureId).title
      : (lectureId ? '' : 'Bài tập tự do');
    const parts = [`${stats.total} câu`];
    if (stats.text) parts.push(stats.text);
    parts.push(lectureTitle || 'Bài tập tự do');
    heroMeta.textContent = parts.join(' · ');
  }

  if (builder) {
    builder.innerHTML = questions.length
      ? questions.map((question, index) => renderQuestionEditor(question, index)).join('')
      : '<div class="nh-ed-empty"><h3>Chưa có câu hỏi nào</h3><p>Bấm + TN, + Đ/S hoặc + TLN ở góc trên để thêm đáp án cho đề PDF.</p></div>';
  }
  wireQuestionEditorControls(lectures);
}

export function wireQuestionEditorControls(lectures) {
  document.querySelectorAll('[data-remove-question]').forEach((button) => {
    if (button.dataset.questionBridge === 'true') return;
    button.dataset.questionBridge = 'true';
    button.addEventListener('click', () => {
      state.assignmentEditor = collectEditor(lectures);
      state.assignmentEditor.questions.splice(Number(button.dataset.removeQuestion), 1);
      persistCurrentEditorDraft();
      refreshQuestionBuilder(lectures);
    });
  });
}

const SAMPLE_EX_TEST = `\\begin{ex}
Cho hàm số $y = x^3 - 3x$. Điểm cực tiểu của hàm số là
\\choice
{$x = -1$}
{\\True $x = 1$}
{$x = 0$}
{$x = 3$}
\\loigiai{
Ta có $y' = 3x^2 - 3 = 0 \\Leftrightarrow x = \\pm 1$. Dựa vào bảng biến thiên, $x = 1$ là điểm cực tiểu.
}
\\end{ex}
`;

export function wireAssignmentEditor(lectures) {
  const editorForm = document.querySelector('#assignment-editor');
  const heroMetaEl = document.querySelector('#nh-ed-hero-meta');

  const updateHeroMeta = () => {
    if (!heroMetaEl) return;
    const questions = state.assignmentEditor?.questions || [];
    const stats = summarizeQuestionsCompact(questions);
    const lectureId = document.querySelector('input[name="lecture_id"]')?.value || '';
    const lectureObj = lectureId ? lectures.find((l) => l.id === lectureId) : null;
    const lectureTitle = lectureObj ? lectureObj.title : 'Bài tập tự do';
    const parts = [`${stats.total} câu`];
    if (stats.text) parts.push(stats.text);
    parts.push(lectureTitle);
    heroMetaEl.textContent = parts.join(' · ');
  };

  // Collapsible metadata drawer toggle
  const metaToggleBtn = document.querySelector('#nh-ed-meta-toggle');
  const metaDrawer = document.querySelector('#nh-ed-meta-drawer');
  metaToggleBtn?.addEventListener('click', () => {
    const isOpen = metaDrawer?.classList.toggle('open');
    metaToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Published segmented control
  const pubHidden = document.querySelector('input[name="published"]');
  document.querySelectorAll('#nh-ed-pub-seg [data-pub-val]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.pubVal;
      if (pubHidden) pubHidden.value = val;
      document.querySelectorAll('#nh-ed-pub-seg [data-pub-val]').forEach((b) => {
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      if (state.assignmentEditor?.assignment) {
        state.assignmentEditor.assignment.published = val !== 'false';
        persistCurrentEditorDraft();
      }
    });
  });

  // Mode segmented control (LaTeX <-> PDF)
  document.querySelectorAll('#nh-ed-mode-seg [data-mode-val]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetMode = btn.dataset.modeVal;
      const currentIsLatex = !state.assignmentEditor?.assignment?.pdf_url || state.assignmentEditor.assignment.pdf_url === 'latex';
      if ((targetMode === 'latex' && currentIsLatex) || (targetMode === 'pdf' && !currentIsLatex)) {
        return;
      }
      state.assignmentEditor = collectEditor(lectures);
      if (targetMode === 'latex') {
        state.assignmentEditor.assignment.pdf_url = 'latex';
        const src = String(state.assignmentEditor.latexSource || '');
        if (!src.includes('\\begin{ex}') && state.assignmentEditor.questions?.length > 0) {
          state.assignmentEditor.latexSource = exportQuestionsToLatex(state.assignmentEditor.assignment.title, state.assignmentEditor.questions);
        }
      } else {
        state.assignmentEditor.assignment.pdf_url = '';
      }
      persistCurrentEditorDraft();
      mountAssignmentManager(undefined, { skipSkeleton: true });
    });
  });

  // Wire Custom Searchable Combobox
  const searchInput = document.querySelector('#lecture-search-input');
  const hiddenInput = document.querySelector('input[name="lecture_id"]');
  const dropdown = document.querySelector('.combobox-dropdown');
  if (searchInput && dropdown) {
    const options = dropdown.querySelectorAll('.combo-option');
    const openDropdown = () => {
      dropdown.style.display = 'block';
      options.forEach((opt) => {
        opt.style.display = 'block';
      });
    };
    searchInput.addEventListener('focus', openDropdown);
    searchInput.addEventListener('click', openDropdown);

    searchInput.addEventListener('input', (e) => {
      dropdown.style.display = 'block';
      const term = (e.target.value || '').toLowerCase();
      options.forEach((opt) => {
        if (!opt.dataset.value) return;
        const label = opt.dataset.label || '';
        opt.style.display = label.includes(term) ? 'block' : 'none';
      });
    });

    options.forEach((opt) => {
      opt.addEventListener('click', () => {
        if (hiddenInput) hiddenInput.value = opt.dataset.value;
        searchInput.value = opt.textContent;
        dropdown.style.display = 'none';
        updateHeroMeta();
        if (state.assignmentEditor) {
          state.assignmentEditor = collectEditor(lectures);
          persistCurrentEditorDraft();
        }
      });
    });

    const handleDocClick = (e) => {
      if (!e.target.closest('.custom-combobox')) {
        dropdown.style.display = 'none';
      }
    };
    document.addEventListener('click', handleDocClick);
    registerCleanup(() => document.removeEventListener('click', handleDocClick));
  }

  document.querySelector('#back-to-list-btn')?.addEventListener('click', () => {
    clearEditorDraft(getEditorStorage(), state.profile?.id, currentEditorDraftId());
    state.isEditingAssignment = false;
    state.assignmentEditor = emptyEditor();
    if (route().id) {
      go('assignments');
    } else {
      mountAssignmentManager(null);
    }
  });

  document.querySelectorAll('[data-add-question]').forEach((button) => {
    button.addEventListener('click', () => {
      state.assignmentEditor = collectEditor(lectures);
      state.assignmentEditor.questions.push(defaultQuestion(button.dataset.addQuestion));
      persistCurrentEditorDraft();
      refreshQuestionBuilder(lectures);
    });
  });

  wireQuestionEditorControls(lectures);

  if (state.assignmentEditor.assignment.pdf_url === 'latex' && window.MathJax) {
    setTimeout(() => window.MathJax.typesetPromise().catch(() => { }), 50);
  }

  const uploadInput = document.querySelector('#latex-image-upload');
  const uploadBtn = document.querySelector('#latex-image-btn');
  const uploadStatus = document.querySelector('#latex-upload-status');
  const latexInput = document.querySelector('#latex-live-input');
  const outlineBody = document.querySelector('#nh-ed-outline-list');
  const outlineCountBadge = document.querySelector('#nh-ed-outline-count');
  const previewCountBadge = document.querySelector('#nh-ed-preview-count');
  const codeLinesFooter = document.querySelector('#nh-ed-code-lines');

  const setActiveQuestionUI = (idx) => {
    document.querySelectorAll('#nh-ed-outline-list .nh-ed-outline-row').forEach((row) => {
      const isMatch = Number(row.dataset.outlineIdx) === idx;
      row.setAttribute('aria-current', isMatch ? 'true' : 'false');
      if (isMatch && outlineBody) {
        const rowTop = row.offsetTop;
        const rowBottom = rowTop + row.offsetHeight;
        if (rowTop < outlineBody.scrollTop) {
          outlineBody.scrollTop = Math.max(0, rowTop - 8);
        } else if (rowBottom > outlineBody.scrollTop + outlineBody.clientHeight) {
          outlineBody.scrollTop = rowBottom - outlineBody.clientHeight + 8;
        }
      }
    });
    document.querySelectorAll('.latex-review-q-block').forEach((card) => {
      card.classList.toggle('active-q', Number(card.dataset.questionIndex) === idx);
    });
  };

  const scrollPreviewToQuestion = (idx) => {
    const targetCard = document.querySelector(`.latex-review-q-block[data-question-index="${idx}"]`);
    const leftPane = document.querySelector('.left-pane');
    if (targetCard && leftPane) {
      const paneRect = leftPane.getBoundingClientRect();
      const cardRect = targetCard.getBoundingClientRect();
      const targetTop = leftPane.scrollTop + (cardRect.top - paneRect.top) - 16;
      leftPane.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    }
  };

  const scrollCodeToQuestion = (idx) => {
    if (!cm) return;
    const q = state.assignmentEditor?.questions?.[idx];
    if (!q || q.startIndex === undefined) return;
    const doc = cm.getDoc();
    const pos = doc.posFromIndex(q.startIndex);
    cm.focus();
    cm.setCursor(pos);
    const topLine = Math.max(0, pos.line - 2);
    const coords = cm.charCoords({ line: topLine, ch: 0 }, 'local');
    cm.scrollTo(null, Math.max(0, coords.top - 8));
  };

  const syncPreviewScroll = () => {
    if (!cm) return;
    const scrollInfo = cm.getScrollInfo();
    const topVisibleLine = cm.lineAtHeight(scrollInfo.top + 20, 'local');
    const doc = cm.getDoc();
    const parsedQuestions = state.assignmentEditor?.questions || [];

    let currentQIdx = 0;
    for (let i = 0; i < parsedQuestions.length; i++) {
      const q = parsedQuestions[i];
      if (q.startIndex !== undefined) {
        const qLine = doc.posFromIndex(q.startIndex).line;
        if (qLine <= topVisibleLine) {
          currentQIdx = i;
        } else {
          break;
        }
      }
    }

    setActiveQuestionUI(currentQIdx);
    scrollPreviewToQuestion(currentQIdx);
  };

  let cm = null;
  if (latexInput) {
    cm = window.CodeMirror?.fromTextArea(latexInput, {
      lineNumbers: true,
      mode: 'stex',
      lineWrapping: true,
      theme: 'default',
      extraKeys: {
        'Cmd-S': function () { updateLatexPreview(false); },
        'Ctrl-S': function () { updateLatexPreview(false); }
      }
    });
    let changeDebounce = null;
    cm?.on('change', () => {
      const val = cm.getValue();
      latexInput.value = val;
      if (state.assignmentEditor) {
        state.assignmentEditor.latexSource = val;
        persistCurrentEditorDraft();
      }
      if (codeLinesFooter) {
        codeLinesFooter.textContent = `${val.split('\n').length} dòng · Tự đồng bộ 0,4s`;
      }
      clearTimeout(changeDebounce);
      changeDebounce = setTimeout(() => {
        updateLatexPreview(true);
      }, 400);
    });

    let scrollTimeout = null;
    cm?.on('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(syncPreviewScroll, 50);
    });
    cm?.on('cursorActivity', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(syncPreviewScroll, 80);
    });
  }

  // Mobile 3-way pane switcher
  document.querySelectorAll('[data-mob-pane]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.mobPane;
      document.querySelectorAll('[data-mob-pane]').forEach((b) => {
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      document.querySelectorAll('[data-ed-pane]').forEach((pane) => {
        pane.classList.toggle('nh-ed-mob-hide', pane.dataset.edPane !== target);
      });
      if (target === 'code' && cm) {
        setTimeout(() => cm.refresh(), 10);
      }
    });
  });

  // Outline click -> jump preview & code
  outlineBody?.addEventListener('click', (e) => {
    const row = e.target.closest('.nh-ed-outline-row[data-outline-idx]');
    if (!row) return;
    const idx = Number(row.dataset.outlineIdx);
    setActiveQuestionUI(idx);
    scrollPreviewToQuestion(idx);
    scrollCodeToQuestion(idx);
  });

  // Navigate to Question Bank to pick questions into current assignment
  editorForm?.addEventListener('click', (e) => {
    const pickBtn = e.target.closest('[data-pick-bank="true"]');
    if (!pickBtn) return;
    if (editorForm) {
      state.assignmentEditor = collectEditor(lectures);
      if (cm) state.assignmentEditor.latexSource = cm.getValue();
    }
    persistCurrentEditorDraft();
    try {
      sessionStorage.setItem('lms:qbPickTarget', currentEditorDraftId());
    } catch {
      // Ignore storage error
    }
    go('question-bank');
  });

  // Preview card click -> jump code & outline (skipping solution <details> toggles)
  document.querySelector('.left-pane')?.addEventListener('click', (e) => {
    if (e.target.closest('#nh-ed-insert-sample-btn')) {
      if (cm) {
        cm.setValue(SAMPLE_EX_TEST);
        cm.focus();
      } else if (latexInput) {
        latexInput.value = SAMPLE_EX_TEST;
      }
      updateLatexPreview(false);
      persistCurrentEditorDraft();
      return;
    }
    if (e.target.closest('details, summary, a, button')) return;
    const card = e.target.closest('.latex-review-q-block[data-question-index]');
    if (!card) return;
    const idx = Number(card.dataset.questionIndex);
    setActiveQuestionUI(idx);
    scrollCodeToQuestion(idx);
  });

  let cmLineWidgets = [];
  const refreshCodeMirrorQuestionMarkers = (parsedQuestions) => {
    if (!cm) return;
    cmLineWidgets.forEach((w) => w.clear());
    cmLineWidgets = [];

    const doc = cm.getDoc();
    parsedQuestions.forEach((q, idx) => {
      let typeCount = 1;
      for (let i = idx - 1; i >= 0; i--) {
        if (parsedQuestions[i].type === q.type) typeCount++;
        else break;
      }
      const qNumStr = String(typeCount).padStart(2, '0');
      if (q.startIndex !== undefined) {
        const pos = doc.posFromIndex(q.startIndex);
        const widgetEl = document.createElement('div');
        widgetEl.className = 'cm-question-marker-badge';
        widgetEl.textContent = `CÂU ${qNumStr}`;
        widgetEl.style.cursor = 'pointer';
        widgetEl.title = `Bấm để xem Câu ${qNumStr} bên bản xem trước`;
        widgetEl.addEventListener('click', (e) => {
          e.stopPropagation();
          setActiveQuestionUI(idx);
          scrollPreviewToQuestion(idx);
        });

        const widget = cm.addLineWidget(pos.line, widgetEl, { above: true, coverGutter: false, noHScroll: true });
        cmLineWidgets.push(widget);
      }
    });
  };

  const syncLatexMetricsAndOutline = (questionsList, text) => {
    if (outlineBody) outlineBody.innerHTML = renderOutlineListHtml(questionsList, 0);
    if (outlineCountBadge) outlineCountBadge.textContent = String(questionsList.length);
    if (previewCountBadge) previewCountBadge.textContent = `${questionsList.length} câu`;
    const mobPreviewBtn = document.querySelector('[data-mob-pane="preview"]');
    if (mobPreviewBtn) mobPreviewBtn.textContent = `Xem trước (${questionsList.length})`;
    if (codeLinesFooter) {
      codeLinesFooter.textContent = `${text.split('\n').length} dòng · Tự đồng bộ 0,4s`;
    }
    updateHeroMeta();
  };

  const updateLatexPreview = (preserveFocus = false) => {
    const text = cm ? cm.getValue() : (document.querySelector('#latex-live-input')?.value || '');
    if (latexInput) latexInput.value = text;
    const parsedQuestions = parseLatexAssignment(text);

    if (parsedQuestions.length === 0) {
      if (preserveFocus && text.trim() === '') {
        if (editorForm) state.assignmentEditor = collectEditor(lectures);
        state.assignmentEditor.questions = [];
        state.assignmentEditor.latexSource = text;
        refreshCodeMirrorQuestionMarkers([]);
        const qBuilder = document.querySelector('.latex-review-list .question-builder');
        if (qBuilder) {
          qBuilder.innerHTML = `
            <div class="nh-ed-empty">
              <h3>Chưa có câu hỏi nào</h3>
              <p>Bốc câu từ Ngân hàng câu hỏi, dán mã EX_TEST bên phải hoặc chèn câu mẫu.</p>
              <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
                <button type="button" class="nh-ed-btn nh-ed-btn--primary" data-pick-bank="true">
                  ${ASG_ICONS.sparkles}
                  <span>Bốc từ Ngân hàng</span>
                </button>
                <button type="button" id="nh-ed-insert-sample-btn" class="nh-ed-btn nh-ed-btn--secondary">
                  <span>Chèn câu mẫu</span>
                </button>
              </div>
            </div>
          `;
        }
        syncLatexMetricsAndOutline([], text);
      } else if (!preserveFocus) {
        toast('Không tìm thấy câu hỏi nào hợp lệ (cần dùng \\begin{ex}...\\end{ex}).', 'error');
      }
      return false;
    }

    if (editorForm) {
      state.assignmentEditor = collectEditor(lectures);
    }
    state.assignmentEditor.questions = parsedQuestions;
    state.assignmentEditor.latexSource = text;

    refreshCodeMirrorQuestionMarkers(parsedQuestions);
    syncLatexMetricsAndOutline(parsedQuestions, text);

    const qBuilder = document.querySelector('.latex-review-list .question-builder');
    const leftPane = document.querySelector('.left-pane');
    const prevScrollTop = leftPane ? leftPane.scrollTop : 0;

    if (qBuilder) {
      qBuilder.innerHTML = parsedQuestions.map((q, idx) => renderQuestionEditor(q, idx)).join('');

      if (window.MathJax) {
        setTimeout(() => {
          window.MathJax.typesetPromise([qBuilder]).then(() => {
            if (leftPane) leftPane.scrollTop = prevScrollTop;
          }).catch(() => { });
        }, 30);
      } else if (leftPane) {
        leftPane.scrollTop = prevScrollTop;
      }
    }

    if (!preserveFocus) {
      toast(`Đã cập nhật ${parsedQuestions.length} câu hỏi.`, 'success');
    }
    return true;
  };

  if (cm) {
    setTimeout(() => {
      updateLatexPreview(true);
    }, 50);
  }

  document.querySelector('#latex-live-parse-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    updateLatexPreview(false);
  });

  async function handleImageUpload(file) {
    if (!file) return;
    if (uploadStatus) uploadStatus.style.display = 'inline-block';
    if (uploadBtn) uploadBtn.disabled = true;

    const leftPane = document.querySelector('.left-pane');
    const leftScrollTop = leftPane ? leftPane.scrollTop : 0;
    const cmScrollInfo = cm ? cm.getScrollInfo() : null;
    const cmCursor = cm ? cm.getCursor() : null;

    try {
      const url = await uploadAssignmentImage(file);
      const insertText = `\n![image](${url})\n`;
      if (cm) {
        const doc = cm.getDoc();
        const cursor = cmCursor || doc.getCursor();
        doc.replaceRange(insertText, cursor);
        const nextLine = cursor.line + insertText.split('\n').length - 1;
        cm.setCursor({ line: nextLine, ch: 0 });
        if (cmScrollInfo) {
          cm.scrollTo(cmScrollInfo.left, cmScrollInfo.top);
        }
      } else if (latexInput) {
        const startPos = latexInput.selectionStart;
        const endPos = latexInput.selectionEnd;
        const prevScroll = latexInput.scrollTop;
        latexInput.value = latexInput.value.substring(0, startPos) + insertText + latexInput.value.substring(endPos);
        latexInput.selectionStart = latexInput.selectionEnd = startPos + insertText.length;
        latexInput.scrollTop = prevScroll;
        state.assignmentEditor.latexSource = latexInput.value;
      }

      updateLatexPreview(true);
      persistCurrentEditorDraft();
      if (leftPane) {
        leftPane.scrollTop = leftScrollTop;
      }
      toast('Đã chèn và hiển thị ảnh.', 'success');
    } catch (err) {
      toast('Tải ảnh lên thất bại: ' + err.message, 'error');
    } finally {
      if (uploadStatus) uploadStatus.style.display = 'none';
      if (uploadBtn) uploadBtn.disabled = false;
      if (uploadInput) uploadInput.value = '';
    }
  }

  uploadBtn?.addEventListener('click', () => uploadInput?.click());
  uploadInput?.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleImageUpload(e.target.files[0]);
    }
  });

  const handlePaste = (e) => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items || [];
    for (const item of items) {
      if (item.type.indexOf('image') === 0) {
        e.preventDefault();
        const file = item.getAsFile();
        handleImageUpload(file);
        break;
      }
    }
  };

  if (cm) {
    cm.on('paste', (instance, e) => handlePaste(e));
  } else {
    latexInput?.addEventListener('paste', handlePaste);
    latexInput?.addEventListener('input', () => {
      if (state.assignmentEditor) {
        state.assignmentEditor.latexSource = latexInput.value;
        persistCurrentEditorDraft();
      }
      if (codeLinesFooter) {
        codeLinesFooter.textContent = `${latexInput.value.split('\n').length} dòng · Tự đồng bộ 0,4s`;
      }
    });
  }

  document.querySelector('#delete-assignment')?.addEventListener('click', async () => {
    if (!window.confirm('Xóa đề này?')) return;
    try {
      const deletedId = state.assignmentEditor.assignment.id;
      await deleteAssignment(deletedId);
      clearEditorDraft(getEditorStorage(), state.profile?.id, deletedId);
      state.assignmentEditor = emptyEditor();
      state.isEditingAssignment = false;
      toast('Đã xóa đề.', 'success');
      if (route().id) {
        go('assignments');
      } else {
        await mountAssignmentManager(null);
      }
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  if (editorForm) {
    const titleInput = editorForm.querySelector('[name="title"]');
    const pdfInput = editorForm.querySelector('[name="pdf_url"]');

    const validateTitle = (showError = false) => {
      const ok = Boolean(titleInput?.value.trim());
      if (titleInput) {
        titleInput.style.outline = ok ? '' : '2px solid #F29B92';
        if (!ok && showError) {
          toast('Tên đề thi không được để trống.', 'error');
          titleInput.focus();
        }
      }
      return ok;
    };

    const validatePdf = (showError = false) => {
      if (!pdfInput) return true;
      const val = pdfInput.value.trim();
      if (!val) {
        pdfInput.style.borderColor = '#B8433A';
        if (showError) {
          if (metaDrawer) {
            metaDrawer.classList.add('open');
            metaToggleBtn?.setAttribute('aria-expanded', 'true');
          }
          toast('Link PDF không được để trống.', 'error');
          pdfInput.focus();
        }
        return false;
      }
      if (val !== 'latex' && !val.startsWith('http://') && !val.startsWith('https://')) {
        pdfInput.style.borderColor = '#B8433A';
        if (showError) {
          if (metaDrawer) {
            metaDrawer.classList.add('open');
            metaToggleBtn?.setAttribute('aria-expanded', 'true');
          }
          toast('Link PDF phải bắt đầu bằng http:// hoặc https://', 'error');
          pdfInput.focus();
        }
        return false;
      }
      pdfInput.style.borderColor = '';
      return true;
    };

    titleInput?.addEventListener('input', () => validateTitle(false));
    pdfInput?.addEventListener('input', () => {
      validatePdf(false);
      const previewContainer = document.querySelector('.pdf-preview-container');
      if (previewContainer) {
        if (pdfInput.value === 'latex') {
          state.assignmentEditor = collectEditor(lectures);
          state.assignmentEditor.assignment.pdf_url = 'latex';
          mountAssignmentManager(undefined, { skipSkeleton: true });
        } else {
          previewContainer.innerHTML = renderPdfPreview(pdfInput.value);
        }
      }
    });

    editorForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!validateTitle(true) || !validatePdf(true)) {
        return;
      }
      const saveBtn = editorForm.querySelector('#nh-ed-save-btn');
      const restore = setButtonLoading(saveBtn);
      try {
        const editor = collectEditor(lectures);
        const isUpdate = !!editor.assignment.id;
        const savedAssignment = await saveAssignmentWithQuestions(
          {
            ...editor.assignment,
            id: editor.assignment.id || undefined,
            lecture_id: editor.assignment.lecture_id || null,
            owner_id: state.profile.id,
          },
          editor.questions,
        );
        let regradedCount = 0;
        if (isUpdate) {
          regradedCount = await regradeAssignment(savedAssignment.id);
        }
        clearEditorDraft(getEditorStorage(), state.profile?.id, 'new');
        clearEditorDraft(getEditorStorage(), state.profile?.id, savedAssignment.id);
        const savedEditor = await fetchAssignmentEditor(savedAssignment.id);
        const prevLatexSource = editor.latexSource;
        const prevQuestions = editor.questions;
        state.assignmentEditor = normalizeAssignmentEditor(savedEditor);
        if (editor.assignment.pdf_url === 'latex' || !editor.assignment.pdf_url) {
          state.assignmentEditor.latexSource = prevLatexSource;
          if (prevQuestions && prevQuestions.length > 0) {
            state.assignmentEditor.questions = prevQuestions;
          }
        }
        state.isEditingAssignment = true;
        toast(regradedCount > 0 ? `Đã lưu đề và chấm lại ${regradedCount} bài đã nộp.` : 'Đã lưu đề thi.', 'success');
        if (route().id !== savedAssignment.id && typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState(null, '', `#/assignments/${savedAssignment.id}`);
        }
        await mountAssignmentManager(savedAssignment.id);
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        restore();
      }
    });

    editorForm.addEventListener('input', () => {
      state.assignmentEditor = collectEditor(lectures);
      persistCurrentEditorDraft();
    });
    editorForm.addEventListener('change', async (event) => {
      state.assignmentEditor = collectEditor(lectures);
      persistCurrentEditorDraft();
      if (event.target?.matches('select[name^="question-type-"]')) {
        refreshQuestionBuilder(lectures);
      }
    });
  }
}

export function defaultQuestion(type) {
  if (type === 'tf4') {
    return {
      type,
      prompt: '',
      points: 1,
      settings: { statements: ['', '', '', ''] },
      answer_key: { correct_answer: [true, true, true, true], points_map: [] },
    };
  }
  if (type === 'short') {
    return { type, prompt: '', points: 1, answer_key: { accepted_answers: [] } };
  }
  return {
    type: 'mcq',
    prompt: '',
    points: 1,
    choices: [],
    answer_key: { correct_answer: 'A' },
  };
}

export function collectEditor() {
  const form = document.querySelector('#assignment-editor');
  const values = Object.fromEntries(new FormData(form).entries());
  const existingQuestions = state.assignmentEditor?.questions || [];
  const resolvedPdfUrl = values.pdf_url !== undefined ? values.pdf_url : (state.assignmentEditor?.assignment?.pdf_url || 'latex');
  const isLatexMode = resolvedPdfUrl === 'latex' || !resolvedPdfUrl;

  // In LaTeX mode, questions come from state (managed by parseLatexAssignment)
  let questions;
  if (isLatexMode) {
    questions = existingQuestions;
  } else {
    questions = Array.from(document.querySelectorAll('.question-editor')).map((card) => {
      const index = Number(card.dataset.index);
      const existing = existingQuestions[index] || {};
      const type = values[`question-type-${index}`];
      const base = {
        id: values[`question-id-${index}`] || undefined,
        type,
        prompt: existing.prompt || `Câu ${index + 1}`,
        points: 1,
        sort_order: Number(values[`question-sort-${index}`] || index + 1),
        choices: existing.choices || [],
        settings: existing.settings || {},
        answer_key: {},
      };

      if (type === 'mcq') {
        base.answer_key = { correct_answer: values[`mcq-answer-${index}`] || 'A' };
      }
      if (type === 'tf4') {
        base.settings = {
          ...base.settings,
          statements: [0, 1, 2, 3].map((item) => values[`tf-statement-${index}-${item}`] || `Ý ${item + 1}`),
        };
        base.answer_key = {
          correct_answer: [0, 1, 2, 3].map((item) => values[`tf-answer-${index}-${item}`] === 'true'),
          points_map: [],
        };
      }
      if (type === 'short') {
        base.answer_key = {
          accepted_answers: String(values[`short-answers-${index}`] || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        };
      }
      return base;
    });
  }

  const customCategory = (values.category_tag || '').trim();
  const title = applyCategoryToTitle(values.title || '', customCategory);

  return {
    assignment: {
      id: values.id || undefined,
      title: title,
      description: isLatexMode ? (state.assignmentEditor?.latexSource || '') : values.description,
      pdf_url: resolvedPdfUrl,
      lecture_id: values.lecture_id || null,
      sort_order: Number(values.sort_order || 0),
      published: values.published !== 'false',
    },
    questions,
    latexSource: state.assignmentEditor?.latexSource || '',
  };
}
