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
} from './services/lmsApi.js';
import { clearDraft, loadDraft, saveDraft } from './lib/draft.js';
import { toDrivePreviewUrl } from './lib/drive.js';
import { formatDateTime, formatScore, roleLabel } from './lib/format.js';
import { escapeHtml, option, setButtonLoading } from './lib/html.js';

const app = document.querySelector('#app');
const toastEl = document.querySelector('#toast');
const MAX_AVATAR_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_UPLOAD_BYTES = 250 * 1024;
const AVATAR_SIZE = 320;
const APP_VERSION = '1.1.9';
const APP_LAST_UPDATE = 'Tối ưu hóa hiệu năng tải trang web: chia gói (code splitting) các thư viện bên thứ ba và tải fonts không đồng bộ.';
let renderGeneration = 0;
let appElementsPromise = null;
const detachedPageRoot = {
  isConnected: false,
  set innerHTML(_value) {},
  get innerHTML() {
    return '';
  },
};

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
    : ['content', 'assignments', 'students', 'solution-requests', 'manage'].includes(current)
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
      learn: 'Lộ trình ôn thi 2027',
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
    }[name] ?? 'Lộ trình ôn thi 2027'
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

async function mountLearn() {
  const root = pageRoot();
  root.innerHTML = renderLoading();
  try {
    const data = await fetchLearningPath(state.profile.role);
    root.innerHTML = `
      <section class="learn-layout">
        <div class="phase-card-grid">
          ${
            data.phases.length
              ? data.phases.map(renderPhaseCard).join('')
              : renderStateMessage({
                  title: 'Chưa có lộ trình học',
                  message: isManager() ? 'Tạo giai đoạn đầu tiên để học sinh nhìn thấy kế hoạch học.' : 'Giáo viên chưa mở nội dung cho lớp này.',
                  actionHref: isManager() ? '#/content' : '',
                  actionLabel: isManager() ? 'Tạo lộ trình' : '',
                  actionIcon: 'add',
                })
          }
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
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
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
    wireAnimatedDetails(root);
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

function wireAnimatedDetails(root) {
  root.querySelectorAll('.lecture-group-block, .lecture-row').forEach((details) => {
    const summary = details.querySelector('summary');
    summary?.addEventListener('click', (event) => {
      if (!details.open) {
        details.classList.remove('opening');
        window.requestAnimationFrame(() => details.classList.add('opening'));
        return;
      }
      if (details.dataset.closing === 'true') return;
      event.preventDefault();
      details.dataset.closing = 'true';
      details.classList.remove('opening');
      details.classList.add('closing');
      window.setTimeout(() => {
        details.open = false;
        details.classList.remove('closing');
        delete details.dataset.closing;
      }, 150);
    });
  });
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
        <div class="lecture-actions">
          ${driveFrame(lecture.slide_url, lecture.title)}
          ${
            lecture.assignments.length
              ? `<div class="assignment-action-list">${lecture.assignments.map(renderAssignmentChip).join('')}</div>`
              : ''
          }
        </div>
      </div>
    </details>
  `;
}

function renderAssignmentChip(assignment) {
  const progress = assignment.progress;
  const hasSubmitted = progress?.status === 'submitted';
  return `
    <div class="assignment-action ${hasSubmitted ? 'completed' : 'pending'}">
      <a class="assignment-chip" href="#/assignment/${assignment.id}">
        <md-icon>quiz</md-icon>
        <span>${escapeHtml(assignment.title)}</span>
      </a>
      <span class="assignment-chip-progress">
        <span>${hasSubmitted ? `Cao nhất: ${formatScore(progress.bestScore)}/10` : 'Chưa làm'}</span>
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

async function mountDashboard() {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang tải dữ liệu theo dõi học sinh');
  try {
    const [students, allAttempts] = await Promise.all([
      fetchStudents(),
      fetchGradebook(),
    ]);

    const studentsMarkup = students.map((student) => {
      const studentAttempts = allAttempts.filter((a) => a.student_id === student.id);
      const totalSubmissions = studentAttempts.length;
      const scores = studentAttempts.map((a) => Number(a.score_10 ?? 0));
      const averageScore = totalSubmissions ? (scores.reduce((sum, score) => sum + score, 0) / totalSubmissions) : 0;
      const bestScore = totalSubmissions ? Math.max(...scores) : 0;

      const attemptsListMarkup = studentAttempts.map((a) => `
        <div class="attempt-item-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--md-sys-color-outline-variant); font-size: 0.9rem;">
          <span style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%;">${escapeHtml(a.assignments?.title ?? '-')}</span>
          <div style="display: flex; align-items: center; gap: 12px;">
            <strong style="color: var(--md-sys-color-primary);">${formatScore(a.score_10)}/10</strong>
            <a class="text-link" href="#/review/${a.id}" style="font-size: 0.85rem; font-weight: 600;">Chi tiết</a>
          </div>
        </div>
      `).join('');

      return `
        <article class="student-detail-card panel" data-student-id="${student.id}" style="margin: 0; display: flex; flex-direction: column; gap: 18px; padding: 24px; border-radius: 16px; background: var(--md-sys-color-surface-container-low); min-height: 580px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            ${renderAccountAvatar(student, 'account-avatar large')}
            <div style="flex: 1; min-width: 0;">
              <h3 style="margin: 0; font-size: 1.25rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(student.full_name ?? '')}</h3>
              <p style="margin: 2px 0 0 0; font-size: 0.85rem; color: var(--md-sys-color-on-surface-variant); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(student.email ?? '')}</p>
            </div>
            <select class="field compact" name="status" style="width: auto; height: 36px; min-height: 36px; padding: 4px 32px 4px 12px; font-size: 0.85rem;" data-status-student="${student.id}">
              ${option('active', 'Đang học', student.status)}
              ${option('disabled', 'Tạm khóa', student.status)}
            </select>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: var(--md-sys-color-surface-container-high); padding: 12px; border-radius: 12px; text-align: center;">
            <div>
              <span style="font-size: 0.8rem; font-weight: 500; color: var(--md-sys-color-on-surface-variant);">Đã nộp</span>
              <div style="font-size: 1.15rem; font-weight: 700; margin-top: 4px;">${totalSubmissions} bài</div>
            </div>
            <div>
              <span style="font-size: 0.8rem; font-weight: 500; color: var(--md-sys-color-on-surface-variant);">Điểm TB</span>
              <div style="font-size: 1.15rem; font-weight: 700; margin-top: 4px; color: var(--md-sys-color-primary);">${formatScore(averageScore)}</div>
            </div>
            <div>
              <span style="font-size: 0.8rem; font-weight: 500; color: var(--md-sys-color-on-surface-variant);">Cao nhất</span>
              <div style="font-size: 1.15rem; font-weight: 700; margin-top: 4px; color: var(--md-sys-color-tertiary);">${formatScore(bestScore)}</div>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; flex: 1;">
            <h4 style="margin: 0 0 8px 0; font-size: 0.95rem; font-weight: 600; display: flex; justify-content: space-between; align-items: center; color: var(--md-sys-color-on-surface);">
              <span>Bài làm gần đây</span>
              ${totalSubmissions > 0 ? `<span style="font-size: 0.8rem; font-weight: 500; color: var(--md-sys-color-outline);">Tất cả (${totalSubmissions})</span>` : ''}
            </h4>
            <div class="attempts-list-container" style="height: 180px; overflow-y: auto; padding-right: 4px; border: 1px dashed var(--md-sys-color-outline-variant); border-radius: 8px; padding: 4px 12px; background: var(--md-sys-color-surface-container-lowest);">
              ${attemptsListMarkup || '<div class="empty-state compact" style="padding: 16px 0; border: 0; background: transparent; text-align: center;">Chưa nộp bài nào.</div>'}
            </div>
          </div>

          <div style="border-top: 1px dashed var(--md-sys-color-outline-variant); padding-top: 16px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <md-outlined-text-field label="Họ tên mới" value="${escapeHtml(student.full_name ?? '')}" style="flex: 1; --md-outlined-text-field-container-shape: 8px;" data-name-input="${student.id}"></md-outlined-text-field>
              <md-filled-tonal-button style="--md-filled-tonal-button-container-shape: 8px; height: 56px;" data-save-btn="${student.id}">
                Lưu
              </md-filled-tonal-button>
            </div>
            <div style="display: flex; gap: 12px;">
              <md-filled-tonal-button style="flex: 1; --md-filled-tonal-button-container-shape: 8px;" data-reset-btn="${student.id}">
                <md-icon slot="icon">lock_reset</md-icon> Đặt lại mật khẩu
              </md-filled-tonal-button>
              <md-filled-button style="flex: 1; --md-filled-button-container-shape: 8px; --md-filled-button-container-color: var(--md-sys-color-error); --md-filled-button-label-text-color: var(--md-sys-color-on-error);" data-delete-btn="${student.id}">
                <md-icon slot="icon">delete</md-icon> Xóa tài khoản
              </md-filled-button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    root.innerHTML = `
      <section class="student-tracker-layout" style="display: flex; flex-direction: column; gap: 24px;">
        <section class="panel" style="padding: 24px; border-radius: 16px;">
          <div class="panel-heading" style="margin-bottom: 16px;">
            <h2 style="margin: 0; font-size: 1.25rem; font-weight: 600; display: flex; align-items: center; gap: 8px; color: var(--md-sys-color-on-surface);"><md-icon>person_add</md-icon>Thêm học sinh mới</h2>
          </div>
          <form id="create-user-form" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)) auto; gap: 16px; align-items: center;">
            <md-outlined-text-field label="Họ tên học sinh" name="full_name" required></md-outlined-text-field>
            <md-outlined-text-field label="Email đăng nhập" name="email" type="email" required></md-outlined-text-field>
            <md-outlined-text-field label="Mật khẩu tạm" name="password" required></md-outlined-text-field>
            <md-filled-button type="submit" style="height: 56px;"><md-icon slot="icon">person_add</md-icon>Tạo tài khoản</md-filled-button>
          </form>
        </section>

        <section style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 24px;">
          ${studentsMarkup || '<div class="panel" style="grid-column: 1/-1; padding: 40px; text-align: center;"><div class="empty-state">Chưa có học sinh nào. Thêm học sinh phía trên để bắt đầu theo dõi.</div></div>'}
        </section>
      </section>
    `;

    wireDashboardManager(students);
    wireMaterialFormButtons(root);
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

function wireDashboardManager(students) {
  // Add new student
  document.querySelector('#create-user-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const restore = setButtonLoading(form.querySelector('md-filled-button'));
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      await createManagedUser({
        ...values,
        role: 'student',
      });
      toast('Đã tạo tài khoản học sinh.', 'success');
      await mountDashboard();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      restore();
    }
  });

  // Action listeners for each student
  students.forEach((student) => {
    const card = document.querySelector(`.student-detail-card[data-student-id="${student.id}"]`);
    if (!card) return;

    // Save Name
    card.querySelector('[data-save-btn]')?.addEventListener('click', async () => {
      const nameInput = card.querySelector('[data-name-input]');
      const statusSelect = card.querySelector('[data-status-student]');
      try {
        await invokeAdminFunction('admin-update-user', {
          id: student.id,
          full_name: nameInput.value,
          status: statusSelect.value,
          role: 'student',
        });
        toast('Đã cập nhật thông tin học sinh.', 'success');
        await mountDashboard();
      } catch (error) {
        toast(error.message, 'error');
      }
    });

    // Auto-update on status change
    card.querySelector('[data-status-student]')?.addEventListener('change', async (event) => {
      const nameInput = card.querySelector('[data-name-input]');
      try {
        await invokeAdminFunction('admin-update-user', {
          id: student.id,
          full_name: nameInput.value,
          status: event.target.value,
          role: 'student',
        });
        toast('Đã cập nhật trạng thái học sinh.', 'success');
      } catch (error) {
        toast(error.message, 'error');
      }
    });

    // Reset Password
    card.querySelector('[data-reset-btn]')?.addEventListener('click', async () => {
      const password = window.prompt('Mật khẩu tạm mới, bỏ trống để hệ thống tự tạo:') || undefined;
      try {
        const result = await invokeAdminFunction('admin-reset-password', {
          id: student.id,
          password,
        });
        toast(`Mật khẩu tạm mới: ${result.temporaryPassword}`, 'success');
      } catch (error) {
        toast(error.message, 'error');
      }
    });

    // Delete student
    card.querySelector('[data-delete-btn]')?.addEventListener('click', async () => {
      if (!window.confirm(`Xóa tài khoản học sinh "${student.full_name || student.email}"? Hành động này không thể hoàn tác.`)) return;
      try {
        await deleteManagedUser(student.id);
        toast('Đã xóa học sinh.', 'success');
        await mountDashboard();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
}

function mountManageHub() {
  const root = pageRoot();
  const items = [
    { href: '#/content', icon: 'view_list', title: 'Nội dung', description: 'Tạo giai đoạn, chuyên đề, nhóm bài giảng và link bài giảng.' },
    { href: '#/assignments', icon: 'assignment', title: 'Đề thi / BTVN', description: 'Tạo đề, phiếu trả lời, đáp án và chấm lại bài đã nộp.' },
    { href: '#/solution-requests', icon: 'rate_review', title: 'Yêu cầu lời giải', description: 'Xem yêu cầu chưa xử lí và các yêu cầu đã gửi lời giải.' },
  ];
  root.innerHTML = `
    <section class="manage-hub">
      ${items
        .map(
          (item) => `
            <a class="phase-card manage-hub-card" href="${item.href}">
              <div>
                <p class="eyebrow">Quản trị</p>
                <h2><md-icon>${item.icon}</md-icon>${escapeHtml(item.title)}</h2>
                <p class="muted">${escapeHtml(item.description)}</p>
              </div>
              <span class="phase-card-action">Mở<md-icon>arrow_forward</md-icon></span>
            </a>
          `,
        )
        .join('')}
    </section>
  `;
}

async function mountSolutionRequestsManager() {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang tải yêu cầu lời giải');
  try {
    const requests = await fetchSolutionRequestsForManager();
    const pendingRequests = requests.filter((request) => request.status !== 'fulfilled' || !request.solution_pdf_url);
    const fulfilledRequests = requests.filter((request) => request.status === 'fulfilled' && request.solution_pdf_url);
    root.innerHTML = `
      <section class="solution-requests-page">
        <section class="metric-grid">
          ${renderMetric('Chưa xử lí', pendingRequests.length, 'pending_actions')}
          ${renderMetric('Đã xử lí', fulfilledRequests.length, 'task_alt')}
          ${renderMetric('Tổng yêu cầu', requests.length, 'rate_review')}
        </section>
        <section class="solution-requests-board">
          <div class="panel solution-requests-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Cần phản hồi</p>
                <h2>${pendingRequests.length} yêu cầu chưa xử lí</h2>
              </div>
            </div>
            ${
              pendingRequests.length
                ? `<div class="solution-request-list">${pendingRequests.map(renderManagerSolutionRequest).join('')}</div>`
                : '<div class="empty-state compact">Không còn yêu cầu nào đang chờ.</div>'
            }
          </div>
          <div class="panel solution-requests-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Đã phản hồi</p>
                <h2>${fulfilledRequests.length} yêu cầu đã xử lí</h2>
              </div>
            </div>
            ${
              fulfilledRequests.length
                ? `<div class="solution-request-list">${fulfilledRequests.map(renderManagerSolutionRequest).join('')}</div>`
                : '<div class="empty-state compact">Chưa có yêu cầu nào được xử lí.</div>'
            }
          </div>
        </section>
      </section>
    `;
    wireSolutionRequestManager({
      onSaved: () => mountSolutionRequestsManager(),
    });
    wireMaterialFormButtons(root);
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
    wireContentForms(data);
    wireMaterialFormButtons(root);
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
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
                ${(group.lectures ?? []).map((lecture) => renderManageLecture(lecture, group.id, 'Trong nhóm')).join('')}
              `,
            )
            .join('')}
          ${module.lectures
            .filter((lecture) => !lecture.group_id)
            .map((lecture) => renderManageLecture(lecture, `module:${module.id}`, 'Chưa nhóm'))
            .join('')}
        `,
      )
      .join('')}
  `;
}

function renderManageLecture(lecture, parent, statusText) {
  return `
    <div class="manage-node greatgrandchild" draggable="true" data-entity="lecture" data-parent="${escapeHtml(parent)}" data-id="${lecture.id}" data-payload="${escapeHtml(JSON.stringify(lecture))}">
      <div>
        <md-icon class="drag-handle" aria-hidden="true">drag_indicator</md-icon>
        <strong>${escapeHtml(lecture.title)}</strong>
        <span>${escapeHtml(statusText)}</span>
      </div>
      <div class="icon-actions">
        <button data-edit-lecture="${lecture.id}" data-payload="${escapeHtml(JSON.stringify(lecture))}" aria-label="Sửa bài giảng"><md-icon>edit</md-icon></button>
        <button data-delete-lecture="${lecture.id}" aria-label="Xóa bài giảng"><md-icon>delete</md-icon></button>
      </div>
    </div>
  `;
}

function wireContentForms(pathData) {
  document.querySelectorAll('.entity-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (form.dataset.saving === 'true') return;
      const values = Object.fromEntries(new FormData(form).entries());
      const sortOrder = values.id
        ? Number(values.sort_order || 0)
        : nextContentSortOrder(form.dataset.entity, values, pathData);
      const payload = {
        ...values,
        id: values.id || undefined,
        sort_order: sortOrder,
        published: form.querySelector('[name="published"]')?.type === 'checkbox'
          ? form.querySelector('[name="published"]').checked
          : values.published !== 'false',
        owner_id: state.profile.id,
      };
      const restore = setButtonLoading(form.querySelector('md-filled-button'));
      form.dataset.saving = 'true';
      try {
        if (form.dataset.entity === 'phase') await upsertPhase(payload);
        if (form.dataset.entity === 'module') await upsertModule(payload);
        if (form.dataset.entity === 'lectureGroup') await upsertLectureGroup(payload);
        if (form.dataset.entity === 'lecture') await upsertLecture({ ...payload, group_id: payload.group_id || null });
        toast('Đã lưu nội dung.', 'success');
        restore();
        await mountContentManager();
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        delete form.dataset.saving;
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

function nextContentSortOrder(kind, values, pathData) {
  const byParent = {
    phase: pathData.phases ?? [],
    module: (pathData.modules ?? []).filter((item) => item.phase_id === values.phase_id),
    lectureGroup: (pathData.lectureGroups ?? []).filter((item) => item.module_id === values.module_id),
    lecture: (pathData.lectures ?? []).filter((item) => {
      if (values.group_id) return item.group_id === values.group_id;
      return item.module_id === values.module_id && !item.group_id;
    }),
  }[kind] ?? [];

  const maxSortOrder = byParent.reduce((max, item) => Math.max(max, Number(item.sort_order ?? 0)), 0);
  return maxSortOrder + 10;
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

  const ordered = nodes.map((node) => node.dataset.id);
  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);
  await reorderContentNodesApi(kind, ordered);
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
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

function normalizeEditorQuestion(raw) {
  const key = Array.isArray(raw.answer_keys)
    ? raw.answer_keys[0]
    : raw.answer_keys ?? raw.answer_key;
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

function normalizeAssignmentEditor(editor) {
  return {
    assignment: editor.assignment,
    questions: editor.questions.map(normalizeEditorQuestion),
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
        <div class="qb-title-block">
          <p class="eyebrow">Phiếu trả lời</p>
          <h3 class="qb-count">${questions.length} câu hỏi</h3>
        </div>
        <div class="qb-toolbar">
          <div class="qb-single-add">
            <span class="qb-toolbar-label">Thêm 1 câu</span>
            <div class="button-row">
              <md-outlined-button type="button" data-add-question="mcq"><md-icon slot="icon">radio_button_checked</md-icon>Trắc nghiệm</md-outlined-button>
              <md-outlined-button type="button" data-add-question="tf4"><md-icon slot="icon">fact_check</md-icon>Đúng/Sai</md-outlined-button>
              <md-outlined-button type="button" data-add-question="short"><md-icon slot="icon">short_text</md-icon>Điền ngắn</md-outlined-button>
            </div>
          </div>
          <div class="qb-bulk-add">
            <span class="qb-toolbar-label">Thêm hàng loạt</span>
            <div class="qb-bulk-row">
              <input class="field compact-number" name="bulk-question-count" type="number" min="1" max="100" value="20" aria-label="Số câu">
              <select class="field" name="bulk-question-type" aria-label="Loại câu">
                <option value="mcq">Trắc nghiệm</option>
                <option value="tf4">Đúng/Sai</option>
                <option value="short">Điền ngắn</option>
              </select>
              <md-filled-tonal-button type="button" id="bulk-add-btn"><md-icon slot="icon">playlist_add</md-icon>Thêm</md-filled-tonal-button>
            </div>
          </div>
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
      <div class="form-grid two">
        <select class="field" name="question-type-${index}">
          ${['mcq', 'tf4', 'short'].map((type) => option(type, type.toUpperCase(), question.type)).join('')}
        </select>
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

function refreshQuestionBuilder(lectures) {
  const questions = state.assignmentEditor.questions;
  const heading = document.querySelector('.question-builder-header .qb-count');
  const builder = document.querySelector('.question-builder');
  if (heading) heading.textContent = `${questions.length} câu`;
  if (builder) {
    builder.innerHTML = questions.length
      ? questions.map((question, index) => renderQuestionEditor(question, index)).join('')
      : '<div class="empty-state compact">Chưa có câu nào trong phiếu trả lời.</div>';
  }
  wireQuestionEditorControls(lectures);
}

function wireQuestionEditorControls(lectures) {
  document.querySelectorAll('[data-remove-question]').forEach((button) => {
    if (button.dataset.questionBridge === 'true') return;
    button.dataset.questionBridge = 'true';
    button.addEventListener('click', () => {
      state.assignmentEditor = collectEditor(lectures);
      state.assignmentEditor.questions.splice(Number(button.dataset.removeQuestion), 1);
      refreshQuestionBuilder(lectures);
    });
  });
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
        state.assignmentEditor = normalizeAssignmentEditor(editor);
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
      refreshQuestionBuilder(lectures);
    });
  });

  document.querySelector('#bulk-add-btn')?.addEventListener('click', () => {
    state.assignmentEditor = collectEditor(lectures);
    const countInput = document.querySelector('input[name="bulk-question-count"]');
    const typeSelect = document.querySelector('select[name="bulk-question-type"]');
    const count = Math.min(100, Math.max(1, Number(countInput?.value || 20)));
    const type = typeSelect?.value || 'mcq';
    const questions = Array.from({ length: count }, () => defaultQuestion(type));
    state.assignmentEditor.questions.push(...questions);
    refreshQuestionBuilder(lectures);
  });

  wireQuestionEditorControls(lectures);

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
      const savedAssignment = await saveAssignmentWithQuestions(
        {
          ...editor.assignment,
          id: editor.assignment.id || undefined,
          lecture_id: editor.assignment.lecture_id || null,
          owner_id: state.profile.id,
        },
        editor.questions,
      );
      const regradedCount = await regradeAssignment(savedAssignment.id);
      const savedEditor = await fetchAssignmentEditor(savedAssignment.id);
      state.assignmentEditor = normalizeAssignmentEditor(savedEditor);
      toast(regradedCount > 0 ? `Đã lưu đề và chấm lại ${regradedCount} bài đã nộp.` : 'Đã lưu đề thi.', 'success');
      await mountAssignmentManager();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      restore();
    }
  });

  const editorForm = document.querySelector('#assignment-editor');
  editorForm?.addEventListener('input', () => {
    state.assignmentEditor = collectEditor(lectures);
  });
  editorForm?.addEventListener('change', async (event) => {
    state.assignmentEditor = collectEditor(lectures);
    if (event.target?.matches('select[name^="question-type-"]')) {
      refreshQuestionBuilder(lectures);
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
      points: 1,
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
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
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
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
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
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
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
          <h2>Canvas</h2>
        </div>
        <div class="app-info-list">
          <div>
            <span>Phiên bản</span>
            <strong>Phiên bản thứ ${escapeHtml(APP_VERSION)}</strong>
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
  if (!isManager() && ['dashboard', 'content', 'assignments', 'students', 'solution-requests', 'manage'].includes(current.name)) {
    go('learn');
    return;
  }

  if (current.name === 'assignment') return mountAssignment(current.id);
  if (current.name === 'phase') return mountPhaseDetail(current.id);
  if (current.name === 'history') return mountHistory();
  if (current.name === 'countdown') return mountCountdown();
  if (current.name === 'settings') return mountSettings();
  if (current.name === 'review') return mountReview(current.id);
  if (current.name === 'solution') return mountSolution(current.id);
  if (current.name === 'dashboard') return mountDashboard();
  if (current.name === 'manage') return mountManageHub();
  if (current.name === 'content') return mountContentManager();
  if (current.name === 'assignments') return mountAssignmentManager();
  if (current.name === 'solution-requests') return mountSolutionRequestsManager();
  if (current.name === 'students') return mountStudents();
  if (current.name === 'grades') return mountGrades();
  return mountLearn();
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
    if (state.session) state.profile = await getCurrentProfile(state.session.user);
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
      state.profile = session ? await getCurrentProfile(session.user) : null;
    } catch (error) {
      toast(error.message, 'error');
    }
    render();
  });

  window.addEventListener('hashchange', renderRouteTransition);
  render();
}

bootstrap();
