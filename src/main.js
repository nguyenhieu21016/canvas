import { renderLoading, renderErrorState, wireTableSearch, toast, renderAccountAvatar, renderSkeletonDashboard, renderStateMessage, renderMetric, renderSkeletonAssignments, renderScoreProgress } from './lib/ui.js';
import { initSessionTracker } from './lib/sessionTracker.js';
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
  getOnlineUsers,
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
import { formatDateTime, formatScore, roleLabel, formatAnswer } from './lib/format.js';
import { escapeHtml, option, setButtonLoading, renderLatexText } from './lib/html.js';
import { normalizeAssignmentEditor } from './lib/assignment.js';

const app = document.querySelector('#app');
const toastEl = document.querySelector('#toast');
const MAX_AVATAR_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_UPLOAD_BYTES = 250 * 1024;
const AVATAR_SIZE = 320;
const APP_VERSION = '1.4.1';
const APP_LAST_UPDATE = 'Sửa lỗi hiển thị hình ảnh và định dạng Markdown trong đề thi của học sinh. Cập nhật hệ thống render đồng bộ với giáo viên.';
let renderGeneration = 0;
let assignmentsForManagerList = [];
let appElementsPromise = null;

// (Removed temp fix)

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.color = state.colorTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    colorThemes.find((theme) => theme.id === state.colorTheme)?.color ?? '#d3e4ff',
  );
}

function setThemeMode(_mode) {
  // Dark mode removed – always light
}

function setColorTheme(colorTheme) {
  if (!colorThemes.some((theme) => theme.id === colorTheme)) return;
  state.colorTheme = colorTheme;
  localStorage.setItem('lms:colorTheme', state.colorTheme);
  applyTheme();
}

applyTheme();

function ensureAppElements() {
  return Promise.resolve();
}





function accountInitial(profile) {
  const name = (profile?.full_name || profile?.email || 'U').trim();
  const lastWord = name.split(/\s+/).filter(Boolean).at(-1) || name;
  return lastWord.charAt(0).toUpperCase();
}



function daysUntilExam() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const examDate = new Date(2027, 5, 11);
  return Math.max(0, Math.ceil((examDate - start) / 86_400_000));
}

