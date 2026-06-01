import '@material/web/button/filled-button.js';
import '@material/web/button/filled-tonal-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/icon/icon.js';
import '@material/web/progress/circular-progress.js';
import '@material/web/textfield/outlined-text-field.js';
import './styles.css';
import { hasSupabaseConfig, supabase } from './services/supabaseClient.js';
import {
  deleteAssignment,
  deleteLecture,
  deleteModule,
  deletePhase,
  createManagedUser,
  fetchAssignmentEditor,
  fetchAssignmentForStudent,
  fetchAssignmentsForManager,
  fetchAttemptReview,
  fetchDashboardStats,
  fetchGradebook,
  fetchLearningPath,
  fetchMyHistory,
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
  upsertModule,
  upsertPhase,
} from './services/lmsApi.js';
import { clearDraft, loadDraft, saveDraft } from './lib/draft.js';
import { toDrivePreviewUrl } from './lib/drive.js';
import { formatDateTime, formatScore, roleLabel } from './lib/format.js';
import { escapeHtml, option, setButtonLoading } from './lib/html.js';

const app = document.querySelector('#app');
const toastEl = document.querySelector('#toast');

const state = {
  session: null,
  profile: null,
  authMode: 'login',
  assignmentEditor: null,
};

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

function pageRoot() {
  return document.querySelector('#page-root');
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
  ];

  if (!isManager()) return base;

  return [
    ...base,
    { path: 'dashboard', icon: 'analytics', label: 'Thống kê' },
    { path: 'content', icon: 'view_list', label: 'Nội dung' },
    { path: 'assignments', icon: 'assignment', label: 'Đề thi' },
    { path: 'students', icon: 'groups', label: 'Học sinh' },
    { path: 'grades', icon: 'grade', label: 'Bảng điểm' },
  ];
}

function renderShell() {
  const current = route().name;
  app.innerHTML = `
    <div class="app-shell">
      <aside class="rail" aria-label="Điều hướng">
        <a class="brand" href="#/learn" aria-label="Canvas">
          <span class="brand-mark">C</span>
          <div class="brand-text">
            <span class="brand-copy">Canvas</span>
            <span class="brand-subtitle">Hướng tới kì thi THPTQG 2027</span>
          </div>
        </a>
        <nav class="nav-list">
          ${navItems()
            .map(
              (item) => `
                <a class="nav-item ${current === item.path ? 'active' : ''}" href="#/${item.path}">
                  <md-icon>${item.icon}</md-icon>
                  <span>${item.label}</span>
                </a>
              `,
            )
            .join('')}
        </nav>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div>
            <p class="eyebrow">${escapeHtml(roleLabel(state.profile.role))}</p>
            <h1 class="page-title ${current === 'learn' ? 'learn-title' : ''}">${pageTitle(current)}</h1>
          </div>
          <div class="account-strip">
            <span>${escapeHtml(state.profile.full_name || state.profile.email)}</span>
            <md-outlined-button id="logout-button">
              <md-icon slot="icon">logout</md-icon>
              Thoát
            </md-outlined-button>
          </div>
        </header>
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
      learn: 'Lộ trình luyện thi 2027',
      history: 'Lịch sử học tập',
      assignment: 'Làm bài',
      review: 'Xem lại bài',
      dashboard: 'Thống kê',
      content: 'Quản lý nội dung',
      assignments: 'Quản lý đề thi',
      students: 'Quản lý học sinh',
      grades: 'Bảng điểm',
    }[name] ?? 'Lộ trình luyện thi 2027'
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
        <div class="path-list">
          ${data.phases.length ? data.phases.map(renderPhase).join('') : '<div class="empty-state">Chưa có lộ trình học.</div>'}
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
  return `
    <article class="module-block">
      <div class="module-title">
        <md-icon>folder_open</md-icon>
        <h3>${escapeHtml(module.title)}</h3>
      </div>
      <div class="lecture-list">
        ${
          module.lectures.length
            ? module.lectures.map(renderLecture).join('')
            : '<div class="empty-state compact">Chưa có bài giảng.</div>'
        }
      </div>
    </article>
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
  return `
    <a class="assignment-chip" href="#/assignment/${assignment.id}">
      <md-icon>quiz</md-icon>
      <span>${escapeHtml(assignment.title)}</span>
    </a>
  `;
}

async function mountAssignment(id) {
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
    wireAnswerAutosave(id);
  } catch (error) {
    root.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
  }
}

