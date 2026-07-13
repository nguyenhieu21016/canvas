import '@material/web/button/filled-button.js';
import '@material/web/icon/icon.js';
import '@material/web/textfield/outlined-text-field.js';
import './styles.css';
import { hasSupabaseConfig, supabase } from './services/supabaseClient.js';
import { renderAuth } from './pages/Auth.js';
import { addRoute, mountCurrentRoute as routerMount, route, go } from './router.js';
import { state, colorThemes, isManager, isAdmin, pageRoot as storePageRoot } from './store.js';
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
  fetchTeachingLogs,
  upsertTeachingLog,
  deleteTeachingLog,
  getCurrentProfile,
  getSession,
  invokeAdminFunction,
  removeProfileAvatar,
  requestPasswordReset,
  regradeAssignment,
  reorderContentNodes as reorderContentNodesApi,
  saveAssignmentWithQuestions,
  signIn,
  signOut,
  signUpStudent,
  submitAssignmentAttempt,
  updateCurrentUserPassword,
  updateProfileAvatar,
  updateProfileName,
  upsertLecture,
  upsertLectureGroup,
  upsertModule,
  upsertPhase,
  initPresence,
} from './services/lmsApi.js';
import { clearDraft, loadDraft, saveDraft } from './lib/draft.js';
import { toDrivePreviewUrl } from './lib/drive.js';
import { formatDateTime, formatScore, roleLabel } from './lib/format.js';
import { escapeHtml, option, setButtonLoading, renderLatexText } from './lib/html.js';
import { normalizeAssignmentEditor } from './lib/assignment.js';

const app = document.querySelector('#app');
const toastEl = document.querySelector('#toast');
const MAX_AVATAR_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_UPLOAD_BYTES = 250 * 1024;
const AVATAR_SIZE = 320;
const APP_VERSION = '1.4.0';
const APP_LAST_UPDATE = 'Hỗ trợ parse và render đề thi chuẩn LaTeX (MathJax) trực tiếp trên trình duyệt, kèm theo lời giải chi tiết và hệ thống điều hướng thông minh.';
let renderGeneration = 0;
let assignmentsForManagerList = [];
let appElementsPromise = null;
const detachedPageRoot = {
  isConnected: false,
  set innerHTML(_value) {},
  get innerHTML() {
    return '';
  },
};

// (Removed temp fix)

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
  if (!colorThemes.some((theme) => theme.id === colorTheme)) return;
  state.colorTheme = colorTheme;
  localStorage.setItem('lms:colorTheme', state.colorTheme);
  applyTheme();
}

applyTheme();

function ensureAppElements() {
  appElementsPromise ??= import('./material/app.js');
  return appElementsPromise;
}

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

function renderAccountAvatar(profile, className = 'account-avatar') {
  if (profile?.avatar_url) {
    return `
      <span class="${className} has-image" aria-hidden="true">
        <img src="${escapeHtml(profile.avatar_url)}" alt="">
      </span>
    `;
  }

  return `
    <span class="${className}" aria-hidden="true">
      ${escapeHtml(accountInitial(profile))}
    </span>
  `;
}

function daysUntilExam() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const examDate = new Date(2027, 5, 11);
  return Math.max(0, Math.ceil((examDate - start) / 86_400_000));
}

function pageRoot() { return storePageRoot(); }

function renderLoading(label = 'Đang tải dữ liệu') {
  return `
    <div class="loading-state">
      <md-circular-progress indeterminate></md-circular-progress>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function renderSkeletonDashboard() {
  return `
    <section class="students-dashboard" style="display: flex; flex-wrap: wrap; gap: 24px; align-items: stretch; opacity: 0.85; padding: var(--page-gutter);">
      <!-- Sidebar Skeleton -->
      <div style="display: flex; flex-direction: column; gap: 16px; width: 320px; min-width: 320px;">
        <div class="panel" style="padding: 16px; border-radius: var(--md-sys-shape-corner-large, 16px); background: var(--md-sys-color-surface-container-low); display: flex; flex-direction: column; gap: 12px;">
          <div class="skeleton" style="width: 140px; height: 20px; border-radius: 4px;"></div>
          <div style="display: flex; align-items: center; gap: 12px; padding: 12px;">
            <div class="skeleton" style="width: 40px; height: 40px; border-radius: 50%;"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
              <div class="skeleton" style="width: 100px; height: 16px; border-radius: 4px;"></div>
              <div class="skeleton" style="width: 140px; height: 12px; border-radius: 4px;"></div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; padding: 12px;">
            <div class="skeleton" style="width: 40px; height: 40px; border-radius: 50%;"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
              <div class="skeleton" style="width: 100px; height: 16px; border-radius: 4px;"></div>
              <div class="skeleton" style="width: 140px; height: 12px; border-radius: 4px;"></div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Details Panel Skeleton -->
      <div class="panel" style="flex: 1; padding: 24px; border-radius: var(--md-sys-shape-corner-large, 16px); background: var(--md-sys-color-surface-container-low); min-height: 480px; display: flex; flex-direction: column; gap: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div class="skeleton" style="width: 48px; height: 48px; border-radius: 50%;"></div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div class="skeleton" style="width: 180px; height: 24px; border-radius: 4px;"></div>
              <div class="skeleton" style="width: 120px; height: 14px; border-radius: 4px;"></div>
            </div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
          <div class="panel" style="background: var(--md-sys-color-surface-container-high); padding: 12px; border-radius: var(--md-sys-shape-corner-medium, 12px); display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div class="skeleton" style="width: 60px; height: 14px; border-radius: 4px;"></div>
            <div class="skeleton" style="width: 40px; height: 20px; border-radius: 4px;"></div>
          </div>
          <div class="panel" style="background: var(--md-sys-color-surface-container-high); padding: 12px; border-radius: var(--md-sys-shape-corner-medium, 12px); display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div class="skeleton" style="width: 60px; height: 14px; border-radius: 4px;"></div>
            <div class="skeleton" style="width: 40px; height: 20px; border-radius: 4px;"></div>
          </div>
          <div class="panel" style="background: var(--md-sys-color-surface-container-high); padding: 12px; border-radius: var(--md-sys-shape-corner-medium, 12px); display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div class="skeleton" style="width: 60px; height: 14px; border-radius: 4px;"></div>
            <div class="skeleton" style="width: 40px; height: 20px; border-radius: 4px;"></div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderSkeletonAssignments() {
  return `
    <section class="assignment-manager" style="display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 18px; align-items: start; opacity: 0.85; padding: var(--page-gutter);">
      <!-- Sidebar List Skeleton -->
      <aside class="panel list-panel" style="border-radius: var(--md-sys-shape-corner-large, 16px); background: var(--md-sys-color-surface-container-low); padding: 16px; display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div class="skeleton" style="width: 120px; height: 22px;"></div>
          <div class="skeleton" style="width: 60px; height: 32px; border-radius: 16px;"></div>
        </div>
        <div style="padding: 12px 0; display: flex; flex-direction: column; gap: 6px;">
          <div class="skeleton" style="width: 80%; height: 18px;"></div>
          <div class="skeleton" style="width: 50%; height: 12px;"></div>
        </div>
        <div style="padding: 12px 0; display: flex; flex-direction: column; gap: 6px;">
          <div class="skeleton" style="width: 75%; height: 18px;"></div>
          <div class="skeleton" style="width: 40%; height: 12px;"></div>
        </div>
      </aside>

      <!-- Split workspace skeleton -->
      <div style="display: flex; flex-direction: column; gap: 18px;">
        <div class="panel" style="border-radius: var(--md-sys-shape-corner-large, 16px); background: var(--md-sys-color-surface-container-low); padding: 24px; display: flex; flex-direction: column; gap: 16px; height: 400px;">
          <div class="skeleton" style="width: 200px; height: 28px;"></div>
          <div class="skeleton" style="width: 100%; height: 44px; border-radius: 8px;"></div>
          <div class="skeleton" style="width: 100%; height: 200px; border-radius: 8px; margin-top: 12px;"></div>
        </div>
      </div>
    </section>
  `;
}

function renderStateMessage({ tone = 'empty', icon = 'info', title, message = '', actionHref = '', actionLabel = '', actionIcon = 'arrow_forward', retry = false }) {
  return `
    <div class="${tone === 'error' ? 'error-state' : 'empty-state'} state-message">
      <md-icon>${escapeHtml(icon)}</md-icon>
      <div>
        <strong>${escapeHtml(title)}</strong>
        ${message ? `<p>${escapeHtml(message)}</p>` : ''}
      </div>
      ${
        actionHref && actionLabel
          ? `<a class="text-link state-action" href="${escapeHtml(actionHref)}"><md-icon>${escapeHtml(actionIcon)}</md-icon>${escapeHtml(actionLabel)}</a>`
          : ''
      }
      ${
        retry
          ? '<button class="text-link state-action" type="button" data-retry-route><md-icon>refresh</md-icon>Thử lại</button>'
          : ''
      }
    </div>
  `;
}

function renderErrorState(error, message = 'Không tải được dữ liệu. Kiểm tra kết nối rồi thử lại.') {
  return renderStateMessage({
    tone: 'error',
    icon: 'error',
    title: error?.message || 'Có lỗi xảy ra',
    message,
    retry: true,
  });
}

function wireRouteRetry(root = pageRoot()) {
  root.querySelectorAll('[data-retry-route]').forEach((button) => {
    button.addEventListener('click', () => mountCurrentRoute());
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh này.'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Không nén được ảnh avatar.'));
    }, type, quality);
  });
}

