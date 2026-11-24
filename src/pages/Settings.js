import { state } from '../store.js';
import { pageRoot, render, syncHeaderProfile } from '../main.js';
import { go } from '../router.js';
import { escapeHtml, setButtonLoading } from '../lib/html.js';
import { accountInitial, toast } from '../lib/ui.js';
import {
  updateProfileAvatar,
  removeProfileAvatar,
  updateProfileName,
  updateCurrentUserPassword,
  fetchMyHistory,
  signOut,
} from '../services/lmsApi.js';
import { formatDateTime, formatScore } from '../lib/format.js';
import { getPast30DaysOnlineData } from '../lib/sessionTracker.js';

const SETTINGS_STYLES = `
  <style>
    .set-wrap {
      max-width: 960px;
      width: 100%;
      margin: 0 auto;
      padding: 28px 20px 64px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      font-family: 'Google Sans', ui-sans-serif, system-ui, sans-serif;
      color: #181B16;
    }
    .set-hero-user {
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 0;
      flex: 1;
    }
    .set-avatar-lg {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: rgba(247, 247, 242, 0.14);
      border: 2px solid rgba(247, 247, 242, 0.22);
      color: #F7F7F2;
      display: grid;
      place-items: center;
      font-size: 20px;
      font-weight: 700;
      flex-shrink: 0;
      overflow: hidden;
    }
    .set-avatar-lg img,
    .set-avatar-md img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .set-hero-sub {
      margin: 4px 0 0;
      font-size: 13px;
      line-height: 1.45;
      color: rgba(247, 247, 242, 0.72);
      word-break: break-word;
    }
    .set-role-pill {
      display: inline-flex;
      align-items: center;
      height: 22px;
      padding: 0 9px;
      border-radius: 9999px;
      background: rgba(247, 247, 242, 0.14);
      color: #F7F7F2;
      font-size: 11.5px;
      font-weight: 600;
      margin-right: 6px;
      vertical-align: middle;
      white-space: nowrap;
    }
    .set-tabs-dark {
      display: inline-flex;
      padding: 3px;
      gap: 4px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.1);
    }
    .set-tab-dark {
      height: 34px;
      padding: 0 16px;
      border: 0;
      border-radius: 9999px;
      background: transparent;
      color: rgba(247, 247, 242, 0.72);
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background-color 200ms ease, color 200ms ease, transform 180ms ease;
    }
    .set-tab-dark:hover { color: #F7F7F2; }
    .set-tab-dark[aria-selected="true"] {
      background: #F7F7F2;
      color: #181B16;
    }
    .set-tab-panel {
      display: flex;
      flex-direction: column;
      gap: 18px;
      animation: drawer-reveal 340ms cubic-bezier(0.32, 0.72, 0, 1) both;
    }
    .set-card {
      background: #FFFFFF;
      border: 1px solid #EAECE6;
      border-radius: 20px;
      padding: 20px 22px;
    }
    .set-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .set-card-title {
      margin: 0;
      font-size: 15.5px;
      font-weight: 700;
      color: #181B16;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .set-card-title svg {
      width: 17px;
      height: 17px;
      color: #64695F;
      flex-shrink: 0;
    }
    .set-card-sub {
      font-size: 13px;
      font-weight: 500;
      color: #64695F;
      font-variant-numeric: tabular-nums;
    }
    .set-metric-pill {
      display: inline-flex;
      align-items: center;
      height: 28px;
      padding: 0 12px;
      border-radius: 9999px;
      background: #E9F2EC;
      color: #1F4E36;
      font-size: 12.5px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .set-hist-list {
      display: flex;
      flex-direction: column;
    }
    .set-hist-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 13px 0;
      border-bottom: 1px solid #EFEFE9;
    }
    .set-hist-row:last-child {
      border-bottom: 0;
      padding-bottom: 2px;
    }
    .set-hist-main {
      min-width: 0;
      flex: 1;
    }
    .set-hist-title {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #181B16;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .set-hist-date {
      display: block;
      margin-top: 2px;
      font-size: 12.5px;
      color: #64695F;
      font-variant-numeric: tabular-nums;
    }
    .set-hist-right {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;
    }
    .set-score-badge {
      font-size: 13.5px;
      font-weight: 700;
      color: #181B16;
      font-variant-numeric: tabular-nums;
      min-width: 52px;
      text-align: right;
    }
    .set-btn {
      height: 36px;
      padding: 0 15px;
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
      cursor: pointer;
      text-decoration: none;
      white-space: nowrap;
      transition: background-color 200ms ease, border-color 200ms ease, color 200ms ease, transform 180ms ease;
    }
    .set-btn:hover:not(:disabled) {
      background: #EBEDE6;
      border-color: #181B16;
    }
    .set-btn:active:not(:disabled),
    .set-tab-dark:active {
      transform: scale(0.985);
    }
    .set-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .set-btn svg { width: 14px; height: 14px; }
    .set-btn--primary {
      background: #181B16;
      border-color: #181B16;
      color: #F7F7F2;
    }
    .set-btn--primary:hover:not(:disabled) {
      background: #2C3028;
      border-color: #2C3028;
    }
    .set-btn--danger {
      color: #B8433A;
      border-color: rgba(184, 67, 58, 0.28);
    }
    .set-btn--danger:hover:not(:disabled) {
      background: #F8EAE8;
      border-color: #B8433A;
    }
    .set-avatar-edit {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
      margin-bottom: 18px;
    }
    .set-avatar-md {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #EBEDE6;
      color: #181B16;
      display: grid;
      place-items: center;
      font-size: 18px;
      font-weight: 700;
      flex-shrink: 0;
      overflow: hidden;
    }
    .set-form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .set-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .set-label {
      font-size: 12.5px;
      font-weight: 600;
      color: #64695F;
    }
    .set-input {
      width: 100%;
      height: 40px;
      padding: 0 13px;
      border-radius: 12px;
      border: 1px solid #D3D7CB;
      background: #F7F7F2;
      color: #181B16;
      font-family: inherit;
      font-size: 14px;
      box-sizing: border-box;
      outline: none;
      transition: border-color 180ms ease, background-color 180ms ease;
    }
    .set-input:focus {
      background: #FFFFFF;
      border-color: #181B16;
    }
    .set-input::placeholder {
      color: #5C6158;
      opacity: 1;
    }
    .set-input:disabled {
      opacity: 0.72;
      cursor: not-allowed;
    }
    .set-empty {
      padding: 28px 16px;
      text-align: center;
      color: #64695F;
      font-size: 13.5px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    @media (max-width: 760px) {
      .set-wrap { padding: 16px 14px 48px; }
      .set-tabs-dark { width: 100%; }
      .set-tab-dark { flex: 1; }
      .set-form-grid { grid-template-columns: 1fr; }
      .set-hist-row { flex-direction: column; align-items: stretch; gap: 8px; }
      .set-hist-right { justify-content: space-between; }
    }
  </style>
`;

