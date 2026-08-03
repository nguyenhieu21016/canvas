import { normalizeAssignmentEditor, normalizeEditorQuestion } from './lib/assignment.js';
// admin.js - Lazy loaded module for admin routes
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
import { renderLoading, renderErrorState, wireTableSearch, toast, renderMetric, renderSkeletonAssignments, renderAccountAvatar } from './lib/ui.js';




export function mountManageHub() {
  const root = pageRoot();
  const items = [
    {
      href: '#/students',
      tag: 'HỌC SINH',
      title: 'Theo dõi & Quản lý Học sinh',
      description: 'Theo dõi tiến độ bài giảng, xem bảng điểm, trạng thái online và quản lý tài khoản.',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
    },
    {
      href: '#/content',
      tag: 'KHÓA HỌC',
      title: 'Quản lý Nội dung khóa học',
      description: 'Cấu trúc các giai đoạn, chương, bài học và danh sách bài giảng.',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    },
    {
      href: '#/assignments',
      tag: 'ĐỀ THI & BÀI TẬP',
      title: 'Quản lý Đề thi & Bài tập',
      description: 'Tạo bài tập, cài đặt đáp án, phiếu trả lời và chấm bài.',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`,
    },
    {
      href: '#/salary',
      tag: 'LƯƠNG & LỊCH',
      title: 'Lịch dạy & Lương',
      description: 'Cập nhật điểm danh lịch dạy và tổng hợp thu nhập trợ giảng.',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    },
  ];

  root.innerHTML = `
    <style>
      .nh-hub-card {
        background: #ffffff;
        border-radius: 16px;
        border: 1px solid #D8E2C4;
        padding: 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        text-decoration: none;
        color: inherit;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
        transition: all 0.2s ease;
        cursor: pointer;
      }
      .nh-hub-card:hover {
        box-shadow: 0 8px 24px rgba(69, 81, 32, 0.09);
        border-color: #455120;
        transform: translateY(-2px);
      }
      .nh-hub-icon-wrapper {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #F0F4E8;
        border: 1px solid #D8E2CA;
        color: #455120;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.2s ease;
      }
      .nh-hub-card:hover .nh-hub-icon-wrapper {
        background: #455120;
        color: #ffffff;
        border-color: #455120;
      }
      .nh-hub-arrow-btn {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: #F0F4E8;
        border: 1px solid #D8E2CA;
        color: #455120;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.2s ease;
      }
      .nh-hub-card:hover .nh-hub-arrow-btn {
        background: #455120;
        color: #ffffff;
        border-color: #455120;
        transform: translateX(4px);
      }
    </style>

    <div style="min-height: calc(100vh - 64px); background: #EDF2E4; padding: 0 0 60px 0; font-family: 'Be Vietnam Pro', sans-serif;">
      
      <!-- Top Breadcrumb Bar -->
      <div class="nh-admin-breadcrumb-bar" style="margin-bottom: 24px;">
        <div class="nh-admin-breadcrumb-inner" style="max-width: 1000px;">
          <a href="#/learn">Trang chủ</a>
          <span class="sep">&rsaquo;</span>
          <span class="active">Trung tâm Quản trị</span>
        </div>
      </div>

      <div style="max-width: 1000px; margin: 0 auto; padding: 0 max(var(--page-gutter), 24px); display: flex; flex-direction: column; gap: 24px;">
        
        <!-- Hero Header Card -->
        <div style="background: #ffffff; border-radius: 18px; border: 1px solid #D8E2C4; padding: 28px 32px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: #455120; letter-spacing: 0.08em; margin-bottom: 6px;">HỆ THỐNG QUẢN TRỊ</div>
            <h1 style="font-family: 'Beautique Display', serif; font-size: 26px; font-weight: 700; color: #1e293b; margin: 0 0 4px 0;">Trung tâm Quản trị</h1>
            <p style="font-size: 14px; color: #64748b; margin: 0;">Quản lý toàn bộ hệ thống nội dung khóa học, đề thi, theo dõi học sinh và giảng dạy.</p>
          </div>
        </div>

        <!-- Cards grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(460px, 1fr)); gap: 20px;">
          ${items.map(item => `
            <a href="${item.href}" class="nh-hub-card">
              <div style="display: flex; align-items: center; gap: 18px; min-width: 0; flex: 1;">
                <div class="nh-hub-icon-wrapper">
                  ${item.icon}
                </div>
                <div style="min-width: 0; flex: 1;">
                  <div style="font-size: 10.5px; font-weight: 700; color: #455120; letter-spacing: 0.08em; margin-bottom: 2px;">${escapeHtml(item.tag)}</div>
                  <h3 style="font-family: 'Beautique Display', serif; font-size: 17px; font-weight: 700; color: #455120; margin: 0 0 4px 0;">${escapeHtml(item.title)}</h3>
                  <p style="font-size: 13px; color: #64748b; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">${escapeHtml(item.description)}</p>
                </div>
              </div>
              <div class="nh-hub-arrow-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
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
      <!-- Top Breadcrumb Bar -->
      <div class="nh-admin-breadcrumb-bar">
        <div class="nh-admin-breadcrumb-inner">
          <a href="#/manage">Trung tâm Quản trị</a>
          <span class="sep">&rsaquo;</span>
          <span class="active">Quản lý Nội dung khóa học</span>
        </div>
      </div>

      <style>
        .content-manager-layout {
          display: flex;
          height: calc(100vh - 110px);
          background: #EDF2E4;
          overflow: hidden;
        }
        .phase-list-column {
          width: 280px;
          flex-shrink: 0;
          background: #ffffff;
          border-radius: 18px;
          padding: 20px 0;
          border: 1px solid #D8E2C4;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
          height: fit-content;
          margin: 40px 0 40px 40px;
        }
        .phase-list-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 18px;
          margin: 0 16px 6px 16px;
          border-radius: 9999px;
          cursor: pointer;
          font-family: 'Beautique Display', 'Beautique Display Condensed', serif;
          font-size: 14px;
          font-weight: 600;
          color: #475467;
          transition: all 0.15s ease;
        }
        .phase-list-item:hover {
          background: #FAFBF8;
          color: #455120;
        }
        .phase-list-item.active {
          background: #F0F4E8;
          color: #455120;
          font-weight: 700;
        }
        .phase-list-item svg {
          opacity: 0.5;
          transition: opacity 0.15s ease;
          stroke: currentColor;
        }
        .phase-list-item.active svg {
          opacity: 1;
          stroke: #455120;
        }
        .structure-column {
          flex: 1;
          padding: 40px 24px;
          overflow-y: auto;
          background: transparent;
        }
        .structure-card-wrapper {
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid #D8E2C4;
          box-shadow: 0 4px 16px rgba(0,0,0,0.03);
          padding: 28px;
        }
        .btn-pill-action {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #455120;
          border: 1.5px solid #455120;
          background: transparent;
          border-radius: 9999px;
          padding: 6px 16px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-pill-action:hover {
          background: #455120;
          color: #ffffff;
        }
        /* Tree Hierarchy Styles */
        .structure-children {
          margin-left: 24px;
          padding-left: 20px;
          border-left: 1.5px dashed #cbd5e1;
          position: relative;
        }
        .manage-node {
          padding: 10px 0;
          border-bottom: 1.5px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .manage-node:last-child {
          border-bottom: none;
        }
        .toggle-children {
          display: flex;
          align-items: center;
          cursor: pointer;
          flex: 1;
          min-width: 0;
          gap: 8px;
        }
        .toggle-children strong {
          white-space: normal;
          word-break: break-word;
          line-height: 1.4;
        }
        .node-meta {
          margin-left: 8px;
          color: #64748b;
          font-size: 12px;
          font-weight: 400;
        }
        /* Level Colors & Typography */
        .manage-node[data-entity="phase"] strong { font-size: 16px; color: #455120; font-weight: 700; }
        .manage-node[data-entity="module"] strong { font-size: 15px; color: #1e293b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; }
        .manage-node[data-entity="lectureGroup"] strong { font-size: 14.5px; color: #334155; font-weight: 600; }
        .manage-node[data-entity="lecture"] strong { font-size: 14px; font-weight: 400; color: #475569; }
        
        .icon-actions {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .icon-btn-utility {
          background: none;
          border: none;
          padding: 6px;
          border-radius: 50%;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .icon-btn-utility:hover {
          background: #f1f5f9;
          color: #475569;
        }
        .icon-btn-utility.delete:hover {
          background: #fef2f2;
          color: #ef4444;
        }
        
        .editor-column {
          width: 360px;
          flex-shrink: 0;
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid #D8E2C4;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
          padding: 32px 24px;
          max-height: calc(100vh - 144px);
          overflow-y: auto;
          margin: 40px 40px 40px 0;
        }
        .editor-column .entity-form { display: none; }
        .editor-column .entity-form.active { display: grid; gap: 16px; }
        .editor-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #64748b;
          border: 1.5px dashed #cbd5e1;
          border-radius: 12px;
          padding: 48px 16px;
          gap: 12px;
        }
        .editor-placeholder.hidden { display: none; }
      </style>
      <div class="content-manager-layout">
        <aside class="phase-list-column">
          <div style="padding: 0 24px 20px; border-bottom: 1px solid #f1f5f9; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 0.08em; margin-bottom: 4px;">GIAI ĐOẠN</div>
              <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b;">Danh sách</h2>
            </div>
            <button data-create="phase" class="icon-btn-utility" style="border: 1px solid #e2e8f0;" title="Thêm giai đoạn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>
          <div id="phase-list-container">
            ${renderPhaseList(data.phases, currentContentPhaseId)}
          </div>
        </aside>

        <section class="structure-column">
          <div class="structure-card-wrapper">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
              <div>
                <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #1e293b;">Cấu trúc chi tiết</h2>
                <p style="font-size: 13px; color: #64748b; margin: 4px 0 0 0;">Thiết lập tổ chức chương trình đào tạo của giai đoạn này.</p>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button data-create="module" class="btn-pill-action">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Chương
                </button>
                <button data-create="lectureGroup" class="btn-pill-action">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Nhóm
                </button>
                <button data-create="lecture" class="btn-pill-action">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Bài giảng
                </button>
              </div>
            </div>
            <div id="manage-structure-container">
              ${renderActivePhaseStructure(data.phases, currentContentPhaseId)}
            </div>
          </div>
        </section>

        <aside class="editor-column">
          <div class="editor-placeholder" id="content-editor-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
            <p style="margin: 0; font-size: 13.5px; line-height: 1.55;">Chọn một mục bên trái để sửa hoặc bấm nút Thêm mới.</p>
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
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
    <form class="entity-form compact-entity-form" data-entity="phase" style="display: flex; flex-direction: column; gap: 16px;">
      <div class="entity-form-heading" style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 4px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
        <h3 style="font-family: 'Beautique Display', serif; font-size: 17px; font-weight: 700; color: #455120; margin: 0;">Cấu hình Giai đoạn</h3>
      </div>
      <input type="hidden" name="id">
      <input type="hidden" name="description" value="">
      <input type="hidden" name="sort_order" value="0">
      <input type="hidden" name="published" value="true">
      
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 12.5px; font-weight: 600; color: #334155;">Tên Giai đoạn</label>
        <input class="nh-form-input-clean" name="title" placeholder="Nhập tên giai đoạn..." required>
      </div>

      <div style="max-height: 140px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; background: #ffffff;">
        <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #455120;">Hiển thị cho học sinh (để trống = tất cả):</div>
        ${students.map(s => `
          <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 13px; color: #334155; cursor: pointer;">
            <input type="checkbox" name="student_ids" value="${escapeHtml(s.id)}" style="accent-color: #455120; width: 15px; height: 15px;">
            ${escapeHtml(s.full_name)}
          </label>
        `).join('')}
      </div>

      <div style="display: flex; gap: 10px; margin-top: 8px;">
        <button type="submit" class="nh-modal-btn-primary">Lưu</button>
        <button type="reset" class="nh-modal-btn-secondary">Thêm mới</button>
      </div>
    </form>
  `;
}

export function renderModuleForm(phases) {
  return `
    <form class="entity-form compact-entity-form" data-entity="module" style="display: flex; flex-direction: column; gap: 16px;">
      <div class="entity-form-heading" style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 4px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        <h3 style="font-family: 'Beautique Display', serif; font-size: 17px; font-weight: 700; color: #455120; margin: 0;">Cấu hình Chương</h3>
      </div>
      <input type="hidden" name="id">
      <input type="hidden" name="description" value="">
      <input type="hidden" name="sort_order" value="0">
      <input type="hidden" name="published" value="true">

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 12.5px; font-weight: 600; color: #334155;">Thuộc Giai đoạn</label>
        <select class="nh-form-input-clean" name="phase_id" required style="height: 40px;">
          <option value="">-- Chọn giai đoạn --</option>
          ${phases.map((phase) => option(phase.id, phase.title)).join('')}
        </select>
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 12.5px; font-weight: 600; color: #334155;">Tên Chương</label>
        <input class="nh-form-input-clean" name="title" placeholder="Nhập tên chương..." required>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 8px;">
        <button type="submit" class="nh-modal-btn-primary">Lưu</button>
        <button type="reset" class="nh-modal-btn-secondary">Thêm mới</button>
      </div>
    </form>
  `;
}

export function renderLectureGroupForm(phases, modules) {
  return `
    <form class="entity-form compact-entity-form" data-entity="lectureGroup" style="display: flex; flex-direction: column; gap: 16px;">
      <div class="entity-form-heading" style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 4px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
        <h3 style="font-family: 'Beautique Display', serif; font-size: 17px; font-weight: 700; color: #455120; margin: 0;">Cấu hình Bài học (Nhóm)</h3>
      </div>
      <input type="hidden" name="id">
      <input type="hidden" name="description" value="">
      <input type="hidden" name="sort_order" value="0">
      <input type="hidden" name="published" value="true">

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 12.5px; font-weight: 600; color: #334155;">Giai đoạn</label>
        <select class="nh-form-input-clean cascade-phase" name="phase_id" required style="height: 40px;">
          <option value="">-- Chọn giai đoạn --</option>
          ${phases.map((phase) => option(phase.id, phase.title)).join('')}
        </select>
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 12.5px; font-weight: 600; color: #334155;">Chương</label>
        <select class="nh-form-input-clean cascade-module" name="module_id" required disabled style="height: 40px;">
          <option value="">-- Chọn chương --</option>
          ${modules.map((module) => `<option value="${escapeHtml(module.id)}" data-phase-id="${escapeHtml(module.phase_id)}">${escapeHtml(module.title)}</option>`).join('')}
        </select>
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 12.5px; font-weight: 600; color: #334155;">Tên Bài học</label>
        <input class="nh-form-input-clean" name="title" placeholder="VD: Bài 1: Sự đồng biến..." required>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 8px;">
        <button type="submit" class="nh-modal-btn-primary">Lưu</button>
        <button type="reset" class="nh-modal-btn-secondary">Thêm mới</button>
      </div>
    </form>
  `;
}

export function renderLectureForm(phases, modules, lectureGroups) {
  return `
    <form class="entity-form compact-entity-form" data-entity="lecture" style="display: flex; flex-direction: column; gap: 16px;">
      <div class="entity-form-heading" style="display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 4px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
        <h3 style="font-family: 'Beautique Display', serif; font-size: 17px; font-weight: 700; color: #455120; margin: 0;">Cấu hình Dạng bài (Bài giảng)</h3>
      </div>
      <input type="hidden" name="id">
      <input type="hidden" name="description" value="">
      <input type="hidden" name="sort_order" value="0">
      <input type="hidden" name="published" value="true">

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 12.5px; font-weight: 600; color: #334155;">Giai đoạn</label>
        <select class="nh-form-input-clean cascade-phase" name="phase_id" required style="height: 40px;">
          <option value="">-- Chọn giai đoạn --</option>
          ${phases.map((phase) => option(phase.id, phase.title)).join('')}
        </select>
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 12.5px; font-weight: 600; color: #334155;">Chương</label>
        <select class="nh-form-input-clean cascade-module" name="module_id" required disabled style="height: 40px;">
          <option value="">-- Chọn chương --</option>
          ${modules.map((module) => `<option value="${escapeHtml(module.id)}" data-phase-id="${escapeHtml(module.phase_id)}">${escapeHtml(module.title)}</option>`).join('')}
        </select>
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 12.5px; font-weight: 600; color: #334155;">Bài học (Nhóm)</label>
        <select class="nh-form-input-clean cascade-group" name="group_id" disabled style="height: 40px;">
          <option value="">-- Chưa chọn nhóm --</option>
          ${lectureGroups.map((group) => `<option value="${escapeHtml(group.id)}" data-module-id="${escapeHtml(group.module_id)}">${escapeHtml(group.title)}</option>`).join('')}
        </select>
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 12.5px; font-weight: 600; color: #334155;">Tên Dạng bài</label>
        <input class="nh-form-input-clean" name="title" placeholder="VD: 1.1. Dạng 1 - Xét tính đơn điệu..." required>
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label style="font-size: 12.5px; font-weight: 600; color: #334155;">Link Google Drive Slide / Tài liệu</label>
        <input class="nh-form-input-clean" name="slide_url" placeholder="https://drive.google.com/...">
      </div>

      <div style="display: flex; gap: 10px; margin-top: 8px;">
        <button type="submit" class="nh-modal-btn-primary">Lưu</button>
        <button type="reset" class="nh-modal-btn-secondary">Thêm mới</button>
      </div>
    </form>
  `;
}

export function renderManagePhase(phase) {
  return `
    <div class="manage-node" data-entity="phase" data-parent="root" data-id="${phase.id}" data-payload="${escapeHtml(JSON.stringify(phase))}">
      <div class="toggle-children" aria-expanded="true">
        <svg class="expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; transition: transform 0.2s;"><polyline points="6 9 12 15 18 9"></polyline></svg>
        <strong>${escapeHtml(phase.title)}</strong>
        <span class="node-meta">${phase.modules.length} Chương</span>
      </div>
      <div class="icon-actions">
        <button class="icon-btn-utility" data-edit-phase="${phase.id}" data-payload="${escapeHtml(JSON.stringify(phase))}" title="Sửa giai đoạn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
        </button>
        <button class="icon-btn-utility delete" data-delete-phase="${phase.id}" title="Xóa giai đoạn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      </div>
    </div>
    <div class="structure-children">
    ${phase.modules
      .map(
        (module) => `
          <div class="manage-node child" data-entity="module" data-parent="${phase.id}" data-id="${module.id}" data-payload="${escapeHtml(JSON.stringify(module))}">
            <div class="toggle-children" aria-expanded="true">
              <svg class="expand-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; transition: transform 0.2s;"><polyline points="6 9 12 15 18 9"></polyline></svg>
              <strong>${escapeHtml(module.title)}</strong>
              <span class="node-meta">${module.lecture_groups.length} nhóm · ${module.lectures.length} bài giảng</span>
            </div>
            <div class="icon-actions">
              <button class="icon-btn-utility" data-edit-module="${module.id}" data-payload="${escapeHtml(JSON.stringify(module))}" title="Sửa Chương">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
              </button>
              <button class="icon-btn-utility delete" data-delete-module="${module.id}" title="Xóa Chương">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </div>
          </div>
          <div class="structure-children">
          ${module.lecture_groups
            .map(
              (group) => `
                <div class="manage-node grandchild" data-entity="lectureGroup" data-parent="${module.id}" data-id="${group.id}" data-payload="${escapeHtml(JSON.stringify(group))}">
                  <div class="toggle-children" aria-expanded="false">
                    <svg class="expand-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; transition: transform 0.2s; transform: rotate(-90deg);"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    <strong>${escapeHtml(group.title)}</strong>
                    <span class="node-meta">${group.lectures.length} bài giảng</span>
                  </div>
                  <div class="icon-actions">
                    <button class="icon-btn-utility" data-edit-lecture-group="${group.id}" data-payload="${escapeHtml(JSON.stringify(group))}" title="Sửa Bài học">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
                    </button>
                    <button class="icon-btn-utility delete" data-delete-lecture-group="${group.id}" title="Xóa Bài học">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
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
      <div style="display: flex; align-items: center; flex: 1; padding-left: 28px; min-width: 0; gap: 8px;">
        <span style="width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid #94a3b8; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #64748b; flex-shrink: 0;">L</span>
        <strong style="white-space: normal; word-break: break-word; line-height: 1.4;">${escapeHtml(lecture.title)}</strong>
        <span class="node-meta">${escapeHtml(statusText)}</span>
      </div>
      <div class="icon-actions">
        <button class="icon-btn-utility" data-edit-lecture="${lecture.id}" data-payload="${escapeHtml(JSON.stringify(lecture))}" title="Sửa bài giảng">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
        </button>
        <button class="icon-btn-utility delete" data-delete-lecture="${lecture.id}" title="Xóa bài giảng">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
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
        <!-- Top Breadcrumb Bar -->
        <div class="nh-admin-breadcrumb-bar">
          <div class="nh-admin-breadcrumb-inner">
            <a href="#/manage">Trung tâm Quản trị</a>
            <span class="sep">&rsaquo;</span>
            <a href="#/assignments">Quản lý Bài tập & Đề thi</a>
            <span class="sep">&rsaquo;</span>
            <span class="active">Chỉnh sửa đề thi</span>
          </div>
        </div>

        <section class="assignment-editor-view" style="background: #EDF2E4; min-height: calc(100vh - 110px); padding: 24px max(var(--page-gutter), 16px);">
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
        <!-- Top Breadcrumb Bar -->
        <div class="nh-admin-breadcrumb-bar">
          <div class="nh-admin-breadcrumb-inner" style="max-width: 1040px;">
            <a href="#/manage">Trung tâm Quản trị</a>
            <span class="sep">&rsaquo;</span>
            <span class="active">Quản lý Bài tập & Đề thi</span>
          </div>
        </div>

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
        <section style="background: #EDF2E4; min-height: calc(100vh - 110px); padding: 32px max(var(--page-gutter), 24px);">
          <div style="max-width: 1040px; margin: 0 auto; width: 100%;">
            
            <!-- White Header Card -->
            <div style="background: #ffffff; border-radius: 20px; border: 1px solid #D8E2C4; padding: 24px 32px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; box-shadow: 0 2px 10px rgba(69, 81, 32, 0.04);">
              <div>
                <h1 style="font-family: 'Beautique Display', serif; font-size: 24px; font-weight: 700; color: #101828; margin: 0 0 4px 0;">Đề thi & Bài tập về nhà</h1>
                <p style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 13.5px; color: #667085; margin: 0;">Danh sách tất cả đề thi trắc nghiệm và bài tập trong hệ thống</p>
              </div>

              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex: 1; max-width: 500px; justify-content: flex-end;">
                <div style="position: relative; flex: 1; min-width: 220px;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#667085" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); pointer-events: none;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <input type="text" id="assignment-search" placeholder="Tìm kiếm đề thi..." style="width: 100%; box-sizing: border-box; padding: 10px 16px 10px 40px; border-radius: 9999px; border: 1px solid #cbd5e1; font-family: 'Be Vietnam Pro', sans-serif; font-size: 13.5px; outline: none; transition: border-color 0.15s ease;" onfocus="this.style.borderColor='#455120'" onblur="this.style.borderColor='#cbd5e1'" />
                </div>
                <button type="button" id="new-assignment" style="display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; background: #455120; color: #ffffff; border: 0; border-radius: 9999px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 2px 8px rgba(69, 81, 32, 0.15);">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
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
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;">
                          <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 15px; font-weight: 700; color: #101828; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(assignment.title)}</span>
                          <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 12.5px; color: #667085;">${escapeHtml(assignment.lectures?.title ?? 'Bài tập tự do')}</span>
                        </div>
                      </div>
                      <div style="display: flex; gap: 6px; align-items: center;" onclick="event.stopPropagation()">
                        <button type="button" data-load-assignment="${assignment.id}" title="Chỉnh sửa" style="width: 36px; height: 36px; border-radius: 8px; border: 1px solid #e2e8f0; background: #ffffff; color: #455120; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;" onmouseover="this.style.background='#F0F4E8'" onmouseout="this.style.background='#ffffff'">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
                        </button>
                        <button type="button" data-delete-assignment="${assignment.id}" title="Xóa" style="width: 36px; height: 36px; border-radius: 8px; border: 1px solid #fecaca; background: #ffffff; color: #d92d20; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='#ffffff'">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
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
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

export function renderPdfPreview(url) {
  if (!url) {
    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 40px; text-align: center; color: #94a3b8; height: 100%; width: 100%;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
        <p style="margin: 0; font-weight: 500; font-size: 0.9rem;">Chưa có link PDF đề thi</p>
        <p style="margin: 0; font-size: 0.8rem; max-width: 250px; color: #64748b;">Hãy nhập link PDF Google Drive ở ô thông tin phía trên để hiển thị bản xem trước tại đây.</p>
      </div>
    `;
  }
  const preview = toDrivePreviewUrl(url);
  if (!preview) {
    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 40px; text-align: center; color: #94a3b8; height: 100%; width: 100%;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>
            </div>
            <h3 style="margin: 0; font-family: 'Beautique Display', serif; font-size: 17px; font-weight: 700; color: #101828;">Soạn thảo LaTeX (EX_TEST)</h3>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="file" id="latex-image-upload" accept="image/*" style="display: none;">
            <button type="button" id="latex-image-btn" style="display: inline-flex; align-items: center; gap: 5px; padding: 7px 14px; background: #ffffff; color: #455120; border: 1px solid #D8E2CA; border-radius: 9999px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: background 0.15s ease;" onmouseover="this.style.background='#F0F4E8'" onmouseout="this.style.background='#ffffff'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              <span>Chèn ảnh</span>
            </button>
            <span id="latex-upload-status" style="font-size: 12px; color: #455120; font-family: 'Be Vietnam Pro', sans-serif; display: none;">Đang tải ảnh...</span>
            <button type="button" id="latex-live-parse-btn" style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; background: #455120; color: #ffffff; border: 0; border-radius: 9999px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 12.5px; font-weight: 500; cursor: pointer; box-shadow: 0 2px 6px rgba(69, 81, 32, 0.15);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
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
      <div class="editor-heading" style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9;">
        <strong style="font-size: 15px; font-weight: 700; color: #455120;">Câu ${index + 1}</strong>
        <div style="display: flex; gap: 8px; align-items: center;">
          <select name="question-type-${index}" class="nh-form-input-clean" style="width: 120px; height: 36px; padding: 4px 8px;">
            ${['mcq', 'tf4', 'short'].map((type) => `<option value="${type}" ${question.type === type ? 'selected' : ''}>${type.toUpperCase()}</option>`).join('')}
          </select>
          <input type="number" class="nh-form-input-clean" name="question-sort-${index}" value="${Number(question.sort_order ?? index + 1)}" placeholder="Thứ tự" style="width: 70px; height: 36px; padding: 4px 8px;">
          <button type="button" data-remove-question="${index}" aria-label="Xóa câu" style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid #cbd5e1; background: #ffffff; color: #ef4444; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
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
          <button type="submit" class="nh-modal-btn-primary" style="height: 40px;">Tạo</button>
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
                  <td class="row-actions" style="display: flex; gap: 6px;">
                    <button type="button" data-save-student="${student.id}" title="Lưu" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #455120; background: #455120; color: #fff; cursor: pointer;">Lưu</button>
                    <button type="button" data-reset-student="${student.id}" title="Reset mật khẩu" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; color: #334155; cursor: pointer;">Đặt lại MK</button>
                    <button type="button" data-delete-student="${student.id}" title="Xóa" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #fecaca; background: #fef2f2; color: #ef4444; cursor: pointer;">Xóa</button>
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
        if (cellState === 'taught') return `background: #455120; color: #ffffff; border: 2px solid #455120; font-weight: 700; box-shadow: 0 2px 6px rgba(69, 81, 32, 0.2);`;
        if (cellState === 'scheduled') return `background: #F0F4E8; color: ${isWeekend ? '#e11d48' : '#455120'}; border: 2px solid #455120; font-weight: 700;`;
        return `background: #f8fafc; color: ${isWeekend ? '#e11d48' : '#64748b'}; border: 1px solid #f1f5f9; font-weight: 500;`;
      }

      return `
        <div class="panel" data-schedule="${s.id}" style="background: #ffffff; border: 1px solid #D8E2C4; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03); margin: 0;">
          <!-- Name row -->
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <h3 style="margin: 0; font-family: 'Beautique Display', serif; font-size: 16.5px; font-weight: 700; color: #455120;">${escapeHtml(s.profiles?.full_name ?? 'Học sinh')}</h3>
            <button type="button" data-delete-schedule="${s.id}" title="Xóa lịch tháng này"
              style="background: #fff; border: 1px solid #fca5a5; border-radius: 9999px; color: #ef4444; cursor: pointer; padding: 3px 10px; font-size: 11.5px; font-weight: 500; transition: all 0.15s ease;"
              onmouseover="this.style.background='#fef2f2';"
              onmouseout="this.style.background='#fff';">
              Xóa
            </button>
          </div>

          <!-- Stats row -->
          <div style="display: flex; align-items: center; background: #F0F4E8; border: 1px solid #D8E2CA; border-radius: 10px; overflow: hidden; font-family: 'Be Vietnam Pro', sans-serif;">
            <div style="flex: 1; padding: 8px 10px; border-right: 1px solid #D8E2CA; text-align: center;">
              <div style="color: #667085; font-size: 11px; font-weight: 600; margin-bottom: 1px;">Lịch</div>
              <strong style="font-size: 15px; color: #1e293b;">${scheduledCount + taughtCount}</strong>
            </div>
            <div style="flex: 1; padding: 8px 10px; border-right: 1px solid #D8E2CA; text-align: center;">
              <div style="color: #667085; font-size: 11px; font-weight: 600; margin-bottom: 1px;">Đã dạy</div>
              <strong style="font-size: 15px; color: #455120;" data-count="${s.id}">${taughtCount}</strong>
            </div>
            <div style="flex: 1; padding: 8px 10px; text-align: center;">
              <div style="color: #667085; font-size: 11px; font-weight: 600; margin-bottom: 1px;">Lương</div>
              <strong style="font-size: 15px; color: #455120;" data-total="${s.id}">${fmt.format(total)}đ</strong>
            </div>
          </div>

          <!-- Rate row -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <label style="font-size: 12.5px; font-weight: 600; color: #334155; font-family: 'Be Vietnam Pro', sans-serif;">Đơn giá / buổi</label>
            <div style="display: flex; align-items: center; gap: 6px;">
              <input type="number" class="field rate-input" data-rate-for="${s.id}" value="${rate}" min="0" step="10000"
                style="width: 105px; height: 34px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 8px; font-size: 13px; text-align: right; font-weight: 600; color: #1e293b; outline: none;">
              <span style="font-size: 13px; color: #64748b; font-weight: 500;">đ</span>
            </div>
          </div>

          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 0;">

          <!-- Legend -->
          <div style="display: flex; gap: 12px; font-size: 11.5px; color: #64748b; font-family: 'Be Vietnam Pro', sans-serif;">
            <span style="display: flex; align-items: center; gap: 5px;"><span style="width: 9px; height: 9px; border-radius: 2px; background: #f8fafc; border: 1px solid #e2e8f0; display: inline-block;"></span>Trống</span>
            <span style="display: flex; align-items: center; gap: 5px;"><span style="width: 9px; height: 9px; border-radius: 2px; background: #F0F4E8; border: 1.5px solid #455120; display: inline-block;"></span>Có lịch</span>
            <span style="display: flex; align-items: center; gap: 5px;"><span style="width: 9px; height: 9px; border-radius: 2px; background: #455120; display: inline-block;"></span>Đã dạy</span>
          </div>

          <!-- Calendar Grid -->
          <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center;">
            ${DAY_SHORT.map((d, i) => `<div style="font-family: 'Beautique Display', serif; font-size: 11px; font-weight: 700; color: ${i >= 5 ? '#e11d48' : '#455120'}; padding: 2px 0;">${d}</div>`).join('')}
            ${Array(firstDow).fill('<div></div>').join('')}
            ${days.map((d) => {
              const iso = d.toISOString().slice(0, 10);
              const cellState = sessionMap[iso] ?? 'none';
              const dow = d.getDay();
              const isWeekend = dow === 0 || dow === 6;
              return `<button type="button" class="day-cell" data-toggle="${s.id}" data-date="${iso}" data-state="${cellState}"
                style="padding: 0; border-radius: 6px; cursor: pointer; font-size: 12px; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; ${cellStyle(cellState, isWeekend)} transition: all 0.15s ease;"
              >${d.getDate()}</button>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    root.innerHTML = `
      <style>
        .day-cell:hover { transform: translateY(-1px); }
        .day-cell:active { transform: scale(0.95); }
        .salary-nav-btn { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 50%; width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: 15px; color: #455120; transition: all 0.15s ease; }
        .salary-nav-btn:hover { background: #F0F4E8; border-color: #455120; }
      </style>

      <div style="background-color: #EDF2E4; min-height: calc(100vh - 64px); padding: 0 0 60px 0; margin: 0; font-family: 'Be Vietnam Pro', sans-serif;">
        <!-- Top Breadcrumb Bar -->
        <div class="nh-admin-breadcrumb-bar" style="margin-bottom: 20px;">
          <div class="nh-admin-breadcrumb-inner" style="max-width: 960px;">
            <a href="#/manage">Trung tâm Quản trị</a>
            <span class="sep">&rsaquo;</span>
            <span class="active">Quản lý Lương & Lịch dạy</span>
          </div>
        </div>

        <section style="max-width: 960px; margin: 0 auto; padding: 0 max(var(--page-gutter), 20px); display: flex; flex-direction: column; gap: 20px;">

          <!-- Hero Header Card -->
          <div style="background: #ffffff; border-radius: 16px; border: 1px solid #D8E2C4; padding: 20px 24px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="font-size: 11px; font-weight: 700; color: #455120; letter-spacing: 0.08em; margin-bottom: 4px;">QUẢN LÝ TÀI CHÍNH</div>
              <h1 style="font-family: 'Beautique Display', serif; font-size: 22px; font-weight: 700; color: #1e293b; margin: 0 0 2px 0;">Quản lý Lương & Lịch dạy</h1>
              <p style="font-size: 13px; color: #64748b; margin: 0;">Theo dõi lịch dạy, chấm công và tổng chi phí lương trợ giảng theo từng tháng.</p>
            </div>

            <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
              <!-- Month Navigator -->
              <div style="display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 5px 10px; border-radius: 9999px;">
                <button id="prev-month" class="salary-nav-btn" title="Tháng trước">‹</button>
                <span style="font-family: 'Beautique Display', serif; font-size: 15px; font-weight: 700; color: #455120; min-width: 70px; text-align: center;">Tháng ${monthLabel}</span>
                <button id="next-month" class="salary-nav-btn" title="Tháng sau">›</button>
              </div>

              <!-- Total Salary Badge -->
              <div style="background: #455120; color: #ffffff; border-radius: 9999px; padding: 8px 18px; font-weight: 600; font-size: 13.5px; box-shadow: 0 4px 12px rgba(69, 81, 32, 0.2); display: flex; align-items: center; gap: 6px;">
                Tổng: <span style="font-size: 17px; font-weight: 800; font-family: 'Be Vietnam Pro', sans-serif;">${fmt.format(totalSalary)}đ</span>
              </div>
            </div>
          </div>

          <!-- Tracker grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; align-items: flex-start;" id="tracker-list">
            ${schedules.length
              ? schedules.map(renderStudentTracker).join('')
              : `<div style="background: #ffffff; border-radius: 18px; border: 1px solid #D8E2C4; color: #64748b; text-align: center; padding: 48px 24px; font-size: 14px; grid-column: 1/-1; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
                  Chưa có lịch dạy trợ giảng nào trong tháng ${monthLabel}.<br>Hãy chọn thêm học sinh phía dưới để bắt đầu chấm công.
                </div>`
            }
          </div>

          <!-- Add student -->
          ${(unscheduled.length > 0 && schedules.length < 2) ? `
            <div style="background: #ffffff; border-radius: 18px; border: 1.5px dashed #D8E2C4; padding: 20px 24px; display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
              <div style="flex: 1; min-width: 200px;">
                <label class="field-label" style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px;">Thêm lịch trợ giảng tháng ${monthLabel}</label>
                <select id="add-student-sel" class="field" style="width: 100%; height: 40px; border-radius: 10px; border: 1px solid #cbd5e1; padding: 0 12px; font-size: 14px; font-family: 'Be Vietnam Pro', sans-serif;">
                  <option value="">-- Chọn học sinh / trợ giảng --</option>
                  ${unscheduled.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.full_name)}</option>`).join('')}
                </select>
              </div>
              <button id="add-student-btn" type="button" style="height: 40px; padding: 0 22px; background: #455120; color: #ffffff; border: 0; border-radius: 10px; font-size: 13.5px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.15s ease;" onmouseover="this.style.background='#38421a'" onmouseout="this.style.background='#455120'">
                + Thêm lịch
              </button>
            </div>
          ` : ''}

        </section>
      </div>
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