async function resizeAvatarFile(file) {
  if (!file) throw new Error('Chọn ảnh avatar trước.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Avatar chỉ nhận ảnh JPG, PNG hoặc WebP.');
  }
  if (file.size > MAX_AVATAR_SOURCE_BYTES) {
    throw new Error('Ảnh gốc tối đa 5MB thôi m.');
  }

  const image = await loadImageFromFile(file);
  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
  const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext('2d');
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  let bestBlob = null;
  for (const quality of [0.82, 0.72, 0.62, 0.52]) {
    bestBlob = await canvasToBlob(canvas, 'image/webp', quality);
    if (bestBlob.size <= MAX_AVATAR_UPLOAD_BYTES) break;
  }

  if (bestBlob.size > MAX_AVATAR_UPLOAD_BYTES) {
    throw new Error('Ảnh sau khi nén vẫn hơi nặng, thử ảnh khác nhé.');
  }
  return bestBlob;
}

function navItems() {
  if (isManager()) {
    return [
      { path: 'learn', icon: 'school', label: 'Học tập' },
      { path: 'dashboard', icon: 'groups', label: 'Theo dõi' },
      { path: 'manage', icon: 'admin_panel_settings', label: 'Quản trị' },
      { path: 'settings', icon: 'settings', label: 'Cài đặt' },
    ];
  }

  return [
    { path: 'learn', icon: 'school', label: 'Học tập' },
    { path: 'grades', icon: 'grade', label: 'Bảng điểm' },
    { path: 'countdown', icon: 'event', label: 'Đếm ngược' },

    { path: 'settings', icon: 'settings', label: 'Cài đặt' },
  ];
}

function renderShell() {
  const current = route().name;
  const activeNav = ['phase', 'assignment', 'review'].includes(current)
    ? 'learn'
    : ['content', 'assignments', 'students', 'manage', 'progress', 'online', 'salary'].includes(current)
      ? 'manage'
      : current;
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
              ${renderAccountAvatar(state.profile)}
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

  document.querySelector('#logout-button')?.addEventListener('click', () => {
    const button = document.querySelector('#logout-button');
    if (button) button.disabled = true;
    state.session = null;
    state.profile = null;
    go('learn');
    render();
    signOut().catch((error) => toast(error.message, 'error'));
  });

}

