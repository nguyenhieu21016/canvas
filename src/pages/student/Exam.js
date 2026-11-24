import { state, isManager, pageRoot } from '../../store.js';
import { go, wireRouteRetry } from '../../router.js';
import { accountInitial, toast, renderLoading, renderErrorState } from '../../lib/ui.js';
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

    const cleanedTitle = (assignment.title || '').replace(/Bài tập về nhà/gi, 'Bài tập');
    const questionCount = assignment.question_count ?? 0;
    const timeText = assignment.time_limit ? `${assignment.time_limit} phút` : 'Không giới hạn';

    root.innerHTML = `
      <section class="asg-overview-hub">
        <!-- Dark Hero Banner (consistent with #/learn & #/phase/:id) -->
        <header class="asg-overview-hero">
          <a href="javascript:history.back()" class="phase-back-link">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            <span>Quay lại</span>
          </a>
          <div class="asg-overview-hero-row">
            <div class="asg-overview-hero-left">
              <h1 class="phase-hero-title">${escapeHtml(cleanedTitle)}</h1>
            </div>
            <div class="asg-overview-hero-actions">
              ${isLockedPdfForStudent ? `
                <span class="asg-locked-pill">Bài tập PDF đã đóng</span>
              ` : `
                <button type="button" id="start-assignment" class="phase-hero-cta">
                  <span>${hasDraftInProgress ? 'Làm tiếp' : 'Bắt đầu làm bài'}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </button>
              `}
            </div>
          </div>
        </header>

        <!-- 3 Compact Soft Stat Blocks -->
        <div class="asg-stat-grid">
          <div class="asg-stat-card">
            <span class="asg-stat-label">Điểm gần nhất</span>
            <div class="asg-stat-value">${latest ? formatScore(latestScore10) : '—'}${latest ? '<span class="asg-stat-unit">/10</span>' : ''}</div>
          </div>
          <div class="asg-stat-card">
            <span class="asg-stat-label">Số câu hỏi</span>
            <div class="asg-stat-value">${questionCount}<span class="asg-stat-unit">câu</span></div>
          </div>
          <div class="asg-stat-card">
            <span class="asg-stat-label">Thời gian</span>
            <div class="asg-stat-value ${assignment.time_limit ? '' : 'is-text'}">${escapeHtml(timeText)}</div>
          </div>
        </div>

        <!-- History Card -->
        <section class="asg-history-card">
          <div class="asg-history-head">
            <h2 class="asg-history-title">Lịch sử làm bài</h2>
            ${attempts.length > 0 ? `<span class="asg-history-count">${attempts.length} lần</span>` : ''}
          </div>
          ${attempts.length > 0
            ? renderStudentAssignmentHistory(attempts)
            : '<div class="asg-history-empty">Chưa có lần nộp nào.</div>'
          }
        </section>
      </section>
    `;
    document.querySelector('#start-assignment')?.addEventListener('click', () => mountAssignmentExam(id));
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

