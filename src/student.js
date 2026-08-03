// student.js - Lazy loaded module for student routes
import { formatDateTime, formatScore } from "./lib/format.js";
import { setButtonLoading, option } from "./lib/html.js";
import {
  fetchLearningPath, fetchDashboardStats, fetchGradebook, fetchMyHistory,
  fetchStudents, fetchTeachingLogs, invokeAdminFunction, createManagedUser, deleteManagedUser,
  fetchAssignmentsForManager
} from "./services/lmsApi.js";
import { state, pageRoot, escapeHtml, isManager, driveFrame, wireRouteRetry } from './main.js';
import { renderLoading, renderErrorState, toast, renderAccountAvatar, renderSkeletonDashboard, renderStateMessage, renderScoreProgress } from './lib/ui.js';

let selectedStudentId = null;

export async function mountLearn() {
  const root = pageRoot();
  root.innerHTML = renderLoading();
  try {
    const data = await fetchLearningPath(state.profile.role);
    let taughtSet = new Set();
    if (state.profile.role === 'student') {
      const teachingLogs = await fetchTeachingLogs(state.profile.id);
      taughtSet = new Set(teachingLogs.map((l) => l.lecture_id));
    }

    const phases = data.phases || [];

    root.innerHTML = `
      <section class="nh-body-container">
        <!-- Sidebar -->
        <aside class="nh-sidebar">
          <div class="nh-sidebar-header-pill">
            <div class="nh-header-icon-circle">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M11.293 2.293a1 1 0 0 1 1.414 0l8 8A1 1 0 0 1 20 12h-1v7a2 2 0 0 1-2 2h-3a1 1 0 0 1-1-1v-4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v4a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2v-7H2a1 1 0 0 1-.707-1.707l8-8z"/>
              </svg>
            </div>
            <span class="nh-header-pill-title">Trang chủ</span>
          </div>

          <hr class="nh-sidebar-divider" />

          <div class="nh-sidebar-menu" id="nh-category-menu">
            <span class="nh-sidebar-item active" data-filter="all">Tất cả khóa học</span>
            <span class="nh-sidebar-item" data-filter="free">Bài tập tự do</span>
          </div>

          <!-- Lịch thi Widget -->
          <div class="nh-countdown-widget">
            <div style="display: flex; align-items: center; gap: 6px; font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 15px; font-weight: 700; margin-bottom: 6px; line-height: 1;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-flex; align-items: center; justify-content: center; transform: translateY(-1px);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <span style="line-height: 1; display: inline-block;">Lịch thi</span>
            </div>
            <div style="font-size: 26px; font-weight: 900; letter-spacing: -0.5px; margin-top: 4px; display: flex; align-items: baseline; gap: 6px;">
              ${Math.max(0, Math.ceil((new Date(2027, 5, 11) - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000))}
              <span style="font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 13px; font-weight: 700; opacity: 0.95;">ngày nữa</span>
            </div>
            <p style="font-size: 11px; margin: 4px 0 0; opacity: 0.88; font-family: 'Be Vietnam Pro', sans-serif;">Đếm ngược kỳ thi THPTQG 2027</p>
          </div>

          ${isManager() ? `
            <!-- Admin Shortcut Card -->
            <div class="nh-admin-shortcut-card">
              <div class="nh-admin-card-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                  <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                  <rect x="14" y="14" width="7" height="7" rx="1"></rect>
                  <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                </svg>
                <span>Quản trị hệ thống</span>
              </div>
              <p class="nh-admin-card-desc">Quản lý bài giảng, nội dung khóa học & học sinh</p>
              <a href="#/manage" class="nh-admin-shortcut-btn">
                Vào trang quản lý
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </a>
            </div>
          ` : ''}
        </aside>

        <!-- Main Content Area -->
        <main class="nh-main-content">
          <div class="nh-course-grid" id="nh-course-grid">
            ${phases.length
        ? phases.map((p, idx) => renderPhaseCard(p, idx, taughtSet)).join('')
        : renderStateMessage({
          title: 'Chưa có lộ trình học',
          message: isManager() ? 'Tạo giai đoạn đầu tiên để học sinh nhìn thấy kế hoạch học.' : 'Giáo viên chưa mở nội dung cho lớp này.',
          actionHref: isManager() ? '#/content' : '',
          actionLabel: isManager() ? 'Tạo lộ trình' : '',
          actionIcon: 'add',
        })
      }
          </div>

          ${data.freeAssignments && data.freeAssignments.length
        ? `
                <section class="panel nh-free-assignments" style="margin-top: 24px;">
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
        </main>
      </section>
    `;

    // Category Filter Interaction
    const filterItems = root.querySelectorAll('.nh-sidebar-item');
    filterItems.forEach(item => {
      item.addEventListener('click', () => {
        filterItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const filter = item.dataset.filter;

        const grid = root.querySelector('#nh-course-grid');
        const freeSection = root.querySelector('.nh-free-assignments');

        if (filter === 'all') {
          if (grid) grid.style.display = 'grid';
          if (freeSection) freeSection.style.display = 'block';
        } else if (filter === 'free') {
          if (grid) grid.style.display = 'none';
          if (freeSection) freeSection.style.display = 'block';
        }
      });
    });

  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

export async function mountPhaseDetail(id) {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang mở giai đoạn');
  try {
    const data = await fetchLearningPath(state.profile.role);
    const phase = data.phases.find((item) => item.id === id);
    if (!phase) {
      root.innerHTML = '<div class="empty-state">Không tìm thấy giai đoạn.</div>';
      return;
    }

    let taughtSet = new Set();
    let taughtMap = new Map();
    let taughtCount = 0;
    let totalLectures = 0;
    let totalAssignments = 0;
    let completedAssignments = 0;
    let firstUnfinishedLecture = null;
    let recentActivity = null; // { lecture, assignment } — most recently worked assignment

    if (state.profile.role === 'student') {
      const teachingLogs = await fetchTeachingLogs(state.profile.id);
      taughtSet = new Set(teachingLogs.map((l) => l.lecture_id));
      taughtMap = new Map(teachingLogs.map((l) => [l.lecture_id, l]));

      // Build a lookup map: lectureId -> lecture object, for finding recentActivity
      const lectureById = new Map();
      phase.modules.forEach(mod => mod.lectures.forEach(l => lectureById.set(l.id, l)));

      // Teaching logs are ordered desc by taught_at — walk through to find most recent
      // lecture (in this phase) that has at least one assignment
      for (const log of teachingLogs) {
        const lec = lectureById.get(log.lecture_id);
        if (lec && lec.assignments && lec.assignments.length > 0) {
          // Find the most recently submitted assignment, or just first one
          const submitted = lec.assignments.find(a => a.progress?.status === 'submitted');
          recentActivity = { lecture: lec, assignment: submitted || lec.assignments[0], log };
          break;
        }
      }
    }

    phase.modules.forEach(mod => {
      mod.lectures.forEach(l => {
        totalLectures++;
        if (taughtSet.has(l.id)) {
          taughtCount++;
        } else if (!firstUnfinishedLecture) {
          firstUnfinishedLecture = l;
        }
        if (l.assignments) {
          l.assignments.forEach(a => {
            totalAssignments++;
            if (a.progress?.status === 'submitted') completedAssignments++;
          });
        }
      });
    });

    let recentStepIndex = 1;
    let recentGroupTitle = '';
    if (recentActivity) {
      let found = false;
      for (const mod of phase.modules) {
        let idx = 0;
        if (mod.lecture_groups && mod.lecture_groups.length > 0) {
          for (const group of mod.lecture_groups) {
            for (const l of (group.lectures || [])) {
              idx++;
              if (l.id === recentActivity.lecture.id) {
                recentStepIndex = idx;
                recentGroupTitle = group.title || '';
                found = true;
                break;
              }
            }
            if (found) break;
          }
        } else {
          for (const l of mod.lectures) {
            idx++;
            if (l.id === recentActivity.lecture.id) {
              recentStepIndex = idx;
              recentGroupTitle = '';
              found = true;
              break;
            }
          }
        }
        if (found) break;
      }
    }

    root.innerHTML = `
      <div style="background: #EDF2E4; min-height: calc(100vh - 64px); padding: 24px max(var(--page-gutter), 24px);">
        <div class="nh-course-detail-container">
          <!-- Breadcrumb & Header Hero Card -->
          <div class="nh-course-hero-card">
            <div class="nh-breadcrumb">
              <a href="#/learn">Lộ trình học tập</a>
              <span>/</span>
              <span>${escapeHtml(phase.title)}</span>
            </div>

            <div class="nh-course-title-row">
              <div>
                <h1 class="nh-course-main-title">${escapeHtml(phase.title)}</h1>
                ${phase.description ? `<p style="margin: 6px 0 0 0; font-size: 13px; color: #667085; font-family: 'Be Vietnam Pro', sans-serif;">${escapeHtml(phase.description)}</p>` : ''}
              </div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="background: #F0F4E8; color: #455120; font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 13px; font-weight: 700; padding: 6px 14px; border-radius: 9999px; border: 1px solid #D8E2CA; display: inline-flex; align-items: center; gap: 4px;">
                  <md-icon style="font-size: 16px;">article</md-icon>
                  Đã học: ${taughtCount}/${totalLectures} bài
                </span>
                ${totalAssignments > 0 ? `
                  <span style="background: #F0F4E8; color: #455120; font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 13px; font-weight: 700; padding: 6px 14px; border-radius: 9999px; border: 1px solid #D8E2CA; display: inline-flex; align-items: center; gap: 4px;">
                    <md-icon style="font-size: 16px;">edit_note</md-icon>
                    Bài tập: ${completedAssignments}/${totalAssignments}
                  </span>
                ` : ''}
              </div>
            </div>

            <!-- Bài học gần đây — render nguyên ô bài học gốc -->
            ${recentActivity ? `
              <div class="nh-recent-activity-section">
                <h2 class="nh-recent-activity-label">Bài học gần đây</h2>
                <div class="nh-recent-activity-wrapper" style="background: #ffffff; border: 1px solid #D8E2C4; border-radius: 14px; padding: 4px 12px; box-shadow: 0 2px 10px rgba(69, 81, 32, 0.03);">
                  ${renderLectureNode(recentActivity.lecture, recentStepIndex, taughtSet, taughtMap, recentGroupTitle)}
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Course Search & Filter Bar -->
          <div style="background: #ffffff; border-radius: 18px; padding: 20px 24px; border: 1px solid #D8E2C4; box-shadow: 0 4px 14px rgba(69, 81, 32, 0.03);">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;">
              <strong style="font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 17px; font-weight: 700; color: #455120; white-space: nowrap;">Danh sách bài học</strong>
              <div style="position: relative; flex: 1; max-width: 420px; min-width: 280px; margin-left: auto;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#667085" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); pointer-events: none;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" id="nh-course-search-input" class="nh-course-search-input" placeholder="Tìm kiếm Bài giảng - Bài tập tại đây" />
              </div>
            </div>

            <div class="module-stack phase-module-stack">
              ${phase.modules.length
        ? phase.modules.map(m => renderModule(m, taughtSet, taughtMap)).join('')
        : '<div class="empty-state compact">Chưa có Chương.</div>'
      }
            </div>
          </div>
        </div>
      </div>
    `;
    wireAnimatedDetails(root);

    // Wire live in-course search
    const searchInput = root.querySelector('#nh-course-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        root.querySelectorAll('.lecture-row').forEach((row) => {
          const text = row.textContent.toLowerCase();
          const match = text.includes(query);
          row.style.display = match ? '' : 'none';
          if (match) {
            const parentDetails = row.closest('details');
            if (parentDetails) parentDetails.open = true;
          }
        });
      });
    }
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