function pageTitle(name) {
  return (
    {
      learn: 'Lộ trình ôn thi',
      phase: 'Chi tiết giai đoạn',
      history: 'Lịch sử học tập',
      countdown: 'Đếm ngược THPTQG',
      settings: 'Cài đặt',
      assignment: 'Làm bài',
      review: 'Xem lại bài làm',
      dashboard: 'Theo dõi học sinh',
      manage: 'Quản lý giảng dạy',
      content: 'Quản lý nội dung',
      assignments: 'Quản lý đề thi',
      students: 'Quản lý học sinh',
      grades: 'Bảng điểm',
      online: 'Đang hoạt động',
    }[name] ?? 'Lộ trình ôn thi'
  );
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
      <section class="assignment-start" ${assignment.pdf_url === 'latex' ? 'style="max-width: 760px; margin: 0 auto; width: 100%;"' : ''}>
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
        ${assignment.pdf_url === 'latex' ? `
          <div class="panel assignment-history-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Lịch sử làm bài</p>
                <h2>${attempts.length} lần nộp</h2>
              </div>
            </div>
            ${attempts.length > 0 ? renderStudentAssignmentHistory(attempts) : '<div class="empty-state" style="padding: 48px 0; background: transparent; border: 1px dashed var(--md-sys-color-outline-variant); border-radius: 16px; margin-top: 16px;"><md-icon style="font-size: 48px; color: var(--md-sys-color-outline); margin-bottom: 16px;">history</md-icon><p style="color: var(--md-sys-color-on-surface-variant);">Bạn chưa làm bài tập này lần nào.</p></div>'}
          </div>
        ` : `
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
        `}
      </section>
    `;
    wireMaterialFormButtons(root);
    document.querySelector('#start-assignment')?.addEventListener('click', () => mountAssignmentExam(id));
    document.querySelector('#review-latest-attempt')?.addEventListener('click', () => go(`review/${latest.id}`));
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
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
      ${assignment.pdf_url === 'latex' ? `
        <section class="exam-shell" style="height: auto; max-width: 1400px; width: 100%; margin: 0 auto; padding: 32px 24px; align-items: start; grid-template-columns: minmax(0, 1fr) 340px; gap: 40px;">
          <form id="answer-form" style="min-width: 0; max-width: 900px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 32px; padding-bottom: 80px;">
            ${questions.map((q, i) => {
              const cleanPrompt = q.prompt ? q.prompt.replace(/^Câu\\s*\\d+[\\.\\:\\s]*/i, '') : '';
              return `
              <article class="latex-exam-card panel" data-question-id="${q.id}" data-type="${q.type}" style="padding: 32px; border-radius: 16px; background: var(--md-sys-color-surface-container-lowest); border: 1px solid var(--md-sys-color-outline-variant); box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                <div style="margin-bottom: 24px; font-size: 1rem; color: var(--md-sys-color-on-surface); display: flex; flex-direction: column; gap: 12px;">
                  <div style="display: flex; align-items: center; gap: 12px; border-bottom: 1px dashed var(--md-sys-color-outline-variant); padding-bottom: 16px;">
                    <div style="font-weight: 700; padding: 6px 16px; background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); border-radius: 8px; font-size: 1rem; letter-spacing: 0.5px;">CÂU ${i + 1}</div>
                    <div style="flex: 1; color: var(--md-sys-color-outline); font-size: 0.9rem; text-align: right;">Chọn một đáp án đúng</div>
                  </div>
                  <div style="font-weight: normal; line-height: 1.5; padding-top: 8px;">${escapeHtml(cleanPrompt).replace(/\\n/g, '<br>')}</div>
                </div>
                
                <div class="choice-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                  ${(q.choices ?? []).map((choice, cIdx) => {
                    const value = String.fromCharCode(65 + cIdx);
                    return `
                      <label class="latex-choice-tile" style="display: flex; gap: 16px; align-items: flex-start; cursor: pointer; padding: 16px; border: 2px solid var(--md-sys-color-surface-variant); background: var(--md-sys-color-surface-container-lowest); border-radius: 12px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);">
                        <div style="position: relative; flex-shrink: 0;">
                          <input type="radio" name="q-${q.id}" value="${value}" ${answers[q.id] === value ? 'checked' : ''} style="opacity: 0; position: absolute;">
                          <div class="latex-radio-circle" style="width: 32px; height: 32px; border-radius: 50%; background: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface-variant); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 1rem; transition: all 0.2s;">${value}</div>
                        </div>
                        <div style="flex: 1; padding-top: 4px; font-size: 1rem; line-height: 1.5; color: var(--md-sys-color-on-surface);">${escapeHtml(choice).replace(/\\n/g, '<br>')}</div>
                      </label>
                    `;
                  }).join('')}
                </div>
              </article>
            `}).join('')}
          </form>

          <!-- Right Sidebar: Navigator -->
          <aside class="exam-navigator panel" style="position: sticky; top: 112px; background: var(--md-sys-color-surface-container-lowest); border-radius: 12px; border: 1px solid var(--md-sys-color-outline-variant); padding: 24px; display: flex; flex-direction: column; gap: 16px;">
            <div style="font-weight: 600; margin-bottom: 8px;">Danh sách câu hỏi</div>
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;">
              ${questions.map((q, i) => `
                <button type="button" class="nav-btn ${answers[q.id] ? 'answered' : ''}" data-nav="${q.id}" onclick="document.querySelector('[data-question-id=\\'${q.id}\\']').scrollIntoView({behavior: 'smooth', block: 'center'})" style="padding: 10px 0; border-radius: 8px; border: 1px solid var(--md-sys-color-outline-variant); background: ${answers[q.id] ? 'var(--md-sys-color-primary)' : 'transparent'}; color: ${answers[q.id] ? 'var(--md-sys-color-on-primary)' : 'inherit'}; cursor: pointer; font-family: monospace; font-size: 1rem; transition: all 0.2s;">
                  ${String(i + 1).padStart(2, '0')}
                </button>
              `).join('')}
            </div>
            <div style="margin-top: 24px; display: flex; flex-direction: column; gap: 12px;">
              <p id="autosave-status" class="autosave-status" style="font-size: 0.85rem; text-align: center; color: var(--md-sys-color-outline);">${draft ? `Đã lưu ${formatDateTime(draft.savedAt)}` : 'Tự động lưu khi bạn chọn đáp án'}</p>
              <md-filled-button type="button" onclick="document.querySelector('#answer-form').requestSubmit()" style="height: 48px;">
                <md-icon slot="icon">send</md-icon> Nộp bài
              </md-filled-button>
            </div>
          </aside>
        </section>
        <style>
          .latex-choice-tile:has(input:checked) {
            border-color: var(--md-sys-color-primary) !important;
            background: var(--md-sys-color-surface-container-low) !important;
          }
          .latex-choice-tile:has(input:checked) .latex-radio-circle {
            border-color: var(--md-sys-color-primary) !important;
            background: var(--md-sys-color-primary) !important;
            color: var(--md-sys-color-on-primary) !important;
          }
          .exam-shell {
            @media (max-width: 900px) {
              flex-direction: column-reverse !important;
              .exam-navigator {
                width: 100% !important;
                position: static !important;
              }
            }
          }
        </style>
      ` : `
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
                <p id="autosave-status" class="autosave-status">${draft ? `Đã khôi phục bản nháp lưu lúc ${formatDateTime(draft.savedAt)}` : 'Tự động lưu khi bạn chọn đáp án.'}</p>
              </div>
              <md-filled-button type="submit" data-submit-assignment>
                <md-icon slot="icon">send</md-icon>
                Nộp bài
              </md-filled-button>
            </div>
            <div class="question-stack">
              ${questions.map((question, index) => renderQuestionInput(question, index, answers[question.id])).join('')}
            </div>
            <div class="sticky-submit-bar">
              <span id="sticky-autosave-status">${draft ? 'Bản nháp đã sẵn sàng' : 'Câu trả lời sẽ được lưu tự động'}</span>
              <md-filled-button type="submit" data-submit-assignment>
                <md-icon slot="icon">send</md-icon>
                Nộp bài
              </md-filled-button>
            </div>
          </form>
        </section>
      `}
    `;
    wireMaterialFormButtons(root);
    wireAnswerAutosave(assignment, id);
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

async function mountAssignmentManagerView(id) {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang tải thống kê bài tập');
  try {
    const [{ assignment, submittedStudents, pendingStudents, stats }] = await Promise.all([
      fetchAssignmentInsights(id),
    ]);
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
        state.assignmentEditor = normalizeAssignmentEditor(editor);
        go('assignments');
      } catch (error) {
        toast(error.message, 'error');
      }
    });
    document.querySelector('#all-assignments-from-insights')?.addEventListener('click', () => go('assignments'));
    wireMaterialFormButtons(root);
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
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

