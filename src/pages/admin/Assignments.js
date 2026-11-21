import { state, pageRoot } from '../../store.js';
import { wireRouteRetry } from '../../router.js';
import { toast, renderSkeletonAssignments, renderErrorState } from '../../lib/ui.js';
import { escapeHtml, renderLatexText, option, setButtonLoading } from '../../lib/html.js';
import { toDrivePreviewUrl } from '../../lib/drive.js';
import { normalizeAssignmentEditor, parseLatexAssignment } from '../../lib/assignment.js';
import {
  fetchLearningPath,
  fetchAssignmentsForManager,
  fetchAssignmentEditor,
  saveAssignmentWithQuestions,
  regradeAssignment,
  deleteAssignment,
  uploadAssignmentImage,
} from '../../services/lmsApi.js';

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
            <div style="background: #ffffff; border-radius: 14px; border: 1px solid #D8E2C4; padding: 16px 24px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; box-shadow: 0 2px 10px rgba(69, 81, 32, 0.03);">
              <div>
                <h1 style="font-family: 'Beautique Display', serif; font-size: 22px; font-weight: 700; color: #455120; margin: 0;">Đề thi & Bài tập về nhà</h1>
              </div>

              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex: 1; max-width: 600px; justify-content: flex-end;">
                <select id="assignment-type-filter" style="padding: 10px 14px; border-radius: 9999px; border: 1px solid #cbd5e1; font-family: 'Be Vietnam Pro', sans-serif; font-size: 13px; color: #344054; outline: none; background: #ffffff; cursor: pointer;">
                  <option value="all">Tất cả đề bài</option>
                  <option value="lecture">Theo bài giảng</option>
                  <option value="free">Bài tập tự do</option>
                </select>
                <div style="position: relative; flex: 1; min-width: 200px;">
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
          <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--md-sys-color-on-surface);">${assignment.id ? 'Chỉnh sửa đề thi' : 'Soạn thảo đề thi mới'}</h2>
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

        <div>
          <label class="field-label">Chủ đề / Phân loại (Tùy chọn tạo Pill lọc)</label>
          <input class="field" name="category_tag" list="category-suggestions" value="${escapeHtml(assignment.category || (assignment.description && assignment.description.startsWith('__CAT__:') ? assignment.description.replace('__CAT__:', '').trim() : ''))}" placeholder="Ví dụ: Đại số, Hình học, Xác suất, Luyện đề...">
          <datalist id="category-suggestions">
            <option value="Đại số & Giải tích"></option>
            <option value="Hình học"></option>
            <option value="Xác suất & Thống kê"></option>
            <option value="Đề luyện tập"></option>
            <option value="Vận dụng cao"></option>
          </datalist>
        </div>

        <div class="custom-combobox" style="position: relative; grid-column: 1 / -1;">
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
        flex: 1;
        min-width: 380px;
        height: calc(100vh - 140px);
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-right: 6px;
      }
      .right-pane {
        flex: 1.1;
        min-width: 420px;
        height: calc(100vh - 140px);
        display: flex;
        flex-direction: column;
        background: #ffffff;
        border: 1px solid #D8E2C4;
        border-radius: 16px;
        padding: 20px;
        box-sizing: border-box;
      }
      .cm-wrapper-box {
        flex: 1;
        min-height: 0;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .CodeMirror {
        height: 100% !important;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        font-size: 13.5px;
        line-height: 1.6;
        border-radius: 12px;
        border: 1px solid #cbd5e1;
      }
      .CodeMirror-scroll {
        height: 100% !important;
        overflow-y: auto !important;
        overflow-x: auto !important;
      }
      @media (max-width: 900px) {
        .left-pane, .right-pane {
          height: auto !important;
          min-width: 100% !important;
          flex: none !important;
        }
      }
      .cm-question-line-highlight {
        background: rgba(69, 81, 32, 0.08) !important;
        border-left: 3px solid #455120 !important;
      }
      .cm-question-marker-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #455120;
        color: #ffffff;
        font-family: 'Be Vietnam Pro', sans-serif;
        font-weight: 700;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 6px;
        margin-bottom: 6px;
        user-select: none;
        box-shadow: 0 1px 4px rgba(69, 81, 32, 0.25);
      }
      .latex-review-q-block {
        transition: all 0.2s ease;
        border-radius: 8px;
        padding: 12px;
        margin: -12px;
      }
      .latex-review-q-block:hover {
        background: #fafcf7;
      }
      .latex-review-q-block.active-q {
        background: #f2f7ec;
        border: 1px solid #d8e2ca;
      }
    </style>
    <div class="assignment-workspace-split" style="display: flex; flex-wrap: wrap; gap: 20px; min-height: 600px; align-items: stretch;">
      
      <!-- Left pane: Rendered Question Cards -->
      <div class="left-pane" style="padding-right: 4px;">
        <div class="latex-review-list" style="display: flex; flex-direction: column; gap: 24px; background: #ffffff; padding: 28px 32px; border-radius: 16px; border: 1px solid #D8E2C4; box-shadow: 0 2px 10px rgba(69, 81, 32, 0.03);">


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
        
        <div class="cm-wrapper-box" style="flex: 1; min-height: 0; display: flex; flex-direction: column; height: 100%;">
          <textarea id="latex-live-input" style="flex: 1; min-height: 520px; width: 100%; box-sizing: border-box; padding: 18px; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 13.5px; line-height: 1.6; border: 1px solid #cbd5e1; border-radius: 12px; resize: vertical; background: #f8fafc; color: #0f172a; outline: none; transition: border-color 0.15s ease;" onfocus="this.style.borderColor='#455120'; this.style.background='#ffffff';" onblur="this.style.borderColor='#cbd5e1'; this.style.background='#f8fafc';" placeholder="Dán mã LaTeX chuẩn EX_TEST vào đây...&#10;Hỗ trợ: \choice (Trắc nghiệm), \choiceTF (Đúng/Sai), \shortans (Trả lời ngắn).&#10;Ví dụ Trắc nghiệm:&#10;\begin{ex}&#10;Nội dung câu hỏi...&#10;\choice&#10;{A}&#10;{\True B}&#10;{C}&#10;{D}&#10;\end{ex}&#10;&#10;Ví dụ Đúng/Sai:&#10;\begin{ex}&#10;Câu hỏi...&#10;\choiceTF&#10;{\True Ý 1}&#10;{\False Ý 2}&#10;{\True Ý 3}&#10;{\False Ý 4}&#10;\end{ex}">${escapeHtml(state.assignmentEditor.latexSource || '')}</textarea>
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
    const allQuestions = state.assignmentEditor.questions;
    const prevQ = index > 0 ? allQuestions[index - 1] : null;
    const isNewSection = !prevQ || prevQ.type !== question.type;

    let typeCount = 1;
    for (let i = index - 1; i >= 0; i--) {
      if (allQuestions[i].type === question.type) typeCount++;
      else break;
    }
    const displayIndex = typeCount - 1;

    let sectionHeaderHTML = '';
    if (isNewSection) {
      let sectionNum = 1;
      for (let i = 1; i <= index; i++) {
        if (allQuestions[i].type !== allQuestions[i - 1].type) sectionNum++;
      }
      const romanNumeral = ['I', 'II', 'III', 'IV', 'V'][sectionNum - 1] || sectionNum;
      let typeLabel = 'Trắc nghiệm';
      if (question.type === 'tf4') typeLabel = 'Trắc nghiệm đúng sai';
      if (question.type === 'short') typeLabel = 'Trắc nghiệm trả lời ngắn';
      
      sectionHeaderHTML = `
        <div style="display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 4px 16px 4px 4px; background: #f0f4e8; border: 1px solid #d8e2ca; border-radius: 9999px; color: #455120; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 700; font-size: 14.5px; box-sizing: border-box; width: 100%; margin-bottom: 8px; ${index > 0 ? 'margin-top: 16px;' : ''}">
          <span style="width: 26px; height: 26px; border-radius: 50%; background: #455120; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif;">${romanNumeral}</span>
          <span>${typeLabel}</span>
        </div>
      `;
    }

    let correctAnswer = question.answer_key?.correct_answer ?? '';
    if (question.type === 'short') {
      correctAnswer = (question.answer_key?.accepted_answers || []).join(', ');
    }
    const cleanPrompt = question.prompt ? question.prompt.replace(/^Câu\s*\d+[\.\:\s]*/i, '') : '';
    const qNumStr = String(displayIndex + 1).padStart(2, '0');

    return `
      ${sectionHeaderHTML}
      <article class="latex-review-q-block" data-question-index="${index}" data-source-index="${question.sourceIndex ?? ''}" title="Bấm để cuộn đến đoạn code tương ứng" style="display: flex; flex-direction: column; gap: 14px; padding-bottom: 24px; border-bottom: 1px solid #f1f5f9; cursor: pointer;">
        
        <!-- Question Title & Prompt -->
        <div style="font-size: 15px; color: #1e293b; line-height: 1.6;">
          <span style="font-weight: 900; color: #455120; font-size: 17px; font-family: 'Beautique Display', serif; letter-spacing: 0.5px; margin-right: 12px; display: inline-block;">CÂU ${qNumStr}</span>
          <span style="font-weight: 500; color: #1e293b; font-size: 15px; font-family: 'Be Vietnam Pro', sans-serif;">${renderLatexText(cleanPrompt)}</span>
        </div>
        
        ${question.type === 'mcq' && question.choices && question.choices.length > 0 ? `
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

        ${question.type === 'tf4' ? `
        <div class="choice-grid" style="display: flex; flex-direction: column; gap: 10px; padding-left: 2px; margin-top: 4px;">
          ${(question.settings?.statements || []).map((statement, cIdx) => {
            const letter = String.fromCharCode(97 + cIdx); // a, b, c, d
            const isTrue = question.answer_key?.correct_answer?.[cIdx];
            return `
              <div style="display: flex; gap: 10px; align-items: flex-start; padding: 2px 0;">
                <div style="font-weight: 800; color: #1e293b; min-width: 20px;">${letter})</div>
                <div style="font-size: 14.5px; line-height: 1.5; color: #1e293b; flex: 1;">
                  ${renderLatexText(statement)}
                </div>
                <div style="display: flex; gap: 6px; font-weight: bold; font-size: 13px;">
                  <span style="color: ${isTrue ? '#455120' : '#cbd5e1'};">Đ</span> /
                  <span style="color: ${!isTrue ? '#ef4444' : '#cbd5e1'};">S</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        ` : ''}

        ${question.type === 'mcq' && correctAnswer ? `
        <div style="margin-top: 14px;">
          <div style="font-size: 16px; font-weight: 900; color: #455120; font-family: 'Beautique Display', serif; margin-bottom: 6px;">Đáp án</div>
          <div style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 14.5px; font-weight: 700; color: #1e293b; line-height: 1.6;">
            ${correctAnswer}. ${question.choices && question.choices[String(correctAnswer).charCodeAt(0) - 65] ? renderLatexText(question.choices[String(correctAnswer).charCodeAt(0) - 65]) : ''}
          </div>
        </div>
        ` : ''}

        ${question.type === 'short' ? `
        <div style="margin-top: 14px;">
          <div style="font-size: 16px; font-weight: 900; color: #455120; font-family: 'Beautique Display', serif; margin-bottom: 6px;">Đáp án</div>
          <div style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 14.5px; font-weight: 700; color: #1e293b; line-height: 1.6; padding: 8px 12px; background: #f8fafc; border-radius: 6px; border: 1px dashed #cbd5e1;">
            ${correctAnswer || '(Chưa có đáp án)'}
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
  const assignmentTypeFilter = document.querySelector('#assignment-type-filter');

  const filterAssignmentList = () => {
    const term = (assignmentSearchInput?.value || '').toLowerCase();
    const typeFilter = assignmentTypeFilter?.value || 'all';

    document.querySelectorAll('.assignment-row').forEach(row => {
      const text = row.textContent.toLowerCase();
      const isFree = text.includes('bài tập tự do');
      const matchesSearch = text.includes(term);
      let matchesType = true;

      if (typeFilter === 'free') {
        matchesType = isFree;
      } else if (typeFilter === 'lecture') {
        matchesType = !isFree;
      }

      if (matchesSearch && matchesType) {
        row.style.display = 'flex';
      } else {
        row.style.display = 'none';
      }
    });
  };

  if (assignmentSearchInput) {
    assignmentSearchInput.addEventListener('input', filterAssignmentList);
  }
  if (assignmentTypeFilter) {
    assignmentTypeFilter.addEventListener('change', filterAssignmentList);
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

    const uploadInput = document.querySelector('#latex-image-upload');
    const uploadBtn = document.querySelector('#latex-image-btn');
    const uploadStatus = document.querySelector('#latex-upload-status');
    const latexInput = document.querySelector('#latex-live-input');

    const syncPreviewScroll = () => {
      if (!cm) return;
      const scrollInfo = cm.getScrollInfo();
      const topVisibleLine = cm.lineAtHeight(scrollInfo.top + 20, 'local');
      const doc = cm.getDoc();
      const parsedQuestions = state.assignmentEditor?.questions || [];

      let currentQIdx = 0;
      for (let i = 0; i < parsedQuestions.length; i++) {
        const q = parsedQuestions[i];
        if (q.startIndex !== undefined) {
          const qLine = doc.posFromIndex(q.startIndex).line;
          if (qLine <= topVisibleLine) {
            currentQIdx = i;
          } else {
            break;
          }
        }
      }

      const targetCard = document.querySelector(`.latex-review-q-block[data-question-index="${currentQIdx}"]`);
      const leftPane = document.querySelector('.left-pane');
      if (targetCard && leftPane) {
        const cardTop = targetCard.offsetTop - 24;
        leftPane.scrollTo({ top: Math.max(0, cardTop), behavior: 'smooth' });
      }
    };

    let cm = null;
    if (latexInput) {
      cm = window.CodeMirror?.fromTextArea(latexInput, {
        lineNumbers: true,
        mode: 'stex',
        lineWrapping: true,
        theme: 'default',
        extraKeys: {
          'Cmd-S': function () { updateLatexPreview(false); },
          'Ctrl-S': function () { updateLatexPreview(false); }
        }
      });
      let changeDebounce = null;
      cm?.on('change', () => {
        latexInput.value = cm.getValue();
        state.assignmentEditor.latexSource = cm.getValue();
        clearTimeout(changeDebounce);
        changeDebounce = setTimeout(() => {
          updateLatexPreview(true);
        }, 400);
      });

      let scrollTimeout = null;
      cm?.on('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(syncPreviewScroll, 40);
      });
      cm?.on('cursorActivity', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(syncPreviewScroll, 60);
      });
    }

    let cmLineWidgets = [];
    const refreshCodeMirrorQuestionMarkers = (parsedQuestions) => {
      if (!cm) return;
      // Clear previous widgets
      cmLineWidgets.forEach(w => w.clear());
      cmLineWidgets = [];

      const doc = cm.getDoc();
      const text = doc.getValue();

      parsedQuestions.forEach((q, idx) => {
        let typeCount = 1;
        for (let i = idx - 1; i >= 0; i--) {
          if (parsedQuestions[i].type === q.type) typeCount++;
          else break;
        }
        const displayIndex = typeCount - 1;
        const qNumStr = String(displayIndex + 1).padStart(2, '0');
        if (q.startIndex !== undefined) {
          const pos = doc.posFromIndex(q.startIndex);
          const widgetEl = document.createElement('div');
          widgetEl.className = 'cm-question-marker-badge';
          widgetEl.innerHTML = `<span style="font-size: 10px; opacity: 0.9;">📌</span> CÂU ${qNumStr}`;
          widgetEl.style.cursor = 'pointer';
          widgetEl.title = `Bấm để xem câu ${idx + 1} bên bản xem trước`;
          widgetEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetCard = document.querySelector(`.latex-review-q-block[data-question-index="${idx}"]`);
            if (targetCard) {
              targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
              document.querySelectorAll('.latex-review-q-block').forEach(c => c.classList.remove('active-q'));
              targetCard.classList.add('active-q');
              setTimeout(() => targetCard.classList.remove('active-q'), 2500);
            }
          });

          const widget = cm.addLineWidget(pos.line, widgetEl, { above: true, coverGutter: false, noHScroll: true });
          cmLineWidgets.push(widget);
        }
      });
    };

    const updateLatexPreview = (preserveFocus = false) => {
      const text = cm ? cm.getValue() : (document.querySelector('#latex-live-input')?.value || '');
      if (latexInput) latexInput.value = text;
      const parsedQuestions = parseLatexAssignment(text);

      if (parsedQuestions.length === 0) return false;

      // Update state without wiping cursor/scroll
      const activeForm = document.querySelector('#assignment-editor');
      if (activeForm) {
        state.assignmentEditor = collectEditor(lectures);
      }
      state.assignmentEditor.questions = parsedQuestions;
      state.assignmentEditor.latexSource = text;

      // Refresh question markers in CodeMirror
      refreshCodeMirrorQuestionMarkers(parsedQuestions);

      // Update preview DOM directly
      const qBuilder = document.querySelector('.latex-review-list .question-builder');
      const leftPane = document.querySelector('.left-pane');
      const prevScrollTop = leftPane ? leftPane.scrollTop : 0;

      if (qBuilder) {
        qBuilder.innerHTML = parsedQuestions.map((q, idx) => renderQuestionEditor(q, idx)).join('');

        if (window.MathJax) {
          setTimeout(() => {
            window.MathJax.typesetPromise([qBuilder]).then(() => {
              if (leftPane) leftPane.scrollTop = prevScrollTop;
            }).catch(() => {});
          }, 30);
        } else if (leftPane) {
          leftPane.scrollTop = prevScrollTop;
        }
      }

      if (!preserveFocus) {
        toast(`Đã cập nhật ${parsedQuestions.length} câu hỏi.`, 'success');
      }
      return true;
    };

    if (cm) {
      setTimeout(() => {
        updateLatexPreview(true);
      }, 50);
    }

    document.querySelector('#latex-live-parse-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      const ok = updateLatexPreview(false);
      if (!ok) {
        toast('Không tìm thấy câu hỏi nào hợp lệ (cần dùng \\begin{ex}...\\end{ex}).', 'error');
      }
    });

    async function handleImageUpload(file) {
      if (!file) return;
      if (uploadStatus) uploadStatus.style.display = 'inline-block';
      if (uploadBtn) uploadBtn.disabled = true;

      // Save scroll and cursor positions
      const leftPane = document.querySelector('.left-pane');
      const leftScrollTop = leftPane ? leftPane.scrollTop : 0;
      const cmScrollInfo = cm ? cm.getScrollInfo() : null;
      const cmCursor = cm ? cm.getCursor() : null;

      try {
        const url = await uploadAssignmentImage(file);
        const insertText = `\n![image](${url})\n`;
        if (cm) {
          const doc = cm.getDoc();
          const cursor = cmCursor || doc.getCursor();
          doc.replaceRange(insertText, cursor);
          const nextLine = cursor.line + insertText.split('\n').length - 1;
          cm.setCursor({ line: nextLine, ch: 0 });
          if (cmScrollInfo) {
            cm.scrollTo(cmScrollInfo.left, cmScrollInfo.top);
          }
        } else if (latexInput) {
          const startPos = latexInput.selectionStart;
          const endPos = latexInput.selectionEnd;
          const prevScroll = latexInput.scrollTop;
          latexInput.value = latexInput.value.substring(0, startPos) + insertText + latexInput.value.substring(endPos);
          latexInput.selectionStart = latexInput.selectionEnd = startPos + insertText.length;
          latexInput.scrollTop = prevScroll;
          state.assignmentEditor.latexSource = latexInput.value;
        }

        // Auto-refresh preview immediately without reloading whole view
        updateLatexPreview(true);

        if (leftPane) {
          leftPane.scrollTop = leftScrollTop;
        }
        toast('Đã chèn và hiển thị ảnh.', 'success');
      } catch (err) {
        toast('Tải ảnh lên thất bại: ' + err.message, 'error');
      } finally {
        if (uploadStatus) uploadStatus.style.display = 'none';
        if (uploadBtn) uploadBtn.disabled = false;
        if (uploadInput) uploadInput.value = '';
      }
    }

    uploadBtn?.addEventListener('click', () => uploadInput?.click());
    uploadInput?.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleImageUpload(e.target.files[0]);
      }
    });

    const handlePaste = (e) => {
      const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items || [];
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

  const customCategory = (values.category_tag || '').trim();
  let title = values.title || '';
  // If user entered a category, we can ensure title or category metadata carries it
  if (customCategory && !title.startsWith(`[${customCategory}]`)) {
    // If title has an existing bracket like [Đại số], replace it; otherwise prepend it
    if (/^\[[^\]]+\]\s*/.test(title)) {
      title = title.replace(/^\[[^\]]+\]\s*/, `[${customCategory}] `);
    } else {
      title = `[${customCategory}] ${title}`;
    }
  } else if (!customCategory && /^\[[^\]]+\]\s*/.test(title)) {
    // If user cleared category tag, remove bracket tag from title
    title = title.replace(/^\[[^\]]+\]\s*/, '');
  }

  return {
    assignment: {
      id: values.id || undefined,
      title: title,
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
