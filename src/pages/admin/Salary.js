import { pageRoot } from '../../store.js';
import { wireRouteRetry } from '../../router.js';
import { toast, renderLoading, renderErrorState } from '../../lib/ui.js';
import { escapeHtml } from '../../lib/html.js';
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
  let activeStudentId = null;

  async function rerender() {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    root.innerHTML = renderLoading('Đang tải lịch dạy…');
    let schedules = [];
    let students = [];
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
    const monthNum = month + 1;
    const monthLabel = `${monthNum}/${year}`;

    // Build mutable local state per schedule for instant UI updates
    const scheduleStates = schedules.map((s) => {
      const sessionMap = {};
      for (const x of (s.salary_sessions ?? [])) {
        sessionMap[x.session_date] = x.taught ? 'taught' : 'scheduled';
      }
      return {
        id: s.id,
        studentId: s.student_id,
        name: s.profiles?.full_name ?? 'Học sinh',
        rate: Number(s.rate_per_session ?? 0),
        sessionMap,
      };
    });

    if (!scheduleStates.some((s) => s.studentId === activeStudentId)) {
      activeStudentId = scheduleStates[0]?.studentId ?? null;
    }

    const getStats = (st) => {
      const entries = Object.entries(st.sessionMap);
      const taught = entries.filter(([, v]) => v === 'taught').length;
      const scheduledDates = entries
        .filter(([, v]) => v === 'scheduled')
        .map(([iso]) => Number(iso.slice(8, 10)))
        .sort((a, b) => a - b);
      const totalSched = taught + scheduledDates.length;
      const money = taught * st.rate;
      return { taught, totalSched, scheduledDates, money };
    };

    const getGrandTotal = () => scheduleStates.reduce((sum, st) => sum + getStats(st).money, 0);

    const scheduledIds = new Set(schedules.map((s) => s.student_id));
    const unscheduled = students.filter((s) => !scheduledIds.has(s.id));
    const firstDow = (days[0].getDay() + 6) % 7;

    function renderActiveView() {
      const host = root.querySelector('#salary-active-host');
      const tabsHost = root.querySelector('#salary-tabs-host');
      const grandEl = root.querySelector('#salary-grand-total');
      if (grandEl) grandEl.textContent = `${fmt.format(getGrandTotal())}đ`;

      if (tabsHost) {
        tabsHost.innerHTML = scheduleStates.map((st) => {
          const s = getStats(st);
          const isActive = st.studentId === activeStudentId;
          return `
            <button type="button" class="salary-tab ${isActive ? 'active' : ''}" data-student-tab="${escapeHtml(st.studentId)}">
              <span>${escapeHtml(st.name)}</span>
              <span class="salary-tab-money">${fmt.format(s.money)}đ</span>
            </button>
          `;
        }).join('');

        tabsHost.querySelectorAll('[data-student-tab]').forEach((btn) => {
          btn.addEventListener('click', () => {
            activeStudentId = btn.dataset.studentTab;
            renderActiveView();
          });
        });
      }

      if (!host) return;
      const active = scheduleStates.find((s) => s.studentId === activeStudentId);
      if (!active) {
        host.innerHTML = `<div class="phase-empty-card"><p>Chưa có lịch dạy trong tháng ${monthLabel}.</p></div>`;
        return;
      }

      const stats = getStats(active);
      host.innerHTML = `
        <div class="salary-b-layout" data-schedule="${active.id}">
          <!-- Left: Large Single Calendar -->
          <section class="salary-card">
            <div class="salary-card-head">
              <h2 class="salary-student-name">${escapeHtml(active.name)}</h2>
              <div class="salary-legend">
                <span><i class="salary-swatch is-scheduled"></i>Có lịch</span>
                <span><i class="salary-swatch is-taught"></i>Đã dạy</span>
              </div>
            </div>

            <div class="salary-cal-grid salary-cal-grid--lg">
              ${DAY_SHORT.map((d, i) => `<div class="salary-cal-dow ${i >= 5 ? 'is-weekend' : ''}">${d}</div>`).join('')}
              ${Array(firstDow).fill('<div></div>').join('')}
              ${days.map((d) => {
                const iso = d.toISOString().slice(0, 10);
                const cellState = active.sessionMap[iso] ?? 'none';
                const dow = d.getDay();
                const isWeekend = dow === 0 || dow === 6;
                return `<button type="button" class="day-cell salary-day-cell salary-day-cell--lg ${isWeekend ? 'is-weekend' : ''}" data-toggle="${active.id}" data-date="${iso}" data-state="${cellState}">${d.getDate()}</button>`;
              }).join('')}
            </div>
          </section>

          <!-- Right: Salary Summary & Upcoming Days -->
          <aside class="salary-b-side">
            <div class="salary-summary-box">
              <span class="salary-summary-k">Lương tháng ${monthNum}</span>
              <div class="salary-summary-money" id="salary-active-money">${fmt.format(stats.money)}đ</div>
              <div class="salary-summary-sub" id="salary-active-sub">Đã dạy ${stats.taught}/${stats.totalSched} buổi</div>
            </div>

            <div class="salary-detail-card">
              <div class="salary-rate-row">
                <label class="salary-rate-label" for="rate-${active.id}">Đơn giá / buổi</label>
                <div class="salary-rate-box">
                  <input id="rate-${active.id}" type="number" class="salary-rate-input rate-input" data-rate-for="${active.id}" value="${active.rate}" min="0" step="10000" />
                  <span class="salary-rate-unit">đ</span>
                </div>
              </div>

              <div class="salary-upcoming-block">
                <div class="salary-upcoming-head">
                  <span>Buổi sắp dạy</span>
                  <strong>${stats.scheduledDates.length}</strong>
                </div>
                <div class="salary-upcoming-pills">
                  ${stats.scheduledDates.length
                    ? stats.scheduledDates.map((dayNum) => `<span class="salary-date-pill">${dayNum}/${monthNum}</span>`).join('')
                    : '<span class="salary-upcoming-empty">Không có buổi nào</span>'
                  }
                </div>
              </div>

              <div class="salary-detail-foot">
                <button type="button" class="salary-del-btn" data-delete-schedule="${active.id}">Xóa lịch tháng này</button>
              </div>
            </div>
          </aside>
        </div>
      `;

      // Wire delete
      host.querySelector('[data-delete-schedule]')?.addEventListener('click', async () => {
        if (!confirm('Xóa lịch dạy của học sinh này trong tháng?')) return;
        try {
          await deleteSalarySchedule(active.id);
          await rerender();
        } catch (err) { toast(err.message, 'error'); }
      });

      // Wire rate save
      const rateInput = host.querySelector('.rate-input');
      if (rateInput) {
        const saveRate = async () => {
          const newRate = Number(rateInput.value) || 0;
          active.rate = newRate;
          renderActiveView();
          try {
            await supabase.from('salary_schedules').update({ rate_per_session: newRate }).eq('id', active.id);
          } catch (err) { toast(err.message, 'error'); }
        };
        rateInput.addEventListener('blur', saveRate);
        rateInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveRate(); });
      }

      // Wire day cell click: none -> scheduled -> taught -> none
      host.querySelectorAll('.day-cell').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const sessionDate = btn.dataset.date;
          const prevState = active.sessionMap[sessionDate] ?? 'none';
          const nextState = prevState === 'none' ? 'scheduled' : (prevState === 'scheduled' ? 'taught' : 'none');

          if (nextState === 'none') delete active.sessionMap[sessionDate];
          else active.sessionMap[sessionDate] = nextState;

          renderActiveView();

          try {
            await setSessionState({ scheduleId: active.id, sessionDate, state: nextState });
          } catch (err) {
            if (prevState === 'none') delete active.sessionMap[sessionDate];
            else active.sessionMap[sessionDate] = prevState;
            toast(err.message, 'error');
            renderActiveView();
          }
        });
      });
    }

    root.innerHTML = `
      <section class="salary-hub">
        <!-- Dark Hero Banner -->
        <header class="asg-overview-hero">
          <a href="#/manage" class="phase-back-link">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            <span>Trung tâm Quản trị</span>
          </a>
          <div class="salary-hero-row">
            <div class="asg-overview-hero-left">
              <h1 class="phase-hero-title">Lịch dạy &amp; Lương</h1>
            </div>
            <div class="salary-hero-controls">
              <div class="salary-month-pill">
                <button type="button" id="prev-month" class="salary-month-btn" title="Tháng trước" aria-label="Tháng trước">‹</button>
                <span class="salary-month-label">T${monthLabel}</span>
                <button type="button" id="next-month" class="salary-month-btn" title="Tháng sau" aria-label="Tháng sau">›</button>
              </div>
              <div class="salary-grand-pill">
                <span class="salary-grand-k">Tổng</span>
                <strong id="salary-grand-total" class="salary-grand-v">${fmt.format(getGrandTotal())}đ</strong>
              </div>
            </div>
          </div>
        </header>

        <!-- Student Pill Tabs (Option B) -->
        ${scheduleStates.length ? `<div class="salary-tabs" id="salary-tabs-host"></div>` : ''}

        <!-- Active Student Calendar + Summary -->
        <div id="salary-active-host"></div>

        ${(unscheduled.length > 0 && schedules.length < 2) ? `
          <div class="salary-add-bar">
            <select id="add-student-sel" class="salary-add-select" aria-label="Chọn học sinh">
              <option value="">Chọn học sinh thêm vào tháng ${monthLabel}...</option>
              ${unscheduled.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.full_name)}</option>`).join('')}
            </select>
            <button id="add-student-btn" type="button" class="salary-add-btn">+ Thêm lịch</button>
          </div>
        ` : ''}
      </section>
    `;

    document.getElementById('prev-month')?.addEventListener('click', () => {
      month--;
      if (month < 0) { month = 11; year--; }
      rerender();
    });
    document.getElementById('next-month')?.addEventListener('click', () => {
      month++;
      if (month > 11) { month = 0; year++; }
      rerender();
    });

    document.getElementById('add-student-btn')?.addEventListener('click', async () => {
      const sel = document.getElementById('add-student-sel');
      const studentId = sel?.value;
      if (!studentId) { toast('Chọn học sinh trước!', 'error'); return; }
      try {
        await upsertSalarySchedule({ studentId, month: monthStr, ratePerSession: 0, notes: '' });
        activeStudentId = studentId;
        await rerender();
      } catch (err) { toast(err.message, 'error'); }
    });

    renderActiveView();
  }

  await rerender();
}