function relationOne(value) {
  return Array.isArray(value) ? value[0] : value;
}

function renderQuestionInput(question, index, answer) {
  const choices = ['A', 'B', 'C', 'D'];
  const settings = question.settings ?? {};
  const displayPrompt = question.prompt && question.prompt !== `Câu ${index + 1}`;
  const prompt = `
    <div class="question-prompt">
      <span>Câu ${index + 1}</span>
      ${displayPrompt ? `<p>${escapeHtml(question.prompt)}</p>` : ''}
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
  document.querySelectorAll('.question-card, .latex-exam-card').forEach((card) => {
    answers[card.dataset.questionId] = collectAnswerFromCard(card);
  });
  return answers;
}

function collectAnswerFromCard(card) {
  const id = card.dataset.questionId;
  const type = card.dataset.type;
  if (type === 'mcq') {
    return card.querySelector(`input[name="q-${id}"]:checked`)?.value ?? '';
  }
  if (type === 'tf4') {
    return Array.from({ length: 4 }, (_, index) => {
      const value = card.querySelector(`input[name="q-${id}-${index}"]:checked`)?.value;
      if (value === undefined) return null;
      return value === 'true';
    });
  }
  return card.querySelector(`input[name="q-${id}"]`)?.value ?? '';
}

function wireAnswerAutosave(assignment, assignmentId) {
  const form = document.querySelector('#answer-form');
  
  if (assignment.pdf_url === 'latex' && window.MathJax) {
    window.MathJax.typesetPromise();
  }

  const autosaveStatus = document.querySelector('#autosave-status');
  const stickyAutosaveStatus = document.querySelector('#sticky-autosave-status');
  let autosaveTimer;
  let draftAnswers = collectAnswers();
  const setAutosaveStatus = (message) => {
    if (autosaveStatus) autosaveStatus.textContent = message;
    if (stickyAutosaveStatus) stickyAutosaveStatus.textContent = message;
  };
  const persist = (event) => {
    if (assignment.pdf_url === 'latex' && event.target?.type === 'radio') {
      const qId = event.target.name.replace('q-', '');
      const navBtn = document.querySelector(`.nav-btn[data-nav="${qId}"]`);
      if (navBtn) {
        navBtn.classList.add('answered');
        navBtn.style.background = 'var(--md-sys-color-primary)';
        navBtn.style.color = 'var(--md-sys-color-on-primary)';
      }
    }

    const card = event.target?.closest?.('.question-card') || event.target?.closest?.('.latex-exam-card');
    if (card?.dataset?.questionId) {
      draftAnswers[card.dataset.questionId] = collectAnswerFromCard(card);
    } else {
      draftAnswers = collectAnswers();
    }
    setAutosaveStatus('Đang lưu bản nháp...');
    window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => {
      saveDraft(localStorage, state.profile.id, assignmentId, draftAnswers);
      setAutosaveStatus(`Đã lưu bản nháp lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`);
    }, 250);
  };
  form.addEventListener('input', persist);
  form.addEventListener('change', persist);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const buttons = Array.from(form.querySelectorAll('[data-submit-assignment]'));
    const button = buttons[0];
    buttons.forEach((item) => {
      item.disabled = true;
    });
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
      buttons.forEach((item) => {
        item.disabled = false;
      });
    }
  });
}

async function mountHistory() {
  const root = pageRoot();
  root.innerHTML = renderLoading();
  try {
    const history = isManager() ? await fetchGradebook() : await fetchMyHistory();
    root.innerHTML = `
      <section class="panel">
        <div class="panel-heading">
          <h2>Lịch sử nộp bài</h2>
        </div>
        ${renderAttemptsTable(history, true)}
      </section>
    `;
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
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
    
    // Fetch full questions to get choices and settings (explanation)
    let questions = [];
    if (review.assignment?.id) {
      const assignmentData = await fetchAssignmentForStudent(review.assignment.id);
      questions = assignmentData.questions || [];
    }
    
    // Map items with questions
    const itemsWithQuestions = items.map(item => {
      const q = questions.find(q => q.id === item.question_id);
      return { ...item, choices: q?.choices, settings: q?.settings };
    });
    
    if (review.assignment?.pdf_url === 'latex') {
      root.innerHTML = `
        <section class="exam-shell" style="height: auto; max-width: 1400px; margin: 0 auto; padding: 24px; align-items: start; grid-template-columns: minmax(0, 1fr) 300px; gap: 32px;">
          <div class="review-main-content" style="display: flex; flex-direction: column; gap: 24px;">
            <div class="split-heading panel" style="display: flex; justify-content: space-between; align-items: center; background: var(--md-sys-color-surface-container-low); padding: 24px 32px; border-radius: 16px; border: 1px solid var(--md-sys-color-outline-variant);">
              <div>
                <p class="eyebrow" style="color: var(--md-sys-color-primary);">Kết quả làm bài</p>
                <h2 style="margin: 0; font-size: 1.25rem; color: var(--md-sys-color-on-surface);">${escapeHtml(review.assignment?.title ?? 'Đề bài')}</h2>
              </div>
              <div style="display: flex; gap: 32px; align-items: center;">
                <div style="font-weight: 500; font-size: 1rem; display: flex; flex-direction: column; align-items: flex-end;">
                  <span style="font-size: 0.8rem; color: var(--md-sys-color-on-surface-variant); text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Số câu đúng</span>
                  <span style="color: var(--md-sys-color-primary); font-size: 1.15rem;">${items.filter(i => i.is_correct).length} / ${items.length}</span>
                </div>
                <div class="score-badge" style="font-size: 1.5rem; padding: 12px 24px; border-radius: 16px; background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); font-weight: 800;">${formatScore(review.attempt?.score_10)}</div>
                ${isManager() ? `
                  <md-outlined-button id="regrade-review-button" type="button">
                    <md-icon slot="icon">refresh</md-icon>
                    Chấm lại
                  </md-outlined-button>
                ` : ''}
              </div>
            </div>
            
            <div class="latex-review-list" style="display: flex; flex-direction: column; gap: 20px;">
            ${itemsWithQuestions.map((item, index) => {
              const isCorrect = item.is_correct;
              const chosenAnswer = formatAnswer(item.answer);
              const correctAnswer = formatAnswer(item.correct_answer ?? item.accepted_answers);
              
              return `
                <div id="latex-review-q${index}" class="latex-question-review panel" style="background: var(--md-sys-color-surface-container-lowest); border-radius: 16px; border: 1px solid ${isCorrect ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-error)'}; padding: 32px;">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--md-sys-color-surface-variant);">
                    <div style="font-weight: 700; padding: 6px 16px; border-radius: 8px; background: ${isCorrect ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-error-container)'}; color: ${isCorrect ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-error-container)'}; font-size: 1rem; letter-spacing: 0.5px;">CÂU ${index + 1}</div>
                    <md-icon style="color: ${isCorrect ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-error)'}; font-size: 28px;">${isCorrect ? 'check_circle' : 'cancel'}</md-icon>
                  </div>
                  <div style="font-weight: normal; font-size: 1rem; line-height: 1.5; color: var(--md-sys-color-on-surface); margin-bottom: 24px; overflow-wrap: break-word;">
                    ${escapeHtml(item.prompt).replace(/\n/g, '<br>')}
                  </div>
                  
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(max(250px, calc(50% - 16px)), 1fr)); gap: 16px; margin-bottom: 24px;">
                    ${(item.choices ?? []).map((choice, cIdx) => {
                      const letter = ['A', 'B', 'C', 'D'][cIdx];
                      const isChosen = chosenAnswer === letter;
                      const isCorrectChoice = correctAnswer === letter;
                      
                      let bg = 'var(--md-sys-color-surface-container-lowest)';
                      let border = '2px solid var(--md-sys-color-surface-variant)';
                      let icon = '<div style="width: 24px;"></div>';
                      
                      if (isCorrectChoice) {
                        bg = 'var(--md-sys-color-primary-container)';
                        border = '2px solid var(--md-sys-color-primary)';
                        icon = '<md-icon style="color: var(--md-sys-color-primary); font-size: 20px; margin-right: 12px; flex-shrink: 0;">check_circle</md-icon>';
                      } else if (isChosen && !isCorrectChoice) {
                        bg = 'var(--md-sys-color-error-container)';
                        border = '2px solid var(--md-sys-color-error)';
                        icon = '<md-icon style="color: var(--md-sys-color-error); font-size: 20px; margin-right: 12px; flex-shrink: 0;">cancel</md-icon>';
                      }
                      
                      return `
                        <div style="padding: 16px; border-radius: 12px; border: ${border}; background: ${bg}; display: flex; align-items: flex-start;">
                          ${icon}
                          <div style="line-height: 1.5; color: var(--md-sys-color-on-surface); font-size: 1rem;"><b>${letter}.</b> ${escapeHtml(choice).replace(/\n/g, '<br>')}</div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                  
                  <details style="background: var(--md-sys-color-surface-container); border-radius: 12px; border: 1px solid var(--md-sys-color-outline-variant); overflow: hidden;">
                    <summary style="padding: 16px 24px; font-weight: 500; cursor: pointer; color: var(--md-sys-color-on-surface); list-style: none; display: flex; justify-content: space-between; align-items: center; user-select: none;">
                      <div style="display: flex; align-items: center; gap: 12px;">
                        <md-icon style="color: var(--md-sys-color-primary);">lightbulb</md-icon> Lời giải chi tiết
                      </div>
                      <div style="display: flex; align-items: center; gap: 24px; color: var(--md-sys-color-on-surface-variant);">
                        <div style="display: flex; gap: 8px; align-items: center;">
                          <span style="font-size: 0.9em; font-weight: 500;">Đáp án đúng:</span>
                          <strong style="color: var(--md-sys-color-primary); font-size: 1rem;">${correctAnswer}</strong>
                        </div>
                        ${!isCorrect ? `
                          <div style="display: flex; gap: 8px; align-items: center;">
                            <span style="font-size: 0.9em; font-weight: 500;">Bạn chọn:</span>
                            <strong style="color: var(--md-sys-color-error); font-size: 1rem;">${chosenAnswer || 'Chưa làm'}</strong>
                          </div>
                        ` : ''}
                        <md-icon class="expand-icon" style="color: var(--md-sys-color-on-surface-variant);">expand_more</md-icon>
                      </div>
                    </summary>
                    <div style="padding: 24px; border-top: 1px solid var(--md-sys-color-outline-variant); font-size: 1rem; line-height: 1.6; color: var(--md-sys-color-on-surface-variant); background: var(--md-sys-color-surface-container-lowest); overflow-x: auto; max-width: 100%;">
                      ${item.settings?.explanation ? renderLatexText(item.settings.explanation) : '<i style="color: var(--md-sys-color-outline);">Không có lời giải chi tiết.</i>'}
                    </div>
                  </details>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        
        <div class="review-navigation-panel panel" style="position: sticky; top: 112px; background: var(--md-sys-color-surface-container); border-radius: 24px; padding: 24px; display: flex; flex-direction: column; gap: 20px; border: none;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--md-sys-color-outline-variant); padding-bottom: 16px;">
            <h3 style="margin: 0; font-size: 1.15rem; color: var(--md-sys-color-on-surface); font-weight: 600;">Bạn trả lời đúng</h3>
            <span style="font-size: 1.5rem; font-weight: 800; color: var(--md-sys-color-primary);">${items.filter(i => i.is_correct).length}/${items.length}</span>
          </div>
          
          <div style="font-weight: 600; font-size: 0.95rem; color: var(--md-sys-color-on-surface-variant); display: flex; align-items: center; gap: 8px;">
            <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--md-sys-color-surface-variant); color: var(--md-sys-color-on-surface-variant); display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">I</div>
            Trắc nghiệm
          </div>
          
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${items.map((i, idx) => {
              const isCorrect = i.is_correct;
              const bg = isCorrect ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-error-container)';
              const color = isCorrect ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-error-container)';
              return `
                <button type="button" onclick="document.getElementById('latex-review-q${idx}').scrollIntoView({behavior: 'smooth', block: 'center'})" style="width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: ${bg}; color: ${color}; font-weight: 600; font-size: 0.95rem; border: none; cursor: pointer; transition: filter 0.2s; font-family: inherit;" onmouseover="this.style.filter='brightness(0.9)'" onmouseout="this.style.filter='none'">
                  ${(idx + 1).toString().padStart(2, '0')}
                </button>
              `;
            }).join('')}
          </div>
          
          <div style="margin-top: 8px; border-top: 1px solid var(--md-sys-color-outline-variant); padding-top: 20px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 16px; height: 16px; border-radius: 50%; background: var(--md-sys-color-primary-container);"></div>
              <span style="font-size: 0.9rem; color: var(--md-sys-color-on-surface-variant); font-weight: 500;">Câu trả lời đúng</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 16px; height: 16px; border-radius: 50%; background: var(--md-sys-color-error-container);"></div>
              <span style="font-size: 0.9rem; color: var(--md-sys-color-on-surface-variant); font-weight: 500;">Câu trả lời sai</span>
            </div>
          </div>
        </div>
        </section>
        <style>
          details summary::-webkit-details-marker { display: none; }
          details[open] summary .expand-icon { transform: rotate(180deg); }
          .expand-icon { transition: transform 0.2s ease; }
          .latex-question-review details { transition: all 0.2s ease; }
          .latex-question-review details[open] { background: var(--md-sys-color-surface-container-low); }
        </style>
      `;
    } else {
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
              <div class="review-heading-actions">
                ${isManager() ? `
                  <md-outlined-button id="regrade-review-button" type="button">
                    <md-icon slot="icon">refresh</md-icon>
                    Chấm lại
                  </md-outlined-button>
                ` : ''}
                <div class="score-badge">${formatScore(review.attempt?.score_10)}/10</div>
              </div>
            </div>
            <div class="review-list">
              ${itemsWithQuestions
                .map(
                (item, index) => `
                  <article class="review-item ${item.is_correct ? 'correct' : 'wrong'}">
                    <div>
                      <p class="eyebrow">Câu ${index + 1}</p>
                      ${item.prompt && item.prompt !== `Câu ${index + 1}` && review.assignment?.pdf_url !== 'latex' ? `<h3>${escapeHtml(item.prompt)}</h3>` : ''}
                    </div>
                    <dl>
                      <dt>Bài làm</dt>
                      <dd>${escapeHtml(formatAnswer(item.answer))}</dd>
                      <dt>Đáp án</dt>
                      <dd>${escapeHtml(formatAnswer(item.correct_answer ?? item.accepted_answers))}</dd>
                    </dl>
                    ${item.settings?.explanation ? `
                      <div class="explanation-box" style="margin-top: 12px; padding: 12px; background: var(--md-sys-color-surface-variant); border-radius: 8px; font-size: 0.95rem; border-left: 4px solid var(--md-sys-color-primary);">
                        <strong>Lời giải:</strong><br>
                        ${renderLatexText(item.settings.explanation)}
                      </div>
                    ` : ''}
                  </article>
                `,
              )
              .join('')}
            </div>
          </div>
        </section>
      `;
    }
    wireMaterialFormButtons(root);
    
    if (review.assignment?.pdf_url === 'latex' && window.MathJax) {
      window.MathJax.typesetPromise();
    }
    
    document.querySelector('#regrade-review-button')?.addEventListener('click', async (event) => {
      const restore = setButtonLoading(event.currentTarget, 'Đang chấm...');
      try {
        const regradedCount = await regradeAssignment(review.assignment?.id);
        toast(`Đã chấm lại ${regradedCount} bài đã nộp.`, 'success');
        await mountReview(id);
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        restore();
      }
    });
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}


