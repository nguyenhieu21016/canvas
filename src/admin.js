import { normalizeAssignmentEditor, normalizeEditorQuestion } from './lib/assignment.js';
// admin.js - Lazy loaded module for admin routes
import '@material/web/iconbutton/icon-button.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import { supabase } from './services/supabaseClient.js';
import { formatDateTime, formatScore, roleLabel } from "./lib/format.js";
import { setButtonLoading, option, renderLatexText } from "./lib/html.js";
import { toDrivePreviewUrl } from './lib/drive.js';
import {
  fetchLearningPath, fetchAssignmentsForManager,
  fetchStudents, fetchGradebook, upsertPhase, deletePhase, upsertModule, deleteModule,
  upsertLecture, deleteLecture, upsertLectureGroup, deleteLectureGroup,
  deleteAssignment, reorderContentNodes as reorderContentNodesApi,
  invokeAdminFunction, createManagedUser, fetchAssignmentEditor, regradeAssignment,
  deleteManagedUser, saveAssignmentWithQuestions, uploadAssignmentImage,
  fetchSalaryMonth, upsertSalarySchedule, deleteSalarySchedule, setSessionState,
  getOnlineUsers, presenceTarget
} from "./services/lmsApi.js";
import { state, pageRoot, wireRouteRetry, escapeHtml, isManager, renderAttemptsTable, isAdmin } from './main.js';
import { renderLoading, renderErrorState, wireTableSearch, toast, renderMetric, wireMaterialFormButtons, renderSkeletonAssignments, renderAccountAvatar } from './lib/ui.js';

export function mountManageHub() {
  const root = pageRoot();
  const items = [
    {
      href: '#/progress',
      icon: 'track_changes',
      title: 'Tiến độ học',
      description: 'Theo dõi tình hình học tập và lộ trình làm bài của từng học sinh.',
      tag: 'TIẾN ĐỘ'
    },
    {
      href: '#/content',
      icon: 'folder',
      title: 'Nội dung khóa học',
      description: 'Quản lý cấu trúc giai đoạn, Chương, Bài học và tài liệu bài giảng.',
      tag: 'KHÓA HỌC'
    },
    {
      href: '#/assignments',
      icon: 'edit_note',
      title: 'Đề thi & Bài tập',
      description: 'Tạo đề kiểm tra, cài đặt đáp án, phiếu trả lời và chấm bài làm.',
      tag: 'ĐỀ THI'
    },
    {
      href: '#/salary',
      icon: 'payments',
      title: 'Lịch dạy & Lương',
      description: 'Cập nhật điểm danh lịch dạy hàng tháng và tổng hợp thống kê thu nhập.',
      tag: 'LƯƠNG & LỊCH'
    },
    {
      href: '#/online',
      icon: 'people_alt',
      title: 'Đang hoạt động',
      description: 'Theo dõi danh sách học sinh đang truy cập và học trực tuyến.',
      tag: 'TRUY CẬP'
    },
  ];

  root.innerHTML = `
    <div style="background: #EDF2E4; min-height: calc(100vh - 64px); padding: 36px max(var(--page-gutter), 24px);">
      <div style="max-width: 1140px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px;">
        
        <!-- Header Banner -->
        <div style="background: #ffffff; border-radius: 20px; border: 1px solid #D8E2C4; padding: 28px 36px; box-shadow: 0 2px 10px rgba(69, 81, 32, 0.04);">
          <h1 style="font-family: 'Beautique Display', serif; font-size: 24px; font-weight: 700; color: #101828; margin: 0 0 6px 0;">Trung tâm Quản trị</h1>
          <p style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 13.5px; color: #667085; margin: 0;">Quản lý toàn bộ hệ thống nội dung khóa học, bài tập, học sinh và giảng dạy</p>
        </div>

        <!-- Cards Grid -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
          ${items.map((item) => `
            <a href="${item.href}" style="text-decoration: none; background: #ffffff; border-radius: 18px; border: 1px solid #D8E2C4; padding: 24px; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(69, 81, 32, 0.03);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 24px rgba(69, 81, 32, 0.08)'" onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 8px rgba(69, 81, 32, 0.03)'">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                  <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 11px; font-weight: 700; color: #455120; letter-spacing: 0.08em; background: #F0F4E8; padding: 4px 10px; border-radius: 6px;">${item.tag}</span>
                  <div style="width: 36px; height: 36px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; color: #455120;">
                    <md-icon style="font-size: 20px;">${item.icon}</md-icon>
                  </div>
                </div>

                <h3 style="font-family: 'Beautique Display', serif; font-size: 19px; font-weight: 700; color: #101828; margin: 0 0 8px 0;">${escapeHtml(item.title)}</h3>
                <p style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 13.5px; line-height: 1.5; color: #667085; margin: 0;">${escapeHtml(item.description)}</p>
              </div>

              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed #e2e8f0; display: flex; align-items: center; justify-content: space-between; color: #455120; font-family: 'Beautique Display', serif; font-size: 13.5px; font-weight: 700;">
                <span>Truy cập quản lý</span>
                <md-icon style="font-size: 17px;">arrow_forward</md-icon>
              </div>
            </a>
          `).join('')}
        </div>

      </div>
    </div>
  `;
}





let currentContentPhaseId = null;

