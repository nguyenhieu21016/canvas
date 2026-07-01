import '@material/web/button/filled-button.js';
import '@material/web/icon/icon.js';
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
  createSolutionRequest,
  fetchAssignmentEditor,
  fetchAssignmentForStudent,
  fetchAssignmentInsights,
  fetchAssignmentSolutionRequests,
  fetchAssignmentsForManager,
  fetchAttemptReview,
  fetchDashboardStats,
  fetchGradebook,
  fetchLearningPath,
  fetchMyHistory,
  fetchSolutionRequest,
  fetchSolutionRequestsForManager,
  fetchSolutionRequestsForAttempt,
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
  updateSolutionRequest,
  upsertLecture,
  upsertLectureGroup,
  upsertModule,
  upsertPhase,
  initPresence,
} from './services/lmsApi.js';
import { clearDraft, loadDraft, saveDraft } from './lib/draft.js';
import { toDrivePreviewUrl } from './lib/drive.js';
import { formatDateTime, formatScore, roleLabel } from './lib/format.js';
import { escapeHtml, option, setButtonLoading } from './lib/html.js';
import { normalizeAssignmentEditor } from './admin.js';

const app = document.querySelector('#app');
const toastEl = document.querySelector('#toast');
const MAX_AVATAR_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_UPLOAD_BYTES = 250 * 1024;
const AVATAR_SIZE = 320;
const APP_VERSION = '1.3.5';
const APP_LAST_UPDATE = 'Giao diện Quản lý Đề thi mới: Tích hợp Combobox tìm kiếm thông minh, tối ưu không gian hiển thị và độ mượt mà.';
let renderGeneration = 0;
let assignmentsForManagerList = [];
let pendingSolutionRequests = [];
let appElementsPromise = null;
const detachedPageRoot = {
  isConnected: false,
  set innerHTML(_value) {},
  get innerHTML() {
    return '';
  },
};

// (Removed temp fix)

const colorThemes = [
  { id: 'blue', label: 'Xanh biển', color: '#d3e4ff' },
  { id: 'yellow', label: 'Vàng', color: '#f8e287' },
  { id: 'green', label: 'Xanh lá', color: '#d9f0c3' },
  { id: 'lavender', label: 'Tím', color: '#eaddff' },
  { id: 'pink', label: 'Hồng', color: '#ffd8e4' },
];

const storedColorTheme = localStorage.getItem('lms:colorTheme');
const state = {
  session: null,
  profile: null,
  authMode: 'login',
  passwordRecovery: false,
  assignmentEditor: null,
  theme: localStorage.getItem('lms:theme') || 'light',
  colorTheme: colorThemes.some((theme) => theme.id === storedColorTheme) ? storedColorTheme : 'blue',
};

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
    { path: 'history', icon: 'history', label: 'Lịch sử' },
    { path: 'settings', icon: 'settings', label: 'Cài đặt' },
  ];
}

function renderShell() {
  const current = route().name;
  const activeNav = ['phase', 'assignment', 'review', 'solution'].includes(current)
    ? 'learn'
    : ['content', 'assignments', 'students', 'solution-requests', 'manage', 'progress', 'online', 'salary'].includes(current)
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
      review: 'Xem lại bài',
      solution: 'Lời giải chi tiết',
      dashboard: 'Theo dõi học sinh',
      manage: 'Quản trị',
      content: 'Quản lý nội dung',
      assignments: 'Quản lý đề thi',
      students: 'Quản lý học sinh',
      'solution-requests': 'Quản lý yêu cầu',
      grades: 'Bảng điểm',
      online: 'Đang hoạt động',
    }[name] ?? 'Lộ trình ôn thi'
  );
}

