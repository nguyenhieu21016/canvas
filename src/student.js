// student.js - Lazy loaded module for student routes
import { formatDateTime, formatScore } from "./lib/format.js";
import { setButtonLoading, option } from "./lib/html.js";
import { 
  fetchLearningPath, fetchDashboardStats, fetchGradebook, fetchMyHistory,
  fetchStudents, fetchTeachingLogs, invokeAdminFunction, createManagedUser, deleteManagedUser,
  fetchAssignmentsForManager
} from "./services/lmsApi.js";
import { 
  state, pageRoot, renderLoading, renderErrorState, escapeHtml, toast, isManager,
  renderAccountAvatar, renderSkeletonDashboard, renderStateMessage, wireMaterialFormButtons,
  driveFrame, wireRouteRetry, renderScoreProgress
} from "./main.js";

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
    
    root.innerHTML = `
      <section class="learn-layout">
        <div class="phase-card-grid">
          ${
            data.phases.length
              ? data.phases.map(p => renderPhaseCard(p, taughtSet)).join('')
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
    
    if (state.profile.role === 'student') {
      const teachingLogs = await fetchTeachingLogs(state.profile.id);
      taughtSet = new Set(teachingLogs.map((l) => l.lecture_id));
      taughtMap = new Map(teachingLogs.map((l) => [l.lecture_id, l]));
    }
    
    phase.modules.forEach(mod => {
      mod.lectures.forEach(l => {
        totalLectures++;
        if (taughtSet.has(l.id)) taughtCount++;
        if (l.assignments) {
          l.assignments.forEach(a => {
            totalAssignments++;
            if (a.progress?.status === 'submitted') completedAssignments++;
          });
        }
      });
    });

    const progressMarkup = state.profile.role === 'student' ? `
      <div style="display: flex; gap: 8px; align-items: center;">
        <span style="font-size: 0.85rem; font-weight: 600; color: var(--md-sys-color-primary); background: color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent); padding: 4px 12px; border-radius: 16px;">
          Đã học: ${taughtCount}/${totalLectures} bài
        </span>
        ${totalAssignments > 0 ? `
        <span style="font-size: 0.85rem; font-weight: 600; color: var(--md-sys-color-on-tertiary-container); background: var(--md-sys-color-tertiary-container); padding: 4px 12px; border-radius: 16px;">
          BTVN: ${completedAssignments}/${totalAssignments}
        </span>
        ` : ''}
      </div>
    ` : '';

    root.innerHTML = `
      <section class="phase-detail-panel">
        <a class="text-link back-link" href="#/learn">
          <md-icon>arrow_back</md-icon>
          Lộ trình
        </a>
        <div class="phase-detail-heading" style="display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <p class="eyebrow">Giai đoạn</p>
            <h2>${escapeHtml(phase.title)}</h2>
          </div>
          ${progressMarkup}
        </div>
        ${phase.description ? `<p class="muted">${escapeHtml(phase.description)}</p>` : ''}
        <div class="module-stack phase-module-stack">
          ${
            phase.modules.length
              ? phase.modules.map(m => renderModule(m, taughtSet, taughtMap)).join('')
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

export function renderPhaseCard(phase, taughtSet = new Set()) {
  const lectureCount = phase.modules.reduce((sum, module) => sum + module.lectures.length, 0);
  const groupCount = phase.modules.reduce((sum, module) => sum + module.lecture_groups.length, 0);
  const assignmentCount = phase.modules.reduce(
    (sum, module) => sum + module.lectures.reduce((total, lecture) => total + lecture.assignments.length, 0),
    0,
  );
  
  let taughtCount = 0;
  let totalAssignments = 0;
  let completedAssignments = 0;
  phase.modules.forEach(mod => {
    mod.lectures.forEach(l => {
      if (taughtSet.has(l.id)) taughtCount++;
      if (l.assignments) {
        l.assignments.forEach(a => {
          totalAssignments++;
          if (a.progress?.status === 'submitted') completedAssignments++;
        });
      }
    });
  });
  
  const pct = lectureCount > 0 ? Math.round((taughtCount / lectureCount) * 100) : 0;
  const hwPct = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;
  
  const progressMarkup = state.profile.role === 'student' ? `
    <div style="margin-top: 16px; margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 6px;">
        <span style="font-size: 0.8rem; font-weight: 600; color: var(--md-sys-color-on-surface);">Tiến độ học</span>
        <span style="font-size: 0.8rem; font-weight: 600; color: var(--md-sys-color-primary);">${taughtCount}/${lectureCount} bài (${pct}%)</span>
      </div>
      <div style="background: var(--md-sys-color-surface-container-high); border-radius: 100px; height: 6px; overflow: hidden; margin-bottom: ${totalAssignments > 0 ? '12px' : '0'};">
        <div style="height: 100%; width: ${pct}%; background: var(--md-sys-color-primary); border-radius: 100px; transition: width 0.4s ease;"></div>
      </div>
      
      ${totalAssignments > 0 ? `
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 6px;">
        <span style="font-size: 0.8rem; font-weight: 600; color: var(--md-sys-color-on-surface);">Tiến độ làm BTVN</span>
        <span style="font-size: 0.8rem; font-weight: 600; color: var(--md-sys-color-primary);">${completedAssignments}/${totalAssignments} bài (${hwPct}%)</span>
      </div>
      <div style="background: var(--md-sys-color-surface-container-high); border-radius: 100px; height: 6px; overflow: hidden;">
        <div style="height: 100%; width: ${hwPct}%; background: var(--md-sys-color-primary); border-radius: 100px; transition: width 0.4s ease;"></div>
      </div>
      ` : ''}
    </div>
  ` : '';

  return `
    <a class="phase-card" href="#/phase/${phase.id}" style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
      <div>
        <p class="eyebrow">Giai đoạn</p>
        <h2>${escapeHtml(phase.title)}</h2>
        ${progressMarkup}
      </div>
      <div style="margin-top: auto;">
        <div class="phase-card-meta" style="margin-bottom: 16px; margin-top: 12px;">
          <span><md-icon>folder_open</md-icon>${phase.modules.length} chuyên đề</span>
          <span><md-icon>library_books</md-icon>${groupCount} nhóm bài giảng</span>
          <span><md-icon>menu_book</md-icon>${lectureCount} bài giảng</span>
          <span><md-icon>quiz</md-icon>${assignmentCount} bài tập</span>
        </div>
        <span class="phase-card-action">
          Mở giai đoạn
          <md-icon>arrow_forward</md-icon>
        </span>
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
        ${
          phase.modules.length
            ? phase.modules.map(renderModule).join('')
            : '<div class="empty-state compact">Chưa có chuyên đề.</div>'
        }
      </div>
    </section>
  `;
}


export function renderModule(module, taughtSet = new Set(), taughtMap = new Map()) {
  const ungroupedLectures = module.lectures.filter((lecture) => !lecture.group_id);
  
  let taughtCount = 0;
  const total = module.lectures.length;
  module.lectures.forEach(l => { if (taughtSet.has(l.id)) taughtCount++; });
  const isCompleted = total > 0 && taughtCount === total;
  
  const progressMarkup = state.profile.role === 'student' ? `<span style="font-size: 0.75rem; background: ${isCompleted ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-highest)'}; color: ${isCompleted ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)'}; padding: 2px 8px; border-radius: 12px; font-weight: 600; flex-shrink: 0;">${taughtCount}/${total}</span>` : '';
  
  return `
    <article class="module-block" ${state.profile.role === 'student' && isCompleted ? 'style="opacity: 0.8;"' : ''}>
      <div class="module-title" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
          <md-icon>folder_open</md-icon>
          <h3 style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(module.title)}</h3>
        </div>
        ${progressMarkup}
      </div>
      <div class="lecture-list">
        ${
          module.lecture_groups.length || ungroupedLectures.length
            ? `
              ${module.lecture_groups.map(g => renderLectureGroup(g, false, taughtSet, taughtMap)).join('')}
              ${ungroupedLectures.length ? renderLectureGroup({ title: 'Bài giảng chưa nhóm', lectures: ungroupedLectures }, true, taughtSet, taughtMap) : ''}
            `
            : '<div class="empty-state compact">Chưa có nhóm bài giảng.</div>'
        }
      </div>
    </article>
  `;
}

export function renderLectureGroup(group, isUngrouped = false, taughtSet = new Set(), taughtMap = new Map()) {
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
            ? group.lectures.map(l => renderLecture(l, taughtSet, taughtMap)).join('')
            : '<div class="empty-state compact">Chưa có bài giảng trong nhóm.</div>'
        }
      </div>
    </details>
  `;
}

export function renderLecture(lecture, taughtSet = new Set(), taughtMap = new Map()) {
  const isTaught = taughtSet.has(lecture.id);
  
  const taughtMarkup = state.profile.role === 'student' 
    ? (isTaught ? `<span style="font-size: 0.7rem; color: var(--md-sys-color-primary); background: color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent); padding: 2px 8px; border-radius: 12px; font-weight: 600; white-space: nowrap;">Đã học</span>` : `<span style="font-size: 0.7rem; color: var(--md-sys-color-on-surface-variant); background: var(--md-sys-color-surface-container-high); padding: 2px 8px; border-radius: 12px; white-space: nowrap;">Chưa học</span>`)
    : '';

  let hwMarkup = '';
  if (state.profile.role === 'student' && lecture.assignments && lecture.assignments.length > 0) {
    const hw = lecture.assignments[0];
    const hasSubmitted = hw.progress?.status === 'submitted';
    if (hasSubmitted) {
      hwMarkup = `<span style="font-size: 0.7rem; color: var(--md-sys-color-on-tertiary-container); background: var(--md-sys-color-tertiary-container); padding: 2px 8px; border-radius: 12px; font-weight: 600; white-space: nowrap; margin-left: 8px;">Điểm BTVN: ${formatScore(hw.progress.bestScore)}/10</span>`;
    } else {
      hwMarkup = `<span style="font-size: 0.7rem; color: var(--md-sys-color-on-error-container); background: var(--md-sys-color-error-container); padding: 2px 8px; border-radius: 12px; font-weight: 600; white-space: nowrap; margin-left: 8px;">Chưa làm BTVN</span>`;
    }
  }

  return `
    <details class="lecture-row">
      <summary style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <span style="display: flex; align-items: center; gap: 8px; min-width: 0; color: ${state.profile.role === 'student' && !isTaught ? 'var(--md-sys-color-on-surface-variant)' : 'inherit'};">
          <md-icon style="flex-shrink: 0;">menu_book</md-icon>
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(lecture.title)}</span>
        </span>
        <div style="display: flex; align-items: center; flex-shrink: 0;">
          ${taughtMarkup}${hwMarkup}
          <md-icon style="margin-left: 8px; flex-shrink: 0;">expand_more</md-icon>
        </div>
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