function formatAnswer(answer) {
  if (Array.isArray(answer)) {
    const isTrueFalseSet = answer.every((item) => item === true || item === false || item == null);
    if (isTrueFalseSet) return answer.map((item) => (item === true ? 'Đúng' : item === false ? 'Sai' : '-')).join(', ');
    return answer.map((item) => String(item ?? '-')).join(', ');
  }
  if (answer && typeof answer === 'object') return JSON.stringify(answer);
  return answer ?? '-';
}

async function mountProgress() {
  const root = pageRoot();
  root.innerHTML = renderSkeletonDashboard();

  let selectedProgressStudentId = null;

  try {
    const [students, learningPath] = await Promise.all([
      fetchStudents(),
      fetchLearningPath(state.profile.role),
    ]);

    selectedProgressStudentId = students[0]?.id ?? null;

    // Build flat lecture map by module (no duplicates)
    const lecturesByModuleId = new Map();
    for (const lecture of learningPath.lectures) {
      if (!lecturesByModuleId.has(lecture.module_id)) lecturesByModuleId.set(lecture.module_id, []);
      lecturesByModuleId.get(lecture.module_id).push(lecture);
    }
    const totalLectures = learningPath.lectures.length;

    root.innerHTML = `
      <section class="student-tracker-layout" style="display: flex; flex-direction: column; gap: 20px;">
        <style>
          .progress-sidebar-item:hover { background: var(--md-sys-color-surface-container-high) !important; }
          .teaching-lecture-row:hover { background: color-mix(in srgb, var(--md-sys-color-primary) 6%, transparent) !important; }
          details > summary::-webkit-details-marker { display: none; }
          details > summary { list-style: none; }
          details[open] > summary .dropdown-icon { transform: rotate(90deg); }
        </style>
        <div style="display: flex; flex-wrap: wrap; gap: 24px; align-items: start;">

          <!-- Sidebar: students list -->
          <div style="display: flex; flex-direction: column; gap: 12px; width: 280px; min-width: 280px; flex-shrink: 0;">
            <div class="panel" style="padding: 16px; border-radius: var(--md-sys-shape-corner-large, 16px); background: var(--md-sys-color-surface-container-low); display: flex; flex-direction: column; gap: 10px;">
              <h3 style="margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--md-sys-color-on-surface);">Học sinh</h3>
              <div class="progress-sidebar-list" style="display: flex; flex-direction: column; gap: 6px;"></div>
            </div>
          </div>

          <!-- Main: lecture checklist -->
          <div class="progress-detail-pane panel" style="flex: 1; min-width: 320px; padding: 24px; border-radius: var(--md-sys-shape-corner-large, 16px); background: var(--md-sys-color-surface-container-low); min-height: 480px; display: flex; flex-direction: column; gap: 20px;">
            <div class="progress-detail-loading" style="display: flex; align-items: center; justify-content: center; min-height: 200px; color: var(--md-sys-color-outline);">
              <md-circular-progress indeterminate></md-circular-progress>
            </div>
          </div>

        </div>
      </section>
    `;

    async function renderProgressDetail(studentId) {
      const pane = document.querySelector('.progress-detail-pane');
      if (!pane) return;
      pane.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; min-height: 200px;"><md-circular-progress indeterminate></md-circular-progress></div>`;

      const student = students.find((s) => s.id === studentId);
      if (!student) return;

      try {
        const teachingLogs = await fetchTeachingLogs(studentId);
        const taughtSet = new Set(teachingLogs.map((l) => l.lecture_id));
        const taughtMap = new Map(teachingLogs.map((l) => [l.lecture_id, l]));
        const taughtCount = learningPath.lectures.filter((l) => taughtSet.has(l.id)).length;
        const progressPct = totalLectures > 0 ? Math.round((taughtCount / totalLectures) * 100) : 0;

        const phasesMarkup = learningPath.phases.map((phase) => {
          let phaseTaught = 0;
          let phaseTotal = 0;
          
          const modulesMarkup = phase.modules.map((mod) => {
            let modTaught = 0;
            const lectures = lecturesByModuleId.get(mod.id) ?? [];
            if (lectures.length === 0) return '';
            const modTotal = lectures.length;
            phaseTotal += modTotal;
            
              const renderRow = (lecture) => {
              const isTaught = taughtSet.has(lecture.id);
              if (isTaught) { modTaught++; phaseTaught++; }
              return `
                <div class="teaching-lecture-row" data-lecture-id="${lecture.id}" data-student-id="${studentId}" data-taught="${isTaught}"
                  style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: background 0.15s; margin-bottom: 2px;
                         background: ${isTaught ? 'color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent)' : 'transparent'};">
                  <div class="lecture-checkbox" style="width: 20px; height: 20px; border-radius: 4px; flex-shrink: 0; transition: all 0.15s;
                    border: 2px solid ${isTaught ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'};
                    background: ${isTaught ? 'var(--md-sys-color-primary)' : 'transparent'};
                    display: flex; align-items: center; justify-content: center;">
                    ${isTaught ? '<md-icon style="font-size: 14px; color: var(--md-sys-color-on-primary);">check</md-icon>' : ''}
                  </div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.88rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                      font-weight: ${isTaught ? '600' : '400'};
                      color: ${isTaught ? 'var(--md-sys-color-on-surface)' : 'var(--md-sys-color-on-surface-variant)'};">  
                      ${escapeHtml(lecture.title)}
                    </div>
                  </div>
                </div>
              `;
            };
            
            const groupsMarkup = (mod.lecture_groups || []).map(group => {
              const groupLectures = (group.lectures || []).map(renderRow).join('');
              if (!groupLectures) return '';
              return `
                <div style="margin-left: 12px; margin-bottom: 6px; border-left: 2px solid var(--md-sys-color-surface-container-highest); padding-left: 12px;">
                  <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--md-sys-color-outline); margin-bottom: 4px;">
                    ${escapeHtml(group.title)}
                  </div>
                  ${groupLectures}
                </div>
              `;
            }).join('');
            
            const ungrouped = lectures.filter(l => !l.group_id).map(renderRow).join('');
            
            return `
              <details class="progress-module-details" ${modTaught < modTotal ? 'open' : ''} style="margin-bottom: 6px; border: 1px solid var(--md-sys-color-outline-variant); border-radius: 8px; overflow: hidden;">
                <summary style="padding: 10px 14px; background: var(--md-sys-color-surface-container); font-weight: 600; font-size: 0.85rem; cursor: pointer; list-style: none; display: flex; align-items: center; gap: 8px; user-select: none;">
                  <md-icon style="font-size: 1.1rem; color: var(--md-sys-color-outline); transition: transform 0.2s;" class="dropdown-icon">arrow_right</md-icon>
                  <md-icon style="font-size: 1rem; color: var(--md-sys-color-primary);">folder</md-icon>
                  <span style="flex: 1;">${escapeHtml(mod.title)}</span>
                  <span style="font-size: 0.75rem; background: ${modTaught === modTotal ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-highest)'}; color: ${modTaught === modTotal ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)'}; padding: 2px 8px; border-radius: 12px;">${modTaught}/${modTotal}</span>
                </summary>
                <div style="padding: 12px 14px; background: var(--md-sys-color-surface-container-lowest);">
                  ${groupsMarkup}
                  ${ungrouped}
                </div>
              </details>
            `;
          }).join('');

          if (!modulesMarkup.trim()) return '';
          return `
            <details class="progress-phase-details" ${phaseTaught < phaseTotal ? 'open' : ''} style="margin-bottom: 16px; border: 1px solid var(--md-sys-color-outline-variant); border-radius: 12px; overflow: hidden;">
              <summary style="padding: 12px 16px; background: var(--md-sys-color-surface-container-high); font-weight: 700; font-size: 0.95rem; cursor: pointer; list-style: none; display: flex; align-items: center; gap: 10px; user-select: none;">
                <md-icon style="font-size: 1.2rem; color: var(--md-sys-color-outline); transition: transform 0.2s;" class="dropdown-icon">arrow_right</md-icon>
                <md-icon style="font-size: 1.2rem; color: var(--md-sys-color-primary);">layers</md-icon>
                <span style="flex: 1; color: var(--md-sys-color-on-surface);">${escapeHtml(phase.title)}</span>
                <span style="font-size: 0.8rem; background: ${phaseTaught === phaseTotal ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container)'}; color: ${phaseTaught === phaseTotal ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)'}; padding: 4px 10px; border-radius: 16px;">${phaseTaught}/${phaseTotal}</span>
              </summary>
              <div style="padding: 14px; background: var(--md-sys-color-surface-container-lowest);">
                ${modulesMarkup}
              </div>
            </details>
          `;
        }).join('');

        pane.innerHTML = `
          <!-- Student header -->
          <div style="display: flex; align-items: center; gap: 14px; padding-bottom: 16px; border-bottom: 1px solid var(--md-sys-color-outline-variant);">
            ${renderAccountAvatar(student, 'account-avatar')}
            <div>
              <div style="font-size: 1.1rem; font-weight: 700; color: var(--md-sys-color-on-surface);">${escapeHtml(student.full_name ?? '')}</div>
              <div style="font-size: 0.8rem; color: var(--md-sys-color-on-surface-variant);">${escapeHtml(student.email ?? '')}</div>
            </div>
          </div>

          <!-- Progress bar -->
          <div style="background: var(--md-sys-color-surface-container-high); border-radius: 12px; padding: 14px 16px;
            display: flex; align-items: center; gap: 16px; border: 1px solid var(--md-sys-color-outline-variant);">
            <div style="flex: 1;">
              <div style="font-size: 0.85rem; font-weight: 600; color: var(--md-sys-color-on-surface); margin-bottom: 8px;">Tiến độ bài giảng</div>
              <div style="background: var(--md-sys-color-surface-container); border-radius: 100px; height: 8px; overflow: hidden;">
                <div style="height: 100%; width: ${progressPct}%; background: var(--md-sys-color-primary); border-radius: 100px; transition: width 0.4s ease;"></div>
              </div>
            </div>
            <div style="text-align: center; min-width: 60px;">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--md-sys-color-primary); line-height: 1;">${taughtCount}</div>
              <div style="font-size: 0.75rem; color: var(--md-sys-color-outline); margin-top: 2px;">/ ${totalLectures} bài</div>
            </div>
          </div>

          <!-- Lecture checklist -->
          <div style="display: flex; flex-direction: column; gap: 10px; overflow-y: auto; flex: 1;">
            ${phasesMarkup || '<div style="text-align: center; padding: 32px; color: var(--md-sys-color-outline);">Chưa có bài giảng nào.</div>'}
          </div>
        `;

        // Wire checkbox toggles
        pane.querySelectorAll('.teaching-lecture-row').forEach((row) => {
          row.addEventListener('click', async () => {
            const lectureId = row.dataset.lectureId;
            const sid = row.dataset.studentId;
            const wasTaught = row.dataset.taught === 'true';
            row.dataset.taught = String(!wasTaught);

            const checkbox = row.querySelector('.lecture-checkbox');
            const titleDiv = row.querySelector('[style*="overflow: hidden"]');
            if (!wasTaught) {
              checkbox.style.cssText += '; background: var(--md-sys-color-primary); border-color: var(--md-sys-color-primary);';
              checkbox.innerHTML = '<md-icon style="font-size: 14px; color: var(--md-sys-color-on-primary);">check</md-icon>';
              row.style.background = 'color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent)';
              if (titleDiv) { titleDiv.style.fontWeight = '600'; titleDiv.style.color = 'var(--md-sys-color-on-surface)'; }
            } else {
              checkbox.style.cssText += '; background: transparent; border-color: var(--md-sys-color-outline);';
              checkbox.innerHTML = '';
              row.style.background = 'transparent';
              if (titleDiv) { titleDiv.style.fontWeight = '400'; titleDiv.style.color = 'var(--md-sys-color-on-surface-variant)'; }
            }

            try {
              if (!wasTaught) await upsertTeachingLog({ studentId: sid, lectureId });
              else await deleteTeachingLog({ studentId: sid, lectureId });
              // Refresh sidebar progress
              renderProgressSidebar();
            } catch (err) {
              toast(err.message, 'error');
              row.dataset.taught = String(wasTaught);
              renderProgressDetail(sid);
            }
          });
        });

      } catch (err) {
        pane.innerHTML = `<div style="color: var(--md-sys-color-error); padding: 24px;">${escapeHtml(err.message)}</div>`;
      }
    }

    async function renderProgressSidebar() {
      const list = document.querySelector('.progress-sidebar-list');
      if (!list) return;
      // For each student, show name + mini progress
      const logsPerStudent = await Promise.all(
        students.map((s) => fetchTeachingLogs(s.id).then((logs) => ({ student: s, count: logs.length })))
      );
      list.innerHTML = logsPerStudent.map(({ student, count }) => {
        const pct = totalLectures > 0 ? Math.round((count / totalLectures) * 100) : 0;
        const isSelected = student.id === selectedProgressStudentId;
        return `
          <div class="progress-sidebar-item" data-sid="${student.id}"
            style="padding: 10px 12px; border-radius: 10px; cursor: pointer; transition: background 0.15s;
              background: ${isSelected ? 'var(--md-sys-color-secondary-container)' : 'transparent'};
              border: 1px solid ${isSelected ? 'var(--md-sys-color-outline)' : 'transparent'};">
            <div style="font-size: 0.88rem; font-weight: 600; color: var(--md-sys-color-on-surface);
              overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(student.full_name ?? student.email)}</div>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 5px;">
              <div style="flex: 1; background: var(--md-sys-color-surface-container-high); border-radius: 100px; height: 5px; overflow: hidden;">
                <div style="height: 100%; width: ${pct}%; background: var(--md-sys-color-primary); border-radius: 100px;"></div>
              </div>
              <span style="font-size: 0.75rem; color: var(--md-sys-color-outline); min-width: 32px; text-align: right;">${count}/${totalLectures}</span>
            </div>
          </div>
        `;
      }).join('');

      list.querySelectorAll('.progress-sidebar-item').forEach((item) => {
        item.addEventListener('click', () => {
          selectedProgressStudentId = item.dataset.sid;
          renderProgressSidebar();
          renderProgressDetail(selectedProgressStudentId);
        });
      });
    }

    await renderProgressSidebar();
    if (selectedProgressStudentId) await renderProgressDetail(selectedProgressStudentId);

  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
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
  return routerMount();
}

async function render() {
  const generation = ++renderGeneration;
  if (!hasSupabaseConfig || state.passwordRecovery || !state.session || !state.profile) {
    renderAuth();
    return;
  }
  await ensureAppElements();
  renderShell();
  if (generation !== renderGeneration || !state.session || !state.profile) return;
  await mountCurrentRoute();
}

function renderRouteTransition() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduceMotion) {
    render();
    return;
  }
  document.startViewTransition(() => render());
}

