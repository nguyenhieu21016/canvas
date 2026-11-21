import { pageRoot, state } from '../../store.js';
import { escapeHtml } from '../../lib/html.js';
import { hasSupabaseConfig } from '../../services/supabaseClient.js';
import {
  fetchAssignmentsForManager,
  fetchLearningPath,
  fetchQuestionBank,
  fetchSalaryMonth,
  getOnlineUsers,
  presenceTarget,
} from '../../services/lmsApi.js';

const SECTIONS = [
  {
    id: 'academic',
    title: 'Chuyên môn & Học liệu',
    metaKey: 'academic',
    defaultMeta: '68 bài giảng - 18 đề - 480 câu',
    columns: 3,
    items: [
      {
        id: 'content',
        href: '#/content',
        title: 'Quản lý Nội dung khóa học',
        pill: '4 giai đoạn - 68 bài giảng',
        tone: 'neutral',
        keywords: 'khóa học giai đoạn chương bài giảng nội dung',
        icon: `<svg class="lucide lucide-folder-kanban" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><path d="M8 10v4"/><path d="M12 10v2"/><path d="M16 10v6"/></svg>`,
      },
      {
        id: 'assignments',
        href: '#/assignments',
        title: 'Quản lý Đề thi & Bài tập',
        pill: '18 đề thi - 36 lượt nộp',
        tone: 'neutral',
        keywords: 'đề thi bài tập chấm điểm phiếu trả lời latex',
        icon: `<svg class="lucide lucide-file-check-2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/></svg>`,
      },
      {
        id: 'question-bank',
        href: '#/question-bank',
        title: 'Ngân hàng đề',
        pill: '480 câu hỏi LaTeX',
        tone: 'neutral',
        keywords: 'ngân hàng đề câu hỏi kho latex trắc nghiệm',
        icon: `<svg class="lucide lucide-database" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>`,
      },
    ],
  },
  {
    id: 'operations',
    title: 'Theo dõi lớp & Vận hành',
    metaKey: 'ops',
    defaultMeta: '2 học sinh - 8 / 12 buổi dạy T11',
    columns: 3,
    items: [
      {
        id: 'students',
        href: '#/students',
        title: 'Theo dõi Học sinh',
        pill: '2 học sinh - 0 đang online',
        tone: 'success',
        keywords: 'học sinh tiến độ bảng điểm online theo dõi',
        icon: `<svg class="lucide lucide-users" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      },
      {
        id: 'salary',
        href: '#/salary',
        title: 'Lịch dạy & Lương',
        pill: '8 / 12 buổi T11',
        tone: 'warning',
        keywords: 'lịch dạy lương điểm danh trợ giảng thu nhập',
        icon: `<svg class="lucide lucide-calendar-clock" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><path d="M17.5 17.5 16 16.3V14"/><circle cx="16" cy="16" r="6"/></svg>`,
      },
    ],
  },
];

const ARROW_ICON = `<svg class="lucide lucide-arrow-right" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;

function renderCard(item) {
  return `
    <a
      href="${item.href}"
      class="nh-hub-card"
      data-hub-card="${escapeHtml(item.id)}"
      data-search="${escapeHtml(`${item.title} ${item.keywords}`)}"
    >
      <div class="nh-hub-card-top">
        <div class="nh-hub-card-left">
          <span class="nh-hub-icon-box">${item.icon}</span>
          <span class="nh-hub-pill nh-hub-pill--${item.tone}" data-hub-pill="${escapeHtml(item.id)}">${escapeHtml(item.pill)}</span>
        </div>
        <span class="nh-hub-arrow" aria-hidden="true">${ARROW_ICON}</span>
      </div>
      <h3 class="nh-hub-card-title">${escapeHtml(item.title)}</h3>
    </a>
  `;
}

export function mountManageHub() {
  const root = pageRoot();

  root.innerHTML = `
    <style>
      .nh-hub-page {
        min-height: calc(100vh - 64px);
        background: #F7F7F2;
        padding-bottom: 56px;
        font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif;
        color: #181B16;
      }

      .nh-hub-wrap {
        max-width: 920px;
        width: 100%;
        margin: 0 auto;
        padding: 28px 24px 0;
        display: flex;
        flex-direction: column;
        gap: 28px;
      }

      .nh-hub-head {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      @media (min-width: 640px) {
        .nh-hub-wrap {
          padding-top: 36px;
        }
        .nh-hub-head {
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
        }
      }

      .nh-hub-title {
        font-family: var(--md-ref-typeface-brand);
        font-size: 28px;
        font-weight: 800;
        font-variation-settings: 'wght' 800;
        line-height: 1.2;
        letter-spacing: -0.015em;
        color: #181B16;
        margin: 0;
        text-wrap: balance;
      }

      .nh-hub-search {
        width: 100%;
        height: 42px;
        border-radius: 9999px;
        border: 1px solid transparent;
        background: #EBEDE6;
        padding: 0 18px;
        font-size: 14px;
        color: #181B16;
        outline: none;
        transition: background-color 0.15s ease, border-color 0.15s ease;
      }

      @media (min-width: 640px) {
        .nh-hub-search {
          width: 280px;
          flex-shrink: 0;
        }
      }

      .nh-hub-search::placeholder {
        color: #64695F;
      }

      .nh-hub-search:focus {
        background: #FFFFFF;
        border-color: #181B16;
      }

      .nh-hub-section {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .nh-hub-section-head {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      @media (min-width: 640px) {
        .nh-hub-section-head {
          flex-direction: row;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }
      }

      .nh-hub-section-title {
        margin: 0;
        font-size: 11px;
        line-height: 1.5;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #64695F;
        text-wrap: balance;
      }

      .nh-hub-section-meta {
        font-size: 12px;
        line-height: 1.5;
        font-weight: 400;
        color: #64695F;
        font-variant-numeric: tabular-nums;
      }

      .nh-hub-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 12px;
      }

      @media (min-width: 640px) {
        .nh-hub-grid--2,
        .nh-hub-grid--3 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (min-width: 900px) {
        .nh-hub-grid--3 {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      .nh-hub-card {
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 20px;
        border-radius: 20px;
        border: 1px solid transparent;
        background: #EBEDE6;
        color: #181B16;
        text-decoration: none;
        outline: none;
        transition: background-color 0.15s ease;
      }

      .nh-hub-card:hover {
        background: #E2E5DC;
      }

      .nh-hub-card:focus,
      .nh-hub-card:focus-visible {
        outline: none;
        background: #E2E5DC;
      }

      .nh-hub-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .nh-hub-card-left {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .nh-hub-icon-box {
        width: 34px;
        height: 34px;
        border-radius: 9999px;
        background: #FFFFFF;
        color: #181B16;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: background-color 0.15s ease, color 0.15s ease;
      }

      .nh-hub-card:hover .nh-hub-icon-box {
        background: #181B16;
        color: #F7F7F2;
      }

      .nh-hub-pill {
        display: inline-flex;
        align-items: center;
        padding: 0;
        border-radius: 0;
        font-size: 12px;
        font-weight: 400;
        line-height: 1.3;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }

      .nh-hub-pill--neutral {
        background: transparent;
        color: #64695F;
      }

      .nh-hub-pill--success {
        background: transparent;
        color: #1B6B46;
        font-weight: 500;
      }

      .nh-hub-pill--warning {
        background: transparent;
        color: #64695F;
      }

      .nh-hub-arrow {
        width: 28px;
        height: 28px;
        border-radius: 9999px;
        border: 0;
        background: transparent;
        color: #64695F;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: color 0.15s ease;
      }

      .nh-hub-card:hover .nh-hub-arrow {
        color: #181B16;
      }

      .nh-hub-card-title {
        margin: 0;
        font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif;
        font-size: 15px;
        font-weight: 600;
        line-height: 1.35;
        letter-spacing: -0.01em;
        color: #181B16;
        text-wrap: balance;
      }

      .nh-hub-empty {
        padding: 32px 20px;
        border-radius: 20px;
        border: 0;
        background: #EBEDE6;
        text-align: center;
        font-size: 14px;
        color: #64695F;
      }

      .nh-hub-empty strong {
        color: #181B16;
        font-weight: 600;
      }

      .nh-hub-clear-btn {
        display: inline;
        border: 0;
        background: transparent;
        padding: 0;
        margin-left: 4px;
        font: inherit;
        font-weight: 600;
        color: #181B16;
        text-decoration: underline;
        text-underline-offset: 4px;
        cursor: pointer;
      }
    </style>

    <div class="nh-hub-page">
      <div class="nh-admin-breadcrumb-bar">
        <div class="nh-admin-breadcrumb-inner">
          <a href="#/learn">Trang chủ</a>
          <span class="sep" aria-hidden="true">/</span>
          <span class="active">Trung tâm Quản trị</span>
        </div>
      </div>

      <div class="nh-hub-wrap">
        <header class="nh-hub-head">
          <h1 class="nh-hub-title">Trung tâm Quản trị</h1>
          <input
            id="nh-hub-search"
            class="nh-hub-search"
            type="search"
            placeholder="Tìm nhanh phân hệ..."
            aria-label="Tìm nhanh phân hệ"
          />
        </header>

        ${SECTIONS.map(
    (section) => `
          <section class="nh-hub-section" data-hub-section="${escapeHtml(section.id)}">
            <div class="nh-hub-section-head">
              <h2 class="nh-hub-section-title">${escapeHtml(section.title)}</h2>
              <span class="nh-hub-section-meta" data-hub-meta="${escapeHtml(section.metaKey)}">${escapeHtml(section.defaultMeta)}</span>
            </div>
            <div class="nh-hub-grid nh-hub-grid--${section.columns}">
              ${section.items.map((item) => renderCard(item)).join('')}
            </div>
          </section>
        `,
  ).join('')}

        <div id="nh-hub-empty" class="nh-hub-empty" hidden></div>
      </div>
    </div>
  `;

  const searchInput = root.querySelector('#nh-hub-search');
  const emptyBox = root.querySelector('#nh-hub-empty');
  const sectionEls = [...root.querySelectorAll('[data-hub-section]')];
  const cardEls = [...root.querySelectorAll('[data-hub-card]')];

  function applyFilter() {
    const rawQuery = searchInput?.value.trim() ?? '';
    const q = rawQuery.toLowerCase();
    let visibleCount = 0;

    for (const sectionEl of sectionEls) {
      let sectionMatches = 0;
      for (const card of sectionEl.querySelectorAll('[data-hub-card]')) {
        const haystack = (card.dataset.search ?? '').toLowerCase();
        const match = !q || haystack.includes(q);
        card.hidden = !match;
        if (match) {
          sectionMatches += 1;
          visibleCount += 1;
        }
      }
      sectionEl.hidden = sectionMatches === 0;
    }

    if (emptyBox) {
      if (visibleCount === 0 && cardEls.length > 0) {
        const clipped = rawQuery.length > 24 ? `${rawQuery.slice(0, 24)}…` : rawQuery;
        emptyBox.innerHTML = `Không có phân hệ nào khớp <strong title="${escapeHtml(rawQuery)}">"${escapeHtml(clipped)}"</strong>. Thử từ khoá khác. <button type="button" class="nh-hub-clear-btn" id="nh-hub-clear-search">Xoá tìm kiếm</button>`;
        emptyBox.hidden = false;
        emptyBox.querySelector('#nh-hub-clear-search')?.addEventListener('click', () => {
          if (searchInput) {
            searchInput.value = '';
            applyFilter();
            searchInput.focus();
          }
        });
      } else {
        emptyBox.hidden = true;
      }
    }
  }

  searchInput?.addEventListener('input', applyFilter);

  const updateOnlineCount = () => {
    const onlineStudents = getOnlineUsers().filter((u) => u.role === 'student').length;
    const pill = root.querySelector('[data-hub-pill="students"]');
    if (pill && root.contains(pill)) {
      pill.textContent = `2 học sinh - ${onlineStudents} đang online`;
    }
  };
  updateOnlineCount();

  const onPresenceChange = () => updateOnlineCount();
  presenceTarget.addEventListener('change', onPresenceChange);

  // Hydrate live counts asynchronously when Supabase session is active
  if (hasSupabaseConfig && state.session) {
    const now = new Date();
    const role = state.profile?.role ?? 'admin';
    const monthNum = now.getMonth() + 1;
    Promise.allSettled([
      fetchLearningPath(role),
      fetchAssignmentsForManager({ limit: 500 }),
      fetchQuestionBank({ limit: 500 }),
      fetchSalaryMonth(now.getFullYear(), monthNum),
    ]).then(([pathRes, assignRes, bankRes, salaryRes]) => {
      if (!document.body.contains(root)) return;

      let phasesCount = 4;
      let lecturesCount = 68;
      if (pathRes.status === 'fulfilled' && pathRes.value) {
        phasesCount = (pathRes.value.phases ?? []).length;
        lecturesCount = (pathRes.value.lectures ?? []).length;
        const el = root.querySelector('[data-hub-pill="content"]');
        if (el) el.textContent = `${phasesCount} giai đoạn - ${lecturesCount} bài giảng`;
      }

      let assignCount = 18;
      if (assignRes.status === 'fulfilled' && Array.isArray(assignRes.value)) {
        assignCount = assignRes.value.length;
        const el = root.querySelector('[data-hub-pill="assignments"]');
        if (el) el.textContent = `${assignCount} đề thi`;
      }

      let bankCount = 480;
      if (bankRes.status === 'fulfilled' && Array.isArray(bankRes.value)) {
        bankCount = bankRes.value.length;
        const el = root.querySelector('[data-hub-pill="question-bank"]');
        if (el) el.textContent = `${bankCount} câu hỏi LaTeX`;
      }

      const academicMeta = root.querySelector('[data-hub-meta="academic"]');
      if (academicMeta) {
        academicMeta.textContent = `${lecturesCount} bài giảng - ${assignCount} đề - ${bankCount} câu`;
      }

      if (salaryRes.status === 'fulfilled' && salaryRes.value) {
        const schedules = salaryRes.value.schedules ?? [];
        const logs = salaryRes.value.logs ?? [];
        const taughtCount = logs.filter((l) => l.status === 'taught').length;
        const totalSessions = schedules.length;
        const salaryPill = root.querySelector('[data-hub-pill="salary"]');
        if (salaryPill && totalSessions > 0) {
          salaryPill.textContent = `${taughtCount} / ${totalSessions} buổi T${monthNum}`;
        }
        const opsMeta = root.querySelector('[data-hub-meta="ops"]');
        if (opsMeta && totalSessions > 0) {
          opsMeta.textContent = `2 học sinh - ${taughtCount} / ${totalSessions} buổi dạy T${monthNum}`;
        }
      }
    });
  }

  return () => {
    presenceTarget.removeEventListener('change', onPresenceChange);
  };
}
