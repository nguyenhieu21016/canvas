import { toast } from '../../lib/ui.js';
import { escapeHtml, renderLatexText } from '../../lib/html.js';
import { parseLatexAssignment } from '../../lib/assignment.js';
import {
  saveAssignmentWithQuestions,
  uploadAssignmentImage,
  fetchQuestionBank,
  upsertBankQuestion,
  deleteBankQuestion,
  batchInsertBankQuestions,
} from '../../services/lmsApi.js';

export function renderBankLatexPreviewCard(question, index, allQuestions = []) {
  const prevQ = index > 0 ? allQuestions[index - 1] : null;
  const isNewSection = !prevQ || prevQ.type !== question.type;

  let typeCount = 1;
  for (let i = index - 1; i >= 0; i--) {
    if (allQuestions[i]?.type === question.type) typeCount++;
    else break;
  }
  const displayIndex = typeCount - 1;

  let sectionHeaderHTML = '';
  if (isNewSection) {
    let sectionNum = 1;
    for (let i = 1; i <= index; i++) {
      if (allQuestions[i]?.type !== allQuestions[i - 1]?.type) sectionNum++;
    }
    const romanNumeral = ['I', 'II', 'III', 'IV', 'V'][sectionNum - 1] || sectionNum;
    let typeLabel = 'Trắc nghiệm nhiều lựa chọn';
    if (question.type === 'tf4') typeLabel = 'Trắc nghiệm đúng sai';
    if (question.type === 'short') typeLabel = 'Trắc nghiệm trả lời ngắn';
    
    sectionHeaderHTML = `
      <div style="display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 4px 16px 4px 4px; background: #EBEDE6; border: 1px solid #E4E6DE; border-radius: 9999px; color: #181B16; font-family: 'Google Sans', sans-serif; font-weight: 700; font-size: 13.5px; box-sizing: border-box; width: 100%; margin-bottom: 8px; ${index > 0 ? 'margin-top: 14px;' : ''}">
        <span style="width: 24px; height: 24px; border-radius: 50%; background: #181B16; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 700; font-family: 'Google Sans', sans-serif;">${romanNumeral}</span>
        <span>${typeLabel}</span>
      </div>
    `;
  }

  let correctAnswer = question.answer_key?.correct_answer ?? '';
  if (question.type === 'short') {
    correctAnswer = (question.answer_key?.accepted_answers || []).join(', ');
  }
  const cleanPrompt = question.prompt ? question.prompt.replace(/^Câu\s*\d+[\.\:\s]*/i, '') : '';
  const qNumStr = String(index + 1).padStart(2, '0');

  return `
    ${sectionHeaderHTML}
    <article class="latex-review-q-block" data-question-index="${index}" style="display: flex; flex-direction: column; gap: 14px; padding: 20px; border-radius: 14px; border: 1px solid #E4E6DE; background: #ffffff; box-shadow: 0 2px 8px rgba(24, 27, 22, 0.03); cursor: pointer;" title="Bấm để chuyển con trỏ soạn thảo đến câu này">
      
      <!-- Question Title & Prompt -->
      <div style="font-size: 15px; color: #1e293b; line-height: 1.6;">
        <span style="font-weight: 900; color: #181B16; font-size: 16px; font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif; letter-spacing: 0.5px; margin-right: 10px; display: inline-block;">CÂU ${qNumStr}</span>
        <span style="font-weight: 500; color: #1e293b; font-size: 14.5px; font-family: 'Google Sans', sans-serif;">${renderLatexText(cleanPrompt)}</span>
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
          let dotColor = '#181B16';

          if (isCorrectChoice) {
            circleBorder = '#181B16';
            dotDisplay = 'block';
            dotColor = '#181B16';
          }

          return `
            <div style="display: flex; gap: 10px; align-items: center; padding: 2px 0;">
              <div class="latex-radio-circle" style="width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid ${circleBorder}; background: ${circleBg}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <div class="dot" style="width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; display: ${dotDisplay};"></div>
              </div>
              <div style="font-size: 14px; line-height: 1.5; color: #1e293b; display: flex; align-items: center; gap: 4px;">
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
              <div style="font-size: 14px; line-height: 1.5; color: #1e293b; flex: 1;">
                ${renderLatexText(statement)}
              </div>
              <div style="display: flex; gap: 6px; font-weight: bold; font-size: 12.5px;">
                <span style="color: ${isTrue ? '#181B16' : '#cbd5e1'};">Đ</span> /
                <span style="color: ${!isTrue ? '#ef4444' : '#cbd5e1'};">S</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      ` : ''}

      ${question.type === 'mcq' && correctAnswer ? `
      <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #e2e8f0;">
        <div style="font-size: 14.5px; font-weight: 800; color: #181B16; font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif; margin-bottom: 4px;">Đáp án</div>
        <div style="font-family: 'Google Sans', sans-serif; font-size: 14px; font-weight: 700; color: #1e293b; line-height: 1.5;">
          ${correctAnswer}. ${question.choices && question.choices[String(correctAnswer).charCodeAt(0) - 65] ? renderLatexText(question.choices[String(correctAnswer).charCodeAt(0) - 65]) : ''}
        </div>
      </div>
      ` : ''}

      ${question.type === 'short' ? `
      <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #e2e8f0;">
        <div style="font-size: 14.5px; font-weight: 800; color: #181B16; font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif; margin-bottom: 4px;">Đáp án</div>
        <div style="font-family: 'Google Sans', sans-serif; font-size: 14px; font-weight: 700; color: #1e293b; line-height: 1.5; padding: 6px 12px; background: #f8fafc; border-radius: 6px; border: 1px dashed #cbd5e1;">
          ${correctAnswer || '(Chưa có đáp án)'}
        </div>
      </div>
      ` : ''}

      ${question.settings?.explanation ? `
      <div style="margin-top: 12px; padding: 12px 14px; background: #f8fafc; border-radius: 8px; border-left: 3px solid #181B16;">
        <div style="font-size: 13.5px; font-weight: 800; color: #181B16; font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif; margin-bottom: 6px;">Hướng dẫn giải chi tiết</div>
        <div style="font-family: 'Google Sans', sans-serif; font-size: 14px; line-height: 2.0; color: #334155; max-width: 100%; overflow-x: auto;">
          ${renderLatexText(question.settings.explanation)}
        </div>
      </div>
      ` : ''}

    </article>
  `;
}

