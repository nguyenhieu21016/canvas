import { state, pageRoot } from '../../store.js';
import { wireRouteRetry } from '../../router.js';
import { toast, renderLoading, renderErrorState } from '../../lib/ui.js';
import { escapeHtml, option, setButtonLoading } from '../../lib/html.js';
import {
  fetchLearningPath,
  upsertPhase,
  deletePhase,
  upsertModule,
  deleteModule,
  upsertLectureGroup,
  deleteLectureGroup,
  upsertLecture,
  deleteLecture,
  reorderContentNodes as reorderContentNodesApi,
  fetchStudents,
} from '../../services/lmsApi.js';

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
