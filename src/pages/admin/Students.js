import { state, pageRoot } from '../../store.js';
import { wireRouteRetry } from '../../router.js';
import { toast, renderAccountAvatar, renderSkeletonDashboard, renderErrorState } from '../../lib/ui.js';
import { escapeHtml, option, setButtonLoading } from '../../lib/html.js';
import { formatScore } from '../../lib/format.js';
import {
  presenceTarget,
  getOnlineUsers,
  fetchLearningPath,
  fetchAssignmentsForManager,
  fetchStudents,
  createManagedUser,
  deleteManagedUser,
  fetchGradebook,
  invokeAdminFunction,
  fetchTeachingLogs,
  upsertTeachingLog,
  deleteTeachingLog,
} from '../../services/lmsApi.js';

let selectedStudentId = null;

function splitStudentChapterTitle(title = '', fallbackIndex = 1) {
  const match = title.match(/^(Chương\s*\d+)\s*[:\-–]\s*(.+)$/i);
  if (match) {
    return { short: match[1].trim(), sub: match[2].trim() };
  }
  return { short: `Chương ${fallbackIndex}`, sub: title.trim() || `Chương ${fallbackIndex}` };
}

export async function mountProgressManager() {
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

    let currentStudentId = students[0].id;
    let activeTab = 'progress';
    let activeModuleId = null;

    const lecturesByModuleId = new Map();
    for (const lecture of learningPath.lectures || []) {
      if (!lecturesByModuleId.has(lecture.module_id)) lecturesByModuleId.set(lecture.module_id, []);
      lecturesByModuleId.get(lecture.module_id).push(lecture);
    }
    const totalLectures = (learningPath.lectures || []).length;

    const phaseChapters = [];
    for (const phase of learningPath.phases || []) {
      const mods = (phase.modules || [])
        .map((mod, idx) => {
          const lectures = lecturesByModuleId.get(mod.id) ?? [];
          if (!lectures.length) return null;
          const parsed = splitStudentChapterTitle(mod.title, idx + 1);
          return { mod, lectures, short: parsed.short, sub: parsed.sub };
        })
        .filter(Boolean);
      if (mods.length) {
        phaseChapters.push({ phase, mods });
      }
    }
    const allModulesFlat = phaseChapters.flatMap((p) => p.mods);
    if (!activeModuleId && allModulesFlat.length) {
      activeModuleId = allModulesFlat[0].mod.id;
    }

    const taughtCache = new Map();

    async function ensureTaughtSet(studentId) {
      if (taughtCache.has(studentId)) return taughtCache.get(studentId);
      const logs = await fetchTeachingLogs(studentId);
      const set = new Set(logs.map((l) => l.lecture_id));
      taughtCache.set(studentId, set);
      return set;
    }

    root.innerHTML = `
      <section class="students-hub">
        <header class="asg-overview-hero">
          <a href="#/manage" class="phase-back-link">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            <span>Trung tâm Quản trị</span>
          </a>
          <div class="asg-overview-hero-row">
            <div class="asg-overview-hero-left">
              <h1 class="phase-hero-title">Theo dõi Học sinh</h1>
            </div>
          </div>
        </header>

        <div class="students-top-row">
          <div class="students-pill-bar" id="students-pill-bar"></div>
          <div class="students-subtabs" id="students-subtabs">
            <button type="button" class="students-subtab active" data-tab="progress">Tiến độ</button>
            <button type="button" class="students-subtab" data-tab="grades">Bảng điểm</button>
          </div>
        </div>

        <div class="progress-detail-pane" id="students-detail-host"></div>
      </section>
    `;

    function renderStudentPills() {
      const bar = root.querySelector('#students-pill-bar');
      if (!bar) return;
      const onlineSet = new Set(getOnlineUsers().map((u) => u.id));
      bar.innerHTML = students.map((s) => {
        const isActive = s.id === currentStudentId;
        const isOnline = onlineSet.has(s.id);
        return `
          <button type="button" class="students-pill ${isActive ? 'active' : ''}" data-sid="${escapeHtml(s.id)}">
            <span class="students-dot ${isOnline ? 'is-online' : ''}" title="${isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}"></span>
            <span>${escapeHtml(s.full_name || 'Học sinh')}</span>
          </button>
        `;
      }).join('');

      bar.querySelectorAll('[data-sid]').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentStudentId = btn.dataset.sid;
          renderStudentPills();
          renderStudentDetail(currentStudentId);
        });
      });
    }

    function syncSubtabs() {
      root.querySelectorAll('#students-subtabs [data-tab]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === activeTab);
      });
    }

    root.querySelectorAll('#students-subtabs [data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        syncSubtabs();
        renderStudentDetail(currentStudentId);
      });
    });

    async function renderStudentDetail(studentId) {
      const pane = root.querySelector('#students-detail-host');
      if (!pane) return;
      const student = students.find((s) => s.id === studentId);
      if (!student) return;

      if (activeTab === 'progress') {
        if (!taughtCache.has(studentId)) {
          pane.innerHTML = `<div class="phase-empty-card"><p>Đang tải tiến độ...</p></div>`;
        }
        try {
          const taughtSet = await ensureTaughtSet(studentId);
          if (currentStudentId !== studentId || activeTab !== 'progress') return;

          const taughtCount = (learningPath.lectures || []).filter((l) => taughtSet.has(l.id)).length;
          const progressPct = totalLectures > 0 ? Math.round((taughtCount / totalLectures) * 100) : 0;

          if (!allModulesFlat.length) {
            pane.innerHTML = `<div class="phase-empty-card"><p>Chưa có bài giảng nào trong hệ thống.</p></div>`;
            return;
          }

          const activeEntry = allModulesFlat.find((m) => String(m.mod.id) === String(activeModuleId)) || allModulesFlat[0];
          activeModuleId = activeEntry.mod.id;

          const checkSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

          const renderLectureRow = (lecture) => {
            const isTaught = taughtSet.has(lecture.id);
            return `
              <button type="button" class="students-lecture-row ${isTaught ? 'is-taught' : ''}" data-lecture-id="${escapeHtml(String(lecture.id))}">
                <span class="students-check ${isTaught ? 'is-checked' : ''}">${checkSvg}</span>
                <span class="students-lecture-title">${escapeHtml(lecture.title)}</span>
              </button>
            `;
          };

          const groups = activeEntry.mod.lecture_groups || [];
          let chapterBodyHtml = '';
          if (groups.length) {
            for (const group of groups) {
              const rows = (group.lectures || []).map(renderLectureRow).join('');
              if (!rows) continue;
              chapterBodyHtml += `
                <div class="phase-group-section">
                  ${group.title ? `<div class="phase-group-title">${escapeHtml(group.title)}</div>` : ''}
                  <div class="students-lecture-list">${rows}</div>
                </div>
              `;
            }
            const ungrouped = activeEntry.lectures.filter((l) => !l.group_id).map(renderLectureRow).join('');
            if (ungrouped) {
              chapterBodyHtml += `<div class="phase-group-section"><div class="students-lecture-list">${ungrouped}</div></div>`;
            }
          } else {
            chapterBodyHtml = `<div class="phase-group-section"><div class="students-lecture-list">${activeEntry.lectures.map(renderLectureRow).join('')}</div></div>`;
          }

          const activeDone = activeEntry.lectures.filter((l) => taughtSet.has(l.id)).length;

          pane.innerHTML = `
            <div class="students-progress-layout">
              <aside class="students-progress-side">
                <div class="students-progress-box">
                  <div class="students-progress-head">
                    <span class="students-progress-k">Hoàn thành</span>
                    <strong class="students-progress-v">${taughtCount}/${totalLectures} bài (${progressPct}%)</strong>
                  </div>
                  <div class="learn-progress-track">
                    <div class="learn-progress-fill" style="width: ${progressPct}%;"></div>
                  </div>
                </div>

                <div class="students-chapter-nav">
                  ${phaseChapters.map((group) => `
                    <div class="students-phase-group">
                      <div class="students-phase-label">${escapeHtml(group.phase.title)}</div>
                      ${group.mods.map((entry) => {
                        const done = entry.lectures.filter((l) => taughtSet.has(l.id)).length;
                        const isSel = String(entry.mod.id) === String(activeModuleId);
                        return `
                          <button type="button" class="phase-chapter-btn ${isSel ? 'active' : ''}" data-mod-id="${escapeHtml(String(entry.mod.id))}">
                            <div class="phase-chapter-btn-text">
                              <span class="phase-chapter-short">${escapeHtml(entry.short)}</span>
                              <span class="phase-chapter-sub">${escapeHtml(entry.sub)}</span>
                            </div>
                            <span class="phase-chapter-count">${done}/${entry.lectures.length}</span>
                          </button>
                        `;
                      }).join('')}
                    </div>
                  `).join('')}
                </div>
              </aside>

              <section class="phase-chapter-card">
                <div class="phase-chapter-card-head">
                  <h2 class="phase-chapter-card-title">${escapeHtml(activeEntry.mod.title)}</h2>
                  <span class="phase-chapter-card-badge">${activeDone}/${activeEntry.lectures.length}</span>
                </div>
                ${chapterBodyHtml}
              </section>
            </div>
          `;

          pane.querySelectorAll('[data-mod-id]').forEach((btn) => {
            btn.addEventListener('click', () => {
              activeModuleId = btn.dataset.modId;
              renderStudentDetail(studentId);
            });
          });

          pane.querySelectorAll('.students-lecture-row').forEach((btn) => {
            btn.addEventListener('click', async () => {
              const lectureId = btn.dataset.lectureId;
              const wasTaught = taughtSet.has(lectureId);
              if (wasTaught) taughtSet.delete(lectureId);
              else taughtSet.add(lectureId);
              renderStudentDetail(studentId);

              try {
                if (!wasTaught) await upsertTeachingLog({ studentId, lectureId });
                else await deleteTeachingLog({ studentId, lectureId });
              } catch (err) {
                if (wasTaught) taughtSet.add(lectureId);
                else taughtSet.delete(lectureId);
                toast(err.message, 'error');
                renderStudentDetail(studentId);
              }
            });
          });
        } catch (err) {
          pane.innerHTML = `<div class="phase-empty-card"><p>Lỗi: ${escapeHtml(err.message)}</p></div>`;
        }
      } else if (activeTab === 'grades') {
        const studentGrades = gradebook.filter((g) => g.student_id === studentId);
        if (!studentGrades.length) {
          pane.innerHTML = `<div class="phase-empty-card"><p>Học sinh chưa có bài nộp nào.</p></div>`;
          return;
        }
        const fmt = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
        pane.innerHTML = `
          <section class="grades-card">
            ${studentGrades.map((g) => {
              const dateStr = g.submitted_at ? new Date(g.submitted_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '-';
              const score10 = g.score_10 != null ? Number(g.score_10) : (g.max_points ? (g.score / g.max_points) * 10 : 0);
              const title = (g.assignments?.title || 'Bài kiểm tra').replace(/Bài tập về nhà/gi, 'Bài tập');
              return `
                <a href="#/review/${g.id}" class="grades-row">
                  <div class="grades-row-main">
                    <div class="grades-row-title">${escapeHtml(title)}</div>
                    <div class="grades-row-context">Nộp lúc ${escapeHtml(dateStr)}</div>
                  </div>
                  <div class="grades-row-right">
                    <span class="grades-score ${score10 >= 8 ? 'is-good' : ''}">${fmt.format(score10)}<span class="grades-score-max">/10</span></span>
                    <span class="grades-row-arrow" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    </span>
                  </div>
                </a>
              `;
            }).join('')}
          </section>
        `;
      }
    }

    const onPresenceChange = () => renderStudentPills();
    presenceTarget.addEventListener('change', onPresenceChange);

    renderStudentPills();
    syncSubtabs();
    await renderStudentDetail(currentStudentId);
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
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
          <details style="margin-top: 24px; border: 1px solid #E4E6DE; border-radius: 12px; background: #ffffff;">
            <summary style="padding: 16px; font-weight: 600; cursor: pointer; color: #181B16; outline: none; list-style: none;">
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


export function mountOnlineUsers() {
  const root = pageRoot();

  function renderOnlineUsers() {
    const users = getOnlineUsers();
    root.innerHTML = `
      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Học sinh đang online (${users.length})</h2>
          </div>
        </div>
        ${users.length > 0 ? `
          <div class="student-list" style="padding: 20px;">
            ${users.map(u => `
              <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--md-sys-color-surface-container-low); border-radius: 8px; margin-bottom: 8px;">
                ${renderAccountAvatar(u)}
                <div>
                  <div style="font-weight: 500;">${escapeHtml(u.full_name)}</div>
                  <div style="font-size: 0.85rem; color: var(--md-sys-color-on-surface-variant); display: flex; align-items: center; gap: 6px;">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: #4caf50;"></div>
                    Online từ ${new Date(u.online_at).toLocaleTimeString('vi-VN')}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="empty-state">Hiện không có ai đang online.</div>
        `}
      </section>
    `;
  }

  renderOnlineUsers();
  const onChange = () => renderOnlineUsers();
  presenceTarget.addEventListener('change', onChange);

  const observer = new MutationObserver(() => {
    if (!document.body.contains(root)) {
      presenceTarget.removeEventListener('change', onChange);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