export async function mountQuestionBank(root) {
  let selectedTag = 'all';
  let searchQuery = '';
  let selectedQuestionIds = new Set();
  let currentQuestions = [];

  root.innerHTML = `
    <style>
      .qb-cm-wrapper {
        flex: 1;
        min-height: 0;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      #qb-latex-modal .CodeMirror {
        height: 100% !important;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        font-size: 13.5px;
        line-height: 1.6;
        border-radius: 12px;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
      }
      #qb-latex-modal .CodeMirror-scroll {
        height: 100% !important;
        overflow-y: auto !important;
        overflow-x: auto !important;
      }
      .latex-review-q-block {
        transition: all 0.2s ease;
      }
      .latex-review-q-block:hover {
        border-color: #181B16 !important;
        box-shadow: 0 4px 12px rgba(24, 27, 22, 0.08) !important;
      }
    </style>
    <div style="min-height: calc(100vh - 64px); background: #F7F7F2; padding: 24px 20px 80px 20px; font-family: 'Google Sans', sans-serif;">
      <div style="max-width: 1140px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Breadcrumb -->
        <div class="nh-admin-breadcrumb-bar">
          <div class="nh-admin-breadcrumb-inner" style="max-width: 1140px;">
            <a href="#/learn">Trang chủ</a>
            <span class="sep">&rsaquo;</span>
            <a href="#/manage">Trung tâm Quản trị</a>
            <span class="sep">&rsaquo;</span>
            <span class="active">Ngân hàng đề thi & Câu hỏi</span>
          </div>
        </div>

        <!-- Header Panel -->
        <div style="background: #ffffff; border-radius: 18px; padding: 28px 32px; border: 1px solid #E4E6DE; box-shadow: 0 4px 16px rgba(24, 27, 22, 0.04); display: flex; flex-direction: column; gap: 20px;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div>
              <h1 style="margin: 0; font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif; font-size: 26px; color: #181B16; font-weight: 700;">
                Ngân hàng đề thi & Câu hỏi
              </h1>
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13.5px;">
                Kho lưu trữ câu hỏi trắc nghiệm, tự luận và soạn thảo trực tiếp bằng mã LaTeX chuẩn EX_TEST
              </p>
            </div>

            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <button id="qb-create-exam-btn" style="display: none; padding: 9px 18px; background: #2e7d32; color: #ffffff; border: none; border-radius: 9999px; font-size: 13.5px; font-weight: 600; cursor: pointer; align-items: center; gap: 8px; box-shadow: 0 2px 8px rgba(46, 125, 50, 0.2);">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                <span>Tạo đề từ câu đã chọn (<span id="qb-selected-count">0</span>)</span>
              </button>

              <button id="qb-open-latex-modal-btn" style="padding: 9px 20px; background: #181B16; color: #ffffff; border: none; border-radius: 9999px; font-size: 13.5px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.15s ease; box-shadow: 0 2px 8px rgba(24, 27, 22, 0.15);" onmouseover="this.style.background='#364019'" onmouseout="this.style.background='#181B16'">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                <span>Nhập bằng mã LaTeX</span>
              </button>

              <button id="qb-add-manual-btn" style="padding: 9px 18px; background: #EBEDE6; color: #181B16; border: 1px solid #E4E6DE; border-radius: 9999px; font-size: 13.5px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.15s ease;" onmouseover="this.style.background='#e2ebda'" onmouseout="this.style.background='#EBEDE6'">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span>Thêm thủ công</span>
              </button>
            </div>
          </div>

          <!-- Search & Filter Bar -->
          <div style="display: flex; flex-direction: column; gap: 14px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
            <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
              <div style="position: relative; flex: 1; min-width: 260px;">
                <input id="qb-search-input" type="text" placeholder="Tìm kiếm nội dung câu hỏi, nguồn trích dẫn, trường thi..." style="width: 100%; height: 42px; padding: 0 16px 0 40px; border-radius: 9999px; border: 1px solid #cbd5e1; font-size: 13.5px; outline: none; box-sizing: border-box; background: #f8fafc;" onfocus="this.style.background='#fff'; this.style.borderColor='#181B16';" onblur="this.style.background='#f8fafc'; this.style.borderColor='#cbd5e1';" />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" style="position: absolute; left: 16px; top: 13px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>

              <div style="display: flex; align-items: center; gap: 8px;">
                <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #475467; cursor: pointer; padding: 6px 12px; border-radius: 9999px; background: #f8fafc; border: 1px solid #e2e8f0; user-select: none;">
                  <input type="checkbox" id="qb-select-all" style="accent-color: #181B16; cursor: pointer;" />
                  <span>Chọn tất cả</span>
                </label>
              </div>
            </div>

            <!-- Tag pills -->
            <div id="qb-tag-pills" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
              <button class="qb-tag-pill active" data-tag="all" style="padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #181B16; background: #181B16; color: #ffffff; transition: all 0.15s ease;">Tất cả</button>
            </div>
          </div>

        </div>

        <!-- Question List Container -->
        <div id="qb-questions-list" style="display: flex; flex-direction: column; gap: 16px;">
          <div style="text-align: center; padding: 60px 20px; color: #64748b; background: #ffffff; border-radius: 16px; border: 1px solid #E4E6DE;">
            Đang tải dữ liệu ngân hàng câu hỏi...
          </div>
        </div>

      </div>
    </div>

    <!-- Modal: Nhập bằng mã LaTeX (EX_TEST Split-View) -->
    <div id="qb-latex-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); z-index: 9999; backdrop-filter: blur(5px); align-items: center; justify-content: center; padding: 20px;">
      <div style="background: #F7F7F2; width: 100%; max-width: 1440px; height: 92vh; border-radius: 20px; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden; border: 1px solid #E4E6DE;">
        
        <!-- Modal Header -->
        <div style="padding: 16px 28px; border-bottom: 1px solid #E4E6DE; display: flex; align-items: center; justify-content: space-between; background: #ffffff;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: #EBEDE6; color: #181B16; display: flex; align-items: center; justify-content: center;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
            </div>
            <div>
              <h2 style="margin: 0; font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif; font-size: 20px; color: #181B16; font-weight: 700;">Nhập câu hỏi vào Ngân hàng (Mã LaTeX EX_TEST)</h2>
              <p style="margin: 2px 0 0 0; font-size: 13px; color: #64748b;">Soạn thảo, xem trước thời gian thực và đồng bộ lưu trữ vào ngân hàng câu hỏi dùng chung</p>
            </div>
          </div>
          <button id="qb-latex-close-btn" type="button" style="border: none; background: #EBEDE6; cursor: pointer; color: #181B16; padding: 7px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;" onmouseover="this.style.background='#e2ebda'" onmouseout="this.style.background='#EBEDE6'">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <!-- Modal Body: Split 2-pane view -->
        <div style="flex: 1; min-height: 0; display: flex; gap: 20px; padding: 20px; overflow: hidden; box-sizing: border-box;">
          
          <!-- Left Pane: Live Preview -->
          <div id="qb-latex-preview-pane" style="flex: 1; min-width: 380px; height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; background: #ffffff; border-radius: 16px; border: 1px solid #E4E6DE; padding: 24px 28px; box-sizing: border-box; box-shadow: 0 2px 8px rgba(24, 27, 22, 0.04);">
            <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9; position: sticky; top: -24px; background: #ffffff; z-index: 10; margin-top: -8px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif; font-size: 16px; font-weight: 700; color: #181B16;">Bản xem trước trực quan</span>
                <span id="qb-preview-count-badge" style="background: #EBEDE6; color: #181B16; border: 1px solid #E4E6DE; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">0 câu hỏi</span>
              </div>
              <span style="font-size: 12px; color: #94a3b8;">Tự động render công thức & hình ảnh</span>
            </div>

            <div id="qb-latex-preview-list" style="display: flex; flex-direction: column; gap: 18px;">
              <!-- Question cards injected here -->
            </div>
          </div>

          <!-- Right Pane: LaTeX Editor -->
          <div id="qb-latex-editor-pane" style="flex: 1.1; min-width: 440px; height: 100%; display: flex; flex-direction: column; background: #ffffff; border-radius: 16px; border: 1px solid #E4E6DE; padding: 20px; box-sizing: border-box; box-shadow: 0 2px 8px rgba(24, 27, 22, 0.04);">
            
            <!-- Editor Toolbar -->
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px; margin-bottom: 14px; gap: 10px; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13px; font-weight: 700; color: #181B16; white-space: nowrap;">Chủ đề / Nhãn:</span>
                <input type="text" id="qb-latex-tag-input" value="Vecto" placeholder="Nhập nhãn (VD: Vecto, Đại số...)" style="height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 12.5px; outline: none; background: #f8fafc; width: 180px;" onfocus="this.style.background='#fff'; this.style.borderColor='#181B16';" onblur="this.style.background='#f8fafc'; this.style.borderColor='#cbd5e1';" />
              </div>

              <div style="display: flex; align-items: center; gap: 8px;">
                <input type="file" id="qb-latex-tex-file" accept=".tex,.txt" style="display: none;" />
                <button type="button" id="qb-latex-upload-tex-btn" style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; background: #ffffff; color: #181B16; border: 1px solid #E4E6DE; border-radius: 9999px; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all 0.15s ease;" onmouseover="this.style.background='#EBEDE6'" onmouseout="this.style.background='#ffffff'">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  <span>Tải file .tex</span>
                </button>

                <input type="file" id="qb-latex-img-file" accept="image/*" style="display: none;" />
                <button type="button" id="qb-latex-insert-img-btn" style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; background: #ffffff; color: #181B16; border: 1px solid #E4E6DE; border-radius: 9999px; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all 0.15s ease;" onmouseover="this.style.background='#EBEDE6'" onmouseout="this.style.background='#ffffff'">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  <span>Chèn ảnh</span>
                </button>
                <span id="qb-latex-img-status" style="font-size: 12px; color: #181B16; display: none;">Đang tải ảnh...</span>

                <button type="button" id="qb-latex-refresh-preview-btn" style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; background: #181B16; color: #ffffff; border: none; border-radius: 9999px; font-size: 12.5px; font-weight: 600; cursor: pointer;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                  <span>Làm mới</span>
                </button>
              </div>
            </div>

            <!-- CodeMirror / Textarea Wrapper -->
            <div class="qb-cm-wrapper">
              <textarea id="qb-latex-code-input" style="flex: 1; height: 100%; width: 100%; box-sizing: border-box; padding: 14px; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 13px; line-height: 1.6; border: 1px solid #cbd5e1; border-radius: 12px; resize: none; background: #f8fafc; color: #0f172a; outline: none;"></textarea>
            </div>
          </div>

        </div>

        <!-- Modal Footer -->
        <div style="padding: 14px 28px; border-top: 1px solid #E4E6DE; display: flex; justify-content: space-between; align-items: center; background: #ffffff;">
          <div id="qb-latex-footer-summary" style="font-size: 13.5px; color: #475467; font-weight: 500;">
            Sẵn sàng: <b style="color: #181B16;" id="qb-latex-count-text">0 câu hỏi</b>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <button id="qb-latex-cancel-btn" type="button" style="padding: 8px 18px; border: 1px solid #cbd5e1; background: #ffffff; border-radius: 9999px; font-size: 13.5px; font-weight: 600; cursor: pointer; color: #475467;">Đóng</button>
            <button id="qb-latex-save-bank-btn" type="button" style="padding: 9px 24px; border: none; background: #181B16; color: #ffffff; border-radius: 9999px; font-size: 13.5px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 8px rgba(24, 27, 22, 0.2);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              <span>Lưu vào Ngân hàng đề</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  const container = root.querySelector('#qb-questions-list');
  const searchInput = root.querySelector('#qb-search-input');
  const tagPillsContainer = root.querySelector('#qb-tag-pills');
  const selectAllCb = root.querySelector('#qb-select-all');
  const createExamBtn = root.querySelector('#qb-create-exam-btn');
  const selectedCountSpan = root.querySelector('#qb-selected-count');

  // Load questions from Supabase
  async function loadQuestions() {
    try {
      const { questions, count } = await fetchQuestionBank({ limit: 300, offset: 0 });
      currentQuestions = questions;
      renderQuestionsList();
      renderTagPills();
    } catch (err) {
      container.innerHTML = `<div style="text-align: center; padding: 40px; color: #ef4444; background: #fff; border-radius: 16px;">Lỗi: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderTagPills() {
    const allTags = new Set();
    currentQuestions.forEach(q => (q.tags || []).forEach(t => allTags.add(t)));
    
    let html = `<button class="qb-tag-pill ${selectedTag === 'all' ? 'active' : ''}" data-tag="all" style="padding: 4px 14px; border-radius: 9999px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid ${selectedTag === 'all' ? '#181B16' : '#E4E6DE'}; background: ${selectedTag === 'all' ? '#181B16' : '#ffffff'}; color: ${selectedTag === 'all' ? '#ffffff' : '#181B16'}; transition: all 0.15s ease;">Tất cả (${currentQuestions.length})</button>`;
    
    Array.from(allTags).sort().forEach(tag => {
      const count = currentQuestions.filter(q => (q.tags || []).includes(tag)).length;
      const isSelected = selectedTag === tag;
      html += `
        <button class="qb-tag-pill ${isSelected ? 'active' : ''}" data-tag="${escapeHtml(tag)}" style="padding: 4px 14px; border-radius: 9999px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid ${isSelected ? '#181B16' : '#E4E6DE'}; background: ${isSelected ? '#181B16' : '#ffffff'}; color: ${isSelected ? '#ffffff' : '#181B16'}; transition: all 0.15s ease;">
          ${escapeHtml(tag)} (${count})
        </button>
      `;
    });

    tagPillsContainer.innerHTML = html;

    tagPillsContainer.querySelectorAll('.qb-tag-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedTag = e.currentTarget.dataset.tag;
        renderTagPills();
        renderQuestionsList();
      });
    });
  }

  function renderQuestionsList() {
    let filtered = currentQuestions;

    if (selectedTag !== 'all') {
      filtered = filtered.filter(q => (q.tags || []).includes(selectedTag));
    }

    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase();
      filtered = filtered.filter(q => {
        return (q.prompt || '').toLowerCase().includes(qLower) ||
          (q.tags || []).some(t => t.toLowerCase().includes(qLower)) ||
          (q.choices || []).some(c => c.toLowerCase().includes(qLower));
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: #64748b; background: #ffffff; border-radius: 16px; border: 1px solid #E4E6DE;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin-bottom: 8px;"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>
          <div style="font-weight: 600; font-size: 15px; color: #1e293b;">Không tìm thấy câu hỏi nào</div>
          <div style="font-size: 13px; margin-top: 4px;">Hãy thử bấm "Nhập bằng mã LaTeX" ở trên để đưa câu hỏi vào ngân hàng.</div>
        </div>
      `;
      return;
    }

    let html = `
      <div style="font-size: 13.5px; color: #64748b; margin-bottom: 4px; display: flex; justify-content: space-between;">
        <span>Hiển thị <b>${filtered.length}</b> câu hỏi</span>
      </div>
    `;

    filtered.forEach((q, idx) => {
      const isChecked = selectedQuestionIds.has(q.id);
      const keyObj = Array.isArray(q.answer_keys) ? q.answer_keys[0] : q.answer_keys;
      const correctAns = keyObj?.correct_answer ?? '';
      const tags = q.tags || [];

      html += `
        <div class="qb-question-card" data-id="${q.id}" style="background: #ffffff; border-radius: 16px; border: 1px solid ${isChecked ? '#181B16' : '#E4E6DE'}; padding: 24px; box-shadow: 0 2px 8px rgba(24, 27, 22, 0.03); display: flex; flex-direction: column; gap: 14px; transition: border-color 0.15s ease;">
          
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
            <div style="display: flex; align-items: flex-start; gap: 12px; flex: 1;">
              <input type="checkbox" class="qb-item-cb" data-id="${q.id}" ${isChecked ? 'checked' : ''} style="accent-color: #181B16; width: 18px; height: 18px; margin-top: 2px; cursor: pointer; flex-shrink: 0;" />
              <div>
                <span style="font-weight: 800; font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif; color: #181B16; font-size: 15px; margin-right: 8px;">CÂU ${idx + 1}</span>
                ${tags.map(t => `<span style="background: #EBEDE6; color: #181B16; border: 1px solid #E4E6DE; padding: 2px 8px; border-radius: 9999px; font-size: 11.5px; font-weight: 600; margin-right: 6px;">${escapeHtml(t)}</span>`).join('')}
              </div>
            </div>

            <button class="delete-qb-btn" data-id="${q.id}" style="color: #ef4444; background: none; border: none; cursor: pointer; padding: 4px; border-radius: 4px; font-size: 12.5px; font-weight: 600;">
              Xóa
            </button>
          </div>

          <!-- Prompt -->
          <div style="font-size: 14.5px; color: #1e293b; line-height: 1.6; padding-left: 30px;">
            ${renderLatexText(q.prompt)}
          </div>

          <!-- Choices Grid -->
          ${Array.isArray(q.choices) && q.choices.length > 0 ? `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; padding-left: 30px; margin-top: 4px;">
              ${q.choices.map((choice, cIdx) => {
                const letter = String.fromCharCode(65 + cIdx);
                const isCorrect = String(correctAns).toUpperCase() === letter;
                return `
                  <div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; border: 1px solid ${isCorrect ? '#181B16' : '#e2e8f0'}; background: ${isCorrect ? '#EBEDE6' : '#ffffff'}; font-size: 13.5px; color: ${isCorrect ? '#181B16' : '#1e293b'}; font-weight: ${isCorrect ? '600' : '400'};">
                    <span style="width: 22px; height: 22px; border-radius: 50%; background: ${isCorrect ? '#181B16' : '#f1f5f9'}; color: ${isCorrect ? '#ffffff' : '#64748b'}; display: flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 700; flex-shrink: 0;">${letter}</span>
                    <span style="flex: 1;">${renderLatexText(choice)}</span>
                    ${isCorrect ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#181B16" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          <!-- Explanation Accordion if present -->
          ${q.settings?.explanation ? `
            <details style="margin-top: 4px; margin-left: 30px; border: 1px dashed #E4E6DE; border-radius: 10px; overflow: hidden; background: #F7F9F4;">
              <summary style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #181B16; cursor: pointer; user-select: none; list-style: none; display: flex; align-items: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                <span>Xem lời giải chi tiết</span>
              </summary>
              <div style="padding: 14px; border-top: 1px solid #E4E6DE; font-size: 13.5px; color: #334155; line-height: 1.6; background: #ffffff;">
                ${renderLatexText(q.settings.explanation)}
              </div>
            </details>
          ` : ''}

        </div>
      `;
    });

    container.innerHTML = html;

    // Trigger MathJax typesetting
    if (window.MathJax) {
      window.MathJax.typesetPromise([container]).catch(() => {});
    }

    // Wire individual checkboxes
    container.querySelectorAll('.qb-item-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.currentTarget.dataset.id;
        if (e.currentTarget.checked) selectedQuestionIds.add(id);
        else selectedQuestionIds.delete(id);
        updateBatchActionBar();
      });
    });

    // Wire delete single question
    container.querySelectorAll('.delete-qb-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (confirm('Bạn có chắc chắn muốn xóa câu hỏi này khỏi ngân hàng đề?')) {
          try {
            await deleteBankQuestion(id);
            toast('Đã xóa câu hỏi khỏi ngân hàng');
            selectedQuestionIds.delete(id);
            loadQuestions();
          } catch (err) {
            toast(err.message, 'error');
          }
        }
      });
    });
  }

  function updateBatchActionBar() {
    const count = selectedQuestionIds.size;
    selectedCountSpan.textContent = count;
    if (count > 0) {
      createExamBtn.style.display = 'inline-flex';
    } else {
      createExamBtn.style.display = 'none';
    }
  }

  // Select all checkbox
  selectAllCb.addEventListener('change', (e) => {
    if (e.currentTarget.checked) {
      currentQuestions.forEach(q => selectedQuestionIds.add(q.id));
    } else {
      selectedQuestionIds.clear();
    }
    renderQuestionsList();
    updateBatchActionBar();
  });

  // Search input debounced
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchQuery = e.target.value;
      renderQuestionsList();
    }, 250);
  });

  // Create Assignment from selected questions
  createExamBtn.addEventListener('click', async () => {
    const selected = currentQuestions.filter(q => selectedQuestionIds.has(q.id));
    if (selected.length === 0) return;

    const examTitle = prompt(`Nhập tên đề thi mới cho ${selected.length} câu hỏi:`, `Đề kiểm tra (${selected.length} câu)`);
    if (!examTitle) return;

    try {
      const assignmentPayload = {
        title: examTitle.trim(),
        published: true,
        pdf_url: 'latex',
        description: '',
      };
      
      const newQuestions = selected.map((q, idx) => ({
        type: q.type,
        prompt: q.prompt,
        points: q.points || 1,
        sort_order: idx + 1,
        choices: q.choices,
        settings: q.settings,
        answer_key: q.answer_keys?.[0] || { correct_answer: 'A' },
      }));

      await saveAssignmentWithQuestions(assignmentPayload, newQuestions);
      toast(`Đã tạo thành công đề thi "${examTitle}"!`, 'success');
      window.location.hash = '#/assignments';
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // Manual Question Modal
  root.querySelector('#qb-add-manual-btn').addEventListener('click', () => {
    const promptText = prompt('Nhập nội dung câu hỏi:');
    if (!promptText) return;
    const ans = (prompt('Nhập đáp án đúng (A/B/C/D):', 'A') || 'A').toUpperCase();
    const tag = prompt('Nhập nhãn chủ đề:', 'Chung') || 'Chung';

    upsertBankQuestion({
      type: 'mcq',
      prompt: promptText,
      choices: ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'],
      tags: [tag]
    }, { correct_answer: ans })
      .then(() => {
        toast('Đã thêm câu hỏi vào ngân hàng');
        loadQuestions();
      })
      .catch(err => toast(err.message, 'error'));
  });

  // -------------------------------------------------------------
  // LATEX COMPOSER MODAL FOR QUESTION BANK (SPLIT-VIEW)
  // -------------------------------------------------------------
  const qbLatexModal = root.querySelector('#qb-latex-modal');
  const qbOpenLatexModalBtn = root.querySelector('#qb-open-latex-modal-btn');
  const qbLatexCloseBtn = root.querySelector('#qb-latex-close-btn');
  const qbLatexCancelBtn = root.querySelector('#qb-latex-cancel-btn');
  const qbLatexCodeInput = root.querySelector('#qb-latex-code-input');
  const qbLatexPreviewPane = root.querySelector('#qb-latex-preview-pane');
  const qbLatexPreviewList = root.querySelector('#qb-latex-preview-list');
  const qbPreviewCountBadge = root.querySelector('#qb-preview-count-badge');
  const qbLatexCountText = root.querySelector('#qb-latex-count-text');
  const qbLatexTagInput = root.querySelector('#qb-latex-tag-input');
  const qbTexFileInput = root.querySelector('#qb-latex-tex-file');
  const qbUploadTexBtn = root.querySelector('#qb-latex-upload-tex-btn');
  const qbImgFileInput = root.querySelector('#qb-latex-img-file');
  const qbInsertImgBtn = root.querySelector('#qb-latex-insert-img-btn');
  const qbImgStatus = root.querySelector('#qb-latex-img-status');
  const qbRefreshBtn = root.querySelector('#qb-latex-refresh-preview-btn');
  const qbSaveBankBtn = root.querySelector('#qb-latex-save-bank-btn');

  let qbCm = null;
  let qbDebounce = null;

  const defaultLatexSample = `\\begin{ex}
(THPT Triệu Sơn 1 - Thanh Hóa 2025) Cho hình hộp $ABCD.A'B'C'D'$. Tổng $\\overrightarrow{A'C'} + \\overrightarrow{CD}$ bằng
\\choice
{$\\overrightarrow{BD}$}
{$\\overrightarrow{A'D}$}
{$\\overrightarrow{CB}$}
{\\True $\\overrightarrow{AD}$}
\\loigiai{
\\textbf{Chọn D.}
Ta có $\\overrightarrow{A'C'} = \\overrightarrow{AC}$ (do tứ giác $ACC'A'$ là hình bình hành).
Do đó: $\\overrightarrow{A'C'} + \\overrightarrow{CD} = \\overrightarrow{AC} + \\overrightarrow{CD} = \\overrightarrow{AD}$.
}
\\end{ex}`;

  function updateQbLatexPreview(showToast = false) {
    const text = qbCm ? qbCm.getValue() : (qbLatexCodeInput?.value || '');
    const parsedQuestions = parseLatexAssignment(text);

    if (qbPreviewCountBadge) qbPreviewCountBadge.textContent = `${parsedQuestions.length} câu hỏi`;
    if (qbLatexCountText) qbLatexCountText.textContent = `${parsedQuestions.length} câu hỏi`;

    const prevScrollTop = qbLatexPreviewPane ? qbLatexPreviewPane.scrollTop : 0;

    if (parsedQuestions.length === 0) {
      if (qbLatexPreviewList) {
        qbLatexPreviewList.innerHTML = `
          <div style="padding: 48px 20px; text-align: center; color: #94a3b8; font-family: 'Google Sans', sans-serif; font-size: 13.5px; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin-bottom: 8px;"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
            <div style="font-weight: 600; color: #64748b; font-size: 14px;">Chưa nhận diện được câu hỏi nào</div>
            <div style="font-size: 12.5px; margin-top: 4px;">Hãy dán mã dạng <code>\\begin{ex}...\\end{ex}</code> với <code>\\choice</code> hoặc <code>\\choiceTF</code> vào khung bên phải!</div>
          </div>
        `;
      }
      return false;
    }

    if (qbLatexPreviewList) {
      qbLatexPreviewList.innerHTML = parsedQuestions.map((q, idx) => renderBankLatexPreviewCard(q, idx, parsedQuestions)).join('');

      // Wire clicking on preview card to navigate CodeMirror cursor to that question
      qbLatexPreviewList.querySelectorAll('.latex-review-q-block').forEach(card => {
        card.addEventListener('click', () => {
          const qIdx = parseInt(card.dataset.questionIndex, 10);
          const targetQ = parsedQuestions[qIdx];
          if (targetQ && targetQ.startIndex !== undefined && qbCm) {
            const doc = qbCm.getDoc();
            const pos = doc.posFromIndex(targetQ.startIndex);
            qbCm.setCursor(pos);
            qbCm.scrollIntoView({ line: pos.line, ch: 0 }, 100);
            qbCm.focus();
          }
        });
      });

      if (window.MathJax) {
        setTimeout(() => {
          window.MathJax.typesetPromise([qbLatexPreviewList]).then(() => {
            if (qbLatexPreviewPane) qbLatexPreviewPane.scrollTop = prevScrollTop;
          }).catch(() => {});
        }, 30);
      } else if (qbLatexPreviewPane) {
        qbLatexPreviewPane.scrollTop = prevScrollTop;
      }
    }

    if (showToast) {
      toast(`Đã nhận diện thành công ${parsedQuestions.length} câu hỏi.`, 'success');
    }
    return true;
  }

  function initQbCodeMirror() {
    if (!qbCm && window.CodeMirror && qbLatexCodeInput) {
      if (!qbLatexCodeInput.value.trim()) {
        qbLatexCodeInput.value = defaultLatexSample;
      }
      qbCm = window.CodeMirror.fromTextArea(qbLatexCodeInput, {
        lineNumbers: true,
        mode: 'stex',
        lineWrapping: true,
        theme: 'default',
        extraKeys: {
          'Cmd-S': function () { updateQbLatexPreview(true); },
          'Ctrl-S': function () { updateQbLatexPreview(true); }
        }
      });
      qbCm.on('change', () => {
        clearTimeout(qbDebounce);
        qbDebounce = setTimeout(() => {
          updateQbLatexPreview(false);
        }, 350);
      });
    }
    setTimeout(() => {
      if (qbCm) {
        qbCm.refresh();
      }
      updateQbLatexPreview(false);
    }, 60);
  }

  // Open Modal
  if (qbOpenLatexModalBtn) {
    qbOpenLatexModalBtn.addEventListener('click', () => {
      qbLatexModal.style.display = 'flex';
      initQbCodeMirror();
    });
  }

  // Close Modal
  const closeQbModal = () => {
    qbLatexModal.style.display = 'none';
  };
  if (qbLatexCloseBtn) qbLatexCloseBtn.addEventListener('click', closeQbModal);
  if (qbLatexCancelBtn) qbLatexCancelBtn.addEventListener('click', closeQbModal);

  // Refresh preview button
  if (qbRefreshBtn) {
    qbRefreshBtn.addEventListener('click', () => {
      const ok = updateQbLatexPreview(true);
      if (!ok) {
        toast('Không tìm thấy câu hỏi \\begin{ex}...\\end{ex} nào.', 'error');
      }
    });
  }

  // Upload .tex file
  if (qbUploadTexBtn && qbTexFileInput) {
    qbUploadTexBtn.addEventListener('click', () => qbTexFileInput.click());
    qbTexFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        if (qbCm) {
          qbCm.setValue(text);
        } else if (qbLatexCodeInput) {
          qbLatexCodeInput.value = text;
        }
        updateQbLatexPreview(true);
        toast(`Đã nạp file "${file.name}"!`, 'success');
      } catch (err) {
        toast('Không thể đọc file: ' + err.message, 'error');
      } finally {
        qbTexFileInput.value = '';
      }
    });
  }

  // Insert image
  if (qbInsertImgBtn && qbImgFileInput) {
    qbInsertImgBtn.addEventListener('click', () => qbImgFileInput.click());
    qbImgFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (qbImgStatus) qbImgStatus.style.display = 'inline-block';
      qbInsertImgBtn.disabled = true;

      try {
        const url = await uploadAssignmentImage(file);
        const insertText = `\n![image](${url})\n`;

        if (qbCm) {
          const doc = qbCm.getDoc();
          const cursor = doc.getCursor();
          doc.replaceRange(insertText, cursor);
          const nextLine = cursor.line + insertText.split('\n').length - 1;
          qbCm.setCursor({ line: nextLine, ch: 0 });
        } else if (qbLatexCodeInput) {
          const startPos = qbLatexCodeInput.selectionStart || 0;
          const endPos = qbLatexCodeInput.selectionEnd || 0;
          const val = qbLatexCodeInput.value;
          qbLatexCodeInput.value = val.substring(0, startPos) + insertText + val.substring(endPos);
          qbLatexCodeInput.selectionStart = qbLatexCodeInput.selectionEnd = startPos + insertText.length;
        }

        updateQbLatexPreview(false);
        toast('Đã tải ảnh lên và chèn vào vị trí con trỏ!', 'success');
      } catch (err) {
        toast('Lỗi khi tải ảnh: ' + err.message, 'error');
      } finally {
        if (qbImgStatus) qbImgStatus.style.display = 'none';
        qbInsertImgBtn.disabled = false;
        qbImgFileInput.value = '';
      }
    });
  }

  // Save to Bank
  if (qbSaveBankBtn) {
    qbSaveBankBtn.addEventListener('click', async () => {
      const text = qbCm ? qbCm.getValue() : (qbLatexCodeInput?.value || '');
      const questions = parseLatexAssignment(text);

      if (questions.length === 0) {
        toast('Không tìm thấy câu hỏi nào hợp lệ để lưu (cần dùng \\begin{ex}...\\end{ex}).', 'error');
        return;
      }

      const rawTag = (qbLatexTagInput?.value || '').trim() || 'Chung';
      const tagList = rawTag.split(',').map(t => t.trim()).filter(Boolean);
      const tags = tagList.length > 0 ? tagList : ['Chung'];

      qbSaveBankBtn.disabled = true;
      qbSaveBankBtn.innerHTML = `<span>Đang lưu ${questions.length} câu hỏi...</span>`;

      try {
        const formatted = questions.map((q, idx) => ({
          type: q.type,
          prompt: q.prompt,
          points: q.points || 1,
          sort_order: idx + 1,
          choices: q.choices,
          settings: q.settings || {},
          correct_answer: q.answer_key?.correct_answer ?? 'A',
          answer_key: q.answer_key,
          tags: tags,
        }));

        await batchInsertBankQuestions(formatted);
        toast(`Đã lưu thành công ${questions.length} câu hỏi vào Ngân hàng đề!`, 'success');
        closeQbModal();
        loadQuestions();
      } catch (err) {
        toast('Lỗi khi lưu vào ngân hàng: ' + err.message, 'error');
      } finally {
        qbSaveBankBtn.disabled = false;
        qbSaveBankBtn.innerHTML = `
          <svg width="16" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
          <span>Lưu vào Ngân hàng đề</span>
        `;
      }
    });
  }

  loadQuestions();
}
