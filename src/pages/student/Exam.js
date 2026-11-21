import { state, isManager, pageRoot } from '../../store.js';
import { go, wireRouteRetry } from '../../router.js';
import { accountInitial, toast, renderLoading, renderErrorState, renderScoreProgress, renderMetric } from '../../lib/ui.js';
import { escapeHtml, renderLatexText, setButtonLoading } from '../../lib/html.js';
import { formatDateTime, formatScore, formatAnswer } from '../../lib/format.js';
import { driveFrame } from '../../lib/drive.js';
import { saveDraft, loadDraft, clearDraft } from '../../lib/draft.js';
import { normalizeAssignmentEditor } from '../../lib/assignment.js';
import { supabase } from '../../services/supabaseClient.js';
import {
  fetchAssignmentEditor,
  fetchAssignmentForStudent,
  fetchStudentAssignmentOverview,
  submitAssignmentAttempt,
  fetchAttemptReview,
  fetchAssignmentInsights,
} from '../../services/lmsApi.js';

export async function mountAssignment(id) {
  if (isManager()) return mountAssignmentManagerView(id);

  return mountStudentAssignmentOverview(id);
}

export async function mountStudentAssignmentOverview(id) {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang mở bài tập');
  try {
    const { assignment, attempts } = await fetchStudentAssignmentOverview(id);
    const latest = attempts[0];
    const isPdfAssignment = assignment.pdf_url && assignment.pdf_url !== 'latex';
    const isStudent = state.profile.role === 'student';
    const isLockedPdfForStudent = isStudent && isPdfAssignment;
    const latestScore10 = latest ? (latest.score_10 ?? 0) : 0;
    const draft = loadDraft(localStorage, state.profile.id, id);
    const hasDraftInProgress = draft && draft.answers && Object.values(draft.answers).some(Boolean);

    root.innerHTML = `
      <div>
        <!-- Tràn viền Breadcrumb Bar chuẩn ngochuyenlb (Nền mạ nhạt tràn lề) -->
        <div style="background: #DCE8CC; padding: 10px max(var(--page-gutter), 24px); border-bottom: 1px solid #D1DFC0;">
          <div style="max-width: 1040px; margin: 0 auto; font-family: 'Be Vietnam Pro', sans-serif; font-size: 13px; color: #455120; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <a href="#/learn" style="color: #455120; text-decoration: none; font-weight: 500; opacity: 0.9; transition: color 0.15s ease;">Danh mục khóa học</a>
            <span style="opacity: 0.6; font-size: 13px;">&rsaquo;</span>
            <a href="javascript:history.back()" style="color: #455120; text-decoration: none; font-weight: 500; opacity: 0.9; transition: color 0.15s ease;">Giai đoạn</a>
            <span style="opacity: 0.6; font-size: 13px;">&rsaquo;</span>
            <span style="color: #455120; font-weight: 700;">${escapeHtml((assignment.title || '').replace(/Bài tập về nhà/gi, 'Bài tập'))}</span>
          </div>
        </div>

        <div style="background: #EDF2E4; min-height: calc(100vh - 108px); padding: 24px max(var(--page-gutter), 24px);">
          <div style="max-width: 1040px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px;">

            <!-- Page Main Title -->
            <h1 style="font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 26px; font-weight: 700; color: #101828; margin: 0; line-height: 1.25;">
              ${escapeHtml((assignment.title || '').replace(/Bài tập về nhà/gi, 'Bài tập'))}
            </h1>

          <!-- Stats Block Layout — 1 card trắng duy nhất -->
          <div style="background: #ffffff; border-radius: 16px; border: 1px solid #D8E2C4; padding: 32px 36px; display: flex; align-items: center; gap: 48px; box-shadow: 0 2px 8px rgba(69, 81, 32, 0.04);">

            <!-- Score Circle -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; flex-shrink: 0;">
              <div style="position: relative; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center;">
                <svg viewBox="0 0 36 36" style="position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg);">
                  <path stroke="#EDF2E4" stroke-width="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path stroke="#455120" stroke-width="3" stroke-dasharray="${latestScore10 * 10}, 100" stroke-linecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1;">
                  <span style="font-family: 'Beautique Display', serif; font-size: 13px; font-weight: 700; color: #667085; margin-bottom: 2px;">Điểm của em</span>
                  <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 44px; font-weight: 800; color: #455120; line-height: 1;">${latest ? formatScore(latestScore10) : '—'}</span>
                </div>
              </div>
            </div>

            <!-- Vertical Divider -->
            <div style="width: 1px; height: 80px; background: #E5ECD9; flex-shrink: 0;"></div>

            <!-- Stats Right -->
            <div style="display: flex; gap: 48px; flex: 1;">

              <!-- Số câu hỏi -->
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <span style="font-family: 'Beautique Display', serif; font-size: 15px; font-weight: 700; color: #475467;">Số câu hỏi</span>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #455120; opacity: 0.85;"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 18px; font-weight: 600; color: #101828; line-height: 1; display: inline-block; transform: translateY(1px);">${assignment.question_count ?? 0}</span>
                </div>
              </div>

              <!-- Thời gian làm bài -->
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <span style="font-family: 'Beautique Display', serif; font-size: 15px; font-weight: 700; color: #475467;">Thời gian làm bài</span>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #455120; opacity: 0.85;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 17px; font-weight: 600; color: #101828; line-height: 1; display: inline-block; transform: translateY(1px);">${assignment.time_limit ? `${assignment.time_limit}<span style="font-size: 14px; font-weight: 500; margin-left: 4px; color: #475467;">phút</span>` : 'Không giới hạn'}</span>
                </div>
              </div>

            </div>
          </div>

          <!-- Action Button Center -->
          <div style="display: flex; justify-content: center; gap: 12px; margin: 8px 0;">
            ${isLockedPdfForStudent ? `
              <div style="padding: 12px 24px; background: #FEF3F2; color: #B42318; border: 1px solid #FECDCA; border-radius: 9999px; font-size: 14px; font-weight: 700; display: inline-flex; align-items: center; gap: 8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                Hiện tại toàn bộ bài tập dùng link PDF đã đóng truy cập
              </div>
            ` : `
              <button id="start-assignment" style="background: #455120; color: #ffffff; border: none; padding: 12px 42px; border-radius: 6px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: transform 0.1s ease, background-color 0.2s ease;">
                ${hasDraftInProgress ? 'Làm tiếp' : 'Bắt đầu làm bài'}
              </button>
            `}
          </div>

          <!-- History Panel -->
          <div style="background: #ffffff; border-radius: 16px; border: 1px solid #D8E2C4; padding: 24px; box-shadow: 0 2px 8px rgba(69, 81, 32, 0.04);">
            <h3 style="font-size: 16px; font-weight: 800; color: #101828; margin: 0 0 16px 0; font-family: 'Be Vietnam Pro', sans-serif;">Lịch sử làm bài</h3>
            ${attempts.length > 0 ? renderStudentAssignmentHistory(attempts) : '<div style="text-align: center; color: #667085; padding: 32px 0; font-size: 14px;">Chưa có lần nộp nào.</div>'}
          </div>

        </div>
      </div>
    </div>
    `;
    document.querySelector('#start-assignment')?.addEventListener('click', () => mountAssignmentExam(id));
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}


export function renderStudentAssignmentHistory(attempts) {
  if (!attempts.length) return '<div style="text-align: center; color: #667085; padding: 24px; font-family: \'Be Vietnam Pro\', sans-serif; font-size: 14px;">Chưa có lần nộp nào.</div>';

  function fmtShort(value) {
    if (!value) return '-';
    const d = new Date(value);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const yr = String(d.getFullYear()).slice(-2);
    return `${hh}:${mm} ${day}/${month}/${yr}`;
  }

  return `
    <div style="display: flex; flex-direction: column;">
      ${attempts
        .map((attempt, index) => {
          const isPassed = (attempt.score_10 ?? 0) >= 8.0;
          const isLast = index === attempts.length - 1;
          return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 0; ${isLast ? '' : 'border-bottom: 1px solid #E5ECD9;'}">
              <div style="display: flex; align-items: center; gap: 14px;">
                <span style="padding: 3px 8px; border: 1px solid ${isPassed ? '#455120' : '#455120'}; color: #455120; font-size: 11px; font-weight: 700; border-radius: 4px; font-family: 'Be Vietnam Pro', sans-serif; letter-spacing: 0.3px; white-space: nowrap;">
                  ${isPassed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                </span>
                <span style="font-size: 15px; font-weight: 700; color: #101828; font-family: 'Be Vietnam Pro', sans-serif; min-width: 28px;">
                  ${formatScore(attempt.score_10)}
                </span>
                <span style="font-size: 13px; color: #667085; font-family: 'Be Vietnam Pro', sans-serif; display: flex; align-items: center; gap: 5px;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  ${fmtShort(attempt.submitted_at)}
                </span>
              </div>
              <a href="#/review/${attempt.id}" style="padding: 5px 16px; border: 1px solid #455120; color: #455120; border-radius: 9999px; font-size: 13px; font-weight: 500; text-decoration: none; font-family: 'Be Vietnam Pro', sans-serif; white-space: nowrap;">Chi tiết</a>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}


export async function mountAssignmentExam(id) {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang mở đề');
  try {
    const { assignment, questions } = await fetchAssignmentForStudent(id);
    if (state.profile.role === 'student' && assignment.pdf_url && assignment.pdf_url !== 'latex') {
      root.innerHTML = `
        <div class="panel" style="max-width: 600px; margin: 60px auto; padding: 48px 32px; text-align: center; border-radius: 20px;">
          <md-icon style="font-size: 56px; color: #B42318; margin-bottom: 16px;">lock</md-icon>
          <h2 style="margin: 0 0 12px 0; color: #101828; font-family: 'Beautique Display', serif;">Bài tập PDF đã bị khóa</h2>
          <p style="color: #667085; line-height: 1.6; margin-bottom: 24px; font-family: 'Be Vietnam Pro', sans-serif;">Hệ thống không còn cho phép làm bài hoặc mở đề PDF này nữa. Kết quả điểm số cũ của bạn vẫn được ghi nhận trong lịch sử.</p>
          <a class="nh-btn-primary" href="#/assignment/${id}" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px; background: #455120; color: #fff; text-decoration: none; border-radius: 9999px; font-weight: 600;">Xem lịch sử điểm</a>
        </div>
      `;
      return;
    }
    const draft = loadDraft(localStorage, state.profile.id, id);
    const answers = draft?.answers ?? {};
    root.innerHTML = `
      ${assignment.pdf_url === 'latex' ? `
        <div style="background-color: #EDF2E4; min-height: 100vh; padding: 0 0 60px 0; margin: 0; font-family: 'Be Vietnam Pro', sans-serif;">
          <!-- Top Breadcrumb Bar -->
          <div style="background: #DCE8CC; color: #455120; border-bottom: 1px solid #D1DFC0; padding: 12px 0; margin-bottom: 24px;">
            <div style="max-width: 1420px; width: 100%; margin: 0 auto; padding: 0 40px; font-size: 13.5px; font-weight: 500; display: flex; align-items: center; gap: 8px;">
              <a href="#/learn" style="color: #455120; text-decoration: none; font-weight: 500;">Danh mục khóa học</a>
              <span style="opacity: 0.6; font-size: 13px;">&rsaquo;</span>
              <span style="font-weight: 700; color: #455120;">${escapeHtml(assignment.title)}</span>
            </div>
          </div>

                    <section class="exam-shell" style="height: auto; max-width: 1420px; width: 100%; margin: 0 auto; padding: 0 24px; display: grid; grid-template-columns: minmax(0, 1fr) 290px; gap: 24px; align-items: start;">
            <!-- Left Main Content Column -->
            <form id="answer-form" style="min-width: 0; width: 100%; display: flex; flex-direction: column; gap: 28px; background: #ffffff; padding: 32px 40px; border-radius: 16px; border: 1px solid #D8E2C4; box-shadow: 0 2px 12px rgba(69, 81, 32, 0.02);">
              
              ${(() => {
                const sections = [];
                let currentSection = null;
                
                questions.forEach((q, index) => {
                  if (!currentSection || currentSection.type !== q.type) {
                    const sIdx = sections.length + 1;
                    const roman = ['I', 'II', 'III', 'IV', 'V'][sIdx - 1] || sIdx;
                    let label = 'Trắc nghiệm';
                    if (q.type === 'tf4') label = 'Đúng/sai';
                    if (q.type === 'short') label = 'Trả lời ngắn';
                    
                    currentSection = {
                      type: q.type,
                      roman: roman,
                      label: label,
                      questions: []
                    };
                    sections.push(currentSection);
                  }
                  currentSection.questions.push({ ...q, globalIndex: index });
                });

                return sections.map(sec => 
                  "<!-- Section Header -->\n" +
                  "<div style=\"display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 4px 16px 4px 4px; background: linear-gradient(90deg, #f0f4e8 0%, rgba(255,255,255,0) 100%); border-radius: 9999px; color: #455120; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 700; font-size: 15px; box-sizing: border-box; width: 100%;\">\n" +
                  "  <span style=\"width: 28px; height: 28px; border-radius: 50%; background: #455120; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif;\">" + sec.roman + "</span>\n" +
                  "  <span>" + sec.label + "</span>\n" +
                  "</div>\n" +
                  sec.questions.map((q, i) => {
                    const cleanPrompt = q.prompt ? q.prompt.replace(/^Câu\\s*\\d+[\\.\\:\\s]*/i, '') : '';
                    const qNumStr = String(i + 1).padStart(2, '0');
                    
                    let qHTML = 
                    "<article class=\"latex-exam-card\" data-question-id=\"" + q.id + "\" data-type=\"" + q.type + "\" style=\"display: flex; flex-direction: column; gap: 14px; padding-bottom: 24px; border-bottom: 1px solid #f1f5f9;\">\n" +
                    "  <div style=\"font-size: 15px; color: #1e293b; line-height: 1.6;\">\n" +
                    "    <span style=\"font-weight: 800; color: #455120; font-size: 17px; font-family: 'Beautique Display', serif; letter-spacing: 0.5px; margin-right: 12px; display: inline-block;\">CÂU " + qNumStr + "</span>\n" +
                    "    <span style=\"font-weight: 500; color: #1e293b; font-size: 15px;\">" + renderLatexText(cleanPrompt) + "</span>\n" +
                    "  </div>\n";

                    if (q.type === 'mcq') {
                      qHTML += 
                      "<div class=\"choice-grid\" style=\"display: flex; flex-direction: column; gap: 10px; padding-left: 2px; margin-top: 4px;\">\n" +
                      (q.choices ?? []).map((choice, cIdx) => {
                        const value = String.fromCharCode(65 + cIdx);
                        const isChecked = answers[q.id] === value;
                        return "" +
                          "<label class=\"latex-choice-tile " + (isChecked ? 'selected' : '') + "\" style=\"display: flex; gap: 10px; align-items: center; cursor: pointer; padding: 2px 0; border: none; background: transparent; transition: all 0.15s ease;\">\n" +
                          "  <input type=\"radio\" name=\"q-" + q.id + "\" value=\"" + value + "\" " + (isChecked ? 'checked' : '') + " style=\"opacity: 0; position: absolute; pointer-events: none;\">\n" +
                          "  <div class=\"latex-radio-circle\" style=\"width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid " + (isChecked ? '#455120' : '#cbd5e1') + "; background: #ffffff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s ease;\">\n" +
                          "    <div class=\"dot\" style=\"width: 8px; height: 8px; border-radius: 50%; background: #455120; display: " + (isChecked ? 'block' : 'none') + ";\"></div>\n" +
                          "  </div>\n" +
                          "  <div style=\"font-size: 14.5px; line-height: 1.5; color: #1e293b; display: flex; align-items: center; gap: 4px;\">\n" +
                          "    <span style=\"font-weight: 800; color: #1e293b;\">" + value + ".</span><span>" + renderLatexText(choice) + "</span>\n" +
                          "  </div>\n" +
                          "</label>\n";
                      }).join('') +
                      "</div>\n";
                    } else if (q.type === 'tf4') {
                      qHTML += 
                      "<div style=\"margin-top: 8px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;\">\n" +
                      "  <table style=\"width: 100%; border-collapse: collapse; font-size: 14px; text-align: left;\">\n" +
                      "    <thead>\n" +
                      "      <tr style=\"background: #f8fafc; border-bottom: 1px solid #e2e8f0;\">\n" +
                      "        <th style=\"padding: 12px 16px; font-weight: 700; color: #1e293b; text-align: left;\">Phát biểu</th>\n" +
                      "        <th style=\"padding: 12px 16px; font-weight: 700; color: #1e293b; width: 60px; text-align: center; border-left: 1px solid #e2e8f0;\">Đúng</th>\n" +
                      "        <th style=\"padding: 12px 16px; font-weight: 700; color: #1e293b; width: 60px; text-align: center; border-left: 1px solid #e2e8f0;\">Sai</th>\n" +
                      "      </tr>\n" +
                      "    </thead>\n" +
                      "    <tbody>\n" +
                      (q.settings?.statements || []).map((stmt, cIdx) => {
                        const currentAns = answers[q.id]?.[cIdx];
                        const isTrueChecked = currentAns === true;
                        const isFalseChecked = currentAns === false;
                        
                        return "" +
                        "<tr style=\"border-bottom: 1px solid #e2e8f0;\">\n" +
                        "  <td style=\"padding: 12px 16px; color: #1e293b; line-height: 1.5;\">" + renderLatexText(stmt) + "</td>\n" +
                        "  <td style=\"padding: 12px 16px; text-align: center; border-left: 1px solid #e2e8f0; vertical-align: middle;\">\n" +
                        "    <label style=\"display: inline-flex; cursor: pointer; position: relative;\">\n" +
                        "      <input type=\"radio\" name=\"q-" + q.id + "-" + cIdx + "\" value=\"true\" " + (isTrueChecked ? 'checked' : '') + " style=\"opacity: 0; position: absolute;\">\n" +
                        "      <div class=\"latex-radio-circle\" style=\"width: 20px; height: 20px; border-radius: 50%; border: 2px solid " + (isTrueChecked ? '#455120' : '#cbd5e1') + "; background: #ffffff; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; margin: 0 auto;\">\n" +
                        "        <div style=\"width: 10px; height: 10px; border-radius: 50%; background: #455120; display: " + (isTrueChecked ? 'block' : 'none') + ";\"></div>\n" +
                        "      </div>\n" +
                        "    </label>\n" +
                        "  </td>\n" +
                        "  <td style=\"padding: 12px 16px; text-align: center; border-left: 1px solid #e2e8f0; vertical-align: middle;\">\n" +
                        "    <label style=\"display: inline-flex; cursor: pointer; position: relative;\">\n" +
                        "      <input type=\"radio\" name=\"q-" + q.id + "-" + cIdx + "\" value=\"false\" " + (isFalseChecked ? 'checked' : '') + " style=\"opacity: 0; position: absolute;\">\n" +
                        "      <div class=\"latex-radio-circle\" style=\"width: 20px; height: 20px; border-radius: 50%; border: 2px solid " + (isFalseChecked ? '#455120' : '#cbd5e1') + "; background: #ffffff; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; margin: 0 auto;\">\n" +
                        "        <div style=\"width: 10px; height: 10px; border-radius: 50%; background: #455120; display: " + (isFalseChecked ? 'block' : 'none') + ";\"></div>\n" +
                        "      </div>\n" +
                        "    </label>\n" +
                        "  </td>\n" +
                        "</tr>\n";
                      }).join('') +
                      "    </tbody>\n" +
                      "  </table>\n" +
                      "</div>\n";
                    } else if (q.type === 'short') {
                      const currentVal = answers[q.id] || '';
                      qHTML += 
                      "<div style=\"margin-top: 12px; display: flex; align-items: center; gap: 12px;\">\n" +
                      "  <span style=\"font-size: 15px; font-weight: 700; color: #1e293b;\">Đáp số:</span>\n" +
                      "  <input type=\"text\" name=\"q-" + q.id + "\" value=\"" + escapeHtml(currentVal) + "\" placeholder=\"Nhập đáp án...\" style=\"width: 160px; height: 36px; padding: 0 12px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 600; color: #0f172a; outline: none; transition: border-color 0.2s;\" onfocus=\"this.style.borderColor='#455120'\" onblur=\"this.style.borderColor='#cbd5e1'\">\n" +
                      "</div>\n";
                    }

                    qHTML += "</article>\n";
                    return qHTML;
                  }).join('')
                ).join('');
              })()}
            </form>

            <!-- Right Sidebar: Navigator -->
            <aside class="exam-navigator" style="position: sticky; top: 88px; display: flex; flex-direction: column; gap: 16px;">
              
              <!-- Progress & Navigator Card -->
              <div style="background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 20px; display: flex; flex-direction: column; gap: 18px; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                
                <!-- Completion Bar -->
                <div>
                  <div style="font-size: 13.5px; color: #334155; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-family: 'Be Vietnam Pro', sans-serif; font-weight: 500; color: #334155;">Bạn đã hoàn thành</span>
                    <span style="color: #455120; font-weight: 700; font-size: 15px; font-family: 'Be Vietnam Pro', sans-serif;" id="completion-count-display">${Object.values(answers).filter(v => v !== null && v !== undefined && v !== '' && (!Array.isArray(v) || v.some(val => val !== null))).length}/${questions.length}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="flex: 1; background: #e2e8f0; height: 10px; border-radius: 999px; overflow: hidden; position: relative;">
                      <div id="completion-progress-bar" style="width: ${Math.round((Object.values(answers).filter(v => v !== null && v !== undefined && v !== '' && (!Array.isArray(v) || v.some(val => val !== null))).length / (questions.length || 1)) * 100)}%; background: #455120; height: 100%; border-radius: 999px; transition: width 0.3s ease;"></div>
                    </div>
                  </div>
                </div>

                <!-- Section Navigator Pill -->
                <div style="display: flex; flex-direction: column; gap: 16px;">
                  ${(() => {
                    const sections = [];
                    let currentSection = null;
                    
                    questions.forEach((q, index) => {
                      if (!currentSection || currentSection.type !== q.type) {
                        const sIdx = sections.length + 1;
                        const roman = ['I', 'II', 'III', 'IV', 'V'][sIdx - 1] || sIdx;
                        let label = 'Trắc nghiệm';
                        if (q.type === 'tf4') label = 'Đúng/sai';
                        if (q.type === 'short') label = 'Trả lời ngắn';
                        
                        currentSection = {
                          type: q.type,
                          roman: roman,
                          label: label,
                          questions: []
                        };
                        sections.push(currentSection);
                      }
                      currentSection.questions.push({ ...q, globalIndex: index });
                    });

                    return sections.map(sec => 
                    "<div style=\"display: flex; flex-direction: column; gap: 12px;\">\n" +
                    "  <div style=\"display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 4px 14px 4px 4px; background: linear-gradient(90deg, #f0f4e8 0%, rgba(255,255,255,0) 100%); border-radius: 9999px; color: #455120; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 700; font-size: 14px; box-sizing: border-box; width: 100%;\">\n" +
                    "    <span style=\"width: 26px; height: 26px; border-radius: 50%; background: #455120; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif;\">" + sec.roman + "</span>\n" +
                    "    <span>" + sec.label + "</span>\n" +
                    "  </div>\n" +
                    "  <div style=\"display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px 10px;\">\n" +
                    sec.questions.map((q, localIdx) => {
                      const ans = answers[q.id];
                      let isAns = false;
                      if (q.type === 'tf4') {
                        isAns = Array.isArray(ans) && ans.some(val => val !== null);
                      } else {
                        isAns = !!ans;
                      }
                      const dispNum = String(localIdx + 1).padStart(2, '0');
                      return "" +
                        "<button type=\"button\" class=\"nav-btn " + (isAns ? 'answered' : '') + "\" data-nav=\"" + q.id + "\" onclick=\"document.querySelector('[data-question-id=\\'" + q.id + "\\']').scrollIntoView({behavior: 'smooth', block: 'center'})\" style=\"width: 40px; height: 40px; border-radius: 50%; border: 1px solid " + (isAns ? '#455120' : '#e2e8f0') + "; background: " + (isAns ? '#455120' : '#ffffff') + "; color: " + (isAns ? '#ffffff' : '#1e293b') + "; cursor: pointer; font-family: 'Be Vietnam Pro', sans-serif; font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center; margin: 0 auto; transition: all 0.15s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.03);\">\n" +
                        "  " + dispNum + "\n" +
                        "</button>\n";
                    }).join('') +
                    "  </div>\n" +
                    "</div>\n"
                    ).join('');
                  })()}
                </div>

                <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 10px;">
                  <p id="autosave-status" class="autosave-status" style="font-size: 12px; text-align: center; color: #64748b; font-weight: 400; margin: 0;">${draft ? 'Đã lưu ' + formatDateTime(draft.savedAt) : 'Tự động lưu khi chọn'}</p>
                  <button type="button" id="trigger-submit-modal-btn" style="width: 100%; height: 42px; background: #455120; color: #ffffff; border: none; border-radius: 9999px; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 500; font-size: 14.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s ease;">
                    Kết thúc
                  </button>
                </div>
              </div>
            </aside>
          </section>

          <!-- Submission Confirmation Modal -->
          <div id="submit-confirm-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(2px); z-index: 9999; align-items: center; justify-content: center;">
            <div style="background: #ffffff; border-radius: 20px; width: 90%; max-width: 400px; padding: 28px 24px; text-align: center; position: relative; box-shadow: 0 10px 25px rgba(0,0,0,0.15); display: flex; flex-direction: column; align-items: center; gap: 16px;">
              <button type="button" id="close-submit-modal-btn" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 20px; color: #94a3b8; cursor: pointer;">&times;</button>
              
              <h3 style="margin: 0; color: #455120; font-family: 'Beautique Display', serif; font-size: 22px; font-weight: 700;">Xác nhận nộp bài</h3>
              
              <!-- Circular Progress Badge -->
              <div style="width: 96px; height: 96px; border-radius: 50%; background: radial-gradient(closest-side, white 79%, transparent 80% 100%), conic-gradient(#455120 calc(var(--modal-pct, 0) * 1%), #e2e8f0 0); display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 8px 0;">
                <span style="font-size: 20px; font-weight: 800; color: #455120; font-family: 'Beautique Display', serif;" id="modal-completion-ratio">0/0</span>
                <span style="font-size: 11px; color: #64748b;">Tổng câu hỏi</span>
              </div>

              <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.5;">Bạn chưa hoàn thành bài thi.<br>Bạn có chắc chắn muốn nộp bài?</p>
              
              <div style="display: flex; gap: 12px; width: 100%; margin-top: 8px;">
                <button type="button" id="modal-continue-btn" style="flex: 1; height: 42px; background: #f0f4e8; color: #455120; border: 1px solid #d8e2ca; border-radius: 9999px; font-weight: 600; font-size: 14px; cursor: pointer;">Làm tiếp</button>
                <button type="button" id="modal-submit-btn" style="flex: 1; height: 42px; background: #455120; color: #ffffff; border: none; border-radius: 9999px; font-weight: 600; font-size: 14px; cursor: pointer;">Nộp bài</button>
              </div>
            </div>
          </div>
        </div>
        <style>
          .latex-exam-card img {
            display: block !important;
            margin: 16px auto !important;
            max-width: 100% !important;
            max-height: 280px !important;
            width: auto !important;
            height: auto !important;
            object-fit: contain !important;
          }
          .latex-choice-tile:hover .latex-radio-circle {
            border-color: #455120 !important;
            box-shadow: 0 0 0 3px rgba(69, 81, 32, 0.12) !important;
          }
          .nav-btn:hover {
            border-color: #455120 !important;
            color: #455120 !important;
          }
          .nav-btn.answered:hover {
            color: #ffffff !important;
            opacity: 0.9;
          }
          @media (max-width: 900px) {
            .exam-shell {
              grid-template-columns: 1fr !important;
            }
            .exam-navigator {
              position: static !important;
              order: -1;
            }
          }
        </style>
      ` : `
        <section class="exam-shell">
          <div class="exam-paper">
            <div class="split-heading">
              <div>
                <p class="eyebrow">Đề bài</p>
                <h2>${escapeHtml(assignment.title)}</h2>
              </div>
              ${draft ? `<span class="status">Đã lưu ${formatDateTime(draft.savedAt)}</span>` : ''}
            </div>
            ${driveFrame(assignment.pdf_url, assignment.title, true)}
          </div>
          <form id="answer-form" class="answer-sheet">
            <div class="split-heading">
              <div>
                <p class="eyebrow">Phiếu trả lời</p>
                <h2>${questions.length} câu</h2>
                <p id="autosave-status" class="autosave-status">${draft ? `Đã khôi phục bản nháp lưu lúc ${formatDateTime(draft.savedAt)}` : 'Tự động lưu khi bạn chọn đáp án.'}</p>
              </div>
              <md-filled-button type="submit" data-submit-assignment>
                <md-icon slot="icon">send</md-icon>
                Nộp bài
              </md-filled-button>
            </div>
            <div class="question-stack">
              ${questions.map((question, index) => renderQuestionInput(question, index, answers[question.id])).join('')}
            </div>
            <div class="sticky-submit-bar">
              <span id="sticky-autosave-status">${draft ? 'Bản nháp đã sẵn sàng' : 'Câu trả lời sẽ được lưu tự động'}</span>
              <md-filled-button type="submit" data-submit-assignment>
                <md-icon slot="icon">send</md-icon>
                Nộp bài
              </md-filled-button>
            </div>
          </form>
        </section>
      `}
    `;
    wireAnswerAutosave(assignment, id, draft);
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

export async function mountAssignmentManagerView(id) {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang tải thống kê bài tập');
  try {
    const [{ assignment, submittedStudents, pendingStudents, stats }] = await Promise.all([
      fetchAssignmentInsights(id),
    ]);
    root.innerHTML = `
      <section class="assignment-insights">
        <div class="panel assignment-insights-hero">
          <div>
            <p class="eyebrow">Bài tập về nhà</p>
            <h2>${escapeHtml(assignment.title)}</h2>
            <p class="muted">${escapeHtml(assignment.lectures?.title ?? 'Bài tập tự do')}</p>
          </div>
          <div class="assignment-score-summary">
            <span>Điểm trung bình</span>
            <strong>${formatScore(stats.averageScore)}/10</strong>
            ${renderScoreProgress(stats.averageScore)}
          </div>
          <div class="insight-actions">
            <md-filled-tonal-button id="edit-assignment-from-insights">
              <md-icon slot="icon">edit</md-icon>
              Sửa đề
            </md-filled-tonal-button>
            <md-outlined-button id="all-assignments-from-insights">
              <md-icon slot="icon">list</md-icon>
              Danh sách đề
            </md-outlined-button>
          </div>
        </div>
        <section class="metric-grid">
          ${renderMetric('Đã làm', `${stats.submittedCount}/${stats.totalStudents}`, 'task_alt')}
          ${renderMetric('Chưa làm', stats.pendingCount, 'pending_actions')}
          ${renderMetric('Điểm TB', formatScore(stats.averageScore), 'monitoring')}
          ${renderMetric('Điểm cao nhất', formatScore(stats.bestScore), 'workspace_premium')}
        </section>
        <section class="manager-grid assignment-insights-grid">
          <div class="panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Đã làm</p>
                <h2>${submittedStudents.length} học sinh</h2>
              </div>
            </div>
            ${renderSubmittedStudents(submittedStudents)}
          </div>
          <div class="panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Chưa làm</p>
                <h2>${pendingStudents.length} học sinh</h2>
              </div>
            </div>
            ${renderPendingStudents(pendingStudents)}
          </div>
        </section>
      </section>
    `;

    document.querySelector('#edit-assignment-from-insights')?.addEventListener('click', async () => {
      try {
        const editor = await fetchAssignmentEditor(id);
        state.assignmentEditor = normalizeAssignmentEditor(editor);
        go('assignments');
      } catch (error) {
        toast(error.message, 'error');
      }
    });
    document.querySelector('#all-assignments-from-insights')?.addEventListener('click', () => go('assignments'));
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

export function renderSubmittedStudents(rows) {
  if (!rows.length) return '<div class="empty-state compact">Chưa có học sinh nộp bài.</div>';
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Học sinh</th>
            <th>Điểm</th>
            <th>Nộp lúc</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              ({ student, attempt }) => `
                <tr>
                  <td>
                    <strong>${escapeHtml(student.full_name || student.email)}</strong>
                    <small>${escapeHtml(student.email)}</small>
                  </td>
                  <td>
                    <div class="score-progress-block">
                      <span>${formatScore(attempt.score_10)}/10</span>
                      ${renderScoreProgress(attempt.score_10)}
                    </div>
                  </td>
                  <td>${formatDateTime(attempt.submitted_at)}</td>
                  <td><a class="text-link" href="#/review/${attempt.id}">Chi tiết</a></td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}



export function renderPendingStudents(rows) {
  if (!rows.length) return '<div class="empty-state compact">Tất cả học sinh đã nộp bài.</div>';
  return `
    <div class="student-status-list">
      ${rows
        .map(
          (student) => `
            <article class="student-status-row">
              <span class="account-avatar" aria-hidden="true">${escapeHtml(accountInitial(student))}</span>
              <div>
                <strong>${escapeHtml(student.full_name || student.email)}</strong>
                <small>${escapeHtml(student.email)}</small>
              </div>
              <span class="status">Chưa làm</span>
            </article>
          `,
        )
        .join('')}
    </div>
  `;
}

export function relationOne(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function renderQuestionInput(question, index, answer) {
  const choices = ['A', 'B', 'C', 'D'];
  const settings = question.settings ?? {};
  const displayPrompt = question.prompt && question.prompt !== `Câu ${index + 1}`;
  const prompt = `
    <div class="question-prompt">
      <span>Câu ${index + 1}</span>
      ${displayPrompt ? `<p>${renderLatexText(question.prompt)}</p>` : ''}
    </div>
  `;

  if (question.type === 'mcq') {
    return `
      <article class="question-card" data-question-id="${question.id}" data-type="mcq">
        ${prompt}
        <div class="choice-grid">
          ${choices
            .map(
              (choice, choiceIndex) => {
                const value = String.fromCharCode(65 + choiceIndex);
                return `
                  <label class="choice-tile">
                    <input type="radio" name="q-${question.id}" value="${value}" ${answer === value ? 'checked' : ''}>
                    <span>${renderLatexText(choice)}</span>
                  </label>
                `;
              },
            )
            .join('')}
        </div>
      </article>
    `;
  }

  if (question.type === 'tf4') {
    const statements = settings.statements ?? ['Ý 1', 'Ý 2', 'Ý 3', 'Ý 4'];
    const saved = Array.isArray(answer) ? answer : [];
    return `
      <article class="question-card" data-question-id="${question.id}" data-type="tf4">
        ${prompt}
        <div class="tf-table">
          ${statements
            .map(
              (statement, itemIndex) => `
                <div class="tf-row">
                  <span>${escapeHtml(statement)}</span>
                  <label><input type="radio" name="q-${question.id}-${itemIndex}" value="true" ${saved[itemIndex] === true ? 'checked' : ''}> Đúng</label>
                  <label><input type="radio" name="q-${question.id}-${itemIndex}" value="false" ${saved[itemIndex] === false ? 'checked' : ''}> Sai</label>
                </div>
              `,
            )
            .join('')}
        </div>
      </article>
    `;
  }

  return `
    <article class="question-card" data-question-id="${question.id}" data-type="short">
      ${prompt}
      <input class="field" type="text" name="q-${question.id}" value="${escapeHtml(answer ?? '')}" autocomplete="off">
    </article>
  `;
}

export function collectAnswers() {
  const answers = {};
  document.querySelectorAll('.question-card, .latex-exam-card').forEach((card) => {
    answers[card.dataset.questionId] = collectAnswerFromCard(card);
  });
  return answers;
}

export function collectAnswerFromCard(card) {
  const id = card.dataset.questionId;
  const type = card.dataset.type;
  if (type === 'mcq') {
    return card.querySelector(`input[name="q-${id}"]:checked`)?.value ?? '';
  }
  if (type === 'tf4') {
    return Array.from({ length: 4 }, (_, index) => {
      const value = card.querySelector(`input[name="q-${id}-${index}"]:checked`)?.value;
      if (value === undefined) return null;
      return value === 'true';
    });
  }
  return card.querySelector(`input[name="q-${id}"]`)?.value ?? '';
}

export function wireAnswerAutosave(assignment, assignmentId, draft) {
  const form = document.querySelector('#answer-form');
  
  if (assignment.pdf_url === 'latex' && window.MathJax) {
    window.MathJax.typesetPromise();
  }

  const autosaveStatus = document.querySelector('#autosave-status');
  const stickyAutosaveStatus = document.querySelector('#sticky-autosave-status');
  let autosaveTimer;
  let draftAnswers = collectAnswers();
  let timeSpent = draft?.timeSpent ?? {};
  
  // Time tracking logic
  let activeQuestionId = null;
  let timeTrackingInterval = null;

  const startTracking = () => {
    if (timeTrackingInterval) clearInterval(timeTrackingInterval);
    timeTrackingInterval = setInterval(() => {
      if (activeQuestionId && document.visibilityState === 'visible') {
        timeSpent[activeQuestionId] = (timeSpent[activeQuestionId] || 0) + 1000;
      }
    }, 1000);
  };
  startTracking();

  const observer = new IntersectionObserver((entries) => {
    // Find the most visible question
    let maxRatio = 0;
    let mostVisibleId = null;
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
        maxRatio = entry.intersectionRatio;
        mostVisibleId = entry.target.dataset.questionId;
      }
    });
    if (mostVisibleId) {
      activeQuestionId = mostVisibleId;
    }
  }, { threshold: [0.1, 0.5, 0.9] });

  const cards = document.querySelectorAll('.latex-exam-card, .question-card');
  cards.forEach(card => observer.observe(card));

  const updateNavButtons = () => {
    document.querySelectorAll('.nav-btn[data-nav]').forEach(btn => {
      const qId = btn.dataset.nav;
      const ans = draftAnswers[qId];
      let isAnswered = false;
      if (Array.isArray(ans)) {
        isAnswered = ans.some(val => val !== null && val !== undefined);
      } else {
        isAnswered = ans !== null && ans !== undefined && String(ans).trim() !== '';
      }
      if (isAnswered) {
        btn.classList.add('answered');
        btn.style.background = '#455120';
        btn.style.color = '#ffffff';
        btn.style.borderColor = '#455120';
      } else {
        btn.classList.remove('answered');
        btn.style.background = '#ffffff';
        btn.style.color = '#1e293b';
        btn.style.borderColor = '#e2e8f0';
      }
    });
  };

  // Sync nav buttons state initially
  updateNavButtons();

  const setAutosaveStatus = (message) => {
    if (autosaveStatus) autosaveStatus.textContent = message;
    if (stickyAutosaveStatus) stickyAutosaveStatus.textContent = message;
  };

  const persist = (event) => {
    const card = event.target?.closest?.('.question-card') || event.target?.closest?.('.latex-exam-card');
    if (card?.dataset?.questionId) {
      draftAnswers[card.dataset.questionId] = collectAnswerFromCard(card);
    } else {
      draftAnswers = collectAnswers();
    }

    if (assignment.pdf_url === 'latex') {
      if (event.target?.type === 'radio') {
        const examCard = event.target.closest('.latex-exam-card');
        if (examCard) {
          const labels = examCard.querySelectorAll('label');
          labels.forEach(lbl => {
            const radio = lbl.querySelector('input[type="radio"]');
            const circle = lbl.querySelector('.latex-radio-circle');
            const dot = circle ? circle.querySelector('div') : null;
            if (radio && circle && dot) {
              if (radio.checked) {
                lbl.classList.add('selected');
                circle.style.borderColor = '#455120';
                dot.style.display = 'block';
              } else {
                lbl.classList.remove('selected');
                circle.style.borderColor = '#cbd5e1';
                dot.style.display = 'none';
              }
            }
          });
        }
      }
    }

    // Immediately update preview palette buttons
    updateNavButtons();

    // Update progress stats in navigator
    const answeredCount = Object.keys(draftAnswers).filter(k => {
      const ans = draftAnswers[k];
      return ans !== null && ans !== undefined && ans !== '' && (!Array.isArray(ans) || ans.some(val => val !== null));
    }).length;
    const totalCount = document.querySelectorAll('.latex-exam-card').length || 1;
    const countDisplay = document.querySelector('#completion-count-display');
    const progressBar = document.querySelector('#completion-progress-bar');
    if (countDisplay) countDisplay.textContent = `${answeredCount}/${totalCount}`;
    if (progressBar) progressBar.style.width = `${Math.round((answeredCount / totalCount) * 100)}%`;
    setAutosaveStatus('Đang lưu bản nháp...');
    window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => {
      saveDraft(localStorage, state.profile.id, assignmentId, draftAnswers, timeSpent);
      setAutosaveStatus(`Đã lưu bản nháp lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`);
    }, 250);
  };
  
  // Also save periodically even without clicks to save timeSpent
  setInterval(() => {
    saveDraft(localStorage, state.profile.id, assignmentId, draftAnswers, timeSpent);
  }, 10000);

  // Wire Modal Confirmation logic
  const modal = document.querySelector('#submit-confirm-modal');
  const triggerModalBtn = document.querySelector('#trigger-submit-modal-btn');
  const closeModalBtn = document.querySelector('#close-submit-modal-btn');
  const modalContinueBtn = document.querySelector('#modal-continue-btn');
  const modalSubmitBtn = document.querySelector('#modal-submit-btn');

  if (triggerModalBtn && modal) {
    triggerModalBtn.addEventListener('click', () => {
      const answeredCount = Object.keys(draftAnswers).filter(k => draftAnswers[k]).length;
      const totalCount = document.querySelectorAll('.latex-exam-card').length || 1;
      const modalRatio = document.querySelector('#modal-completion-ratio');
      if (modalRatio) modalRatio.textContent = `${answeredCount}/${totalCount}`;
      const pct = Math.round((answeredCount / totalCount) * 100);
      modal.style.setProperty('--modal-pct', pct);
      modal.style.display = 'flex';
    });
  }

  if (closeModalBtn && modal) closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
  if (modalContinueBtn && modal) modalContinueBtn.addEventListener('click', () => modal.style.display = 'none');
  if (modalSubmitBtn && modal) {
    modalSubmitBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      form.requestSubmit();
    });
  }

  form.addEventListener('input', persist);
  form.addEventListener('change', persist);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (timeTrackingInterval) clearInterval(timeTrackingInterval);
    const buttons = Array.from(form.querySelectorAll('[data-submit-assignment]'));
    const button = buttons[0];
    buttons.forEach((item) => {
      item.disabled = true;
    });
    const restore = setButtonLoading(button, 'Đang nộp...');
    try {
      const submitted = await submitAssignmentAttempt({
        assignmentId,
        answers: collectAnswers(),
        timeSpent,
      });
      clearDraft(localStorage, state.profile.id, assignmentId);
      toast('Đã nộp bài và chấm điểm.', 'success');
      go(`review/${submitted.id}`);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      restore();
      buttons.forEach((item) => {
        item.disabled = false;
      });
    }
  });
}