function pageRoot() { return storePageRoot(); }











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
  const initial = accountInitial(state.profile);
  const fullName = escapeHtml(state.profile.full_name || state.profile.email.split('@')[0]);
  const userEmail = escapeHtml(state.profile.email);

  app.innerHTML = `
    <div class="app-shell">
      <header class="nh-header">
        <div class="nh-header-left">
          <a href="#/learn" class="nh-logo-box">
            <span class="nh-logo-title">CANVAS</span>
            <span class="nh-logo-sub">Hướng tới kỳ thi THPTQG 2027</span>
          </a>
          <div class="nh-search-box">
            <md-icon style="font-size: 18px; color: #667085;">search</md-icon>
            <input type="text" class="nh-search-input" placeholder="Tìm kiếm nội dung..." id="nh-global-search" />
          </div>
        </div>

        <div class="nh-header-right">
          <div class="nh-user-avatar" id="nh-avatar-trigger" title="Hồ sơ cá nhân">
            ${initial}
          </div>

          <!-- User Dropdown -->
          <div class="nh-user-dropdown" id="nh-user-dropdown">
            <div class="nh-dropdown-header">
              <div class="nh-dropdown-avatar">${initial}</div>
              <div class="nh-dropdown-info">
                <span class="nh-dropdown-name">${fullName}</span>
                <span class="nh-dropdown-email">${userEmail}</span>
              </div>
            </div>
            <div class="nh-dropdown-menu">
              ${isManager() ? `
                <a href="#/manage" class="nh-dropdown-item" style="color: var(--md-sys-color-primary); font-weight: 600;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                  Trang Quản lý
                </a>
                <div style="height: 1px; background: #f0f2f5; margin: 2px 0;"></div>
              ` : ''}
              <a href="#/settings" class="nh-dropdown-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                Trang cá nhân
              </a>
              <a href="#/learn" class="nh-dropdown-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                Khoá học của tôi
              </a>
              <div style="height: 1px; background: #f0f2f5; margin: 2px 0;"></div>
              <button id="nh-logout-btn" class="nh-dropdown-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </header>

      <main id="page-root" class="page-root-nh">${renderLoading()}</main>
    </div>
  `;

  // Global Search Box Listener
  const searchInput = document.querySelector('#nh-global-search');
  searchInput?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.nh-course-card, .assignment-chip').forEach(card => {
      const text = card.textContent.toLowerCase();
      if (!q || text.includes(q)) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  });

  // Toggle user dropdown menu
  const avatarTrigger = document.querySelector('#nh-avatar-trigger');
  const dropdown = document.querySelector('#nh-user-dropdown');
  avatarTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown?.classList.toggle('show');
  });

  document.addEventListener('click', (e) => {
    if (!dropdown?.contains(e.target) && e.target !== avatarTrigger) {
      dropdown?.classList.remove('show');
    }
  });

  // Logout handler
  document.querySelector('#nh-logout-btn')?.addEventListener('click', () => {
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
  if (!url) return '';
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
      <a class="nh-lecture-slide-btn" href="${escapeHtml(url)}" target="_blank" rel="noreferrer noopener">
        <md-icon style="font-size: 18px; color: #455120;">open_in_new</md-icon>
        <span>Mở bài giảng</span>
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
    const isPdfAssignment = assignment.pdf_url && assignment.pdf_url !== 'latex';
    const isStudent = state.profile.role === 'student';
    const isLockedPdfForStudent = isStudent && isPdfAssignment;
    const latestScore10 = latest ? (latest.score_10 ?? 0) : 0;
    const draft = loadDraft(localStorage, state.profile.id, id);
    const hasDraftInProgress = draft && draft.answers && Object.values(draft.answers).some(Boolean);

    root.innerHTML = `
      <div>
        <!-- Tràn viền Breadcrumb Bar chuẩn ngochuyenlb (Nền mạ nhạt tràn lề) -->
        <div style="background: #DCE8CC; padding: 10px max(var(--page-gutter), 24px); border-bottom: 1px solid #D1DFC0;">
          <div style="max-width: 1040px; margin: 0 auto; font-family: 'Be Vietnam Pro', sans-serif; font-size: 13px; color: #455120; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <a href="#/learn" style="color: #455120; text-decoration: none; font-weight: 500; opacity: 0.9; transition: color 0.15s ease;">Danh mục khóa học</a>
            <span style="opacity: 0.6; font-size: 13px;">&rsaquo;</span>
            <a href="javascript:history.back()" style="color: #455120; text-decoration: none; font-weight: 500; opacity: 0.9; transition: color 0.15s ease;">Giai đoạn</a>
            <span style="opacity: 0.6; font-size: 13px;">&rsaquo;</span>
            <span style="color: #455120; font-weight: 700;">${escapeHtml((assignment.title || '').replace(/Bài tập về nhà/gi, 'Bài tập'))}</span>
          </div>
        </div>

        <div style="background: #EDF2E4; min-height: calc(100vh - 108px); padding: 24px max(var(--page-gutter), 24px);">
          <div style="max-width: 1040px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px;">

            <!-- Page Main Title -->
            <h1 style="font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 26px; font-weight: 700; color: #101828; margin: 0; line-height: 1.25;">
              ${escapeHtml((assignment.title || '').replace(/Bài tập về nhà/gi, 'Bài tập'))}
            </h1>

          <!-- Stats Block Layout — 1 card trắng duy nhất -->
          <div style="background: #ffffff; border-radius: 16px; border: 1px solid #D8E2C4; padding: 32px 36px; display: flex; align-items: center; gap: 48px; box-shadow: 0 2px 8px rgba(69, 81, 32, 0.04);">

            <!-- Score Circle -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; flex-shrink: 0;">
              <div style="position: relative; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center;">
                <svg viewBox="0 0 36 36" style="position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg);">
                  <path stroke="#EDF2E4" stroke-width="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path stroke="#455120" stroke-width="3" stroke-dasharray="${latestScore10 * 10}, 100" stroke-linecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1;">
                  <span style="font-family: 'Beautique Display', serif; font-size: 13px; font-weight: 700; color: #667085; margin-bottom: 2px;">Điểm của em</span>
                  <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 44px; font-weight: 800; color: #455120; line-height: 1;">${latest ? formatScore(latestScore10) : '—'}</span>
                </div>
              </div>
            </div>

            <!-- Vertical Divider -->
            <div style="width: 1px; height: 80px; background: #E5ECD9; flex-shrink: 0;"></div>

            <!-- Stats Right -->
            <div style="display: flex; gap: 48px; flex: 1;">

              <!-- Số câu hỏi -->
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <span style="font-family: 'Beautique Display', serif; font-size: 15px; font-weight: 700; color: #475467;">Số câu hỏi</span>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #455120; opacity: 0.85;"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 18px; font-weight: 600; color: #101828; line-height: 1; display: inline-block; transform: translateY(1px);">${assignment.question_count ?? 0}</span>
                </div>
              </div>

              <!-- Thời gian làm bài -->
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <span style="font-family: 'Beautique Display', serif; font-size: 15px; font-weight: 700; color: #475467;">Thời gian làm bài</span>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #455120; opacity: 0.85;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 17px; font-weight: 600; color: #101828; line-height: 1; display: inline-block; transform: translateY(1px);">${assignment.time_limit ? `${assignment.time_limit}<span style="font-size: 14px; font-weight: 500; margin-left: 4px; color: #475467;">phút</span>` : 'Không giới hạn'}</span>
                </div>
              </div>

            </div>
          </div>

          <!-- Action Button Center -->
          <div style="display: flex; justify-content: center; gap: 12px; margin: 8px 0;">
            ${isLockedPdfForStudent ? `
              <div style="padding: 12px 24px; background: #FEF3F2; color: #B42318; border: 1px solid #FECDCA; border-radius: 9999px; font-size: 14px; font-weight: 700; display: inline-flex; align-items: center; gap: 8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                Hiện tại toàn bộ bài tập dùng link PDF đã đóng truy cập
              </div>
            ` : `
              <button id="start-assignment" style="background: #455120; color: #ffffff; border: none; padding: 12px 42px; border-radius: 6px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: transform 0.1s ease, background-color 0.2s ease;">
                ${hasDraftInProgress ? 'Làm tiếp' : 'Bắt đầu làm bài'}
              </button>
            `}
          </div>

          <!-- History Panel -->
          <div style="background: #ffffff; border-radius: 16px; border: 1px solid #D8E2C4; padding: 24px; box-shadow: 0 2px 8px rgba(69, 81, 32, 0.04);">
            <h3 style="font-size: 16px; font-weight: 800; color: #101828; margin: 0 0 16px 0; font-family: 'Be Vietnam Pro', sans-serif;">Lịch sử làm bài</h3>
            ${attempts.length > 0 ? renderStudentAssignmentHistory(attempts) : '<div style="text-align: center; color: #667085; padding: 32px 0; font-size: 14px;">Chưa có lần nộp nào.</div>'}
          </div>

        </div>
      </div>
    </div>
    `;
    document.querySelector('#start-assignment')?.addEventListener('click', () => mountAssignmentExam(id));
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}


function renderStudentAssignmentHistory(attempts) {
  if (!attempts.length) return '<div style="text-align: center; color: #667085; padding: 24px; font-family: \'Be Vietnam Pro\', sans-serif; font-size: 14px;">Chưa có lần nộp nào.</div>';

  function fmtShort(value) {
    if (!value) return '-';
    const d = new Date(value);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const yr = String(d.getFullYear()).slice(-2);
    return `${hh}:${mm} ${day}/${month}/${yr}`;
  }

  return `
    <div style="display: flex; flex-direction: column;">
      ${attempts
        .map((attempt, index) => {
          const isPassed = (attempt.score_10 ?? 0) >= 8.0;
          const isLast = index === attempts.length - 1;
          return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 0; ${isLast ? '' : 'border-bottom: 1px solid #E5ECD9;'}">
              <div style="display: flex; align-items: center; gap: 14px;">
                <span style="padding: 3px 8px; border: 1px solid ${isPassed ? '#455120' : '#455120'}; color: #455120; font-size: 11px; font-weight: 700; border-radius: 4px; font-family: 'Be Vietnam Pro', sans-serif; letter-spacing: 0.3px; white-space: nowrap;">
                  ${isPassed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                </span>
                <span style="font-size: 15px; font-weight: 700; color: #101828; font-family: 'Be Vietnam Pro', sans-serif; min-width: 28px;">
                  ${formatScore(attempt.score_10)}
                </span>
                <span style="font-size: 13px; color: #667085; font-family: 'Be Vietnam Pro', sans-serif; display: flex; align-items: center; gap: 5px;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  ${fmtShort(attempt.submitted_at)}
                </span>
              </div>
              <a href="#/review/${attempt.id}" style="padding: 5px 16px; border: 1px solid #455120; color: #455120; border-radius: 9999px; font-size: 13px; font-weight: 500; text-decoration: none; font-family: 'Be Vietnam Pro', sans-serif; white-space: nowrap;">Chi tiết</a>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}


async function mountAssignmentExam(id) {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang mở đề');
  try {
    const { assignment, questions } = await fetchAssignmentForStudent(id);
    if (state.profile.role === 'student' && assignment.pdf_url && assignment.pdf_url !== 'latex') {
      root.innerHTML = `
        <div class="panel" style="max-width: 600px; margin: 60px auto; padding: 48px 32px; text-align: center; border-radius: 20px;">
          <md-icon style="font-size: 56px; color: #B42318; margin-bottom: 16px;">lock</md-icon>
          <h2 style="margin: 0 0 12px 0; color: #101828; font-family: 'Beautique Display', serif;">Bài tập PDF đã bị khóa</h2>
          <p style="color: #667085; line-height: 1.6; margin-bottom: 24px; font-family: 'Be Vietnam Pro', sans-serif;">Hệ thống không còn cho phép làm bài hoặc mở đề PDF này nữa. Kết quả điểm số cũ của bạn vẫn được ghi nhận trong lịch sử.</p>
          <a class="nh-btn-primary" href="#/assignment/${id}" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px; background: #455120; color: #fff; text-decoration: none; border-radius: 9999px; font-weight: 600;">Xem lịch sử điểm</a>
        </div>
      `;
      return;
    }
    const draft = loadDraft(localStorage, state.profile.id, id);
    const answers = draft?.answers ?? {};
    root.innerHTML = `
      ${assignment.pdf_url === 'latex' ? `
        <div style="background-color: #EDF2E4; min-height: 100vh; padding: 0 0 60px 0; margin: 0; font-family: 'Be Vietnam Pro', sans-serif;">
          <!-- Top Breadcrumb Bar -->
          <div style="background: #DCE8CC; color: #455120; border-bottom: 1px solid #D1DFC0; padding: 12px 0; margin-bottom: 24px;">
            <div style="max-width: 1420px; width: 100%; margin: 0 auto; padding: 0 40px; font-size: 13.5px; font-weight: 500; display: flex; align-items: center; gap: 8px;">
              <a href="#/learn" style="color: #455120; text-decoration: none; font-weight: 500;">Danh mục khóa học</a>
              <span style="opacity: 0.6; font-size: 13px;">&rsaquo;</span>
              <span style="font-weight: 700; color: #455120;">${escapeHtml(assignment.title)}</span>
            </div>
          </div>

          <section class="exam-shell" style="height: auto; max-width: 1420px; width: 100%; margin: 0 auto; padding: 0 24px; display: grid; grid-template-columns: minmax(0, 1fr) 290px; gap: 24px; align-items: start;">
            <!-- Left Main Content Column -->
            <form id="answer-form" style="min-width: 0; width: 100%; display: flex; flex-direction: column; gap: 28px; background: #ffffff; padding: 32px 40px; border-radius: 16px; border: 1px solid #D8E2C4; box-shadow: 0 2px 12px rgba(69, 81, 32, 0.02);">
              
              <!-- Section Header I. Trắc nghiệm -->
              <div style="display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 4px 16px 4px 4px; background: #f0f4e8; border: 1px solid #d8e2ca; border-radius: 9999px; color: #455120; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 700; font-size: 15px; box-sizing: border-box; width: 100%;">
                <span style="width: 28px; height: 28px; border-radius: 50%; background: #455120; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif;">I</span>
                <span>Trắc nghiệm</span>
              </div>

              ${questions.map((q, i) => {
                const cleanPrompt = q.prompt ? q.prompt.replace(/^Câu\s*\d+[\.\:\s]*/i, '') : '';
                const qNumStr = String(i + 1).padStart(2, '0');
                return `
                <article class="latex-exam-card" data-question-id="${q.id}" data-type="${q.type}" style="display: flex; flex-direction: column; gap: 14px; padding-bottom: 24px; border-bottom: 1px solid #f1f5f9;">
                  <div style="font-size: 15px; color: #1e293b; line-height: 1.6;">
                    <span style="font-weight: 900; color: #455120; font-size: 17px; font-family: 'Beautique Display', serif; letter-spacing: 0.5px; margin-right: 12px; display: inline-block;">CÂU ${qNumStr}</span>
                    <span style="font-weight: 500; color: #1e293b; font-size: 15px;">${renderLatexText(cleanPrompt)}</span>
                  </div>
                  
                  <div class="choice-grid" style="display: flex; flex-direction: column; gap: 10px; padding-left: 2px; margin-top: 4px;">
                    ${(q.choices ?? []).map((choice, cIdx) => {
                      const value = String.fromCharCode(65 + cIdx);
                      const isChecked = answers[q.id] === value;
                      return `
                        <label class="latex-choice-tile ${isChecked ? 'selected' : ''}" style="display: flex; gap: 10px; align-items: center; cursor: pointer; padding: 2px 0; border: none; background: transparent; transition: all 0.15s ease;">
                          <input type="radio" name="q-${q.id}" value="${value}" ${isChecked ? 'checked' : ''} style="opacity: 0; position: absolute; pointer-events: none;">
                          <div class="latex-radio-circle" style="width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid ${isChecked ? '#455120' : '#cbd5e1'}; background: #ffffff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s ease;">
                            <div class="dot" style="width: 8px; height: 8px; border-radius: 50%; background: #455120; display: ${isChecked ? 'block' : 'none'};"></div>
                          </div>
                          <div style="font-size: 14.5px; line-height: 1.5; color: #1e293b; display: flex; align-items: center; gap: 4px;">
                            <span style="font-weight: 800; color: #1e293b;">${value}.</span><span>${renderLatexText(choice)}</span>
                          </div>
                        </label>
                      `;
                    }).join('')}
                  </div>
                </article>
              `}).join('')}
            </form>

            <!-- Right Sidebar: Navigator -->
            <aside class="exam-navigator" style="position: sticky; top: 88px; display: flex; flex-direction: column; gap: 16px;">
              
              <!-- Progress & Navigator Card -->
              <div style="background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 20px; display: flex; flex-direction: column; gap: 18px; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                
                <!-- Completion Bar -->
                <div>
                  <div style="font-size: 13.5px; color: #1e293b; font-weight: 600; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-family: 'Be Vietnam Pro', sans-serif; font-weight: 700;">Bạn đã hoàn thành</span>
                    <span style="color: #455120; font-weight: 800; font-size: 16px; font-family: 'Be Vietnam Pro', sans-serif;" id="completion-count-display">${Object.values(answers).filter(Boolean).length}/${questions.length}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="flex: 1; background: #e2e8f0; height: 10px; border-radius: 999px; overflow: hidden; position: relative;">
                      <div id="completion-progress-bar" style="width: ${Math.round((Object.values(answers).filter(Boolean).length / (questions.length || 1)) * 100)}%; background: #455120; height: 100%; border-radius: 999px; transition: width 0.3s ease;"></div>
                    </div>
                  </div>
                </div>

                <!-- Section Navigator Pill -->
                <div style="display: flex; flex-direction: column; gap: 12px;">
                  <div style="display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 4px 14px 4px 4px; background: #f0f4e8; border: 1px solid #d8e2ca; border-radius: 9999px; color: #455120; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 700; font-size: 14px; box-sizing: border-box; width: 100%;">
                    <span style="width: 26px; height: 26px; border-radius: 50%; background: #455120; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif;">I</span>
                    <span>Trắc nghiệm</span>
                  </div>
                  <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px 10px;">
                    ${questions.map((q, i) => {
                      const isAns = !!answers[q.id];
                      return `
                        <button type="button" class="nav-btn ${isAns ? 'answered' : ''}" data-nav="${q.id}" onclick="document.querySelector('[data-question-id=\\'${q.id}\\']').scrollIntoView({behavior: 'smooth', block: 'center'})" style="width: 40px; height: 40px; border-radius: 50%; border: 1px solid ${isAns ? '#455120' : '#e2e8f0'}; background: ${isAns ? '#455120' : '#ffffff'}; color: ${isAns ? '#ffffff' : '#1e293b'}; cursor: pointer; font-family: 'Be Vietnam Pro', sans-serif; font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center; margin: 0 auto; transition: all 0.15s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                          ${String(i + 1).padStart(2, '0')}
                        </button>
                      `;
                    }).join('')}
                  </div>
                </div>

                <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 10px;">
                  <p id="autosave-status" class="autosave-status" style="font-size: 12px; text-align: center; color: #64748b; margin: 0;">${draft ? `Đã lưu ${formatDateTime(draft.savedAt)}` : 'Tự động lưu khi chọn'}</p>
                  <button type="button" id="trigger-submit-modal-btn" style="width: 100%; height: 44px; background: #455120; color: #ffffff; border: none; border-radius: 10px; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 600; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.2s ease;">
                    Kết thúc
                  </button>
                </div>
              </div>
            </aside>
          </section>

          <!-- Submission Confirmation Modal -->
          <div id="submit-confirm-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(2px); z-index: 9999; align-items: center; justify-content: center;">
            <div style="background: #ffffff; border-radius: 20px; width: 90%; max-width: 400px; padding: 28px 24px; text-align: center; position: relative; box-shadow: 0 10px 25px rgba(0,0,0,0.15); display: flex; flex-direction: column; align-items: center; gap: 16px;">
              <button type="button" id="close-submit-modal-btn" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 20px; color: #94a3b8; cursor: pointer;">&times;</button>
              
              <h3 style="margin: 0; color: #455120; font-family: 'Beautique Display', serif; font-size: 22px; font-weight: 700;">Xác nhận nộp bài</h3>
              
              <!-- Circular Progress Badge -->
              <div style="width: 96px; height: 96px; border-radius: 50%; background: radial-gradient(closest-side, white 79%, transparent 80% 100%), conic-gradient(#455120 calc(var(--modal-pct, 0) * 1%), #e2e8f0 0); display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 8px 0;">
                <span style="font-size: 20px; font-weight: 800; color: #455120; font-family: 'Beautique Display', serif;" id="modal-completion-ratio">0/0</span>
                <span style="font-size: 11px; color: #64748b;">Tổng câu hỏi</span>
              </div>

              <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.5;">Bạn chưa hoàn thành bài thi.<br>Bạn có chắc chắn muốn nộp bài?</p>
              
              <div style="display: flex; gap: 12px; width: 100%; margin-top: 8px;">
                <button type="button" id="modal-continue-btn" style="flex: 1; height: 42px; background: #f0f4e8; color: #455120; border: 1px solid #d8e2ca; border-radius: 10px; font-weight: 700; font-size: 14.5px; cursor: pointer;">Làm tiếp</button>
                <button type="button" id="modal-submit-btn" style="flex: 1; height: 42px; background: #455120; color: #ffffff; border: none; border-radius: 10px; font-weight: 700; font-size: 14.5px; cursor: pointer;">Nộp bài</button>
              </div>
            </div>
          </div>
        </div>
        <style>
          .latex-exam-card img {
            display: block !important;
            margin: 16px auto !important;
            max-width: 100% !important;
            height: auto !important;
          }
          .latex-choice-tile:hover .latex-radio-circle {
            border-color: #455120 !important;
            box-shadow: 0 0 0 3px rgba(69, 81, 32, 0.12) !important;
          }
          .nav-btn:hover {
            border-color: #455120 !important;
            color: #455120 !important;
          }
          .nav-btn.answered:hover {
            color: #ffffff !important;
            opacity: 0.9;
          }
          @media (max-width: 900px) {
            .exam-shell {
              grid-template-columns: 1fr !important;
            }
            .exam-navigator {
              position: static !important;
              order: -1;
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
    wireAnswerAutosave(assignment, id, draft);
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
      ${displayPrompt ? `<p>${renderLatexText(question.prompt)}</p>` : ''}
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
                    <span>${renderLatexText(choice)}</span>
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

function wireAnswerAutosave(assignment, assignmentId, draft) {
  const form = document.querySelector('#answer-form');
  
  if (assignment.pdf_url === 'latex' && window.MathJax) {
    window.MathJax.typesetPromise();
  }

  const autosaveStatus = document.querySelector('#autosave-status');
  const stickyAutosaveStatus = document.querySelector('#sticky-autosave-status');
  let autosaveTimer;
  let draftAnswers = collectAnswers();
  let timeSpent = draft?.timeSpent ?? {};
  
  // Time tracking logic
  let activeQuestionId = null;
  let timeTrackingInterval = null;

  const startTracking = () => {
    if (timeTrackingInterval) clearInterval(timeTrackingInterval);
    timeTrackingInterval = setInterval(() => {
      if (activeQuestionId && document.visibilityState === 'visible') {
        timeSpent[activeQuestionId] = (timeSpent[activeQuestionId] || 0) + 1000;
      }
    }, 1000);
  };
  startTracking();

  const observer = new IntersectionObserver((entries) => {
    // Find the most visible question
    let maxRatio = 0;
    let mostVisibleId = null;
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
        maxRatio = entry.intersectionRatio;
        mostVisibleId = entry.target.dataset.questionId;
      }
    });
    if (mostVisibleId) {
      activeQuestionId = mostVisibleId;
    }
  }, { threshold: [0.1, 0.5, 0.9] });

  const cards = document.querySelectorAll('.latex-exam-card, .question-card');
  cards.forEach(card => observer.observe(card));

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
        navBtn.style.background = '#455120';
        navBtn.style.color = '#ffffff';
        navBtn.style.borderColor = '#455120';
      }

      // Update Radio Tile Circles visually
      const card = event.target.closest('.latex-exam-card');
      if (card) {
        const labels = card.querySelectorAll('.latex-choice-tile');
        labels.forEach(lbl => {
          const radio = lbl.querySelector('input[type="radio"]');
          const circle = lbl.querySelector('.latex-radio-circle');
          const dot = lbl.querySelector('.dot');
          if (radio && radio.checked) {
            lbl.classList.add('selected');
            if (circle) circle.style.borderColor = '#455120';
            if (dot) dot.style.display = 'block';
          } else {
            lbl.classList.remove('selected');
            if (circle) circle.style.borderColor = '#cbd5e1';
            if (dot) dot.style.display = 'none';
          }
        });
      }
    }

    const card = event.target?.closest?.('.question-card') || event.target?.closest?.('.latex-exam-card');
    if (card?.dataset?.questionId) {
      draftAnswers[card.dataset.questionId] = collectAnswerFromCard(card);
    } else {
      draftAnswers = collectAnswers();
    }

    // Update progress stats in navigator
    const answeredCount = Object.keys(draftAnswers).filter(k => draftAnswers[k]).length;
    const totalCount = document.querySelectorAll('.latex-exam-card').length || 1;
    const countDisplay = document.querySelector('#completion-count-display');
    const progressBar = document.querySelector('#completion-progress-bar');
    if (countDisplay) countDisplay.textContent = `${answeredCount}/${totalCount}`;
    if (progressBar) progressBar.style.width = `${Math.round((answeredCount / totalCount) * 100)}%`;
    setAutosaveStatus('Đang lưu bản nháp...');
    window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => {
      saveDraft(localStorage, state.profile.id, assignmentId, draftAnswers, timeSpent);
      setAutosaveStatus(`Đã lưu bản nháp lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`);
    }, 250);
  };
  
  // Also save periodically even without clicks to save timeSpent
  setInterval(() => {
    saveDraft(localStorage, state.profile.id, assignmentId, draftAnswers, timeSpent);
  }, 10000);

  // Wire Modal Confirmation logic
  const modal = document.querySelector('#submit-confirm-modal');
  const triggerModalBtn = document.querySelector('#trigger-submit-modal-btn');
  const closeModalBtn = document.querySelector('#close-submit-modal-btn');
  const modalContinueBtn = document.querySelector('#modal-continue-btn');
  const modalSubmitBtn = document.querySelector('#modal-submit-btn');

  if (triggerModalBtn && modal) {
    triggerModalBtn.addEventListener('click', () => {
      const answeredCount = Object.keys(draftAnswers).filter(k => draftAnswers[k]).length;
      const totalCount = document.querySelectorAll('.latex-exam-card').length || 1;
      const modalRatio = document.querySelector('#modal-completion-ratio');
      if (modalRatio) modalRatio.textContent = `${answeredCount}/${totalCount}`;
      const pct = Math.round((answeredCount / totalCount) * 100);
      modal.style.setProperty('--modal-pct', pct);
      modal.style.display = 'flex';
    });
  }

  if (closeModalBtn && modal) closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
  if (modalContinueBtn && modal) modalContinueBtn.addEventListener('click', () => modal.style.display = 'none');
  if (modalSubmitBtn && modal) {
    modalSubmitBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      form.requestSubmit();
    });
  }

  form.addEventListener('input', persist);
  form.addEventListener('change', persist);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (timeTrackingInterval) clearInterval(timeTrackingInterval);
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
        timeSpent,
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
    
    // Fetch student info
    let studentName = 'Học sinh';
    if (review.attempt?.student_id) {
      const { data: userData } = await supabase.from('profiles').select('full_name, email').eq('id', review.attempt.student_id).single();
      if (userData) studentName = userData.full_name || userData.email;
    }
    
    const startedAt = review.attempt?.started_at ? new Date(review.attempt.started_at) : null;
    const completedAt = review.attempt?.submitted_at ? new Date(review.attempt.submitted_at) : null;
    
    let durationStr = '-';
    // Calculate from per-question time_spent_ms if available, otherwise fallback to start/end time
    const totalTimeSpentMs = itemsWithQuestions.reduce((sum, item) => sum + (item.time_spent_ms || 0), 0);
    if (totalTimeSpentMs > 0) {
      const m = Math.floor(totalTimeSpentMs / 60000);
      const s = Math.floor((totalTimeSpentMs % 60000) / 1000);
      durationStr = `${m}p ${s}s`;
    } else if (startedAt && completedAt) {
      const ms = completedAt - startedAt;
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      durationStr = `${m}p ${s}s`;
    }
    
    if (review.assignment?.pdf_url === 'latex') {
      const score10 = review.attempt?.score_10 ?? 0;
      root.innerHTML = `
        <div style="background-color: #ebf1eb; min-height: 100vh; padding: 0 0 60px 0; margin: 0; font-family: 'Be Vietnam Pro', sans-serif;">
          <!-- Top Breadcrumb Bar -->
          <div style="background: #e2e8f0; color: #455120; border-bottom: 1px solid #cbd5e1; padding: 12px 0; margin-bottom: 24px;">
            <div style="max-width: 1420px; width: 100%; margin: 0 auto; padding: 0 40px; font-size: 13.5px; font-weight: 500; display: flex; align-items: center; gap: 8px;">
              <a href="#/learn" style="color: #455120; text-decoration: none; font-weight: 500;">Danh mục khóa học</a>
              <span style="opacity: 0.6; font-size: 13px;">&rsaquo;</span>
              <span style="font-weight: 700; color: #455120;">Kết quả làm bài - ${escapeHtml(review.assignment?.title ?? 'Đề bài')}</span>
            </div>
          </div>

          <section class="exam-shell" style="height: auto; max-width: 1420px; width: 100%; margin: 0 auto; padding: 0 24px; display: grid; grid-template-columns: minmax(0, 1fr) 290px; gap: 24px; align-items: start;">
            <!-- Left Main Content Column -->
            <div style="min-width: 0; width: 100%; display: flex; flex-direction: column; gap: 24px;">
              
              <!-- Clean 1-Card Stats Block (Score, Questions, Time) -->
              <div style="background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px 36px; display: flex; align-items: center; gap: 48px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);">
                
                <!-- Score Circle -->
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; flex-shrink: 0;">
                  <div style="position: relative; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center;">
                    <svg viewBox="0 0 36 36" style="position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg);">
                      <path stroke="#e2e8f0" stroke-width="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path stroke="#455120" stroke-width="3" stroke-dasharray="${score10 * 10}, 100" stroke-linecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1;">
                      <span style="font-family: 'Beautique Display', serif; font-size: 13px; font-weight: 700; color: #667085; margin-bottom: 2px;">Điểm của em</span>
                      <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 44px; font-weight: 800; color: #455120; line-height: 1;">${formatScore(score10)}</span>
                    </div>
                  </div>
                </div>

                <!-- Vertical Divider -->
                <div style="width: 1px; height: 80px; background: #E5ECD9; flex-shrink: 0;"></div>

                <!-- Stats Right: Số câu hỏi & Thời gian làm bài -->
                <div style="display: flex; gap: 48px; flex: 1;">
                  <!-- Số câu hỏi -->
                  <div style="display: flex; flex-direction: column; gap: 8px;">
                    <span style="font-family: 'Beautique Display', serif; font-size: 15px; font-weight: 700; color: #475467;">Số câu hỏi</span>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #455120; opacity: 0.85;"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 18px; font-weight: 600; color: #101828; line-height: 1; display: inline-block; transform: translateY(1px);">${items.length}</span>
                    </div>
                  </div>

                  <!-- Thời gian làm bài -->
                  <div style="display: flex; flex-direction: column; gap: 8px;">
                    <span style="font-family: 'Beautique Display', serif; font-size: 15px; font-weight: 700; color: #475467;">Thời gian làm bài</span>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #455120; opacity: 0.85;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 17px; font-weight: 600; color: #101828; line-height: 1; display: inline-block; transform: translateY(1px);">${durationStr}</span>
                    </div>
                  </div>
                </div>

              </div>
            
            <div class="latex-review-list" style="display: flex; flex-direction: column; gap: 28px; background: #ffffff; padding: 32px 40px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 2px 12px rgba(0,0,0,0.02);">
              <!-- Section Header I. Trắc nghiệm -->
              <div style="display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 4px 16px 4px 4px; background: #f0f4e8; border: 1px solid #d8e2ca; border-radius: 9999px; color: #455120; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 700; font-size: 15px; box-sizing: border-box; width: 100%;">
                <span style="width: 28px; height: 28px; border-radius: 50%; background: #455120; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif;">I</span>
                <span>Trắc nghiệm</span>
              </div>

            ${(() => {
              return itemsWithQuestions.map((item, index) => {
                const hasAns = item.answer !== null && item.answer !== undefined && String(item.answer).trim() !== '';
                const isCorrect = item.is_correct;
                const chosenAnswer = formatAnswer(item.answer);
                const correctAnswer = formatAnswer(item.correct_answer ?? item.accepted_answers);
                const cleanPrompt = item.prompt ? item.prompt.replace(/^Câu\s*\d+[\.\:\s]*/i, '') : '';
                const qNumStr = String(index + 1).padStart(2, '0');

                let badgeHtml = '';
                if (!hasAns) {
                  badgeHtml = `<span style="background: #f1f5f9; color: #475467; border: 1px solid #cbd5e1; padding: 4px 12px; border-radius: 9999px; font-size: 12.5px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif;">Chưa trả lời</span>`;
                } else if (isCorrect) {
                  badgeHtml = `<span style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; padding: 4px 12px; border-radius: 9999px; font-size: 12.5px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif;">Đúng</span>`;
                } else {
                  badgeHtml = `<span style="background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; padding: 4px 12px; border-radius: 9999px; font-size: 12.5px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif;">Sai</span>`;
                }

                return `
                  <article id="latex-review-q${index}" class="latex-exam-card" style="display: flex; flex-direction: column; gap: 14px; padding-bottom: 28px; border-bottom: 1px solid #f1f5f9;">
                    
                    <!-- Question Title & Prompt & Status Badge -->
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                      <div style="font-size: 15px; color: #1e293b; line-height: 1.6; flex: 1;">
                        <span style="font-weight: 900; color: #455120; font-size: 17px; font-family: 'Beautique Display', serif; letter-spacing: 0.5px; margin-right: 12px; display: inline-block;">CÂU ${qNumStr}</span>
                        <span style="font-weight: 500; color: #1e293b; font-size: 15px;">${renderLatexText(cleanPrompt)}</span>
                      </div>
                      <div style="flex-shrink: 0;">${badgeHtml}</div>
                    </div>
                    
                    <!-- Choice Radio List with Correct/Wrong Feedback -->
                    <div class="choice-grid" style="display: flex; flex-direction: column; gap: 8px; padding-left: 2px; margin-top: 4px;">
                      ${(item.choices ?? []).map((choice, cIdx) => {
                        const letter = String.fromCharCode(65 + cIdx);
                        const isChosen = chosenAnswer === letter;
                        const isCorrectChoice = correctAnswer === letter;
                        
                        let wrapperBg = '#ffffff';
                        let wrapperBorder = 'transparent';
                        let circleBorder = '#cbd5e1';
                        let circleBg = '#ffffff';
                        let dotDisplay = 'none';
                        let dotColor = '#455120';
                        let tag = '';

                        if (isChosen && isCorrectChoice) {
                          wrapperBg = '#f0fdf4';
                          wrapperBorder = '#bbf7d0';
                          circleBorder = '#166534';
                          circleBg = '#ffffff';
                          dotDisplay = 'block';
                          dotColor = '#166534';
                          tag = `<span style="background: #166534; color: #ffffff; padding: 2px 8px; border-radius: 6px; font-size: 11.5px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif; margin-left: auto; flex-shrink: 0;">Bạn chọn (Đúng)</span>`;
                        } else if (isChosen && !isCorrectChoice) {
                          wrapperBg = '#fef2f2';
                          wrapperBorder = '#fecaca';
                          circleBorder = '#dc2626';
                          circleBg = '#ffffff';
                          dotDisplay = 'block';
                          dotColor = '#dc2626';
                          tag = `<span style="background: #dc2626; color: #ffffff; padding: 2px 8px; border-radius: 6px; font-size: 11.5px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif; margin-left: auto; flex-shrink: 0;">Bạn chọn (Sai)</span>`;
                        } else if (isCorrectChoice) {
                          wrapperBg = '#f0fdf4';
                          wrapperBorder = '#bbf7d0';
                          circleBorder = '#166534';
                          circleBg = '#ffffff';
                          tag = `<span style="background: #455120; color: #ffffff; padding: 2px 8px; border-radius: 6px; font-size: 11.5px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif; margin-left: auto; flex-shrink: 0;">Đáp án đúng</span>`;
                        }

                        return `
                          <div style="display: flex; gap: 10px; align-items: center; padding: 8px 12px; border-radius: 8px; background: ${wrapperBg}; border: 1px solid ${wrapperBorder}; transition: all 0.15s ease;">
                            <div class="latex-radio-circle" style="width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid ${circleBorder}; background: ${circleBg}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                              <div class="dot" style="width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; display: ${dotDisplay};"></div>
                            </div>
                            <div style="font-size: 14.5px; line-height: 1.5; color: #1e293b; display: flex; align-items: center; gap: 4px; flex: 1;">
                              <span style="font-weight: 800; color: #1e293b;">${letter}.</span><span>${renderLatexText(choice)}</span>
                            </div>
                            ${tag}
                          </div>
                        `;
                      }).join('')}
                    </div>

                    <!-- Đáp án đúng text -->
                    <div style="margin-top: 14px;">
                      <div style="font-size: 16px; font-weight: 900; color: #455120; font-family: 'Beautique Display', serif; margin-bottom: 6px;">Đáp án</div>
                      <div style="font-size: 14.5px; font-weight: 700; color: #1e293b; line-height: 1.6;">
                        ${correctAnswer}. ${item.choices && item.choices[correctAnswer.charCodeAt(0) - 65] ? renderLatexText(item.choices[correctAnswer.charCodeAt(0) - 65]) : ''}
                      </div>
                    </div>

                    <!-- Hướng dẫn giải chi tiết -->
                    <div style="margin-top: 18px;">
                      <div style="font-size: 16px; font-weight: 900; color: #455120; font-family: 'Beautique Display', serif; margin-bottom: 8px;">Hướng dẫn giải chi tiết</div>
                      <div style="font-size: 14.5px; line-height: 2.2; color: #334155;">
                        ${item.settings?.explanation ? renderLatexText(item.settings.explanation) : '<i style="color: #94a3b8;">Chưa có lời giải chi tiết cho câu hỏi này.</i>'}
                      </div>
                    </div>

                  </article>
                `;
              }).join('');
            })()}
            </div>
            </div>
            
            <aside class="exam-navigator" style="position: sticky; top: 88px; display: flex; flex-direction: column; gap: 16px;">
              <div style="background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 20px; display: flex; flex-direction: column; gap: 18px; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px;">
                  <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px; font-weight: 700; color: #1e293b;">Bạn trả lời đúng</span>
                  <span style="font-size: 16px; font-weight: 800; color: #455120; font-family: 'Be Vietnam Pro', sans-serif;">${items.filter(i => (i.answer !== null && i.answer !== undefined && String(i.answer).trim() !== '') && i.is_correct).length}/${items.length}</span>
                </div>
          
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px; padding: 4px 14px 4px 4px; background: #f0f4e8; border: 1px solid #d8e2ca; border-radius: 9999px; color: #455120; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 700; font-size: 14px; width: 100%; box-sizing: border-box;">
              <span style="width: 26px; height: 26px; border-radius: 50%; background: #455120; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif;">I</span>
              <span>Trắc nghiệm</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px 10px;">
              ${items.map((i, idx) => {
                const hasAns = i.answer !== null && i.answer !== undefined && String(i.answer).trim() !== '';
                let bg = '#ffffff';
                let border = '#cbd5e1';
                let color = '#475467';

                if (!hasAns) {
                  bg = '#f1f5f9';
                  border = '#cbd5e1';
                  color = '#475467';
                } else if (i.is_correct) {
                  bg = '#455120';
                  border = '#455120';
                  color = '#ffffff';
                } else {
                  bg = '#c62828';
                  border = '#c62828';
                  color = '#ffffff';
                }
                return `
                  <button type="button" onclick="document.getElementById('latex-review-q${idx}').scrollIntoView({behavior: 'smooth', block: 'center'})" style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: ${bg}; color: ${color}; font-weight: 700; font-size: 13px; border: 1px solid ${border}; cursor: pointer; transition: all 0.15s ease; font-family: 'Be Vietnam Pro', sans-serif; margin: 0 auto; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                    ${(idx + 1).toString().padStart(2, '0')}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
          
          <div style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 24px; height: 24px; border-radius: 50%; background: #f1f5f9; color: #475467; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; font-family: 'Be Vietnam Pro', sans-serif;">${items.filter(i => i.answer === null || i.answer === undefined || String(i.answer).trim() === '').length}</div>
              <span style="font-size: 13.5px; color: #475467; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 500;">Câu chưa trả lời</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 24px; height: 24px; border-radius: 50%; background: #455120; color: #ffffff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; font-family: 'Be Vietnam Pro', sans-serif;">${items.filter(i => (i.answer !== null && i.answer !== undefined && String(i.answer).trim() !== '') && i.is_correct).length}</div>
              <span style="font-size: 13.5px; color: #475467; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 500;">Câu trả lời đúng</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 24px; height: 24px; border-radius: 50%; background: #c62828; color: #ffffff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; font-family: 'Be Vietnam Pro', sans-serif;">${items.filter(i => (i.answer !== null && i.answer !== undefined && String(i.answer).trim() !== '') && !i.is_correct).length}</div>
              <span style="font-size: 13.5px; color: #475467; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 500;">Câu trả lời sai</span>
            </div>
          </div>
        </div>
        </aside>
        </section>
        </div>
        <style>
          details summary::-webkit-details-marker { display: none; }
          details[open] summary .expand-icon { transform: rotate(180deg); }
          .expand-icon { transition: transform 0.2s ease; }
          .latex-question-review details { transition: all 0.2s ease; }
          .latex-question-review details[open] { background: #f8fafc; }
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
            ${state.profile.role === 'student' && review.assignment?.pdf_url && review.assignment?.pdf_url !== 'latex' ? `
              <div class="panel" style="padding: 48px 24px; text-align: center; color: #667085; background: #ffffff; border-radius: 16px; border: 1px solid #E5ECD9; margin-top: 12px;">
                <md-icon style="font-size: 48px; color: #98A2B3; margin-bottom: 12px;">lock</md-icon>
                <h3 style="font-family: 'Beautique Display', serif; font-size: 18px; color: #455120; margin: 0 0 8px 0;">Đề bài PDF đã khóa truy cập</h3>
                <p style="margin: 0; font-size: 14px; color: #667085; font-family: 'Be Vietnam Pro', sans-serif;">Tài liệu đề bài PDF đã đóng. Bạn vẫn có thể xem lại đáp án và kết quả chấm điểm ở cột bên phải.</p>
              </div>
            ` : driveFrame(review.assignment?.pdf_url, review.assignment?.title ?? 'Đề bài', true)}
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
                      ${item.prompt && item.prompt !== `Câu ${index + 1}` && review.assignment?.pdf_url !== 'latex' ? `<h3>${renderLatexText(item.prompt)}</h3>` : ''}
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
    
    if (review.assignment?.pdf_url === 'latex' && window.MathJax) {
      window.MathJax.typesetPromise();
    }
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

async function mountProgressManager() {
  const root = pageRoot();
  root.innerHTML = renderSkeletonDashboard();

  try {
    const [students, learningPath, gradebook] = await Promise.all([
      fetchStudents(),
      fetchLearningPath(state.profile.role),
      fetchGradebook(),
    ]);

    if (!students.length) {
      root.innerHTML = renderErrorState(new Error('Chưa có học sinh nào trong hệ thống.'));
      return;
    }

    let selectedStudentId = students[0].id;
    let activeTab = 'progress'; // 'progress' | 'grades' | 'account'

    // Build flat lecture map by module
    const lecturesByModuleId = new Map();
    for (const lecture of learningPath.lectures) {
      if (!lecturesByModuleId.has(lecture.module_id)) lecturesByModuleId.set(lecture.module_id, []);
      lecturesByModuleId.get(lecture.module_id).push(lecture);
    }
    const totalLectures = learningPath.lectures.length;

    root.innerHTML = `
      <div style="background-color: #EDF2E4; min-height: calc(100vh - 64px); padding: 0 0 60px 0; margin: 0; font-family: 'Be Vietnam Pro', sans-serif;">
        <!-- Top Breadcrumb Bar -->
        <div class="nh-admin-breadcrumb-bar" style="margin-bottom: 24px;">
          <div class="nh-admin-breadcrumb-inner" style="max-width: 1140px;">
            <a href="#/manage">Trung tâm Quản trị</a>
            <span class="sep">&rsaquo;</span>
            <span class="active">Theo dõi & Quản lý Học sinh</span>
          </div>
        </div>

        <section style="max-width: 1140px; margin: 0 auto; padding: 0 max(var(--page-gutter), 24px);">
          <style>
            .progress-sidebar-item {
              padding: 10px 14px;
              border-radius: 9999px;
              cursor: pointer;
              transition: all 0.15s ease;
              font-family: 'Be Vietnam Pro', sans-serif;
              display: flex;
              align-items: center;
              justify-content: space-between;
            }
            .progress-sidebar-item:hover {
              background: #f1f5f9 !important;
            }
            .progress-sidebar-item.selected {
              background: #F0F4E8 !important;
            }
            .teaching-lecture-row:hover {
              background: #f8faf5 !important;
            }
            .nh-tab-btn {
              padding: 9px 18px;
              border-radius: 9999px;
              border: 1px solid #D8E2C4;
              background: #ffffff;
              color: #475569;
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.15s ease;
              display: inline-flex;
              align-items: center;
              gap: 6px;
            }
            .nh-tab-btn:hover {
              background: #f8fafc;
              color: #455120;
            }
            .nh-tab-btn.active {
              background: #455120;
              color: #ffffff;
              border-color: #455120;
            }
            details > summary::-webkit-details-marker { display: none; }
            details > summary { list-style: none; }
            details[open] > summary .dropdown-icon { transform: rotate(90deg); }
          </style>

          <div style="display: flex; flex-wrap: wrap; gap: 24px; align-items: start;">

            <!-- Sidebar: students list -->
            <div style="display: flex; flex-direction: column; gap: 12px; width: 290px; min-width: 290px; flex-shrink: 0;">
              <div class="panel" style="padding: 20px 16px; border-radius: 18px; background: #ffffff; border: 1px solid #D8E2C4; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03); display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 4px;">
                  <h3 style="margin: 0; font-family: 'Beautique Display', serif; font-size: 17px; font-weight: 700; color: #455120;">Danh sách Học sinh</h3>
                  <button id="nh-add-student-trigger" type="button" style="border: none; background: #F0F4E8; color: #455120; border: 1px solid #D8E2CA; border-radius: 9999px; padding: 4px 10px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.15s ease;" onmouseover="this.style.background='#e2ebda'" onmouseout="this.style.background='#F0F4E8'">
                    + Tạo mới
                  </button>
                </div>

                <div style="position: relative; width: 100%;">
                  <input id="student-search-input" type="text" placeholder="Tìm tên học sinh..." style="width: 100%; padding: 8px 12px 8px 32px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 13px; font-family: 'Be Vietnam Pro', sans-serif; outline: none; box-sizing: border-box;" />
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 10px; top: 10px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>

                <div class="progress-sidebar-list" style="display: flex; flex-direction: column; gap: 4px; max-height: 520px; overflow-y: auto;"></div>
              </div>
            </div>

            <!-- Main: detail pane -->
            <div class="progress-detail-pane panel" style="flex: 1; min-width: 320px; padding: 28px; border-radius: 18px; background: #ffffff; border: 1px solid #D8E2C4; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03); min-height: 520px; display: flex; flex-direction: column; gap: 20px;">
              <div class="progress-detail-loading" style="display: flex; align-items: center; justify-content: center; min-height: 200px; color: #64748b;">
                <md-circular-progress indeterminate></md-circular-progress>
              </div>
            </div>

          </div>
        </section>
      </div>

      <!-- Modal: Tạo học sinh mới -->
      <div class="nh-modal-overlay" id="nh-create-student-modal" style="display: none;">
        <div class="nh-modal-card">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px;">
            <h3 style="font-family: 'Beautique Display', serif; font-size: 17px; font-weight: 700; color: #455120; margin: 0;">Tạo tài khoản Học sinh mới</h3>
            <button id="nh-close-create-modal" type="button" style="border: none; background: transparent; cursor: pointer; color: #94a3b8; padding: 4px; border-radius: 50%;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <form id="create-student-form-modal" style="display: flex; flex-direction: column; gap: 16px; margin-top: 8px;">
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <label style="font-size: 13px; font-weight: 600; color: #334155;">Họ và tên <span style="color: #ef4444;">*</span></label>
              <input name="full_name" class="nh-form-input-clean" placeholder="Nhập họ tên..." required />
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <label style="font-size: 13px; font-weight: 600; color: #334155;">Email <span style="color: #ef4444;">*</span></label>
              <input name="email" type="email" class="nh-form-input-clean" placeholder="Nhập địa chỉ email..." required />
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <label style="font-size: 13px; font-weight: 600; color: #334155;">Mật khẩu tạm <span style="color: #ef4444;">*</span></label>
              <input name="password" type="text" class="nh-form-input-clean" value="123456" placeholder="Mật khẩu khởi tạo" required />
            </div>
            <input type="hidden" name="role" value="student" />
            <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
              <button type="submit" class="nh-modal-btn-primary">Tạo tài khoản</button>
            </div>
          </form>
        </div>
      </div>
    `;

    async function renderStudentDetail(studentId) {
      const pane = document.querySelector('.progress-detail-pane');
      if (!pane) return;

      const student = students.find((s) => s.id === studentId);
      if (!student) return;

      const onlineUsers = getOnlineUsers();
      const onlineUserMap = new Map(onlineUsers.map((u) => [u.id, u]));
      const onlineData = onlineUserMap.get(studentId);
      const isOnline = !!onlineData;

      function formatMessengerStatus(userObj, studentObj) {
        if (userObj) return { text: 'Đang hoạt động', isOnline: true };
        const timeVal = studentObj?.updated_at || studentObj?.created_at;
        if (!timeVal) return { text: 'Ngoại tuyến', isOnline: false };
        const diffSec = Math.floor((Date.now() - new Date(timeVal).getTime()) / 1000);
        if (diffSec < 60) return { text: 'Hoạt động vừa xong', isOnline: false };
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return { text: `Hoạt động ${diffMin} phút trước`, isOnline: false };
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return { text: `Hoạt động ${diffHours} giờ trước`, isOnline: false };
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 30) return { text: `Hoạt động ${diffDays} ngày trước`, isOnline: false };
        return { text: `Ngoại tuyến`, isOnline: false };
      }

      const statusInfo = formatMessengerStatus(onlineData, student);

      // Header profile + Tabs bar
      const headerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="position: relative;">
              <div style="width: 52px; height: 52px; border-radius: 50%; background: #455120; color: #ffffff; display: grid; place-items: center; font-size: 20px; font-weight: 500; flex-shrink: 0; aspect-ratio: 1/1;">
                ${escapeHtml((student.full_name || 'U').charAt(0).toUpperCase())}
              </div>
              ${isOnline ? '<span style="position: absolute; bottom: 1px; right: 1px; width: 13px; height: 13px; border-radius: 50%; background: #22c55e; border: 2.5px solid #ffffff;" title="Đang hoạt động"></span>' : ''}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                <span style="font-family: 'Beautique Display', serif; font-size: 20px; font-weight: 700; color: #455120;">${escapeHtml(student.full_name ?? '')}</span>
              </div>
              <div style="font-size: 13px; color: #64748b; font-family: 'Be Vietnam Pro', sans-serif; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span>${escapeHtml(student.email ?? '')}</span>
                <span style="color: #cbd5e1;">•</span>
                <span style="font-weight: 500; color: ${statusInfo.isOnline ? '#16a34a' : '#64748b'}; display: inline-flex; align-items: center; gap: 4px;">
                  ${statusInfo.isOnline ? '<span style="width: 7px; height: 7px; border-radius: 50%; background: #22c55e; display: inline-block;"></span>' : ''}
                  ${statusInfo.text}
                </span>
                ${student.status === 'disabled' ? '<span style="padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: #fef2f2; color: #ef4444;">Vô hiệu</span>' : ''}
              </div>
            </div>
          </div>

          <!-- Tabs Switcher -->
          <div style="display: flex; gap: 6px; background: #f8fafc; padding: 4px; border-radius: 9999px; border: 1px solid #e2e8f0; flex-wrap: wrap;">
            <button type="button" class="nh-tab-btn ${activeTab === 'progress' ? 'active' : ''}" data-tab="progress">
              Tiến độ bài giảng
            </button>
            <button type="button" class="nh-tab-btn ${activeTab === 'grades' ? 'active' : ''}" data-tab="grades">
              Bảng điểm & Bài tập
            </button>
            <button type="button" class="nh-tab-btn ${activeTab === 'account' ? 'active' : ''}" data-tab="account">
              Quản lý tài khoản
            </button>
          </div>
        </div>
      `;

      if (activeTab === 'progress') {
        pane.innerHTML = headerHTML + `<div style="display: flex; align-items: center; justify-content: center; min-height: 200px;"><md-circular-progress indeterminate></md-circular-progress></div>`;
        try {
          const teachingLogs = await fetchTeachingLogs(studentId);
          const taughtSet = new Set(teachingLogs.map((l) => l.lecture_id));
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
                    style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; cursor: pointer; transition: all 0.15s ease; margin-bottom: 4px;
                           background: ${isTaught ? '#F0F4E8' : '#f8fafc'}; border: 1px solid ${isTaught ? '#D8E2CA' : '#f1f5f9'};">
                    <div class="lecture-checkbox" style="width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0; transition: all 0.15s;
                      border: 2px solid ${isTaught ? '#455120' : '#cbd5e1'};
                      background: ${isTaught ? '#455120' : '#ffffff'};
                      display: flex; align-items: center; justify-content: center;">
                      ${isTaught ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                        font-weight: ${isTaught ? '600' : '500'};
                        color: ${isTaught ? '#455120' : '#334155'};">  
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
                  <div style="margin-left: 12px; margin-bottom: 8px; border-left: 2px solid #D8E2CA; padding-left: 14px;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #455120; margin-bottom: 6px;">
                      ${escapeHtml(group.title)}
                    </div>
                    ${groupLectures}
                  </div>
                `;
              }).join('');
              
              const ungrouped = lectures.filter(l => !l.group_id).map(renderRow).join('');
              
              return `
                <details class="progress-module-details" ${modTaught < modTotal ? 'open' : ''} style="margin-bottom: 10px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
                  <summary style="padding: 12px 16px; background: #f8fafc; font-weight: 600; font-size: 14px; cursor: pointer; list-style: none; display: flex; align-items: center; gap: 10px; user-select: none; color: #334155;">
                    <svg class="dropdown-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s ease;"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    <span style="flex: 1; font-weight: 600;">${escapeHtml(mod.title)}</span>
                    <span style="font-size: 12px; font-weight: 600; background: ${modTaught === modTotal ? '#455120' : '#e2e8f0'}; color: ${modTaught === modTotal ? '#ffffff' : '#475569'}; padding: 3px 10px; border-radius: 9999px;">${modTaught}/${modTotal}</span>
                  </summary>
                  <div style="padding: 14px; background: #ffffff;">
                    ${groupsMarkup}
                    ${ungrouped}
                  </div>
                </details>
              `;
            }).join('');

            if (!modulesMarkup.trim()) return '';
            return `
              <details class="progress-phase-details" ${phaseTaught < phaseTotal ? 'open' : ''} style="margin-bottom: 16px; border: 1px solid #D8E2C4; border-radius: 14px; overflow: hidden; background: #ffffff;">
                <summary style="padding: 14px 18px; background: #F0F4E8; font-weight: 700; font-size: 15px; cursor: pointer; list-style: none; display: flex; align-items: center; gap: 10px; user-select: none; color: #455120; font-family: 'Beautique Display', serif;">
                  <svg class="dropdown-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s ease;"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                  <span style="flex: 1; font-weight: 700;">${escapeHtml(phase.title)}</span>
                  <span style="font-size: 12px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif; background: ${phaseTaught === phaseTotal ? '#455120' : '#D8E2CA'}; color: ${phaseTaught === phaseTotal ? '#ffffff' : '#455120'}; padding: 4px 12px; border-radius: 9999px;">${phaseTaught}/${phaseTotal}</span>
                </summary>
                <div style="padding: 16px; background: #ffffff;">
                  ${modulesMarkup}
                </div>
              </details>
            `;
          }).join('');

          pane.innerHTML = headerHTML + `
            <!-- Progress bar -->
            <div style="background: #F0F4E8; border-radius: 14px; padding: 18px 20px; display: flex; align-items: center; gap: 20px; border: 1px solid #D8E2CA;">
              <div style="flex: 1;">
                <div style="font-size: 14px; font-weight: 600; color: #455120; margin-bottom: 10px;">Tiến độ hoàn thành bài giảng</div>
                <div style="background: #e2ebda; border-radius: 9999px; height: 10px; overflow: hidden;">
                  <div style="height: 100%; width: ${progressPct}%; background: #455120; border-radius: 9999px; transition: width 0.4s ease;"></div>
                </div>
              </div>
              <div style="text-align: center; min-width: 80px; background: #ffffff; padding: 10px 16px; border-radius: 12px; border: 1px solid #D8E2CA;">
                <div style="font-size: 22px; font-weight: 800; color: #455120; line-height: 1;">${taughtCount}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px; font-weight: 500;">/ ${totalLectures} bài</div>
              </div>
            </div>

            <!-- Lecture checklist -->
            <div style="display: flex; flex-direction: column; gap: 10px; overflow-y: auto; flex: 1;">
              ${phasesMarkup || '<div style="text-align: center; padding: 48px; color: #64748b; background: #f8fafc; border-radius: 14px; border: 1px dashed #cbd5e1;">Chưa có bài giảng nào trong hệ thống.</div>'}
            </div>
          `;

          // Wire teaching log toggles
          pane.querySelectorAll('.teaching-lecture-row').forEach((row) => {
            row.addEventListener('click', async () => {
              const lectureId = row.dataset.lectureId;
              const sid = row.dataset.studentId;
              const wasTaught = row.dataset.taught === 'true';
              row.dataset.taught = String(!wasTaught);

              try {
                if (!wasTaught) await upsertTeachingLog({ studentId: sid, lectureId });
                else await deleteTeachingLog({ studentId: sid, lectureId });
                renderStudentDetail(sid);
                renderStudentSidebarList();
              } catch (err) {
                toast(err.message, 'error');
                row.dataset.taught = String(wasTaught);
              }
            });
          });
        } catch (err) {
          pane.innerHTML = headerHTML + `<div style="color: #ef4444; padding: 24px;">Lỗi: ${escapeHtml(err.message)}</div>`;
        }
      } else if (activeTab === 'grades') {
        const studentGrades = gradebook.filter((g) => g.student_id === studentId);

        let gradesHTML = '';
        if (!studentGrades.length) {
          gradesHTML = `
            <div style="text-align: center; padding: 48px 24px; color: #64748b; background: #f8fafc; border-radius: 14px; border: 1px dashed #cbd5e1;">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin-bottom: 8px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              <div style="font-size: 15px; font-weight: 600; color: #334155; margin-bottom: 4px;">Chưa có bài nộp nào</div>
              <div style="font-size: 13px;">Học sinh chưa hoàn thành đề thi hoặc bài kiểm tra nào.</div>
            </div>
          `;
        } else {
          const fmt = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
          const rowsHTML = studentGrades.map((g) => {
            const dateStr = g.submitted_at ? new Date(g.submitted_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '---';
            const score10 = g.score_10 != null ? Number(g.score_10) : (g.max_points ? (g.score / g.max_points) * 10 : 0);
            return `
              <div style="background: #ffffff; border: 1px solid #D8E2C4; border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);">
                <div style="flex: 1; min-width: 0;">
                  <div style="font-size: 14.5px; font-weight: 700; color: #455120; margin-bottom: 4px;">${escapeHtml(g.assignments?.title || 'Bài kiểm tra')}</div>
                  <div style="font-size: 12px; color: #64748b;">Nộp bài lúc: ${dateStr}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="text-align: right;">
                    <div style="font-size: 11px; color: #64748b; font-weight: 500;">Điểm thô: ${g.score ?? 0}/${g.max_points ?? 10}</div>
                    <div style="font-size: 18px; font-weight: 800; color: ${score10 >= 8 ? '#16a34a' : score10 >= 5 ? '#d97706' : '#dc2626'};">${fmt.format(score10)} / 10</div>
                  </div>
                  <a href="#/review/${g.id}" style="padding: 6px 12px; border-radius: 9999px; background: #F0F4E8; color: #455120; border: 1px solid #D8E2CA; font-size: 12px; font-weight: 600; text-decoration: none;">Xem bài làm</a>
                </div>
              </div>
            `;
          }).join('');

          gradesHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div style="font-size: 14px; font-weight: 600; color: #455120;">Tổng số bài đã làm: ${studentGrades.length} bài</div>
              ${rowsHTML}
            </div>
          `;
        }

        pane.innerHTML = headerHTML + gradesHTML;
      } else if (activeTab === 'online') {
        const onlineUsers = getOnlineUsers();
        let onlineHTML = '';

        if (!onlineUsers.length) {
          onlineHTML = `
            <div style="text-align: center; padding: 48px 24px; color: #64748b; background: #f8fafc; border-radius: 14px; border: 1px dashed #cbd5e1;">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin-bottom: 8px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <div style="font-size: 15px; font-weight: 600; color: #334155; margin-bottom: 4px;">Hiện chưa có ai online</div>
              <div style="font-size: 13px;">Hệ thống sẽ cập nhật trạng thái ngay khi có học sinh mở ứng dụng.</div>
            </div>
          `;
        } else {
          const listUsers = onlineUsers.map((u) => {
            const timeStr = u.online_at ? new Date(u.online_at).toLocaleTimeString('vi-VN') : 'vừa xong';
            return `
              <div style="background: #ffffff; border: 1px solid #D8E2C4; border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="position: relative;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #455120; color: #ffffff; font-weight: 600; font-size: 16px; display: grid; place-items: center;">
                      ${escapeHtml((u.full_name || 'U').charAt(0).toUpperCase())}
                    </div>
                    <span style="position: absolute; bottom: 0; right: 0; width: 11px; height: 11px; border-radius: 50%; background: #22c55e; border: 2px solid #ffffff;"></span>
                  </div>
                  <div>
                    <div style="font-size: 14px; font-weight: 700; color: #455120;">${escapeHtml(u.full_name || 'Học sinh')}</div>
                    <div style="font-size: 12px; color: #64748b;">${escapeHtml(u.email || '')}</div>
                  </div>
                </div>
                <div style="font-size: 12px; font-weight: 600; color: #16a34a; background: #F0F4E8; padding: 4px 12px; border-radius: 9999px; border: 1px solid #D8E2CA;">
                  Online từ ${timeStr}
                </div>
              </div>
            `;
          }).join('');

          onlineHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div style="font-size: 14px; font-weight: 600; color: #455120; display: flex; align-items: center; gap: 6px;">
                <span style="width: 10px; height: 10px; border-radius: 50%; background: #22c55e; display: inline-block;"></span>
                Học sinh đang mở ứng dụng (${onlineUsers.length} người)
              </div>
              ${listUsers}
            </div>
          `;
        }

        pane.innerHTML = headerHTML + onlineHTML;
      } else if (activeTab === 'account') {
        pane.innerHTML = headerHTML + `
          <div style="background: #ffffff; border: 1px solid #D8E2C4; border-radius: 14px; padding: 24px; display: flex; flex-direction: column; gap: 20px;">
            <h4 style="margin: 0; font-family: 'Beautique Display', serif; font-size: 16px; color: #455120;">Chỉnh sửa tài khoản Học sinh</h4>
            
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <label style="font-size: 13px; font-weight: 600; color: #334155;">Họ và tên</label>
              <input id="edit-student-name" type="text" class="nh-form-input-clean" value="${escapeHtml(student.full_name ?? '')}" />
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px;">
              <label style="font-size: 13px; font-weight: 600; color: #334155;">Trạng thái tài khoản</label>
              <select id="edit-student-status" class="nh-form-input-clean" style="height: 40px;">
                <option value="active" ${student.status !== 'disabled' ? 'selected' : ''}>Hoạt động (Active)</option>
                <option value="disabled" ${student.status === 'disabled' ? 'selected' : ''}>Vô hiệu (Disabled)</option>
              </select>
            </div>

            <div style="display: flex; gap: 12px; margin-top: 8px; flex-wrap: wrap;">
              <button id="save-student-account-btn" type="button" class="nh-modal-btn-primary">Lưu thay đổi</button>
              <button id="reset-student-pwd-btn" type="button" class="nh-modal-btn-secondary">Khôi phục mật khẩu tạm</button>
              <button id="delete-student-account-btn" type="button" class="nh-modal-btn-secondary danger">Xóa tài khoản này</button>
            </div>
          </div>
        `;

        // Wire account actions
        pane.querySelector('#save-student-account-btn')?.addEventListener('click', async () => {
          const name = pane.querySelector('#edit-student-name')?.value;
          const status = pane.querySelector('#edit-student-status')?.value;
          try {
            await invokeAdminFunction('admin-update-user', {
              id: studentId,
              full_name: name,
              status,
              role: 'student',
            });
            student.full_name = name;
            student.status = status;
            toast('Đã cập nhật thông tin học sinh.', 'success');
            renderStudentSidebarList();
            renderStudentDetail(studentId);
          } catch (err) {
            toast(err.message, 'error');
          }
        });

        pane.querySelector('#reset-student-pwd-btn')?.addEventListener('click', async () => {
          const password = window.prompt('Mật khẩu tạm mới, bỏ trống để hệ thống đặt 123456:') || '123456';
          try {
            const result = await invokeAdminFunction('admin-reset-password', {
              id: studentId,
              password,
            });
            toast(`Mật khẩu tạm mới: ${result.temporaryPassword}`, 'success');
          } catch (err) {
            toast(err.message, 'error');
          }
        });

        pane.querySelector('#delete-student-account-btn')?.addEventListener('click', async () => {
          if (!window.confirm(`Xóa vĩnh viễn tài khoản của học sinh ${student.full_name}?`)) return;
          try {
            await deleteManagedUser(studentId);
            toast('Đã xóa học sinh.', 'success');
            mountProgressManager();
          } catch (err) {
            toast(err.message, 'error');
          }
        });
      }

      // Wire Tab Clicks
      pane.querySelectorAll('.nh-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeTab = btn.dataset.tab;
          renderStudentDetail(studentId);
        });
      });
    }

    function renderStudentSidebarList() {
      const listContainer = document.querySelector('.progress-sidebar-list');
      if (!listContainer) return;

      const onlineUsers = getOnlineUsers();
      const onlineSet = new Set(onlineUsers.map((u) => u.id));

      const searchVal = (document.querySelector('#student-search-input')?.value || '').toLowerCase().trim();
      const filtered = students.filter((s) => 
        (s.full_name || '').toLowerCase().includes(searchVal) || 
        (s.email || '').toLowerCase().includes(searchVal)
      );

      if (!filtered.length) {
        listContainer.innerHTML = `<div style="font-size: 13px; color: #94a3b8; padding: 12px 8px; text-align: center;">Không tìm thấy học sinh.</div>`;
        return;
      }

      listContainer.innerHTML = filtered.map((s) => {
        const isSelected = s.id === selectedStudentId;
        const isOnline = onlineSet.has(s.id);
        const initial = (s.full_name || 'U').charAt(0).toUpperCase();

        let subtext = 'Ngoại tuyến';
        if (isOnline) {
          subtext = 'Đang hoạt động';
        } else {
          const timeVal = s.updated_at || s.created_at;
          if (timeVal) {
            const diffSec = Math.floor((Date.now() - new Date(timeVal).getTime()) / 1000);
            if (diffSec < 60) subtext = 'Vừa xong';
            else {
              const diffMin = Math.floor(diffSec / 60);
              if (diffMin < 60) subtext = `${diffMin}p trước`;
              else {
                const diffHours = Math.floor(diffMin / 60);
                if (diffHours < 24) subtext = `${diffHours}h trước`;
                else subtext = `${Math.floor(diffHours / 24)}d trước`;
              }
            }
          }
        }

        return `
          <div class="progress-sidebar-item ${isSelected ? 'selected' : ''}" data-sid="${s.id}" style="padding: 8px 12px;">
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
              <div style="position: relative; flex-shrink: 0;">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: ${isSelected ? '#455120' : '#cbd5e1'}; color: #ffffff; font-size: 13px; font-weight: 600; display: grid; place-items: center;">
                  ${escapeHtml(initial)}
                </div>
                ${isOnline ? '<span style="position: absolute; bottom: 0; right: 0; width: 9px; height: 9px; border-radius: 50%; background: #22c55e; border: 1.5px solid #ffffff;" title="Đang hoạt động"></span>' : ''}
              </div>
              <div style="display: flex; flex-direction: column; min-width: 0; flex: 1;">
                <span style="font-size: 13.5px; font-weight: ${isSelected ? '700' : '600'}; color: ${isSelected ? '#455120' : '#334155'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${escapeHtml(s.full_name || 'Học sinh')}
                </span>
                <span style="font-size: 11px; font-weight: 500; color: ${isOnline ? '#16a34a' : '#94a3b8'};">
                  ${subtext}
                </span>
              </div>
            </div>
            ${s.status === 'disabled' ? '<span style="font-size: 10px; background: #fee2e2; color: #ef4444; padding: 1px 6px; border-radius: 9999px;">Tắt</span>' : ''}
          </div>
        `;
      }).join('');

      listContainer.querySelectorAll('.progress-sidebar-item').forEach((item) => {
        item.addEventListener('click', () => {
          selectedStudentId = item.dataset.sid;
          renderStudentSidebarList();
          renderStudentDetail(selectedStudentId);
        });
      });
    }

    // Wire Search Input
    document.querySelector('#student-search-input')?.addEventListener('input', () => {
      renderStudentSidebarList();
    });

    // Wire Create Student Modal
    const createModal = root.querySelector('#nh-create-student-modal');
    root.querySelector('#nh-add-student-trigger')?.addEventListener('click', () => { createModal.style.display = 'flex'; });
    root.querySelector('#nh-close-create-modal')?.addEventListener('click', () => { createModal.style.display = 'none'; });
    createModal?.addEventListener('click', (e) => { if (e.target === createModal) createModal.style.display = 'none'; });

    root.querySelector('#create-student-form-modal')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const submitBtn = form.querySelector('button[type="submit"]');
      const restore = setButtonLoading(submitBtn, 'Đang tạo...');
      const values = Object.fromEntries(new FormData(form).entries());
      try {
        await createManagedUser({ ...values, role: 'student' });
        toast('Đã tạo tài khoản học sinh mới thành công.', 'success');
        createModal.style.display = 'none';
        mountProgressManager();
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        restore();
      }
    });

    // Initial render
    renderStudentSidebarList();
    renderStudentDetail(selectedStudentId);

  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
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

document.addEventListener('click', (e) => {
    const lockedChip = e.target.closest('[data-pdf-locked="true"], .locked-pdf-chip');
    if (lockedChip) {
      e.preventDefault();
      e.stopPropagation();
      toast('Hiện tại toàn bộ bài tập dùng link PDF đã đóng truy cập', 'error');
    }
  });

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
addRoute('countdown', () => {
  window.location.hash = '#/learn';
});
addRoute('settings', () => import('./pages/Settings.js').then(m => m.mountSettings()));
addRoute('review/:id', (id) => mountReview(id));
addRoute('dashboard', () => import('./student.js').then(m => m.mountDashboard()));
addRoute('manage', () => import('./admin.js').then(m => m.mountManageHub()));
addRoute('progress', mountProgressManager);
addRoute('content', () => import('./admin.js').then(m => m.mountContentManager()));
addRoute('assignments', () => import('./admin.js').then(m => m.mountAssignmentManager()));
addRoute('students', mountProgressManager);
addRoute('online', () => import('./admin.js').then(m => m.mountOnlineUsers()));
addRoute('grades', () => isManager() ? mountProgressManager() : import('./student.js').then(m => m.mountStudentGrades()));
addRoute('salary', () => import('./admin.js').then(m => m.mountSalaryManager()));

initSessionTracker();
bootstrap();

// Exported for lazy loaded modules
export {
  state,
  pageRoot,
  wireRouteRetry,
  escapeHtml,
  isManager,
  renderAttemptsTable,
  driveFrame,
  render,
  isAdmin,
  daysUntilExam,
  setThemeMode,
  setColorTheme,
  APP_VERSION,
  APP_LAST_UPDATE
};