export function renderAssignmentChip(assignment) {
  const hasSubmitted = assignment.progress?.status === 'submitted';
  return `
    <div class="assignment-action ${hasSubmitted ? 'completed' : 'pending'}">
      <a class="assignment-chip" href="#/assignment/${assignment.id}" style="width: 100%; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <md-icon>quiz</md-icon>
          <span>${escapeHtml(assignment.title)}</span>
        </div>
        <md-icon style="font-size: 1.1rem; color: var(--md-sys-color-primary);">arrow_forward</md-icon>
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

            <!-- Add student form (Collapsible) -->
            <details class="panel add-student-details" style="padding: 16px; border-radius: var(--md-sys-shape-corner-large, 16px); border: 1px solid var(--md-sys-color-outline-variant); background: var(--md-sys-color-surface-container-low);">
              <summary style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;">
                <div style="display: flex; align-items: center; gap: 8px; color: var(--md-sys-color-on-surface);">
                  <md-icon style="font-size: 1.2rem;">person_add</md-icon>
                  <span style="font-weight: 600; font-size: 0.9rem;">Thêm học sinh mới</span>
                </div>
                <md-icon style="font-size: 1.2rem; color: var(--md-sys-color-outline);">expand_more</md-icon>
              </summary>
              <div style="padding-top: 16px; border-top: 1px dashed var(--md-sys-color-outline-variant); margin-top: 16px;">
                <form id="create-user-form" style="display: flex; flex-direction: column; gap: 12px;">
                  <md-outlined-text-field label="Họ tên học sinh" name="full_name" required style="--md-outlined-text-field-container-shape: 8px;"></md-outlined-text-field>
                  <md-outlined-text-field label="Email đăng nhập" name="email" type="email" required style="--md-outlined-text-field-container-shape: 8px;"></md-outlined-text-field>
                  <md-outlined-text-field label="Mật khẩu tạm" name="password" required style="--md-outlined-text-field-container-shape: 8px;"></md-outlined-text-field>
                  <md-filled-button type="submit" style="--md-filled-button-container-shape: 8px; height: 44px;"><md-icon slot="icon">person_add</md-icon>Tạo tài khoản</md-filled-button>
                </form>
              </div>
            </details>

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
        
        a._debugPhaseIds = phaseStudentIds;
        
        if (phaseStudentIds && Array.isArray(phaseStudentIds) && phaseStudentIds.length > 0 && !phaseStudentIds.includes(studentId)) {
          return false;
        }
        
        return true;
      });
      const uncompletedListMarkup = uncompletedAssignments.map(a => `
        <div class="attempt-item-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--md-sys-color-outline-variant); font-size: 0.9rem;">
          <div style="display: flex; flex-direction: column; overflow: hidden; max-width: 80%;">
            <span style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(a.title ?? '-')}</span>
            <span style="font-size: 0.75rem; color: var(--md-sys-color-on-surface-variant);">${a.lectures?.title ? escapeHtml(a.lectures.title) : 'Chưa xếp nhóm'} (Debug: ids=${a._debugPhaseIds ? a._debugPhaseIds.length : 'null'})</span>
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
            
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 0.85rem; color: var(--md-sys-color-on-surface-variant);">Trạng thái học tập:</span>
              <select class="field compact" name="status" style="width: auto; height: 44px; min-height: 44px; padding: 4px 32px 4px 12px; font-size: 0.85rem; border-radius: var(--md-sys-shape-corner-small, 8px);" data-status-student="${student.id}">
                ${option('active', 'Đang học', student.status)}
                ${option('disabled', 'Tạm khóa', student.status)}
              </select>
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

          <!-- Content Split: Recent attempts list & Account settings -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-top: 8px;">
            <!-- Left side: attempts -->
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <h3 style="margin: 0; font-size: 0.95rem; font-weight: 600; display: flex; justify-content: space-between; align-items: center; color: var(--md-sys-color-on-surface);">
                <span>Bài làm gần đây</span>
                ${totalSubmissions > 0 ? `<span style="font-size: 0.8rem; font-weight: 500; color: var(--md-sys-color-outline);">Tất cả (${totalSubmissions})</span>` : ''}
              </h3>
              <div class="attempts-list-container" style="height: 220px; overflow-y: auto; padding-right: 4px; border: 1px dashed var(--md-sys-color-outline-variant); border-radius: var(--md-sys-shape-corner-small, 8px); padding: 4px 12px; background: var(--md-sys-color-surface-container-lowest);">
                ${attemptsListMarkup || '<div class="empty-state compact" style="padding: 16px 0; border: 0; background: transparent; text-align: center;">Chưa nộp bài nào.</div>'}
              </div>
              <h3 style="margin: 16px 0 0 0; font-size: 0.95rem; font-weight: 600; display: flex; justify-content: space-between; align-items: center; color: var(--md-sys-color-on-surface);">
                <span>Bài tập chưa làm</span>
                ${uncompletedAssignments.length > 0 ? `<span style="font-size: 0.8rem; font-weight: 500; color: var(--md-sys-color-error);">${uncompletedAssignments.length} bài</span>` : ''}
              </h3>
              <div class="attempts-list-container" style="height: 220px; overflow-y: auto; padding-right: 4px; border: 1px dashed var(--md-sys-color-outline-variant); border-radius: var(--md-sys-shape-corner-small, 8px); padding: 4px 12px; background: var(--md-sys-color-surface-container-lowest);">
                ${uncompletedListMarkup || '<div class="empty-state compact" style="padding: 16px 0; border: 0; background: transparent; text-align: center;">Đã hoàn thành tất cả.</div>'}
              </div>
            </div>

            <!-- Right side: settings -->
            <div style="display: flex; flex-direction: column; gap: 16px; border-left: 1px dashed var(--md-sys-color-outline-variant); padding-left: 24px;">
              <h3 style="margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--md-sys-color-on-surface);">Quản lý tài khoản</h3>

              <div style="display: flex; align-items: center; gap: 8px;">
                <md-outlined-text-field label="Họ tên mới" value="${escapeHtml(student.full_name ?? '')}" style="flex: 1; --md-outlined-text-field-container-shape: 8px;" data-name-input="${student.id}"></md-outlined-text-field>
                <md-filled-tonal-button style="--md-filled-tonal-button-container-shape: 8px; height: 56px;" data-save-btn="${student.id}">
                  Lưu
                </md-filled-tonal-button>
              </div>

              <div style="display: flex; flex-direction: column; gap: 12px; margin-top: auto; padding-top: 12px;">
                <md-filled-tonal-button style="--md-filled-tonal-button-container-shape: 8px;" data-reset-btn="${student.id}">
                  <md-icon slot="icon">lock_reset</md-icon> Đặt lại mật khẩu
                </md-filled-tonal-button>
                <md-filled-button style="--md-filled-button-container-shape: 8px; --md-filled-button-container-color: var(--md-sys-color-error); --md-filled-button-label-text-color: var(--md-sys-color-on-error);" data-delete-btn="${student.id}">
                  <md-icon slot="icon">delete</md-icon> Xóa tài khoản
                </md-filled-button>
              </div>
            </div>
          </div>
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
    wireMaterialFormButtons(root);
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