export async function mountReview(id) {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang tải bài làm');
  try {
    const review = await fetchAttemptReview(id);
    const items = review.items ?? [];
    
    // Fetch full questions to get choices and settings (explanation)
    let questions = [];
    if (review.assignment?.id) {
      const assignmentData = await fetchAssignmentForStudent(review.assignment.id);
      questions = assignmentData.questions || [];
    }
    
    // Map items with questions
    const itemsWithQuestions = items.map(item => {
      const q = questions.find(q => q.id === item.question_id);
      return { ...item, choices: q?.choices, settings: q?.settings, type: q?.type, qId: q?.id };
    });
    
    // Fetch student info
    let studentName = 'Học sinh';
    if (review.attempt?.student_id) {
      const { data: userData } = await supabase.from('profiles').select('full_name, email').eq('id', review.attempt.student_id).single();
      if (userData) studentName = userData.full_name || userData.email;
    }
    
    const startedAt = review.attempt?.started_at ? new Date(review.attempt.started_at) : null;
    const completedAt = review.attempt?.submitted_at ? new Date(review.attempt.submitted_at) : null;
    
    let durationStr = '-';
    // Calculate from per-question time_spent_ms if available, otherwise fallback to start/end time
    const totalTimeSpentMs = itemsWithQuestions.reduce((sum, item) => sum + (item.time_spent_ms || 0), 0);
    if (totalTimeSpentMs > 0) {
      const m = Math.floor(totalTimeSpentMs / 60000);
      const s = Math.floor((totalTimeSpentMs % 60000) / 1000);
      durationStr = `${m}p ${s}s`;
    } else if (startedAt && completedAt) {
      const ms = completedAt - startedAt;
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      durationStr = `${m}p ${s}s`;
    }
    
    if (review.assignment?.pdf_url === 'latex') {
      const score10 = review.attempt?.score_10 ?? 0;
      root.innerHTML = `
        <div style="background-color: #ebf1eb; min-height: 100vh; padding: 0 0 60px 0; margin: 0; font-family: 'Be Vietnam Pro', sans-serif;">
          <!-- Top Breadcrumb Bar -->
          <div style="background: #e2e8f0; color: #455120; border-bottom: 1px solid #cbd5e1; padding: 12px 0; margin-bottom: 24px;">
            <div style="max-width: 1420px; width: 100%; margin: 0 auto; padding: 0 40px; font-size: 13.5px; font-weight: 500; display: flex; align-items: center; gap: 8px;">
              <a href="#/learn" style="color: #455120; text-decoration: none; font-weight: 500;">Danh mục khóa học</a>
              <span style="opacity: 0.6; font-size: 13px;">&rsaquo;</span>
              <span style="font-weight: 700; color: #455120;">Kết quả làm bài - ${escapeHtml(review.assignment?.title ?? 'Đề bài')}</span>
            </div>
          </div>

          <section class="exam-shell" style="height: auto; max-width: 1420px; width: 100%; margin: 0 auto; padding: 0 24px; display: grid; grid-template-columns: minmax(0, 1fr) 290px; gap: 24px; align-items: start;">
            <!-- Left Main Content Column -->
            <div style="min-width: 0; width: 100%; display: flex; flex-direction: column; gap: 24px;">
              
              <!-- Clean 1-Card Stats Block (Score, Questions, Time) -->
              <div style="background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px 36px; display: flex; align-items: center; gap: 48px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);">
                
                <!-- Score Circle -->
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; flex-shrink: 0;">
                  <div style="position: relative; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center;">
                    <svg viewBox="0 0 36 36" style="position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg);">
                      <path stroke="#e2e8f0" stroke-width="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path stroke="#455120" stroke-width="3" stroke-dasharray="${score10 * 10}, 100" stroke-linecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1;">
                      <span style="font-family: 'Beautique Display', serif; font-size: 13px; font-weight: 700; color: #667085; margin-bottom: 2px;">Điểm của em</span>
                      <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 44px; font-weight: 800; color: #455120; line-height: 1;">${formatScore(score10)}</span>
                    </div>
                  </div>
                </div>

                <!-- Vertical Divider -->
                <div style="width: 1px; height: 80px; background: #E5ECD9; flex-shrink: 0;"></div>

                <!-- Stats Right: Số câu hỏi & Thời gian làm bài -->
                <div style="display: flex; gap: 48px; flex: 1;">
                  <!-- Số câu hỏi -->
                  <div style="display: flex; flex-direction: column; gap: 8px;">
                    <span style="font-family: 'Beautique Display', serif; font-size: 15px; font-weight: 700; color: #475467;">Số câu hỏi</span>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #455120; opacity: 0.85;"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 18px; font-weight: 600; color: #101828; line-height: 1; display: inline-block; transform: translateY(1px);">${items.length}</span>
                    </div>
                  </div>

                  <!-- Thời gian làm bài -->
                  <div style="display: flex; flex-direction: column; gap: 8px;">
                    <span style="font-family: 'Beautique Display', serif; font-size: 15px; font-weight: 700; color: #475467;">Thời gian làm bài</span>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #455120; opacity: 0.85;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 17px; font-weight: 600; color: #101828; line-height: 1; display: inline-block; transform: translateY(1px);">${durationStr}</span>
                    </div>
                  </div>
                </div>

              </div>
            
            <div class="latex-review-list" style="display: flex; flex-direction: column; gap: 28px; background: #ffffff; padding: 32px 40px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 2px 12px rgba(0,0,0,0.02);">

            ${(() => {
              const sections = [];
              let currentSection = null;
              
              itemsWithQuestions.forEach((item, index) => {
                if (!currentSection || currentSection.type !== item.type) {
                  const sIdx = sections.length + 1;
                  const roman = ['I', 'II', 'III', 'IV', 'V'][sIdx - 1] || sIdx;
                  let label = 'Trắc nghiệm';
                  if (item.type === 'tf4') label = 'Đúng/sai';
                  if (item.type === 'short') label = 'Trả lời ngắn';
                  
                  currentSection = {
                    type: item.type,
                    roman: roman,
                    label: label,
                    items: []
                  };
                  sections.push(currentSection);
                }
                currentSection.items.push({ ...item, globalIndex: index });
              });

              return sections.map(sec => 
                "<!-- Section Header -->\n" +
                "<div style=\"display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 4px 16px 4px 4px; background: #f0f4e8; border: 1px solid #d8e2ca; border-radius: 9999px; color: #455120; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 700; font-size: 15px; box-sizing: border-box; width: 100%;\">\n" +
                "  <span style=\"width: 28px; height: 28px; border-radius: 50%; background: #455120; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif;\">" + sec.roman + "</span>\n" +
                "  <span>" + sec.label + "</span>\n" +
                "</div>\n" +
                sec.items.map((item, localIdx) => {
                  const index = item.globalIndex;
                  const hasAns = item.answer !== null && item.answer !== undefined && String(item.answer).trim() !== '';
                  const isCorrect = item.is_correct;
                  const chosenAnswer = formatAnswer(item.answer);
                  const correctAnswer = formatAnswer(item.correct_answer ?? item.accepted_answers);
                  const cleanPrompt = item.prompt ? item.prompt.replace(/^Câu\\s*\\d+[\\.\\:\\s]*/i, '') : '';
                  const qNumStr = String(localIdx + 1).padStart(2, '0');

                  let badgeHtml = '';
                  if (!hasAns) {
                    badgeHtml = `<span style="background: #f1f5f9; color: #475467; border: 1px solid #cbd5e1; padding: 4px 12px; border-radius: 9999px; font-size: 12.5px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif;">Chưa trả lời</span>`;
                  } else if (isCorrect) {
                    badgeHtml = `<span style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; padding: 4px 12px; border-radius: 9999px; font-size: 12.5px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif;">Đúng</span>`;
                  } else {
                    badgeHtml = `<span style="background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; padding: 4px 12px; border-radius: 9999px; font-size: 12.5px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif;">Sai</span>`;
                  }

                  let qHTML = 
                  "<article id=\"latex-review-q" + index + "\" class=\"latex-exam-card\" style=\"display: flex; flex-direction: column; gap: 14px; padding-bottom: 28px; border-bottom: 1px solid #f1f5f9;\">\n" +
                  "  <div style=\"display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;\">\n" +
                  "    <div style=\"font-size: 15px; color: #1e293b; line-height: 1.6; flex: 1;\">\n" +
                  "      <span style=\"font-weight: 900; color: #455120; font-size: 17px; font-family: 'Beautique Display', serif; letter-spacing: 0.5px; margin-right: 12px; display: inline-block;\">CÂU " + qNumStr + "</span>\n" +
                  "      <span style=\"font-weight: 500; color: #1e293b; font-size: 15px;\">" + renderLatexText(cleanPrompt) + "</span>\n" +
                  "    </div>\n" +
                  "    <div style=\"flex-shrink: 0;\">" + badgeHtml + "</div>\n" +
                  "  </div>\n";

                  if (item.type === 'mcq') {
                    qHTML += 
                    "<div class=\"choice-grid\" style=\"display: flex; flex-direction: column; gap: 8px; padding-left: 2px; margin-top: 4px;\">\n" +
                    (item.choices ?? []).map((choice, cIdx) => {
                      const letter = String.fromCharCode(65 + cIdx);
                      const isChosen = chosenAnswer === letter;
                      const isCorrectChoice = correctAnswer === letter;
                      
                      let wrapperBg = '#ffffff';
                      let wrapperBorder = 'transparent';
                      let circleBorder = '#cbd5e1';
                      let circleBg = '#ffffff';
                      let dotDisplay = 'none';
                      let dotColor = '#455120';
                      let tag = '';

                      if (isChosen && isCorrectChoice) {
                        wrapperBg = '#f0fdf4';
                        wrapperBorder = '#bbf7d0';
                        circleBorder = '#166534';
                        circleBg = '#ffffff';
                        dotDisplay = 'block';
                        dotColor = '#166534';
                        tag = `<span style="background: #166534; color: #ffffff; padding: 2px 8px; border-radius: 6px; font-size: 11.5px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif; margin-left: auto; flex-shrink: 0;">Bạn chọn (Đúng)</span>`;
                      } else if (isChosen && !isCorrectChoice) {
                        wrapperBg = '#fef2f2';
                        wrapperBorder = '#fecaca';
                        circleBorder = '#dc2626';
                        circleBg = '#ffffff';
                        dotDisplay = 'block';
                        dotColor = '#dc2626';
                        tag = `<span style="background: #dc2626; color: #ffffff; padding: 2px 8px; border-radius: 6px; font-size: 11.5px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif; margin-left: auto; flex-shrink: 0;">Bạn chọn (Sai)</span>`;
                      } else if (isCorrectChoice) {
                        wrapperBg = '#f0fdf4';
                        wrapperBorder = '#bbf7d0';
                        circleBorder = '#166534';
                        circleBg = '#ffffff';
                        tag = `<span style="background: #455120; color: #ffffff; padding: 2px 8px; border-radius: 6px; font-size: 11.5px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif; margin-left: auto; flex-shrink: 0;">Đáp án đúng</span>`;
                      }

                      return "" +
                        "<div style=\"display: flex; gap: 10px; align-items: center; padding: 8px 12px; border-radius: 8px; background: " + wrapperBg + "; border: 1px solid " + wrapperBorder + "; transition: all 0.15s ease;\">\n" +
                        "  <div class=\"latex-radio-circle\" style=\"width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid " + circleBorder + "; background: " + circleBg + "; display: flex; align-items: center; justify-content: center; flex-shrink: 0;\">\n" +
                        "    <div class=\"dot\" style=\"width: 8px; height: 8px; border-radius: 50%; background: " + dotColor + "; display: " + dotDisplay + ";\"></div>\n" +
                        "  </div>\n" +
                        "  <div style=\"font-size: 14.5px; line-height: 1.5; color: #1e293b; display: flex; align-items: center; gap: 4px; flex: 1;\">\n" +
                        "    <span style=\"font-weight: 800; color: #1e293b;\">" + letter + ".</span><span>" + renderLatexText(choice) + "</span>\n" +
                        "  </div>\n" +
                        "  " + tag + "\n" +
                        "</div>\n";
                    }).join('') +
                    "</div>\n" +
                    "<div style=\"margin-top: 14px;\">\n" +
                    "  <div style=\"font-size: 16px; font-weight: 900; color: #455120; font-family: 'Beautique Display', serif; margin-bottom: 6px;\">Đáp án</div>\n" +
                    "  <div style=\"font-size: 14.5px; font-weight: 700; color: #1e293b; line-height: 1.6;\">\n" +
                    "    " + correctAnswer + ". " + (item.choices && item.choices[correctAnswer.charCodeAt(0) - 65] ? renderLatexText(item.choices[correctAnswer.charCodeAt(0) - 65]) : '') + "\n" +
                    "  </div>\n" +
                    "</div>\n";
                  } else if (item.type === 'tf4') {
                    qHTML += 
                    "<div style=\"margin-top: 8px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;\">\n" +
                    "  <table style=\"width: 100%; border-collapse: collapse; font-size: 14px; text-align: left;\">\n" +
                    "    <thead>\n" +
                    "      <tr style=\"background: #f8fafc; border-bottom: 1px solid #e2e8f0;\">\n" +
                    "        <th style=\"padding: 12px 16px; font-weight: 700; color: #1e293b; text-align: left;\">Phát biểu</th>\n" +
                    "        <th style=\"padding: 12px 16px; font-weight: 700; color: #1e293b; width: 90px; text-align: center; border-left: 1px solid #e2e8f0;\">Đúng</th>\n" +
                    "        <th style=\"padding: 12px 16px; font-weight: 700; color: #1e293b; width: 90px; text-align: center; border-left: 1px solid #e2e8f0;\">Sai</th>\n" +
                    "      </tr>\n" +
                    "    </thead>\n" +
                    "    <tbody>\n" +
                    (item.settings?.statements || []).map((stmt, cIdx) => {
                      const userAns = Array.isArray(item.answer) ? item.answer[cIdx] : null;
                      const correctAns = Array.isArray(item.correct_answer) ? item.correct_answer[cIdx] : null;
                      const isCorrectRow = userAns === correctAns;
                      const bg = userAns !== null ? (isCorrectRow ? '#f0fdf4' : '#fef2f2') : '#ffffff';
                      
                      const renderCircle = (val) => {
                        const isChosen = userAns === val;
                        const isCorrectTarget = correctAns === val;
                        
                        let circleBorder = '#cbd5e1';
                        let dotDisplay = 'none';
                        let dotColor = '#455120';
                        let checkIcon = '';

                        if (isChosen) {
                          circleBorder = isCorrectRow ? '#166534' : '#dc2626';
                          dotDisplay = 'block';
                          dotColor = isCorrectRow ? '#166534' : '#dc2626';
                        }
                        
                        if (isCorrectTarget && !isChosen) {
                          checkIcon = `<div style="position: absolute; width: 10px; height: 10px; border-radius: 50%; background: #455120;"></div>`;
                          circleBorder = '#455120';
                        }

                        return "" +
                        "<div style=\"width: 20px; height: 20px; border-radius: 50%; border: 2px solid " + circleBorder + "; background: #ffffff; display: flex; align-items: center; justify-content: center; position: relative; margin: 0 auto;\">\n" +
                        "  <div style=\"width: 10px; height: 10px; border-radius: 50%; background: " + dotColor + "; display: " + dotDisplay + ";\"></div>\n" +
                        "  " + checkIcon + "\n" +
                        "</div>\n";
                      };

                      return "" +
                      "<tr style=\"border-bottom: 1px solid #e2e8f0; background: " + bg + ";\">\n" +
                      "  <td style=\"padding: 12px 16px; color: #1e293b; line-height: 1.5;\">" + renderLatexText(stmt) + "</td>\n" +
                      "  <td style=\"padding: 12px 16px; text-align: center; border-left: 1px solid #e2e8f0; vertical-align: middle;\">\n" +
                      "    " + renderCircle(true) + "\n" +
                      "  </td>\n" +
                      "  <td style=\"padding: 12px 16px; text-align: center; border-left: 1px solid #e2e8f0; vertical-align: middle;\">\n" +
                      "    " + renderCircle(false) + "\n" +
                      "  </td>\n" +
                      "</tr>\n";
                    }).join('') +
                    "    </tbody>\n" +
                    "  </table>\n" +
                    "</div>\n";
                  } else if (item.type === 'short') {
                    qHTML += 
                    "<div style=\"margin-top: 12px; display: flex; align-items: center; gap: 12px;\">\n" +
                    "  <span style=\"font-size: 15px; font-weight: 700; color: #1e293b;\">Bạn trả lời:</span>\n" +
                    "  <div style=\"height: 36px; padding: 0 16px; border-radius: 8px; border: 1px solid " + (isCorrect ? '#bbf7d0' : '#fecaca') + "; background: " + (isCorrect ? '#f0fdf4' : '#fef2f2') + "; font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 600; color: " + (isCorrect ? '#166534' : '#991b1b') + "; display: flex; align-items: center;\">\n" +
                    "    " + escapeHtml(item.answer || '') + "\n" +
                    "  </div>\n" +
                    "</div>\n" +
                    "<div style=\"margin-top: 12px; display: flex; align-items: center; gap: 12px;\">\n" +
                    "  <span style=\"font-size: 15px; font-weight: 700; color: #1e293b;\">Đáp án đúng:</span>\n" +
                    "  <div style=\"height: 36px; padding: 0 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 600; color: #0f172a; display: flex; align-items: center;\">\n" +
                    "    " + escapeHtml(item.correct_answer ?? item.accepted_answers ?? '') + "\n" +
                    "  </div>\n" +
                    "</div>\n";
                  }

                  qHTML += 
                  "<div style=\"margin-top: 18px;\">\n" +
                  "  <div style=\"font-size: 16px; font-weight: 900; color: #455120; font-family: 'Beautique Display', serif; margin-bottom: 8px;\">Hướng dẫn giải chi tiết</div>\n" +
                  "  <div style=\"font-size: 14.5px; line-height: 2.2; color: #334155;\">\n" +
                  "    " + (item.settings?.explanation ? renderLatexText(item.settings.explanation) : '<i style=\"color: #94a3b8;\">Chưa có lời giải chi tiết cho câu hỏi này.</i>') + "\n" +
                  "  </div>\n" +
                  "</div>\n" +
                  "</article>\n";

                  return qHTML;
                }).join('')
              ).join('');
            })()}
            </div>
            </div>
            
            <aside class="exam-navigator" style="position: sticky; top: 88px; display: flex; flex-direction: column; gap: 16px;">
              <div style="background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 20px; display: flex; flex-direction: column; gap: 18px; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px;">
                  <span style="font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px; font-weight: 700; color: #1e293b;">Bạn trả lời đúng</span>
                  <span style="font-size: 16px; font-weight: 800; color: #455120; font-family: 'Be Vietnam Pro', sans-serif;">${items.filter(i => (i.answer !== null && i.answer !== undefined && String(i.answer).trim() !== '') && i.is_correct).length}/${items.length}</span>
                </div>
          
          <div style="display: flex; flex-direction: column; gap: 16px;">
            ${(() => {
              const sections = [];
              let currentSection = null;
              
              itemsWithQuestions.forEach((item, index) => {
                if (!currentSection || currentSection.type !== item.type) {
                  const sIdx = sections.length + 1;
                  const roman = ['I', 'II', 'III', 'IV', 'V'][sIdx - 1] || sIdx;
                  let label = 'Trắc nghiệm';
                  if (item.type === 'tf4') label = 'Đúng/sai';
                  if (item.type === 'short') label = 'Trả lời ngắn';
                  
                  currentSection = {
                    type: item.type,
                    roman: roman,
                    label: label,
                    items: []
                  };
                  sections.push(currentSection);
                }
                currentSection.items.push({ ...item, globalIndex: index });
              });

              return sections.map(sec => 
              "<div style=\"display: flex; flex-direction: column; gap: 12px;\">\n" +
              "  <div style=\"display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 4px 14px 4px 4px; background: #f0f4e8; border: 1px solid #d8e2ca; border-radius: 9999px; color: #455120; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 700; font-size: 14px; width: 100%; box-sizing: border-box;\">\n" +
              "    <span style=\"width: 26px; height: 26px; border-radius: 50%; background: #455120; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; font-family: 'Be Vietnam Pro', sans-serif;\">" + sec.roman + "</span>\n" +
              "    <span>" + sec.label + "</span>\n" +
              "  </div>\n" +
              "  <div style=\"display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px 10px;\">\n" +
              sec.items.map((i, localIdx) => {
                const idx = i.globalIndex;
                const hasAns = i.answer !== null && i.answer !== undefined && String(i.answer).trim() !== '';
                let bg = '#ffffff';
                let border = '#cbd5e1';
                let color = '#475467';

                if (!hasAns) {
                  bg = '#f1f5f9';
                  border = '#cbd5e1';
                  color = '#475467';
                } else if (i.is_correct) {
                  bg = '#455120';
                  border = '#455120';
                  color = '#ffffff';
                } else {
                  bg = '#c62828';
                  border = '#c62828';
                  color = '#ffffff';
                }
                const dispNum = String(localIdx + 1).padStart(2, '0');
                return "" +
                  "<button type=\"button\" onclick=\"document.getElementById('latex-review-q" + idx + "').scrollIntoView({behavior: 'smooth', block: 'center'})\" style=\"width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: " + bg + "; color: " + color + "; font-weight: 700; font-size: 13px; border: 1px solid " + border + "; cursor: pointer; transition: all 0.15s ease; font-family: 'Be Vietnam Pro', sans-serif; margin: 0 auto; box-shadow: 0 1px 3px rgba(0,0,0,0.02);\">\n" +
                  "  " + dispNum + "\n" +
                  "</button>\n";
              }).join('') +
              "  </div>\n" +
              "</div>\n"
              ).join('');
            })()}
          </div>
          
          <div style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 24px; height: 24px; border-radius: 50%; background: #f1f5f9; color: #475467; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; font-family: 'Be Vietnam Pro', sans-serif;">${items.filter(i => i.answer === null || i.answer === undefined || String(i.answer).trim() === '').length}</div>
              <span style="font-size: 13.5px; color: #475467; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 500;">Câu chưa trả lời</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 24px; height: 24px; border-radius: 50%; background: #455120; color: #ffffff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; font-family: 'Be Vietnam Pro', sans-serif;">${items.filter(i => (i.answer !== null && i.answer !== undefined && String(i.answer).trim() !== '') && i.is_correct).length}</div>
              <span style="font-size: 13.5px; color: #475467; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 500;">Câu trả lời đúng</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 24px; height: 24px; border-radius: 50%; background: #c62828; color: #ffffff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; font-family: 'Be Vietnam Pro', sans-serif;">${items.filter(i => (i.answer !== null && i.answer !== undefined && String(i.answer).trim() !== '') && !i.is_correct).length}</div>
              <span style="font-size: 13.5px; color: #475467; font-family: 'Be Vietnam Pro', sans-serif; font-weight: 500;">Câu trả lời sai</span>
            </div>
          </div>
        </div>
        </aside>
        </section>
        </div>
        <style>
          .latex-exam-card img {
            display: block !important;
            margin: 16px auto !important;
            max-width: 100% !important;
            max-height: 280px !important;
            width: auto !important;
            height: auto !important;
            object-fit: contain !important;
          }
          details summary::-webkit-details-marker { display: none; }
          details[open] summary .expand-icon { transform: rotate(180deg); }
          .expand-icon { transition: transform 0.2s ease; }
          .latex-question-review details { transition: all 0.2s ease; }
          .latex-question-review details[open] { background: #f8fafc; }
        </style>
      `;
    } else {
      root.innerHTML = `
        <section class="exam-shell">
          <div class="exam-paper">
            <div class="split-heading">
              <div>
                <p class="eyebrow">Đề bài</p>
                <h2>${escapeHtml(review.assignment?.title ?? 'Bài làm')}</h2>
              </div>
            </div>
            ${state.profile.role === 'student' && review.assignment?.pdf_url && review.assignment?.pdf_url !== 'latex' ? `
              <div class="panel" style="padding: 48px 24px; text-align: center; color: #667085; background: #ffffff; border-radius: 16px; border: 1px solid #E5ECD9; margin-top: 12px;">
                <md-icon style="font-size: 48px; color: #98A2B3; margin-bottom: 12px;">lock</md-icon>
                <h3 style="font-family: 'Beautique Display', serif; font-size: 18px; color: #455120; margin: 0 0 8px 0;">Đề bài PDF đã khóa truy cập</h3>
                <p style="margin: 0; font-size: 14px; color: #667085; font-family: 'Be Vietnam Pro', sans-serif;">Tài liệu đề bài PDF đã đóng. Bạn vẫn có thể xem lại đáp án và kết quả chấm điểm ở cột bên phải.</p>
              </div>
            ` : driveFrame(review.assignment?.pdf_url, review.assignment?.title ?? 'Đề bài', true)}
          </div>
          <div class="answer-sheet">
            <div class="split-heading">
              <div>
                <p class="eyebrow">Kết quả</p>
                <h2>${items.length} câu</h2>
              </div>
              <div class="review-heading-actions">
                ${isManager() ? `
                  <md-outlined-button id="regrade-review-button" type="button">
                    <md-icon slot="icon">refresh</md-icon>
                    Chấm lại
                  </md-outlined-button>
                ` : ''}
                <div class="score-badge">${formatScore(review.attempt?.score_10)}/10</div>
              </div>
            </div>
            <div class="review-list">
              ${itemsWithQuestions
                .map(
                (item, index) => `
                  <article class="review-item ${item.is_correct ? 'correct' : 'wrong'}">
                    <div>
                      <p class="eyebrow">Câu ${index + 1}</p>
                      ${item.prompt && item.prompt !== `Câu ${index + 1}` && review.assignment?.pdf_url !== 'latex' ? `<h3>${renderLatexText(item.prompt)}</h3>` : ''}
                    </div>
                    <dl>
                      <dt>Bài làm</dt>
                      <dd>${escapeHtml(formatAnswer(item.answer))}</dd>
                      <dt>Đáp án</dt>
                      <dd>${escapeHtml(formatAnswer(item.correct_answer ?? item.accepted_answers))}</dd>
                    </dl>
                    ${item.settings?.explanation ? `
                      <div class="explanation-box" style="margin-top: 12px; padding: 12px; background: var(--md-sys-color-surface-variant); border-radius: 8px; font-size: 0.95rem; border-left: 4px solid var(--md-sys-color-primary);">
                        <strong>Lời giải:</strong><br>
                        ${renderLatexText(item.settings.explanation)}
                      </div>
                    ` : ''}
                  </article>
                `,
              )
              .join('')}
            </div>
          </div>
        </section>
      `;
    }
    
    if (review.assignment?.pdf_url === 'latex' && window.MathJax) {
      window.MathJax.typesetPromise();
    }
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}