const ROLE_LABELS = {
  admin: 'Quản trị',
  teacher: 'Giáo viên',
  student: 'Học sinh',
};

function renderOnlineChartCard(onlineHistory) {
  const totalMin = Math.round(onlineHistory.reduce((sum, d) => sum + Number(d.val || 0), 0) * 10) / 10;
  const todayMin = Number(onlineHistory.find((d) => d.isToday)?.val || 0);
  const rawMax = Math.max(60, ...onlineHistory.map((d) => Number(d.val || 0)));
  const stepMax = Math.ceil(rawMax / 20) * 20;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(stepMax * t));

  const x0 = 52;
  const x1 = 720;
  const y0 = 148;
  const h = 118;
  const pts = onlineHistory.map((item, i) => {
    const x = x0 + (i * (x1 - x0)) / Math.max(1, onlineHistory.length - 1);
    const y = y0 - (Number(item.val || 0) / stepMax) * h;
    return { x, y, val: Number(item.val || 0), dayLabel: item.dayLabel, isToday: item.isToday };
  });

  const linePts = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPts = `${x0},${y0} ${linePts} ${x1},${y0}`;

  return `
    <section class="set-card">
      <div class="set-card-head">
        <h2 class="set-card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <span>Online 14 ngày</span>
        </h2>
        <span class="set-metric-pill">Hôm nay ${todayMin}p &middot; Tổng ${totalMin}p</span>
      </div>
      <div style="width:100%;overflow-x:auto;">
        <svg viewBox="0 0 756 196" style="width:100%;min-width:560px;height:196px;font-family:'Google Sans',sans-serif;">
          <defs>
            <linearGradient id="nh-chart-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#181B16" stop-opacity="0.22" />
              <stop offset="100%" stop-color="#181B16" stop-opacity="0" />
            </linearGradient>
          </defs>
          ${ticks.map((val, idx) => {
            const y = y0 - (idx * h) / 4;
            return `
              <line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${idx === 0 ? '#D3D7CB' : '#EFEFE9'}" stroke-dasharray="${idx === 0 ? '' : '3 3'}" />
              <text x="4" y="${y + 4}" fill="#64695F" font-size="10.5" font-weight="600">${val}p</text>
            `;
          }).join('')}
          <polygon fill="url(#nh-chart-gradient)" points="${areaPts}" />
          <polyline fill="none" stroke="#181B16" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" points="${linePts}" />
          ${pts.map((p) => `
            <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.isToday ? '5.5' : '3.5'}" fill="#181B16" stroke="#FFFFFF" stroke-width="2" style="cursor:pointer;">
              <title>${p.dayLabel}${p.isToday ? ' (Hôm nay)' : ''}: ${p.val} phút online</title>
            </circle>
            <text x="${p.x.toFixed(1)}" y="176" fill="${p.isToday ? '#181B16' : '#64695F'}" font-size="10" font-weight="${p.isToday ? '700' : '500'}" text-anchor="middle">${p.dayLabel}</text>
          `).join('')}
        </svg>
      </div>
    </section>
  `;
}