function renderAuth() {
  const isReset = state.authMode === 'reset';
  const isUpdatePassword = state.authMode === 'updatePassword';
  const primaryLabel = isUpdatePassword
    ? 'Cập nhật mật khẩu'
    : isReset
      ? 'Gửi link đặt lại'
      : state.authMode === 'login'
        ? 'Đăng nhập'
        : 'Tạo tài khoản học sinh';
  const primaryIcon = isUpdatePassword ? 'lock_reset' : isReset ? 'mail' : state.authMode === 'login' ? 'login' : 'person_add';
  app.innerHTML = `
    <main class="auth-screen">
      <section class="auth-panel">
        <div class="auth-copy">
          <span class="auth-eyebrow">Hướng tới kì thi THPTQG 2027</span>
          <h1>Canvas</h1>
          <p>If you can get 1 percent better each day for one year, you’ll end up 37 times better by the time you’re done.</p>
        </div>
        <form id="auth-form" class="auth-form">
          ${
            isUpdatePassword || isReset
              ? `
                <div class="auth-form-heading">
                  <p class="eyebrow">Khôi phục tài khoản</p>
                  <h2>${isReset ? 'Đặt lại mật khẩu' : 'Tạo mật khẩu mới'}</h2>
                  <p class="muted">${isReset ? 'Nhập email tài khoản, hệ thống sẽ gửi link đặt lại mật khẩu.' : 'Nhập mật khẩu mới để hoàn tất khôi phục tài khoản.'}</p>
                </div>
              `
              : `
                <div class="segmented" role="tablist" aria-label="Chọn chế độ đăng nhập">
                  <button type="button" role="tab" aria-selected="${state.authMode === 'login'}" aria-pressed="${state.authMode === 'login'}" data-mode="login" class="${state.authMode === 'login' ? 'selected' : ''}">Đăng nhập</button>
                  <button type="button" role="tab" aria-selected="${state.authMode === 'register'}" aria-pressed="${state.authMode === 'register'}" data-mode="register" class="${state.authMode === 'register' ? 'selected' : ''}">Đăng ký</button>
                </div>
              `
          }
          ${!hasSupabaseConfig ? '<div class="notice">Cần cấu hình Supabase trong .env để đăng nhập và lưu dữ liệu.</div>' : ''}
          ${
            state.authMode === 'register'
              ? '<md-outlined-text-field name="full_name" label="Họ tên" autocomplete="name" required></md-outlined-text-field>'
              : ''
          }
          ${
            isUpdatePassword
              ? ''
              : '<md-outlined-text-field name="email" label="Email" type="email" autocomplete="email" required></md-outlined-text-field>'
          }
          ${
            isReset
              ? ''
              : `<md-outlined-text-field name="password" label="${isUpdatePassword ? 'Mật khẩu mới' : 'Mật khẩu'}" type="password" autocomplete="${isUpdatePassword || state.authMode === 'register' ? 'new-password' : 'current-password'}" required></md-outlined-text-field>`
          }
          ${isUpdatePassword ? '<md-outlined-text-field name="confirm_password" label="Nhập lại mật khẩu mới" type="password" autocomplete="new-password" required></md-outlined-text-field>' : ''}
          <md-filled-button type="submit" ${!hasSupabaseConfig ? 'disabled' : ''}>
            <md-icon slot="icon">${primaryIcon}</md-icon>
            ${primaryLabel}
          </md-filled-button>
          <div class="auth-secondary-actions">
            ${
              state.authMode === 'login'
                ? '<button class="text-link" type="button" data-mode="reset">Quên mật khẩu?</button>'
                : ''
            }
            ${
              isReset
                ? '<button class="text-link" type="button" data-mode="login"><md-icon>arrow_back</md-icon>Quay lại đăng nhập</button>'
                : ''
            }
          </div>
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
      const email = form.querySelector('[name="email"]')?.value.trim() ?? '';
      const password = form.querySelector('[name="password"]')?.value;
      if (state.authMode === 'reset') {
        await requestPasswordReset(email);
        state.authMode = 'login';
        toast('Đã gửi email đặt lại mật khẩu. Kiểm tra hộp thư của bạn nhé.', 'success');
        renderAuth();
        return;
      }
      if (state.authMode === 'updatePassword') {
        const confirmPassword = form.querySelector('[name="confirm_password"]').value;
        if (password !== confirmPassword) throw new Error('Hai mật khẩu chưa khớp.');
        await updateCurrentUserPassword(password);
        state.passwordRecovery = false;
        toast('Đã cập nhật mật khẩu. Bạn có thể tiếp tục học.', 'success');
        state.profile = await getCurrentProfile(state.session?.user);
        render();
        return;
      }
      if (state.authMode === 'login') {
        state.session = await signIn(email, password);
        state.profile = await getCurrentProfile(state.session?.user);
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
        state.profile = await getCurrentProfile(state.session.user);
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
    const solutionRequests = latest ? await fetchSolutionRequestsForAttempt(latest.id) : [];
    const fulfilledSolution = fulfilledSolutionRequest(solutionRequests);
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
            ${latest ? `<md-filled-tonal-button id="request-solution-button"><md-icon slot="icon">rate_review</md-icon>Yêu cầu giải chi tiết</md-filled-tonal-button>` : ''}
            ${fulfilledSolution ? `<md-outlined-button id="view-solution-button"><md-icon slot="icon">description</md-icon>Xem lời giải chi tiết</md-outlined-button>` : ''}
            ${latest ? `<md-outlined-button id="review-latest-attempt"><md-icon slot="icon">visibility</md-icon>Xem bài mới nhất</md-outlined-button>` : ''}
          </div>
        </div>
        ${latest ? renderSolutionRequestDialog(solutionRequests) : ''}
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
    wireMaterialFormButtons(root);
    document.querySelector('#start-assignment')?.addEventListener('click', () => mountAssignmentExam(id));
    document.querySelector('#view-solution-button')?.addEventListener('click', () => go(`solution/${fulfilledSolution.id}`));
    document.querySelector('#review-latest-attempt')?.addEventListener('click', () => go(`review/${latest.id}`));
    document.querySelector('#request-solution-button')?.addEventListener('click', () => {
      const dialog = document.querySelector('#solution-request-dialog');
      openSolutionRequestDialog(dialog);
    });
    document.querySelector('#close-solution-request-dialog')?.addEventListener('click', () => {
      closeSolutionRequestDialog(document.querySelector('#solution-request-dialog'));
    });
    document.querySelector('#solution-request-dialog')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeSolutionRequestDialog(event.currentTarget);
    });
    document.querySelector('#solution-request-dialog')?.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeSolutionRequestDialog(event.currentTarget);
    });
    wireSolutionRequestForm('#overview-solution-request-form', {
      assignmentId: assignment.id,
      attemptId: latest?.id,
      onSaved: (request) => {
        prependStudentSolutionHistory(request);
        closeSolutionRequestDialog(document.querySelector('#solution-request-dialog'));
      },
    });
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

function openSolutionRequestDialog(dialog) {
  if (!dialog || dialog.open) return;
  dialog.dataset.closing = 'false';
  dialog.showModal();
  window.requestAnimationFrame(() => {
    dialog.classList.add('open');
    dialog.querySelector('[name="requested_questions"]')?.focus();
  });
}

function closeSolutionRequestDialog(dialog) {
  if (!dialog || !dialog.open || dialog.dataset.closing === 'true') return;
  dialog.dataset.closing = 'true';
  dialog.classList.remove('open');
  dialog.classList.add('closing');
  const surface = dialog.querySelector('.dialog-surface');
  const finish = () => {
    dialog.classList.remove('closing');
    dialog.dataset.closing = 'false';
    dialog.close();
  };
  surface?.addEventListener('animationend', finish, { once: true });
  window.setTimeout(() => {
    if (dialog.open && dialog.dataset.closing === 'true') finish();
  }, 240);
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
    `;
    wireMaterialFormButtons(root);
    wireAnswerAutosave(id);
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

async function mountAssignmentManagerView(id) {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang tải thống kê bài tập');
  try {
    const [{ assignment, submittedStudents, pendingStudents, stats }, solutionRequests] = await Promise.all([
      fetchAssignmentInsights(id),
      fetchAssignmentSolutionRequests(id),
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
        ${renderAssignmentSolutionRequests(solutionRequests)}
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
    wireSolutionRequestManager();
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

function solutionStatusText(request) {
  return request.status === 'fulfilled' && request.solution_pdf_url ? 'Đã có lời giải' : 'Đang chờ lời giải';
}

function fulfilledSolutionRequest(requests) {
  return requests.find((request) => request.status === 'fulfilled' && request.solution_pdf_url);
}

function renderAssignmentSolutionRequests(requests) {
  return `
    <section class="panel solution-requests-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Yêu cầu lời giải</p>
          <h2>${requests.length} yêu cầu</h2>
        </div>
      </div>
      ${
        requests.length
          ? `<div class="solution-request-list">${requests.map(renderManagerSolutionRequest).join('')}</div>`
          : '<div class="empty-state compact">Chưa có học sinh yêu cầu lời giải chi tiết.</div>'
      }
    </section>
  `;
}

function renderManagerSolutionRequest(request) {
  const student = relationOne(request.profiles) ?? {};
  const attempt = relationOne(request.attempts) ?? {};
  const assignment = relationOne(request.assignments) ?? {};
  return `
    <article class="solution-request-card" data-solution-request-status="${escapeHtml(request.status)}">
      <div class="solution-request-main">
        <div>
          <p class="eyebrow">${escapeHtml(solutionStatusText(request))}</p>
          <h3>${escapeHtml(student.full_name || student.email || 'Học sinh')}</h3>
          <p class="muted">
            ${assignment.title ? `${escapeHtml(assignment.title)} · ` : ''}Gửi ${formatDateTime(request.created_at)}${attempt.submitted_at ? ` · Nộp bài ${formatDateTime(attempt.submitted_at)}` : ''}${attempt.score_10 != null ? ` · ${formatScore(attempt.score_10)}/10` : ''}
          </p>
        </div>
        <span class="status">${escapeHtml(request.status === 'fulfilled' ? 'Đã gửi' : 'Đang chờ')}</span>
      </div>
      <dl class="solution-request-details">
        <dt>Câu cần giải</dt>
        <dd>${escapeHtml(request.requested_questions)}</dd>
        ${request.note ? `<dt>Ghi chú</dt><dd>${escapeHtml(request.note)}</dd>` : ''}
      </dl>
      <form class="solution-link-form" data-solution-request-id="${request.id}">
        <input class="field" name="solution_pdf_url" value="${escapeHtml(request.solution_pdf_url ?? '')}" placeholder="Dán link PDF Google Drive lời giải">
        <md-filled-tonal-button type="submit">
          <md-icon slot="icon">upload_file</md-icon>
          Lưu lời giải
        </md-filled-tonal-button>
      </form>
    </article>
  `;
}

function wireSolutionRequestManager({ onSaved } = {}) {
  document.querySelectorAll('.solution-link-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const restore = setButtonLoading(form.querySelector('md-filled-tonal-button'), 'Đang lưu...');
      try {
        const values = Object.fromEntries(new FormData(form).entries());
        const updated = await updateSolutionRequest(form.dataset.solutionRequestId, {
          solutionPdfUrl: values.solution_pdf_url,
        });
        updateSolutionRequestCardState(form, updated);
        await onSaved?.(updated);
        toast('Đã lưu lời giải.', 'success');
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        restore();
      }
    });
  });
}

function updateSolutionRequestCardState(form, request) {
  const card = form.closest('.solution-request-card');
  if (!card) return;
  const statusText = request.status === 'fulfilled' && request.solution_pdf_url ? 'Đã có lời giải' : 'Đang chờ lời giải';
  const statusLabel = request.status === 'fulfilled' ? 'Đã gửi' : 'Đang chờ';
  const eyebrow = card.querySelector('.solution-request-main .eyebrow');
  const status = card.querySelector('.solution-request-main .status');
  if (eyebrow) eyebrow.textContent = statusText;
  if (status) status.textContent = statusLabel;
  card.dataset.solutionRequestStatus = request.status;
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
  document.querySelectorAll('.question-card').forEach((card) => {
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

function wireAnswerAutosave(assignmentId) {
  const form = document.querySelector('#answer-form');
  const autosaveStatus = document.querySelector('#autosave-status');
  const stickyAutosaveStatus = document.querySelector('#sticky-autosave-status');
  let autosaveTimer;
  let draftAnswers = collectAnswers();
  const setAutosaveStatus = (message) => {
    if (autosaveStatus) autosaveStatus.textContent = message;
    if (stickyAutosaveStatus) stickyAutosaveStatus.textContent = message;
  };
  const persist = (event) => {
    const card = event.target?.closest?.('.question-card');
    if (card?.dataset.questionId) {
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
            ${items
              .map(
              (item, index) => `
                <article class="review-item ${item.is_correct ? 'correct' : 'wrong'}">
                  <div>
                    <p class="eyebrow">Câu ${index + 1}</p>
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
    wireMaterialFormButtons(root);
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

async function mountSolution(id) {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang tải lời giải');
  try {
    const request = await fetchSolutionRequest(id);
    const assignment = relationOne(request.assignments) ?? {};
    root.innerHTML = `
      <section class="solution-page">
        <div class="panel solution-page-hero">
          <div>
            <p class="eyebrow">Lời giải chi tiết</p>
            <h2>${escapeHtml(assignment.title ?? 'Lời giải')}</h2>
          </div>
          <div class="insight-actions">
            <md-outlined-button id="back-to-assignment">
              <md-icon slot="icon">arrow_back</md-icon>
              Quay lại bài
            </md-outlined-button>
          </div>
        </div>
        <section class="solution-layout">
          <aside class="panel solution-info-panel">
            <div>
              <p class="eyebrow">Yêu cầu</p>
              <h3>Câu ${escapeHtml(request.requested_questions)}</h3>
            </div>
            <dl class="solution-info-list">
              <dt>Trạng thái</dt>
              <dd>${escapeHtml(solutionStatusText(request))}</dd>
              <dt>Gửi lúc</dt>
              <dd>${formatDateTime(request.created_at)}</dd>
              ${request.fulfilled_at ? `<dt>Phản hồi</dt><dd>${formatDateTime(request.fulfilled_at)}</dd>` : ''}
              ${request.note ? `<dt>Ghi chú</dt><dd>${escapeHtml(request.note)}</dd>` : ''}
            </dl>
          </aside>
          <section class="panel solution-document-panel">
            ${
              request.solution_pdf_url
                ? driveFrame(request.solution_pdf_url, `Lời giải ${assignment.title ?? ''}`, true)
                : '<div class="empty-state compact">Lời giải chưa được tải lên.</div>'
            }
          </section>
        </section>
      </section>
    `;
    document.querySelector('#back-to-assignment')?.addEventListener('click', () => {
      if (request.assignment_id) go(`assignment/${request.assignment_id}`);
      else window.history.back();
    });
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

function renderSolutionRequestDialog(requests) {
  return `
    <dialog id="solution-request-dialog" class="solution-request-dialog">
      <div class="dialog-surface">
        <div class="dialog-heading">
          <div>
            <p class="eyebrow">Lời giải</p>
            <h2>Yêu cầu giải chi tiết</h2>
          </div>
          <button type="button" id="close-solution-request-dialog" aria-label="Đóng"><md-icon>close</md-icon></button>
        </div>
        ${renderSolutionRequestForm('overview-solution-request-form')}
        <div id="solution-request-history-slot">
          ${requests.length ? renderStudentSolutionHistory(requests) : ''}
        </div>
      </div>
    </dialog>
  `;
}

function renderSolutionRequestForm(formId) {
  return `
    <form id="${escapeHtml(formId)}" class="solution-request-form">
      <input class="field" name="requested_questions" placeholder="Ví dụ: 1, 3, 5-8, 12" required>
      <textarea class="field" name="note" placeholder="Ghi chú thêm nếu cần"></textarea>
      <md-filled-button type="submit">
        <md-icon slot="icon">rate_review</md-icon>
        Gửi yêu cầu
      </md-filled-button>
    </form>
  `;
}

function wireSolutionRequestForm(formSelector, { assignmentId, attemptId, onSaved }) {
  document.querySelector(formSelector)?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const restore = setButtonLoading(form.querySelector('md-filled-button'), 'Đang gửi...');
    try {
      const values = Object.fromEntries(new FormData(form).entries());
      const requestedQuestions = String(values.requested_questions ?? '').trim();
      if (!requestedQuestions) {
        throw new Error('Nhập câu cần giải trước nhé.');
      }
      const request = await createSolutionRequest({
        assignmentId,
        attemptId,
        requestedQuestions,
        note: values.note,
      });
      form.reset();
      toast('Đã gửi yêu cầu lời giải.', 'success');
      await onSaved?.(request);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      restore();
    }
  });
}

function renderStudentSolutionHistory(requests) {
  return `
    <div class="solution-request-history">
      ${requests
        .map(
          (request) => `
            <article class="solution-history-row">
              <div>
                <strong>${escapeHtml(request.requested_questions)}</strong>
                <small>${formatDateTime(request.created_at)}</small>
              </div>
              <span class="status">${escapeHtml(solutionStatusText(request))}</span>
            </article>
          `,
        )
        .join('')}
    </div>
  `;
}

function prependStudentSolutionHistory(request) {
  const slot = document.querySelector('#solution-request-history-slot');
  if (!slot) return;
  const current = slot.querySelector('.solution-request-history');
  const row = `
    <article class="solution-history-row">
      <div>
        <strong>${escapeHtml(request.requested_questions)}</strong>
        <small>${formatDateTime(request.created_at)}</small>
      </div>
      <span class="status">${escapeHtml(solutionStatusText(request))}</span>
    </article>
  `;
  if (!current) {
    slot.innerHTML = `<div class="solution-request-history">${row}</div>`;
    return;
  }
  current.insertAdjacentHTML('afterbegin', row);
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

function mountCountdown() {
  const root = pageRoot();
  const days = daysUntilExam();
  const examDate = new Date(2027, 5, 11);
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

function mountSettings() {
  const root = pageRoot();
  const profileName = state.profile?.full_name ?? '';
  root.innerHTML = `
    <section class="settings-page">
      <div class="settings-main-column">
        <div class="panel settings-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Tài khoản</p>
              <h2>Thông tin cá nhân</h2>
            </div>
          </div>
          <div class="avatar-settings">
            ${renderAccountAvatar(state.profile, 'settings-avatar-preview')}
            <div class="avatar-settings-copy">
              <strong>Avatar</strong>
              <p class="muted">Ảnh sẽ được crop vuông và nén nhẹ trước khi lưu.</p>
            </div>
            <input id="avatar-input" type="file" accept="image/png,image/jpeg,image/webp" hidden>
            <div class="avatar-actions">
              <md-outlined-button id="avatar-upload-button" type="button">
                <md-icon slot="icon">photo_camera</md-icon>
                Đổi ảnh
              </md-outlined-button>
              <md-outlined-button id="avatar-remove-button" type="button" ${state.profile?.avatar_url ? '' : 'disabled'}>
                <md-icon slot="icon">person</md-icon>
                Gỡ ảnh
              </md-outlined-button>
            </div>
          </div>
          <form id="profile-name-form" class="settings-form">
            <md-outlined-text-field
              name="full_name"
              label="Tên hiển thị"
              value="${escapeHtml(profileName)}"
              required
            ></md-outlined-text-field>
            <md-filled-button type="submit">
              <md-icon slot="icon">save</md-icon>
              Lưu tên
            </md-filled-button>
          </form>
        </div>
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
          <div class="settings-color-row">
            <div>
              <strong>Màu giao diện</strong>
              <p class="muted">Chọn tông màu chính của web.</p>
            </div>
            <div class="theme-color-options" role="radiogroup" aria-label="Màu giao diện">
              ${colorThemes
                .map(
                  (theme) => `
                    <button
                      class="theme-color-option ${state.colorTheme === theme.id ? 'active' : ''}"
                      type="button"
                      data-color-theme="${escapeHtml(theme.id)}"
                      role="radio"
                      aria-checked="${state.colorTheme === theme.id ? 'true' : 'false'}"
                      aria-label="${escapeHtml(theme.label)}"
                      title="${escapeHtml(theme.label)}"
                    >
                      <span style="--swatch-color: ${escapeHtml(theme.color)}"></span>
                    </button>
                  `,
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="panel settings-panel app-info-panel">
        <div>
          <p class="eyebrow">Canvas</p>
          <div style="display: flex; align-items: center; gap: 12px;">
            <h2 style="margin: 0;">Canvas</h2>
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--md-sys-color-primary); background: var(--md-sys-color-primary-container); padding: 4px 10px; border-radius: 6px;">@nguyenhieu21016</span>
          </div>
        </div>
        <div class="app-info-list">
          <div>
            <span>Phiên bản</span>
            <strong>${escapeHtml(APP_VERSION)}</strong>
          </div>
          <div>
            <span>Cập nhật gần nhất</span>
            <strong>${escapeHtml(APP_LAST_UPDATE)}</strong>
          </div>
        </div>
      </div>
    </section>
  `;

  const avatarInput = document.querySelector('#avatar-input');
  const avatarButton = document.querySelector('#avatar-upload-button');
  const removeAvatarButton = document.querySelector('#avatar-remove-button');
  avatarButton?.addEventListener('click', () => avatarInput?.click());
  avatarInput?.addEventListener('change', async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const restore = setButtonLoading(avatarButton, 'Đang lưu...');

    try {
      const avatarBlob = await resizeAvatarFile(file);
      const updatedProfile = await updateProfileAvatar(state.profile?.id, avatarBlob);
      state.profile = updatedProfile;
      restore();
      toast('Đã cập nhật avatar.', 'success');
      render();
    } catch (error) {
      restore();
      toast(error.message, 'error');
    } finally {
      event.currentTarget.value = '';
    }
  });
  removeAvatarButton?.addEventListener('click', async () => {
    if (!state.profile?.avatar_url) return;
    const restore = setButtonLoading(removeAvatarButton, 'Đang gỡ...');

    try {
      const updatedProfile = await removeProfileAvatar(state.profile?.id);
      state.profile = updatedProfile;
      restore();
      toast('Đã gỡ avatar.', 'success');
      render();
    } catch (error) {
      restore();
      toast(error.message, 'error');
    }
  });

  document.querySelector('#profile-name-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const field = form.elements.full_name;
    const button = form.querySelector('md-filled-button');
    const nextName = field.value.trim();
    const restore = setButtonLoading(button, 'Đang lưu...');

    try {
      const updatedProfile = await updateProfileName(state.profile?.id, nextName);
      state.profile = updatedProfile;
      restore();
      toast('Đã cập nhật tên hiển thị.', 'success');
      render();
    } catch (error) {
      restore();
      toast(error.message, 'error');
    }
  });

  document.querySelector('#settings-dark-mode')?.addEventListener('change', (event) => {
    setThemeMode(event.currentTarget.selected ? 'dark' : 'light');
  });
  document.querySelectorAll('[data-color-theme]').forEach((button) => {
    button.addEventListener('click', () => {
      setColorTheme(button.dataset.colorTheme);
      render();
    });
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
  if (!isManager() && ['dashboard', 'content', 'assignments', 'students', 'solution-requests', 'manage', 'progress', 'salary'].includes(current.name)) {
    go('learn');
    return;
  }

  if (current.name === 'assignment') return mountAssignment(current.id);
  if (current.name === 'phase') return (await import('./student.js')).mountPhaseDetail(current.id);
  if (current.name === 'history') return mountHistory();
  if (current.name === 'countdown') return mountCountdown();
  if (current.name === 'settings') return mountSettings();
  if (current.name === 'review') return mountReview(current.id);
  if (current.name === 'solution') return mountSolution(current.id);
  if (current.name === 'dashboard') return (await import('./student.js')).mountDashboard();
  if (current.name === 'manage') return (await import('./admin.js')).mountManageHub();
  if (current.name === 'progress') return mountProgress();
  if (current.name === 'content') return (await import('./admin.js')).mountContentManager();
  if (current.name === 'assignments') return (await import('./admin.js')).mountAssignmentManager();
  if (current.name === 'solution-requests') return (await import('./admin.js')).mountSolutionRequestsManager();
  if (current.name === 'salary') return (await import('./admin.js')).mountSalaryManager();
  if (current.name === 'students') return (await import('./admin.js')).mountStudents();
  if (current.name === 'online') return (await import('./admin.js')).mountOnlineUsers();
  if (current.name === 'grades') return (await import('./admin.js')).mountGrades();
  return (await import('./student.js')).mountLearn();
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

bootstrap();

// Exported for lazy loaded modules
export { 
  state, pageRoot, renderLoading, renderErrorState, wireRouteRetry, 
  escapeHtml, wireTableSearch, toast, isManager, renderAttemptsTable,
  renderAccountAvatar, renderSkeletonDashboard, renderStateMessage, wireMaterialFormButtons,
  driveFrame, renderManagerSolutionRequest, renderMetric, wireSolutionRequestManager,
  isAdmin, renderSkeletonAssignments, renderScoreProgress
};