export function wireAnimatedDetails(root) {
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

const CARO_GRID_PATTERN = {
  pattern: 'linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)',
  size: '16px 16px'
};

export function renderPhaseCard(phase, idx = 0, taughtSet = new Set()) {
  const lectureCount = phase.modules.reduce((sum, module) => sum + module.lectures.length, 0);
  const groupCount = phase.modules.reduce((sum, module) => sum + (module.lecture_groups?.length || 0), 0);
  const assignmentCount = phase.modules.reduce(
    (sum, module) => sum + module.lectures.reduce((total, lecture) => total + (lecture.assignments?.length || 0), 0),
    0,
  );

  const title = phase.title || 'Giai đoạn học tập';

  return `
    <a class="nh-course-card" href="#/phase/${phase.id}">
      <div class="nh-card-banner" style="background-color: #455120; background-image: ${CARO_GRID_PATTERN.pattern}; background-size: ${CARO_GRID_PATTERN.size};">
      </div>

      <div class="nh-card-body">
        <h3 class="nh-card-title">${escapeHtml(title)}</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; font-size: 13px; color: #475467; margin-bottom: 4px;">
          <span style="display: flex; align-items: center; gap: 6px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>${phase.modules.length} Chương</span>
          <span style="display: flex; align-items: center; gap: 6px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>${lectureCount} Bài giảng</span>
          <span style="display: flex; align-items: center; gap: 6px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>${groupCount} Bài học</span>
          <span style="display: flex; align-items: center; gap: 6px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>${assignmentCount} Bài tập</span>
        </div>

        <hr class="nh-card-dashed-line" />

        <div class="nh-card-footer">
          <span style="font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 14px; font-weight: 700; color: #455120; display: flex; align-items: center; gap: 4px;">
            Mở giai đoạn <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </span>
        </div>
      </div>
    </a>
  `;
}

export function renderPhase(phase) {
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
        ${phase.modules.length
      ? phase.modules.map(renderModule).join('')
      : '<div class="empty-state compact">Chưa có Chương.</div>'
    }
      </div>
    </section>
  `;
}


export function renderModule(module, taughtSet = new Set(), taughtMap = new Map()) {
  let taughtCount = 0;
  const total = module.lectures.length;
  let assignmentTotal = 0;

  module.lectures.forEach(l => {
    if (taughtSet.has(l.id)) taughtCount++;
    if (l.assignments) assignmentTotal += l.assignments.length;
  });

  const hasGroups = module.lecture_groups && module.lecture_groups.length > 0;
  const orphanLectures = module.lectures.filter(l => !l.group_id);

  let lectureIdx = 0;
  let lectureListHtml = '';

  if (hasGroups) {
    for (const group of module.lecture_groups) {
      const groupLectures = group.lectures ?? [];
      lectureListHtml += groupLectures.map(l => {
        lectureIdx++;
        return renderLectureNode(l, lectureIdx, taughtSet, taughtMap, group.title);
      }).join('');
    }
    orphanLectures.forEach(l => {
      lectureIdx++;
      lectureListHtml += renderLectureNode(l, lectureIdx, taughtSet, taughtMap, '');
    });
  } else {
    lectureListHtml = module.lectures.map((l, idx) =>
      renderLectureNode(l, idx + 1, taughtSet, taughtMap, '')
    ).join('');
  }

  return `
    <details class="nh-chapter-accordion" open>
      <summary class="nh-chapter-summary">
        <span class="nh-chapter-toggle-icon">
          <svg aria-hidden="true" viewBox="0 0 24 24" style="width:20px;height:20px;flex-shrink:0;">
            <path fill="currentColor" d="M6.41 6 5 7.41 9.58 12 5 16.59 6.41 18l6-6z"></path>
            <path fill="currentColor" d="m13 6-1.41 1.41L16.17 12l-4.58 4.59L13 18l6-6z"></path>
          </svg>
        </span>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
          <h3 class="nh-chapter-title">${escapeHtml(module.title)}</h3>
          <span class="nh-chapter-subtext">${total} Bài giảng${assignmentTotal > 0 ? ` / ${assignmentTotal} Bài tập` : ''}</span>
        </div>
        ${state.profile.role === 'student' ? `<span class="nh-chapter-progress-pill">${taughtCount}/${total}</span>` : ''}
      </summary>

      <div class="nh-ref-lecture-list">
        ${total || hasGroups
      ? lectureListHtml
      : '<div class="empty-state compact" style="padding: 16px;">Chưa có bài học trong Chương.</div>'
    }
      </div>
    </details>
  `;
}

export function renderLectureNode(lecture, stepIndex, taughtSet = new Set(), taughtMap = new Map(), moduleName = '') {
  const isTaught = taughtSet.has(lecture.id);
  const hasSlide = !!lecture.slide_url;
  const assignmentCount = lecture.assignments ? lecture.assignments.length : 0;
  const hasAssignments = assignmentCount > 0;
  const hasContent = hasSlide || hasAssignments || !!lecture.description;

  const metaParts = [];
  if (hasSlide) metaParts.push('1 Bài giảng');
  if (assignmentCount > 0) metaParts.push(`${assignmentCount} Bài tập`);
  if (metaParts.length === 0) metaParts.push('0 Bài giảng / 0 Bài tập');

  const metaText = metaParts.join(' / ');

  const badgeStatus = state.profile.role === 'student' && isTaught
    ? '<span class="nh-badge-taught">ĐÃ HỌC</span>'
    : '';

  const titleBlock = `
    <div class="nh-ref-title-stack">
      ${moduleName ? `<div class="nh-ref-module-label">${escapeHtml(moduleName)}</div>` : ''}
      <h4 class="nh-ref-title ${isTaught ? 'is-taught' : ''}">${escapeHtml(lecture.title)}</h4>
      <div class="nh-ref-submeta">${metaText}</div>
    </div>
  `;

  return `
    <div class="nh-ref-row lecture-row">
      <!-- Left: vertical line + number badge -->
      <div class="nh-ref-badge-col">
        <span class="nh-ref-num-badge ${isTaught ? 'completed' : ''}">${stepIndex}</span>
      </div>
      <!-- Right: content -->
      <div class="nh-ref-row-body">
        <details style="display: contents;">
          <summary class="nh-ref-summary" style="${hasContent ? '' : 'cursor: default;'}">
            <div class="nh-ref-row-main">
              ${titleBlock}
              <div class="nh-ref-badges">
                ${badgeStatus}
                <md-icon style="color: ${hasContent ? '#aaa' : '#ccc'}; font-size: 16px; ${hasContent ? '' : 'opacity: 0.4;'}">expand_more</md-icon>
              </div>
            </div>
          </summary>
          ${hasContent ? `
            <div class="nh-timeline-body">
              ${lecture.description ? `<p style="margin: 0 0 12px 0; font-size: 13px; color: #475467; font-family: 'Be Vietnam Pro', sans-serif;">${escapeHtml(lecture.description)}</p>` : ''}
              <div class="lecture-actions">
                ${driveFrame(lecture.slide_url, lecture.title)}
                ${hasAssignments
        ? `<div class="assignment-action-list">${lecture.assignments.map(renderAssignmentChip).join('')}</div>`
        : ''
      }
              </div>
            </div>
          ` : ''}
        </details>
      </div>
    </div>
  `;
}

export function renderAssignmentChip(assignment) {
  const hasSubmitted = assignment.progress?.status === 'submitted';
  const cleanedTitle = (assignment.title || '').replace(/Bài tập về nhà/gi, 'Bài tập');
  const isPdfAssignment = assignment.pdf_url && assignment.pdf_url !== 'latex';
  const isStudent = state.profile?.role === 'student';

  if (isStudent && isPdfAssignment) {
    return `
      <div class="assignment-action ${hasSubmitted ? 'completed' : 'pending'}">
        <a class="assignment-chip locked-pdf-chip" href="javascript:void(0)" data-pdf-locked="true" style="width: 100%; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
            <span>${escapeHtml(cleanedTitle)}</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </a>
      </div>
    `;
  }

  return `
    <div class="assignment-action ${hasSubmitted ? 'completed' : 'pending'}">
      <a class="assignment-chip" href="#/assignment/${assignment.id}" style="width: 100%; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <md-icon>edit_note</md-icon>
          <span>${escapeHtml(cleanedTitle)}</span>
        </div>
        <md-icon style="font-size: 1.1rem; color: #455120;">arrow_forward</md-icon>
      </a>
    </div>
  `;
}

export async function mountDashboard() {
  const root = pageRoot();
  root.innerHTML = renderSkeletonDashboard();
  try {
    const [students, allAttempts, allAssignments] = await Promise.all([
      fetchStudents(),
      fetchGradebook(),
      fetchAssignmentsForManager({ limit: 1000 }),
    ]);

    // Default to first student if none selected or selected student no longer exists
    if (!selectedStudentId || !students.some(s => s.id === selectedStudentId)) {
      selectedStudentId = students[0]?.id || null;
    }

    root.innerHTML = `
      <section class="student-tracker-layout" style="display: flex; flex-direction: column; gap: 20px;">
        <style>
          .add-student-details summary::-webkit-details-marker { display: none; }
          .add-student-details summary { list-style: none; }
          .student-sidebar-item:hover {
            background: var(--md-sys-color-surface-container-high) !important;
          }
        </style>

        <div style="display: flex; flex-wrap: wrap; gap: 24px; align-items: start;">
          
          <!-- Left Column (Sidebar): Student List & Add Form -->
          <div style="display: flex; flex-direction: column; gap: 16px; width: 320px; min-width: 320px; flex-shrink: 0;">
            
            <!-- Students List Panel -->
            <div class="panel" style="padding: 16px; border-radius: var(--md-sys-shape-corner-large, 16px); display: flex; flex-direction: column; gap: 12px; background: var(--md-sys-color-surface-container-low);">
              <h3 style="margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--md-sys-color-on-surface);">Danh sách học sinh</h3>
              <div class="students-sidebar-list" style="display: flex; flex-direction: column; gap: 8px;">
                <!-- Sidebar items populated by JS -->
              </div>
            </div>
          </div>

          <!-- Right Column (Main Panel): Detailed View of Selected Student -->
          <div class="student-details-pane panel" style="flex: 1; min-width: 320px; padding: 24px; border-radius: var(--md-sys-shape-corner-large, 16px); display: flex; flex-direction: column; gap: 24px; background: var(--md-sys-color-surface-container-low); min-height: 480px;">
            <!-- Details populated by JS -->
          </div>

        </div>
      </section>
    `;

    // Render left sidebar items
    function renderSidebarList(studentsList) {
      const listContainer = document.querySelector('.students-sidebar-list');
      if (!listContainer) return;
      listContainer.innerHTML = studentsList.map((student) => {
        const isSelected = student.id === selectedStudentId;
        return `
          <div class="student-sidebar-item" data-student-id="${student.id}" style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: var(--md-sys-shape-corner-medium, 12px); cursor: pointer; background: ${isSelected ? 'var(--md-sys-color-secondary-container)' : 'transparent'}; color: ${isSelected ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface)'}; transition: all 0.2s ease; border: 1px solid ${isSelected ? 'var(--md-sys-color-outline)' : 'transparent'};">
            ${renderAccountAvatar(student, 'account-avatar')}
            <div style="flex: 1; min-width: 0;">
              <h4 style="margin: 0; font-size: 0.9rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(student.full_name ?? '')}</h4>
              <p style="margin: 2px 0 0 0; font-size: 0.75rem; color: var(--md-sys-color-on-surface-variant); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(student.email ?? '')}</p>
            </div>
            ${student.status === 'disabled' ? `<span style="font-size: 0.7rem; background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); padding: 2px 6px; border-radius: 4px; font-weight: 500;">Khóa</span>` : ''}
          </div>
        `;
      }).join('') || '<div style="font-size: 0.85rem; color: var(--md-sys-color-outline); text-align: center; padding: 12px 0;">Chưa có học sinh nào.</div>';

      // Attach click listeners to sidebar items
      listContainer.querySelectorAll('.student-sidebar-item').forEach((item) => {
        item.addEventListener('click', () => {
          selectedStudentId = item.dataset.studentId;
          renderSidebarList(studentsList);
          renderStudentDetails(selectedStudentId, studentsList, allAttempts, allAssignments);
        });
      });
    }

    // Render detailed student view on the right
    function renderStudentDetails(studentId, studentsList, attempts, assignments = []) {
      const pane = document.querySelector('.student-details-pane');
      if (!pane) return;

      const student = studentsList.find((s) => s.id === studentId);
      if (!student) {
        pane.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 380px; color: var(--md-sys-color-outline); gap: 12px; text-align: center;">
            <md-icon style="font-size: 3.5rem;">supervised_user_circle</md-icon>
            <p style="margin: 0; font-weight: 500; font-size: 0.95rem;">Chọn một học sinh từ danh sách để xem chi tiết học tập</p>
          </div>
        `;
        return;
      }

      const studentAttempts = attempts.filter((a) => a.student_id === student.id);
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

      const attemptedAssignmentIds = new Set(studentAttempts.map(a => a.assignment_id));
      const uncompletedAssignments = assignments.filter(a => {
        if (attemptedAssignmentIds.has(a.id)) return false;

        let phaseStudentIds = null;
        if (a.lectures) {
          const l = Array.isArray(a.lectures) ? a.lectures[0] : a.lectures;
          if (l && l.modules) {
            const m = Array.isArray(l.modules) ? l.modules[0] : l.modules;
            if (m && m.phases) {
              const p = Array.isArray(m.phases) ? m.phases[0] : m.phases;
              if (p && p.student_ids) {
                phaseStudentIds = p.student_ids;
              }
            }
          }
        }

        if (phaseStudentIds && Array.isArray(phaseStudentIds) && phaseStudentIds.length > 0 && !phaseStudentIds.includes(studentId)) {
          return false;
        }

        return true;
      });
      const uncompletedListMarkup = uncompletedAssignments.map(a => `
        <div class="attempt-item-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--md-sys-color-outline-variant); font-size: 0.9rem;">
          <div style="display: flex; flex-direction: column; overflow: hidden; max-width: 80%;">
            <span style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(a.title ?? '-')}</span>
            <span style="font-size: 0.75rem; color: var(--md-sys-color-on-surface-variant);">${a.lectures?.title ? escapeHtml(a.lectures.title) : 'Chưa xếp nhóm'}</span>
          </div>
          <span style="font-size: 0.8rem; font-weight: 500; color: var(--md-sys-color-error);">Chưa làm</span>
        </div>
      `).join('');

      pane.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 24px; animation: panel-enter 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) both; width: 100%;">
          <!-- Top Profile Header -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; border-bottom: 1px solid var(--md-sys-color-outline-variant); padding-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 16px;">
              ${renderAccountAvatar(student, 'account-avatar large')}
              <div>
                <h2 style="margin: 0; font-size: 1.35rem; font-weight: 600; color: var(--md-sys-color-on-surface);">${escapeHtml(student.full_name ?? '')}</h2>
                <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: var(--md-sys-color-on-surface-variant);">${escapeHtml(student.email ?? '')}</p>
              </div>
            </div>
          </div>

          <!-- Key Metrics / Stats Cards -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; align-items: stretch;">
            <div style="background: var(--md-sys-color-surface-container-high); padding: 12px; border-radius: var(--md-sys-shape-corner-medium, 12px); display: flex; flex-direction: column; gap: 4px; border: 1px solid var(--md-sys-color-outline-variant); text-align: center; align-self: stretch; box-sizing: border-box;">
              <span style="font-size: 0.8rem; font-weight: 500; color: var(--md-sys-color-on-surface-variant); display: flex; align-items: center; justify-content: center; gap: 4px;"><md-icon style="font-size: 1.1rem;">assignment_turned_in</md-icon> Đã nộp</span>
              <div style="font-size: 1.3rem; font-weight: 700; color: var(--md-sys-color-on-surface); margin-top: 4px;">${totalSubmissions} bài</div>
            </div>
            <div style="background: var(--md-sys-color-surface-container-high); padding: 12px; border-radius: var(--md-sys-shape-corner-medium, 12px); display: flex; flex-direction: column; gap: 4px; border: 1px solid var(--md-sys-color-outline-variant); text-align: center; align-self: stretch; box-sizing: border-box;">
              <span style="font-size: 0.8rem; font-weight: 500; color: var(--md-sys-color-on-surface-variant); display: flex; align-items: center; justify-content: center; gap: 4px;"><md-icon style="font-size: 1.1rem; color: var(--md-sys-color-primary);">analytics</md-icon> Điểm TB</span>
              <div style="font-size: 1.3rem; font-weight: 700; color: var(--md-sys-color-primary); margin-top: 4px;">${formatScore(averageScore)}</div>
            </div>
            <div style="background: var(--md-sys-color-surface-container-high); padding: 12px; border-radius: var(--md-sys-shape-corner-medium, 12px); display: flex; flex-direction: column; gap: 4px; border: 1px solid var(--md-sys-color-outline-variant); text-align: center; align-self: stretch; box-sizing: border-box;">
              <span style="font-size: 0.8rem; font-weight: 500; color: var(--md-sys-color-on-surface-variant); display: flex; align-items: center; justify-content: center; gap: 4px;"><md-icon style="font-size: 1.1rem; color: var(--md-sys-color-tertiary);">emoji_events</md-icon> Cao nhất</span>
              <div style="font-size: 1.3rem; font-weight: 700; color: var(--md-sys-color-tertiary); margin-top: 4px;">${formatScore(bestScore)}</div>
            </div>
          </div>

          <!-- Content Split: Recent attempts list & Uncompleted list -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-top: 16px;">
            <!-- Left side: attempts -->
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <h3 style="margin: 0; font-size: 0.95rem; font-weight: 600; display: flex; justify-content: space-between; align-items: center; color: var(--md-sys-color-on-surface);">
                <span>Bài làm gần đây</span>
                ${totalSubmissions > 0 ? `<span style="font-size: 0.8rem; font-weight: 500; color: var(--md-sys-color-outline);">Tất cả (${totalSubmissions})</span>` : ''}
              </h3>
              <div class="attempts-list-container" style="flex: 1; min-height: 400px; max-height: 500px; overflow-y: auto; padding-right: 4px; border: 1px dashed var(--md-sys-color-outline-variant); border-radius: var(--md-sys-shape-corner-small, 8px); padding: 4px 12px; background: var(--md-sys-color-surface-container-lowest);">
                ${attemptsListMarkup || '<div class="empty-state compact" style="padding: 16px 0; border: 0; background: transparent; text-align: center;">Chưa nộp bài nào.</div>'}
              </div>
            </div>

            <!-- Right side: uncompleted -->
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <h3 style="margin: 0; font-size: 0.95rem; font-weight: 600; display: flex; justify-content: space-between; align-items: center; color: var(--md-sys-color-on-surface);">
                <span>Bài tập chưa làm</span>
                ${uncompletedAssignments.length > 0 ? `<span style="font-size: 0.8rem; font-weight: 500; color: var(--md-sys-color-error);">${uncompletedAssignments.length} bài</span>` : ''}
              </h3>
              <div class="attempts-list-container" style="flex: 1; min-height: 400px; max-height: 500px; overflow-y: auto; padding-right: 4px; border: 1px dashed var(--md-sys-color-outline-variant); border-radius: var(--md-sys-shape-corner-small, 8px); padding: 4px 12px; background: var(--md-sys-color-surface-container-lowest);">
                ${uncompletedListMarkup || '<div class="empty-state compact" style="padding: 16px 0; border: 0; background: transparent; text-align: center;">Đã hoàn thành tất cả.</div>'}
              </div>
            </div>
          </div>

          <!-- Account settings details accordion -->
          <details style="margin-top: 24px; border: 1px solid #D8E2C4; border-radius: 12px; background: #ffffff;">
            <summary style="padding: 16px; font-weight: 600; cursor: pointer; color: #455120; outline: none; list-style: none;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> Quản lý tài khoản
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </summary>
            <div style="padding: 16px; display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; border-top: 1px solid #f1f5f9; margin-top: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 300px;">
                <input class="nh-form-input-clean" placeholder="Họ tên mới" value="${escapeHtml(student.full_name ?? '')}" style="flex: 1; height: 40px;" data-name-input="${student.id}" />
                <button type="button" class="nh-modal-btn-primary" style="height: 40px;" data-save-btn="${student.id}">
                  Lưu
                </button>
              </div>

              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button type="button" class="nh-modal-btn-secondary" style="height: 40px;" data-reset-btn="${student.id}">
                  Đặt lại mật khẩu
                </button>
                <button type="button" class="nh-modal-btn-secondary danger" style="height: 40px;" data-delete-btn="${student.id}">
                  Xóa tài khoản
                </button>
              </div>
            </div>
          </details>
        </div>
      `;

      wireStudentDetailsEvents(student);
    }

    // Bind event listeners for the active student details view
    function wireStudentDetailsEvents(student) {
      const pane = document.querySelector('.student-details-pane');
      if (!pane) return;

      // Save Name & Status
      pane.querySelector('[data-save-btn]')?.addEventListener('click', async () => {
        const nameInput = pane.querySelector('[data-name-input]');
        const statusSelect = pane.querySelector('[data-status-student]');
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

      // Auto-update status select change
      pane.querySelector('[data-status-student]')?.addEventListener('change', async (event) => {
        const nameInput = pane.querySelector('[data-name-input]');
        try {
          await invokeAdminFunction('admin-update-user', {
            id: student.id,
            full_name: nameInput.value,
            status: event.target.value,
            role: 'student',
          });
          toast('Đã cập nhật trạng thái học sinh.', 'success');
          await mountDashboard();
        } catch (error) {
          toast(error.message, 'error');
        }
      });

      // Reset Password
      pane.querySelector('[data-reset-btn]')?.addEventListener('click', async () => {
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
      pane.querySelector('[data-delete-btn]')?.addEventListener('click', async () => {
        if (!window.confirm(`Xóa tài khoản học sinh "${student.full_name || student.email}"? Hành động này không thể hoàn tác.`)) return;
        try {
          await deleteManagedUser(student.id);
          toast('Đã xóa học sinh.', 'success');
          selectedStudentId = null;
          await mountDashboard();
        } catch (error) {
          toast(error.message, 'error');
        }
      });
    }

    // Bind add student submit listener and validations
    const createForm = document.querySelector('#create-user-form');
    if (createForm) {
      const nameInput = createForm.querySelector('[name="full_name"]');
      const emailInput = createForm.querySelector('[name="email"]');
      const passInput = createForm.querySelector('[name="password"]');

      const validateName = () => {
        if (!nameInput.value.trim()) {
          nameInput.error = true;
          nameInput.errorText = 'Họ tên không được để trống';
          return false;
        }
        nameInput.error = false;
        nameInput.errorText = '';
        return true;
      };

      const validateEmail = () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailInput.value.trim()) {
          emailInput.error = true;
          emailInput.errorText = 'Email không được để trống';
          return false;
        } else if (!emailRegex.test(emailInput.value.trim())) {
          emailInput.error = true;
          emailInput.errorText = 'Định dạng email không hợp lệ';
          return false;
        }
        emailInput.error = false;
        emailInput.errorText = '';
        return true;
      };

      const validatePass = () => {
        if (!passInput.value || passInput.value.length < 6) {
          passInput.error = true;
          passInput.errorText = 'Mật khẩu phải tối thiểu 6 ký tự';
          return false;
        }
        passInput.error = false;
        passInput.errorText = '';
        return true;
      };

      nameInput?.addEventListener('input', validateName);
      emailInput?.addEventListener('input', validateEmail);
      passInput?.addEventListener('input', validatePass);

      createForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const isNameValid = validateName();
        const isEmailValid = validateEmail();
        const isPassValid = validatePass();
        if (!isNameValid || !isEmailValid || !isPassValid) {
          return;
        }
        const restore = setButtonLoading(createForm.querySelector('md-filled-button'));
        const values = Object.fromEntries(new FormData(createForm).entries());
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
    }

    renderSidebarList(students);
    if (selectedStudentId) {
      const allAssignments = await fetchAssignmentsForManager();
      renderStudentDetails(selectedStudentId, students, allAttempts, allAssignments);
    }
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

export async function mountStudentGrades() {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang tải bảng điểm cá nhân...');
  try {
    const data = await fetchLearningPath(state.profile.role);
    const assignmentGroups = collectLearningPathAssignments(data);
    const totalAssignments = assignmentGroups.reduce((sum, g) => sum + g.assignments.length, 0);

    root.innerHTML = `
      <div style="background: #EDF2E4; min-height: calc(100vh - 64px); padding: 28px max(var(--page-gutter), 24px);">
        <div style="max-width: 1040px; margin: 0 auto; background: #ffffff; border-radius: 18px; padding: 28px 32px; border: 1px solid #D8E2C4; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #D8E2C4;">
            <div>
              <h2 style="font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 26px; font-weight: 700; color: #455120; margin: 0;">Bảng điểm cá nhân</h2>
              <p style="margin: 4px 0 0; font-size: 13px; color: #667085; font-family: 'Be Vietnam Pro', sans-serif;">Theo dõi tiến độ và kết quả làm bài tập</p>
            </div>
            <span style="background: #F0F4E8; color: #455120; font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 14px; font-weight: 700; padding: 6px 16px; border-radius: 9999px; border: 1px solid #D8E2CA;">
              ${totalAssignments} bài tập
            </span>
          </div>

          ${assignmentGroups.length === 0 ? '<div class="empty-state">Chưa có bài tập về nhà.</div>' : ''}
          ${assignmentGroups.map(group => `
            <div style="margin-top: 28px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
              <div style="width: 4px; height: 18px; background: #455120; border-radius: 2px;"></div>
              <h3 style="margin: 0; font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 17px; font-weight: 700; color: #455120;">${escapeHtml(group.title)}</h3>
            </div>
            ${renderStudentGradesTable(group.assignments)}
          `).join('')}
        </div>
      </div>
    `;
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

export function collectLearningPathAssignments(data) {
  const groups = [];
  const scoreOf = (assignment) => Number(assignment.progress?.bestScore ?? -1);

  for (const phase of data.phases ?? []) {
    const rowsById = new Map();
    const pushAssignment = (assignment, context) => {
      const row = { ...assignment, context };
      const current = rowsById.get(assignment.id);
      if (!current || scoreOf(row) > scoreOf(current)) {
        rowsById.set(assignment.id, row);
      }
    };

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

    if (rowsById.size > 0) {
      groups.push({
        title: phase.title,
        assignments: Array.from(rowsById.values()).sort((a, b) => a.title.localeCompare(b.title, 'vi'))
      });
    }
  }

  const freeById = new Map();
  for (const assignment of data.freeAssignments ?? []) {
    const row = { ...assignment, context: 'Bài tập tự do' };
    const current = freeById.get(assignment.id);
    if (!current || scoreOf(row) > scoreOf(current)) {
      freeById.set(assignment.id, row);
    }
  }

  if (freeById.size > 0) {
    groups.push({
      title: 'Bài tập tự do',
      assignments: Array.from(freeById.values()).sort((a, b) => a.title.localeCompare(b.title, 'vi'))
    });
  }

  return groups;
}

export function renderStudentGradesTable(assignments) {
  if (!assignments.length) return '<div class="empty-state">Chưa có bài tập về nhà.</div>';
  return `
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${assignments
      .map((assignment) => {
        const hasSubmitted = assignment.progress?.status === 'submitted';
        const score = assignment.progress?.bestScore;
        return `
            <div style="background: #F7F9F4; border-radius: 12px; padding: 14px 18px; border: 1px solid #E5ECD9; display: flex; align-items: center; justify-content: space-between; gap: 16px; transition: all 0.15s ease;" onmouseover="this.style.borderColor='#455120'" onmouseout="this.style.borderColor='#E5ECD9'">
              <div style="min-width: 0; flex: 1;">
                <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #101828; font-family: 'Be Vietnam Pro', sans-serif;">${escapeHtml(assignment.title)}</h4>
                <p style="margin: 0; font-size: 12px; color: #667085; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(assignment.context ?? '-')}</p>
              </div>

              <div style="display: flex; align-items: center; gap: 16px; flex-shrink: 0;">
                <span style="font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 9999px; ${hasSubmitted ? 'background: #F0F4E8; color: #455120;' : 'background: #EAECF0; color: #667085;'}">
                  ${hasSubmitted ? 'Đã làm' : 'Chưa làm'}
                </span>

                <div style="min-width: 60px; text-align: right;">
                  ${hasSubmitted
            ? `<span style="font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 16px; font-weight: 800; color: #455120;">${formatScore(score)}/10</span>`
            : '<span style="color: #98A2B3; font-weight: 600;">-</span>'
          }
                </div>

                <a href="#/assignment/${assignment.id}" style="text-decoration: none; background: ${hasSubmitted ? '#F0F4E8' : '#455120'}; color: ${hasSubmitted ? '#455120' : '#ffffff'}; border: 1px solid ${hasSubmitted ? '#D8E2CA' : '#455120'}; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 4px;">
                  ${hasSubmitted ? 'Làm lại' : 'Làm bài'}
                  <md-icon style="font-size: 14px;">arrow_forward</md-icon>
                </a>
              </div>
            </div>
          `;
      })
      .join('')}
    </div>
  `;
}

