import { state, isManager, pageRoot } from '../../store.js';
import { wireRouteRetry } from '../../router.js';
import { renderLoading, renderStateMessage, renderErrorState } from '../../lib/ui.js';
import { escapeHtml } from '../../lib/html.js';
import { driveFrame } from '../../lib/drive.js';
import { fetchLearningPath, fetchTeachingLogs } from '../../services/lmsApi.js';

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
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white">
                <rect x="3" y="3" width="8" height="8" rx="2.5"></rect>
                <rect x="13" y="3" width="8" height="8" rx="2.5"></rect>
                <rect x="13" y="13" width="8" height="8" rx="2.5"></rect>
                <rect x="3" y="13" width="8" height="8" rx="2.5"></rect>
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
            <div style="font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 15px; font-weight: 700; margin-bottom: 6px; line-height: 1;">
              Lịch thi
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
                <section class="panel nh-free-assignments" style="margin-top: 24px; display: none; padding: 24px; border-radius: 20px; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(69, 81, 32, 0.12); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);">
                  <div class="panel-heading" style="margin-bottom: 18px;">
                    <h2 style="font-family: 'Beautique Display', serif; font-size: 22px; color: #101828; margin: 0;">Bài tập tự do</h2>
                  </div>

                  <!-- Free Assignment Filter Pills -->
                  <div id="free-category-pills" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px;">
                    <button class="nh-pill-filter active" data-cat="all" style="padding: 6px 14px; border-radius: 20px; font-size: 12.5px; font-weight: 500; font-family: 'Be Vietnam Pro', sans-serif; border: 1px solid #455120; background: #455120; color: #ffffff; cursor: pointer; transition: all 0.2s ease;">Tất cả (${data.freeAssignments.length})</button>
                    ${(() => {
                      const cats = new Set();
                      data.freeAssignments.forEach(a => {
                        const title = a.title || '';
                        const tagMatch = title.match(/^\[([^\]]+)\]/);
                        let cat = tagMatch ? tagMatch[1].trim() : '';
                        if (!cat) {
                          if (title.includes('Đại số') || title.toLowerCase().includes('hàm số') || title.toLowerCase().includes('mũ') || title.toLowerCase().includes('logarit')) cat = 'Đại số & Giải tích';
                          else if (title.includes('Hình học') || title.toLowerCase().includes('tọa độ') || title.toLowerCase().includes('khối đa diện')) cat = 'Hình học';
                          else if (title.toLowerCase().includes('xác suất') || title.toLowerCase().includes('tổ hợp')) cat = 'Xác suất & Thống kê';
                          else if (title.toLowerCase().includes('đề') || title.toLowerCase().includes('luyện') || title.toLowerCase().includes('kiểm tra')) cat = 'Đề luyện tập';
                          else cat = 'Khác';
                        }
                        if (cat) cats.add(cat);
                      });
                      return Array.from(cats).map(c => `<button class="nh-pill-filter" data-cat="${escapeHtml(c)}" style="padding: 6px 14px; border-radius: 20px; font-size: 12.5px; font-weight: 500; font-family: 'Be Vietnam Pro', sans-serif; border: 1px solid #d0d5dd; background: #ffffff; color: #344054; cursor: pointer; transition: all 0.2s ease;">${escapeHtml(c)}</button>`).join('');
                    })()}
                  </div>

                  <!-- Free Assignment Grid -->
                  <div class="item-grid" id="free-assignments-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;">
                    ${data.freeAssignments.map(renderEnhancedFreeAssignmentCard).join('')}
                  </div>
                </section>
              `
        : ''
      }
        </main>
      </section>
    `;

    // Free assignment filter events
    const pills = root.querySelectorAll('.nh-pill-filter');
    const freeGrid = root.querySelector('#free-assignments-grid');

    const filterFreeAssignments = () => {
      if (!freeGrid || !data.freeAssignments) return;
      const activePill = root.querySelector('.nh-pill-filter.active');
      const selectedCat = activePill ? activePill.dataset.cat : 'all';

      const filtered = data.freeAssignments.filter(a => {
        const title = a.title || '';
        const tagMatch = title.match(/^\[([^\]]+)\]/);
        let cat = tagMatch ? tagMatch[1].trim() : '';
        if (!cat) {
          if (title.includes('Đại số') || title.toLowerCase().includes('hàm số') || title.toLowerCase().includes('mũ') || title.toLowerCase().includes('logarit')) cat = 'Đại số & Giải tích';
          else if (title.includes('Hình học') || title.toLowerCase().includes('tọa độ') || title.toLowerCase().includes('khối đa diện')) cat = 'Hình học';
          else if (title.toLowerCase().includes('xác suất') || title.toLowerCase().includes('tổ hợp')) cat = 'Xác suất & Thống kê';
          else if (title.toLowerCase().includes('đề') || title.toLowerCase().includes('luyện') || title.toLowerCase().includes('kiểm tra')) cat = 'Đề luyện tập';
          else cat = 'Khác';
        }

        return selectedCat === 'all' || cat === selectedCat;
      });

      if (filtered.length === 0) {
        freeGrid.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: #667085; font-family: 'Be Vietnam Pro', sans-serif;">
            <p style="margin: 0; font-size: 14px; font-weight: 500;">Không có bài tập tự do phù hợp</p>
          </div>
        `;
      } else {
        freeGrid.innerHTML = filtered.map(renderEnhancedFreeAssignmentCard).join('');
      }
    };

    pills.forEach(p => {
      p.addEventListener('click', () => {
        pills.forEach(item => {
          item.classList.remove('active');
          item.style.background = '#ffffff';
          item.style.color = '#344054';
          item.style.borderColor = '#d0d5dd';
        });
        p.classList.add('active');
        p.style.background = '#455120';
        p.style.color = '#ffffff';
        p.style.borderColor = '#455120';
        filterFreeAssignments();
      });
    });

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
          if (freeSection) freeSection.style.display = 'none';
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
    const lower = cleanedTitle.toLowerCase();
    if (cleanedTitle.includes('Đại số') || lower.includes('hàm số') || lower.includes('mũ') || lower.includes('logarit')) catTag = 'Đại số';
    else if (cleanedTitle.includes('Hình học') || lower.includes('tọa độ') || lower.includes('khối đa diện')) catTag = 'Hình học';
    else if (lower.includes('xác suất') || lower.includes('tổ hợp')) catTag = 'Xác suất';
    else if (lower.includes('đề') || lower.includes('luyện') || lower.includes('kiểm tra')) catTag = 'Đề thi';
    else catTag = 'Luyện tập';
  }

  if (isStudent && isPdfAssignment) {
    return `
      <div class="nh-free-card ${hasSubmitted ? 'completed' : ''}" style="background: #ffffff; border-radius: 16px; padding: 16px; border: 1px solid #eaecf0; display: flex; flex-direction: column; justify-content: space-between; gap: 12px; transition: all 0.2s ease; position: relative;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 12px; background: #f2f4f7; color: #344054; font-family: 'Be Vietnam Pro', sans-serif;">${escapeHtml(catTag)}</span>
            <span style="font-size: 11px; font-weight: 600; color: ${hasSubmitted ? '#455120' : '#d97706'}; display: flex; align-items: center; gap: 4px; font-family: 'Be Vietnam Pro', sans-serif;">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor;"></span>
              ${hasSubmitted ? 'Đã làm' : 'Chưa hoàn thành'}
            </span>
          </div>
          <h3 style="font-size: 14.5px; font-weight: 600; color: #101828; margin: 0 0 6px 0; line-height: 1.4; font-family: 'Be Vietnam Pro', sans-serif;">${escapeHtml(cleanedTitle)}</h3>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f2f4f7; margin-top: 4px; padding-top: 8px;">
          <div style="font-size: 12px; color: #667085; display: flex; gap: 8px; font-family: 'Be Vietnam Pro', sans-serif;">
            <span>${questionsCount} câu</span>
            ${timeLimit ? `<span>•</span><span>${timeLimit}</span>` : ''}
          </div>
          <a class="locked-pdf-chip" href="javascript:void(0)" data-pdf-locked="true" style="font-size: 12.5px; font-weight: 600; color: #455120; text-decoration: none; display: flex; align-items: center; gap: 4px; font-family: 'Be Vietnam Pro', sans-serif;">
            Chi tiết <md-icon style="font-size: 16px;">arrow_forward</md-icon>
          </a>
        </div>
      </div>
    `;
  }

  return `
    <div class="nh-free-card ${hasSubmitted ? 'completed' : ''}" style="background: #ffffff; border-radius: 16px; padding: 16px; border: 1px solid #eaecf0; display: flex; flex-direction: column; justify-content: space-between; gap: 12px; transition: all 0.2s ease; position: relative;">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 12px; background: #f2f4f7; color: #344054; font-family: 'Be Vietnam Pro', sans-serif;">${escapeHtml(catTag)}</span>
          <span style="font-size: 11px; font-weight: 600; color: ${hasSubmitted ? '#455120' : '#d97706'}; display: flex; align-items: center; gap: 4px; font-family: 'Be Vietnam Pro', sans-serif;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor;"></span>
            ${hasSubmitted ? 'Đã làm' : 'Chưa làm'}
          </span>
        </div>
        <h3 style="font-size: 14.5px; font-weight: 600; color: #101828; margin: 0 0 6px 0; line-height: 1.4; font-family: 'Be Vietnam Pro', sans-serif;">${escapeHtml(cleanedTitle)}</h3>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f2f4f7; margin-top: 4px; padding-top: 8px;">
        <div style="font-size: 12px; color: #667085; display: flex; gap: 8px; font-family: 'Be Vietnam Pro', sans-serif;">
          <span>${questionsCount} câu</span>
          ${timeLimit ? `<span>•</span><span>${timeLimit}</span>` : ''}
        </div>
        <a href="#/assignment/${assignment.id}" style="font-size: 12.5px; font-weight: 600; color: #455120; text-decoration: none; display: flex; align-items: center; gap: 4px; font-family: 'Be Vietnam Pro', sans-serif;">
          Làm bài <md-icon style="font-size: 16px;">arrow_forward</md-icon>
        </a>
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