function renderQuestionInput(question, index, answer) {
  const choices = Array.isArray(question.choices) && question.choices.length ? question.choices : ['A', 'B', 'C', 'D'];
  const settings = question.settings ?? {};
  const prompt = `
    <div class="question-prompt">
      <span>Câu ${index + 1}</span>
      <p>${escapeHtml(question.prompt)}</p>
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
                    <span>${value}. ${escapeHtml(choice)}</span>
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
        studentId: state.profile.id,
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
      <section class="panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Kết quả</p>
            <h2>${escapeHtml(review.assignment?.title ?? 'Bài làm')}</h2>
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
                    <h3>${escapeHtml(item.prompt)}</h3>
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
      <section class="manager-grid">
        ${renderPhaseForm()}
        ${renderModuleForm(data.phases)}
        ${renderLectureForm(data.modules)}
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
    <form class="panel entity-form" data-entity="phase">
      <div class="panel-heading"><h2>Giai đoạn</h2></div>
      <input type="hidden" name="id">
      <input class="field" name="title" placeholder="Tên giai đoạn" required>
      <textarea class="field" name="description" placeholder="Mô tả"></textarea>
      <input class="field" name="sort_order" type="number" value="0" placeholder="Thứ tự">
      <label class="switch-row"><input type="checkbox" name="published" checked> Publish</label>
      <div class="button-row">
        <md-filled-button type="submit"><md-icon slot="icon">save</md-icon>Lưu</md-filled-button>
        <md-outlined-button type="reset">Mới</md-outlined-button>
      </div>
    </form>
  `;
}

function renderModuleForm(phases) {
  return `
    <form class="panel entity-form" data-entity="module">
      <div class="panel-heading"><h2>Chuyên đề</h2></div>
      <input type="hidden" name="id">
      <select class="field" name="phase_id" required>
        <option value="">Chọn giai đoạn</option>
        ${phases.map((phase) => option(phase.id, phase.title)).join('')}
      </select>
      <input class="field" name="title" placeholder="Tên chuyên đề" required>
      <textarea class="field" name="description" placeholder="Mô tả"></textarea>
      <input class="field" name="sort_order" type="number" value="0" placeholder="Thứ tự">
      <label class="switch-row"><input type="checkbox" name="published" checked> Publish</label>
      <div class="button-row">
        <md-filled-button type="submit"><md-icon slot="icon">save</md-icon>Lưu</md-filled-button>
        <md-outlined-button type="reset">Mới</md-outlined-button>
      </div>
    </form>
  `;
}

function renderLectureForm(modules) {
  return `
    <form class="panel entity-form" data-entity="lecture">
      <div class="panel-heading"><h2>Bài giảng</h2></div>
      <input type="hidden" name="id">
      <select class="field" name="module_id" required>
        <option value="">Chọn chuyên đề</option>
        ${modules.map((module) => option(module.id, module.title)).join('')}
      </select>
      <input class="field" name="title" placeholder="Tên bài giảng" required>
      <textarea class="field" name="description" placeholder="Mô tả"></textarea>
      <input class="field" name="slide_url" placeholder="Link Google Drive slide">
      <input class="field" name="sort_order" type="number" value="0" placeholder="Thứ tự">
      <label class="switch-row"><input type="checkbox" name="published" checked> Publish</label>
      <div class="button-row">
        <md-filled-button type="submit"><md-icon slot="icon">save</md-icon>Lưu</md-filled-button>
        <md-outlined-button type="reset">Mới</md-outlined-button>
      </div>
    </form>
  `;
}

