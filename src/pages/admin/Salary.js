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
  saveSessionNote,
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
  let selectedDate = null;

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
      const noteMap = {};
      for (const x of (s.salary_sessions ?? [])) {
        sessionMap[x.session_date] = x.taught ? 'taught' : 'scheduled';
        if (x.note) noteMap[x.session_date] = x.note;
      }
      return {
        id: s.id,
        studentId: s.student_id,
        name: s.profiles?.full_name ?? 'Học sinh',
        rate: Number(s.rate_per_session ?? 0),
        sessionMap,
        noteMap,
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
            selectedDate = null;
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
      const monthPrefix = `${year}-${String(monthNum).padStart(2, '0')}-`;
      if (!selectedDate || !selectedDate.startsWith(monthPrefix)) {
        const allDates = Object.keys(active.sessionMap).sort((a, b) => b.localeCompare(a));
        const latestTaught = allDates.find((d) => active.sessionMap[d] === 'taught');
        const todayIso = now.toISOString().slice(0, 10);
        selectedDate = latestTaught || allDates[0] || (todayIso.startsWith(monthPrefix) ? todayIso : days[0].toISOString().slice(0, 10));
      }

      const selState = active.sessionMap[selectedDate] ?? 'none';
      const selNote = active.noteMap[selectedDate] ?? '';
      const selDayNum = Number(selectedDate.slice(8, 10));

      const notedSessions = Object.entries(active.noteMap)
        .filter(([iso, text]) => active.sessionMap[iso] && String(text || '').trim())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([iso, text]) => ({
          iso,
          dayNum: Number(iso.slice(8, 10)),
          text: String(text).trim(),
        }));

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
                const hasNote = Boolean((active.noteMap[iso] ?? '').trim());
                const isSelected = iso === selectedDate;
                const dow = d.getDay();
                const isWeekend = dow === 0 || dow === 6;
                return `<button type="button" class="day-cell salary-day-cell salary-day-cell--lg ${isWeekend ? 'is-weekend' : ''} ${hasNote ? 'has-note' : ''} ${isSelected ? 'is-selected' : ''}" data-select-date="${iso}" data-date="${iso}" data-state="${cellState}" ${hasNote ? `title="${escapeHtml(active.noteMap[iso])}"` : ''}>${d.getDate()}</button>`;
              }).join('')}
            </div>
          </section>

          <!-- Right: Day Inspector + Salary Summary -->
          <aside class="salary-b-side">
            <div class="salary-summary-box">
              <span class="salary-summary-k">Lương tháng ${monthNum}</span>
              <div class="salary-summary-money" id="salary-active-money">${fmt.format(stats.money)}đ</div>
              <div class="salary-summary-sub" id="salary-active-sub">Đã dạy ${stats.taught}/${stats.totalSched} buổi</div>
            </div>

            <!-- Selected Day Status & Note -->
            <div class="salary-detail-card salary-day-panel">
              <div class="salary-day-panel-head">
                <span class="salary-day-panel-title">Buổi ngày ${selDayNum}/${monthNum}</span>
                <span class="salary-note-saved" id="salary-note-saved"></span>
              </div>

              <div class="salary-state-seg" role="group" aria-label="Trạng thái buổi học">
                <button type="button" class="salary-state-btn ${selState === 'none' ? 'active' : ''}" data-set-day-state="none">Trống</button>
                <button type="button" class="salary-state-btn ${selState === 'scheduled' ? 'active' : ''}" data-set-day-state="scheduled">Có lịch</button>
                <button type="button" class="salary-state-btn ${selState === 'taught' ? 'active' : ''}" data-set-day-state="taught">Đã dạy</button>
              </div>

              ${selState !== 'none' ? `
                <textarea
                  id="salary-day-note"
                  class="salary-note-input"
                  rows="3"
                  placeholder="Ghi chú BTVN, nhận xét buổi học..."
                >${escapeHtml(selNote)}</textarea>
              ` : `
                <div class="salary-day-empty">Chọn "Có lịch" hoặc "Đã dạy" để ghi chú buổi này.</div>
              `}

              ${notedSessions.length ? `
                <div class="salary-noted-block">
                  <div class="salary-upcoming-head">
                    <span>Đã ghi chú</span>
                    <strong>${notedSessions.length}</strong>
                  </div>
                  <div class="salary-noted-list">
                    ${notedSessions.map((item) => `
                      <button type="button" class="salary-noted-item ${item.iso === selectedDate ? 'active' : ''}" data-jump-date="${item.iso}">
                        <span class="salary-noted-date">${item.dayNum}/${monthNum}</span>
                        <span class="salary-noted-text">${escapeHtml(item.text)}</span>
                      </button>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
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
                    ? stats.scheduledDates.map((dayNum) => {
                        const iso = `${monthPrefix}${String(dayNum).padStart(2, '0')}`;
                        return `<button type="button" class="salary-date-pill" data-jump-date="${iso}">${dayNum}/${monthNum}</button>`;
                      }).join('')
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

      const applySessionState = async (sessionDate, nextState) => {
        const prevState = active.sessionMap[sessionDate] ?? 'none';
        const prevNote = active.noteMap[sessionDate];
        if (nextState === prevState) return;

        if (nextState === 'none') {
          delete active.sessionMap[sessionDate];
          delete active.noteMap[sessionDate];
        } else {
          active.sessionMap[sessionDate] = nextState;
        }
        renderActiveView();

        try {
          await setSessionState({ scheduleId: active.id, sessionDate, state: nextState });
        } catch (err) {
          if (prevState === 'none') delete active.sessionMap[sessionDate];
          else active.sessionMap[sessionDate] = prevState;
          if (prevNote !== undefined) active.noteMap[sessionDate] = prevNote;
          toast(err.message, 'error');
          renderActiveView();
        }
      };

      // Wire calendar day click (select day) & double-click (quick cycle)
      host.querySelectorAll('.day-cell').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedDate = btn.dataset.date;
          renderActiveView();
        });
        btn.addEventListener('dblclick', () => {
          const d = btn.dataset.date;
          selectedDate = d;
          const prev = active.sessionMap[d] ?? 'none';
          const next = prev === 'none' ? 'scheduled' : (prev === 'scheduled' ? 'taught' : 'none');
          applySessionState(d, next);
        });
      });

      // Wire segmented state buttons for selected day
      host.querySelectorAll('[data-set-day-state]').forEach((btn) => {
        btn.addEventListener('click', () => {
          applySessionState(selectedDate, btn.dataset.setDayState);
        });
      });

      // Wire jump-to-date buttons (noted list & upcoming pills)
      host.querySelectorAll('[data-jump-date]').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedDate = btn.dataset.jumpDate;
          renderActiveView();
        });
      });

      // Wire selected day note auto-save
      const dayNoteTa = host.querySelector('#salary-day-note');
      if (dayNoteTa) {
        const saveNote = async () => {
          const sessionDate = selectedDate;
          const nextVal = dayNoteTa.value.trim();
          const prevVal = (active.noteMap[sessionDate] ?? '').trim();
          if (nextVal === prevVal) return;

          const statusEl = host.querySelector('#salary-note-saved');
          if (statusEl) statusEl.textContent = 'Đang lưu...';
          active.noteMap[sessionDate] = nextVal;

          try {
            await saveSessionNote({ scheduleId: active.id, sessionDate, note: nextVal });
            renderActiveView();
            const freshStatus = host.querySelector('#salary-note-saved');
            if (freshStatus) {
              freshStatus.textContent = 'Đã lưu';
              setTimeout(() => {
                if (freshStatus.textContent === 'Đã lưu') freshStatus.textContent = '';
              }, 1600);
            }
          } catch (err) {
            active.noteMap[sessionDate] = prevVal;
            if (statusEl) statusEl.textContent = '';
            const msg = /note|column/i.test(err.message || '')
              ? 'Chưa chạy migration cột note cho bảng salary_sessions trên Supabase.'
              : err.message;
            toast(msg, 'error');
          }
        };

        dayNoteTa.addEventListener('blur', saveNote);
        dayNoteTa.addEventListener('keydown', (e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            dayNoteTa.blur();
          }
        });
      }
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