export async function mountContentManager() {
  const root = pageRoot();
  root.innerHTML = renderLoading();
  try {
    const [data, students] = await Promise.all([
      fetchLearningPath(state.profile.role),
      fetchStudents()
    ]);

    if (data.phases.length > 0 && !currentContentPhaseId) {
      currentContentPhaseId = data.phases[0].id;
    }

    root.innerHTML = `
      <style>
        .content-manager-layout {
          display: flex;
          flex-wrap: wrap; /* Fix cutoff on smaller screens */
          gap: 24px;
          align-items: flex-start;
          padding: 24px;
          width: 100%;
          box-sizing: border-box;
          height: calc(100vh - var(--actual-topbar-height, 88px));
          overflow: hidden;
        }
        .phase-list-column {
          width: 280px;
          flex-shrink: 0;
          background: var(--md-sys-color-surface);
          border-radius: 16px;
          border: 1px solid var(--md-sys-color-outline-variant);
          padding: 16px;
          max-height: 100%;
          height: fit-content;
          overflow-y: auto;
        }
        .phase-list-item {
          padding: 12px 24px;
          border-radius: 100px;
          cursor: pointer;
          margin-bottom: 8px;
          font-weight: 500;
          transition: background 0.2s, color 0.2s;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: var(--md-sys-color-on-surface-variant);
        }
        .phase-list-item:hover {
          background: var(--md-sys-color-surface-container-highest);
          color: var(--md-sys-color-on-surface);
        }
        .phase-list-item.active {
          background: var(--md-sys-color-secondary-container);
          color: var(--md-sys-color-on-secondary-container);
          font-weight: 600;
        }
        .phase-list-item .active-icon { display: none; }
        .phase-list-item.active .active-icon { display: block; }
        .structure-column {
          flex: 1;
          min-width: 300px;
          background: var(--md-sys-color-surface);
          border-radius: 16px;
          border: 1px solid var(--md-sys-color-outline-variant);
          padding: 24px;
          height: 100%;
          overflow-y: auto;
        }
        /* Tree Hierarchy Styles */
        .structure-children {
          margin-left: 20px;
          padding-left: 16px;
          border-left: 2px solid var(--md-sys-color-surface-container-highest);
          position: relative;
        }
        .manage-node {
          padding: 12px 0;
          border-bottom: 1px solid var(--md-sys-color-outline-variant);
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .manage-node:last-child {
          border-bottom: none;
        }
        .toggle-children {
          display: flex;
          align-items: flex-start;
          cursor: pointer;
          flex: 1;
          min-width: 0;
        }
        .toggle-children strong {
          white-space: normal;
          word-break: break-word;
          margin-top: 2px;
          line-height: 1.4;
        }
        .node-meta {
          margin-left: 8px;
          margin-top: 4px;
          white-space: nowrap;
          color: var(--md-sys-color-on-surface-variant);
          font-size: 0.85rem;
        }
        /* Level Colors & Typography */
        .manage-node[data-entity="phase"] strong { font-size: 1.1rem; color: var(--md-sys-color-primary); }
        .manage-node[data-entity="module"] strong { font-size: 1rem; color: var(--md-sys-color-on-surface); font-weight: 600; }
        .manage-node[data-entity="lectureGroup"] strong { font-size: 0.95rem; color: var(--md-sys-color-on-surface); font-weight: 600; }
        .manage-node[data-entity="lecture"] strong { font-size: 0.95rem; font-weight: 400; color: var(--md-sys-color-on-surface); }
        
        .icon-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .editor-column {
          width: 360px;
          flex-shrink: 0;
          background: var(--md-sys-color-surface-container-low);
          border-radius: 16px;
          padding: 24px;
          max-height: 100%;
          height: fit-content;
          overflow-y: auto;
        }
        .editor-column .entity-form { display: none; }
        .editor-column .entity-form.active { display: grid; }
        .editor-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: var(--md-sys-color-on-surface-variant);
          background: var(--md-sys-color-surface-container);
          border-radius: 24px;
          padding: 60px 24px;
          gap: 16px;
        }
        .editor-placeholder.hidden { display: none; }
        
        /* Responsive */
        @media (max-width: 1100px) {
          .editor-column { width: 100%; position: static; }
        }
      </style>
      <div class="content-manager-layout">
        <aside class="phase-list-column">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h2 style="margin: 0; font-size: 1.2rem; font-weight: 600;">Giai đoạn</h2>
            <md-icon-button data-create="phase" aria-label="Thêm Giai đoạn"><md-icon>add</md-icon></md-icon-button>
          </div>
          <div id="phase-list-container">
            ${renderPhaseList(data.phases, currentContentPhaseId)}
          </div>
        </aside>

        <section class="structure-column">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
            <h2 style="margin: 0; font-size: 1.5rem; font-weight: 600; color: var(--md-sys-color-on-surface);">Cấu trúc chi tiết</h2>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <md-outlined-button data-create="module"><md-icon slot="icon">add</md-icon>Chương</md-outlined-button>
              <md-outlined-button data-create="lectureGroup"><md-icon slot="icon">add</md-icon>Nhóm</md-outlined-button>
              <md-outlined-button data-create="lecture"><md-icon slot="icon">add</md-icon>Bài giảng</md-outlined-button>
            </div>
          </div>
          <div id="manage-structure-container">
            ${renderActivePhaseStructure(data.phases, currentContentPhaseId)}
          </div>
        </section>

        <aside class="editor-column panel">
          <div class="editor-placeholder" id="content-editor-placeholder">
            <md-icon style="font-size: 48px; width: 48px; height: 48px; color: var(--md-sys-color-outline-variant);">edit_note</md-icon>
            <p style="margin: 0; font-size: 0.95rem; color: var(--md-sys-color-on-surface-variant);">Chọn một mục bên trái để sửa hoặc bấm nút Thêm mới.</p>
          </div>
          <div id="content-forms-container">
            ${renderPhaseForm(students)}
            ${renderModuleForm(data.phases)}
            ${renderLectureGroupForm(data.phases, data.modules)}
            ${renderLectureForm(data.phases, data.modules, data.lectureGroups)}
          </div>
        </aside>
      </div>
    `;

    // Dynamically calculate topbar height for perfect sticky offset
    setTimeout(() => {
      const topbar = document.querySelector('.topbar');
      if (topbar) {
        document.documentElement.style.setProperty('--actual-topbar-height', topbar.getBoundingClientRect().height + 'px');
      }
    }, 50);

    wireContentForms(data);
    wirePhaseSelection(data);
    wireCascadingDropdowns(root);
    wireMaterialFormButtons(root);
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

export function renderPhaseList(phases, activeId) {
  if (!phases.length) return '<div class="empty-state" style="padding: 16px;">Chưa có Giai đoạn</div>';
  return phases.map(p => `
    <div class="phase-list-item ${p.id === activeId ? 'active' : ''}" data-phase-id="${p.id}">
      <span>${escapeHtml(p.title)}</span>
      <md-icon class="active-icon" style="font-size: 20px;">chevron_right</md-icon>
    </div>
  `).join('');
}

export function renderActivePhaseStructure(phases, activeId) {
  const activePhase = phases.find(p => p.id === activeId);
  if (!activePhase) return '<div class="empty-state">Vui lòng chọn một giai đoạn.</div>';
  return renderManagePhase(activePhase);
}

export function wirePhaseSelection(pathData) {
  document.querySelectorAll('.phase-list-item').forEach(item => {
    item.addEventListener('click', () => {
      const phaseId = item.dataset.phaseId;
      if (phaseId === currentContentPhaseId) return;
      currentContentPhaseId = phaseId;

      // Update list active state
      document.querySelectorAll('.phase-list-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');

      // Update middle column
      const container = document.getElementById('manage-structure-container');
      if (container) {
        container.innerHTML = renderActivePhaseStructure(pathData.phases, currentContentPhaseId);
        wireStructureEvents();
      }

      // Reset right column form
      document.getElementById('content-editor-placeholder')?.classList.remove('hidden');
      document.querySelectorAll('.editor-column .entity-form').forEach(f => f.classList.remove('active'));
    });
  });
}

export function renderPhaseForm(students = []) {
  return `
    <form class="entity-form compact-entity-form" data-entity="phase">
      <div class="entity-form-heading">
        <md-icon>flag</md-icon>
        <h3>Giai đoạn</h3>
      </div>
      <input type="hidden" name="id">
      <input type="hidden" name="description" value="">
      <input type="hidden" name="sort_order" value="0">
      <input type="hidden" name="published" value="true">
      <input class="field" name="title" placeholder="Tên giai đoạn" required>
      <div class="field" style="max-height: 120px; overflow-y: auto; border: 1px solid var(--md-sys-color-outline-variant); padding: 8px; border-radius: 8px;">
        <div style="font-size: 0.85rem; font-weight: 500; margin-bottom: 8px; color: var(--md-sys-color-on-surface-variant);">Hiển thị cho học sinh (để trống = tất cả):</div>
        ${students.map(s => `
          <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 0.9rem; cursor: pointer;">
            <input type="checkbox" name="student_ids" value="${escapeHtml(s.id)}">
            ${escapeHtml(s.full_name)}
          </label>
        `).join('')}
      </div>
      <div class="button-row">
        <md-filled-button type="submit"><md-icon slot="icon">save</md-icon>Lưu</md-filled-button>
        <md-outlined-button type="reset">Mới</md-outlined-button>
      </div>
    </form>
  `;
}

export function renderModuleForm(phases) {
  return `
    <form class="entity-form compact-entity-form" data-entity="module">
      <div class="entity-form-heading">
        <md-icon>folder</md-icon>
        <h3>Chương</h3>
      </div>
      <input type="hidden" name="id">
      <input type="hidden" name="description" value="">
      <input type="hidden" name="sort_order" value="0">
      <input type="hidden" name="published" value="true">
      <select class="field" name="phase_id" required>
        <option value="">Chọn giai đoạn</option>
        ${phases.map((phase) => option(phase.id, phase.title)).join('')}
      </select>
      <input class="field" name="title" placeholder="Tên Chương" required>
      <div class="button-row">
        <md-filled-button type="submit"><md-icon slot="icon">save</md-icon>Lưu</md-filled-button>
        <md-outlined-button type="reset">Mới</md-outlined-button>
      </div>
    </form>
  `;
}

export function renderLectureGroupForm(phases, modules) {
  return `
    <form class="entity-form compact-entity-form" data-entity="lectureGroup">
      <div class="entity-form-heading">
        <md-icon>auto_stories</md-icon>
        <h3>Bài học</h3>
      </div>
      <input type="hidden" name="id">
      <input type="hidden" name="description" value="">
      <input type="hidden" name="sort_order" value="0">
      <input type="hidden" name="published" value="true">
      <select class="field cascade-phase" name="phase_id" required>
        <option value="">Chọn giai đoạn</option>
        ${phases.map((phase) => option(phase.id, phase.title)).join('')}
      </select>
      <select class="field cascade-module" name="module_id" required disabled>
        <option value="">Chọn Chương</option>
        ${modules.map((module) => `<option value="${escapeHtml(module.id)}" data-phase-id="${escapeHtml(module.phase_id)}">${escapeHtml(module.title)}</option>`).join('')}
      </select>
      <input class="field" name="title" placeholder="Tên nhóm, ví dụ: Bài giảng 1" required>
      <div class="button-row">
        <md-filled-button type="submit"><md-icon slot="icon">save</md-icon>Lưu</md-filled-button>
        <md-outlined-button type="reset">Mới</md-outlined-button>
      </div>
    </form>
  `;
}

export function renderLectureForm(phases, modules, lectureGroups) {
  return `
    <form class="entity-form compact-entity-form" data-entity="lecture">
      <div class="entity-form-heading">
        <md-icon>article</md-icon>
        <h3>Bài giảng</h3>
      </div>
      <input type="hidden" name="id">
      <input type="hidden" name="description" value="">
      <input type="hidden" name="sort_order" value="0">
      <input type="hidden" name="published" value="true">
      <select class="field cascade-phase" name="phase_id" required>
        <option value="">Chọn giai đoạn</option>
        ${phases.map((phase) => option(phase.id, phase.title)).join('')}
      </select>
      <select class="field cascade-module" name="module_id" required disabled>
        <option value="">Chọn Chương</option>
        ${modules.map((module) => `<option value="${escapeHtml(module.id)}" data-phase-id="${escapeHtml(module.phase_id)}">${escapeHtml(module.title)}</option>`).join('')}
      </select>
      <select class="field cascade-group" name="group_id" disabled>
        <option value="">Chưa nhóm</option>
        ${lectureGroups.map((group) => `<option value="${escapeHtml(group.id)}" data-module-id="${escapeHtml(group.module_id)}">${escapeHtml(group.title)}</option>`).join('')}
      </select>
      <input class="field" name="title" placeholder="Tên bài giảng" required>
      <input class="field" name="slide_url" placeholder="Link Google Drive slide">
      <div class="button-row">
        <md-filled-button type="submit"><md-icon slot="icon">save</md-icon>Lưu</md-filled-button>
        <md-outlined-button type="reset">Mới</md-outlined-button>
      </div>
    </form>
  `;
}

export function renderManagePhase(phase) {
  return `
    <div class="manage-node" data-entity="phase" data-parent="root" data-id="${phase.id}" data-payload="${escapeHtml(JSON.stringify(phase))}">
      <div class="toggle-children" aria-expanded="true">
        <md-icon class="expand-icon" style="margin-right: 4px; transition: transform 0.2s; color: var(--md-sys-color-outline);">expand_more</md-icon>
        <strong>${escapeHtml(phase.title)}</strong>
        <span class="node-meta">${phase.modules.length} Chương</span>
      </div>
      <div class="icon-actions">
        <md-icon-button data-edit-phase="${phase.id}" data-payload="${escapeHtml(JSON.stringify(phase))}" aria-label="Sửa giai đoạn"><md-icon>edit</md-icon></md-icon-button>
        <md-icon-button data-delete-phase="${phase.id}" aria-label="Xóa giai đoạn"><md-icon>delete</md-icon></md-icon-button>
      </div>
    </div>
    <div class="structure-children">
    ${phase.modules
      .map(
        (module) => `
          <div class="manage-node child" data-entity="module" data-parent="${phase.id}" data-id="${module.id}" data-payload="${escapeHtml(JSON.stringify(module))}">
            <div class="toggle-children" aria-expanded="true">
              <md-icon class="expand-icon" style="margin-right: 4px; transition: transform 0.2s; color: var(--md-sys-color-outline);">expand_more</md-icon>
              <strong>${escapeHtml(module.title)}</strong>
              <span class="node-meta">${module.lecture_groups.length} nhóm · ${module.lectures.length} bài giảng</span>
            </div>
            <div class="icon-actions">
              <md-icon-button data-edit-module="${module.id}" data-payload="${escapeHtml(JSON.stringify(module))}" aria-label="Sửa Chương"><md-icon>edit</md-icon></md-icon-button>
              <md-icon-button data-delete-module="${module.id}" aria-label="Xóa Chương"><md-icon>delete</md-icon></md-icon-button>
            </div>
          </div>
          <div class="structure-children">
          ${module.lecture_groups
            .map(
              (group) => `
                <div class="manage-node grandchild" data-entity="lectureGroup" data-parent="${module.id}" data-id="${group.id}" data-payload="${escapeHtml(JSON.stringify(group))}">
                  <div class="toggle-children" aria-expanded="false">
                    <md-icon class="expand-icon" style="margin-right: 4px; transition: transform 0.2s; transform: rotate(-90deg); color: var(--md-sys-color-outline);">expand_more</md-icon>
                    <strong>${escapeHtml(group.title)}</strong>
                    <span class="node-meta">${group.lectures.length} bài giảng</span>
                  </div>
                  <div class="icon-actions">
                    <md-icon-button data-edit-lecture-group="${group.id}" data-payload="${escapeHtml(JSON.stringify(group))}" aria-label="Sửa Bài học"><md-icon>edit</md-icon></md-icon-button>
                    <md-icon-button data-delete-lecture-group="${group.id}" aria-label="Xóa Bài học"><md-icon>delete</md-icon></md-icon-button>
                  </div>
                </div>
                <div class="structure-children" style="display: none;">
                ${(group.lectures ?? []).map((lecture) => renderManageLecture(lecture, group.id, 'Trong nhóm')).join('')}
                </div>
              `,
            )
            .join('')}
          <div class="structure-children" style="display: none;">
          ${module.lectures
            .filter((lecture) => !lecture.group_id)
            .map((lecture) => renderManageLecture(lecture, `module:${module.id}`, 'Chưa nhóm'))
            .join('')}
          </div>
          </div>
        `,
      )
      .join('')}
    </div>
  `;
}

export function renderManageLecture(lecture, parent, statusText) {
  return `
    <div class="manage-node greatgrandchild" data-entity="lecture" data-parent="${escapeHtml(parent)}" data-id="${lecture.id}" data-payload="${escapeHtml(JSON.stringify(lecture))}">
      <div style="display: flex; align-items: flex-start; flex: 1; padding-left: 28px; min-width: 0;">
        <strong style="white-space: normal; word-break: break-word; line-height: 1.4; margin-top: 2px;">${escapeHtml(lecture.title)}</strong>
        <span class="node-meta">${escapeHtml(statusText)}</span>
      </div>
      <div class="icon-actions">
        <md-icon-button data-edit-lecture="${lecture.id}" data-payload="${escapeHtml(JSON.stringify(lecture))}" aria-label="Sửa bài giảng"><md-icon>edit</md-icon></md-icon-button>
        <md-icon-button data-delete-lecture="${lecture.id}" aria-label="Xóa bài giảng"><md-icon>delete</md-icon></md-icon-button>
      </div>
    </div>
  `;
}

export function showContentForm(kind) {
  const placeholder = document.getElementById('content-editor-placeholder');
  if (placeholder) placeholder.classList.add('hidden');
  document.querySelectorAll('.editor-column .entity-form').forEach(f => f.classList.remove('active'));
  const target = document.querySelector(`.editor-column [data-entity="${kind}"]`);
  if (target) target.classList.add('active');
}

export function wireContentForms(pathData) {
  document.querySelectorAll('[data-create]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.create;
      const form = document.querySelector(`.editor-column [data-entity="${kind}"]`);
      if (form) {
        form.reset();
        const idInput = form.querySelector('[name="id"]');
        if (idInput) idInput.value = '';
        if (kind === 'phase') {
          form.querySelectorAll('[name="student_ids"]').forEach(cb => cb.checked = false);
        }
      }
      showContentForm(kind);
    });
  });

  document.querySelectorAll('.entity-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (form.dataset.saving === 'true') return;
      const formData = new FormData(form);
      const values = Object.fromEntries(formData.entries());
      if (form.dataset.entity === 'phase') {
        const studentIds = formData.getAll('student_ids');
        values.student_ids = studentIds.length > 0 ? studentIds : null;
      }
      const sortOrder = values.id
        ? Number(values.sort_order || 0)
        : nextContentSortOrder(form.dataset.entity, values, pathData);
      const payload = {
        ...values,
        sort_order: sortOrder,
        published: form.querySelector('[name="published"]')?.type === 'checkbox'
          ? form.querySelector('[name="published"]').checked
          : values.published !== 'false',
        owner_id: state.profile.id,
      };
      if (!payload.id) {
        delete payload.id;
      }
      if (form.dataset.entity === 'phase') {
        payload.student_ids = formData.getAll('student_ids');
      }

      const restore = setButtonLoading(form.querySelector('md-filled-button'));
      form.dataset.saving = 'true';

      try {
        let savedResult;
        if (form.dataset.entity === 'phase') {
          savedResult = await upsertPhase(payload);
        } else if (form.dataset.entity === 'module') {
          savedResult = await upsertModule(payload);
        } else if (form.dataset.entity === 'lectureGroup') {
          delete payload.phase_id;
          savedResult = await upsertLectureGroup(payload);
        } else if (form.dataset.entity === 'lecture') {
          delete payload.phase_id;
          let group_id = payload.group_id || null;
          if (group_id === 'undefined') group_id = null;
          savedResult = await upsertLecture({ ...payload, group_id });
        }

        const isUpdate = !!values.id;
        toast(isUpdate ? 'Đã cập nhật nội dung.' : 'Đã lưu thành công.', 'success');

        // Clear text inputs but keep context
        const titleInput = form.querySelector('[name="title"]');
        const idInput = form.querySelector('[name="id"]');
        const urlInput = form.querySelector('[name="slide_url"]');
        if (titleInput) titleInput.value = '';
        if (idInput) idInput.value = '';
        if (urlInput) urlInput.value = '';
        if (form.dataset.entity === 'phase') {
          form.querySelectorAll('[name="student_ids"]').forEach(cb => cb.checked = false);
        }

        // Add new item to dropdowns so it can be selected immediately
        if (!isUpdate && values.title && savedResult) {
          const actualId = savedResult.id;
          if (form.dataset.entity === 'phase') {
            document.querySelectorAll('.cascade-phase').forEach(sel => {
              sel.insertAdjacentHTML('beforeend', `<option value="${actualId}">${escapeHtml(values.title)}</option>`);
            });
          }
          if (form.dataset.entity === 'module') {
            document.querySelectorAll('.cascade-module').forEach(sel => {
              sel.insertAdjacentHTML('beforeend', `<option value="${actualId}" data-phase-id="${escapeHtml(values.phase_id)}">${escapeHtml(values.title)}</option>`);
            });
          }
          if (form.dataset.entity === 'lectureGroup') {
            document.querySelectorAll('.cascade-group').forEach(sel => {
              sel.insertAdjacentHTML('beforeend', `<option value="${actualId}" data-module-id="${escapeHtml(values.module_id)}">${escapeHtml(values.title)}</option>`);
            });
          }
        }

        const newData = await fetchLearningPath(state.profile.role);
        const container = document.querySelector('#manage-structure-container');
        if (container) {
          container.innerHTML = renderActivePhaseStructure(newData.phases, currentContentPhaseId);
          wireStructureEvents();
        }
        const phaseListContainer = document.querySelector('#phase-list-container');
        if (phaseListContainer) {
          phaseListContainer.innerHTML = renderPhaseList(newData.phases, currentContentPhaseId);
          wirePhaseSelection(newData);
        }
      } catch (error) {
        toast(`Lỗi lưu: ${error.message}`, 'error');
      } finally {
        delete form.dataset.saving;
        restore();
      }
    });
  });

  wireStructureEvents();
}