function renderHistoryCard(submittedHistory) {
  return `
    <section class="set-card">
      <div class="set-card-head">
        <h2 class="set-card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>
          <span>Lịch sử làm bài</span>
        </h2>
        ${submittedHistory.length ? `<span class="set-card-sub">${submittedHistory.length} bài</span>` : ''}
      </div>
      ${submittedHistory.length ? `
        <div class="set-hist-list">
          ${submittedHistory.map((item) => {
            const title = item.assignments?.title || 'Bài tập';
            const scoreVal = item.score_10 !== undefined && item.score_10 !== null ? `${formatScore(item.score_10)}/10` : formatScore(item.score ?? 0);
            const timeText = item.submitted_at ? formatDateTime(item.submitted_at) : '-';
            return `
              <article class="set-hist-row">
                <div class="set-hist-main">
                  <span class="set-hist-title">${escapeHtml(title)}</span>
                  <span class="set-hist-date">${escapeHtml(timeText)}</span>
                </div>
                <div class="set-hist-right">
                  <span class="set-score-badge">${escapeHtml(scoreVal)}</span>
                  <a class="set-btn" href="#/review/${escapeHtml(item.id)}">
                    <span>Xem bài</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </a>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="set-empty">
          <span>Chưa có bài nộp.</span>
          <a class="set-btn" href="#/learn">Vào học</a>
        </div>
      `}
    </section>
  `;
}

function renderAccountTab(profile, initial) {
  return `
    <section class="set-card">
      <div class="set-card-head">
        <h2 class="set-card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Thông tin cá nhân</span>
        </h2>
      </div>
      <div class="set-avatar-edit">
        <span class="set-avatar-md">
          ${profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" alt="Avatar" />` : escapeHtml(initial)}
        </span>
        <input id="avatar-file-input" type="file" accept="image/png,image/jpeg,image/webp" hidden />
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button id="avatar-upload-btn" type="button" class="set-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span>Đổi ảnh</span>
          </button>
          <button id="avatar-remove-btn" type="button" class="set-btn set-btn--danger" ${profile.avatar_url ? '' : 'disabled'}>
            <span>Gỡ ảnh</span>
          </button>
        </div>
      </div>

      <form id="profile-edit-form">
        <div class="set-form-grid">
          <div class="set-field">
            <label class="set-label" for="full_name_input">Tên hiển thị</label>
            <input
              id="full_name_input"
              type="text"
              name="full_name"
              class="set-input"
              value="${escapeHtml(profile.full_name || '')}"
              placeholder="Nhập tên hiển thị..."
              required
            />
          </div>
          <div class="set-field">
            <label class="set-label" for="profile_email_input">Email đăng nhập</label>
            <input
              id="profile_email_input"
              type="text"
              class="set-input"
              value="${escapeHtml(profile.email || '')}"
              disabled
            />
          </div>
        </div>
        <div style="margin-top:14px;display:flex;justify-content:flex-end;">
          <button id="set-save-name-btn" type="submit" class="set-btn set-btn--primary">Lưu</button>
        </div>
      </form>
    </section>

    <section class="set-card">
      <div class="set-card-head">
        <h2 class="set-card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Bảo mật</span>
        </h2>
      </div>
      <form id="password-edit-form">
        <div class="set-form-grid">
          <div class="set-field">
            <label class="set-label" for="new_password_input">Mật khẩu mới</label>
            <input
              id="new_password_input"
              type="password"
              name="password"
              class="set-input"
              minlength="6"
              autocomplete="new-password"
              placeholder="Tối thiểu 6 ký tự"
              required
            />
          </div>
          <div class="set-field">
            <label class="set-label" for="confirm_password_input">Nhập lại mật khẩu</label>
            <input
              id="confirm_password_input"
              type="password"
              name="confirm_password"
              class="set-input"
              minlength="6"
              autocomplete="new-password"
              placeholder="Nhập lại mật khẩu"
              required
            />
          </div>
        </div>
        <div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <button id="set-logout-btn" type="button" class="set-btn set-btn--danger">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span>Đăng xuất</span>
          </button>
          <button id="set-save-pw-btn" type="submit" class="set-btn set-btn--primary">Đổi mật khẩu</button>
        </div>
      </form>
    </section>
  `;
}

export async function mountSettings(options = {}) {
  const root = pageRoot();
  let activeTab = options.tab === 'account' ? 'account' : 'overview';

  root.innerHTML = `
    ${SETTINGS_STYLES}
    <section class="set-wrap" data-skeleton="true">
      <div class="asg-overview-hero" style="opacity:0.9;">
        <div class="skeleton" style="width:90px;height:14px;opacity:0.25;"></div>
        <div class="skeleton" style="width:260px;max-width:80%;height:38px;opacity:0.35;"></div>
      </div>
      <div class="set-card" style="display:grid;gap:14px;">
        <div class="skeleton" style="width:200px;height:18px;border-radius:8px;"></div>
        <div class="skeleton" style="width:100%;height:150px;border-radius:12px;"></div>
      </div>
    </section>
  `;

  let historyData = [];
  try {
    historyData = (await fetchMyHistory({ limit: 15 })) || [];
  } catch (err) {
    console.warn('Failed loading profile history:', err);
  }

  const submittedHistory = historyData.filter((item) => item.status === 'submitted' || item.submitted_at);
  const onlineHistory = getPast30DaysOnlineData();

  function renderPage() {
    const profile = state.profile || {};
    const initial = accountInitial(profile);
    const fullName = profile.full_name || profile.email?.split('@')[0] || 'Thành viên';
    const email = profile.email || '';
    const roleLabel = ROLE_LABELS[profile.role] || 'Thành viên';

    root.innerHTML = `
      ${SETTINGS_STYLES}
      <section class="set-wrap">
        <header class="asg-overview-hero">
          <a href="#/learn" class="phase-back-link">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            <span>Trang chủ</span>
          </a>
          <div class="asg-overview-hero-row">
            <div class="set-hero-user">
              <span class="set-avatar-lg">
                ${profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" alt="Avatar" />` : escapeHtml(initial)}
              </span>
              <div style="min-width:0;">
                <h1 class="phase-hero-title">${escapeHtml(fullName)}</h1>
                <p class="set-hero-sub">
                  <span class="set-role-pill">${escapeHtml(roleLabel)}</span>${escapeHtml(email)}
                </p>
              </div>
            </div>
            <div class="asg-overview-hero-actions">
              <div class="set-tabs-dark" role="tablist">
                <button type="button" class="set-tab-dark" data-set-tab="overview" aria-selected="${activeTab === 'overview'}">Tổng quan</button>
                <button type="button" class="set-tab-dark" data-set-tab="account" aria-selected="${activeTab === 'account'}">Tài khoản</button>
              </div>
            </div>
          </div>
        </header>

        <div class="set-tab-panel" id="set-tab-panel">
          ${activeTab === 'account'
            ? renderAccountTab(profile, initial)
            : `${renderOnlineChartCard(onlineHistory)}${renderHistoryCard(submittedHistory)}`}
        </div>
      </section>
    `;

    root.querySelectorAll('[data-set-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextTab = btn.dataset.setTab;
        if (nextTab === activeTab) return;
        activeTab = nextTab;
        root.querySelectorAll('[data-set-tab]').forEach((b) => {
          b.setAttribute('aria-selected', b.dataset.setTab === activeTab ? 'true' : 'false');
        });
        const panel = root.querySelector('#set-tab-panel');
        if (panel) {
          const freshProfile = state.profile || {};
          const freshInitial = accountInitial(freshProfile);
          panel.style.animation = 'none';
          void panel.offsetWidth;
          panel.style.animation = '';
          panel.innerHTML = activeTab === 'account'
            ? renderAccountTab(freshProfile, freshInitial)
            : `${renderOnlineChartCard(onlineHistory)}${renderHistoryCard(submittedHistory)}`;
          wireAccountActions();
        }
      });
    });

    wireAccountActions();
  }

  function wireAccountActions() {
    const profile = state.profile || {};
    const fileInput = root.querySelector('#avatar-file-input');
    const uploadBtn = root.querySelector('#avatar-upload-btn');
    const removeBtn = root.querySelector('#avatar-remove-btn');

    uploadBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', async (event) => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast('Ảnh đại diện không được vượt quá 5MB.', 'error');
        event.currentTarget.value = '';
        return;
      }
      const restore = setButtonLoading(uploadBtn, 'Đang tải...');
      try {
        const updatedProfile = await updateProfileAvatar(profile.id, file);
        state.profile = updatedProfile;
        restore();
        syncHeaderProfile();
        toast('Đã cập nhật avatar thành công.', 'success');
        renderPage();
      } catch (error) {
        restore();
        toast(error.message, 'error');
      }
    });

    removeBtn?.addEventListener('click', async () => {
      if (!profile.avatar_url) return;
      const restore = setButtonLoading(removeBtn, 'Đang gỡ...');
      try {
        const updatedProfile = await removeProfileAvatar(profile.id);
        state.profile = updatedProfile;
        restore();
        syncHeaderProfile();
        toast('Đã gỡ avatar.', 'success');
        renderPage();
      } catch (error) {
        restore();
        toast(error.message, 'error');
      }
    });

    root.querySelector('#profile-edit-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const nextName = form.elements.full_name.value.trim();
      const submitBtn = form.querySelector('#set-save-name-btn');
      if (!nextName) {
        toast('Tên hiển thị không được để trống.', 'error');
        form.elements.full_name.focus();
        return;
      }
      const restore = setButtonLoading(submitBtn, 'Đang lưu...');
      try {
        const updatedProfile = await updateProfileName(profile.id, nextName);
        state.profile = updatedProfile;
        restore();
        syncHeaderProfile();
        toast('Đã cập nhật tên hiển thị.', 'success');
        renderPage();
      } catch (error) {
        restore();
        toast(error.message, 'error');
      }
    });

    root.querySelector('#password-edit-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const pw = String(form.elements.password?.value || '');
      const confirmPw = String(form.elements.confirm_password?.value || '');
      if (pw.length < 6) {
        toast('Mật khẩu mới cần ít nhất 6 ký tự.', 'error');
        form.elements.password?.focus();
        return;
      }
      if (pw !== confirmPw) {
        toast('Mật khẩu nhập lại chưa khớp.', 'error');
        form.elements.confirm_password?.focus();
        return;
      }
      const pwBtn = form.querySelector('#set-save-pw-btn');
      const restore = setButtonLoading(pwBtn, 'Đang đổi...');
      try {
        await updateCurrentUserPassword(pw);
        form.reset();
        toast('Đã đổi mật khẩu thành công.', 'success');
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        restore();
      }
    });

    root.querySelector('#set-logout-btn')?.addEventListener('click', () => {
      const appEl = document.querySelector('#app');
      if (appEl) delete appEl.dataset.shellUser;
      state.session = null;
      state.profile = null;
      go('learn');
      render();
      signOut().catch((error) => toast(error.message, 'error'));
    });
  }

  renderPage();
}