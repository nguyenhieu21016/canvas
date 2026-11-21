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


export function mountOnlineUsers() {
  const root = pageRoot();

  function renderOnlineUsers() {
    const users = getOnlineUsers();
    root.innerHTML = `
      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Học sinh đang online (${users.length})</h2>
            <p class="muted">Danh sách những người đang mở ứng dụng.</p>
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