async function bootstrap() {
  if (!hasSupabaseConfig) {
    renderAuth();
    return;
  }

  try {
    state.session = await getSession();
    if (state.session) {
      state.profile = await getCurrentProfile(state.session.user);
      initPresence(state.profile);
    }
  } catch (error) {
    toast(error.message, 'error');
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    try {
      state.session = session;
      if (event === 'PASSWORD_RECOVERY') {
        state.passwordRecovery = true;
        state.authMode = 'updatePassword';
        state.profile = null;
        renderAuth();
        return;
      }
      
      // Prevent unnecessary fetches and DOM nuking on token refreshes
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        return;
      }
      
      // Only re-fetch if we actually have a new user session or no profile yet
      if (session) {
        if (!state.profile || state.profile.id !== session.user.id) {
          state.profile = await getCurrentProfile(session.user);
          initPresence(state.profile);
          render();
        }
      } else {
        if (state.profile) {
          state.profile = null;
          render();
        }
      }
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  window.addEventListener('hashchange', renderRouteTransition);
  render();
}

// Register routes
addRoute('learn', () => import('./student.js').then(m => m.mountLearn()));
addRoute('assignment/:id', (id) => mountAssignment(id));
addRoute('phase/:id', (id) => import('./student.js').then(m => m.mountPhaseDetail(id)));
addRoute('countdown', () => import('./pages/Countdown.js').then(m => m.mountCountdown()));
addRoute('settings', () => import('./pages/Settings.js').then(m => m.mountSettings()));
addRoute('review/:id', (id) => mountReview(id));
addRoute('dashboard', () => import('./student.js').then(m => m.mountDashboard()));
addRoute('manage', () => import('./admin.js').then(m => m.mountManageHub()));
addRoute('progress', mountProgress);
addRoute('content', () => import('./admin.js').then(m => m.mountContentManager()));
addRoute('assignments', () => import('./admin.js').then(m => m.mountAssignmentManager()));
addRoute('students', () => import('./admin.js').then(m => m.mountStudents()));
addRoute('online', () => import('./admin.js').then(m => m.mountOnlineUsers()));
addRoute('grades', () => isManager() ? import('./admin.js').then(m => m.mountGrades()) : import('./student.js').then(m => m.mountStudentGrades()));
addRoute('salary', () => import('./admin.js').then(m => m.mountSalaryManager()));

bootstrap();

// Exported for lazy loaded modules
export { 
  state, pageRoot, renderLoading, renderErrorState, wireRouteRetry, 
  escapeHtml, wireTableSearch, toast, isManager, renderAttemptsTable,
  renderAccountAvatar, renderSkeletonDashboard, renderStateMessage, wireMaterialFormButtons,
  driveFrame, renderMetric, render,
  isAdmin, renderSkeletonAssignments, renderScoreProgress,
  daysUntilExam, setThemeMode, setColorTheme
};