export function wireStructureEvents() {
  // Bind Accordion Toggles
  document.querySelectorAll('.toggle-children').forEach(el => {
    // Prevent binding multiple times if wireStructureEvents is called multiple times
    if (el.dataset.wired) return;
    el.dataset.wired = 'true';
    el.addEventListener('click', (e) => {
      // Don't toggle if dragging or clicking buttons inside
      if (e.target.closest('button, md-icon-button')) return;
      const node = e.target.closest('.manage-node');
      const childrenContainer = node.nextElementSibling;
      if (childrenContainer && childrenContainer.classList.contains('structure-children')) {
        const isExpanded = el.getAttribute('aria-expanded') === 'true';
        el.setAttribute('aria-expanded', !isExpanded);
        const icon = el.querySelector('.expand-icon');
        if (icon) {
          icon.style.transform = isExpanded ? 'rotate(-90deg)' : '';
        }
        childrenContainer.style.display = isExpanded ? 'none' : 'block';
      }
    });
  });

  // Bind Edit Buttons
  document.querySelectorAll('md-icon-button[data-payload], button[data-payload]').forEach((button) => {
    button.addEventListener('click', () => {
      const payload = JSON.parse(button.dataset.payload);
      const kind = button.dataset.editPhase
        ? 'phase'
        : button.dataset.editModule
          ? 'module'
          : button.dataset.editLectureGroup
            ? 'lectureGroup'
            : 'lecture';
      const form = document.querySelector(`.editor-column [data-entity="${kind}"]`);
      if (!form) return;
      showContentForm(kind);
      Object.entries(payload).forEach(([key, value]) => {
        if (key === 'student_ids' && Array.isArray(value)) {
          form.querySelectorAll('[name="student_ids"]').forEach(cb => cb.checked = false);
          value.forEach(id => {
            const cb = form.querySelector(`[name="student_ids"][value="${id}"]`);
            if (cb) cb.checked = true;
          });
          return;
        }
        const input = form.querySelector(`[name="${key}"]`);
        if (!input) return;
        if (input.type === 'checkbox') input.checked = Boolean(value);
        else input.value = value ?? '';
      });

      // Force trigger cascading dropdowns manually if needed
      const phaseSelect = form.querySelector('.cascade-phase');
      const moduleSelect = form.querySelector('.cascade-module');

      if (!payload.phase_id && payload.module_id && moduleSelect) {
        const option = moduleSelect.querySelector(`option[value="${payload.module_id}"]`);
        if (option) payload.phase_id = option.dataset.phaseId;
      }

      if (phaseSelect && moduleSelect && payload.phase_id) {
        phaseSelect.value = payload.phase_id;
        phaseSelect.dispatchEvent(new Event('change'));
        setTimeout(() => {
          moduleSelect.value = payload.module_id;
          moduleSelect.dispatchEvent(new Event('change'));
          const groupSelect = form.querySelector('.cascade-group');
          if (groupSelect && payload.group_id) {
            setTimeout(() => {
              groupSelect.value = payload.group_id;
            }, 0);
          }
        }, 0);
      }

      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  // Bind Delete Buttons
  document.querySelectorAll('[data-delete-phase],[data-delete-module],[data-delete-lecture-group],[data-delete-lecture]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Xóa mục này? Hành động này không thể hoàn tác.')) return;
      try {
        if (button.dataset.deletePhase) await deletePhase(button.dataset.deletePhase);
        if (button.dataset.deleteModule) await deleteModule(button.dataset.deleteModule);
        if (button.dataset.deleteLectureGroup) await deleteLectureGroup(button.dataset.deleteLectureGroup);
        if (button.dataset.deleteLecture) await deleteLecture(button.dataset.deleteLecture);
        toast('Đã xóa.', 'success');
        const newData = await fetchLearningPath(state.profile.role);
        const container = document.querySelector('#manage-structure-container');
        if (container) {
          container.innerHTML = renderActivePhaseStructure(newData.phases, currentContentPhaseId);
          wireStructureEvents();
        }
        const phaseListContainer = document.querySelector('#phase-list-container');
        if (phaseListContainer) {
          phaseListContainer.innerHTML = renderPhaseList(newData.phases, currentContentPhaseId);
          wirePhaseSelection(newData);
        }
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
}

export function wireCascadingDropdowns(root) {
  root.querySelectorAll('.entity-form').forEach((form) => {
    const phaseSelect = form.querySelector('.cascade-phase');
    const moduleSelect = form.querySelector('.cascade-module');
    const groupSelect = form.querySelector('.cascade-group');

    if (phaseSelect && moduleSelect) {
      phaseSelect.addEventListener('change', () => {
        const phaseId = phaseSelect.value;
        moduleSelect.value = '';
        if (groupSelect) groupSelect.value = '';

        let hasModules = false;
        Array.from(moduleSelect.options).forEach((opt) => {
          if (!opt.value) return; // Skip placeholder
          if (opt.dataset.phaseId === phaseId) {
            opt.style.display = '';
            hasModules = true;
          } else {
            opt.style.display = 'none';
          }
        });

        moduleSelect.disabled = !phaseId || !hasModules;
        if (groupSelect) groupSelect.disabled = true;
      });
    }

    if (moduleSelect && groupSelect) {
      moduleSelect.addEventListener('change', () => {
        const moduleId = moduleSelect.value;
        groupSelect.value = '';

        let hasGroups = false;
        Array.from(groupSelect.options).forEach((opt) => {
          if (!opt.value) return; // Skip placeholder
          if (opt.dataset.moduleId === moduleId) {
            opt.style.display = '';
            hasGroups = true;
          } else {
            opt.style.display = 'none';
          }
        });

        groupSelect.disabled = !moduleId || !hasGroups;
      });
    }

    // Also handle reset button
    form.addEventListener('reset', () => {
      setTimeout(() => {
        if (moduleSelect) moduleSelect.disabled = true;
        if (groupSelect) groupSelect.disabled = true;

        Array.from(moduleSelect?.options || []).forEach(o => o.style.display = '');
        Array.from(groupSelect?.options || []).forEach(o => o.style.display = '');
      }, 0);
    });
  });
}

export function nextContentSortOrder(kind, values, pathData) {
  const byParent = {
    phase: pathData.phases ?? [],
    module: (pathData.modules ?? []).filter((item) => item.phase_id === values.phase_id),
    lectureGroup: (pathData.lectureGroups ?? []).filter((item) => item.module_id === values.module_id),
    lecture: (pathData.lectures ?? []).filter((item) => {
      if (values.group_id) return item.group_id === values.group_id;
      return item.module_id === values.module_id && !item.group_id;
    }),
  }[kind] ?? [];

  const maxSortOrder = byParent.reduce((max, item) => Math.max(max, Number(item.sort_order ?? 0)), 0);
  return maxSortOrder + 10;
}

export function parseLatexAssignment(latexText) {
  const regex = /\\begin\{ex\}([\s\S]*?)\\end\{ex\}/g;
  let match;
  const questions = [];

  const extractBracketMatch = (text, startIndex) => {
    let depth = 0;
    let start = startIndex + 1;
    for (let i = start; i < text.length; i++) {
      let backslashCount = 0;
      let j = i - 1;
      while (j >= 0 && text[j] === '\\') {
        backslashCount++;
        j--;
      }
      if (backslashCount % 2 === 1) {
        continue;
      }

      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        if (depth === 0) {
          return { content: text.substring(start, i), endIndex: i };
        }
        depth--;
      }
    }
    return null;
  };

  while ((match = regex.exec(latexText)) !== null) {
    let rawContent = match[1].trim();
    let explanation = '';

    // Parse \loigiai{}
    const loigiaiIdx = rawContent.indexOf('\\loigiai');
    if (loigiaiIdx !== -1) {
      const openBracketIdx = rawContent.indexOf('{', loigiaiIdx);
      if (openBracketIdx !== -1) {
        const loigiaiMatch = extractBracketMatch(rawContent, openBracketIdx);
        if (loigiaiMatch) {
          explanation = loigiaiMatch.content.trim();
          rawContent = rawContent.substring(0, loigiaiIdx) + rawContent.substring(loigiaiMatch.endIndex + 1);
        }
      }
    }

    let choices = [];
    let correctAnswer = 'A';

    // Parse \choice{A}{B}{C}{D}
    const choiceIdx = rawContent.indexOf('\\choice');
    let prompt = rawContent.trim();

    if (choiceIdx !== -1) {
      prompt = rawContent.substring(0, choiceIdx).trim();
      let currentIdx = choiceIdx + '\\choice'.length;

      for (let c = 0; c < 4; c++) {
        while (currentIdx < rawContent.length && /\s/.test(rawContent[currentIdx])) currentIdx++;
        if (rawContent[currentIdx] === '{') {
          const choiceMatch = extractBracketMatch(rawContent, currentIdx);
          if (choiceMatch) {
            choices.push(choiceMatch.content.trim());
            currentIdx = choiceMatch.endIndex + 1;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      let correctIndex = choices.findIndex(c => c.includes('\\True') || c.startsWith('\\True'));
      if (correctIndex === -1) {
        // Also check if rawContent had \True inside parentheses like {\True B. ...}
        const rawChoiceSection = rawContent.substring(choiceIdx);
        if (rawChoiceSection.includes('\\True')) {
          // Check which choice bracket contains \True
          const bracketMatches = Array.from(rawChoiceSection.matchAll(/\{([^}]*)\}/g)).map(m => m[1]);
          correctIndex = bracketMatches.findIndex(b => b.includes('\\True'));
        }
      }

      if (correctIndex !== -1 && correctIndex < 4) {
        correctAnswer = ['A', 'B', 'C', 'D'][correctIndex];
      }
      
      // Clean \\True tag from choice text for rendering
      choices = choices.map(c => c.replace(/\\True\s*/g, '').trim());
    }

    questions.push({
      type: 'mcq',
      prompt: prompt,
      choices: choices,
      points: 1,
      sort_order: questions.length + 1,
      settings: { explanation },
      answer_key: { correct_answer: correctAnswer }
    });
  }

  return questions;
}

export function emptyEditor() {
  return {
    assignment: {
      title: '',
      description: '',
      pdf_url: 'latex',
      lecture_id: '',
      sort_order: 0,
      published: true,
    },
    questions: [],
  };
}

export async function mountAssignmentManager() {
  const root = pageRoot();
  root.innerHTML = renderSkeletonAssignments();
  try {
    const [path, assignments] = await Promise.all([
      fetchLearningPath(state.profile.role),
      fetchAssignmentsForManager(),
    ]);
    if (!state.assignmentEditor) state.assignmentEditor = emptyEditor();
    if (state.isEditingAssignment) {
      root.innerHTML = `
        <section class="assignment-editor-view" style="background: #EDF2E4; min-height: calc(100vh - 64px); padding: 24px max(var(--page-gutter), 16px);">
          <div style="width: 100%; max-width: 98vw; margin: 0 auto;">
            <div style="margin-bottom: 16px;">
              <button type="button" id="back-to-list-btn" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; background: #ffffff; color: #455120; border: 1px solid #D8E2CA; border-radius: 9999px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s ease;" onmouseover="this.style.background='#F0F4E8'" onmouseout="this.style.background='#ffffff'">
                <md-icon style="font-size: 18px;">arrow_back</md-icon>
                <span>Quay lại danh sách</span>
              </button>
            </div>
            <form id="assignment-editor" style="display: flex; flex-direction: column;">
              ${renderAssignmentEditor(path.lectures)}
            </form>
          </div>
        </section>
      `;
    } else {
      root.innerHTML = `
        <style>
          .nh-assignment-row {
            background: #ffffff;
            border: 1px solid #D8E2C4;
            border-radius: 14px;
            padding: 16px 20px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            cursor: pointer;
            transition: all 0.15s ease;
            box-shadow: 0 2px 6px rgba(69, 81, 32, 0.02);
          }
          .nh-assignment-row:hover {
            background: #fbfdf9;
            box-shadow: 0 4px 16px rgba(69, 81, 32, 0.07);
            transform: translateY(-1px);
          }
        </style>
        <section style="background: #EDF2E4; min-height: calc(100vh - 64px); padding: 32px max(var(--page-gutter), 24px);">
          <div style="max-width: 1040px; margin: 0 auto; width: 100%;">
            
            <!-- White Header Card -->
            <div style="background: #ffffff; border-radius: 20px; border: 1px solid #D8E2C4; padding: 24px 32px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; box-shadow: 0 2px 10px rgba(69, 81, 32, 0.04);">
              <div>
                <h1 style="font-family: 'Beautique Display', serif; font-size: 24px; font-weight: 700; color: #101828; margin: 0 0 4px 0;">Đề thi & Bài tập về nhà</h1>
                <p style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 13.5px; color: #667085; margin: 0;">Danh sách tất cả đề thi trắc nghiệm và bài tập trong hệ thống</p>
              </div>

              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex: 1; max-width: 500px; justify-content: flex-end;">
                <div style="position: relative; flex: 1; min-width: 220px;">
                  <md-icon style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 18px; color: #667085; pointer-events: none;">search</md-icon>
                  <input type="text" id="assignment-search" placeholder="Tìm kiếm đề thi..." style="width: 100%; box-sizing: border-box; padding: 10px 16px 10px 40px; border-radius: 9999px; border: 1px solid #cbd5e1; font-family: 'Be Vietnam Pro', sans-serif; font-size: 13.5px; outline: none; transition: border-color 0.15s ease;" onfocus="this.style.borderColor='#455120'" onblur="this.style.borderColor='#cbd5e1'" />
                </div>
                <button type="button" id="new-assignment" style="display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; background: #455120; color: #ffffff; border: 0; border-radius: 9999px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 2px 8px rgba(69, 81, 32, 0.15);">
                  <md-icon style="font-size: 17px;">add</md-icon>
                  <span>Tạo đề mới</span>
                </button>
              </div>
            </div>

            <!-- List Container -->
            <div id="assignment-list-container">
              ${assignments.length ? assignments
          .map(
            (assignment) => `
                    <div class="nh-assignment-row assignment-row" onclick="document.querySelector('[data-load-assignment=\\'${assignment.id}\\']').click()">
                      <div style="display: flex; align-items: center; gap: 16px; flex: 1; min-width: 0;">
                        <div style="width: 42px; height: 42px; border-radius: 12px; background: #F0F4E8; border: 1px solid #D8E2CA; color: #455120; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                          <md-icon style="font-size: 20px;">edit_note</md-icon>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;">
                          <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 15px; font-weight: 700; color: #101828; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(assignment.title)}</span>
                          <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 12.5px; color: #667085;">${escapeHtml(assignment.lectures?.title ?? 'Bài tập tự do')}</span>
                        </div>
                      </div>
                      <div style="display: flex; gap: 6px; align-items: center;" onclick="event.stopPropagation()">
                        <button type="button" data-load-assignment="${assignment.id}" title="Chỉnh sửa" style="width: 36px; height: 36px; border-radius: 8px; border: 1px solid #e2e8f0; background: #ffffff; color: #455120; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;" onmouseover="this.style.background='#F0F4E8'" onmouseout="this.style.background='#ffffff'">
                          <md-icon style="font-size: 18px;">edit</md-icon>
                        </button>
                        <button type="button" data-delete-assignment="${assignment.id}" title="Xóa" style="width: 36px; height: 36px; border-radius: 8px; border: 1px solid #fecaca; background: #ffffff; color: #d92d20; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='#ffffff'">
                          <md-icon style="font-size: 18px;">delete</md-icon>
                        </button>
                      </div>
                    </div>
                  `,
          )
          .join('') : '<div style="background: #ffffff; border-radius: 16px; border: 1px solid #D8E2C4; padding: 48px; text-align: center; color: #667085; font-family: \'Be Vietnam Pro\', sans-serif;">Chưa có đề thi nào. Hãy tạo mới!</div>'}
            </div>

          </div>
        </section>
      `;
    }
    wireAssignmentEditor(path.lectures);
    wireMaterialFormButtons(root);
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

export function renderPdfPreview(url) {
  if (!url) {
    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 40px; text-align: center; color: var(--md-sys-color-outline); height: 100%; width: 100%;">
        <md-icon style="font-size: 3rem;">picture_as_pdf</md-icon>
        <p style="margin: 0; font-weight: 500; font-size: 0.9rem;">Chưa có link PDF đề thi</p>
        <p style="margin: 0; font-size: 0.8rem; max-width: 250px; color: var(--md-sys-color-on-surface-variant);">Hãy nhập link PDF Google Drive ở ô thông tin phía trên để hiển thị bản xem trước tại đây.</p>
      </div>
    `;
  }
  const preview = toDrivePreviewUrl(url);
  if (!preview) {
    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 40px; text-align: center; color: var(--md-sys-color-outline); height: 100%; width: 100%;">
        <md-icon style="font-size: 3rem;">open_in_new</md-icon>
        <p style="margin: 0; font-weight: 500; font-size: 0.9rem;">Không thể nhúng link PDF này</p>
        <a class="text-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer noopener" style="font-weight: 600;">Mở liên kết trong tab mới</a>
      </div>
    `;
  }
  return `<iframe src="${escapeHtml(preview)}" style="width: 100%; height: 100%; border: 0; border-radius: 8px;" loading="lazy"></iframe>`;
}

export function renderAssignmentEditor(lectures) {
  const { assignment, questions } = state.assignmentEditor;
  const isLatexMode = assignment.pdf_url === 'latex' || !assignment.pdf_url;
  
  return `
    <!-- Unified Header + Info Card -->
    <div class="panel" style="padding: 20px 24px; margin-bottom: 20px;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;">
        <div>
          <h2 style="margin: 0 0 2px 0; font-size: 16px; font-weight: 700; color: var(--md-sys-color-on-surface);">${assignment.id ? 'Chỉnh sửa đề thi' : 'Soạn thảo đề thi mới'}</h2>
          <p style="margin: 0; font-size: 12px; color: var(--md-sys-color-on-surface-variant);">Trình soạn thảo LaTeX bài tập &amp; trắc nghiệm toán học</p>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          ${assignment.id ? `<button id="delete-assignment" type="button" class="btn-danger-outline">Xóa đề</button>` : ''}
          <button type="submit" class="btn-primary">Lưu đề thi</button>
        </div>
      </div>

      <div class="form-grid two" style="gap: 12px;">
        <div>
          <label class="field-label">Tên đề thi / Bài tập về nhà <span style="color: var(--md-sys-color-error);">*</span></label>
          <input class="field" name="title" value="${escapeHtml(assignment.title)}" placeholder="Nhập tên đề thi..." required>
        </div>

        <div class="custom-combobox" style="position: relative;">
          <input type="hidden" name="lecture_id" value="${escapeHtml(assignment.lecture_id ?? '')}">
          <label class="field-label">Chương liên kết</label>
          <input
            class="field"
            id="lecture-search-input"
            autocomplete="off"
            placeholder="Gõ để tìm chương..."
            value="${escapeHtml(assignment.lecture_id && lectures.find(l => l.id === assignment.lecture_id) ? lectures.find(l => l.id === assignment.lecture_id).title : (assignment.lecture_id ? '' : 'Bài tập tự do'))}"
            style="cursor: pointer;"
          >
          <div class="combobox-dropdown" style="display: none; position: absolute; top: calc(100% + 2px); left: 0; right: 0; max-height: 260px; overflow-y: auto; background: var(--md-sys-color-surface-container-lowest); border-radius: 10px; z-index: 100; box-shadow: 0 8px 24px rgba(0,0,0,0.10); border: 1px solid var(--md-sys-color-outline-variant);">
            <div class="combo-option" data-value="" style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--md-sys-color-outline-variant); font-size: 13px;">Bài tập tự do</div>
            ${lectures.map((lecture) => `<div class="combo-option" data-value="${escapeHtml(lecture.id)}" data-label="${escapeHtml(lecture.title).toLowerCase()}" style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--md-sys-color-outline-variant); font-size: 13px;">${escapeHtml(lecture.title)}</div>`).join('')}
          </div>
        </div>

        ${!isLatexMode ? `
        <div style="grid-column: 1 / -1;">
          <label class="field-label">Link tài liệu PDF (Google Drive) <span style="color: var(--md-sys-color-error);">*</span></label>
          <input class="field" id="assignment-pdf-input" name="pdf_url" value="${escapeHtml(assignment.pdf_url)}" placeholder="https://drive.google.com/..." required>
        </div>
        ` : ''}
      </div>
    </div>

    <input type="hidden" name="id" value="${escapeHtml(assignment.id ?? '')}">
    <input type="hidden" name="description" value="${escapeHtml(assignment.description ?? '')}">
    <input type="hidden" name="sort_order" value="${Number(assignment.sort_order ?? 0)}">
    <input type="hidden" name="published" value="true">

    <style>
      .combo-option:hover { background: var(--md-sys-color-surface-container-low); }
      .combo-option { color: var(--md-sys-color-on-surface); transition: background 0.12s; }
      .field-label { display: block; font-size: 12px; font-weight: 600; color: var(--md-sys-color-on-surface-variant); margin-bottom: 5px; }
      .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); border: 0; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
      .btn-primary:hover { opacity: 0.88; }
      .btn-danger-outline { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: transparent; color: var(--md-sys-color-error); border: 1px solid var(--md-sys-color-error); border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.15s; }
      .btn-danger-outline:hover { background: color-mix(in srgb, var(--md-sys-color-error) 8%, transparent); }
    </style>


    <!-- Main Workspace Split View -->
    <style>
      .left-pane {
        position: sticky;
        top: 24px;
        align-self: start;
        flex: 1;
        min-width: 380px;
        max-height: calc(100vh - 48px);
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .right-pane {
        flex: 1.1;
        min-width: 420px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      @media (max-width: 900px) {
        .left-pane, .right-pane {
          position: static !important;
          height: auto !important;
          min-width: 100% !important;
          flex: none !important;
        }
      }
    </style>
    <div class="assignment-workspace-split" style="display: flex; flex-wrap: wrap; gap: 20px; min-height: 600px; align-items: stretch;">
      
      <!-- Left pane: Rendered Question Cards -->
      <div class="left-pane" style="padding-right: 4px;">
        <div class="latex-review-list" style="display: flex; flex-direction: column; gap: 24px; background: #ffffff; padding: 28px 32px; border-radius: 16px; border: 1px solid #D8E2C4; box-shadow: 0 2px 10px rgba(69, 81, 32, 0.03);">
          <!-- Section Header I. Trắc nghiệm -->
          <div style="display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 4px 16px 4px 4px; background: #f0f4e8; border: 1px solid #d8e2ca; border-radius: 9999px; color: #455120; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 700; font-size: 14.5px; box-sizing: border-box; width: 100%;">
            <span style="width: 26px; height: 26px; border-radius: 50%; background: #455120; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif;">I</span>
            <span>Trắc nghiệm</span>
          </div>

          <div class="question-builder" style="display: flex; flex-direction: column; gap: 24px;">
            ${questions.length ? questions.map((question, index) => renderQuestionEditor(question, index)).join('') : '<div style="padding: 40px; text-align: center; color: #667085; font-family: \'Be Vietnam Pro\', sans-serif; font-size: 13.5px;">Chưa có câu hỏi nào. Hãy dán mã LaTeX vào khung bên phải!</div>'}
          </div>
        </div>
      </div>

      <!-- Right pane: LaTeX Editor Container -->
      <div class="right-pane" style="border-radius: 16px; display: flex; flex-direction: column; background: #ffffff; border: 1px solid #D8E2C4; padding: 20px; box-shadow: 0 2px 8px rgba(69, 81, 32, 0.03);">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: #F0F4E8; color: #455120; display: flex; align-items: center; justify-content: center;">
              <md-icon style="font-size: 18px;">functions</md-icon>
            </div>
            <h3 style="margin: 0; font-family: 'Beautique Display', serif; font-size: 17px; font-weight: 700; color: #101828;">Soạn thảo LaTeX (EX_TEST)</h3>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="file" id="latex-image-upload" accept="image/*" style="display: none;">
            <button type="button" id="latex-image-btn" style="display: inline-flex; align-items: center; gap: 5px; padding: 7px 14px; background: #ffffff; color: #455120; border: 1px solid #D8E2CA; border-radius: 9999px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: background 0.15s ease;" onmouseover="this.style.background='#F0F4E8'" onmouseout="this.style.background='#ffffff'">
              <md-icon style="font-size: 16px;">image</md-icon>
              <span>Chèn ảnh</span>
            </button>
            <span id="latex-upload-status" style="font-size: 12px; color: #455120; font-family: 'Be Vietnam Pro', sans-serif; display: none;">Đang tải ảnh...</span>
            <button type="button" id="latex-live-parse-btn" style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; background: #455120; color: #ffffff; border: 0; border-radius: 9999px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 12.5px; font-weight: 500; cursor: pointer; box-shadow: 0 2px 6px rgba(69, 81, 32, 0.15);">
              <md-icon style="font-size: 16px;">auto_fix_high</md-icon>
              <span>Cập nhật & Xem trước</span>
            </button>
          </div>
        </div>
        
        <div style="flex: 1; display: flex; flex-direction: column;">
          <textarea id="latex-live-input" style="flex: 1; min-height: 520px; width: 100%; box-sizing: border-box; padding: 18px; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 13.5px; line-height: 1.6; border: 1px solid #cbd5e1; border-radius: 12px; resize: vertical; background: #f8fafc; color: #0f172a; outline: none; transition: border-color 0.15s ease;" onfocus="this.style.borderColor='#455120'; this.style.background='#ffffff';" onblur="this.style.borderColor='#cbd5e1'; this.style.background='#f8fafc';" placeholder="Dán mã LaTeX chuẩn EX_TEST vào đây...&#10;Ví dụ:&#10;\begin{ex}[1D1-1]&#10;Cho hàm số y = f(x)...&#10;\choice&#10;{A. y = 1}&#10;{\True B. y = 2}&#10;{C. y = 3}&#10;{D. y = 4}&#10;\loigiai{Hướng dẫn giải...}&#10;\end{ex}">${escapeHtml(state.assignmentEditor.latexSource || '')}</textarea>
        </div>
      </div>

    </div>

    <!-- LaTeX Import Dialog -->
    <dialog id="latex-import-dialog" style="padding: 24px; border-radius: 12px; border: none; box-shadow: 0 4px 24px rgba(0,0,0,0.2); width: 800px; max-width: 90vw;">
      <h3 style="margin-top: 0;">Nhập đề thi từ LaTeX (Chuẩn EX_TEST)</h3>
      <p style="color: var(--md-sys-color-outline); margin-bottom: 16px; font-size: 0.9rem;">
        Dán mã LaTeX vào đây. Hệ thống sẽ phân tích cấu trúc <code>\\begin{ex}...\\end{ex}</code>, <code>\\choice</code>, <code>\\True</code>, và <code>\\loigiai{...}</code>.
        Chế độ này sẽ thay thế file PDF bằng nội dung LaTeX render trực tiếp trên màn hình của học sinh.
      </p>
      <textarea id="latex-input" style="width: 100%; height: 300px; padding: 12px; font-family: monospace; border: 1px solid var(--md-sys-color-outline-variant); border-radius: 8px; resize: vertical;" placeholder="\\begin{ex}...\n\\choice\n{A}\n{\\True B}\n{C}\n{D}\n\\loigiai{...}\n\\end{ex}"></textarea>
      <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px;">
        <md-outlined-button id="latex-cancel-btn" type="button">Hủy</md-outlined-button>
        <md-filled-button id="latex-parse-btn" type="button">Phân tích</md-filled-button>
      </div>
    </dialog>
  `;
}

export function renderQuestionEditor(question, index) {
  const isLatex = state.assignmentEditor.assignment.pdf_url === 'latex' || !state.assignmentEditor.assignment.pdf_url;
  
  if (isLatex) {
    const correctAnswer = question.answer_key?.correct_answer ?? '';
    const cleanPrompt = question.prompt ? question.prompt.replace(/^Câu\s*\d+[\.\:\s]*/i, '') : '';
    const qNumStr = String(index + 1).padStart(2, '0');

    return `
      <article class="latex-review-q-block" data-source-index="${question.sourceIndex ?? ''}" title="Bấm để cuộn đến đoạn code tương ứng" style="display: flex; flex-direction: column; gap: 14px; padding-bottom: 24px; border-bottom: 1px solid #f1f5f9; cursor: pointer;">
        
        <!-- Question Title & Prompt -->
        <div style="font-size: 15px; color: #1e293b; line-height: 1.6;">
          <span style="font-weight: 900; color: #455120; font-size: 17px; font-family: 'Beautique Display', serif; letter-spacing: 0.5px; margin-right: 12px; display: inline-block;">CÂU ${qNumStr}</span>
          <span style="font-weight: 500; color: #1e293b; font-size: 15px; font-family: 'Be Vietnam Pro', sans-serif;">${renderLatexText(cleanPrompt)}</span>
        </div>
        
        ${question.choices && question.choices.length > 0 ? `
        <div class="choice-grid" style="display: flex; flex-direction: column; gap: 10px; padding-left: 2px; margin-top: 4px;">
          ${question.choices.map((choice, cIdx) => {
            const letter = String.fromCharCode(65 + cIdx);
            const isCorrectChoice = String(correctAnswer).toUpperCase() === letter;
            const cleanChoice = choice.replace(/^[A-D]\.\s*/i, '').trim();
            
            let circleBorder = '#cbd5e1';
            let circleBg = '#ffffff';
            let dotDisplay = 'none';
            let dotColor = '#455120';

            if (isCorrectChoice) {
              circleBorder = '#455120';
              dotDisplay = 'block';
              dotColor = '#455120';
            }

            return `
              <div style="display: flex; gap: 10px; align-items: center; padding: 2px 0;">
                <div class="latex-radio-circle" style="width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid ${circleBorder}; background: ${circleBg}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <div class="dot" style="width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; display: ${dotDisplay};"></div>
                </div>
                <div style="font-size: 14.5px; line-height: 1.5; color: #1e293b; display: flex; align-items: center; gap: 4px;">
                  <span style="font-weight: 800; color: #1e293b;">${letter}.</span><span>${renderLatexText(cleanChoice)}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        ` : ''}

        ${correctAnswer ? `
        <div style="margin-top: 14px;">
          <div style="font-size: 16px; font-weight: 900; color: #455120; font-family: 'Beautique Display', serif; margin-bottom: 6px;">Đáp án</div>
          <div style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 14.5px; font-weight: 700; color: #1e293b; line-height: 1.6;">
            ${correctAnswer}. ${question.choices && question.choices[correctAnswer.charCodeAt(0) - 65] ? renderLatexText(question.choices[correctAnswer.charCodeAt(0) - 65]) : ''}
          </div>
        </div>
        ` : ''}

        ${question.settings?.explanation ? `
        <div style="margin-top: 18px;">
          <div style="font-size: 16px; font-weight: 900; color: #455120; font-family: 'Beautique Display', serif; margin-bottom: 8px;">Hướng dẫn giải chi tiết</div>
          <div style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 14.5px; line-height: 2.2; color: #334155; max-width: 100%; overflow-x: auto;">
            ${renderLatexText(question.settings.explanation)}
          </div>
        </div>
        ` : ''}

        <input type="hidden" name="question-id-${index}" value="${escapeHtml(question.id ?? '')}">
      </article>
    `;
  }

  return `
    <article class="question-editor" data-index="${index}">
      <div class="editor-heading">
        <strong>Câu ${index + 1}</strong>
        <div style="display: flex; gap: 8px; align-items: center;">
          <md-outlined-select name="question-type-${index}" style="width: 120px; --md-outlined-select-text-field-container-shape: 6px;">
            ${['mcq', 'tf4', 'short'].map((type) => `<md-select-option value="${type}" ${question.type === type ? 'selected' : ''}><div slot="headline">${type.toUpperCase()}</div></md-select-option>`).join('')}
          </md-outlined-select>
          <md-outlined-text-field type="number" name="question-sort-${index}" value="${Number(question.sort_order ?? index + 1)}" placeholder="Thứ tự" style="width: 70px; --md-outlined-text-field-container-shape: 6px;"></md-outlined-text-field>
          <md-icon-button type="button" data-remove-question="${index}" aria-label="Xóa câu"><md-icon>close</md-icon></md-icon-button>
        </div>
      </div>
      <input type="hidden" name="question-id-${index}" value="${escapeHtml(question.id ?? '')}">
      <div>
        ${renderQuestionKeyEditor(question, index)}
      </div>
    </article>
  `;
}

export function renderQuestionKeyEditor(question, index) {
  const key = question.answer_key ?? {};
  if (question.type === 'tf4') {
    const statements = question.settings?.statements ?? ['', '', '', ''];
    const correct = key.correct_answer ?? [true, true, true, true];
    return `
      <div class="tf-editor">
        ${[0, 1, 2, 3]
        .map(
          (itemIndex) => `
              <div class="tf-row">
                <input class="field" name="tf-statement-${index}-${itemIndex}" value="${escapeHtml(statements[itemIndex] ?? '')}" placeholder="Ý ${itemIndex + 1}">
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

  return `
    <select class="field" name="mcq-answer-${index}">
      ${['A', 'B', 'C', 'D'].map((letter) => option(letter, `Đáp án ${letter}`, key.correct_answer ?? 'A')).join('')}
    </select>
  `;
}

export function refreshQuestionBuilder(lectures) {
  const questions = state.assignmentEditor.questions;
  const heading = document.querySelector('.question-builder-header .qb-count');
  const builder = document.querySelector('.question-builder');
  if (heading) heading.textContent = `${questions.length} câu`;
  if (builder) {
    builder.innerHTML = questions.length
      ? questions.map((question, index) => renderQuestionEditor(question, index)).join('')
      : '<div class="panel empty-state" style="padding: 40px; text-align: center; background: var(--md-sys-color-surface-container-low); border: 1px dashed var(--md-sys-color-outline-variant); border-radius: var(--md-sys-shape-corner-medium, 12px); color: var(--md-sys-color-outline);">Chưa có câu nào trong phiếu trả lời. Hãy thêm câu hỏi ở trên để bắt đầu nhập đáp án.</div>';
  }
  wireQuestionEditorControls(lectures);
}

export function wireQuestionEditorControls(lectures) {
  document.querySelectorAll('[data-remove-question]').forEach((button) => {
    if (button.dataset.questionBridge === 'true') return;
    button.dataset.questionBridge = 'true';
    button.addEventListener('click', () => {
      state.assignmentEditor = collectEditor(lectures);
      state.assignmentEditor.questions.splice(Number(button.dataset.removeQuestion), 1);
      refreshQuestionBuilder(lectures);
    });
  });
}

export function wireAssignmentEditor(lectures) {
  // Wire Custom Searchable Combobox
  const searchInput = document.querySelector('#lecture-search-input');
  const hiddenInput = document.querySelector('input[name="lecture_id"]');
  const dropdown = document.querySelector('.combobox-dropdown');
  if (searchInput && dropdown) {
    const options = dropdown.querySelectorAll('.combo-option');
    // Mở dropdown khi click/focus
    const openDropdown = () => {
      dropdown.style.display = 'block';
      options.forEach(opt => opt.style.display = 'block'); // reset filter
    };
    searchInput.addEventListener('focus', openDropdown);
    searchInput.addEventListener('click', openDropdown);

    // Tìm kiếm (filter)
    searchInput.addEventListener('input', (e) => {
      dropdown.style.display = 'block';
      const term = (e.target.value || '').toLowerCase();
      options.forEach(opt => {
        if (!opt.dataset.value) return; // Luôn hiện "Bài tập tự do"
        const label = opt.dataset.label || '';
        opt.style.display = label.includes(term) ? 'block' : 'none';
      });
    });

    // Chọn item
    options.forEach(opt => {
      opt.addEventListener('click', () => {
        hiddenInput.value = opt.dataset.value;
        searchInput.value = opt.textContent;
        dropdown.style.display = 'none';
      });
    });

    // Bấm ra ngoài để đóng
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-combobox')) {
        dropdown.style.display = 'none';
        // Nếu gõ linh tinh mà không chọn, có thể tự động reset về giá trị cũ (tuỳ chọn)
      }
    });
  }

  document.querySelector('#back-to-list-btn')?.addEventListener('click', () => {
    state.isEditingAssignment = false;
    state.assignmentEditor = emptyEditor();
    mountAssignmentManager();
  });

  document.querySelector('#new-assignment')?.addEventListener('click', () => {
    state.assignmentEditor = emptyEditor();
    state.isEditingAssignment = true;
    mountAssignmentManager();
  });

  const assignmentSearchInput = document.querySelector('#assignment-search');
  if (assignmentSearchInput) {
    assignmentSearchInput.addEventListener('input', (e) => {
      const term = (e.target.value || '').toLowerCase();
      document.querySelectorAll('.assignment-row').forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(term)) {
          row.style.display = 'flex';
        } else {
          row.style.display = 'none';
        }
      });
    });
  }

  document.querySelectorAll('[data-load-assignment]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const editor = await fetchAssignmentEditor(button.dataset.loadAssignment);
        state.assignmentEditor = normalizeAssignmentEditor(editor);
        state.isEditingAssignment = true;
        await mountAssignmentManager();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });

  document.querySelectorAll('[data-delete-assignment]').forEach((button) => {
    button.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!window.confirm('Xóa đề này?')) return;
      try {
        await deleteAssignment(button.dataset.deleteAssignment);
        toast('Đã xóa đề thi.', 'success');
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
      refreshQuestionBuilder(lectures);
    });
  });

  document.querySelector('#bulk-add-btn')?.addEventListener('click', () => {
    state.assignmentEditor = collectEditor(lectures);
    const countInput = document.querySelector('input[name="bulk-question-count"]');
    const typeSelect = document.querySelector('select[name="bulk-question-type"]');
    const count = Math.min(100, Math.max(1, Number(countInput?.value || 20)));
    const type = typeSelect?.value || 'mcq';
    const questions = Array.from({ length: count }, () => defaultQuestion(type));
    state.assignmentEditor.questions.push(...questions);
    refreshQuestionBuilder(lectures);
  });

  wireQuestionEditorControls(lectures);

  if (state.assignmentEditor.assignment.pdf_url === 'latex' && window.MathJax) {
    setTimeout(() => window.MathJax.typesetPromise(), 50);
  }

  document.querySelector('#latex-mode-btn')?.addEventListener('click', () => {
    state.assignmentEditor = collectEditor(lectures);
    state.assignmentEditor.assignment.pdf_url = 'latex';
    mountAssignmentManager();
  });

  document.querySelector('#latex-live-parse-btn')?.addEventListener('click', () => {
    const text = document.querySelector('#latex-live-input').value;
    const parsedQuestions = parseLatexAssignment(text);

    if (parsedQuestions.length === 0) {
      toast('Không tìm thấy câu hỏi nào hợp lệ (cần dùng \\begin{ex}...\\end{ex}).', 'error');
      return;
    }

    state.assignmentEditor = collectEditor(lectures);
    state.assignmentEditor.questions = parsedQuestions;
    state.assignmentEditor.latexSource = text;

    toast(`Đã nhận diện thành công ${parsedQuestions.length} câu hỏi.`, 'success');
    mountAssignmentManager();
  });

  const uploadInput = document.querySelector('#latex-image-upload');
  const uploadBtn = document.querySelector('#latex-image-btn');
  const uploadStatus = document.querySelector('#latex-upload-status');
  const latexInput = document.querySelector('#latex-live-input');

  let cm = null;
  if (latexInput) {
    cm = window.CodeMirror?.fromTextArea(latexInput, {
      lineNumbers: true,
      mode: 'stex',
      lineWrapping: true,
      theme: 'default',
      extraKeys: {
        'Cmd-S': function () { document.querySelector('#latex-live-parse-btn')?.click(); },
        'Ctrl-S': function () { document.querySelector('#latex-live-parse-btn')?.click(); }
      }
    });
    cm?.on('change', () => {
      latexInput.value = cm.getValue();
      state.assignmentEditor.latexSource = cm.getValue();
    });
  }

  async function handleImageUpload(file) {
    if (!file) return;
    uploadStatus.style.display = 'inline-block';
    uploadBtn.disabled = true;
    try {
      const url = await uploadAssignmentImage(file);
      const insertText = `\n![image](${url})\n`;
      if (cm) {
        const doc = cm.getDoc();
        const cursor = doc.getCursor();
        doc.replaceRange(insertText, cursor);
      } else {
        const startPos = latexInput.selectionStart;
        const endPos = latexInput.selectionEnd;
        latexInput.value = latexInput.value.substring(0, startPos) + insertText + latexInput.value.substring(endPos);
        latexInput.selectionStart = latexInput.selectionEnd = startPos + insertText.length;
        state.assignmentEditor.latexSource = latexInput.value;
      }
    } catch (err) {
      toast('Tải ảnh lên thất bại: ' + err.message, 'error');
    } finally {
      uploadStatus.style.display = 'none';
      uploadBtn.disabled = false;
      uploadInput.value = ''; // reset
    }
  }

  uploadBtn?.addEventListener('click', () => uploadInput.click());
  uploadInput?.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleImageUpload(e.target.files[0]);
    }
  });

  const handlePaste = (e) => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData).items;
    for (const item of items) {
      if (item.type.indexOf('image') === 0) {
        e.preventDefault();
        const file = item.getAsFile();
        handleImageUpload(file);
        break;
      }
    }
  };

  if (cm) {
    cm.on('paste', (instance, e) => handlePaste(e));
  } else {
    latexInput?.addEventListener('paste', handlePaste);
  }

  document.querySelector('#delete-assignment')?.addEventListener('click', async () => {
    if (!window.confirm('Xóa đề này?')) return;
    try {
      await deleteAssignment(state.assignmentEditor.assignment.id);
      state.assignmentEditor = emptyEditor();
      state.isEditingAssignment = false;
      toast('Đã xóa đề.', 'success');
      await mountAssignmentManager();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  const editorForm = document.querySelector('#assignment-editor');
  if (editorForm) {
    const titleInput = editorForm.querySelector('[name="title"]');
    const pdfInput = editorForm.querySelector('[name="pdf_url"]');

    const validateTitle = () => {
      if (!titleInput.value.trim()) {
        titleInput.error = true;
        titleInput.errorText = 'Tên đề thi không được để trống';
        return false;
      }
      titleInput.error = false;
      titleInput.errorText = '';
      return true;
    };

    const validatePdf = () => {
      if (!pdfInput) return true;
      const val = pdfInput.value.trim();
      if (!val) {
        pdfInput.error = true;
        pdfInput.errorText = 'Link PDF không được để trống';
        return false;
      }
      if (val === 'latex') {
        pdfInput.error = false;
        pdfInput.errorText = '';
        return true;
      }
      if (!val.startsWith('http://') && !val.startsWith('https://')) {
        pdfInput.error = true;
        pdfInput.errorText = 'Link PDF phải bắt đầu bằng http:// hoặc https://';
        return false;
      }
      pdfInput.error = false;
      pdfInput.errorText = '';
      return true;
    };

    titleInput?.addEventListener('input', validateTitle);
    pdfInput?.addEventListener('input', () => {
      validatePdf();
      const previewContainer = document.querySelector('.pdf-preview-container');
      if (previewContainer) {
        if (pdfInput.value === 'latex') {
          // Trigger full re-render so it shows the latex questions logic
          state.assignmentEditor = collectEditor(lectures);
          state.assignmentEditor.assignment.pdf_url = 'latex';
          mountAssignmentManager();
        } else {
          previewContainer.innerHTML = renderPdfPreview(pdfInput.value);
        }
      }
    });

    editorForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const isTitleValid = validateTitle();
      const isPdfValid = validatePdf();
      if (!isTitleValid || !isPdfValid) {
        return;
      }
      const restore = setButtonLoading(event.currentTarget.querySelector('md-filled-button'));
      try {
        const editor = collectEditor(lectures);
        const isUpdate = !!editor.assignment.id;
        const savedAssignment = await saveAssignmentWithQuestions(
          {
            ...editor.assignment,
            id: editor.assignment.id || undefined,
            lecture_id: editor.assignment.lecture_id || null,
            owner_id: state.profile.id,
          },
          editor.questions,
        );
        let regradedCount = 0;
        if (isUpdate) {
          regradedCount = await regradeAssignment(savedAssignment.id);
        }
        const savedEditor = await fetchAssignmentEditor(savedAssignment.id);
        const prevLatexSource = editor.latexSource;
        const prevQuestions = editor.questions;
        state.assignmentEditor = normalizeAssignmentEditor(savedEditor);
        // Preserve latexSource and parsed questions after save in LaTeX mode
        if (editor.assignment.pdf_url === 'latex' || !editor.assignment.pdf_url) {
          state.assignmentEditor.latexSource = prevLatexSource;
          if (prevQuestions && prevQuestions.length > 0) {
            state.assignmentEditor.questions = prevQuestions;
          }
        }
        toast(regradedCount > 0 ? `Đã lưu đề và chấm lại ${regradedCount} bài đã nộp.` : 'Đã lưu đề thi.', 'success');
        await mountAssignmentManager();
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        restore();
      }
    });

    editorForm.addEventListener('input', () => {
      state.assignmentEditor = collectEditor(lectures);
    });
    editorForm.addEventListener('change', async (event) => {
      state.assignmentEditor = collectEditor(lectures);
      if (event.target?.matches('select[name^="question-type-"]')) {
        refreshQuestionBuilder(lectures);
      }
    });
  }
}

