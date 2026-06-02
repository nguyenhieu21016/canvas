import '@material/web/button/filled-button.js';
import '@material/web/button/filled-tonal-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/icon/icon.js';
import '@material/web/progress/circular-progress.js';
import '@material/web/switch/switch.js';
import '@material/web/textfield/outlined-text-field.js';
import './styles.css';
import { hasSupabaseConfig, supabase } from './services/supabaseClient.js';
import {
  deleteAssignment,
  deleteLecture,
  deleteLectureGroup,
  deleteManagedUser,
  deleteModule,
  deletePhase,
  createManagedUser,
  fetchAssignmentEditor,
  fetchAssignmentForStudent,
  fetchAssignmentInsights,
  fetchAssignmentsForManager,
  fetchAttemptReview,
  fetchDashboardStats,
  fetchGradebook,
  fetchLearningPath,
  fetchMyHistory,
  fetchStudentAssignmentOverview,
  fetchStudents,
  getCurrentProfile,
  getSession,
  invokeAdminFunction,
  saveAssignmentWithQuestions,
  signIn,
  signOut,
  signUpStudent,
  submitAssignmentAttempt,
  upsertLecture,
  upsertLectureGroup,
  upsertModule,
  upsertPhase,
} from './services/lmsApi.js';
import { clearDraft, loadDraft, saveDraft } from './lib/draft.js';
import { toDrivePreviewUrl } from './lib/drive.js';
import { formatDateTime, formatScore, roleLabel } from './lib/format.js';
import { escapeHtml, option, setButtonLoading } from './lib/html.js';

const app = document.querySelector('#app');
const toastEl = document.querySelector('#toast');
const detachedPageRoot = {
  isConnected: false,
  set innerHTML(_value) {},
  get innerHTML() {
    return '';
  },
};

const state = {
  session: null,
  profile: null,
  authMode: 'login',
  assignmentEditor: null,
  theme: localStorage.getItem('lms:theme') || 'light',
  colorTheme: localStorage.getItem('lms:colorTheme') || 'blue',
};

const colorThemes = [
  { id: 'blue', label: 'Blue pastel', color: '#d3e4ff' },
  { id: 'yellow', label: 'Yellow pastel', color: '#f8e287' },
  { id: 'pink', label: 'Pink pastel', color: '#ffd8e4' },
  { id: 'green', label: 'Green pastel', color: '#d9f0c3' },
  { id: 'lavender', label: 'Lavender pastel', color: '#eaddff' },
];

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.color = state.colorTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    colorThemes.find((theme) => theme.id === state.colorTheme)?.color ?? '#d3e4ff',
  );
}

function setThemeMode(mode) {
  state.theme = mode;
  localStorage.setItem('lms:theme', state.theme);
  applyTheme();
}

function setColorTheme(colorTheme) {
  state.colorTheme = colorTheme;
  localStorage.setItem('lms:colorTheme', state.colorTheme);
  applyTheme();
}

applyTheme();

function wireMaterialFormButtons(root = document) {
  if (!root) return;
  root.querySelectorAll('md-filled-button[type="submit"], md-filled-tonal-button[type="submit"], md-outlined-button[type="submit"]').forEach((button) => {
    if (button.dataset.formBridge === 'true') return;
    button.dataset.formBridge = 'true';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      if (button.disabled) return;
      button.closest('form')?.requestSubmit();
    });
  });

  root.querySelectorAll('md-filled-button[type="reset"], md-filled-tonal-button[type="reset"], md-outlined-button[type="reset"]').forEach((button) => {
    if (button.dataset.formBridge === 'true') return;
    button.dataset.formBridge = 'true';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      button.closest('form')?.reset();
    });
  });
}

function isManager() {
  return state.profile?.role === 'teacher' || state.profile?.role === 'admin';
}

function isAdmin() {
  return state.profile?.role === 'admin';
}

function route() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [name = 'learn', id = null] = hash.split('/');
  return { name: name || 'learn', id };
}

function go(path) {
  window.location.hash = `#/${path}`;
}

function toast(message, tone = 'info') {
  toastEl.textContent = message;
  toastEl.dataset.tone = tone;
  toastEl.classList.add('show');
  window.clearTimeout(toastEl._timer);
  toastEl._timer = window.setTimeout(() => toastEl.classList.remove('show'), 3600);
}

function accountInitial(profile) {
  const name = (profile?.full_name || profile?.email || 'U').trim();
  const lastWord = name.split(/\s+/).filter(Boolean).at(-1) || name;
  return lastWord.charAt(0).toUpperCase();
}

function daysUntilExam() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const examDate = new Date(2027, 5, 12);
  return Math.max(0, Math.ceil((examDate - start) / 86_400_000));
}

function pageRoot() {
  return document.querySelector('#page-root') ?? detachedPageRoot;
}

