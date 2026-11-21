import { state, pageRoot } from '../../store.js';
import { wireRouteRetry, registerCleanup } from '../../router.js';
import { toast, renderLoading, renderErrorState } from '../../lib/ui.js';
import { escapeHtml, option, setButtonLoading } from '../../lib/html.js';
import {
  fetchLearningPath,
  upsertPhase,
  deletePhase,
  upsertModule,
  deleteModule,
  upsertLectureGroup,
  deleteLectureGroup,
  upsertLecture,
  deleteLecture,
  fetchStudents,
} from '../../services/lmsApi.js';

let currentContentPhaseId = null;
let currentContentModuleId = null;

const CM_ICONS = {
  plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
  edit: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"></path></svg>`,
  trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>`,
  close: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  slide: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`,
};

function splitChapterTitle(title = '', fallbackIndex = 1) {
  const match = String(title).match(/^(Chương\s*\d+)\s*[:\-–]\s*(.+)$/i);
  if (match) {
    return { short: match[1].trim(), sub: match[2].trim() };
  }
  return { short: `Chương ${fallbackIndex}`, sub: String(title).trim() || `Chương ${fallbackIndex}` };
}

const CM_STYLES = `
  <style>
    .cm-hub {
      max-width: 920px;
      margin: 0 auto;
      padding: 28px 20px 64px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif;
      color: #181B16;
    }
    .cm-hero-meta {
      margin: 6px 0 0;
      font-size: 13.5px;
      line-height: 1.4;
      color: rgba(247, 247, 242, 0.7);
      font-variant-numeric: tabular-nums;
    }
    .cm-hero-btn {
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
      flex-shrink: 0;
      transition: background-color 0.15s ease;
    }
    .cm-hero-btn:hover {
      background: #EBEDE6;
    }
    .cm-phase-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .cm-phase-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      flex: 1;
      min-width: 0;
    }
    .cm-phase-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 38px;
      padding: 0 15px;
      border: 0;
      border-radius: 9999px;
      background: #EBEDE6;
      color: #181B16;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .cm-phase-pill:hover {
      background: #E2E5DC;
    }
    .cm-phase-pill.active {
      background: #181B16;
      color: #F7F7F2;
    }
    .cm-phase-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .cm-grid {
      display: grid;
      grid-template-columns: 268px minmax(0, 1fr);
      gap: 18px;
      align-items: start;
    }
    .cm-side-card {
      position: sticky;
      top: 76px;
      background: #FFFFFF;
      border: 1px solid #E4E6DE;
      border-radius: 20px;
      padding: 12px 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: calc(100vh - 104px);
      overflow-y: auto;
    }
    .cm-side-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 4px 8px 8px;
      border-bottom: 1px solid #EFEFE9;
      margin-bottom: 2px;
    }
    .cm-side-label {
      font-size: 11.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #64695F;
    }
    .cm-pill-sm {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 30px;
      padding: 0 11px;
      border: 0;
      border-radius: 9999px;
      background: #EBEDE6;
      color: #181B16;
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .cm-pill-sm:hover {
      background: #181B16;
      color: #F7F7F2;
    }
    .cm-detail-card {
      background: #FFFFFF;
      border: 1px solid #E4E6DE;
      border-radius: 20px;
      overflow: hidden;
      min-width: 0;
    }
    .cm-detail-head {
      padding: 18px 20px;
      border-bottom: 1px solid #EFEFE9;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
    }
    .cm-detail-head-text {
      min-width: 0;
      flex: 1;
    }
    .cm-detail-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.35;
      color: #181B16;
    }
    .cm-detail-meta {
      margin: 4px 0 0;
      font-size: 12.5px;
      color: #64695F;
      font-variant-numeric: tabular-nums;
    }
    .cm-detail-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      flex-shrink: 0;
    }
    .cm-group-block + .cm-group-block {
      border-top: 1px solid #EFEFE9;
    }
    .cm-group-head {
      padding: 12px 20px;
      background: #FAFAF7;
      border-bottom: 1px solid #EFEFE9;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .cm-group-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #181B16;
      min-width: 0;
      line-height: 1.4;
    }
    .cm-group-count {
      font-weight: 500;
      color: #64695F;
      margin-left: 6px;
      font-size: 12px;
      white-space: nowrap;
    }
    .cm-lec-list {
      display: flex;
      flex-direction: column;
    }
    .cm-lec-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 20px 12px 28px;
      border-bottom: 1px solid #EFEFE9;
      transition: background-color 0.14s ease;
    }
    .cm-lec-row:last-child {
      border-bottom: none;
    }
    .cm-lec-row:hover {
      background: #F7F7F2;
    }
    .cm-lec-main {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex: 1;
    }
    .cm-lec-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #C8CCC0;
      flex-shrink: 0;
    }
    .cm-lec-title {
      font-size: 13.5px;
      font-weight: 500;
      color: #181B16;
      line-height: 1.45;
      min-width: 0;
      word-break: break-word;
    }
    .cm-slide-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 9999px;
      background: #EBEDE6;
      color: #64695F;
      font-size: 11px;
      font-weight: 600;
      flex-shrink: 0;
      text-decoration: none;
    }
    .cm-slide-tag:hover {
      background: #E2E5DC;
      color: #181B16;
    }
    .cm-icon-row {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
    }
    .cm-icon-btn {
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
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .cm-icon-btn:hover {
      background: #EBEDE6;
      color: #181B16;
    }
    .cm-icon-btn--danger:hover {
      background: #F8EAE8;
      color: #B8433A;
    }
    .cm-empty {
      padding: 40px 24px;
      text-align: center;
      color: #64695F;
      font-size: 13.5px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .cm-empty p {
      margin: 0;
    }
    /* Modal */
    .cm-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 200;
      background: rgba(24, 27, 22, 0.42);
      backdrop-filter: blur(4px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .cm-modal-backdrop.open {
      display: flex;
    }
    .cm-modal {
      width: 100%;
      max-width: 440px;
      max-height: calc(100vh - 48px);
      overflow-y: auto;
      background: #FFFFFF;
      border: 1px solid #E4E6DE;
      border-radius: 22px;
      padding: 22px 24px 24px;
      box-shadow: 0 24px 60px rgba(24, 27, 22, 0.18);
    }
    .cm-modal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 14px;
      margin-bottom: 16px;
      border-bottom: 1px solid #EFEFE9;
    }
    .cm-modal-title {
      margin: 0;
      font-size: 16.5px;
      font-weight: 700;
      color: #181B16;
    }
    .cm-modal-form {
      display: none;
      flex-direction: column;
      gap: 14px;
    }
    .cm-modal-form.active {
      display: flex;
    }
    .cm-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cm-field label {
      font-size: 12.5px;
      font-weight: 600;
      color: #64695F;
    }
    .cm-input {
      width: 100%;
      height: 40px;
      padding: 0 13px;
      border-radius: 12px;
      border: 1px solid #E4E6DE;
      background: #F7F7F2;
      color: #181B16;
      font-family: inherit;
      font-size: 14px;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    .cm-input:focus {
      border-color: #181B16;
      background: #FFFFFF;
    }
    .cm-input:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .cm-student-box {
      max-height: 150px;
      overflow-y: auto;
      border: 1px solid #E4E6DE;
      border-radius: 12px;
      padding: 10px 12px;
      background: #F7F7F2;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .cm-student-box-title {
      font-size: 12px;
      font-weight: 600;
      color: #64695F;
      margin-bottom: 2px;
    }
    .cm-student-check {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13.5px;
      color: #181B16;
      cursor: pointer;
    }
    .cm-student-check input {
      accent-color: #181B16;
      width: 15px;
      height: 15px;
    }
    .cm-modal-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 6px;
    }
    .cm-btn-primary {
      height: 40px;
      padding: 0 20px;
      border: 0;
      border-radius: 9999px;
      background: #181B16;
      color: #F7F7F2;
      font-family: inherit;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    .cm-btn-primary:hover {
      background: #2C3028;
    }
    .cm-btn-secondary {
      height: 40px;
      padding: 0 16px;
      border: 0;
      border-radius: 9999px;
      background: #EBEDE6;
      color: #181B16;
      font-family: inherit;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    .cm-btn-secondary:hover {
      background: #E2E5DC;
    }
    @media (max-width: 820px) {
      .cm-hub {
        padding: 20px 16px 48px;
      }
      .cm-grid {
        grid-template-columns: 1fr;
      }
      .cm-side-card {
        position: static;
        max-height: none;
      }
      .cm-lec-row {
        padding-left: 16px;
      }
    }
  </style>
`;

