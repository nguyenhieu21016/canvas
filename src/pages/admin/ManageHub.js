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

const ROW_TOP = [
  {
    id: 'students',
    href: '#/students',
    title: 'Theo dõi Học sinh',
    pill: '2 học sinh - 0 online',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  },
  {
    id: 'salary',
    href: '#/salary',
    title: 'Lịch dạy & Lương',
    pill: '8/12 buổi',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><path d="M17.5 17.5 16 16.3V14"/><circle cx="16" cy="16" r="6"/></svg>`,
  },
];

const ROW_BOTTOM = [
  {
    id: 'content',
    href: '#/content',
    title: 'Nội dung khóa học',
    pill: '5 giai đoạn - 77 bài',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><path d="M8 10v4"/><path d="M12 10v2"/><path d="M16 10v6"/></svg>`,
  },
  {
    id: 'assignments',
    href: '#/assignments',
    title: 'Đề thi & Bài tập',
    pill: '30 đề thi',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/></svg>`,
  },
  {
    id: 'question-bank',
    href: '#/question-bank',
    title: 'Ngân hàng đề',
    pill: '480 câu LaTeX',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>`,
  },
];

const ARROW_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;

function renderHubCard(item) {
  return `
    <a href="${item.href}" class="nh-hub-card" data-hub-card="${escapeHtml(item.id)}">
      <div class="nh-hub-card-top">
        <span class="nh-hub-icon">${item.icon}</span>
        <span class="nh-hub-arrow" aria-hidden="true">${ARROW_ICON}</span>
      </div>
      <div class="nh-hub-card-body">
        <h3 class="nh-hub-card-title">${escapeHtml(item.title)}</h3>
        <span class="nh-hub-card-meta" data-hub-pill="${escapeHtml(item.id)}">${escapeHtml(item.pill)}</span>
      </div>
    </a>
  `;
}

export function mountManageHub() {
  const root = pageRoot();

  root.innerHTML = `
    <style>
      .nh-hub-wrap {
        max-width: 920px;
        width: 100%;
        margin: 0 auto;
        padding: 28px 20px 64px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif;
      }

      .nh-hub-stack {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .nh-hub-grid {
        display: grid;
        gap: 14px;
      }

      .nh-hub-grid--two {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .nh-hub-grid--three {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .nh-hub-card {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 22px;
        min-height: 132px;
        padding: 20px;
        border-radius: 20px;
        background: #EBEDE6;
        color: #181B16;
        text-decoration: none;
        transition: background-color 0.15s ease;
      }

      .nh-hub-card:hover {
        background: #E2E5DC;
      }

      .nh-hub-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .nh-hub-icon {
        width: 36px;
        height: 36px;
        border-radius: 12px;
        background: #FFFFFF;
        color: #181B16;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .nh-hub-arrow {
        color: #64695F;
        display: inline-flex;
        align-items: center;
        transition: color 0.15s ease;
      }

      .nh-hub-card:hover .nh-hub-arrow {
        color: #181B16;
      }

      .nh-hub-card-body {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .nh-hub-card-title {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: -0.01em;
        line-height: 1.3;
        color: #181B16;
      }

      .nh-hub-card-meta {
        font-size: 13px;
        font-weight: 500;
        color: #64695F;
      }

      .nh-hub-card-meta.is-online {
        color: #2F6F4E;
        font-weight: 600;
      }

      @media (max-width: 720px) {
        .nh-hub-wrap {
          padding: 20px 16px 48px;
        }

        .nh-hub-grid--two,
        .nh-hub-grid--three {
          grid-template-columns: 1fr;
        }
      }
    </style>

    <section class="nh-hub-wrap">
      <!-- Dark Hero Banner (consistent with entire app) -->
      <header class="asg-overview-hero">
        <a href="#/learn" class="phase-back-link">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          <span>Lộ trình học tập</span>
        </a>
        <div class="asg-overview-hero-row">
          <div class="asg-overview-hero-left">
            <h1 class="phase-hero-title">Trung tâm Quản trị</h1>
          </div>
        </div>
      </header>

      <!-- Balanced 2 + 3 Grid (matches #/learn) -->
      <div class="nh-hub-stack">
        <div class="nh-hub-grid nh-hub-grid--two">
          ${ROW_TOP.map(renderHubCard).join('')}
        </div>
        <div class="nh-hub-grid nh-hub-grid--three">
          ${ROW_BOTTOM.map(renderHubCard).join('')}
        </div>
      </div>
    </section>
  `;

  const updateOnlineCount = () => {
    const onlineStudents = getOnlineUsers().filter((u) => u.role === 'student').length;
    const pill = root.querySelector('[data-hub-pill="students"]');
    if (pill && root.contains(pill)) {
      pill.textContent = `2 học sinh - ${onlineStudents} online`;
      pill.classList.toggle('is-online', onlineStudents > 0);
    }
  };
  updateOnlineCount();

  const onPresenceChange = () => updateOnlineCount();
  presenceTarget.addEventListener('change', onPresenceChange);

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

      if (pathRes.status === 'fulfilled' && pathRes.value) {
        const phasesCount = (pathRes.value.phases ?? []).length;
        const lecturesCount = (pathRes.value.lectures ?? []).length;
        const el = root.querySelector('[data-hub-pill="content"]');
        if (el) el.textContent = `${phasesCount} giai đoạn - ${lecturesCount} bài`;
      }

      if (assignRes.status === 'fulfilled' && Array.isArray(assignRes.value)) {
        const el = root.querySelector('[data-hub-pill="assignments"]');
        if (el) el.textContent = `${assignRes.value.length} đề thi`;
      }

      if (bankRes.status === 'fulfilled' && Array.isArray(bankRes.value)) {
        const el = root.querySelector('[data-hub-pill="question-bank"]');
        if (el) el.textContent = `${bankRes.value.length} câu LaTeX`;
      }

      if (salaryRes.status === 'fulfilled' && salaryRes.value) {
        const schedules = salaryRes.value.schedules ?? [];
        const logs = salaryRes.value.logs ?? [];
        const taughtCount = logs.filter((l) => l.status === 'taught').length;
        const totalSessions = schedules.length;
        const salaryPill = root.querySelector('[data-hub-pill="salary"]');
        if (salaryPill && totalSessions > 0) {
          salaryPill.textContent = `${taughtCount}/${totalSessions} buổi T${monthNum}`;
        }
      }
    });
  }

  return () => {
    presenceTarget.removeEventListener('change', onPresenceChange);
  };
}