export function defaultQuestion(type) {
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
    choices: [],
    answer_key: { correct_answer: 'A' },
  };
}

export function collectEditor() {
  const form = document.querySelector('#assignment-editor');
  const values = Object.fromEntries(new FormData(form).entries());
  const existingQuestions = state.assignmentEditor?.questions || [];
  const resolvedPdfUrl = values.pdf_url !== undefined ? values.pdf_url : (state.assignmentEditor?.assignment?.pdf_url || 'latex');
  const isLatexMode = resolvedPdfUrl === 'latex' || !resolvedPdfUrl;

  // In LaTeX mode, questions come from state (managed by parseLatexAssignment)
  let questions;
  if (isLatexMode) {
    questions = existingQuestions;
  } else {
    questions = Array.from(document.querySelectorAll('.question-editor')).map((card) => {
      const index = Number(card.dataset.index);
      const existing = existingQuestions[index] || {};
      const type = values[`question-type-${index}`];
      const base = {
        id: values[`question-id-${index}`] || undefined,
        type,
        prompt: existing.prompt || `Câu ${index + 1}`,
        points: 1,
        sort_order: Number(values[`question-sort-${index}`] || index + 1),
        choices: existing.choices || [],
        settings: existing.settings || {},
        answer_key: {},
      };

      if (type === 'mcq') {
        base.answer_key = { correct_answer: values[`mcq-answer-${index}`] || 'A' };
      }
      if (type === 'tf4') {
        base.settings = {
          ...base.settings,
          statements: [0, 1, 2, 3].map((item) => values[`tf-statement-${index}-${item}`] || `Ý ${item + 1}`),
        };
        base.answer_key = {
          correct_answer: [0, 1, 2, 3].map((item) => values[`tf-answer-${index}-${item}`] === 'true'),
          points_map: [],
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
  }

  return {
    assignment: {
      id: values.id || undefined,
      title: values.title,
      description: isLatexMode ? (state.assignmentEditor?.latexSource || '') : values.description,
      pdf_url: resolvedPdfUrl,
      lecture_id: values.lecture_id || null,
      sort_order: Number(values.sort_order || 0),
      published: values.published !== 'false',
    },
    questions,
    latexSource: state.assignmentEditor?.latexSource || '',
  };
}

export async function mountStudents() {
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
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

export function renderStudentRows(students) {
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
                    <md-icon-button data-save-student="${student.id}" aria-label="Lưu"><md-icon>save</md-icon></md-icon-button>
                    <md-icon-button data-reset-student="${student.id}" aria-label="Reset mật khẩu"><md-icon>key</md-icon></md-icon-button>
                    <md-icon-button data-delete-student="${student.id}" aria-label="Xóa"><md-icon>delete</md-icon></md-icon-button>
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

export function wireStudentManager() {
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
        await deleteManagedUser(button.dataset.deleteStudent);
        toast('Đã xóa học sinh.', 'success');
        await mountStudents();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
}

export async function mountGrades() {
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
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}




// ─── Salary Manager ───────────────────────────────────────────────────────────

function getDaysInMonth(year, month) {
  const days = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

export async function mountSalaryManager() {
  const root = pageRoot();
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();

  async function rerender() {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    root.innerHTML = renderLoading('Đang tải lịch dạy…');
    let schedules = [], students = [];
    try {
      [schedules, students] = await Promise.all([fetchSalaryMonth(monthStr), fetchStudents()]);
    } catch (err) {
      root.innerHTML = renderErrorState(err);
      wireRouteRetry(root);
      return;
    }

    const days = getDaysInMonth(year, month);
    const fmt = new Intl.NumberFormat('vi-VN');
    const DAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    const totalSalary = schedules.reduce((sum, s) => {
      const taughtCount = (s.salary_sessions ?? []).filter(x => x.taught).length;
      return sum + taughtCount * Number(s.rate_per_session ?? 0);
    }, 0);

    const scheduledIds = new Set(schedules.map((s) => s.student_id));
    const unscheduled = students.filter((s) => !scheduledIds.has(s.id));
    const monthLabel = `${month + 1}/${year}`;

    function renderStudentTracker(s) {
      const sessionMap = {};
      for (const x of (s.salary_sessions ?? [])) {
        sessionMap[x.session_date] = x.taught ? 'taught' : 'scheduled';
      }
      const taughtCount = Object.values(sessionMap).filter(v => v === 'taught').length;
      const scheduledCount = Object.values(sessionMap).filter(v => v === 'scheduled').length;
      const rate = Number(s.rate_per_session ?? 0);
      const total = taughtCount * rate;
      const firstDow = (days[0].getDay() + 6) % 7;

      function cellStyle(cellState, isWeekend) {
        if (cellState === 'taught') return `background:var(--md-sys-color-primary); color:var(--md-sys-color-on-primary); border:2px solid var(--md-sys-color-primary);`;
        if (cellState === 'scheduled') return `background:transparent; color:${isWeekend ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-primary)'}; border:2px solid var(--md-sys-color-primary);`;
        return `background:var(--md-sys-color-surface-container); color:${isWeekend ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-on-surface-variant)'}; border:2px solid transparent;`;
      }

      return `
        <div class="panel" data-schedule="${s.id}" style="padding: 20px; display:flex; flex-direction:column; gap:14px; box-sizing:border-box; margin:0;">
          <!-- Name row -->
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <h3 style="margin:0; font-size:15px; font-weight:700; color:var(--md-sys-color-on-surface);">${escapeHtml(s.profiles?.full_name ?? 'Học sinh')}</h3>
            <button type="button" data-delete-schedule="${s.id}" title="Xóa lịch tháng này"
              style="background:none; border:1px solid var(--md-sys-color-outline-variant); border-radius:6px; color:var(--md-sys-color-on-surface-variant); cursor:pointer; padding:4px 8px; font-size:12px; transition: all 0.15s;"
              onmouseover="this.style.borderColor='var(--md-sys-color-error)'; this.style.color='var(--md-sys-color-error)';"
              onmouseout="this.style.borderColor='var(--md-sys-color-outline-variant)'; this.style.color='var(--md-sys-color-on-surface-variant)';">
              Xóa
            </button>
          </div>

          <!-- Stats row -->
          <div style="display:flex; align-items:center; gap:0; background:var(--md-sys-color-surface-container-lowest); border:1px solid var(--md-sys-color-outline-variant); border-radius:8px; overflow:hidden; font-size:13px;">
            <div style="flex:1; padding:8px 12px; border-right:1px solid var(--md-sys-color-outline-variant);">
              <div style="color:var(--md-sys-color-on-surface-variant); font-size:11px; margin-bottom:1px;">Lịch</div>
              <strong style="font-size:15px;">${scheduledCount + taughtCount}</strong>
            </div>
            <div style="flex:1; padding:8px 12px; border-right:1px solid var(--md-sys-color-outline-variant);">
              <div style="color:var(--md-sys-color-on-surface-variant); font-size:11px; margin-bottom:1px;">Đã dạy</div>
              <strong style="font-size:15px;" data-count="${s.id}">${taughtCount}</strong>
            </div>
            <div style="flex:1; padding:8px 12px;">
              <div style="color:var(--md-sys-color-on-surface-variant); font-size:11px; margin-bottom:1px;">Lương</div>
              <strong style="font-size:15px; color:var(--md-sys-color-primary);" data-total="${s.id}">${fmt.format(total)}đ</strong>
            </div>
          </div>

          <!-- Rate row -->
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <label style="font-size:12px; font-weight:600; color:var(--md-sys-color-on-surface-variant);">Đơn giá / buổi</label>
            <div style="display:flex; align-items:center; gap:6px;">
              <input type="number" class="field rate-input" data-rate-for="${s.id}" value="${rate}" min="0" step="10000"
                style="width:110px; height:34px; border-radius:6px; padding:0 10px; font-size:13px; text-align:right; font-weight:600;">
              <span style="font-size:13px; color:var(--md-sys-color-on-surface-variant);">đ</span>
            </div>
          </div>

          <hr style="border:none; border-top:1px solid var(--md-sys-color-outline-variant); margin:0;">

          <!-- Legend -->
          <div style="display:flex; gap:14px; font-size:11px; color:var(--md-sys-color-on-surface-variant);">
            <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:var(--md-sys-color-surface-container);border:1px solid var(--md-sys-color-outline-variant);display:inline-block;"></span>Trống</span>
            <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:transparent;border:2px solid var(--md-sys-color-primary);display:inline-block;"></span>Có lịch</span>
            <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:var(--md-sys-color-primary);display:inline-block;"></span>Đã dạy</span>
          </div>

          <!-- Calendar -->
          <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:3px; text-align:center;">
            ${DAY_SHORT.map((d, i) => `<div style="font-size:10px; font-weight:700; color:${i >= 5 ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-on-surface-variant)'}; padding:3px 0;">${d}</div>`).join('')}
            ${Array(firstDow).fill('<div></div>').join('')}
            ${days.map((d) => {
              const iso = d.toISOString().slice(0, 10);
              const cellState = sessionMap[iso] ?? 'none';
              const dow = d.getDay();
              const isWeekend = dow === 0 || dow === 6;
              return `<button type="button" class="day-cell" data-toggle="${s.id}" data-date="${iso}" data-state="${cellState}"
                style="padding:0; border-radius:5px; cursor:pointer; font-size:12px; font-weight:600; aspect-ratio:1; display:flex; align-items:center; justify-content:center; ${cellStyle(cellState, isWeekend)} transition: all 0.1s;"
              >${d.getDate()}</button>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    root.innerHTML = `
      <style>
        .day-cell:hover { transform: scale(1.1); }
        .day-cell:active { transform: scale(0.94); }
        .salary-nav-btn { background: var(--md-sys-color-surface-container-lowest); border: 1px solid var(--md-sys-color-outline-variant); border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 18px; line-height: 1; color: var(--md-sys-color-on-surface); transition: background 0.15s; }
        .salary-nav-btn:hover { background: var(--md-sys-color-surface-container); }
      </style>
      <section style="max-width:900px; margin:0 auto; padding:var(--page-gutter,24px); display:flex; flex-direction:column; gap:20px;">

        <!-- Top bar -->
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <button id="prev-month" class="salary-nav-btn" title="Tháng trước">‹</button>
            <div style="min-width:90px; text-align:center;">
              <div style="font-size:11px; font-weight:600; color:var(--md-sys-color-on-surface-variant); text-transform:uppercase; letter-spacing:.5px;">Tháng</div>
              <div style="font-size:20px; font-weight:800; color:var(--md-sys-color-on-surface);">${monthLabel}</div>
            </div>
            <button id="next-month" class="salary-nav-btn" title="Tháng sau">›</button>
          </div>
          <div style="background:var(--md-sys-color-primary-container); color:var(--md-sys-color-on-primary-container); border-radius:10px; padding:10px 20px; font-weight:700; font-size:15px;">
            Tổng: <span style="font-size:18px;">${fmt.format(totalSalary)}đ</span>
          </div>
        </div>

        <!-- Tracker grid -->
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:16px; align-items:start;" id="tracker-list">
          ${schedules.length
            ? schedules.map(renderStudentTracker).join('')
            : `<div style="color:var(--md-sys-color-on-surface-variant); text-align:center; padding:40px 0; font-size:14px; grid-column:1/-1;">
                Chưa có học sinh nào trong tháng này.<br>Thêm học sinh bên dưới để bắt đầu tick lịch.
              </div>`
          }
        </div>

        <!-- Add student -->
        ${(unscheduled.length > 0 && schedules.length < 2) ? `
          <div class="panel" style="padding: 16px; display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; border-style:dashed;">
            <div style="flex:1; min-width:180px;">
              <label class="field-label" style="display:block; font-size:12px; font-weight:600; color:var(--md-sys-color-on-surface-variant); margin-bottom:5px;">Thêm học sinh vào tháng ${monthLabel}</label>
              <select id="add-student-sel" class="field" style="height:38px; border-radius:6px; padding:0 10px;">
                <option value="">-- Chọn học sinh --</option>
                ${unscheduled.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.full_name)}</option>`).join('')}
              </select>
            </div>
            <button id="add-student-btn" type="button" style="height:38px; padding:0 18px; background:var(--md-sys-color-primary); color:var(--md-sys-color-on-primary); border:0; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; transition:opacity 0.15s;" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
              + Thêm
            </button>
          </div>
        ` : ''}

      </section>
    `;

    // Wire month navigation
    document.getElementById('prev-month')?.addEventListener('click', () => {
      month--; if (month < 0) { month = 11; year--; } rerender();
    });
    document.getElementById('next-month')?.addEventListener('click', () => {
      month++; if (month > 11) { month = 0; year++; } rerender();
    });

    // Wire add student
    document.getElementById('add-student-btn')?.addEventListener('click', async () => {
      const sel = document.getElementById('add-student-sel');
      const studentId = sel?.value;
      if (!studentId) { toast('Chọn học sinh trước!', 'error'); return; }
      try {
        await upsertSalarySchedule({ studentId, month: monthStr, ratePerSession: 0, notes: '' });
        await rerender();
      } catch (err) { toast(err.message, 'error'); }
    });

    // Wire delete schedule
    document.querySelectorAll('[data-delete-schedule]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Xóa lịch dạy của học sinh này trong tháng?')) return;
        try {
          await deleteSalarySchedule(btn.dataset.deleteSchedule);
          await rerender();
        } catch (err) { toast(err.message, 'error'); }
      });
    });

    // Wire rate input
    document.querySelectorAll('.rate-input').forEach((input) => {
      const save = async () => {
        const scheduleId = input.dataset.rateFor;
        const rate = Number(input.value) || 0;
        try {
          const { supabase: sb } = await import('./services/supabaseClient.js');
          await sb.from('salary_schedules').update({ rate_per_session: rate }).eq('id', scheduleId);
          const fmtNew = new Intl.NumberFormat('vi-VN');
          const countEl = document.querySelector(`[data-count="${scheduleId}"]`);
          const totalEl = document.querySelector(`[data-total="${scheduleId}"]`);
          const count = Number(countEl?.textContent ?? 0);
          if (totalEl) totalEl.textContent = `${fmtNew.format(count * rate)}đ`;
        } catch (err) { toast(err.message, 'error'); }
      };
      input.addEventListener('blur', save);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    });

    // Wire day cell toggle: none → scheduled → taught → none
    document.querySelectorAll('.day-cell').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const scheduleId = btn.dataset.toggle;
        const sessionDate = btn.dataset.date;
        const prevState = btn.dataset.state ?? 'none';
        const nextState = prevState === 'none' ? 'scheduled' : prevState === 'scheduled' ? 'taught' : 'none';
        const dow = new Date(sessionDate + 'T00:00:00').getDay();
        const isWeekend = dow === 0 || dow === 6;

        btn.dataset.state = nextState;
        if (nextState === 'taught') {
          btn.style.background = 'var(--md-sys-color-primary)';
          btn.style.color = 'var(--md-sys-color-on-primary)';
          btn.style.border = '2px solid var(--md-sys-color-primary)';
        } else if (nextState === 'scheduled') {
          btn.style.background = 'transparent';
          btn.style.color = isWeekend ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-primary)';
          btn.style.border = '2px solid var(--md-sys-color-primary)';
        } else {
          btn.style.background = 'var(--md-sys-color-surface-container)';
          btn.style.color = isWeekend ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-on-surface-variant)';
          btn.style.border = '2px solid transparent';
        }

        const card = btn.closest('[data-schedule]');
        const countEl = card?.querySelector(`[data-count="${scheduleId}"]`);
        const totalEl = card?.querySelector(`[data-total="${scheduleId}"]`);
        const rateInput = card?.querySelector(`[data-rate-for="${scheduleId}"]`);
        const rate = Number(rateInput?.value ?? 0);
        if (countEl) {
          const delta = nextState === 'taught' ? 1 : (prevState === 'taught' ? -1 : 0);
          const newCount = Math.max(0, Number(countEl.textContent) + delta);
          countEl.textContent = newCount;
          if (totalEl) totalEl.textContent = `${new Intl.NumberFormat('vi-VN').format(newCount * rate)}đ`;
        }

        try {
          await setSessionState({ scheduleId, sessionDate, state: nextState });
        } catch (err) {
          btn.dataset.state = prevState;
          toast(err.message, 'error');
          await rerender();
        }
      });
    });
  }

  await rerender();
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
