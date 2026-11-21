import { state, isManager, pageRoot } from '../../store.js';
import { wireRouteRetry } from '../../router.js';
import { renderLoading, renderStateMessage, renderErrorState } from '../../lib/ui.js';
import { escapeHtml } from '../../lib/html.js';
import { driveFrame } from '../../lib/drive.js';
import { fetchLearningPath, fetchTeachingLogs } from '../../services/lmsApi.js';

function getFreeAssignmentCategory(title = '') {
  const tagMatch = title.match(/^\[([^\]]+)\]/);
  let cat = tagMatch ? tagMatch[1].trim() : '';
  if (!cat) {
    const lower = title.toLowerCase();
    if (title.includes('Đại số') || lower.includes('hàm số') || lower.includes('mũ') || lower.includes('logarit')) cat = 'Đại số & Giải tích';
    else if (title.includes('Hình học') || lower.includes('tọa độ') || lower.includes('khối đa diện')) cat = 'Hình học';
    else if (lower.includes('xác suất') || lower.includes('tổ hợp')) cat = 'Xác suất & Thống kê';
    else if (lower.includes('đề') || lower.includes('luyện') || lower.includes('kiểm tra')) cat = 'Đề luyện tập';
    else cat = 'Khác';
  }
  return cat;
}

function getPhaseStats(phase, taughtSet = new Set()) {
  let lectureCount = 0;
  let taughtCount = 0;
  let assignmentCount = 0;
  let submittedCount = 0;
  const modules = phase.modules || [];

  modules.forEach((mod) => {
    (mod.lectures || []).forEach((lec) => {
      lectureCount++;
      if (taughtSet.has(lec.id)) taughtCount++;
      (lec.assignments || []).forEach((a) => {
        assignmentCount++;
        if (a.progress?.status === 'submitted') submittedCount++;
      });
    });
  });

  const progressPct = lectureCount > 0 ? Math.min(100, Math.round((taughtCount / lectureCount) * 100)) : 0;
  return {
    chapterCount: modules.length,
    lectureCount,
    taughtCount,
    assignmentCount,
    submittedCount,
    progressPct,
    isActive: lectureCount > 0,
  };
}

function shortPhaseLabel(title = '') {
  const dashIdx = title.indexOf('-');
  if (dashIdx > 0) return title.slice(0, dashIdx).trim();
  return title.length > 26 ? `${title.slice(0, 26).trim()}…` : title;
}

