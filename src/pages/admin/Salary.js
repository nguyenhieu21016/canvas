import { state, pageRoot } from '../../store.js';
import { wireRouteRetry } from '../../router.js';
import { toast, renderLoading, renderErrorState } from '../../lib/ui.js';
import { escapeHtml, option } from '../../lib/html.js';
import { supabase } from '../../services/supabaseClient.js';
import {
  fetchStudents,
  fetchSalaryMonth,
  upsertSalarySchedule,
  deleteSalarySchedule,
  setSessionState,
} from '../../services/lmsApi.js';

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
        if (cellState === 'taught') return `background: #181B16; color: #ffffff; border: 2px solid #181B16; font-weight: 700; box-shadow: 0 2px 6px rgba(24, 27, 22, 0.2);`;
        if (cellState === 'scheduled') return `background: #EBEDE6; color: ${isWeekend ? '#e11d48' : '#181B16'}; border: 2px solid #181B16; font-weight: 700;`;
        return `background: #f8fafc; color: ${isWeekend ? '#e11d48' : '#64748b'}; border: 1px solid #f1f5f9; font-weight: 500;`;
      }

      return `
        <div class="panel" data-schedule="${s.id}" style="background: #ffffff; border: 1px solid #E4E6DE; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03); margin: 0;">
          <!-- Name row -->
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <h3 style="margin: 0; font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif; font-size: 16.5px; font-weight: 700; color: #181B16;">${escapeHtml(s.profiles?.full_name ?? 'Học sinh')}</h3>
            <button type="button" data-delete-schedule="${s.id}" title="Xóa lịch tháng này"
              style="background: #fff; border: 1px solid #fca5a5; border-radius: 9999px; color: #ef4444; cursor: pointer; padding: 3px 10px; font-size: 11.5px; font-weight: 500; transition: all 0.15s ease;"
              onmouseover="this.style.background='#fef2f2';"
              onmouseout="this.style.background='#fff';">
              Xóa
            </button>
          </div>

          <!-- Stats row -->
          <div style="display: flex; align-items: center; background: #EBEDE6; border: 1px solid #E4E6DE; border-radius: 10px; overflow: hidden; font-family: 'Google Sans', sans-serif;">
            <div style="flex: 1; padding: 8px 10px; border-right: 1px solid #E4E6DE; text-align: center;">
              <div style="color: #667085; font-size: 11px; font-weight: 600; margin-bottom: 1px;">Lịch</div>
              <strong style="font-size: 15px; color: #1e293b;">${scheduledCount + taughtCount}</strong>
            </div>
            <div style="flex: 1; padding: 8px 10px; border-right: 1px solid #E4E6DE; text-align: center;">
              <div style="color: #667085; font-size: 11px; font-weight: 600; margin-bottom: 1px;">Đã dạy</div>
              <strong style="font-size: 15px; color: #181B16;" data-count="${s.id}">${taughtCount}</strong>
            </div>
            <div style="flex: 1; padding: 8px 10px; text-align: center;">
              <div style="color: #667085; font-size: 11px; font-weight: 600; margin-bottom: 1px;">Lương</div>
              <strong style="font-size: 15px; color: #181B16;" data-total="${s.id}">${fmt.format(total)}đ</strong>
            </div>
          </div>

          <!-- Rate row -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <label style="font-size: 12.5px; font-weight: 600; color: #334155; font-family: 'Google Sans', sans-serif;">Đơn giá / buổi</label>
            <div style="display: flex; align-items: center; gap: 6px;">
              <input type="number" class="field rate-input" data-rate-for="${s.id}" value="${rate}" min="0" step="10000"
                style="width: 105px; height: 34px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 0 8px; font-size: 13px; text-align: right; font-weight: 600; color: #1e293b; outline: none;">
              <span style="font-size: 13px; color: #64748b; font-weight: 500;">đ</span>
            </div>
          </div>

          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 0;">

          <!-- Legend -->
          <div style="display: flex; gap: 12px; font-size: 11.5px; color: #64748b; font-family: 'Google Sans', sans-serif;">
            <span style="display: flex; align-items: center; gap: 5px;"><span style="width: 9px; height: 9px; border-radius: 2px; background: #f8fafc; border: 1px solid #e2e8f0; display: inline-block;"></span>Trống</span>
            <span style="display: flex; align-items: center; gap: 5px;"><span style="width: 9px; height: 9px; border-radius: 2px; background: #EBEDE6; border: 1.5px solid #181B16; display: inline-block;"></span>Có lịch</span>
            <span style="display: flex; align-items: center; gap: 5px;"><span style="width: 9px; height: 9px; border-radius: 2px; background: #181B16; display: inline-block;"></span>Đã dạy</span>
          </div>

          <!-- Calendar Grid -->
          <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center;">
            ${DAY_SHORT.map((d, i) => `<div style="font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif; font-size: 11px; font-weight: 700; color: ${i >= 5 ? '#e11d48' : '#181B16'}; padding: 2px 0;">${d}</div>`).join('')}
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
        .salary-nav-btn { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 50%; width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: 15px; color: #181B16; transition: all 0.15s ease; }
        .salary-nav-btn:hover { background: #EBEDE6; border-color: #181B16; }
      </style>

      <div style="background-color: #F7F7F2; min-height: calc(100vh - 64px); padding: 0 0 60px 0; margin: 0; font-family: 'Google Sans', sans-serif;">
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
          <div style="background: #ffffff; border-radius: 14px; border: 1px solid #E4E6DE; padding: 16px 24px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
            <div>
              <h1 style="font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif; font-size: 22px; font-weight: 700; color: #181B16; margin: 0;">Quản lý Lương & Lịch dạy</h1>
            </div>

            <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
              <!-- Month Navigator -->
              <div style="display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 5px 10px; border-radius: 9999px;">
                <button id="prev-month" class="salary-nav-btn" title="Tháng trước">‹</button>
                <span style="font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif; font-size: 15px; font-weight: 700; color: #181B16; min-width: 70px; text-align: center;">Tháng ${monthLabel}</span>
                <button id="next-month" class="salary-nav-btn" title="Tháng sau">›</button>
              </div>

              <!-- Total Salary Badge -->
              <div style="background: #181B16; color: #ffffff; border-radius: 9999px; padding: 8px 18px; font-weight: 600; font-size: 13.5px; box-shadow: 0 4px 12px rgba(24, 27, 22, 0.2); display: flex; align-items: center; gap: 6px;">
                Tổng: <span style="font-size: 17px; font-weight: 800; font-family: 'Google Sans', sans-serif;">${fmt.format(totalSalary)}đ</span>
              </div>
            </div>
          </div>

          <!-- Tracker grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; align-items: flex-start;" id="tracker-list">
            ${schedules.length
              ? schedules.map(renderStudentTracker).join('')
              : `<div style="background: #ffffff; border-radius: 18px; border: 1px solid #E4E6DE; color: #64748b; text-align: center; padding: 48px 24px; font-size: 14px; grid-column: 1/-1; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
                  Chưa có lịch dạy trợ giảng nào trong tháng ${monthLabel}.<br>Hãy chọn thêm học sinh phía dưới để bắt đầu chấm công.
                </div>`
            }
          </div>

          <!-- Add student -->
          ${(unscheduled.length > 0 && schedules.length < 2) ? `
            <div style="background: #ffffff; border-radius: 18px; border: 1.5px dashed #E4E6DE; padding: 20px 24px; display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
              <div style="flex: 1; min-width: 200px;">
                <label class="field-label" style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px;">Thêm lịch trợ giảng tháng ${monthLabel}</label>
                <select id="add-student-sel" class="field" style="width: 100%; height: 40px; border-radius: 10px; border: 1px solid #cbd5e1; padding: 0 12px; font-size: 14px; font-family: 'Google Sans', sans-serif;">
                  <option value="">-- Chọn học sinh / trợ giảng --</option>
                  ${unscheduled.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.full_name)}</option>`).join('')}
                </select>
              </div>
              <button id="add-student-btn" type="button" style="height: 40px; padding: 0 22px; background: #181B16; color: #ffffff; border: 0; border-radius: 10px; font-size: 13.5px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.15s ease;" onmouseover="this.style.background='#2C3028'" onmouseout="this.style.background='#181B16'">
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
          await supabase.from('salary_schedules').update({ rate_per_session: rate }).eq('id', scheduleId);
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
