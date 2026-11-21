import { state, pageRoot } from '../../store.js';
import { wireRouteRetry } from '../../router.js';
import { renderLoading, renderErrorState } from '../../lib/ui.js';
import { escapeHtml } from '../../lib/html.js';
import { formatScore } from '../../lib/format.js';
import { fetchLearningPath } from '../../services/lmsApi.js';

export async function mountStudentGrades() {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang tải bảng điểm cá nhân...');
  try {
    const data = await fetchLearningPath(state.profile.role);
    const assignmentGroups = collectLearningPathAssignments(data);
    const totalAssignments = assignmentGroups.reduce((sum, g) => sum + g.assignments.length, 0);

    root.innerHTML = `
      <div style="background: #EDF2E4; min-height: calc(100vh - 64px); padding: 28px max(var(--page-gutter), 24px);">
        <div style="max-width: 1040px; margin: 0 auto; background: #ffffff; border-radius: 18px; padding: 28px 32px; border: 1px solid #D8E2C4; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #D8E2C4;">
            <div>
              <h2 style="font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 26px; font-weight: 700; color: #455120; margin: 0;">Bảng điểm cá nhân</h2>
              <p style="margin: 4px 0 0; font-size: 13px; color: #667085; font-family: 'Be Vietnam Pro', sans-serif;">Theo dõi tiến độ và kết quả làm bài tập</p>
            </div>
            <span style="background: #F0F4E8; color: #455120; font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 14px; font-weight: 700; padding: 6px 16px; border-radius: 9999px; border: 1px solid #D8E2CA;">
              ${totalAssignments} bài tập
            </span>
          </div>

          ${assignmentGroups.length === 0 ? '<div class="empty-state">Chưa có bài tập về nhà.</div>' : ''}
          ${assignmentGroups.map(group => `
            <div style="margin-top: 28px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
              <div style="width: 4px; height: 18px; background: #455120; border-radius: 2px;"></div>
              <h3 style="margin: 0; font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 17px; font-weight: 700; color: #455120;">${escapeHtml(group.title)}</h3>
            </div>
            ${renderStudentGradesTable(group.assignments)}
          `).join('')}
        </div>
      </div>
    `;
  } catch (error) {
    root.innerHTML = renderErrorState(error);
    wireRouteRetry(root);
  }
}

export function collectLearningPathAssignments(data) {
  const groups = [];
  const scoreOf = (assignment) => Number(assignment.progress?.bestScore ?? -1);

  for (const phase of data.phases ?? []) {
    const rowsById = new Map();
    const pushAssignment = (assignment, context) => {
      const row = { ...assignment, context };
      const current = rowsById.get(assignment.id);
      if (!current || scoreOf(row) > scoreOf(current)) {
        rowsById.set(assignment.id, row);
      }
    };

    for (const module of phase.modules ?? []) {
      for (const lecture of module.lectures ?? []) {
        for (const assignment of lecture.assignments ?? []) {
          pushAssignment(assignment, lecture.title || module.title || phase.title);
        }
      }
      for (const group of module.lecture_groups ?? []) {
        for (const lecture of group.lectures ?? []) {
          for (const assignment of lecture.assignments ?? []) {
            pushAssignment(assignment, lecture.title || group.title || module.title || phase.title);
          }
        }
      }
    }

    if (rowsById.size > 0) {
      groups.push({
        title: phase.title,
        assignments: Array.from(rowsById.values()).sort((a, b) => a.title.localeCompare(b.title, 'vi'))
      });
    }
  }

  const freeById = new Map();
  for (const assignment of data.freeAssignments ?? []) {
    const row = { ...assignment, context: 'Bài tập tự do' };
    const current = freeById.get(assignment.id);
    if (!current || scoreOf(row) > scoreOf(current)) {
      freeById.set(assignment.id, row);
    }
  }

  if (freeById.size > 0) {
    groups.push({
      title: 'Bài tập tự do',
      assignments: Array.from(freeById.values()).sort((a, b) => a.title.localeCompare(b.title, 'vi'))
    });
  }

  return groups;
}

export function renderStudentGradesTable(assignments) {
  if (!assignments.length) return '<div class="empty-state">Chưa có bài tập về nhà.</div>';
  return `
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${assignments
      .map((assignment) => {
        const hasSubmitted = assignment.progress?.status === 'submitted';
        const score = assignment.progress?.bestScore;
        return `
            <div style="background: #F7F9F4; border-radius: 12px; padding: 14px 18px; border: 1px solid #E5ECD9; display: flex; align-items: center; justify-content: space-between; gap: 16px; transition: all 0.15s ease;" onmouseover="this.style.borderColor='#455120'" onmouseout="this.style.borderColor='#E5ECD9'">
              <div style="min-width: 0; flex: 1;">
                <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #101828; font-family: 'Be Vietnam Pro', sans-serif;">${escapeHtml(assignment.title)}</h4>
                <p style="margin: 0; font-size: 12px; color: #667085; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(assignment.context ?? '-')}</p>
              </div>

              <div style="display: flex; align-items: center; gap: 16px; flex-shrink: 0;">
                <span style="font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 9999px; ${hasSubmitted ? 'background: #F0F4E8; color: #455120;' : 'background: #EAECF0; color: #667085;'}">
                  ${hasSubmitted ? 'Đã làm' : 'Chưa làm'}
                </span>

                <div style="min-width: 60px; text-align: right;">
                  ${hasSubmitted
            ? `<span style="font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 16px; font-weight: 800; color: #455120;">${formatScore(score)}/10</span>`
            : '<span style="color: #98A2B3; font-weight: 600;">-</span>'
          }
                </div>

                <a href="#/assignment/${assignment.id}" style="text-decoration: none; background: ${hasSubmitted ? '#F0F4E8' : '#455120'}; color: ${hasSubmitted ? '#455120' : '#ffffff'}; border: 1px solid ${hasSubmitted ? '#D8E2CA' : '#455120'}; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 4px;">
                  ${hasSubmitted ? 'Làm lại' : 'Làm bài'}
                  <md-icon style="font-size: 14px;">arrow_forward</md-icon>
                </a>
              </div>
            </div>
          `;
      })
      .join('')}
    </div>
  `;
}
