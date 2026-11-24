import { state, pageRoot } from '../../store.js';
import { wireRouteRetry } from '../../router.js';
import { renderLoading, renderErrorState } from '../../lib/ui.js';
import { escapeHtml } from '../../lib/html.js';
import { formatScore } from '../../lib/format.js';
import { fetchLearningPath } from '../../services/lmsApi.js';

export async function mountStudentGrades() {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang tải bảng điểm...');
  try {
    const data = await fetchLearningPath(state.profile.role);
    const assignmentGroups = collectLearningPathAssignments(data);
    const allAssignments = assignmentGroups.flatMap((g) => g.assignments);
    const totalAssignments = allAssignments.length;
    const submitted = allAssignments.filter((a) => a.progress?.status === 'submitted');
    const doneCount = submitted.length;
    const pendingCount = totalAssignments - doneCount;
    const avgScore = doneCount > 0
      ? submitted.reduce((sum, a) => sum + Number(a.progress?.bestScore ?? 0), 0) / doneCount
      : null;

    let activeFilter = 'all';
    let searchQuery = '';

    root.innerHTML = `
      <section class="grades-hub">
        <!-- Dark Hero Banner -->
        <header class="asg-overview-hero">
          <a href="#/learn" class="phase-back-link">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            <span>Lộ trình học tập</span>
          </a>
          <div class="asg-overview-hero-row">
            <div class="asg-overview-hero-left">
              <h1 class="phase-hero-title">Bảng điểm</h1>
            </div>
          </div>
        </header>

        <!-- 3 Compact Soft Stat Blocks -->
        <div class="asg-stat-grid">
          <div class="asg-stat-card">
            <span class="asg-stat-label">Điểm trung bình</span>
            <div class="asg-stat-value">${avgScore !== null ? formatScore(avgScore) : '—'}${avgScore !== null ? '<span class="asg-stat-unit">/10</span>' : ''}</div>
          </div>
          <div class="asg-stat-card">
            <span class="asg-stat-label">Đã hoàn thành</span>
            <div class="asg-stat-value">${doneCount}/${totalAssignments}<span class="asg-stat-unit">đề</span></div>
          </div>
          <div class="asg-stat-card">
            <span class="asg-stat-label">Chưa làm</span>
            <div class="asg-stat-value">${pendingCount}<span class="asg-stat-unit">đề</span></div>
          </div>
        </div>

        ${totalAssignments > 0 ? `
          <!-- Filter & Search Bar -->
          <div class="phase-toolbar">
            <div class="phase-filter-group" id="grades-filter-group">
              <button type="button" class="phase-filter-pill active" data-filter="all">Tất cả (${totalAssignments})</button>
              <button type="button" class="phase-filter-pill" data-filter="pending">Chưa làm (${pendingCount})</button>
              <button type="button" class="phase-filter-pill" data-filter="done">Đã làm (${doneCount})</button>
            </div>
            <div class="phase-search-wrap">
              <svg class="phase-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" id="grades-search-input" class="phase-search-input" placeholder="Tìm đề..." />
            </div>
          </div>

          <div id="grades-groups-host" class="grades-groups"></div>
        ` : `
          <div class="phase-empty-card">
            <p>Chưa có bài tập nào.</p>
          </div>
        `}
      </section>
    `;

    const host = root.querySelector('#grades-groups-host');
    const renderGroups = () => {
      if (!host) return;
      const q = searchQuery.trim().toLowerCase();
      const blocks = assignmentGroups
        .map((group) => {
          const filtered = group.assignments.filter((a) => {
            const isDone = a.progress?.status === 'submitted';
            if (activeFilter === 'done' && !isDone) return false;
            if (activeFilter === 'pending' && isDone) return false;
            if (q) {
              const hay = `${a.title || ''} ${a.context || ''}`.toLowerCase();
              if (!hay.includes(q)) return false;
            }
            return true;
          });
          if (!filtered.length) return '';
          return `
            <section class="grades-group">
              <div class="grades-group-head">
                <h2 class="grades-group-title">${escapeHtml(group.title)}</h2>
                <span class="grades-group-count">${filtered.length} đề</span>
              </div>
              ${renderStudentGradesTable(filtered)}
            </section>
          `;
        })
        .filter(Boolean);

      host.innerHTML = blocks.length
        ? blocks.join('')
        : '<div class="phase-empty-card"><p>Không có bài tập phù hợp.</p></div>';
    };

    root.querySelectorAll('#grades-filter-group .phase-filter-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        root.querySelectorAll('#grades-filter-group .phase-filter-pill').forEach((b) => b.classList.toggle('active', b === btn));
        renderGroups();
      });
    });

    const searchInput = root.querySelector('#grades-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderGroups();
      });
    }

    renderGroups();
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
  if (!assignments.length) return '<div class="phase-empty-card"><p>Chưa có bài tập.</p></div>';
  return `
    <div class="grades-card">
      ${assignments.map((assignment) => {
        const hasSubmitted = assignment.progress?.status === 'submitted';
        const score = Number(assignment.progress?.bestScore ?? 0);
        const isGood = hasSubmitted && score >= 8;
        const cleanedTitle = (assignment.title || '').replace(/Bài tập về nhà/gi, 'Bài tập');
        return `
          <a href="#/assignment/${assignment.id}" class="grades-row">
            <div class="grades-row-main">
              <div class="grades-row-title">${escapeHtml(cleanedTitle)}</div>
              <div class="grades-row-context">${escapeHtml(assignment.context ?? '')}</div>
            </div>
            <div class="grades-row-right">
              ${hasSubmitted
                ? `<span class="grades-score ${isGood ? 'is-good' : ''}">${formatScore(score)}<span class="grades-score-max">/10</span></span>`
                : '<span class="grades-pending-pill">Chưa làm</span>'
              }
              <span class="grades-row-arrow" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </span>
            </div>
          </a>
        `;
      }).join('')}
    </div>
  `;
}