function renderLoading(label = 'Đang tải dữ liệu') {
  return `
    <div class="loading-state">
      <md-circular-progress indeterminate></md-circular-progress>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function navItems() {
  const base = [
    { path: 'learn', icon: 'school', label: 'Học tập' },
    { path: 'history', icon: 'history', label: 'Lịch sử' },
    { path: 'grades', icon: 'grade', label: 'Bảng điểm' },
    { path: 'countdown', icon: 'event', label: 'Đếm ngược' },
    { path: 'settings', icon: 'settings', label: 'Cài đặt' },
  ];

  if (!isManager()) return base;

  return [
    ...base,
    { path: 'dashboard', icon: 'analytics', label: 'Thống kê' },
    { path: 'content', icon: 'view_list', label: 'Nội dung' },
    { path: 'assignments', icon: 'assignment', label: 'Đề thi' },
    { path: 'students', icon: 'groups', label: 'Học sinh' },
  ];
}

function renderShell() {
  const current = route().name;
  const activeNav = ['phase', 'assignment', 'review'].includes(current) ? 'learn' : current;
  const navMarkup = navItems()
    .map(
      (item) => `
        <a class="nav-item ${activeNav === item.path ? 'active' : ''}" href="#/${item.path}">
          <span class="nav-indicator">
            <md-icon>${item.icon}</md-icon>
          </span>
          <span>${item.label}</span>
        </a>
      `,
    )
    .join('');
  app.innerHTML = `
    <div class="app-shell">
      <div class="workspace">
        <header class="topbar">
          <div class="topbar-main">
            <div class="page-heading">
              <span class="role-chip">${escapeHtml(roleLabel(state.profile.role))}</span>
              <h1 class="page-title ${current === 'learn' ? 'learn-title' : ''}">${pageTitle(current)}</h1>
            </div>
          </div>
          <div class="account-strip">
            <span class="account-pill">
              <span class="account-avatar" aria-hidden="true">
                ${escapeHtml(accountInitial(state.profile))}
              </span>
              <span class="account-name">${escapeHtml(state.profile.full_name || state.profile.email)}</span>
            </span>
            <md-outlined-button id="logout-button">
              <md-icon slot="icon">logout</md-icon>
              Thoát
            </md-outlined-button>
          </div>
        </header>
        <nav class="nav-list" aria-label="Điều hướng">
          ${navMarkup}
        </nav>
        <main id="page-root" class="page-root">${renderLoading()}</main>
      </div>
    </div>
  `;

  document.querySelector('#logout-button')?.addEventListener('click', async () => {
    await signOut();
    state.session = null;
    state.profile = null;
    go('learn');
    render();
  });

}

function pageTitle(name) {
  return (
    {
      learn: 'Lộ trình ôn thi 2027',
      phase: 'Chi tiết giai đoạn',
      history: 'Lịch sử học tập',
      countdown: 'Đếm ngược THPTQG',
      settings: 'Cài đặt',
      assignment: 'Làm bài',
      review: 'Xem lại bài',
      dashboard: 'Thống kê',
      content: 'Quản lý nội dung',
      assignments: 'Quản lý đề thi',
      students: 'Quản lý học sinh',
      grades: 'Bảng điểm',
    }[name] ?? 'Lộ trình ôn thi 2027'
  );
}

function renderAuth() {
  app.innerHTML = `
    <main class="auth-screen">
      <section class="auth-panel">
        <div class="auth-copy">
          <span class="brand-mark large">C</span>
          <h1>Canvas</h1>
          <p>If you can get 1 percent better each day for one year, you’ll end up 37 times better by the time you’re done.</p>
        </div>
        <form id="auth-form" class="auth-form">
          <div class="segmented">
            <button type="button" data-mode="login" class="${state.authMode === 'login' ? 'selected' : ''}">Đăng nhập</button>
            <button type="button" data-mode="register" class="${state.authMode === 'register' ? 'selected' : ''}">Đăng ký</button>
          </div>
          ${!hasSupabaseConfig ? '<div class="notice">Cần cấu hình Supabase trong .env để đăng nhập và lưu dữ liệu.</div>' : ''}
          ${
            state.authMode === 'register'
              ? '<md-outlined-text-field name="full_name" label="Họ tên" required></md-outlined-text-field>'
              : ''
          }
          <md-outlined-text-field name="email" label="Email" type="email" required></md-outlined-text-field>
          <md-outlined-text-field name="password" label="Mật khẩu" type="password" required></md-outlined-text-field>
          <md-filled-button type="submit" ${!hasSupabaseConfig ? 'disabled' : ''}>
            <md-icon slot="icon">${state.authMode === 'login' ? 'login' : 'person_add'}</md-icon>
            ${state.authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản học sinh'}
          </md-filled-button>
        </form>
      </section>
    </main>
  `;

  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      state.authMode = button.dataset.mode;
      renderAuth();
    });
  });
  wireMaterialFormButtons(document.querySelector('#auth-form'));

  document.querySelector('#auth-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!hasSupabaseConfig) return;
    const form = event.currentTarget;
    const restore = setButtonLoading(form.querySelector('md-filled-button'));

    try {
      const email = form.querySelector('[name="email"]').value.trim();
      const password = form.querySelector('[name="password"]').value;
      if (state.authMode === 'login') {
        state.session = await signIn(email, password);
        state.profile = await getCurrentProfile();
      } else {
        const fullName = form.querySelector('[name="full_name"]').value.trim();
        const signup = await signUpStudent({ email, password, fullName });
        state.session = signup.session ?? (await getSession());
        if (!state.session) {
          state.authMode = 'login';
          toast('Tài khoản đã tạo. Vui lòng xác nhận email rồi đăng nhập.', 'success');
          renderAuth();
          return;
        }
        state.profile = await getCurrentProfile();
      }
      render();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      restore();
    }
  });
}

function driveFrame(url, title, embed = false) {
  if (!url) return '<div class="empty-state">Chưa có tài liệu.</div>';
  if (embed) {
    const preview = toDrivePreviewUrl(url);
    if (!preview) {
      return `
        <div class="empty-state">
          <md-icon>open_in_new</md-icon>
          <a class="text-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer noopener">Mở tài liệu</a>
        </div>
      `;
    }
    return `<iframe class="doc-frame" src="${escapeHtml(preview)}" title="${escapeHtml(title)}" loading="lazy"></iframe>`;
  }
  // default: show a button that opens the lecture link in a new tab
  return `
    <div class="drive-link">
      <a class="text-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer noopener">
        <md-outlined-button>
          <md-icon slot="icon">open_in_new</md-icon>
          Mở bài giảng
        </md-outlined-button>
      </a>
    </div>
  `;
}

async function mountLearn() {
  const root = pageRoot();
  root.innerHTML = renderLoading();
  try {
    const data = await fetchLearningPath(state.profile.role);
    root.innerHTML = `
      <section class="learn-layout">
        <div class="phase-card-grid">
          ${data.phases.length ? data.phases.map(renderPhaseCard).join('') : '<div class="empty-state">Chưa có lộ trình học.</div>'}
        </div>
        <div class="path-list">
          ${
            data.freeAssignments.length
              ? `
                <section class="panel">
                  <div class="panel-heading">
                    <h2>Bài tập tự do</h2>
                  </div>
                  <div class="item-grid">
                    ${data.freeAssignments.map(renderAssignmentChip).join('')}
                  </div>
                </section>
              `
              : ''
          }
        </div>
      </section>
    `;
  } catch (error) {
    root.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
  }
}

async function mountPhaseDetail(id) {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang mở giai đoạn');
  try {
    const data = await fetchLearningPath(state.profile.role);
    const phase = data.phases.find((item) => item.id === id);
    if (!phase) {
      root.innerHTML = '<div class="empty-state">Không tìm thấy giai đoạn.</div>';
      return;
    }
    root.innerHTML = `
      <section class="phase-detail-panel">
        <a class="text-link back-link" href="#/learn">
          <md-icon>arrow_back</md-icon>
          Lộ trình
        </a>
        <div class="phase-detail-heading">
          <p class="eyebrow">Giai đoạn</p>
          <h2>${escapeHtml(phase.title)}</h2>
        </div>
        ${phase.description ? `<p class="muted">${escapeHtml(phase.description)}</p>` : ''}
        <div class="module-stack phase-module-stack">
          ${
            phase.modules.length
              ? phase.modules.map(renderModule).join('')
              : '<div class="empty-state compact">Chưa có chuyên đề.</div>'
          }
        </div>
      </section>
    `;
  } catch (error) {
    root.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
  }
}

function renderPhaseCard(phase) {
  const lectureCount = phase.modules.reduce((sum, module) => sum + module.lectures.length, 0);
  const groupCount = phase.modules.reduce((sum, module) => sum + module.lecture_groups.length, 0);
  const assignmentCount = phase.modules.reduce(
    (sum, module) => sum + module.lectures.reduce((total, lecture) => total + lecture.assignments.length, 0),
    0,
  );
  return `
    <a class="phase-card" href="#/phase/${phase.id}">
      <div>
        <p class="eyebrow">Giai đoạn</p>
        <h2>${escapeHtml(phase.title)}</h2>
      </div>
      <div class="phase-card-meta">
        <span><md-icon>folder_open</md-icon>${phase.modules.length} chuyên đề</span>
        <span><md-icon>library_books</md-icon>${groupCount} nhóm bài giảng</span>
        <span><md-icon>menu_book</md-icon>${lectureCount} bài giảng</span>
        <span><md-icon>quiz</md-icon>${assignmentCount} bài tập</span>
      </div>
      <span class="phase-card-action">
        Mở giai đoạn
        <md-icon>arrow_forward</md-icon>
      </span>
    </a>
  `;
}

function renderPhase(phase) {
  return `
    <section class="panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Giai đoạn</p>
          <h2>${escapeHtml(phase.title)}</h2>
        </div>
        ${phase.published ? '' : '<span class="status">Draft</span>'}
      </div>
      ${phase.description ? `<p class="muted">${escapeHtml(phase.description)}</p>` : ''}
      <div class="module-stack">
        ${
          phase.modules.length
            ? phase.modules.map(renderModule).join('')
            : '<div class="empty-state compact">Chưa có chuyên đề.</div>'
        }
      </div>
    </section>
  `;
}


function renderModule(module) {
  const ungroupedLectures = module.lectures.filter((lecture) => !lecture.group_id);
  return `
    <article class="module-block">
      <div class="module-title">
        <md-icon>folder_open</md-icon>
        <h3>${escapeHtml(module.title)}</h3>
      </div>
      <div class="lecture-list">
        ${
          module.lecture_groups.length || ungroupedLectures.length
            ? `
              ${module.lecture_groups.map(renderLectureGroup).join('')}
              ${ungroupedLectures.length ? renderLectureGroup({ title: 'Bài giảng chưa nhóm', lectures: ungroupedLectures }, true) : ''}
            `
            : '<div class="empty-state compact">Chưa có nhóm bài giảng.</div>'
        }
      </div>
    </article>
  `;
}

function renderLectureGroup(group, isUngrouped = false) {
  return `
    <details class="lecture-group-block ${isUngrouped ? 'ungrouped' : ''}">
      <summary class="lecture-group-title">
        <span>
          <md-icon>library_books</md-icon>
          <h4>${escapeHtml(group.title)}</h4>
        </span>
        <md-icon>expand_more</md-icon>
      </summary>
      <div class="lecture-list">
        ${
          group.lectures.length
            ? group.lectures.map(renderLecture).join('')
            : '<div class="empty-state compact">Chưa có bài giảng trong nhóm.</div>'
        }
      </div>
    </details>
  `;
}

function renderLecture(lecture) {
  return `
    <details class="lecture-row">
      <summary>
        <span>
          <md-icon>menu_book</md-icon>
          ${escapeHtml(lecture.title)}
        </span>
        <md-icon>expand_more</md-icon>
      </summary>
      <div class="lecture-body">
        ${lecture.description ? `<p>${escapeHtml(lecture.description)}</p>` : ''}
        <div class="lecture-media">
          ${driveFrame(lecture.slide_url, lecture.title)}
        </div>
        <div class="item-grid">
          ${lecture.assignments.map(renderAssignmentChip).join('')}
        </div>
      </div>
    </details>
  `;
}

function renderAssignmentChip(assignment) {
  const progress = assignment.progress;
  const hasSubmitted = progress?.status === 'submitted';
  return `
    <div class="assignment-progress-row ${hasSubmitted ? 'completed' : 'pending'}">
      <a class="assignment-chip" href="#/assignment/${assignment.id}">
        <md-icon>quiz</md-icon>
        <span>${escapeHtml(assignment.title)}</span>
      </a>
      <span class="assignment-chip-progress">
        <span>${hasSubmitted ? `Cao nhất ${formatScore(progress.bestScore)}/10` : 'Chưa làm'}</span>
        ${hasSubmitted ? renderScoreProgress(progress.bestScore) : ''}
      </span>
    </div>
  `;
}

async function mountAssignment(id) {
  if (isManager()) return mountAssignmentManagerView(id);

  return mountStudentAssignmentOverview(id);
}

async function mountStudentAssignmentOverview(id) {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang mở bài tập');
  try {
    const { assignment, attempts } = await fetchStudentAssignmentOverview(id);
    const latest = attempts[0];
    root.innerHTML = `
      <section class="assignment-start">
        <div class="panel assignment-start-hero">
          <div>
            <p class="eyebrow">Bài tập về nhà</p>
            <h2>${escapeHtml(assignment.title)}</h2>
            ${latest ? `<p class="muted">Lần gần nhất: ${formatScore(latest.score_10)}/10 · ${formatDateTime(latest.submitted_at)}</p>` : '<p class="muted">Bạn chưa làm bài này.</p>'}
          </div>
          <div class="insight-actions">
            <md-filled-button id="start-assignment">
              <md-icon slot="icon">${latest ? 'restart_alt' : 'play_arrow'}</md-icon>
              ${latest ? 'Làm lại' : 'Làm bài'}
            </md-filled-button>
            ${latest ? `<md-outlined-button id="review-latest-attempt"><md-icon slot="icon">visibility</md-icon>Xem bài mới nhất</md-outlined-button>` : ''}
          </div>
        </div>
        <section class="exam-shell assignment-preview-shell">
          <div class="exam-paper">
            <div class="split-heading">
              <div>
                <p class="eyebrow">Đề bài</p>
                <h2>${escapeHtml(assignment.title)}</h2>
              </div>
            </div>
            ${driveFrame(assignment.pdf_url, assignment.title, true)}
          </div>
          <div class="panel assignment-history-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Lịch sử làm bài</p>
                <h2>${attempts.length} lần nộp</h2>
              </div>
            </div>
            ${renderStudentAssignmentHistory(attempts)}
          </div>
        </section>
      </section>
    `;
    document.querySelector('#start-assignment')?.addEventListener('click', () => mountAssignmentExam(id));
    document.querySelector('#review-latest-attempt')?.addEventListener('click', () => go(`review/${latest.id}`));
  } catch (error) {
    root.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
  }
}

function renderStudentAssignmentHistory(attempts) {
  if (!attempts.length) return '<div class="empty-state compact">Chưa có lần nộp nào.</div>';
  return `
    <div class="stack-list">
      ${attempts
        .map(
          (attempt, index) => `
            <article class="attempt-history-row">
              <div>
                <strong>Lần ${attempts.length - index}</strong>
                <small>${formatDateTime(attempt.submitted_at)}</small>
              </div>
              <div class="score-progress-block">
                <span>${formatScore(attempt.score_10)}/10</span>
                ${renderScoreProgress(attempt.score_10)}
              </div>
              <a class="text-link" href="#/review/${attempt.id}">Chi tiết</a>
            </article>
          `,
        )
        .join('')}
    </div>
  `;
}

async function mountAssignmentExam(id) {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang mở đề');
  try {
    const { assignment, questions } = await fetchAssignmentForStudent(id);
    const draft = loadDraft(localStorage, state.profile.id, id);
    const answers = draft?.answers ?? {};
    root.innerHTML = `
      <section class="exam-shell">
        <div class="exam-paper">
          <div class="split-heading">
            <div>
              <p class="eyebrow">Đề bài</p>
              <h2>${escapeHtml(assignment.title)}</h2>
            </div>
            ${draft ? `<span class="status">Đã lưu ${formatDateTime(draft.savedAt)}</span>` : ''}
          </div>
          ${driveFrame(assignment.pdf_url, assignment.title, true)}
        </div>
        <form id="answer-form" class="answer-sheet">
          <div class="split-heading">
            <div>
              <p class="eyebrow">Phiếu trả lời</p>
              <h2>${questions.length} câu</h2>
            </div>
            <md-filled-button type="submit">
              <md-icon slot="icon">send</md-icon>
              Nộp bài
            </md-filled-button>
          </div>
          <div class="question-stack">
            ${questions.map((question, index) => renderQuestionInput(question, index, answers[question.id])).join('')}
          </div>
        </form>
      </section>
    `;
    wireMaterialFormButtons(root);
    wireAnswerAutosave(id);
  } catch (error) {
    root.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
  }
}

async function mountAssignmentManagerView(id) {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang tải thống kê bài tập');
  try {
    const { assignment, submittedStudents, pendingStudents, stats } = await fetchAssignmentInsights(id);
    root.innerHTML = `
      <section class="assignment-insights">
        <div class="panel assignment-insights-hero">
          <div>
            <p class="eyebrow">Bài tập về nhà</p>
            <h2>${escapeHtml(assignment.title)}</h2>
            <p class="muted">${escapeHtml(assignment.lectures?.title ?? 'Bài tập tự do')}</p>
          </div>
          <div class="assignment-score-summary">
            <span>Điểm trung bình</span>
            <strong>${formatScore(stats.averageScore)}/10</strong>
            ${renderScoreProgress(stats.averageScore)}
          </div>
          <div class="insight-actions">
            <md-filled-tonal-button id="edit-assignment-from-insights">
              <md-icon slot="icon">edit</md-icon>
              Sửa đề
            </md-filled-tonal-button>
            <md-outlined-button id="all-assignments-from-insights">
              <md-icon slot="icon">list</md-icon>
              Danh sách đề
            </md-outlined-button>
          </div>
        </div>
        <section class="metric-grid">
          ${renderMetric('Đã làm', `${stats.submittedCount}/${stats.totalStudents}`, 'task_alt')}
          ${renderMetric('Chưa làm', stats.pendingCount, 'pending_actions')}
          ${renderMetric('Điểm TB', formatScore(stats.averageScore), 'monitoring')}
          ${renderMetric('Điểm cao nhất', formatScore(stats.bestScore), 'workspace_premium')}
        </section>
        <section class="manager-grid assignment-insights-grid">
          <div class="panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Đã làm</p>
                <h2>${submittedStudents.length} học sinh</h2>
              </div>
            </div>
            ${renderSubmittedStudents(submittedStudents)}
          </div>
          <div class="panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Chưa làm</p>
                <h2>${pendingStudents.length} học sinh</h2>
              </div>
            </div>
            ${renderPendingStudents(pendingStudents)}
          </div>
        </section>
      </section>
    `;

    document.querySelector('#edit-assignment-from-insights')?.addEventListener('click', async () => {
      try {
        const editor = await fetchAssignmentEditor(id);
        state.assignmentEditor = {
          assignment: editor.assignment,
          questions: editor.questions.map(normalizeEditorQuestion),
        };
        go('assignments');
      } catch (error) {
        toast(error.message, 'error');
      }
    });
    document.querySelector('#all-assignments-from-insights')?.addEventListener('click', () => go('assignments'));
  } catch (error) {
    root.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
  }
}

function renderSubmittedStudents(rows) {
  if (!rows.length) return '<div class="empty-state compact">Chưa có học sinh nộp bài.</div>';
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Học sinh</th>
            <th>Điểm</th>
            <th>Nộp lúc</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              ({ student, attempt }) => `
                <tr>
                  <td>
                    <strong>${escapeHtml(student.full_name || student.email)}</strong>
                    <small>${escapeHtml(student.email)}</small>
                  </td>
                  <td>
                    <div class="score-progress-block">
                      <span>${formatScore(attempt.score_10)}/10</span>
                      ${renderScoreProgress(attempt.score_10)}
                    </div>
                  </td>
                  <td>${formatDateTime(attempt.submitted_at)}</td>
                  <td><a class="text-link" href="#/review/${attempt.id}">Chi tiết</a></td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderScoreProgress(score) {
  const value = Math.max(0, Math.min(10, Number(score ?? 0)));
  return `
    <div class="score-progress" aria-label="Điểm ${formatScore(value)} trên 10">
      <span style="width: ${value * 10}%"></span>
    </div>
  `;
}

function renderPendingStudents(rows) {
  if (!rows.length) return '<div class="empty-state compact">Tất cả học sinh đã nộp bài.</div>';
  return `
    <div class="student-status-list">
      ${rows
        .map(
          (student) => `
            <article class="student-status-row">
              <span class="account-avatar" aria-hidden="true">${escapeHtml(accountInitial(student))}</span>
              <div>
                <strong>${escapeHtml(student.full_name || student.email)}</strong>
                <small>${escapeHtml(student.email)}</small>
              </div>
              <span class="status">Chưa làm</span>
            </article>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderQuestionInput(question, index, answer) {
  const choices = ['A', 'B', 'C', 'D'];
  const settings = question.settings ?? {};
  const displayPrompt = question.prompt && question.prompt !== `Câu ${index + 1}`;
  const prompt = `
    <div class="question-prompt">
      <span>Câu ${index + 1}</span>
      ${displayPrompt ? `<p>${escapeHtml(question.prompt)}</p>` : ''}
      <small>${Number(question.points)} điểm</small>
    </div>
  `;

  if (question.type === 'mcq') {
    return `
      <article class="question-card" data-question-id="${question.id}" data-type="mcq">
        ${prompt}
        <div class="choice-grid">
          ${choices
            .map(
              (choice, choiceIndex) => {
                const value = String.fromCharCode(65 + choiceIndex);
                return `
                  <label class="choice-tile">
                    <input type="radio" name="q-${question.id}" value="${value}" ${answer === value ? 'checked' : ''}>
                    <span>${escapeHtml(choice)}</span>
                  </label>
                `;
              },
            )
            .join('')}
        </div>
      </article>
    `;
  }

  if (question.type === 'tf4') {
    const statements = settings.statements ?? ['Ý 1', 'Ý 2', 'Ý 3', 'Ý 4'];
    const saved = Array.isArray(answer) ? answer : [];
    return `
      <article class="question-card" data-question-id="${question.id}" data-type="tf4">
        ${prompt}
        <div class="tf-table">
          ${statements
            .map(
              (statement, itemIndex) => `
                <div class="tf-row">
                  <span>${escapeHtml(statement)}</span>
                  <label><input type="radio" name="q-${question.id}-${itemIndex}" value="true" ${saved[itemIndex] === true ? 'checked' : ''}> Đúng</label>
                  <label><input type="radio" name="q-${question.id}-${itemIndex}" value="false" ${saved[itemIndex] === false ? 'checked' : ''}> Sai</label>
                </div>
              `,
            )
            .join('')}
        </div>
      </article>
    `;
  }

  return `
    <article class="question-card" data-question-id="${question.id}" data-type="short">
      ${prompt}
      <input class="field" type="text" name="q-${question.id}" value="${escapeHtml(answer ?? '')}" autocomplete="off">
    </article>
  `;
}

function collectAnswers() {
  const answers = {};
  document.querySelectorAll('.question-card').forEach((card) => {
    const id = card.dataset.questionId;
    const type = card.dataset.type;
    if (type === 'mcq') {
      answers[id] = card.querySelector(`input[name="q-${id}"]:checked`)?.value ?? '';
    } else if (type === 'tf4') {
      answers[id] = Array.from({ length: 4 }, (_, index) => {
        const value = card.querySelector(`input[name="q-${id}-${index}"]:checked`)?.value;
        if (value === undefined) return null;
        return value === 'true';
      });
    } else {
      answers[id] = card.querySelector(`input[name="q-${id}"]`)?.value ?? '';
    }
  });
  return answers;
}

function wireAnswerAutosave(assignmentId) {
  const form = document.querySelector('#answer-form');
  const persist = () => saveDraft(localStorage, state.profile.id, assignmentId, collectAnswers());
  form.addEventListener('input', persist);
  form.addEventListener('change', persist);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('md-filled-button');
    const restore = setButtonLoading(button, 'Đang nộp...');
    try {
      const submitted = await submitAssignmentAttempt({
        assignmentId,
        answers: collectAnswers(),
      });
      clearDraft(localStorage, state.profile.id, assignmentId);
      toast('Đã nộp bài và chấm điểm.', 'success');
      go(`review/${submitted.id}`);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      restore();
    }
  });
}

async function mountHistory() {
  const root = pageRoot();
  root.innerHTML = renderLoading();
  try {
    const history = await fetchMyHistory();
    root.innerHTML = `
      <section class="panel">
        <div class="panel-heading">
          <h2>Lịch sử nộp bài</h2>
        </div>
        ${renderAttemptsTable(history, true)}
      </section>
    `;
  } catch (error) {
    root.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
  }
}

function renderAttemptsTable(rows, showReviewLink = false) {
  if (!rows.length) return '<div class="empty-state">Chưa có bài nộp.</div>';
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Bài</th>
            <th>Học sinh</th>
            <th>Điểm</th>
            <th>Thời gian</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr data-search="${escapeHtml(`${row.assignments?.title ?? ''} ${row.profiles?.full_name ?? state.profile?.full_name ?? ''} ${row.profiles?.email ?? ''}`)}">
                  <td>${escapeHtml(row.assignments?.title ?? '-')}</td>
                  <td>${escapeHtml(row.profiles?.full_name ?? state.profile?.full_name ?? '-')}</td>
                  <td><strong>${formatScore(row.score_10)}</strong></td>
                  <td>${formatDateTime(row.submitted_at)}</td>
                  <td>${showReviewLink || isManager() ? `<a class="text-link" href="#/review/${row.id}">Chi tiết</a>` : ''}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function mountReview(id) {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang tải bài làm');
  try {
    const review = await fetchAttemptReview(id);
    const items = review.items ?? [];
    root.innerHTML = `
      <section class="exam-shell">
        <div class="exam-paper">
          <div class="split-heading">
            <div>
              <p class="eyebrow">Đề bài</p>
              <h2>${escapeHtml(review.assignment?.title ?? 'Bài làm')}</h2>
            </div>
          </div>
          ${driveFrame(review.assignment?.pdf_url, review.assignment?.title ?? 'Đề bài', true)}
        </div>
        <div class="answer-sheet">
          <div class="split-heading">
            <div>
              <p class="eyebrow">Kết quả</p>
              <h2>${items.length} câu</h2>
            </div>
            <div class="score-badge">${formatScore(review.attempt?.score_10)}/10</div>
          </div>
          <div class="review-list">
            ${items
              .map(
              (item, index) => `
                <article class="review-item ${item.is_correct ? 'correct' : 'wrong'}">
                  <div>
                    <p class="eyebrow">Câu ${index + 1} · ${Number(item.earned_points).toFixed(2)}/${Number(item.points).toFixed(2)} điểm</p>
                    ${item.prompt && item.prompt !== `Câu ${index + 1}` ? `<h3>${escapeHtml(item.prompt)}</h3>` : ''}
                  </div>
                  <dl>
                    <dt>Bài làm</dt>
                    <dd>${escapeHtml(formatAnswer(item.answer))}</dd>
                    <dt>Đáp án</dt>
                    <dd>${escapeHtml(formatAnswer(item.correct_answer ?? item.accepted_answers))}</dd>
                  </dl>
                </article>
              `,
            )
            .join('')}
          </div>
        </div>
      </section>
    `;
  } catch (error) {
    root.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
  }
}

function formatAnswer(answer) {
  if (Array.isArray(answer)) return answer.map((item) => (item === true ? 'Đúng' : item === false ? 'Sai' : '-')).join(', ');
  if (answer && typeof answer === 'object') return JSON.stringify(answer);
  return answer ?? '-';
}

async function mountDashboard() {
  const root = pageRoot();
  root.innerHTML = renderLoading();
  try {
    const stats = await fetchDashboardStats();
    root.innerHTML = `
      <section class="metric-grid">
        ${renderMetric('Tổng học sinh', stats.totalStudents, 'groups')}
        ${renderMetric('Tổng đề thi', stats.totalAssignments, 'assignment')}
        ${renderMetric('Lượt nộp', stats.totalSubmissions, 'send')}
        ${renderMetric('Điểm TB lớp', formatScore(stats.averageScore), 'monitoring')}
      </section>
    `;
  } catch (error) {
    root.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
  }
}

function mountCountdown() {
  const root = pageRoot();
  const days = daysUntilExam();
  const examDate = new Date(2027, 5, 12);
  const formattedExamDate = examDate.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  root.innerHTML = `
    <section class="countdown-page">
      <div class="countdown-hero">
        <div>
          <p class="eyebrow">THPTQG 2027</p>
          <h2>${days}</h2>
          <span>ngày</span>
        </div>
        <md-icon>event</md-icon>
      </div>
      <div class="countdown-details">
        <article>
          <span>Ngày thi dự kiến</span>
          <strong>${escapeHtml(formattedExamDate)}</strong>
        </article>
      </div>
    </section>
  `;
}

function renderMetric(label, value, icon) {
  return `
    <article class="metric">
      <md-icon>${icon}</md-icon>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

async function mountContentManager() {
  const root = pageRoot();
  root.innerHTML = renderLoading();
  try {
    const data = await fetchLearningPath(state.profile.role);
    root.innerHTML = `
      <section class="panel content-create-panel">
        <div class="panel-heading">
          <h2>Tạo nội dung</h2>
        </div>
        <div class="content-create-grid four">
          ${renderPhaseForm()}
          ${renderModuleForm(data.phases)}
          ${renderLectureGroupForm(data.modules)}
          ${renderLectureForm(data.modules, data.lectureGroups)}
        </div>
      </section>
      <section class="panel">
        <div class="panel-heading">
          <h2>Cấu trúc hiện tại</h2>
        </div>
        ${data.phases.length ? data.phases.map(renderManagePhase).join('') : '<div class="empty-state">Chưa có nội dung.</div>'}
      </section>
    `;
    wireContentForms();
    wireMaterialFormButtons(root);
  } catch (error) {
    root.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
  }
}

function renderPhaseForm() {
  return `
    <form class="entity-form compact-entity-form" data-entity="phase">
      <div class="entity-form-heading">
        <md-icon>flag</md-icon>
        <h3>Giai đoạn</h3>
      </div>
      <input type="hidden" name="id">
      <input type="hidden" name="description" value="">
      <input type="hidden" name="sort_order" value="0">
      <input type="hidden" name="published" value="true">
      <input class="field" name="title" placeholder="Tên giai đoạn" required>
      <div class="button-row">
        <md-filled-button type="submit"><md-icon slot="icon">save</md-icon>Lưu</md-filled-button>
        <md-outlined-button type="reset">Mới</md-outlined-button>
      </div>
    </form>
  `;
}

function renderModuleForm(phases) {
  return `
    <form class="entity-form compact-entity-form" data-entity="module">
      <div class="entity-form-heading">
        <md-icon>folder_open</md-icon>
        <h3>Chuyên đề</h3>
      </div>
      <input type="hidden" name="id">
      <input type="hidden" name="description" value="">
      <input type="hidden" name="sort_order" value="0">
      <input type="hidden" name="published" value="true">
      <select class="field" name="phase_id" required>
        <option value="">Chọn giai đoạn</option>
        ${phases.map((phase) => option(phase.id, phase.title)).join('')}
      </select>
      <input class="field" name="title" placeholder="Tên chuyên đề" required>
      <div class="button-row">
        <md-filled-button type="submit"><md-icon slot="icon">save</md-icon>Lưu</md-filled-button>
        <md-outlined-button type="reset">Mới</md-outlined-button>
      </div>
    </form>
  `;
}

function renderLectureGroupForm(modules) {
  return `
    <form class="entity-form compact-entity-form" data-entity="lectureGroup">
      <div class="entity-form-heading">
        <md-icon>library_books</md-icon>
        <h3>Nhóm bài giảng</h3>
      </div>
      <input type="hidden" name="id">
      <input type="hidden" name="description" value="">
      <input type="hidden" name="sort_order" value="0">
      <input type="hidden" name="published" value="true">
      <select class="field" name="module_id" required>
        <option value="">Chọn chuyên đề</option>
        ${modules.map((module) => option(module.id, module.title)).join('')}
      </select>
      <input class="field" name="title" placeholder="Tên nhóm, ví dụ: Bài giảng 1" required>
      <div class="button-row">
        <md-filled-button type="submit"><md-icon slot="icon">save</md-icon>Lưu</md-filled-button>
        <md-outlined-button type="reset">Mới</md-outlined-button>
      </div>
    </form>
  `;
}

function renderLectureForm(modules, lectureGroups) {
  return `
    <form class="entity-form compact-entity-form" data-entity="lecture">
      <div class="entity-form-heading">
        <md-icon>menu_book</md-icon>
        <h3>Bài giảng</h3>
      </div>
      <input type="hidden" name="id">
      <input type="hidden" name="description" value="">
      <input type="hidden" name="sort_order" value="0">
      <input type="hidden" name="published" value="true">
      <select class="field" name="module_id" required>
        <option value="">Chọn chuyên đề</option>
        ${modules.map((module) => option(module.id, module.title)).join('')}
      </select>
      <select class="field" name="group_id">
        <option value="">Chưa nhóm</option>
        ${lectureGroups.map((group) => option(group.id, group.title)).join('')}
      </select>
      <input class="field" name="title" placeholder="Tên bài giảng" required>
      <input class="field" name="slide_url" placeholder="Link Google Drive slide">
      <div class="button-row">
        <md-filled-button type="submit"><md-icon slot="icon">save</md-icon>Lưu</md-filled-button>
        <md-outlined-button type="reset">Mới</md-outlined-button>
      </div>
    </form>
  `;
}

function renderManagePhase(phase) {
  return `
    <div class="manage-node" draggable="true" data-entity="phase" data-parent="root" data-id="${phase.id}" data-payload="${escapeHtml(JSON.stringify(phase))}">
      <div>
        <md-icon class="drag-handle" aria-hidden="true">drag_indicator</md-icon>
        <strong>${escapeHtml(phase.title)}</strong>
        <span>${phase.modules.length} chuyên đề</span>
      </div>
      <div class="icon-actions">
        <button data-edit-phase="${phase.id}" data-payload="${escapeHtml(JSON.stringify(phase))}" aria-label="Sửa giai đoạn"><md-icon>edit</md-icon></button>
        <button data-delete-phase="${phase.id}" aria-label="Xóa giai đoạn"><md-icon>delete</md-icon></button>
      </div>
    </div>
    ${phase.modules
      .map(
        (module) => `
          <div class="manage-node child" draggable="true" data-entity="module" data-parent="${phase.id}" data-id="${module.id}" data-payload="${escapeHtml(JSON.stringify(module))}">
            <div>
              <md-icon class="drag-handle" aria-hidden="true">drag_indicator</md-icon>
              <strong>${escapeHtml(module.title)}</strong>
              <span>${module.lecture_groups.length} nhóm · ${module.lectures.length} bài giảng</span>
            </div>
            <div class="icon-actions">
              <button data-edit-module="${module.id}" data-payload="${escapeHtml(JSON.stringify(module))}" aria-label="Sửa chuyên đề"><md-icon>edit</md-icon></button>
              <button data-delete-module="${module.id}" aria-label="Xóa chuyên đề"><md-icon>delete</md-icon></button>
            </div>
          </div>
          ${module.lecture_groups
            .map(
              (group) => `
                <div class="manage-node grandchild" draggable="true" data-entity="lectureGroup" data-parent="${module.id}" data-id="${group.id}" data-payload="${escapeHtml(JSON.stringify(group))}">
                  <div>
                    <md-icon class="drag-handle" aria-hidden="true">drag_indicator</md-icon>
                    <strong>${escapeHtml(group.title)}</strong>
                    <span>${group.lectures.length} bài giảng</span>
                  </div>
                  <div class="icon-actions">
                    <button data-edit-lecture-group="${group.id}" data-payload="${escapeHtml(JSON.stringify(group))}" aria-label="Sửa nhóm bài giảng"><md-icon>edit</md-icon></button>
                    <button data-delete-lecture-group="${group.id}" aria-label="Xóa nhóm bài giảng"><md-icon>delete</md-icon></button>
                  </div>
                </div>
              `,
            )
            .join('')}
          ${module.lectures
            .map(
              (lecture) => `
                <div class="manage-node greatgrandchild" draggable="true" data-entity="lecture" data-parent="${lecture.group_id || `module:${module.id}`}" data-id="${lecture.id}" data-payload="${escapeHtml(JSON.stringify(lecture))}">
                  <div>
                    <md-icon class="drag-handle" aria-hidden="true">drag_indicator</md-icon>
                    <strong>${escapeHtml(lecture.title)}</strong>
                    <span>${lecture.group_id ? 'Trong nhóm' : 'Chưa nhóm'}</span>
                  </div>
                  <div class="icon-actions">
                    <button data-edit-lecture="${lecture.id}" data-payload="${escapeHtml(JSON.stringify(lecture))}" aria-label="Sửa bài giảng"><md-icon>edit</md-icon></button>
                    <button data-delete-lecture="${lecture.id}" aria-label="Xóa bài giảng"><md-icon>delete</md-icon></button>
                  </div>
                </div>
              `,
            )
            .join('')}
        `,
      )
      .join('')}
  `;
}

function wireContentForms() {
  document.querySelectorAll('.entity-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form).entries());
      const payload = {
        ...values,
        id: values.id || undefined,
        sort_order: Number(values.sort_order || 0),
        published: form.querySelector('[name="published"]')?.type === 'checkbox'
          ? form.querySelector('[name="published"]').checked
          : values.published !== 'false',
        owner_id: state.profile.id,
      };
      const restore = setButtonLoading(form.querySelector('md-filled-button'));
      try {
        if (form.dataset.entity === 'phase') await upsertPhase(payload);
        if (form.dataset.entity === 'module') await upsertModule(payload);
        if (form.dataset.entity === 'lectureGroup') await upsertLectureGroup(payload);
        if (form.dataset.entity === 'lecture') await upsertLecture({ ...payload, group_id: payload.group_id || null });
        toast('Đã lưu nội dung.', 'success');
        await mountContentManager();
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        restore();
      }
    });
  });

  document.querySelectorAll('button[data-payload]').forEach((button) => {
    button.addEventListener('click', () => {
      const payload = JSON.parse(button.dataset.payload);
      const kind = button.dataset.editPhase
        ? 'phase'
        : button.dataset.editModule
          ? 'module'
          : button.dataset.editLectureGroup
            ? 'lectureGroup'
            : 'lecture';
      const form = document.querySelector(`[data-entity="${kind}"]`);
      Object.entries(payload).forEach(([key, value]) => {
        const input = form.querySelector(`[name="${key}"]`);
        if (!input) return;
        if (input.type === 'checkbox') input.checked = Boolean(value);
        else input.value = value ?? '';
      });
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  wireContentDragSort();

  document.querySelectorAll('[data-delete-phase],[data-delete-module],[data-delete-lecture-group],[data-delete-lecture]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Xóa mục này?')) return;
      try {
        if (button.dataset.deletePhase) await deletePhase(button.dataset.deletePhase);
        if (button.dataset.deleteModule) await deleteModule(button.dataset.deleteModule);
        if (button.dataset.deleteLectureGroup) await deleteLectureGroup(button.dataset.deleteLectureGroup);
        if (button.dataset.deleteLecture) await deleteLecture(button.dataset.deleteLecture);
        toast('Đã xóa.', 'success');
        await mountContentManager();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
}

function contentPayloadForSave(kind, payload) {
  const base = {
    id: payload.id,
    owner_id: payload.owner_id ?? state.profile.id,
    title: payload.title,
    description: payload.description ?? '',
    sort_order: Number(payload.sort_order ?? 0),
    published: payload.published ?? true,
  };

  if (kind === 'module') return { ...base, phase_id: payload.phase_id };
  if (kind === 'lectureGroup') return { ...base, module_id: payload.module_id };
  if (kind === 'lecture') return { ...base, module_id: payload.module_id, group_id: payload.group_id || null, slide_url: payload.slide_url ?? '' };
  return base;
}

function wireContentDragSort() {
  let dragged = null;

  document.querySelectorAll('.manage-node[draggable="true"]').forEach((node) => {
    node.addEventListener('dragstart', (event) => {
      dragged = node;
      node.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', node.dataset.id);
    });

    node.addEventListener('dragend', () => {
      node.classList.remove('dragging');
      document.querySelectorAll('.manage-node.drop-target').forEach((item) => item.classList.remove('drop-target'));
      dragged = null;
    });

    node.addEventListener('dragover', (event) => {
      if (!dragged || dragged === node) return;
      if (dragged.dataset.entity !== node.dataset.entity || dragged.dataset.parent !== node.dataset.parent) return;
      event.preventDefault();
      node.classList.add('drop-target');
      event.dataTransfer.dropEffect = 'move';
    });

    node.addEventListener('dragleave', () => {
      node.classList.remove('drop-target');
    });

    node.addEventListener('drop', async (event) => {
      event.preventDefault();
      node.classList.remove('drop-target');
      if (!dragged || dragged === node) return;
      if (dragged.dataset.entity !== node.dataset.entity || dragged.dataset.parent !== node.dataset.parent) {
        toast('Chỉ kéo thả trong cùng một cấp.', 'error');
        return;
      }

      try {
        await reorderContentNodes(dragged, node);
        toast('Đã cập nhật thứ tự.', 'success');
        await mountContentManager();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
}

async function reorderContentNodes(sourceNode, targetNode) {
  const kind = sourceNode.dataset.entity;
  const parent = sourceNode.dataset.parent;
  const nodes = Array.from(document.querySelectorAll(`.manage-node[data-entity="${kind}"][data-parent="${parent}"]`));
  const from = nodes.indexOf(sourceNode);
  const to = nodes.indexOf(targetNode);
  if (from < 0 || to < 0 || from === to) return;

  const ordered = nodes.map((node) => JSON.parse(node.dataset.payload));
  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);

  await Promise.all(
    ordered.map((payload, index) => {
      const next = contentPayloadForSave(kind, {
        ...payload,
        sort_order: (index + 1) * 10,
      });
      if (kind === 'phase') return upsertPhase(next);
      if (kind === 'module') return upsertModule(next);
      if (kind === 'lectureGroup') return upsertLectureGroup(next);
      return upsertLecture(next);
    }),
  );
}

function emptyEditor() {
  return {
    assignment: {
      title: '',
      description: '',
      pdf_url: '',
      lecture_id: '',
      sort_order: 0,
      published: true,
    },
    questions: [],
  };
}

async function mountAssignmentManager() {
  const root = pageRoot();
  root.innerHTML = renderLoading();
  try {
    const [path, assignments] = await Promise.all([
      fetchLearningPath(state.profile.role),
      fetchAssignmentsForManager(),
    ]);
    if (!state.assignmentEditor) state.assignmentEditor = emptyEditor();
    root.innerHTML = `
      <section class="assignment-manager">
        <aside class="panel list-panel">
          <div class="panel-heading">
            <h2>Đề thi / BTVN</h2>
            <md-filled-tonal-button id="new-assignment"><md-icon slot="icon">add</md-icon>Mới</md-filled-tonal-button>
          </div>
          <div class="stack-list">
            ${assignments
              .map(
                (assignment) => `
                  <button class="list-row" data-load-assignment="${assignment.id}">
                    <span>${escapeHtml(assignment.title)}</span>
                    <small>${escapeHtml(assignment.lectures?.title ?? 'Bài tập tự do')}</small>
                  </button>
                `,
              )
              .join('')}
          </div>
        </aside>
        <form id="assignment-editor" class="panel editor-panel">
          ${renderAssignmentEditor(path.lectures)}
        </form>
      </section>
    `;
    wireAssignmentEditor(path.lectures);
    wireMaterialFormButtons(root);
  } catch (error) {
    root.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
  }
}

function normalizeEditorQuestion(raw) {
  const key = Array.isArray(raw.answer_keys) ? raw.answer_keys[0] : raw.answer_key;
  return {
    id: raw.id,
    type: raw.type,
    prompt: raw.prompt,
    points: raw.points,
    sort_order: raw.sort_order,
    choices: raw.choices ?? [],
    settings: raw.settings ?? {},
    answer_key: key ?? {},
  };
}

function renderAssignmentEditor(lectures) {
  const { assignment, questions } = state.assignmentEditor;
  return `
    <div class="assignment-editor-header">
      <div>
        <p class="eyebrow">Đề thi / BTVN</p>
        <h2>${assignment.id ? 'Chỉnh sửa đề' : 'Tạo đề mới'}</h2>
      </div>
      <div class="button-row">
        ${assignment.id ? '<md-outlined-button id="delete-assignment" type="button"><md-icon slot="icon">delete</md-icon>Xóa</md-outlined-button>' : ''}
        <md-filled-button type="submit"><md-icon slot="icon">save</md-icon>Lưu đề</md-filled-button>
      </div>
    </div>
    <input type="hidden" name="id" value="${escapeHtml(assignment.id ?? '')}">
    <input type="hidden" name="description" value="${escapeHtml(assignment.description ?? '')}">
    <input type="hidden" name="sort_order" value="${Number(assignment.sort_order ?? 0)}">
    <input type="hidden" name="published" value="true">
    <section class="assignment-info-panel">
      <div class="entity-form-heading">
        <md-icon>picture_as_pdf</md-icon>
        <h3>Thông tin đề</h3>
      </div>
      <div class="assignment-info-grid">
        <input class="field" name="title" value="${escapeHtml(assignment.title)}" placeholder="Tên đề thi / BTVN" required>
        <select class="field" name="lecture_id">
          <option value="">Bài tập tự do</option>
          ${lectures.map((lecture) => option(lecture.id, lecture.title, assignment.lecture_id)).join('')}
        </select>
        <input class="field wide" name="pdf_url" value="${escapeHtml(assignment.pdf_url)}" placeholder="Link PDF Google Drive" required>
      </div>
    </section>
    <section class="answer-key-panel">
      <div class="question-builder-header">
        <div>
          <p class="eyebrow">Phiếu trả lời</p>
          <h3>${questions.length} câu</h3>
        </div>
        <div class="button-row">
          <md-outlined-button type="button" data-add-question="mcq"><md-icon slot="icon">radio_button_checked</md-icon>Trắc nghiệm</md-outlined-button>
          <md-outlined-button type="button" data-add-question="tf4"><md-icon slot="icon">fact_check</md-icon>Đúng/Sai</md-outlined-button>
          <md-outlined-button type="button" data-add-question="short"><md-icon slot="icon">short_text</md-icon>Điền ngắn</md-outlined-button>
        </div>
      </div>
      <div class="question-builder">
        ${questions.length ? questions.map((question, index) => renderQuestionEditor(question, index)).join('') : '<div class="empty-state compact">Chưa có câu nào trong phiếu trả lời.</div>'}
      </div>
    </section>
  `;
}

function renderQuestionEditor(question, index) {
  return `
    <article class="question-editor" data-index="${index}">
      <div class="editor-heading">
        <strong>Câu ${index + 1}</strong>
        <button type="button" data-remove-question="${index}" aria-label="Xóa câu"><md-icon>close</md-icon></button>
      </div>
      <input type="hidden" name="question-id-${index}" value="${escapeHtml(question.id ?? '')}">
      <div class="form-grid three">
        <select class="field" name="question-type-${index}">
          ${['mcq', 'tf4', 'short'].map((type) => option(type, type.toUpperCase(), question.type)).join('')}
        </select>
        <input class="field" name="question-points-${index}" type="number" step="0.25" min="0" value="${Number(question.points ?? 1)}" placeholder="Điểm">
        <input class="field" name="question-sort-${index}" type="number" value="${Number(question.sort_order ?? index + 1)}" placeholder="Thứ tự">
      </div>
      ${renderQuestionKeyEditor(question, index)}
    </article>
  `;
}

function renderQuestionKeyEditor(question, index) {
  const key = question.answer_key ?? {};
  if (question.type === 'tf4') {
    const statements = question.settings?.statements ?? ['', '', '', ''];
    const correct = key.correct_answer ?? [true, true, true, true];
    const pointsMap = Array.isArray(key.points_map) ? key.points_map : [];
    return `
      <div class="tf-editor">
        ${[0, 1, 2, 3]
          .map(
            (itemIndex) => `
              <div class="tf-row">
                <input class="field" name="tf-statement-${index}-${itemIndex}" value="${escapeHtml(statements[itemIndex] ?? '')}" placeholder="Ý ${itemIndex + 1}">
                <input class="field" name="tf-points-${index}-${itemIndex}" type="number" step="0.25" min="0" value="${escapeHtml(pointsMap[itemIndex] ?? '')}" placeholder="Điểm ý">
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

function wireAssignmentEditor(lectures) {
  document.querySelector('#new-assignment')?.addEventListener('click', () => {
    state.assignmentEditor = emptyEditor();
    mountAssignmentManager();
  });

  document.querySelectorAll('[data-load-assignment]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const editor = await fetchAssignmentEditor(button.dataset.loadAssignment);
        state.assignmentEditor = {
          assignment: editor.assignment,
          questions: editor.questions.map(normalizeEditorQuestion),
        };
        await mountAssignmentManager();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });

  document.querySelectorAll('[data-add-question]').forEach((button) => {
    button.addEventListener('click', () => {
      state.assignmentEditor = collectEditor(lectures);
      state.assignmentEditor.questions.push(defaultQuestion(button.dataset.addQuestion));
      mountAssignmentManager();
    });
  });

  document.querySelectorAll('[data-remove-question]').forEach((button) => {
    button.addEventListener('click', () => {
      state.assignmentEditor = collectEditor(lectures);
      state.assignmentEditor.questions.splice(Number(button.dataset.removeQuestion), 1);
      mountAssignmentManager();
    });
  });

  document.querySelector('#delete-assignment')?.addEventListener('click', async () => {
    if (!window.confirm('Xóa đề này?')) return;
    try {
      await deleteAssignment(state.assignmentEditor.assignment.id);
      state.assignmentEditor = emptyEditor();
      toast('Đã xóa đề.', 'success');
      await mountAssignmentManager();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  document.querySelector('#assignment-editor')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const restore = setButtonLoading(event.currentTarget.querySelector('md-filled-button'));
    try {
      const editor = collectEditor(lectures);
      await saveAssignmentWithQuestions(
        {
          ...editor.assignment,
          id: editor.assignment.id || undefined,
          lecture_id: editor.assignment.lecture_id || null,
          owner_id: state.profile.id,
        },
        editor.questions,
      );
      state.assignmentEditor = emptyEditor();
      toast('Đã lưu đề thi.', 'success');
      await mountAssignmentManager();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      restore();
    }
  });
}

function defaultQuestion(type) {
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

function collectEditor() {
  const form = document.querySelector('#assignment-editor');
  const values = Object.fromEntries(new FormData(form).entries());
  const questions = Array.from(document.querySelectorAll('.question-editor')).map((card) => {
    const index = Number(card.dataset.index);
    const type = values[`question-type-${index}`];
    const base = {
      id: values[`question-id-${index}`] || undefined,
      type,
      prompt: `Câu ${index + 1}`,
      points: Number(values[`question-points-${index}`] || 0),
      sort_order: Number(values[`question-sort-${index}`] || index + 1),
      choices: [],
      settings: {},
      answer_key: {},
    };

    if (type === 'mcq') {
      base.choices = [];
      base.answer_key = { correct_answer: values[`mcq-answer-${index}`] || 'A' };
    }

    if (type === 'tf4') {
      base.settings = {
        statements: [0, 1, 2, 3].map((item) => values[`tf-statement-${index}-${item}`] || `Ý ${item + 1}`),
      };
      base.answer_key = {
        correct_answer: [0, 1, 2, 3].map((item) => values[`tf-answer-${index}-${item}`] === 'true'),
        points_map: [0, 1, 2, 3].map((item) => {
          const value = values[`tf-points-${index}-${item}`];
          return value === '' || value === undefined ? null : Number(value);
        }),
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

  return {
    assignment: {
      id: values.id || undefined,
      title: values.title,
      description: values.description,
      pdf_url: values.pdf_url,
      lecture_id: values.lecture_id,
      sort_order: Number(values.sort_order || 0),
      published: values.published !== 'false',
    },
    questions,
  };
}

async function mountStudents() {
  const root = pageRoot();
  root.innerHTML = renderLoading();
  try {
    const students = await fetchStudents();
    root.innerHTML = `
      <section class="panel">
        <div class="panel-heading">
          <h2>Tạo tài khoản</h2>
        </div>
        <form id="create-user-form" class="form-grid four">
          <input class="field" name="full_name" placeholder="Họ tên" required>
          <input class="field" name="email" type="email" placeholder="Email" required>
          <input class="field" name="password" type="text" placeholder="Mật khẩu tạm" required>
          <select class="field" name="role" ${isAdmin() ? '' : 'disabled'}>
            ${option('student', 'Học sinh', 'student')}
            ${option('teacher', 'Giáo viên')}
            ${option('admin', 'Admin')}
          </select>
          <md-filled-button type="submit"><md-icon slot="icon">person_add</md-icon>Tạo</md-filled-button>
        </form>
      </section>
      <section class="panel">
        <div class="panel-heading">
          <h2>Danh sách học sinh</h2>
        </div>
        <input id="student-search" class="field search-field" type="search" placeholder="Tìm theo tên hoặc email">
        ${renderStudentRows(students)}
      </section>
    `;
    wireStudentManager();
    wireTableSearch('#student-search', '[data-student-id]');
    wireMaterialFormButtons(root);
  } catch (error) {
    root.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
  }
}

function renderStudentRows(students) {
  if (!students.length) return '<div class="empty-state">Chưa có học sinh.</div>';
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Họ tên</th>
            <th>Email</th>
            <th>Trạng thái</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${students
            .map(
              (student) => `
                <tr data-student-id="${student.id}" data-search="${escapeHtml(`${student.full_name ?? ''} ${student.email ?? ''}`)}">
                  <td><input class="table-input" name="full_name" value="${escapeHtml(student.full_name ?? '')}"></td>
                  <td>${escapeHtml(student.email ?? '')}</td>
                  <td>
                    <select class="table-input" name="status">
                      ${option('active', 'Active', student.status)}
                      ${option('disabled', 'Disabled', student.status)}
                    </select>
                  </td>
                  <td class="row-actions">
                    <button data-save-student="${student.id}" aria-label="Lưu"><md-icon>save</md-icon></button>
                    <button data-reset-student="${student.id}" aria-label="Reset mật khẩu"><md-icon>key</md-icon></button>
                    <button data-delete-student="${student.id}" aria-label="Xóa"><md-icon>delete</md-icon></button>
                  </td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function wireStudentManager() {
  document.querySelector('#create-user-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const restore = setButtonLoading(form.querySelector('md-filled-button'));
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      await createManagedUser({
        ...values,
        role: isAdmin() ? values.role : 'student',
      });
      toast('Đã tạo tài khoản.', 'success');
      await mountStudents();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      restore();
    }
  });

  document.querySelectorAll('[data-save-student]').forEach((button) => {
    button.addEventListener('click', async () => {
      const row = button.closest('tr');
      try {
        await invokeAdminFunction('admin-update-user', {
          id: button.dataset.saveStudent,
          full_name: row.querySelector('[name="full_name"]').value,
          status: row.querySelector('[name="status"]').value,
          role: 'student',
        });
        toast('Đã cập nhật học sinh.', 'success');
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });

  document.querySelectorAll('[data-reset-student]').forEach((button) => {
    button.addEventListener('click', async () => {
      const password = window.prompt('Mật khẩu tạm mới, bỏ trống để hệ thống tạo:') || undefined;
      try {
        const result = await invokeAdminFunction('admin-reset-password', {
          id: button.dataset.resetStudent,
          password,
        });
        toast(`Mật khẩu tạm: ${result.temporaryPassword}`, 'success');
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });

  document.querySelectorAll('[data-delete-student]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Xóa tài khoản học sinh này?')) return;
      try {
        await deleteManagedUser(button.dataset.deleteStudent);
        toast('Đã xóa học sinh.', 'success');
        await mountStudents();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
}

async function mountGrades() {
  if (!isManager()) return mountStudentGrades();

  const root = pageRoot();
  root.innerHTML = renderLoading();
  try {
    const rows = await fetchGradebook();
    root.innerHTML = `
      <section class="panel">
        <div class="panel-heading">
          <h2>Bảng điểm tổng hợp</h2>
        </div>
        <input id="grade-search" class="field search-field" type="search" placeholder="Tìm theo học sinh, email hoặc bài thi">
        ${renderAttemptsTable(rows, true)}
      </section>
    `;
    wireTableSearch('#grade-search', 'tbody tr[data-search]');
  } catch (error) {
    root.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
  }
}

async function mountStudentGrades() {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang tải bảng điểm');
  try {
    const data = await fetchLearningPath(state.profile.role);
    const assignments = collectLearningPathAssignments(data);
    root.innerHTML = `
      <section class="panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Bảng điểm</p>
            <h2>${assignments.length} bài tập về nhà</h2>
          </div>
        </div>
        ${renderStudentGradesTable(assignments)}
      </section>
    `;
  } catch (error) {
    root.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
  }
}

function collectLearningPathAssignments(data) {
  const rowsById = new Map();
  const scoreOf = (assignment) => Number(assignment.progress?.bestScore ?? -1);
  const pushAssignment = (assignment, context = 'Bài tập tự do') => {
    const row = { ...assignment, context };
    const current = rowsById.get(assignment.id);
    if (!current || scoreOf(row) > scoreOf(current)) {
      rowsById.set(assignment.id, row);
    }
  };

  for (const phase of data.phases ?? []) {
    for (const module of phase.modules ?? []) {
      for (const lecture of module.lectures ?? []) {
        for (const assignment of lecture.assignments ?? []) {
          pushAssignment(assignment, lecture.title || module.title || phase.title);
        }
      }
      for (const group of module.lecture_groups ?? []) {
        for (const lecture of group.lectures ?? []) {
          for (const assignment of lecture.assignments ?? []) {
            pushAssignment(assignment, lecture.title || group.title || module.title || phase.title);
          }
        }
      }
    }
  }

  for (const assignment of data.freeAssignments ?? []) {
    pushAssignment(assignment);
  }

  return Array.from(rowsById.values()).sort((a, b) => a.title.localeCompare(b.title, 'vi'));
}

function renderStudentGradesTable(assignments) {
  if (!assignments.length) return '<div class="empty-state">Chưa có bài tập về nhà.</div>';
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Bài tập</th>
            <th>Thuộc bài</th>
            <th>Trạng thái</th>
            <th>Điểm cao nhất</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${assignments
            .map((assignment) => {
              const hasSubmitted = assignment.progress?.status === 'submitted';
              return `
                <tr>
                  <td><strong>${escapeHtml(assignment.title)}</strong></td>
                  <td>${escapeHtml(assignment.context ?? '-')}</td>
                  <td><span class="status">${hasSubmitted ? 'Đã làm' : 'Chưa làm'}</span></td>
                  <td>
                    ${
                      hasSubmitted
                        ? `<div class="score-progress-block"><span>${formatScore(assignment.progress.bestScore)}/10</span>${renderScoreProgress(assignment.progress.bestScore)}</div>`
                        : '-'
                    }
                  </td>
                  <td><a class="text-link" href="#/assignment/${assignment.id}">${hasSubmitted ? 'Làm lại' : 'Làm bài'}</a></td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function mountSettings() {
  const root = pageRoot();
  root.innerHTML = `
    <section class="settings-page">
      <div class="panel settings-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Giao diện</p>
            <h2>Cài đặt hiển thị</h2>
          </div>
        </div>
        <div class="settings-row">
          <div>
            <strong>Dark mode</strong>
            <p class="muted">Chuyển giao diện sang nền tối.</p>
          </div>
          <md-switch id="settings-dark-mode" ${state.theme === 'dark' ? 'selected' : ''} aria-label="Dark mode"></md-switch>
        </div>
      </div>
    </section>
  `;

  document.querySelector('#settings-dark-mode')?.addEventListener('change', (event) => {
    setThemeMode(event.currentTarget.selected ? 'dark' : 'light');
  });
}

function wireTableSearch(inputSelector, rowSelector) {
  const input = document.querySelector(inputSelector);
  if (!input) return;

  input.addEventListener('input', () => {
    const keyword = input.value.trim().toLowerCase();
    document.querySelectorAll(rowSelector).forEach((row) => {
      const haystack = (row.dataset.search ?? '').toLowerCase();
      row.hidden = keyword !== '' && !haystack.includes(keyword);
    });
  });
}

async function mountCurrentRoute() {
  const current = route();
  if (!isManager() && ['dashboard', 'content', 'assignments', 'students'].includes(current.name)) {
    go('learn');
    return;
  }

  if (current.name === 'assignment') return mountAssignment(current.id);
  if (current.name === 'phase') return mountPhaseDetail(current.id);
  if (current.name === 'history') return mountHistory();
  if (current.name === 'countdown') return mountCountdown();
  if (current.name === 'settings') return mountSettings();
  if (current.name === 'review') return mountReview(current.id);
  if (current.name === 'dashboard') return mountDashboard();
  if (current.name === 'content') return mountContentManager();
  if (current.name === 'assignments') return mountAssignmentManager();
  if (current.name === 'students') return mountStudents();
  if (current.name === 'grades') return mountGrades();
  return mountLearn();
}

async function render() {
  if (!hasSupabaseConfig || !state.session || !state.profile) {
    renderAuth();
    return;
  }
  renderShell();
  await mountCurrentRoute();
}

async function bootstrap() {
  if (!hasSupabaseConfig) {
    renderAuth();
    return;
  }

  try {
    state.session = await getSession();
    if (state.session) state.profile = await getCurrentProfile();
  } catch (error) {
    toast(error.message, 'error');
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    try {
      state.session = session;
      state.profile = session ? await getCurrentProfile() : null;
    } catch (error) {
      state.session = null;
      state.profile = null;
      toast(error.message, 'error');
    }
    render();
  });

  window.addEventListener('hashchange', render);
  render();
}

bootstrap();
