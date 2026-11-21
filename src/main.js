import './styles.css';
import {
  APP_LAST_UPDATE,
  APP_VERSION,
  applyTheme,
  daysUntilExam,
  isAdmin,
  isManager,
  pageRoot,
  setColorTheme,
  setThemeMode,
  state,
} from './store.js';
import { addRoute, go, mountCurrentRoute, wireRouteRetry } from './router.js';
import { accountInitial, renderLoading, toast } from './lib/ui.js';
import { escapeHtml } from './lib/html.js';
import { driveFrame } from './lib/drive.js';
import { initSessionTracker } from './lib/sessionTracker.js';
import { hasSupabaseConfig, supabase } from './services/supabaseClient.js';
import { getCurrentProfile, getSession, initPresence, signOut } from './services/lmsApi.js';
import { renderAuth } from './pages/Auth.js';

const app = document.querySelector('#app');
let renderGeneration = 0;

applyTheme();

function renderShell() {
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

async function render() {
  const generation = ++renderGeneration;
  if (!hasSupabaseConfig || state.passwordRecovery || !state.session || !state.profile) {
    renderAuth();
    return;
  }
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
      } else if (state.profile) {
        state.profile = null;
        render();
      }
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  window.addEventListener('hashchange', renderRouteTransition);
  render();
}

// Student routes
addRoute('learn', () => import('./pages/student/Learn.js').then((m) => m.mountLearn()));
addRoute('phase/:id', (id) => import('./pages/student/Learn.js').then((m) => m.mountPhaseDetail(id)));
addRoute('assignment/:id', (id) => import('./pages/student/Exam.js').then((m) => m.mountAssignment(id)));
addRoute('review/:id', (id) => import('./pages/student/Exam.js').then((m) => m.mountReview(id)));
addRoute('grades', () =>
  isManager()
    ? import('./pages/admin/Students.js').then((m) => m.mountProgressManager())
    : import('./pages/student/Grades.js').then((m) => m.mountStudentGrades()),
);
addRoute('countdown', () => go('learn'));
addRoute('settings', () => import('./pages/Settings.js').then((m) => m.mountSettings()));

// Admin / Teacher routes
addRoute('manage', () => import('./pages/admin/ManageHub.js').then((m) => m.mountManageHub()));
addRoute('dashboard', () => import('./pages/admin/Students.js').then((m) => m.mountDashboard()));
addRoute('students', () => import('./pages/admin/Students.js').then((m) => m.mountProgressManager()));
addRoute('progress', () => import('./pages/admin/Students.js').then((m) => m.mountProgressManager()));
addRoute('online', () => import('./pages/admin/Students.js').then((m) => m.mountOnlineUsers()));
addRoute('content', () => import('./pages/admin/Courses.js').then((m) => m.mountContentManager()));
addRoute('assignments', () => import('./pages/admin/Assignments.js').then((m) => m.mountAssignmentManager()));
addRoute('salary', () => import('./pages/admin/Salary.js').then((m) => m.mountSalaryManager()));
addRoute('question-bank', () => import('./pages/admin/QuestionBank.js').then((m) => m.mountQuestionBank(pageRoot())));

initSessionTracker();
bootstrap();

export {
  state,
  pageRoot,
  wireRouteRetry,
  escapeHtml,
  isManager,
  driveFrame,
  render,
  isAdmin,
  daysUntilExam,
  setThemeMode,
  setColorTheme,
  APP_VERSION,
  APP_LAST_UPDATE,
};