function renderManagePhase(phase) {
  return `
    <div class="manage-node">
      <div>
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
          <div class="manage-node child">
            <div>
              <strong>${escapeHtml(module.title)}</strong>
              <span>${module.lectures.length} bài giảng</span>
            </div>
            <div class="icon-actions">
              <button data-edit-module="${module.id}" data-payload="${escapeHtml(JSON.stringify(module))}" aria-label="Sửa chuyên đề"><md-icon>edit</md-icon></button>
              <button data-delete-module="${module.id}" aria-label="Xóa chuyên đề"><md-icon>delete</md-icon></button>
            </div>
          </div>
          ${module.lectures
            .map(
              (lecture) => `
                <div class="manage-node grandchild">
                  <div>
                    <strong>${escapeHtml(lecture.title)}</strong>
                    <span>${lecture.published ? 'Published' : 'Draft'}</span>
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
        published: form.querySelector('[name="published"]').checked,
        owner_id: state.profile.id,
      };
      const restore = setButtonLoading(form.querySelector('md-filled-button'));
      try {
        if (form.dataset.entity === 'phase') await upsertPhase(payload);
        if (form.dataset.entity === 'module') await upsertModule(payload);
        if (form.dataset.entity === 'lecture') await upsertLecture(payload);
        toast('Đã lưu nội dung.', 'success');
        await mountContentManager();
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        restore();
      }
    });
  });

  document.querySelectorAll('[data-payload]').forEach((button) => {
    button.addEventListener('click', () => {
      const payload = JSON.parse(button.dataset.payload);
      const kind = button.dataset.editPhase ? 'phase' : button.dataset.editModule ? 'module' : 'lecture';
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

  document.querySelectorAll('[data-delete-phase],[data-delete-module],[data-delete-lecture]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Xóa mục này?')) return;
      try {
        if (button.dataset.deletePhase) await deletePhase(button.dataset.deletePhase);
        if (button.dataset.deleteModule) await deleteModule(button.dataset.deleteModule);
        if (button.dataset.deleteLecture) await deleteLecture(button.dataset.deleteLecture);
        toast('Đã xóa.', 'success');
        await mountContentManager();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
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
    <div class="panel-heading">
      <h2>${assignment.id ? 'Chỉnh sửa đề' : 'Tạo đề mới'}</h2>
      <div class="button-row">
        ${assignment.id ? '<md-outlined-button id="delete-assignment" type="button"><md-icon slot="icon">delete</md-icon>Xóa</md-outlined-button>' : ''}
        <md-filled-button type="submit"><md-icon slot="icon">save</md-icon>Lưu đề</md-filled-button>
      </div>
    </div>
    <input type="hidden" name="id" value="${escapeHtml(assignment.id ?? '')}">
    <div class="form-grid two">
      <input class="field" name="title" value="${escapeHtml(assignment.title)}" placeholder="Tên đề thi / BTVN" required>
      <select class="field" name="lecture_id">
        <option value="">Bài tập tự do</option>
        ${lectures.map((lecture) => option(lecture.id, lecture.title, assignment.lecture_id)).join('')}
      </select>
      <input class="field" name="pdf_url" value="${escapeHtml(assignment.pdf_url)}" placeholder="Link PDF Google Drive" required>
      <input class="field" name="sort_order" type="number" value="${Number(assignment.sort_order ?? 0)}" placeholder="Thứ tự">
    </div>
    <textarea class="field" name="description" placeholder="Mô tả">${escapeHtml(assignment.description ?? '')}</textarea>
    <label class="switch-row"><input type="checkbox" name="published" ${assignment.published ? 'checked' : ''}> Publish</label>
    <div class="question-builder-header">
      <h3>Phiếu trả lời</h3>
      <div class="button-row">
        <md-outlined-button type="button" data-add-question="mcq"><md-icon slot="icon">radio_button_checked</md-icon>Trắc nghiệm</md-outlined-button>
        <md-outlined-button type="button" data-add-question="tf4"><md-icon slot="icon">fact_check</md-icon>Đúng/Sai</md-outlined-button>
        <md-outlined-button type="button" data-add-question="short"><md-icon slot="icon">short_text</md-icon>Điền ngắn</md-outlined-button>
      </div>
    </div>
    <div class="question-builder">
      ${questions.map((question, index) => renderQuestionEditor(question, index)).join('')}
    </div>
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
      <textarea class="field" name="question-prompt-${index}" placeholder="Nội dung câu hỏi" required>${escapeHtml(question.prompt ?? '')}</textarea>
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

  const choices = question.choices?.length ? question.choices : ['A', 'B', 'C', 'D'];
  return `
    <div class="form-grid two">
      ${[0, 1, 2, 3]
        .map(
          (choiceIndex) => `
            <input class="field" name="choice-${index}-${choiceIndex}" value="${escapeHtml(choices[choiceIndex] ?? '')}" placeholder="Đáp án ${String.fromCharCode(65 + choiceIndex)}">
          `,
        )
        .join('')}
    </div>
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
    choices: ['A', 'B', 'C', 'D'],
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
      prompt: values[`question-prompt-${index}`],
      points: Number(values[`question-points-${index}`] || 0),
      sort_order: Number(values[`question-sort-${index}`] || index + 1),
      choices: [],
      settings: {},
      answer_key: {},
    };

    if (type === 'mcq') {
      base.choices = [0, 1, 2, 3].map((item) => values[`choice-${index}-${item}`] || String.fromCharCode(65 + item));
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
      published: form.querySelector('[name="published"]').checked,
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
        await invokeAdminFunction('admin-delete-user', { id: button.dataset.deleteStudent });
        toast('Đã xóa học sinh.', 'success');
        await mountStudents();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
}

async function mountGrades() {
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
  if (!isManager() && ['dashboard', 'content', 'assignments', 'students', 'grades'].includes(current.name)) {
    go('learn');
    return;
  }

  if (current.name === 'assignment') return mountAssignment(current.id);
  if (current.name === 'history') return mountHistory();
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
    state.session = session;
    state.profile = session ? await getCurrentProfile() : null;
    render();
  });

  window.addEventListener('hashchange', render);
  render();
}

bootstrap();