export function nextContentSortOrder(kind, values, pathData) {
  const byParent = {
    phase: pathData.phases ?? [],
    module: (pathData.modules ?? []).filter((item) => item.phase_id === values.phase_id),
    lectureGroup: (pathData.lectureGroups ?? []).filter((item) => item.module_id === values.module_id),
    lecture: (pathData.lectures ?? []).filter((item) => {
      if (values.group_id) return item.group_id === values.group_id;
      return item.module_id === values.module_id && !item.group_id;
    }),
  };
  const list = byParent[kind] ?? [];
  return list.reduce((max, item) => Math.max(max, Number(item.sort_order ?? 0)), -1) + 1;
}

export async function mountContentManager() {
  const root = pageRoot();
  root.innerHTML = renderLoading();

  try {
    let [data, students] = await Promise.all([
      fetchLearningPath(state.profile.role),
      fetchStudents(),
    ]);

    function ensureSelections() {
      if (!data.phases.length) {
        currentContentPhaseId = null;
        currentContentModuleId = null;
        return;
      }
      if (!currentContentPhaseId || !data.phases.some((p) => p.id === currentContentPhaseId)) {
        currentContentPhaseId = data.phases[0].id;
      }
      const activePhase = data.phases.find((p) => p.id === currentContentPhaseId);
      const mods = activePhase?.modules ?? [];
      if (!mods.length) {
        currentContentModuleId = null;
      } else if (!currentContentModuleId || !mods.some((m) => m.id === currentContentModuleId)) {
        currentContentModuleId = mods[0].id;
      }
    }

    ensureSelections();

    const MODAL_TITLES = {
      phase: { create: 'Thêm giai đoạn', edit: 'Sửa giai đoạn' },
      module: { create: 'Thêm chương', edit: 'Sửa chương' },
      lectureGroup: { create: 'Thêm bài học (nhóm)', edit: 'Sửa bài học (nhóm)' },
      lecture: { create: 'Thêm bài giảng', edit: 'Sửa bài giảng' },
    };

    function closeModal() {
      const backdrop = root.querySelector('#cm-modal-backdrop');
      if (!backdrop) return;
      backdrop.classList.remove('open');
      backdrop.querySelectorAll('.cm-modal-form').forEach((f) => f.classList.remove('active'));
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') closeModal();
    }
    window.addEventListener('keydown', onKeyDown);
    registerCleanup(() => window.removeEventListener('keydown', onKeyDown));

    function renderAll() {
      ensureSelections();
      const totalPhases = data.phases.length;
      const totalModules = (data.modules || []).length;
      const totalLectures = (data.lectures || []).length;
      const activePhase = data.phases.find((p) => p.id === currentContentPhaseId) || null;
      const activeModules = activePhase?.modules ?? [];
      const activeModule = activeModules.find((m) => m.id === currentContentModuleId) || null;

      let detailHtml = '';
      if (!activePhase) {
        detailHtml = `
          <div class="cm-empty">
            <p>Chưa có giai đoạn nào. Hãy tạo giai đoạn đầu tiên để bắt đầu.</p>
            <button type="button" class="cm-btn-primary" data-open-create="phase">Thêm giai đoạn</button>
          </div>
        `;
      } else if (!activeModule) {
        detailHtml = `
          <div class="cm-empty">
            <p>Giai đoạn này chưa có chương nào.</p>
            <button type="button" class="cm-btn-primary" data-open-create="module">Thêm chương đầu tiên</button>
          </div>
        `;
      } else {
        const groups = activeModule.lecture_groups ?? [];
        const ungrouped = (activeModule.lectures ?? []).filter((l) => !l.group_id);

        const renderLectureRow = (lecture) => `
          <div class="cm-lec-row">
            <div class="cm-lec-main">
              <span class="cm-lec-dot"></span>
              <span class="cm-lec-title">${escapeHtml(lecture.title)}</span>
              ${lecture.slide_url ? `<a href="${escapeHtml(lecture.slide_url)}" target="_blank" rel="noopener" class="cm-slide-tag" title="Mở tài liệu">${CM_ICONS.slide}<span>Slide</span></a>` : ''}
            </div>
            <div class="cm-icon-row">
              <button type="button" class="cm-icon-btn" data-edit-entity="lecture" data-entity-id="${escapeHtml(lecture.id)}" title="Sửa bài giảng">${CM_ICONS.edit}</button>
              <button type="button" class="cm-icon-btn cm-icon-btn--danger" data-delete-entity="lecture" data-entity-id="${escapeHtml(lecture.id)}" title="Xóa bài giảng">${CM_ICONS.trash}</button>
            </div>
          </div>
        `;

        let groupsHtml = '';
        for (const group of groups) {
          const lecs = group.lectures ?? [];
          groupsHtml += `
            <div class="cm-group-block">
              <div class="cm-group-head">
                <div class="cm-group-title">
                  ${escapeHtml(group.title)}
                  <span class="cm-group-count">${lecs.length} bài</span>
                </div>
                <div class="cm-icon-row">
                  <button type="button" class="cm-pill-sm" data-open-create="lecture" data-prefill-group="${escapeHtml(group.id)}" title="Thêm bài giảng vào nhóm này">${CM_ICONS.plus}<span>Bài</span></button>
                  <button type="button" class="cm-icon-btn" data-edit-entity="lectureGroup" data-entity-id="${escapeHtml(group.id)}" title="Sửa nhóm">${CM_ICONS.edit}</button>
                  <button type="button" class="cm-icon-btn cm-icon-btn--danger" data-delete-entity="lectureGroup" data-entity-id="${escapeHtml(group.id)}" title="Xóa nhóm">${CM_ICONS.trash}</button>
                </div>
              </div>
              <div class="cm-lec-list">
                ${lecs.length ? lecs.map(renderLectureRow).join('') : `<div class="cm-empty" style="padding: 20px;"><p>Chưa có bài giảng trong nhóm này.</p></div>`}
              </div>
            </div>
          `;
        }

        if (ungrouped.length) {
          groupsHtml += `
            <div class="cm-group-block">
              <div class="cm-group-head">
                <div class="cm-group-title">
                  Chưa phân nhóm
                  <span class="cm-group-count">${ungrouped.length} bài</span>
                </div>
              </div>
              <div class="cm-lec-list">${ungrouped.map(renderLectureRow).join('')}</div>
            </div>
          `;
        }

        if (!groups.length && !ungrouped.length) {
          groupsHtml = `
            <div class="cm-empty">
              <p>Chương này chưa có nhóm hoặc bài giảng nào.</p>
            </div>
          `;
        }

        detailHtml = `
          <div class="cm-detail-head">
            <div class="cm-detail-head-text">
              <h2 class="cm-detail-title">${escapeHtml(activeModule.title)}</h2>
              <p class="cm-detail-meta">${groups.length} nhóm - ${(activeModule.lectures ?? []).length} bài giảng</p>
            </div>
            <div class="cm-detail-actions">
              <button type="button" class="cm-pill-sm" data-open-create="lectureGroup">${CM_ICONS.plus}<span>Nhóm</span></button>
              <button type="button" class="cm-pill-sm" data-open-create="lecture">${CM_ICONS.plus}<span>Bài giảng</span></button>
              <button type="button" class="cm-icon-btn" data-edit-entity="module" data-entity-id="${escapeHtml(activeModule.id)}" title="Sửa chương">${CM_ICONS.edit}</button>
              <button type="button" class="cm-icon-btn cm-icon-btn--danger" data-delete-entity="module" data-entity-id="${escapeHtml(activeModule.id)}" title="Xóa chương">${CM_ICONS.trash}</button>
            </div>
          </div>
          ${groupsHtml}
        `;
      }

      root.innerHTML = `
        ${CM_STYLES}
        <section class="cm-hub">
          <header class="asg-overview-hero">
            <a href="#/manage" class="phase-back-link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>Trung tâm Quản trị</span>
            </a>
            <div class="asg-overview-hero-row">
              <div class="asg-overview-hero-left">
                <h1 class="phase-hero-title">Nội dung khóa học</h1>
                <p class="cm-hero-meta">${totalPhases} giai đoạn - ${totalModules} chương - ${totalLectures} bài giảng</p>
              </div>
              <button type="button" class="cm-hero-btn" data-open-create="phase">
                ${CM_ICONS.plus}
                <span>Thêm giai đoạn</span>
              </button>
            </div>
          </header>

          ${data.phases.length ? `
            <div class="cm-phase-row">
              <div class="cm-phase-bar">
                ${data.phases.map((p) => `
                  <button type="button" class="cm-phase-pill ${p.id === currentContentPhaseId ? 'active' : ''}" data-select-phase="${escapeHtml(p.id)}">
                    ${escapeHtml(p.title)}
                  </button>
                `).join('')}
              </div>
              ${activePhase ? `
                <div class="cm-phase-actions">
                  <button type="button" class="cm-icon-btn" data-edit-entity="phase" data-entity-id="${escapeHtml(activePhase.id)}" title="Sửa giai đoạn đang chọn">${CM_ICONS.edit}</button>
                  <button type="button" class="cm-icon-btn cm-icon-btn--danger" data-delete-entity="phase" data-entity-id="${escapeHtml(activePhase.id)}" title="Xóa giai đoạn đang chọn">${CM_ICONS.trash}</button>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <div class="cm-grid">
            <aside class="cm-side-card">
              <div class="cm-side-head">
                <span class="cm-side-label">Chương (${activeModules.length})</span>
                ${activePhase ? `<button type="button" class="cm-pill-sm" data-open-create="module">${CM_ICONS.plus}<span>Chương</span></button>` : ''}
              </div>
              ${activeModules.length ? activeModules.map((mod, idx) => {
                const parsed = splitChapterTitle(mod.title, idx + 1);
                const isSel = mod.id === currentContentModuleId;
                return `
                  <button type="button" class="phase-chapter-btn ${isSel ? 'active' : ''}" data-select-module="${escapeHtml(mod.id)}">
                    <div class="phase-chapter-btn-text">
                      <span class="phase-chapter-short">${escapeHtml(parsed.short)}</span>
                      <span class="phase-chapter-sub">${escapeHtml(parsed.sub)}</span>
                    </div>
                    <span class="phase-chapter-count">${(mod.lectures ?? []).length}</span>
                  </button>
                `;
              }).join('') : `<div class="cm-empty" style="padding: 20px 10px;"><p>Chưa có chương</p></div>`}
            </aside>

            <section class="cm-detail-card">
              ${detailHtml}
            </section>
          </div>
        </section>

        <!-- Modal Form Host -->
        <div class="cm-modal-backdrop" id="cm-modal-backdrop" role="dialog" aria-modal="true">
          <div class="cm-modal">
            <div class="cm-modal-head">
              <h3 class="cm-modal-title" id="cm-modal-title">Cấu hình</h3>
              <button type="button" class="cm-icon-btn" id="cm-modal-close" aria-label="Đóng">${CM_ICONS.close}</button>
            </div>

            <!-- Phase Form -->
            <form class="cm-modal-form" data-entity="phase">
              <input type="hidden" name="id">
              <input type="hidden" name="description" value="">
              <input type="hidden" name="sort_order" value="0">
              <input type="hidden" name="published" value="true">
              <div class="cm-field">
                <label>Tên giai đoạn</label>
                <input class="cm-input" name="title" placeholder="VD: Giai đoạn I - Nhận biết và thông hiểu" required>
              </div>
              <div class="cm-student-box">
                <div class="cm-student-box-title">Hiển thị cho học sinh (để trống = tất cả)</div>
                ${students.map((s) => `
                  <label class="cm-student-check">
                    <input type="checkbox" name="student_ids" value="${escapeHtml(s.id)}">
                    <span>${escapeHtml(s.full_name)}</span>
                  </label>
                `).join('')}
              </div>
              <div class="cm-modal-actions">
                <button type="button" class="cm-btn-secondary" data-close-modal>Hủy</button>
                <button type="submit" class="cm-btn-primary">Lưu</button>
              </div>
            </form>

            <!-- Module Form -->
            <form class="cm-modal-form" data-entity="module">
              <input type="hidden" name="id">
              <input type="hidden" name="description" value="">
              <input type="hidden" name="sort_order" value="0">
              <input type="hidden" name="published" value="true">
              <div class="cm-field">
                <label>Thuộc giai đoạn</label>
                <select class="cm-input" name="phase_id" required>
                  <option value="">-- Chọn giai đoạn --</option>
                  ${data.phases.map((p) => option(p.id, p.title)).join('')}
                </select>
              </div>
              <div class="cm-field">
                <label>Tên chương</label>
                <input class="cm-input" name="title" placeholder="VD: CHƯƠNG 1: ỨNG DỤNG ĐẠO HÀM..." required>
              </div>
              <div class="cm-modal-actions">
                <button type="button" class="cm-btn-secondary" data-close-modal>Hủy</button>
                <button type="submit" class="cm-btn-primary">Lưu</button>
              </div>
            </form>

            <!-- Lecture Group Form -->
            <form class="cm-modal-form" data-entity="lectureGroup">
              <input type="hidden" name="id">
              <input type="hidden" name="description" value="">
              <input type="hidden" name="sort_order" value="0">
              <input type="hidden" name="published" value="true">
              <div class="cm-field">
                <label>Giai đoạn</label>
                <select class="cm-input cascade-phase" name="phase_id" required>
                  <option value="">-- Chọn giai đoạn --</option>
                  ${data.phases.map((p) => option(p.id, p.title)).join('')}
                </select>
              </div>
              <div class="cm-field">
                <label>Chương</label>
                <select class="cm-input cascade-module" name="module_id" required>
                  <option value="">-- Chọn chương --</option>
                  ${(data.modules || []).map((m) => `<option value="${escapeHtml(m.id)}" data-phase-id="${escapeHtml(m.phase_id)}">${escapeHtml(m.title)}</option>`).join('')}
                </select>
              </div>
              <div class="cm-field">
                <label>Tên bài học (nhóm)</label>
                <input class="cm-input" name="title" placeholder="VD: Bài 1: Sự đồng biến, nghịch biến..." required>
              </div>
              <div class="cm-modal-actions">
                <button type="button" class="cm-btn-secondary" data-close-modal>Hủy</button>
                <button type="submit" class="cm-btn-primary">Lưu</button>
              </div>
            </form>

            <!-- Lecture Form -->
            <form class="cm-modal-form" data-entity="lecture">
              <input type="hidden" name="id">
              <input type="hidden" name="description" value="">
              <input type="hidden" name="sort_order" value="0">
              <input type="hidden" name="published" value="true">
              <div class="cm-field">
                <label>Giai đoạn</label>
                <select class="cm-input cascade-phase" name="phase_id" required>
                  <option value="">-- Chọn giai đoạn --</option>
                  ${data.phases.map((p) => option(p.id, p.title)).join('')}
                </select>
              </div>
              <div class="cm-field">
                <label>Chương</label>
                <select class="cm-input cascade-module" name="module_id" required>
                  <option value="">-- Chọn chương --</option>
                  ${(data.modules || []).map((m) => `<option value="${escapeHtml(m.id)}" data-phase-id="${escapeHtml(m.phase_id)}">${escapeHtml(m.title)}</option>`).join('')}
                </select>
              </div>
              <div class="cm-field">
                <label>Bài học (nhóm)</label>
                <select class="cm-input cascade-group" name="group_id">
                  <option value="">-- Chưa chọn nhóm --</option>
                  ${(data.lectureGroups || []).map((g) => `<option value="${escapeHtml(g.id)}" data-module-id="${escapeHtml(g.module_id)}">${escapeHtml(g.title)}</option>`).join('')}
                </select>
              </div>
              <div class="cm-field">
                <label>Tên bài giảng</label>
                <input class="cm-input" name="title" placeholder="VD: 1.1. Dạng 1 - Xét tính đơn điệu..." required>
              </div>
              <div class="cm-field">
                <label>Link Google Drive Slide / Tài liệu</label>
                <input class="cm-input" name="slide_url" placeholder="https://drive.google.com/...">
              </div>
              <div class="cm-modal-actions">
                <button type="button" class="cm-btn-secondary" data-close-modal>Hủy</button>
                <button type="submit" class="cm-btn-primary">Lưu</button>
              </div>
            </form>
          </div>
        </div>
      `;

      wireEvents();
    }

    function syncCascade(form) {
      const phaseSel = form.querySelector('.cascade-phase');
      const modSel = form.querySelector('.cascade-module');
      const grpSel = form.querySelector('.cascade-group');

      if (phaseSel && modSel) {
        const pid = phaseSel.value;
        let hasMods = false;
        Array.from(modSel.options).forEach((opt) => {
          if (!opt.value) return;
          const match = opt.dataset.phaseId === pid;
          opt.hidden = !match;
          opt.disabled = !match;
          if (match) hasMods = true;
        });
        if (modSel.selectedOptions[0]?.disabled) modSel.value = '';
        modSel.disabled = !pid || !hasMods;
      }

      if (modSel && grpSel) {
        const mid = modSel.value;
        let hasGrps = false;
        Array.from(grpSel.options).forEach((opt) => {
          if (!opt.value) return;
          const match = opt.dataset.moduleId === mid;
          opt.hidden = !match;
          opt.disabled = !match;
          if (match) hasGrps = true;
        });
        if (grpSel.selectedOptions[0]?.disabled) grpSel.value = '';
        grpSel.disabled = !mid || !hasGrps;
      }
    }

    function openModal(kind, mode, payload = null, prefillGroupId = null) {
      const backdrop = root.querySelector('#cm-modal-backdrop');
      const titleEl = root.querySelector('#cm-modal-title');
      const form = backdrop?.querySelector(`.cm-modal-form[data-entity="${kind}"]`);
      if (!backdrop || !form) return;

      backdrop.querySelectorAll('.cm-modal-form').forEach((f) => f.classList.remove('active'));
      form.reset();
      form.querySelector('[name="id"]').value = '';
      if (kind === 'phase') {
        form.querySelectorAll('[name="student_ids"]').forEach((cb) => { cb.checked = false; });
      }

      titleEl.textContent = MODAL_TITLES[kind]?.[mode] || 'Cấu hình';

      if (mode === 'edit' && payload) {
        Object.entries(payload).forEach(([key, value]) => {
          if (key === 'student_ids' && Array.isArray(value)) {
            value.forEach((id) => {
              const cb = form.querySelector(`[name="student_ids"][value="${id}"]`);
              if (cb) cb.checked = true;
            });
            return;
          }
          const input = form.querySelector(`[name="${key}"]`);
          if (!input) return;
          if (input.type === 'checkbox') input.checked = Boolean(value);
          else input.value = value ?? '';
        });

        const phaseSel = form.querySelector('.cascade-phase');
        const modSel = form.querySelector('.cascade-module');
        const grpSel = form.querySelector('.cascade-group');
        if (phaseSel && modSel) {
          let pid = payload.phase_id;
          if (!pid && payload.module_id) {
            pid = modSel.querySelector(`option[value="${payload.module_id}"]`)?.dataset.phaseId || '';
          }
          phaseSel.value = pid || '';
          syncCascade(form);
          if (payload.module_id) {
            modSel.value = payload.module_id;
            syncCascade(form);
          }
          if (grpSel && payload.group_id) {
            grpSel.value = payload.group_id;
          }
        }
      } else {
        // Smart prefill for create mode
        const phaseInput = form.querySelector('[name="phase_id"]');
        if (phaseInput && currentContentPhaseId) {
          phaseInput.value = currentContentPhaseId;
        }
        syncCascade(form);
        const modSel = form.querySelector('.cascade-module');
        if (modSel && currentContentModuleId) {
          modSel.value = currentContentModuleId;
          syncCascade(form);
        }
        const grpSel = form.querySelector('.cascade-group');
        if (grpSel && prefillGroupId) {
          grpSel.value = prefillGroupId;
        }
      }

      form.classList.add('active');
      backdrop.classList.add('open');
      form.querySelector('input[name="title"]')?.focus();
    }

    function findEntity(kind, id) {
      if (kind === 'phase') return data.phases.find((x) => x.id === id);
      if (kind === 'module') return (data.modules || []).find((x) => x.id === id);
      if (kind === 'lectureGroup') return (data.lectureGroups || []).find((x) => x.id === id);
      if (kind === 'lecture') return (data.lectures || []).find((x) => x.id === id);
      return null;
    }

    function wireEvents() {
      // Phase selection
      root.querySelectorAll('[data-select-phase]').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentContentPhaseId = btn.dataset.selectPhase;
          currentContentModuleId = null;
          renderAll();
        });
      });

      // Module selection
      root.querySelectorAll('[data-select-module]').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentContentModuleId = btn.dataset.selectModule;
          renderAll();
        });
      });

      // Open create modal
      root.querySelectorAll('[data-open-create]').forEach((btn) => {
        btn.addEventListener('click', () => {
          openModal(btn.dataset.openCreate, 'create', null, btn.dataset.prefillGroup || null);
        });
      });

      // Open edit modal
      root.querySelectorAll('[data-edit-entity]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const kind = btn.dataset.editEntity;
          const payload = findEntity(kind, btn.dataset.entityId);
          if (payload) openModal(kind, 'edit', payload);
        });
      });

      // Delete entity
      root.querySelectorAll('[data-delete-entity]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!window.confirm('Xóa mục này? Hành động này không thể hoàn tác.')) return;
          const kind = btn.dataset.deleteEntity;
          const id = btn.dataset.entityId;
          try {
            if (kind === 'phase') await deletePhase(id);
            else if (kind === 'module') await deleteModule(id);
            else if (kind === 'lectureGroup') await deleteLectureGroup(id);
            else if (kind === 'lecture') await deleteLecture(id);
            toast('Đã xóa.', 'success');
            data = await fetchLearningPath(state.profile.role);
            renderAll();
          } catch (err) {
            toast(err.message, 'error');
          }
        });
      });

      // Modal close triggers
      const backdrop = root.querySelector('#cm-modal-backdrop');
      backdrop?.addEventListener('click', (e) => {
        if (e.target === backdrop) closeModal();
      });
      root.querySelector('#cm-modal-close')?.addEventListener('click', closeModal);
      root.querySelectorAll('[data-close-modal]').forEach((btn) => {
        btn.addEventListener('click', closeModal);
      });

      // Cascading selects + submit handlers
      root.querySelectorAll('.cm-modal-form').forEach((form) => {
        const phaseSel = form.querySelector('.cascade-phase');
        const modSel = form.querySelector('.cascade-module');
        phaseSel?.addEventListener('change', () => syncCascade(form));
        modSel?.addEventListener('change', () => syncCascade(form));

        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (form.dataset.saving === 'true') return;

          const kind = form.dataset.entity;
          const formData = new FormData(form);
          const values = Object.fromEntries(formData.entries());
          const sortOrder = values.id
            ? Number(values.sort_order || 0)
            : nextContentSortOrder(kind, values, data);

          const payload = {
            ...values,
            sort_order: sortOrder,
            published: values.published !== 'false',
            owner_id: state.profile.id,
          };
          if (!payload.id) delete payload.id;
          if (kind === 'phase') {
            payload.student_ids = formData.getAll('student_ids');
          }

          const submitBtn = form.querySelector('button[type="submit"]');
          const restore = setButtonLoading(submitBtn);
          form.dataset.saving = 'true';

          try {
            let saved;
            if (kind === 'phase') {
              saved = await upsertPhase(payload);
              if (!values.id && saved?.id) currentContentPhaseId = saved.id;
            } else if (kind === 'module') {
              saved = await upsertModule(payload);
              if (!values.id && saved?.id) {
                currentContentPhaseId = payload.phase_id || currentContentPhaseId;
                currentContentModuleId = saved.id;
              }
            } else if (kind === 'lectureGroup') {
              delete payload.phase_id;
              saved = await upsertLectureGroup(payload);
            } else if (kind === 'lecture') {
              delete payload.phase_id;
              let group_id = payload.group_id || null;
              if (group_id === 'undefined') group_id = null;
              saved = await upsertLecture({ ...payload, group_id });
            }

            toast(values.id ? 'Đã cập nhật nội dung.' : 'Đã lưu thành công.', 'success');
            closeModal();
            data = await fetchLearningPath(state.profile.role);
            renderAll();
          } catch (err) {
            toast(`Lỗi lưu: ${err.message}`, 'error');
          } finally {
            delete form.dataset.saving;
            restore();
          }
        });
      });
    }

    renderAll();
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}
