// admin.js - Lazy loaded module for admin routes
import { supabase } from './services/supabaseClient.js';
import { formatDateTime, formatScore, roleLabel } from "./lib/format.js";
import { setButtonLoading, option } from "./lib/html.js";
import { toDrivePreviewUrl } from './lib/drive.js';
import { 
  fetchSolutionRequestsForManager, fetchLearningPath, fetchAssignmentsForManager,
  fetchStudents, fetchGradebook, upsertPhase, deletePhase, upsertModule, deleteModule,
  upsertLecture, deleteLecture, upsertLectureGroup, deleteLectureGroup,
  deleteAssignment,
  invokeAdminFunction, createManagedUser, fetchAssignmentEditor, regradeAssignment, 
  deleteManagedUser, saveAssignmentWithQuestions
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
    { href: '#/progress', icon: 'track_changes', title: 'Tiến độ học', description: 'Theo dõi bài giảng trực tiếp đã dạy cho từng học sinh.' },
    { href: '#/content', icon: 'view_list', title: 'Nội dung', description: 'Tạo giai đoạn, chuyên đề, nhóm bài giảng và link bài giảng.' },
    { href: '#/assignments', icon: 'assignment', title: 'Đề thi / Bài tập về nhà', description: 'Tạo đề, phiếu trả lời, đáp án và chấm lại bài đã nộp.' },
    { href: '#/solution-requests', icon: 'rate_review', title: 'Yêu cầu lời giải', description: 'Xem yêu cầu chưa xử lí và các yêu cầu đã gửi lời giải.' },
  ];
  root.innerHTML = `
    <section class="manage-hub">
      ${items
        .map(
          (item) => `
            <a class="phase-card manage-hub-card" href="${item.href}">
              <div>
                <p class="eyebrow">Quản trị</p>
                <h2><md-icon>${item.icon}</md-icon>${escapeHtml(item.title)}</h2>
                <p class="muted">${escapeHtml(item.description)}</p>
              </div>
              <span class="phase-card-action">Mở<md-icon>arrow_forward</md-icon></span>
            </a>
          `,
        )
        .join('')}
    </section>
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
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; background: var(--md-sys-color-surface-container-low); padding: 16px; border-radius: 12px; border: 1px solid var(--md-sys-color-outline-variant); margin-bottom: 24px;">
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <md-outlined-text-field label="Tên đề thi / Bài tập về nhà" name="title" value="${escapeHtml(assignment.title)}" required style="--md-outlined-text-field-container-shape: 8px; width: 100%;"></md-outlined-text-field>
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <span style="font-size: 0.8rem; font-weight: 500; color: var(--md-sys-color-on-surface-variant); padding-left: 4px;">Chuyên đề liên kết</span>
        <select class="field" name="lecture_id" style="height: 56px; border-radius: 8px; border: 1px solid var(--md-sys-color-outline); padding: 0 12px;">
          <option value="">Bài tập tự do</option>
          ${lectures.map((lecture) => option(lecture.id, lecture.title, assignment.lecture_id)).join('')}
        </select>
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