export function renderStudentAssignmentHistory(attempts) {
  if (!attempts.length) return '<div class="asg-history-empty">Chưa có lần nộp nào.</div>';

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
    <div class="asg-history-list">
      ${attempts.map((attempt) => {
        const isPassed = (attempt.score_10 ?? 0) >= 8.0;
        return `
          <a href="#/review/${attempt.id}" class="asg-history-row">
            <div class="asg-history-left">
              <span class="asg-history-score">${formatScore(attempt.score_10)}</span>
              <span class="asg-history-pill ${isPassed ? 'is-pass' : 'is-warn'}">${isPassed ? 'Đạt' : 'Chưa đạt'}</span>
              <span class="asg-history-time">${fmtShort(attempt.submitted_at)}</span>
            </div>
            <span class="asg-history-link">
              <span>Xem bài làm</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </span>
          </a>
        `;
      }).join('')}
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
          <h2 style="margin: 0 0 12px 0; color: #101828; font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif;">Bài tập PDF đã bị khóa</h2>
          <p style="color: #667085; line-height: 1.6; margin-bottom: 24px; font-family: 'Google Sans', sans-serif;">Hệ thống không còn cho phép làm bài hoặc mở đề PDF này nữa. Kết quả điểm số cũ của bạn vẫn được ghi nhận trong lịch sử.</p>
          <a class="nh-btn-primary" href="#/assignment/${id}" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px; background: #181B16; color: #fff; text-decoration: none; border-radius: 9999px; font-weight: 600;">Xem lịch sử điểm</a>
        </div>
      `;
      return;
    }
    const draft = loadDraft(localStorage, state.profile.id, id);
    const answers = draft?.answers ?? {};
    const sections = [];
    let currentSection = null;
    questions.forEach((q, index) => {
      if (!currentSection || currentSection.type !== q.type) {
        const sIdx = sections.length + 1;
        const roman = ['I', 'II', 'III', 'IV', 'V'][sIdx - 1] || sIdx;
        let label = 'Trắc nghiệm';
        if (q.type === 'tf4') label = 'Đúng / Sai';
        if (q.type === 'short') label = 'Trả lời ngắn';
        currentSection = { type: q.type, roman, label, questions: [] };
        sections.push(currentSection);
      }
      currentSection.questions.push({ ...q, globalIndex: index });
    });

    const initialAnsweredCount = Object.values(answers).filter(
      (v) => v !== null && v !== undefined && v !== '' && (!Array.isArray(v) || v.some((val) => val !== null)),
    ).length;
    const initialPct = Math.round((initialAnsweredCount / (questions.length || 1)) * 100);
    const cleanedAssignmentTitle = (assignment.title || '').replace(/Bài tập về nhà/gi, 'Bài tập');
    const examTimeText = assignment.time_limit ? `${assignment.time_limit} phút` : 'Không giới hạn';

    root.innerHTML = `
      ${assignment.pdf_url === 'latex' ? `
        <section class="exam-hub">
          <!-- Block 1: Dark Hero Banner (consistent with #/learn, #/phase/:id, overview) -->
          <header class="asg-overview-hero">
            <a href="javascript:history.back()" class="phase-back-link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>Quay lại khóa học</span>
            </a>
            <div class="asg-overview-hero-row">
              <div class="asg-overview-hero-left">
                <h1 class="phase-hero-title">${escapeHtml(cleanedAssignmentTitle)}</h1>
              </div>
            </div>
          </header>

          <!-- 2-Column Layout: Separate Question Cards + 2x2 MCQ (from B3) & Sticky Navigator (from A3) -->
          <div class="exam-layout">
            <form id="answer-form" class="exam-paper-col">
              ${sections.map((sec) => `
                <div class="exam-section-block">
                  <div class="exam-section-label">Phần ${sec.roman} - ${sec.label}</div>
                  <div class="exam-card-stack">
                    ${sec.questions.map((q, i) => {
                      const cleanPrompt = q.prompt ? q.prompt.replace(/^Câu\s*\d+[\.\:\s]*/i, '') : '';
                      const qNumStr = String(i + 1).padStart(2, '0');

                      let inputHtml = '';
                      if (q.type === 'mcq') {
                        inputHtml = `
                          <div class="exam-mcq-grid">
                            ${(q.choices ?? []).map((choice, cIdx) => {
                              const value = String.fromCharCode(65 + cIdx);
                              const isChecked = answers[q.id] === value;
                              return `
                                <label class="latex-choice-tile exam-choice-tile ${isChecked ? 'selected' : ''}">
                                  <input type="radio" name="q-${q.id}" value="${value}" ${isChecked ? 'checked' : ''} class="exam-sr-input" />
                                  <span class="exam-choice-letter">${value}</span>
                                  <span class="exam-choice-text">${renderLatexText(choice)}</span>
                                </label>
                              `;
                            }).join('')}
                          </div>
                        `;
                      } else if (q.type === 'tf4') {
                        inputHtml = `
                          <div class="exam-tf-list">
                            ${(q.settings?.statements || []).map((stmt, cIdx) => {
                              const currentAns = answers[q.id]?.[cIdx];
                              const isTrueChecked = currentAns === true;
                              const isFalseChecked = currentAns === false;
                              return `
                                <div class="exam-tf-row">
                                  <div class="exam-tf-stmt">${renderLatexText(stmt)}</div>
                                  <div class="exam-tf-actions">
                                    <label class="exam-tf-pill ${isTrueChecked ? 'selected' : ''}">
                                      <input type="radio" name="q-${q.id}-${cIdx}" value="true" ${isTrueChecked ? 'checked' : ''} class="exam-sr-input" />
                                      <span>Đúng</span>
                                    </label>
                                    <label class="exam-tf-pill ${isFalseChecked ? 'selected' : ''}">
                                      <input type="radio" name="q-${q.id}-${cIdx}" value="false" ${isFalseChecked ? 'checked' : ''} class="exam-sr-input" />
                                      <span>Sai</span>
                                    </label>
                                  </div>
                                </div>
                              `;
                            }).join('')}
                          </div>
                        `;
                      } else if (q.type === 'short') {
                        const currentVal = answers[q.id] || '';
                        inputHtml = `
                          <div class="exam-short-row">
                            <span class="exam-short-label">Đáp số</span>
                            <input type="text" name="q-${q.id}" value="${escapeHtml(currentVal)}" placeholder="Nhập kết quả..." class="exam-short-input" />
                          </div>
                        `;
                      }

                      return `
                        <article class="latex-exam-card exam-q-card" data-question-id="${q.id}" data-type="${q.type}">
                          <div class="exam-q-head">
                            <span class="exam-q-badge">Câu ${qNumStr}</span>
                            <div class="exam-q-prompt">${renderLatexText(cleanPrompt)}</div>
                          </div>
                          ${inputHtml}
                        </article>
                      `;
                    }).join('')}
                  </div>
                </div>
              `).join('')}
            </form>

            <!-- Right Sticky Navigator (from A3) -->
            <aside class="exam-navigator exam-nav-col">
              <div class="exam-nav-card">
                <div class="exam-nav-progress">
                  <div class="exam-nav-progress-head">
                    <span class="exam-nav-progress-label">Đã làm</span>
                    <span class="exam-nav-progress-count" id="completion-count-display">${initialAnsweredCount}/${questions.length}</span>
                  </div>
                  <div class="exam-nav-bar-track">
                    <div id="completion-progress-bar" class="exam-nav-bar-fill" style="width: ${initialPct}%;"></div>
                  </div>
                </div>

                <div class="exam-nav-sections">
                  ${sections.map((sec) => `
                    <div class="exam-nav-section">
                      ${sections.length > 1 ? `<div class="exam-nav-sec-title">Phần ${sec.roman} - ${sec.label}</div>` : ''}
                      <div class="exam-nav-grid">
                        ${sec.questions.map((q, localIdx) => {
                          const ans = answers[q.id];
                          const isAns = q.type === 'tf4'
                            ? Array.isArray(ans) && ans.some((val) => val !== null)
                            : Boolean(ans);
                          const dispNum = String(localIdx + 1).padStart(2, '0');
                          return `
                            <button type="button" class="nav-btn exam-nav-btn ${isAns ? 'answered' : ''}" data-nav="${q.id}" onclick="document.querySelector('[data-question-id=\\'${q.id}\\']')?.scrollIntoView({behavior: 'smooth', block: 'center'})">
                              ${dispNum}
                            </button>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  `).join('')}
                </div>

                <div class="exam-nav-footer">
                  <p id="autosave-status" class="autosave-status exam-autosave">${draft ? 'Đã lưu ' + formatDateTime(draft.savedAt) : 'Tự động lưu khi chọn'}</p>
                  <button type="button" id="trigger-submit-modal-btn" class="exam-submit-btn">Nộp bài</button>
                </div>
              </div>
            </aside>
          </div>

          <!-- Submission Confirmation Modal -->
          <div id="submit-confirm-modal" style="display: none; position: fixed; inset: 0; background: rgba(24, 27, 22, 0.42); backdrop-filter: blur(2px); z-index: 9999; align-items: center; justify-content: center;">
            <div style="background: #ffffff; border-radius: 22px; width: 90%; max-width: 390px; padding: 28px 24px; text-align: center; position: relative; border: 1px solid #E4E6DE; box-shadow: 0 16px 36px rgba(24, 27, 22, 0.14); display: flex; flex-direction: column; align-items: center; gap: 16px;">
              <button type="button" id="close-submit-modal-btn" style="position: absolute; top: 14px; right: 16px; background: none; border: none; font-size: 22px; color: #64695F; cursor: pointer;">&times;</button>

              <h3 style="margin: 0; color: #181B16; font-family: var(--md-ref-typeface-brand); font-size: 22px; font-weight: 800;">Xác nhận nộp bài</h3>

              <div style="width: 96px; height: 96px; border-radius: 50%; background: radial-gradient(closest-side, white 79%, transparent 80% 100%), conic-gradient(#181B16 calc(var(--modal-pct, 0) * 1%), #EBEDE6 0); display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 4px 0;">
                <span style="font-size: 20px; font-weight: 800; color: #181B16;" id="modal-completion-ratio">0/0</span>
                <span style="font-size: 11px; color: #64695F;">Câu đã làm</span>
              </div>

              <p style="margin: 0; font-size: 14px; color: #64695F; line-height: 1.5;">Bạn có chắc chắn muốn nộp bài ngay bây giờ?</p>

              <div style="display: flex; gap: 10px; width: 100%; margin-top: 6px;">
                <button type="button" id="modal-continue-btn" style="flex: 1; height: 42px; background: #EBEDE6; color: #181B16; border: none; border-radius: 9999px; font-weight: 600; font-size: 14px; cursor: pointer;">Làm tiếp</button>
                <button type="button" id="modal-submit-btn" style="flex: 1; height: 42px; background: #181B16; color: #F7F7F2; border: none; border-radius: 9999px; font-weight: 600; font-size: 14px; cursor: pointer;">Nộp bài</button>
              </div>
            </div>
          </div>
        </section>
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
            border-color: #181B16 !important;
            box-shadow: 0 0 0 3px rgba(24, 27, 22, 0.12) !important;
          }
          .nav-btn:hover {
            border-color: #181B16 !important;
            color: #181B16 !important;
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

const INSIGHTS_STYLES = `
  <style>
    .ins-hero-meta {
      margin: 0;
      font-size: 13.5px;
      line-height: 1.45;
      color: rgba(247, 247, 242, 0.72);
      font-variant-numeric: tabular-nums;
    }
    .ins-card {
      background: #FFFFFF;
      border: 1px solid #E4E6DE;
      border-radius: 20px;
    }
    .ins-card-head {
      padding: 16px 20px;
      border-bottom: 1px solid #EFEFE9;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      border-radius: 20px 20px 0 0;
    }
    .ins-card-title {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: #181B16;
    }
    .ins-card-sub {
      font-size: 13px;
      font-weight: 500;
      color: #64695F;
      font-variant-numeric: tabular-nums;
    }
    .ins-stu-list {
      display: flex;
      flex-direction: column;
    }
    .ins-stu-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 14px 20px;
      border-bottom: 1px solid #EFEFE9;
      transition: background-color 0.14s ease;
    }
    .ins-stu-row:last-child {
      border-bottom: 0;
      border-radius: 0 0 20px 20px;
    }
    .ins-stu-row:hover {
      background: #FAFBF7;
    }
    .ins-stu-main {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1;
    }
    .ins-stu-av {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #EBEDE6;
      color: #181B16;
      display: grid;
      place-items: center;
      font-size: 13.5px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .ins-stu-av.is-done {
      background: #E9F2EC;
      color: #1F4E36;
    }
    .ins-stu-info {
      min-width: 0;
    }
    .ins-stu-name {
      display: block;
      font-size: 14.5px;
      font-weight: 600;
      color: #181B16;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ins-stu-email {
      display: block;
      font-size: 12.5px;
      color: #64695F;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ins-stu-right {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .ins-stu-time {
      font-size: 12.5px;
      color: #64695F;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .ins-score-cell {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 112px;
      font-variant-numeric: tabular-nums;
    }
    .ins-score-num {
      font-size: 14px;
      font-weight: 700;
      color: #181B16;
      width: 50px;
      text-align: right;
    }
    .ins-score-track {
      width: 56px;
      height: 6px;
      border-radius: 9999px;
      background: #EBEDE6;
      overflow: hidden;
      flex-shrink: 0;
    }
    .ins-score-fill {
      height: 100%;
      border-radius: 9999px;
      background: #2F6F4E;
    }
    .ins-score-fill.is-mid { background: #A16207; }
    .ins-score-fill.is-low { background: #B8433A; }
    .ins-badge-pending {
      display: inline-flex;
      align-items: center;
      height: 28px;
      padding: 0 12px;
      border-radius: 9999px;
      background: #EBEDE6;
      color: #64695F;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }
    .ins-btn-review {
      height: 34px;
      padding: 0 14px;
      border-radius: 9999px;
      border: 1px solid #D3D7CB;
      background: #FFFFFF;
      color: #181B16;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      white-space: nowrap;
      transition: background-color 200ms ease, border-color 200ms ease, transform 180ms ease;
    }
    .ins-btn-review:hover {
      background: #EBEDE6;
      border-color: #181B16;
    }
    .ins-btn-review:active {
      transform: scale(0.985);
    }
    .ins-empty {
      padding: 44px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      color: #64695F;
    }
    .ins-empty h3 {
      margin: 0;
      font-size: 15.5px;
      font-weight: 700;
      color: #181B16;
    }
    .ins-empty p {
      margin: 0;
      max-width: 340px;
      font-size: 13.5px;
    }
    @media (max-width: 760px) {
      .ins-stu-row {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
        padding: 14px 16px;
      }
      .ins-stu-right {
        width: 100%;
        justify-content: space-between;
        flex-wrap: nowrap;
        gap: 8px;
      }
      .ins-score-cell { min-width: 0; }
      .ins-score-num { width: auto; text-align: left; }
      .ins-score-track { display: none; }
    }
  </style>
`;

export async function mountAssignmentManagerView(id) {
  const root = pageRoot();
  root.innerHTML = `
    ${INSIGHTS_STYLES}
    <section class="asg-overview-hub" data-skeleton="true">
      <div class="asg-overview-hero" style="opacity:0.9;">
        <div class="skeleton" style="width:110px;height:14px;opacity:0.25;"></div>
        <div class="skeleton" style="width:300px;max-width:85%;height:26px;opacity:0.35;"></div>
        <div class="skeleton" style="width:190px;height:14px;opacity:0.25;"></div>
      </div>
      <div class="ins-card" style="padding:20px;display:grid;gap:14px;">
        <div class="skeleton" style="width:100%;height:48px;border-radius:10px;"></div>
        <div class="skeleton" style="width:100%;height:48px;border-radius:10px;"></div>
      </div>
    </section>
  `;
  try {
    const [{ assignment, submittedStudents, pendingStudents, stats }] = await Promise.all([
      fetchAssignmentInsights(id),
    ]);
    const lectureLabel = assignment.lectures?.title ?? 'Bài tập tự do';
    const summaryParts = [lectureLabel, `${stats.submittedCount}/${stats.totalStudents} đã làm`];
    if (stats.submittedCount > 0) {
      summaryParts.push(`TB ${formatScore(stats.averageScore)}/10`);
    }

    root.innerHTML = `
      ${INSIGHTS_STYLES}
      <section class="asg-overview-hub">
        <header class="asg-overview-hero">
          <a href="#/assignments" id="all-assignments-from-insights" class="phase-back-link">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            <span>Danh sách đề</span>
          </a>
          <div class="asg-overview-hero-row">
            <div class="asg-overview-hero-left">
              <h1 class="phase-hero-title">${escapeHtml(assignment.title)}</h1>
              <p class="ins-hero-meta">${escapeHtml(summaryParts.join(' · '))}</p>
            </div>
            <div class="asg-overview-hero-actions">
              <button type="button" id="edit-assignment-from-insights" class="phase-hero-cta">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/></svg>
                <span>Sửa đề</span>
              </button>
            </div>
          </div>
        </header>

        <section class="ins-card">
          <div class="ins-card-head">
            <h2 class="ins-card-title">Học sinh (${stats.totalStudents})</h2>
            <span class="ins-card-sub">${stats.submittedCount} đã làm · ${stats.pendingCount} chưa làm</span>
          </div>
          ${stats.totalStudents === 0 ? `
            <div class="ins-empty">
              <h3>Chưa có học sinh nào</h3>
              <p>Khi học sinh nộp bài, điểm số và chi tiết từng câu sẽ hiển thị tại đây.</p>
              <a class="ins-btn-review" href="#/assignments">Quay lại danh sách đề</a>
            </div>
          ` : `
            <div class="ins-stu-list">
              ${renderSubmittedStudents(submittedStudents)}
              ${renderPendingStudents(pendingStudents)}
            </div>
          `}
        </section>
      </section>
    `;

    document.querySelector('#edit-assignment-from-insights')?.addEventListener('click', async () => {
      try {
        const editor = await fetchAssignmentEditor(id);
        state.assignmentEditor = normalizeAssignmentEditor(editor);
        state.isEditingAssignment = true;
        go(`assignments/${id}`);
      } catch (error) {
        toast(error.message, 'error');
      }
    });
    document.querySelector('#all-assignments-from-insights')?.addEventListener('click', (e) => {
      e.preventDefault();
      go('assignments');
    });
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

export function renderSubmittedStudents(rows) {
  if (!rows.length) return '';
  return rows
    .map(({ student, attempt }) => {
      const score = Number(attempt.score_10 ?? 0);
      const pct = Math.max(0, Math.min(100, score * 10));
      const barTone = score < 5 ? 'is-low' : score < 7 ? 'is-mid' : '';
      return `
        <article class="ins-stu-row">
          <div class="ins-stu-main">
            <span class="ins-stu-av is-done" aria-hidden="true">${escapeHtml(accountInitial(student))}</span>
            <div class="ins-stu-info">
              <strong class="ins-stu-name">${escapeHtml(student.full_name || student.email)}</strong>
              <small class="ins-stu-email">${escapeHtml(student.email)}</small>
            </div>
          </div>
          <div class="ins-stu-right">
            <span class="ins-stu-time">${escapeHtml(formatDateTime(attempt.submitted_at))}</span>
            <div class="ins-score-cell">
              <span class="ins-score-num">${formatScore(score)}/10</span>
              <div class="ins-score-track" aria-hidden="true">
                <div class="ins-score-fill ${barTone}" style="width:${pct}%"></div>
              </div>
            </div>
            <a class="ins-btn-review" href="#/review/${escapeHtml(attempt.id)}">
              <span>Xem bài</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </a>
          </div>
        </article>
      `;
    })
    .join('');
}

export function renderPendingStudents(rows) {
  if (!rows.length) return '';
  return rows
    .map(
      (student) => `
        <article class="ins-stu-row">
          <div class="ins-stu-main">
            <span class="ins-stu-av" aria-hidden="true">${escapeHtml(accountInitial(student))}</span>
            <div class="ins-stu-info">
              <strong class="ins-stu-name">${escapeHtml(student.full_name || student.email)}</strong>
              <small class="ins-stu-email">${escapeHtml(student.email)}</small>
            </div>
          </div>
          <div class="ins-stu-right">
            <span class="ins-badge-pending">Chưa làm</span>
          </div>
        </article>
      `,
    )
    .join('');
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
      } else {
        btn.classList.remove('answered');
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
          examCard.querySelectorAll('label').forEach((lbl) => {
            const radio = lbl.querySelector('input[type="radio"]');
            if (radio) {
              lbl.classList.toggle('selected', radio.checked);
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
      const cleanedReviewTitle = (review.assignment?.title ?? 'Đề bài').replace(/Bài tập về nhà/gi, 'Bài tập');
      const hasAnswerFn = (i) => {
        if (Array.isArray(i.answer)) return i.answer.some((v) => v !== null && v !== undefined);
        return i.answer !== null && i.answer !== undefined && String(i.answer).trim() !== '';
      };
      const correctCount = itemsWithQuestions.filter((i) => hasAnswerFn(i) && i.is_correct).length;
      const wrongCount = itemsWithQuestions.filter((i) => hasAnswerFn(i) && !i.is_correct).length;
      const skippedCount = itemsWithQuestions.filter((i) => !hasAnswerFn(i)).length;
      const correctPct = Math.round((correctCount / (itemsWithQuestions.length || 1)) * 100);

      const sections = [];
      let currentSection = null;
      itemsWithQuestions.forEach((item, index) => {
        if (!currentSection || currentSection.type !== item.type) {
          const sIdx = sections.length + 1;
          const roman = ['I', 'II', 'III', 'IV', 'V'][sIdx - 1] || sIdx;
          let label = 'Trắc nghiệm';
          if (item.type === 'tf4') label = 'Đúng / Sai';
          if (item.type === 'short') label = 'Trả lời ngắn';
          currentSection = { type: item.type, roman, label, items: [] };
          sections.push(currentSection);
        }
        currentSection.items.push({ ...item, globalIndex: index });
      });

      root.innerHTML = `
        <section class="exam-hub">
          <!-- Dark Hero Banner -->
          <header class="asg-overview-hero">
            <a href="${review.assignment?.id ? `#/assignment/${review.assignment.id}` : '#/learn'}" class="phase-back-link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>Quay lại</span>
            </a>
            <div class="asg-overview-hero-row">
              <div class="asg-overview-hero-left">
                <h1 class="phase-hero-title">${escapeHtml(cleanedReviewTitle)}</h1>
              </div>
              ${review.assignment?.id ? `
                <div class="asg-overview-hero-actions">
                  <a href="#/assignment/${review.assignment.id}" class="phase-hero-cta" style="text-decoration: none;">
                    <span>Làm lại</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                  </a>
                </div>
              ` : ''}
            </div>
          </header>

          <!-- 3 Compact Soft Stat Blocks -->
          <div class="asg-stat-grid">
            <div class="asg-stat-card">
              <span class="asg-stat-label">Điểm</span>
              <div class="asg-stat-value">${formatScore(score10)}<span class="asg-stat-unit">/10</span></div>
            </div>
            <div class="asg-stat-card">
              <span class="asg-stat-label">Trả lời đúng</span>
              <div class="asg-stat-value">${correctCount}/${itemsWithQuestions.length}<span class="asg-stat-unit">câu</span></div>
            </div>
            <div class="asg-stat-card">
              <span class="asg-stat-label">Thời gian</span>
              <div class="asg-stat-value is-text">${escapeHtml(durationStr)}</div>
            </div>
          </div>

          <!-- 2-Column Review Layout -->
          <div class="exam-layout">
            <div class="exam-paper-col">
              ${sections.map((sec) => `
                <div class="exam-section-block">
                  <div class="exam-section-label">Phần ${sec.roman} - ${sec.label}</div>
                  <div class="exam-card-stack">
                    ${sec.items.map((item, localIdx) => {
                      const index = item.globalIndex;
                      const hasAns = hasAnswerFn(item);
                      const isCorrect = item.is_correct;
                      const chosenAnswer = formatAnswer(item.answer);
                      const correctAnswer = formatAnswer(item.correct_answer ?? item.accepted_answers);
                      const cleanPrompt = item.prompt ? item.prompt.replace(/^Câu\s*\d+[\.\:\s]*/i, '') : '';
                      const qNumStr = String(localIdx + 1).padStart(2, '0');

                      const statusClass = !hasAns ? 'is-skip' : (isCorrect ? 'is-ok' : 'is-bad');
                      const statusText = !hasAns ? 'Chưa làm' : (isCorrect ? 'Đúng' : 'Sai');

                      let bodyHtml = '';
                      if (item.type === 'mcq') {
                        bodyHtml = `
                          <div class="exam-mcq-grid">
                            ${(item.choices ?? []).map((choice, cIdx) => {
                              const letter = String.fromCharCode(65 + cIdx);
                              const isChosen = chosenAnswer === letter;
                              const isCorrectChoice = correctAnswer === letter;
                              let stateCls = '';
                              if (isCorrectChoice) stateCls = 'is-correct';
                              else if (isChosen) stateCls = 'is-wrong';
                              return `
                                <div class="review-choice-tile ${stateCls}">
                                  <span class="review-choice-letter">${letter}</span>
                                  <span class="review-choice-text">${renderLatexText(choice)}</span>
                                </div>
                              `;
                            }).join('')}
                          </div>
                        `;
                      } else if (item.type === 'tf4') {
                        bodyHtml = `
                          <div class="exam-tf-list">
                            ${(item.settings?.statements || []).map((stmt, cIdx) => {
                              const userAns = Array.isArray(item.answer) ? item.answer[cIdx] : null;
                              const correctAns = Array.isArray(item.correct_answer) ? item.correct_answer[cIdx] : null;
                              const pillState = (val) => {
                                if (correctAns === val) return 'is-correct';
                                if (userAns === val && userAns !== correctAns) return 'is-wrong';
                                return '';
                              };
                              return `
                                <div class="exam-tf-row">
                                  <div class="exam-tf-stmt">${renderLatexText(stmt)}</div>
                                  <div class="exam-tf-actions">
                                    <span class="review-tf-pill ${pillState(true)}">Đúng</span>
                                    <span class="review-tf-pill ${pillState(false)}">Sai</span>
                                  </div>
                                </div>
                              `;
                            }).join('')}
                          </div>
                        `;
                      } else if (item.type === 'short') {
                        bodyHtml = `
                          <div class="review-short-grid">
                            <div class="review-short-chip ${!hasAns ? '' : (isCorrect ? 'is-correct' : 'is-wrong')}">
                              <span class="review-short-k">Bạn trả lời</span>
                              <strong class="review-short-v">${escapeHtml(hasAns ? String(item.answer) : '—')}</strong>
                            </div>
                            <div class="review-short-chip is-correct">
                              <span class="review-short-k">Đáp án</span>
                              <strong class="review-short-v">${escapeHtml(String(item.correct_answer ?? item.accepted_answers ?? '—'))}</strong>
                            </div>
                          </div>
                        `;
                      }

                      const explanationHtml = item.settings?.explanation
                        ? `
                          <div class="review-explain">
                            <div class="review-explain-title">Lời giải</div>
                            <div class="review-explain-body">${renderLatexText(item.settings.explanation)}</div>
                          </div>
                        `
                        : '';

                      return `
                        <article id="latex-review-q${index}" class="latex-exam-card exam-q-card">
                          <div class="review-q-top">
                            <div class="exam-q-head">
                              <span class="exam-q-badge">Câu ${qNumStr}</span>
                              <div class="exam-q-prompt">${renderLatexText(cleanPrompt)}</div>
                            </div>
                            <span class="review-status-pill ${statusClass}">${statusText}</span>
                          </div>
                          ${bodyHtml}
                          ${explanationHtml}
                        </article>
                      `;
                    }).join('')}
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- Right Sticky Review Navigator -->
            <aside class="exam-navigator exam-nav-col">
              <div class="exam-nav-card">
                <div class="exam-nav-progress">
                  <div class="exam-nav-progress-head">
                    <span class="exam-nav-progress-label">Đúng</span>
                    <span class="exam-nav-progress-count">${correctCount}/${itemsWithQuestions.length}</span>
                  </div>
                  <div class="exam-nav-bar-track">
                    <div class="exam-nav-bar-fill" style="width: ${correctPct}%;"></div>
                  </div>
                </div>

                <div class="exam-nav-sections">
                  ${sections.map((sec) => `
                    <div class="exam-nav-section">
                      ${sections.length > 1 ? `<div class="exam-nav-sec-title">Phần ${sec.roman} - ${sec.label}</div>` : ''}
                      <div class="exam-nav-grid">
                        ${sec.items.map((i, localIdx) => {
                          const idx = i.globalIndex;
                          const hasAns = hasAnswerFn(i);
                          const cls = !hasAns ? '' : (i.is_correct ? 'is-ok' : 'is-bad');
                          const dispNum = String(localIdx + 1).padStart(2, '0');
                          return `
                            <button type="button" class="exam-nav-btn ${cls}" onclick="document.getElementById('latex-review-q${idx}')?.scrollIntoView({behavior: 'smooth', block: 'center'})">
                              ${dispNum}
                            </button>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  `).join('')}
                </div>

                <div class="review-legend">
                  <div class="review-legend-row">
                    <span class="review-legend-dot is-ok"></span>
                    <span>Đúng</span>
                    <strong>${correctCount}</strong>
                  </div>
                  <div class="review-legend-row">
                    <span class="review-legend-dot is-bad"></span>
                    <span>Sai</span>
                    <strong>${wrongCount}</strong>
                  </div>
                  <div class="review-legend-row">
                    <span class="review-legend-dot is-skip"></span>
                    <span>Chưa làm</span>
                    <strong>${skippedCount}</strong>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
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
                <h3 style="font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif; font-size: 18px; color: #181B16; margin: 0 0 8px 0;">Đề bài PDF đã khóa truy cập</h3>
                <p style="margin: 0; font-size: 14px; color: #667085; font-family: 'Google Sans', sans-serif;">Tài liệu đề bài PDF đã đóng. Bạn vẫn có thể xem lại đáp án và kết quả chấm điểm ở cột bên phải.</p>
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