export async function mountStudentGrades() {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang tải bảng điểm');
  try {
    const data = await fetchLearningPath(state.profile.role);
    const assignmentGroups = collectLearningPathAssignments(data);
    const totalAssignments = assignmentGroups.reduce((sum, g) => sum + g.assignments.length, 0);
    
    root.innerHTML = `
      <section class="panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Bảng điểm</p>
            <h2>${totalAssignments} bài tập về nhà</h2>
          </div>
        </div>
        ${assignmentGroups.length === 0 ? '<div class="empty-state">Chưa có bài tập về nhà.</div>' : ''}
        ${assignmentGroups.map(group => `
          <div style="margin-top: 32px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid var(--md-sys-color-surface-container-highest);">
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--md-sys-color-primary);">${escapeHtml(group.title)}</h3>
          </div>
          ${renderStudentGradesTable(group.assignments)}
        `).join('')}
      </section>
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
    <div class="assignments-list">
      ${assignments
        .map((assignment) => {
          const hasSubmitted = assignment.progress?.status === 'submitted';
          return `
            <div class="assignment-row">
              <div class="assignment-info">
                <h3>${escapeHtml(assignment.title)}</h3>
                <p>${escapeHtml(assignment.context ?? '-')}</p>
              </div>
              <div class="assignment-stats">
                <span class="assignment-status-badge ${hasSubmitted ? 'done' : 'pending'}">${hasSubmitted ? 'Đã làm' : 'Chưa làm'}</span>
                <div class="assignment-score">
                  ${
                    hasSubmitted
                      ? `<div class="score-progress-block"><span>${formatScore(assignment.progress.bestScore)}/10</span>${renderScoreProgress(assignment.progress.bestScore)}</div>`
                      : '<span class="muted">-</span>'
                  }
                </div>
                <md-filled-tonal-button href="#/assignment/${assignment.id}">
                  ${hasSubmitted ? 'Làm lại' : 'Làm bài'}
                </md-filled-tonal-button>
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

