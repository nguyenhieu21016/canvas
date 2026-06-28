// admin.js - Lazy loaded module for admin routes
import { supabase } from './services/supabaseClient.js';
import { formatDateTime, formatScore, roleLabel } from "./lib/format.js";
import { setButtonLoading, option } from "./lib/html.js";
import { toDrivePreviewUrl } from './lib/drive.js';
import { 
  fetchSolutionRequestsForManager, fetchLearningPath, fetchAssignmentsForManager,
  fetchStudents, fetchGradebook, upsertPhase, deletePhase, upsertModule, deleteModule,
  upsertLecture, deleteLecture, upsertLectureGroup, deleteLectureGroup,
  deleteAssignment, reorderContentNodes as reorderContentNodesApi,
  invokeAdminFunction, createManagedUser, fetchAssignmentEditor, regradeAssignment, 
  deleteManagedUser, saveAssignmentWithQuestions,
  fetchSalaryMonth, upsertSalarySchedule, deleteSalarySchedule, setSessionState
} from "./services/lmsApi.js";
import { 
  state, pageRoot, renderLoading, renderErrorState, wireRouteRetry, 
  escapeHtml, wireTableSearch, toast, isManager, renderAttemptsTable,
  renderManagerSolutionRequest, renderMetric, wireSolutionRequestManager,
  wireMaterialFormButtons, isAdmin, renderSkeletonAssignments
} from "./main.js";
import { mountStudentGrades } from "./student.js";

export function mountManageHub() {
  const root = pageRoot();
  const items = [
    {
      href: '#/progress',
      icon: 'track_changes',
      title: 'Tiến độ học',
      description: 'Theo dõi bài giảng trực tiếp đã dạy cho từng học sinh.',
    },
    {
      href: '#/content',
      icon: 'view_list',
      title: 'Nội dung',
      description: 'Tạo giai đoạn, chuyên đề, nhóm bài giảng và link bài giảng.',
    },
    {
      href: '#/assignments',
      icon: 'assignment',
      title: 'Đề thi & Bài tập',
      description: 'Tạo đề, phiếu trả lời, đáp án và chấm lại bài đã nộp.',
    },
    {
      href: '#/solution-requests',
      icon: 'rate_review',
      title: 'Yêu cầu lời giải',
      description: 'Xem yêu cầu chưa xử lí và các yêu cầu đã gửi lời giải.',
    },
    {
      href: '#/salary',
      icon: 'payments',
      title: 'Lịch dạy & Lương',
      description: 'Tick lịch dạy từng học sinh theo tháng và xem tổng lương.',
    },
  ];
  root.innerHTML = `
    <div style="max-width: 1000px; margin: 0 auto; padding: var(--page-gutter, 32px 24px);">
      <h1 style="margin:0 0 24px; font-size:1.8rem; font-weight:800; color:var(--md-sys-color-on-surface);">Trang Quản Trị</h1>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
        ${items.map((item) => `
          <a class="phase-card" href="${item.href}" style="display: flex; flex-direction: column; justify-content: space-between; padding: 24px;">
            <div>
              <p class="eyebrow">Quản trị</p>
              <h2 style="display: flex; align-items: center; gap: 10px; margin: 8px 0; font-size: 1.25rem;">
                <md-icon style="color: var(--md-sys-color-primary);">${item.icon}</md-icon>
                ${escapeHtml(item.title)}
              </h2>
              <p class="muted" style="margin: 10px 0 0; font-size: 0.95rem; line-height: 1.5;">${escapeHtml(item.description)}</p>
            </div>
            <span class="phase-card-action" style="margin-top: 24px; font-weight: 600;">Mở <md-icon>arrow_forward</md-icon></span>
          </a>
        `).join('')}
      </div>
    </div>
  `;
}