export async function mountLearn() {
  const root = pageRoot();
  root.innerHTML = renderLoading();
  try {
    const isStudent = state.profile.role === 'student';
    const data = await fetchLearningPath(state.profile.role);
    let teachingLogs = [];
    let taughtSet = new Set();
    if (isStudent) {
      teachingLogs = await fetchTeachingLogs(state.profile.id);
      taughtSet = new Set(teachingLogs.map((l) => l.lecture_id));
    }

    const phases = data.phases || [];
    const freeAssignments = data.freeAssignments || [];
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(2027, 5, 11) - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000),
    );

    const phaseEntries = phases.map((phase, idx) => ({
      phase,
      idx,
      stats: getPhaseStats(phase, taughtSet),
    }));

    const totals = phaseEntries.reduce(
      (acc, entry) => {
        acc.lectures += entry.stats.lectureCount;
        acc.taught += entry.stats.taughtCount;
        acc.assignments += entry.stats.assignmentCount;
        acc.submitted += entry.stats.submittedCount;
        return acc;
      },
      { lectures: 0, taught: 0, assignments: 0, submitted: 0 },
    );

    let continuePhase = null;
    if (isStudent && teachingLogs.length > 0) {
      const recentLectureIds = new Set(teachingLogs.slice(0, 5).map((l) => l.lecture_id));
      for (const entry of phaseEntries) {
        const hasRecent = (entry.phase.modules || []).some((m) =>
          (m.lectures || []).some((l) => recentLectureIds.has(l.id)),
        );
        if (hasRecent) {
          continuePhase = entry.phase;
          break;
        }
      }
    }
    if (!continuePhase) {
      continuePhase = (phaseEntries.find((e) => e.stats.isActive) || phaseEntries[0])?.phase || null;
    }

    const pendingFree = freeAssignments.filter((a) => a.progress?.status !== 'submitted');
    const previewFree = (isStudent && pendingFree.length > 0 ? pendingFree : freeAssignments).slice(0, 3);

    const freeCategories = Array.from(
      new Set(freeAssignments.map((a) => getFreeAssignmentCategory(a.title || ''))),
    ).filter(Boolean);

    const renderPhaseGrid = () => {
      if (!phaseEntries.length) {
        return renderStateMessage({
          title: 'Chưa có lộ trình học',
          message: isManager() ? 'Tạo giai đoạn đầu tiên để học sinh nhìn thấy kế hoạch học.' : 'Giáo viên chưa mở nội dung cho lớp này.',
          actionHref: isManager() ? '#/content' : '',
          actionLabel: isManager() ? 'Tạo lộ trình' : '',
          actionIcon: 'add',
        });
      }

      if (phaseEntries.length === 5) {
        const topTwo = phaseEntries.slice(0, 2);
        const bottomThree = phaseEntries.slice(2);
        return `
          <div class="learn-phase-stack">
            <div class="learn-phase-grid learn-phase-grid--two">
              ${topTwo.map((e) => renderPhaseCard(e.phase, e.idx, taughtSet)).join('')}
            </div>
            <div class="learn-phase-grid learn-phase-grid--three">
              ${bottomThree.map((e) => renderPhaseCard(e.phase, e.idx, taughtSet)).join('')}
            </div>
          </div>
        `;
      }

      return `
        <div class="learn-phase-grid learn-phase-grid--auto">
          ${phaseEntries.map((e) => renderPhaseCard(e.phase, e.idx, taughtSet)).join('')}
        </div>
      `;
    };

    const heroMeta = isStudent && totals.taught > 0
      ? `Đã học ${totals.taught}/${totals.lectures} bài`
      : '';

    const freeTabBadge = isStudent && pendingFree.length > 0
      ? `${pendingFree.length}`
      : `${freeAssignments.length}`;

    root.innerHTML = `
      <section class="learn-hub">
        <header class="learn-hero">
          <div class="learn-hero-left">
            <div class="learn-hero-eyebrow">THPTQG 2027</div>
            <div class="learn-hero-countdown">
              <span class="learn-hero-days">${daysLeft}</span>
              <span class="learn-hero-days-unit">ngày nữa</span>
            </div>
            ${heroMeta ? `<p class="learn-hero-meta">${escapeHtml(heroMeta)}</p>` : ''}
          </div>
          <div class="learn-hero-actions">
            ${continuePhase ? `
              <a href="#/phase/${continuePhase.id}" class="learn-hero-cta">
                <span>${isStudent ? 'Học tiếp' : 'Vào học'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </a>
            ` : ''}
            ${isManager() ? `
              <a href="#/manage" class="learn-hero-secondary">
                <span>Quản trị</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </a>
            ` : ''}
          </div>
        </header>

        <div class="learn-toolbar" id="nh-category-menu">
          <div class="learn-tabs" role="tablist" aria-label="Chế độ xem học tập">
            <button type="button" class="learn-tab active" data-filter="all" role="tab" aria-selected="true">
              <span>Khóa học</span>
              <span class="learn-tab-count">${phases.length}</span>
            </button>
            ${freeAssignments.length > 0 ? `
              <button type="button" class="learn-tab" data-filter="free" role="tab" aria-selected="false">
                <span>Bài tập tự do</span>
                <span class="learn-tab-count">${escapeHtml(freeTabBadge)}</span>
              </button>
            ` : ''}
          </div>
        </div>

        <div id="nh-course-grid" class="learn-panel">
          ${renderPhaseGrid()}

          ${previewFree.length > 0 ? `
            <section class="learn-quick-free">
              <div class="learn-quick-free-head">
                <h2 class="learn-section-title">Bài tập tự do</h2>
                <button type="button" class="learn-text-btn" id="learn-open-free-tab">
                  <span>Tất cả (${freeAssignments.length})</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </button>
              </div>
              <div class="learn-free-list">
                ${previewFree.map(renderEnhancedFreeAssignmentCard).join('')}
              </div>
            </section>
          ` : ''}
        </div>

        ${freeAssignments.length > 0 ? `
          <section class="nh-free-assignments learn-free-section" style="display: none;">
            <div class="learn-free-filters" id="free-category-pills">
              <button type="button" class="nh-pill-filter learn-pill active" data-cat="all">Tất cả (${freeAssignments.length})</button>
              ${isStudent && pendingFree.length > 0 ? `<button type="button" class="nh-pill-filter learn-pill" data-cat="__pending">Chưa làm (${pendingFree.length})</button>` : ''}
              ${freeCategories.map((c) => `<button type="button" class="nh-pill-filter learn-pill" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('')}
            </div>

            <div class="learn-free-list" id="free-assignments-grid">
              ${freeAssignments.map(renderEnhancedFreeAssignmentCard).join('')}
            </div>
          </section>
        ` : ''}
      </section>
    `;

    const pills = root.querySelectorAll('.nh-pill-filter');
    const freeGrid = root.querySelector('#free-assignments-grid');

    const filterFreeAssignments = () => {
      if (!freeGrid) return;
      const activePill = root.querySelector('.nh-pill-filter.active');
      const selectedCat = activePill ? activePill.dataset.cat : 'all';

      const filtered = freeAssignments.filter((a) => {
        if (selectedCat === 'all') return true;
        if (selectedCat === '__pending') return a.progress?.status !== 'submitted';
        return getFreeAssignmentCategory(a.title || '') === selectedCat;
      });

      if (filtered.length === 0) {
        freeGrid.innerHTML = `<div class="learn-empty-inline">Không có bài tập tự do phù hợp</div>`;
      } else {
        freeGrid.innerHTML = filtered.map(renderEnhancedFreeAssignmentCard).join('');
      }
    };

    pills.forEach((p) => {
      p.addEventListener('click', () => {
        pills.forEach((item) => item.classList.remove('active'));
        p.classList.add('active');
        filterFreeAssignments();
      });
    });

    const switchTab = (filter) => {
      const tabBtns = root.querySelectorAll('.learn-tab');
      tabBtns.forEach((btn) => {
        const isActive = btn.dataset.filter === filter;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      const coursePanel = root.querySelector('#nh-course-grid');
      const freeSection = root.querySelector('.nh-free-assignments');
      if (filter === 'free') {
        if (coursePanel) coursePanel.style.display = 'none';
        if (freeSection) freeSection.style.display = 'block';
      } else {
        if (coursePanel) coursePanel.style.display = 'block';
        if (freeSection) freeSection.style.display = 'none';
      }
    };

    root.querySelectorAll('.learn-tab').forEach((item) => {
      item.addEventListener('click', () => switchTab(item.dataset.filter));
    });

    const openFreeBtn = root.querySelector('#learn-open-free-tab');
    if (openFreeBtn) {
      openFreeBtn.addEventListener('click', () => {
        switchTab('free');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

function splitChapterTitle(title = '', fallbackIndex = 1) {
  const match = title.match(/^(Chương\s*\d+)\s*[:\-–]\s*(.+)$/i);
  if (match) {
    return {
      short: match[1].trim(),
      sub: match[2].trim(),
    };
  }
  return {
    short: `Chương ${fallbackIndex}`,
    sub: title.trim() || `Chương ${fallbackIndex}`,
  };
}

function renderPhaseLectureItem(lecture, stepIndex, taughtSet = new Set(), isStudent = false) {
  const isTaught = isStudent && taughtSet.has(lecture.id);
  const hasSlide = !!lecture.slide_url;
  const assignmentCount = lecture.assignments ? lecture.assignments.length : 0;
  const hasAssignments = assignmentCount > 0;
  const hasContent = hasSlide || hasAssignments || !!lecture.description;

  const metaParts = [];
  if (hasSlide) metaParts.push('1 bài giảng');
  if (assignmentCount > 0) metaParts.push(`${assignmentCount} bài tập`);
  const metaText = metaParts.join(' - ');

  const badgeIcon = isTaught
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    : `${stepIndex}`;

  return `
    <details class="phase-lecture-item ${isTaught ? 'is-taught' : ''}" data-lecture-id="${escapeHtml(String(lecture.id))}">
      <summary class="phase-lecture-summary ${hasContent ? '' : 'is-static'}">
        <div class="phase-lecture-left">
          <span class="phase-lecture-badge ${isTaught ? 'is-taught' : ''}">${badgeIcon}</span>
          <div class="phase-lecture-text">
            <div class="phase-lecture-title">${escapeHtml(lecture.title)}</div>
            ${metaText ? `<div class="phase-lecture-meta">${escapeHtml(metaText)}</div>` : ''}
          </div>
        </div>
        <div class="phase-lecture-right">
          ${isTaught ? `<span class="phase-lecture-done">Đã học</span>` : ''}
          ${hasContent ? `
            <span class="phase-lecture-chevron" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </span>
          ` : ''}
        </div>
      </summary>
      ${hasContent ? `
        <div class="phase-lecture-body">
          ${lecture.description ? `<p class="phase-lecture-desc">${escapeHtml(lecture.description)}</p>` : ''}
          <div class="phase-lecture-actions">
            ${hasSlide ? `
              <a class="phase-action-pill is-surface" href="${escapeHtml(lecture.slide_url)}" target="_blank" rel="noreferrer noopener">Xem bài giảng</a>
            ` : ''}
            ${hasAssignments ? lecture.assignments.map((a, idx) => renderPhaseAssignmentPill(a, idx, lecture.assignments.length)).join('') : ''}
          </div>
        </div>
      ` : ''}
    </details>
  `;
}

function renderPhaseAssignmentPill(assignment, idx = 0, total = 1) {
  const hasSubmitted = assignment.progress?.status === 'submitted';
  const cleanedTitle = (assignment.title || '').replace(/Bài tập về nhà/gi, 'Bài tập');
  const isPdfAssignment = assignment.pdf_url && assignment.pdf_url !== 'latex';
  const isStudent = state.profile?.role === 'student';
  const isLocked = isStudent && isPdfAssignment;
  const href = isLocked ? 'javascript:void(0)' : `#/assignment/${assignment.id}`;
  const lockedAttrs = isLocked ? 'data-pdf-locked="true"' : '';

  let actionLabel;
  if (total === 1) {
    actionLabel = hasSubmitted ? 'Xem lại bài tập' : 'Làm bài tập';
  } else {
    actionLabel = hasSubmitted ? `Xem lại bài tập ${idx + 1}` : `Làm bài tập ${idx + 1}`;
  }

  return `
    <a class="phase-action-pill is-primary ${isLocked ? 'locked-pdf-chip' : ''}" href="${href}" ${lockedAttrs} title="${escapeHtml(cleanedTitle)}">
      <span>${escapeHtml(actionLabel)}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
    </a>
  `;
}

function renderChapterBody(module, taughtSet, isStudent, filterMode = 'all', query = '') {
  const q = query.trim().toLowerCase();
  const matches = (lec) => {
    const isTaught = taughtSet.has(lec.id);
    if (isStudent && filterMode === 'taught' && !isTaught) return false;
    if (isStudent && filterMode === 'untaught' && isTaught) return false;
    if (q) {
      const hay = `${lec.title || ''} ${lec.description || ''} ${(lec.assignments || []).map((a) => a.title || '').join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const hasGroups = module.lecture_groups && module.lecture_groups.length > 0;
  let stepIndex = 0;
  let html = '';

  if (hasGroups) {
    for (const group of module.lecture_groups) {
      const groupLectures = group.lectures || [];
      const renderedRows = [];
      for (const lec of groupLectures) {
        stepIndex++;
        if (matches(lec)) {
          renderedRows.push(renderPhaseLectureItem(lec, stepIndex, taughtSet, isStudent));
        }
      }
      if (renderedRows.length > 0) {
        html += `
          <div class="phase-group-section">
            ${group.title ? `<div class="phase-group-title">${escapeHtml(group.title)}</div>` : ''}
            <div class="phase-lecture-list">
              ${renderedRows.join('')}
            </div>
          </div>
        `;
      }
    }

    const orphanLectures = (module.lectures || []).filter((l) => !l.group_id);
    const orphanRows = [];
    for (const lec of orphanLectures) {
      stepIndex++;
      if (matches(lec)) {
        orphanRows.push(renderPhaseLectureItem(lec, stepIndex, taughtSet, isStudent));
      }
    }
    if (orphanRows.length > 0) {
      html += `<div class="phase-group-section"><div class="phase-lecture-list">${orphanRows.join('')}</div></div>`;
    }
  } else {
    const rows = [];
    for (const lec of (module.lectures || [])) {
      stepIndex++;
      if (matches(lec)) {
        rows.push(renderPhaseLectureItem(lec, stepIndex, taughtSet, isStudent));
      }
    }
    if (rows.length > 0) {
      html += `<div class="phase-group-section"><div class="phase-lecture-list">${rows.join('')}</div></div>`;
    }
  }

  return html;
}

export async function mountPhaseDetail(id) {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang mở giai đoạn');
  try {
    const isStudent = state.profile.role === 'student';
    const data = await fetchLearningPath(state.profile.role);
    const phase = data.phases.find((item) => item.id === id);
    if (!phase) {
      root.innerHTML = '<div class="empty-state">Không tìm thấy giai đoạn.</div>';
      return;
    }

    const modules = phase.modules || [];
    let taughtSet = new Set();
    let taughtCount = 0;
    let totalLectures = 0;
    let totalAssignments = 0;
    let completedAssignments = 0;
    let firstUnfinishedLecture = null;
    let firstUnfinishedModuleId = null;
    let recentActivity = null;

    if (isStudent) {
      const teachingLogs = await fetchTeachingLogs(state.profile.id);
      taughtSet = new Set(teachingLogs.map((l) => l.lecture_id));

      const lectureOwnerMap = new Map();
      modules.forEach((mod) => {
        (mod.lectures || []).forEach((l) => lectureOwnerMap.set(l.id, { lecture: l, moduleId: mod.id }));
      });

      for (const log of teachingLogs) {
        const hit = lectureOwnerMap.get(log.lecture_id);
        if (hit) {
          recentActivity = hit;
          break;
        }
      }
    }

    const moduleStats = modules.map((mod, idx) => {
      let modLectures = 0;
      let modTaught = 0;
      (mod.lectures || []).forEach((l) => {
        modLectures++;
        totalLectures++;
        if (taughtSet.has(l.id)) {
          modTaught++;
          taughtCount++;
        } else if (!firstUnfinishedLecture) {
          firstUnfinishedLecture = l;
          firstUnfinishedModuleId = mod.id;
        }
        (l.assignments || []).forEach((a) => {
          totalAssignments++;
          if (a.progress?.status === 'submitted') completedAssignments++;
        });
      });
      const parsed = splitChapterTitle(mod.title, idx + 1);
      return {
        mod,
        idx,
        short: parsed.short,
        sub: parsed.sub,
        total: modLectures,
        taught: modTaught,
      };
    });

    const targetContinue = recentActivity || (firstUnfinishedLecture ? { lecture: firstUnfinishedLecture, moduleId: firstUnfinishedModuleId } : null);
    let activeModuleId = targetContinue?.moduleId || modules[0]?.id || null;
    let activeFilter = 'all';
    let searchQuery = '';

    const heroMetaParts = isStudent
      ? [`Đã học ${taughtCount}/${totalLectures} bài`, ...(totalAssignments > 0 ? [`${completedAssignments}/${totalAssignments} đề`] : [])]
      : [`${modules.length} chương`, `${totalLectures} bài giảng`, ...(totalAssignments > 0 ? [`${totalAssignments} bài tập`] : [])];

    root.innerHTML = `
      <section class="phase-hub">
        <!-- Dark Hero Banner (from C) -->
        <header class="phase-hero">
          <div class="phase-hero-top">
            <a href="#/learn" class="phase-back-link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>Lộ trình học tập</span>
            </a>
          </div>
          <div class="phase-hero-row">
            <div class="phase-hero-left">
              <h1 class="phase-hero-title">${escapeHtml(phase.title)}</h1>
              <p class="phase-hero-meta">${escapeHtml(heroMetaParts.join(' - '))}</p>
            </div>
            ${targetContinue ? `
              <button type="button" class="phase-hero-cta" id="phase-continue-btn">
                <span>${recentActivity ? 'Học tiếp' : 'Bắt đầu học'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </button>
            ` : ''}
          </div>
        </header>

        ${modules.length ? `
          <!-- 2-Column Layout (from B) -->
          <div class="phase-layout">
            <aside class="phase-sidebar" aria-label="Danh sách chương">
              <div class="phase-chapter-nav" id="phase-chapter-nav">
                ${moduleStats.map((entry) => `
                  <button type="button" class="phase-chapter-btn ${entry.mod.id === activeModuleId ? 'active' : ''}" data-module-id="${escapeHtml(String(entry.mod.id))}">
                    <div class="phase-chapter-btn-text">
                      <span class="phase-chapter-short">${escapeHtml(entry.short)}</span>
                      <span class="phase-chapter-sub">${escapeHtml(entry.sub)}</span>
                    </div>
                    <span class="phase-chapter-count">${isStudent ? `${entry.taught}/${entry.total}` : `${entry.total}`}</span>
                  </button>
                `).join('')}
              </div>
            </aside>

            <div class="phase-main">
              ${recentActivity ? `
                <div class="phase-recent-bar">
                  <div class="phase-recent-text">
                    <span class="phase-recent-eyebrow">Học gần đây</span>
                    <span class="phase-recent-title">${escapeHtml(recentActivity.lecture.title)}</span>
                  </div>
                  <button type="button" class="phase-recent-btn" id="phase-recent-open-btn">Mở</button>
                </div>
              ` : ''}

              <div class="phase-toolbar">
                ${isStudent ? `
                  <div class="phase-filter-group" id="phase-filter-group">
                    <button type="button" class="phase-filter-pill active" data-filter="all">Tất cả</button>
                    <button type="button" class="phase-filter-pill" data-filter="untaught">Chưa học</button>
                    <button type="button" class="phase-filter-pill" data-filter="taught">Đã học</button>
                  </div>
                ` : '<div></div>'}
                <div class="phase-search-wrap">
                  <svg class="phase-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <input type="text" id="nh-course-search-input" class="phase-search-input" placeholder="Tìm dạng bài..." />
                </div>
              </div>

              <div id="phase-chapter-content"></div>
            </div>
          </div>
        ` : `
          <div class="phase-empty-card">
            <p>Chưa có chương nào trong giai đoạn này.</p>
          </div>
        `}
      </section>
    `;

    const contentHost = root.querySelector('#phase-chapter-content');
    const navButtons = root.querySelectorAll('.phase-chapter-btn');
    const filterButtons = root.querySelectorAll('.phase-filter-pill');
    const searchInput = root.querySelector('#nh-course-search-input');

    const renderChapterView = (openLectureId = null) => {
      if (!contentHost) return;
      const q = searchQuery.trim();

      if (q) {
        const matchedBlocks = moduleStats
          .map((entry) => {
            const body = renderChapterBody(entry.mod, taughtSet, isStudent, activeFilter, q);
            if (!body) return '';
            return `
              <section class="phase-chapter-card">
                <div class="phase-chapter-card-head">
                  <h2 class="phase-chapter-card-title">${escapeHtml(entry.mod.title)}</h2>
                  <span class="phase-chapter-card-badge">${isStudent ? `${entry.taught}/${entry.total}` : `${entry.total} bài`}</span>
                </div>
                ${body}
              </section>
            `;
          })
          .filter(Boolean);

        contentHost.innerHTML = matchedBlocks.length
          ? `<div class="phase-search-results">${matchedBlocks.join('')}</div>`
          : `<div class="phase-empty-card"><p>Không tìm thấy bài học phù hợp với "${escapeHtml(q)}".</p></div>`;
        return;
      }

      const activeEntry = moduleStats.find((e) => String(e.mod.id) === String(activeModuleId)) || moduleStats[0];
      if (!activeEntry) return;

      const bodyHtml = renderChapterBody(activeEntry.mod, taughtSet, isStudent, activeFilter, '');
      contentHost.innerHTML = `
        <section class="phase-chapter-card">
          <div class="phase-chapter-card-head">
            <h2 class="phase-chapter-card-title">${escapeHtml(activeEntry.mod.title)}</h2>
            <span class="phase-chapter-card-badge">${isStudent ? `${activeEntry.taught}/${activeEntry.total}` : `${activeEntry.total} bài`}</span>
          </div>
          ${bodyHtml || '<div class="phase-empty-inline">Không có bài học phù hợp bộ lọc.</div>'}
        </section>
      `;

      if (openLectureId) {
        const targetEl = contentHost.querySelector(`details[data-lecture-id="${CSS.escape(String(openLectureId))}"]`);
        if (targetEl) {
          targetEl.open = true;
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        activeModuleId = btn.dataset.moduleId;
        searchQuery = '';
        if (searchInput) searchInput.value = '';
        navButtons.forEach((b) => b.classList.toggle('active', b === btn));
        renderChapterView();
      });
    });

    filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        filterButtons.forEach((b) => b.classList.toggle('active', b === btn));
        renderChapterView();
      });
    });

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderChapterView();
      });
    }

    const jumpToLecture = (target) => {
      if (!target) return;
      activeModuleId = target.moduleId;
      activeFilter = 'all';
      searchQuery = '';
      if (searchInput) searchInput.value = '';
      navButtons.forEach((b) => b.classList.toggle('active', String(b.dataset.moduleId) === String(activeModuleId)));
      filterButtons.forEach((b) => b.classList.toggle('active', b.dataset.filter === 'all'));
      renderChapterView(target.lecture.id);
    };

    const continueBtn = root.querySelector('#phase-continue-btn');
    if (continueBtn && targetContinue) {
      continueBtn.addEventListener('click', () => jumpToLecture(targetContinue));
    }

    const recentOpenBtn = root.querySelector('#phase-recent-open-btn');
    if (recentOpenBtn && recentActivity) {
      recentOpenBtn.addEventListener('click', () => jumpToLecture(recentActivity));
    }

    renderChapterView();
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

export function renderPhaseCard(phase, idx = 0, taughtSet = new Set()) {
  const isStudent = state.profile?.role === 'student';
  const stats = getPhaseStats(phase, taughtSet);
  const title = phase.title || 'Giai đoạn học tập';

  const metaLine = !stats.isActive
    ? 'Sắp mở'
    : (isStudent && stats.taughtCount > 0
      ? `${stats.taughtCount}/${stats.lectureCount} bài${stats.assignmentCount > 0 ? ` - ${stats.submittedCount}/${stats.assignmentCount} đề` : ''}`
      : `${stats.lectureCount} bài${stats.assignmentCount > 0 ? ` - ${stats.assignmentCount} đề` : ''}`);

  const barWidth = stats.taughtCount > 0 ? Math.max(stats.progressPct, 6) : 0;

  return `
    <a class="learn-phase-card ${stats.isActive ? 'is-active' : 'is-upcoming'}" href="#/phase/${phase.id}">
      <div class="learn-phase-head">
        <h3 class="learn-phase-title">${escapeHtml(title)}</h3>
        <span class="learn-phase-arrow" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </span>
      </div>

      <div class="learn-phase-bottom">
        ${stats.isActive && isStudent ? `
          <div class="learn-progress-track" aria-hidden="true">
            <div class="learn-progress-fill" style="width: ${barWidth}%;"></div>
          </div>
        ` : ''}
        <div class="learn-phase-meta-row">
          <p class="learn-phase-meta">${escapeHtml(metaLine)}</p>
          ${stats.isActive && isStudent && stats.taughtCount > 0 ? `<span class="learn-phase-metric is-strong">${stats.progressPct}%</span>` : ''}
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
              ${lecture.description ? `<p style="margin: 0 0 12px 0; font-size: 13px; color: #475467; font-family: 'Google Sans', sans-serif;">${escapeHtml(lecture.description)}</p>` : ''}
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

export function renderEnhancedFreeAssignmentCard(assignment) {
  const hasSubmitted = assignment.progress?.status === 'submitted';
  let cleanedTitle = (assignment.title || '').replace(/Bài tập về nhà/gi, 'Bài tập');
  const isPdfAssignment = assignment.pdf_url && assignment.pdf_url !== 'latex';
  const isStudent = state.profile?.role === 'student';
  const countFromDesc = assignment.description ? (assignment.description.match(/\\begin\{ex\}/g) || []).length : 0;
  const questionsCount = assignment.questions_count || (Array.isArray(assignment.questions) ? assignment.questions.length : 0) || countFromDesc || 20;
  const timeLimit = assignment.time_limit ? `${assignment.time_limit} phút` : '';

  const tagMatch = cleanedTitle.match(/^\[([^\]]+)\]/);
  let catTag = tagMatch ? tagMatch[1].trim() : '';
  if (tagMatch) {
    cleanedTitle = cleanedTitle.replace(/^\[[^\]]+\]\s*/, '');
  }
  if (!catTag) {
    catTag = getFreeAssignmentCategory(cleanedTitle);
  }

  const isLocked = isStudent && isPdfAssignment;
  const href = isLocked ? 'javascript:void(0)' : `#/assignment/${assignment.id}`;
  const lockedAttrs = isLocked ? 'data-pdf-locked="true"' : '';
  const statusText = hasSubmitted ? 'Đã làm' : 'Chưa làm';
  const metaParts = [catTag, `${questionsCount} câu`, timeLimit].filter(Boolean);

  return `
    <a class="learn-free-row ${hasSubmitted ? 'is-done' : ''} ${isLocked ? 'locked-pdf-chip' : ''}" href="${href}" ${lockedAttrs}>
      <div class="learn-free-row-main">
        <div class="learn-free-row-title">${escapeHtml(cleanedTitle)}</div>
        <div class="learn-free-row-meta">${escapeHtml(metaParts.join(' - '))}</div>
      </div>
      <div class="learn-free-row-right">
        ${isStudent ? `<span class="learn-free-status ${hasSubmitted ? 'is-done' : 'is-pending'}">${statusText}</span>` : ''}
        <span class="learn-free-arrow" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </span>
      </div>
    </a>
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#181B16" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
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
        <md-icon style="font-size: 1.1rem; color: #181B16;">arrow_forward</md-icon>
      </a>
    </div>
  `;
}