export async function mountSolutionRequestsManager() {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang tải yêu cầu lời giải');
  try {
    const requests = await fetchSolutionRequestsForManager();
    const pendingRequests = requests.filter((request) => request.status !== 'fulfilled' || !request.solution_pdf_url);
    const fulfilledRequests = requests.filter((request) => request.status === 'fulfilled' && request.solution_pdf_url);
    root.innerHTML = `
      <section class="solution-requests-page">
        <section class="metric-grid">
          ${renderMetric('Chưa xử lí', pendingRequests.length, 'pending_actions')}
          ${renderMetric('Đã xử lí', fulfilledRequests.length, 'task_alt')}
          ${renderMetric('Tổng yêu cầu', requests.length, 'rate_review')}
        </section>
        <section class="solution-requests-board">
          <div class="panel solution-requests-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Cần phản hồi</p>
                <h2>${pendingRequests.length} yêu cầu chưa xử lí</h2>
              </div>
            </div>
            ${
              pendingRequests.length
                ? `<div class="solution-request-list">${pendingRequests.map(renderManagerSolutionRequest).join('')}</div>`
                : '<div class="empty-state compact">Không còn yêu cầu nào đang chờ.</div>'
            }
          </div>
          <div class="panel solution-requests-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Đã phản hồi</p>
                <h2>${fulfilledRequests.length} yêu cầu đã xử lí</h2>
              </div>
            </div>
            ${
              fulfilledRequests.length
                ? `<div class="solution-request-list">${fulfilledRequests.map(renderManagerSolutionRequest).join('')}</div>`
                : '<div class="empty-state compact">Chưa có yêu cầu nào được xử lí.</div>'
            }
          </div>
        </section>
      </section>
    `;
    wireSolutionRequestManager({
      onSaved: () => mountSolutionRequestsManager(),
    });
    wireMaterialFormButtons(root);
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

export async function mountContentManager() {
  const root = pageRoot();
  root.innerHTML = renderLoading();
  try {
    const data = await fetchLearningPath(state.profile.role);
    root.innerHTML = `
      <section class="panel content-create-panel">
        <div class="panel-heading">
          <h2>Tạo nội dung</h2>
        </div>
        <div class="content-create-grid four">
          ${renderPhaseForm()}
          ${renderModuleForm(data.phases)}
          ${renderLectureGroupForm(data.phases, data.modules)}
          ${renderLectureForm(data.phases, data.modules, data.lectureGroups)}
        </div>
      </section>
      <section class="panel">
        <div class="panel-heading">
          <h2>Cấu trúc hiện tại</h2>
        </div>
        <div id="manage-structure-container">
          ${data.phases.length ? data.phases.map(renderManagePhase).join('') : '<div class="empty-state">Chưa có nội dung.</div>'}
        </div>
      </section>
    `;
    wireContentForms(data);
    wireCascadingDropdowns(root);
    wireMaterialFormButtons(root);
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

export function renderPhaseForm() {
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
        <md-icon>folder_open</md-icon>
        <h3>Chuyên đề</h3>
      </div>
      <input type="hidden" name="id">
      <input type="hidden" name="description" value="">
      <input type="hidden" name="sort_order" value="0">
      <input type="hidden" name="published" value="true">
      <select class="field" name="phase_id" required>
        <option value="">Chọn giai đoạn</option>
        ${phases.map((phase) => option(phase.id, phase.title)).join('')}
      </select>
      <input class="field" name="title" placeholder="Tên chuyên đề" required>
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
        <md-icon>library_books</md-icon>
        <h3>Nhóm bài giảng</h3>
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
        <option value="">Chọn chuyên đề</option>
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
        <md-icon>menu_book</md-icon>
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
        <option value="">Chọn chuyên đề</option>
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
    <div class="manage-node" draggable="true" data-entity="phase" data-parent="root" data-id="${phase.id}" data-payload="${escapeHtml(JSON.stringify(phase))}">
      <div>
        <md-icon class="drag-handle" aria-hidden="true">drag_indicator</md-icon>
        <strong>${escapeHtml(phase.title)}</strong>
        <span>${phase.modules.length} chuyên đề</span>
      </div>
      <div class="icon-actions">
        <button data-edit-phase="${phase.id}" data-payload="${escapeHtml(JSON.stringify(phase))}" aria-label="Sửa giai đoạn"><md-icon>edit</md-icon></button>
        <button data-delete-phase="${phase.id}" aria-label="Xóa giai đoạn"><md-icon>delete</md-icon></button>
      </div>
    </div>
    ${phase.modules
      .map(
        (module) => `
          <div class="manage-node child" draggable="true" data-entity="module" data-parent="${phase.id}" data-id="${module.id}" data-payload="${escapeHtml(JSON.stringify(module))}">
            <div>
              <md-icon class="drag-handle" aria-hidden="true">drag_indicator</md-icon>
              <strong>${escapeHtml(module.title)}</strong>
              <span>${module.lecture_groups.length} nhóm · ${module.lectures.length} bài giảng</span>
            </div>
            <div class="icon-actions">
              <button data-edit-module="${module.id}" data-payload="${escapeHtml(JSON.stringify(module))}" aria-label="Sửa chuyên đề"><md-icon>edit</md-icon></button>
              <button data-delete-module="${module.id}" aria-label="Xóa chuyên đề"><md-icon>delete</md-icon></button>
            </div>
          </div>
          ${module.lecture_groups
            .map(
              (group) => `
                <div class="manage-node grandchild" draggable="true" data-entity="lectureGroup" data-parent="${module.id}" data-id="${group.id}" data-payload="${escapeHtml(JSON.stringify(group))}">
                  <div>
                    <md-icon class="drag-handle" aria-hidden="true">drag_indicator</md-icon>
                    <strong>${escapeHtml(group.title)}</strong>
                    <span>${group.lectures.length} bài giảng</span>
                  </div>
                  <div class="icon-actions">
                    <button data-edit-lecture-group="${group.id}" data-payload="${escapeHtml(JSON.stringify(group))}" aria-label="Sửa nhóm bài giảng"><md-icon>edit</md-icon></button>
                    <button data-delete-lecture-group="${group.id}" aria-label="Xóa nhóm bài giảng"><md-icon>delete</md-icon></button>
                  </div>
                </div>
                ${(group.lectures ?? []).map((lecture) => renderManageLecture(lecture, group.id, 'Trong nhóm')).join('')}
              `,
            )
            .join('')}
          ${module.lectures
            .filter((lecture) => !lecture.group_id)
            .map((lecture) => renderManageLecture(lecture, `module:${module.id}`, 'Chưa nhóm'))
            .join('')}
        `,
      )
      .join('')}
  `;
}

export function renderManageLecture(lecture, parent, statusText) {
  return `
    <div class="manage-node greatgrandchild" draggable="true" data-entity="lecture" data-parent="${escapeHtml(parent)}" data-id="${lecture.id}" data-payload="${escapeHtml(JSON.stringify(lecture))}">
      <div>
        <md-icon class="drag-handle" aria-hidden="true">drag_indicator</md-icon>
        <strong>${escapeHtml(lecture.title)}</strong>
        <span>${escapeHtml(statusText)}</span>
      </div>
      <div class="icon-actions">
        <button data-edit-lecture="${lecture.id}" data-payload="${escapeHtml(JSON.stringify(lecture))}" aria-label="Sửa bài giảng"><md-icon>edit</md-icon></button>
        <button data-delete-lecture="${lecture.id}" aria-label="Xóa bài giảng"><md-icon>delete</md-icon></button>
      </div>
    </div>
  `;
}

export function wireContentForms(pathData) {
  document.querySelectorAll('.entity-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (form.dataset.saving === 'true') return;
      const values = Object.fromEntries(new FormData(form).entries());
      const sortOrder = values.id
        ? Number(values.sort_order || 0)
        : nextContentSortOrder(form.dataset.entity, values, pathData);
        
      // Optimistically bump sort order in local pathData to ensure quick consecutive saves keep correct order
      if (!values.id) {
        if (form.dataset.entity === 'phase') pathData.phases.push({sort_order: sortOrder});
        if (form.dataset.entity === 'module') pathData.modules.push({phase_id: values.phase_id, sort_order: sortOrder});
        if (form.dataset.entity === 'lectureGroup') pathData.lectureGroups.push({module_id: values.module_id, sort_order: sortOrder});
        if (form.dataset.entity === 'lecture') pathData.lectures.push({module_id: values.module_id, group_id: values.group_id, sort_order: sortOrder});
      }

      const payload = {
        ...values,
        id: values.id || crypto.randomUUID(),
        sort_order: sortOrder,
        published: form.querySelector('[name="published"]')?.type === 'checkbox'
          ? form.querySelector('[name="published"]').checked
          : values.published !== 'false',
        owner_id: state.profile.id,
      };
      
      const restore = setButtonLoading(form.querySelector('md-filled-button'));
      form.dataset.saving = 'true';
      
      try {
        if (form.dataset.entity === 'phase') {
          await upsertPhase(payload);
        } else if (form.dataset.entity === 'module') {
          await upsertModule(payload);
        } else if (form.dataset.entity === 'lectureGroup') {
          delete payload.phase_id;
          await upsertLectureGroup(payload);
        } else if (form.dataset.entity === 'lecture') {
          delete payload.phase_id;
          await upsertLecture({ ...payload, group_id: payload.group_id || null });
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
        
        // Add new item to dropdowns so it can be selected immediately
        if (!isUpdate && values.title) {
          const fakeId = payload.id;
          if (form.dataset.entity === 'phase') {
            document.querySelectorAll('.cascade-phase').forEach(sel => {
              sel.insertAdjacentHTML('beforeend', `<option value="${fakeId}">${escapeHtml(values.title)}</option>`);
            });
          }
          if (form.dataset.entity === 'module') {
            document.querySelectorAll('.cascade-module').forEach(sel => {
              sel.insertAdjacentHTML('beforeend', `<option value="${fakeId}" data-phase-id="${escapeHtml(values.phase_id)}">${escapeHtml(values.title)}</option>`);
            });
          }
          if (form.dataset.entity === 'lectureGroup') {
            document.querySelectorAll('.cascade-group').forEach(sel => {
              sel.insertAdjacentHTML('beforeend', `<option value="${fakeId}" data-module-id="${escapeHtml(values.module_id)}">${escapeHtml(values.title)}</option>`);
            });
          }
        }
        
        const newData = await fetchLearningPath(state.profile.role);
        const container = document.querySelector('#manage-structure-container');
        if (container) {
          container.innerHTML = newData.phases.length ? newData.phases.map(renderManagePhase).join('') : '<div class="empty-state">Chưa có nội dung.</div>';
          wireStructureEvents();
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
  // Bind Edit Buttons
  document.querySelectorAll('button[data-payload]').forEach((button) => {
    button.addEventListener('click', () => {
      const payload = JSON.parse(button.dataset.payload);
      const kind = button.dataset.editPhase
        ? 'phase'
        : button.dataset.editModule
          ? 'module'
          : button.dataset.editLectureGroup
            ? 'lectureGroup'
            : 'lecture';
      const form = document.querySelector(`[data-entity="${kind}"]`);
      if (!form) return;
      Object.entries(payload).forEach(([key, value]) => {
        const input = form.querySelector(`[name="${key}"]`);
        if (!input) return;
        if (input.type === 'checkbox') input.checked = Boolean(value);
        else input.value = value ?? '';
      });
      
      // Force trigger cascading dropdowns manually if needed
      const phaseSelect = form.querySelector('.cascade-phase');
      const moduleSelect = form.querySelector('.cascade-module');
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

  // Bind Drag & Drop
  wireContentDragSort();

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
          container.innerHTML = newData.phases.length ? newData.phases.map(renderManagePhase).join('') : '<div class="empty-state">Chưa có nội dung.</div>';
          wireStructureEvents();
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

export function wireContentDragSort() {
  let dragged = null;

  document.querySelectorAll('.manage-node[draggable="true"]').forEach((node) => {
    node.addEventListener('dragstart', (event) => {
      dragged = node;
      node.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', node.dataset.id);
    });

    node.addEventListener('dragend', () => {
      node.classList.remove('dragging');
      document.querySelectorAll('.manage-node.drop-target').forEach((item) => item.classList.remove('drop-target'));
      dragged = null;
    });

    node.addEventListener('dragover', (event) => {
      if (!dragged || dragged === node) return;
      if (dragged.dataset.entity !== node.dataset.entity || dragged.dataset.parent !== node.dataset.parent) return;
      event.preventDefault();
      node.classList.add('drop-target');
      event.dataTransfer.dropEffect = 'move';
    });

    node.addEventListener('dragleave', () => {
      node.classList.remove('drop-target');
    });

    node.addEventListener('drop', async (event) => {
      event.preventDefault();
      node.classList.remove('drop-target');
      if (!dragged || dragged === node) return;
      if (dragged.dataset.entity !== node.dataset.entity || dragged.dataset.parent !== node.dataset.parent) {
        toast('Chỉ kéo thả trong cùng một cấp.', 'error');
        return;
      }

      try {
        await reorderContentNodes(dragged, node);
        toast('Đã cập nhật thứ tự.', 'success');
        const newData = await fetchLearningPath(state.profile.role);
        const container = document.querySelector('#manage-structure-container');
        if (container) {
          container.innerHTML = newData.phases.length ? newData.phases.map(renderManagePhase).join('') : '<div class="empty-state">Chưa có nội dung.</div>';
          wireStructureEvents();
        }
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
}

export async function reorderContentNodes(sourceNode, targetNode) {
  const kind = sourceNode.dataset.entity;
  const parent = sourceNode.dataset.parent;
  const nodes = Array.from(document.querySelectorAll(`.manage-node[data-entity="${kind}"][data-parent="${parent}"]`));
  const from = nodes.indexOf(sourceNode);
  const to = nodes.indexOf(targetNode);
  if (from < 0 || to < 0 || from === to) return;

  const ordered = nodes.map((node) => node.dataset.id);
  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);
  await reorderContentNodesApi(kind, ordered);
}

export function emptyEditor() {
  return {
    assignment: {
      title: '',
      description: '',
      pdf_url: '',
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
    root.innerHTML = `
      <section class="assignment-manager">
        <aside class="panel list-panel">
          <div class="panel-heading">
            <h2>Đề thi / Bài tập về nhà</h2>
            <md-filled-tonal-button id="new-assignment"><md-icon slot="icon">add</md-icon>Mới</md-filled-tonal-button>
          </div>
          <div class="stack-list">
            ${assignments
              .map(
                (assignment) => `
                  <button class="list-row" data-load-assignment="${assignment.id}">
                    <span>${escapeHtml(assignment.title)}</span>
                    <small>${escapeHtml(assignment.lectures?.title ?? 'Bài tập tự do')}</small>
                  </button>
                `,
              )
              .join('')}
          </div>
        </aside>
        <form id="assignment-editor" class="panel editor-panel">
          ${renderAssignmentEditor(path.lectures)}
        </form>
      </section>
    `;
    wireAssignmentEditor(path.lectures);
    wireMaterialFormButtons(root);
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

export function normalizeEditorQuestion(raw) {
  const key = Array.isArray(raw.answer_keys)
    ? raw.answer_keys[0]
    : raw.answer_keys ?? raw.answer_key;
  return {
    id: raw.id,
    type: raw.type,
    prompt: raw.prompt,
    points: raw.points,
    sort_order: raw.sort_order,
    choices: raw.choices ?? [],
    settings: raw.settings ?? {},
    answer_key: key ?? {},
  };
}

export function normalizeAssignmentEditor(editor) {
  return {
    assignment: editor.assignment,
    questions: editor.questions.map(normalizeEditorQuestion),
  };
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
  return `
    <div class="assignment-editor-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--md-sys-color-outline-variant); padding-bottom: 16px; margin-bottom: 16px;">
      <div>
        <p class="eyebrow">Đề thi / Bài tập về nhà</p>
        <h2 style="margin: 0; font-size: 1.35rem; font-weight: 600; color: var(--md-sys-color-on-surface);">${assignment.id ? 'Chỉnh sửa đề' : 'Tạo đề mới'}</h2>
      </div>
      <div class="button-row" style="display: flex; gap: 12px;">
        ${assignment.id ? '<md-outlined-button id="delete-assignment" type="button" style="--md-outlined-button-outline-color: var(--md-sys-color-error); --md-outlined-button-label-text-color: var(--md-sys-color-error);"><md-icon slot="icon">delete</md-icon>Xóa</md-outlined-button>' : ''}
        <md-filled-button type="submit"><md-icon slot="icon">save</md-icon>Lưu đề</md-filled-button>
      </div>
    </div>
    
    <input type="hidden" name="id" value="${escapeHtml(assignment.id ?? '')}">
    <input type="hidden" name="description" value="${escapeHtml(assignment.description ?? '')}">
    <input type="hidden" name="sort_order" value="${Number(assignment.sort_order ?? 0)}">
    <input type="hidden" name="published" value="true">

    <!-- Top info fields in a clean flex row -->
    <style>
      .combo-option:hover {
        background: var(--md-sys-color-surface-variant);
      }
      .combo-option {
        font-size: 0.9rem;
        color: var(--md-sys-color-on-surface);
        transition: background 0.2s;
      }
    </style>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; background: var(--md-sys-color-surface-container-low); padding: 16px; border-radius: 12px; border: 1px solid var(--md-sys-color-outline-variant); margin-bottom: 24px;">
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <md-outlined-text-field label="Tên đề thi / Bài tập về nhà" name="title" value="${escapeHtml(assignment.title)}" required style="--md-outlined-text-field-container-shape: 8px; width: 100%;"></md-outlined-text-field>
      </div>
      
      <div class="custom-combobox" style="display: flex; flex-direction: column; gap: 4px; position: relative;">
        <input type="hidden" name="lecture_id" value="${escapeHtml(assignment.lecture_id ?? '')}">
        <md-outlined-text-field 
          id="lecture-search-input"
          label="Chuyên đề liên kết (Gõ để tìm)" 
          value="${escapeHtml(assignment.lecture_id && lectures.find(l => l.id === assignment.lecture_id) ? lectures.find(l => l.id === assignment.lecture_id).title : (assignment.lecture_id ? '' : 'Bài tập tự do'))}"
          style="--md-outlined-text-field-container-shape: 8px; width: 100%; cursor: pointer;"
          autocomplete="off">
          <md-icon slot="trailing-icon">arrow_drop_down</md-icon>
        </md-outlined-text-field>
        <div class="combobox-dropdown" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; max-height: 350px; overflow-y: auto; background: var(--md-sys-color-surface-container-high); border-radius: 8px; z-index: 100; box-shadow: 0 8px 24px rgba(0,0,0,0.15); border: 1px solid var(--md-sys-color-outline-variant);">
          <div class="combo-option" data-value="" style="padding: 14px 16px; cursor: pointer; border-bottom: 1px solid var(--md-sys-color-outline-variant);">Bài tập tự do</div>
          ${lectures.map((lecture) => `<div class="combo-option" data-value="${escapeHtml(lecture.id)}" data-label="${escapeHtml(lecture.title).toLowerCase()}" style="padding: 14px 16px; cursor: pointer; border-bottom: 1px solid var(--md-sys-color-outline-variant);">${escapeHtml(lecture.title)}</div>`).join('')}
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 4px; grid-column: 1 / -1;">
        <md-outlined-text-field label="Link tài liệu PDF (Google Drive)" id="assignment-pdf-input" name="pdf_url" value="${escapeHtml(assignment.pdf_url)}" required style="--md-outlined-text-field-container-shape: 8px; width: 100%;"></md-outlined-text-field>
      </div>
    </div>

    <!-- Main Workspace Split View -->
    <style>
      .pdf-viewer-pane {
        position: sticky;
        top: 16px;
        height: calc(100vh - 250px);
        flex: 1.2;
        min-width: 400px;
      }
      .answer-key-pane {
        flex: 0.8;
        min-width: 320px;
      }
      @media (max-width: 900px) {
        .pdf-viewer-pane {
          position: static !important;
          height: 450px !important;
          min-width: 100% !important;
          flex: none !important;
        }
        .answer-key-pane {
          min-width: 100% !important;
          flex: none !important;
        }
      }
    </style>
    <div class="assignment-workspace-split" style="display: flex; flex-wrap: wrap; gap: 24px; min-height: 600px; align-items: stretch;">
      
      <!-- Left pane: PDF Viewer -->
      <div class="pdf-viewer-pane panel" style="border-radius: var(--md-sys-shape-corner-medium, 12px); display: flex; flex-direction: column; gap: 12px; background: var(--md-sys-color-surface-container-lowest); border: 1px solid var(--md-sys-color-outline-variant); padding: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--md-sys-color-outline-variant); padding-bottom: 8px;">
          <h3 style="margin: 0; font-size: 0.95rem; font-weight: 600; display: flex; align-items: center; gap: 6px; color: var(--md-sys-color-on-surface);"><md-icon>picture_as_pdf</md-icon> Xem đề thi (PDF)</h3>
          ${assignment.pdf_url ? `<a href="${escapeHtml(assignment.pdf_url)}" target="_blank" class="text-link" style="font-size: 0.85rem; display: flex; align-items: center; gap: 4px;"><md-icon style="font-size: 1rem;">open_in_new</md-icon> Mở link gốc</a>` : ''}
        </div>
        <div class="pdf-preview-container" style="flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: var(--md-sys-shape-corner-small, 8px); height: 100%;">
          ${renderPdfPreview(assignment.pdf_url)}
        </div>
      </div>

      <!-- Right pane: Answer Sheet Builder -->
      <div class="answer-key-pane" style="display: flex; flex-direction: column; gap: 16px;">
        <div class="question-builder-header panel" style="padding: 16px; border-radius: var(--md-sys-shape-corner-medium, 12px); background: var(--md-sys-color-surface-container-low); border: 1px solid var(--md-sys-color-outline-variant); display: flex; flex-direction: column; gap: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--md-sys-color-outline-variant); padding-bottom: 8px;">
            <h3 style="margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--md-sys-color-on-surface);">Phiếu trả lời (<span class="qb-count">${questions.length} câu hỏi</span>)</h3>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <!-- Single Add -->
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <span style="font-size: 0.8rem; font-weight: 500; color: var(--md-sys-color-on-surface-variant);">Thêm 1 câu</span>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <md-outlined-button type="button" style="height: 44px;" data-add-question="mcq"><md-icon slot="icon">radio_button_checked</md-icon>Trắc nghiệm</md-outlined-button>
                <md-outlined-button type="button" style="height: 44px;" data-add-question="tf4"><md-icon slot="icon">fact_check</md-icon>Đúng/Sai</md-outlined-button>
                <md-outlined-button type="button" style="height: 44px;" data-add-question="short"><md-icon slot="icon">short_text</md-icon>Điền ngắn</md-outlined-button>
              </div>
            </div>
            
            <!-- Bulk Add -->
            <div style="display: flex; flex-direction: column; gap: 6px; border-top: 1px dashed var(--md-sys-color-outline-variant); padding-top: 12px;">
              <span style="font-size: 0.8rem; font-weight: 500; color: var(--md-sys-color-on-surface-variant);">Thêm hàng loạt</span>
              <div style="display: flex; gap: 8px; align-items: center;">
                <input class="field compact-number" name="bulk-question-count" type="number" min="1" max="100" value="20" aria-label="Số câu" style="width: 70px; height: 44px; text-align: center; border-radius: var(--md-sys-shape-corner-small, 8px); border: 1px solid var(--md-sys-color-outline);">
                <select class="field" name="bulk-question-type" aria-label="Loại câu" style="height: 44px; border-radius: var(--md-sys-shape-corner-small, 8px); border: 1px solid var(--md-sys-color-outline); padding: 0 8px; flex: 1;">
                  <option value="mcq">Trắc nghiệm (MCQ)</option>
                  <option value="tf4">Đúng/Sai (TF)</option>
                  <option value="short">Điền ngắn</option>
                </select>
                <md-filled-tonal-button type="button" id="bulk-add-btn" style="height: 44px;"><md-icon slot="icon">playlist_add</md-icon>Thêm</md-filled-tonal-button>
              </div>
            </div>
          </div>
        </div>

        <div class="question-builder" style="display: flex; flex-direction: column; gap: 12px; max-height: calc(100vh - 350px); overflow-y: auto; padding-right: 4px;">
          ${questions.length ? questions.map((question, index) => renderQuestionEditor(question, index)).join('') : '<div class="panel empty-state" style="padding: 40px; text-align: center; background: var(--md-sys-color-surface-container-low); border: 1px dashed var(--md-sys-color-outline-variant); border-radius: var(--md-sys-shape-corner-medium, 12px); color: var(--md-sys-color-outline);">Chưa có câu nào trong phiếu trả lời. Hãy thêm câu hỏi ở trên để bắt đầu nhập đáp án.</div>'}
        </div>
      </div>

  `;
}

export function renderQuestionEditor(question, index) {
  return `
    <article class="question-editor" data-index="${index}">
      <div class="editor-heading">
        <strong>Câu ${index + 1}</strong>
        <button type="button" data-remove-question="${index}" aria-label="Xóa câu"><md-icon>close</md-icon></button>
      </div>
      <input type="hidden" name="question-id-${index}" value="${escapeHtml(question.id ?? '')}">
      <div class="form-grid two">
        <select class="field" name="question-type-${index}">
          ${['mcq', 'tf4', 'short'].map((type) => option(type, type.toUpperCase(), question.type)).join('')}
        </select>
        <input class="field" name="question-sort-${index}" type="number" value="${Number(question.sort_order ?? index + 1)}" placeholder="Thứ tự">
      </div>
      ${renderQuestionKeyEditor(question, index)}
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
      : '<div class="empty-state compact">Chưa có câu nào trong phiếu trả lời.</div>';
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

  document.querySelector('#new-assignment')?.addEventListener('click', () => {
    state.assignmentEditor = emptyEditor();
    mountAssignmentManager();
  });

  document.querySelectorAll('[data-load-assignment]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const editor = await fetchAssignmentEditor(button.dataset.loadAssignment);
        state.assignmentEditor = normalizeAssignmentEditor(editor);
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

  document.querySelector('#delete-assignment')?.addEventListener('click', async () => {
    if (!window.confirm('Xóa đề này?')) return;
    try {
      await deleteAssignment(state.assignmentEditor.assignment.id);
      state.assignmentEditor = emptyEditor();
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
      const val = pdfInput.value.trim();
      if (!val) {
        pdfInput.error = true;
        pdfInput.errorText = 'Link PDF không được để trống';
        return false;
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
        previewContainer.innerHTML = renderPdfPreview(pdfInput.value);
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
        state.assignmentEditor = normalizeAssignmentEditor(savedEditor);
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
  const questions = Array.from(document.querySelectorAll('.question-editor')).map((card) => {
    const index = Number(card.dataset.index);
    const type = values[`question-type-${index}`];
    const base = {
      id: values[`question-id-${index}`] || undefined,
      type,
      prompt: `Câu ${index + 1}`,
      points: 1,
      sort_order: Number(values[`question-sort-${index}`] || index + 1),
      choices: [],
      settings: {},
      answer_key: {},
    };

    if (type === 'mcq') {
      base.choices = [];
      base.answer_key = { correct_answer: values[`mcq-answer-${index}`] || 'A' };
    }

    if (type === 'tf4') {
      base.settings = {
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

  return {
    assignment: {
      id: values.id || undefined,
      title: values.title,
      description: values.description,
      pdf_url: values.pdf_url,
      lecture_id: values.lecture_id,
      sort_order: Number(values.sort_order || 0),
      published: values.published !== 'false',
    },
    questions,
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
                    <button data-save-student="${student.id}" aria-label="Lưu"><md-icon>save</md-icon></button>
                    <button data-reset-student="${student.id}" aria-label="Reset mật khẩu"><md-icon>key</md-icon></button>
                    <button data-delete-student="${student.id}" aria-label="Xóa"><md-icon>delete</md-icon></button>
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
  if (!isManager()) return mountStudentGrades();

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
      // Build maps: date → 'scheduled' | 'taught'
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
        <div class="panel" data-schedule="${s.id}" style="
          border-radius: var(--md-sys-shape-corner-large, 16px);
          background: var(--md-sys-color-surface-container-low);
          border: 1px solid var(--md-sys-color-outline-variant);
          padding: 24px; display:flex; flex-direction:column; gap:16px;
          box-sizing: border-box; margin: 0;
        ">
          <!-- Top Row: Name & Delete -->
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:var(--md-sys-color-on-surface);">${escapeHtml(s.profiles?.full_name ?? 'Học sinh')}</h3>
            <button type="button" data-delete-schedule="${s.id}" style="
              background:none; border:none; border-radius:50%;
              color:var(--md-sys-color-on-surface-variant); cursor:pointer; padding:6px;
              display:flex; align-items:center; justify-content:center;
              transition: background 0.2s, color 0.2s;
            " onmouseover="this.style.background='var(--md-sys-color-error-container)'; this.style.color='var(--md-sys-color-error)';" onmouseout="this.style.background='none'; this.style.color='var(--md-sys-color-on-surface-variant)';">
              <md-icon style="font-size:1.2rem;">delete</md-icon>
            </button>
          </div>

          <!-- Stats Row -->
          <div style="display:flex; align-items:center; gap:16px; font-size:0.88rem; color:var(--md-sys-color-on-surface-variant); background:var(--md-sys-color-surface-container-lowest); padding:10px 14px; border-radius:8px;">
            <span>Lịch: <strong>${scheduledCount + taughtCount}</strong></span>
            <span style="width:1px; height:12px; background:var(--md-sys-color-outline-variant);"></span>
            <span>Đã dạy: <strong><span data-count="${s.id}">${taughtCount}</span></strong></span>
            <span style="width:1px; height:12px; background:var(--md-sys-color-outline-variant);"></span>
            <span>Lương: <strong style="color:var(--md-sys-color-primary);" data-total="${s.id}">${fmt.format(total)}đ</strong></span>
          </div>

          <!-- Rate Row -->
          <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.9rem;">
            <label style="color:var(--md-sys-color-on-surface-variant); font-weight:500;">Đơn giá / buổi</label>
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="number" class="field rate-input" data-rate-for="${s.id}" value="${rate}" min="0" step="10000"
                style="width:120px; height:36px; border-radius:8px; border:1px solid var(--md-sys-color-outline); padding:0 12px; font-size:0.95rem; text-align:right; font-weight:600; background:var(--md-sys-color-surface); color:var(--md-sys-color-on-surface);">
              <span style="color:var(--md-sys-color-on-surface-variant);">đ</span>
            </div>
          </div>

          <hr style="border:none; border-top:1px dashed var(--md-sys-color-outline-variant); margin:4px 0;">

          <!-- Legend -->
          <div style="display:flex; justify-content:space-between; gap:10px; font-size:0.75rem; color:var(--md-sys-color-on-surface-variant); padding:0 8px;">
            <span style="display:flex;align-items:center;gap:6px;"><span style="width:12px;height:12px;border-radius:3px;background:var(--md-sys-color-surface-container);border:1px solid var(--md-sys-color-outline-variant);display:inline-block;"></span> Trống</span>
            <span style="display:flex;align-items:center;gap:6px;"><span style="width:12px;height:12px;border-radius:3px;background:transparent;border:2px solid var(--md-sys-color-primary);display:inline-block;"></span> Có lịch</span>
            <span style="display:flex;align-items:center;gap:6px;"><span style="width:12px;height:12px;border-radius:3px;background:var(--md-sys-color-primary);display:inline-block;"></span> Đã dạy</span>
          </div>

          <!-- Calendar grid -->
          <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px; text-align:center; margin-top:auto;">
            ${DAY_SHORT.map((d, i) => `<div style="font-size:0.68rem; font-weight:700; color:${i===5||i===6 ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-on-surface-variant)'}; padding:3px 0;">${d}</div>`).join('')}
            ${Array(firstDow).fill('<div></div>').join('')}
            ${days.map((d) => {
              const iso = d.toISOString().slice(0, 10);
              const cellState = sessionMap[iso] ?? 'none';
              const dow = d.getDay();
              const isWeekend = dow === 0 || dow === 6;
              return `<button
                type="button"
                class="day-cell"
                data-toggle="${s.id}"
                data-date="${iso}"
                data-state="${cellState}"
                style="
                  padding:0; border-radius:6px; cursor:pointer; font-size:0.82rem; font-weight:600;
                  aspect-ratio:1; display:flex; align-items:center; justify-content:center;
                  ${cellStyle(cellState, isWeekend)}
                  transition: all 0.12s;
                "
              >${d.getDate()}</button>`;
            }).join('')}
          </div>
        </div>
      `;
    }


    root.innerHTML = `
      <style>
        .day-cell:hover { transform: scale(1.12); }
        .day-cell:active { transform: scale(0.95); }
      </style>
      <section style="max-width:860px; margin:0 auto; padding:var(--page-gutter,24px); display:flex; flex-direction:column; gap:20px;">

        <!-- Top bar -->
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <button id="prev-month" style="background:none; border:none; cursor:pointer; padding:6px; border-radius:50%; color:var(--md-sys-color-on-surface);">
              <md-icon>chevron_left</md-icon>
            </button>
            <h2 style="margin:0; font-size:1.15rem; font-weight:700; min-width:160px; text-align:center;">${monthLabel}</h2>
            <button id="next-month" style="background:none; border:none; cursor:pointer; padding:6px; border-radius:50%; color:var(--md-sys-color-on-surface);">
              <md-icon>chevron_right</md-icon>
            </button>
          </div>
          <div style="background:var(--md-sys-color-primary-container); color:var(--md-sys-color-on-primary-container); border-radius:12px; padding:8px 18px; font-weight:700;">
            Tổng: ${fmt.format(totalSalary)}đ
          </div>
        </div>

        <!-- Student trackers -->
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(360px, 1fr)); gap:16px; align-items:stretch;" id="tracker-list">
          ${schedules.length
            ? schedules.map(renderStudentTracker).join('')
            : `<div style="color:var(--md-sys-color-on-surface-variant); text-align:center; padding:32px 0; font-size:0.95rem;">
                Chưa có học sinh nào trong tháng này.<br>Thêm học sinh bên dưới để bắt đầu tick lịch.
              </div>`
          }
        </div>

        <!-- Add student -->
        ${(unscheduled.length > 0 && schedules.length < 2) ? `
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; padding-top:8px; border-top:1px solid var(--md-sys-color-outline-variant);">
            <select id="add-student-sel" class="field" style="flex:1; min-width:180px; height:40px; border-radius:8px; border:1px solid var(--md-sys-color-outline); padding:0 12px;">
              <option value="">-- Thêm học sinh vào tháng --</option>
              ${unscheduled.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.full_name)}</option>`).join('')}
            </select>
            <md-filled-button id="add-student-btn" type="button">
              <md-icon slot="icon">add</md-icon>Thêm
            </md-filled-button>
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

    // Wire rate input (update on blur/enter)
    document.querySelectorAll('.rate-input').forEach((input) => {
      const save = async () => {
        const scheduleId = input.dataset.rateFor;
        const rate = Number(input.value) || 0;
        try {
          const { supabase: sb } = await import('./services/supabaseClient.js');
          await sb.from('salary_schedules').update({ rate_per_session: rate }).eq('id', scheduleId);
          // Update summary inline without full rerender
          const fmtNew = new Intl.NumberFormat('vi-VN');
          const countEl = document.querySelector(`[data-count="${scheduleId}"]`);
          const totalEl = document.querySelector(`[data-total="${scheduleId}"]`);
          const rateDisp = document.querySelector(`.rate-display[data-for="${scheduleId}"]`);
          const count = Number(countEl?.textContent ?? 0);
          if (rateDisp) rateDisp.textContent = fmtNew.format(rate);
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
        // none → scheduled, scheduled → taught, taught → none
        const nextState = prevState === 'none' ? 'scheduled' : prevState === 'scheduled' ? 'taught' : 'none';
        const dow = new Date(sessionDate + 'T00:00:00').getDay();
        const isWeekend = dow === 0 || dow === 6;

        // Optimistic update
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

        // Update taught count + total (only changes when going to/from taught)
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



