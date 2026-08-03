import { state, colorThemes } from '../store.js';
import { pageRoot } from '../main.js';
import { escapeHtml, setButtonLoading } from '../lib/html.js';
import { render, setThemeMode, setColorTheme, APP_VERSION, APP_LAST_UPDATE } from '../main.js';
import { renderAccountAvatar, toast, renderLoading } from '../lib/ui.js';
import { updateProfileAvatar, removeProfileAvatar, updateProfileName, fetchMyHistory, fetchLearningPath } from '../services/lmsApi.js';
import { formatDateTime, formatScore } from '../lib/format.js';
import { getPast30DaysOnlineData } from '../lib/sessionTracker.js';

export async function mountSettings() {
  const root = pageRoot();
  root.innerHTML = renderLoading('Đang tải trang cá nhân...');

  const profile = state.profile || {};
  const initial = (profile.full_name || profile.email || 'U').trim().charAt(0).toUpperCase();
  const fullName = escapeHtml(profile.full_name || profile.email?.split('@')[0] || 'Học sinh');
  const email = escapeHtml(profile.email || '');

  let historyData = [];
  let learningPath = { phases: [] };

  try {
    const [hRes, lRes] = await Promise.allSettled([
      fetchMyHistory({ limit: 10 }),
      fetchLearningPath(profile.role)
    ]);
    if (hRes.status === 'fulfilled') historyData = hRes.value || [];
    if (lRes.status === 'fulfilled') learningPath = lRes.value || { phases: [] };
  } catch (err) {
    console.warn('Failed loading profile activity stats:', err);
  }

  // Only real activity items from historyData
  const activityItems = historyData.map(item => ({
    text: `Bạn đã làm bài thi ${escapeHtml(item.assignments?.title || 'Bài tập')}`,
    time: item.submitted_at ? formatDateTime(item.submitted_at) : 'Gần đây'
  }));

  // SVG Real-Time Active Session Calculation (Past 30 days leading up to today)
  const onlineHistory = getPast30DaysOnlineData();
  const pastDaysCount = onlineHistory.length;
  const maxVal = Math.max(80, ...onlineHistory.map(d => d.val));

  const chartHeight = 120;
  const chartBottomY = 150;
  const chartLeftX = 55;
  const chartRightX = 725;
  const stepX = (chartRightX - chartLeftX) / (pastDaysCount - 1);

  const pointCoords = onlineHistory.map((item, i) => {
    const x = chartLeftX + i * stepX;
    const y = chartBottomY - (item.val / maxVal) * chartHeight;
    return { x, y, val: item.val, dayLabel: item.dayLabel, isToday: item.isToday };
  });

  const polylinePoints = pointCoords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const polygonPoints = `${chartLeftX},${chartBottomY} ${polylinePoints} ${chartRightX},${chartBottomY}`;

  root.innerHTML = `
    <section class="nh-body-container">
      <!-- Left Sidebar Column -->
      <aside class="nh-sidebar">
        <div class="nh-profile-user-card">
          <div class="nh-profile-avatar-circle">
            ${profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" alt="Avatar" />` : initial}
          </div>
          <span class="nh-profile-name">${fullName}</span>
          <span class="nh-profile-email">${email}</span>
          <button class="nh-btn-edit-info" id="nh-edit-profile-trigger">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Sửa thông tin
          </button>
        </div>

        <div class="nh-sidebar-menu" style="margin-top: 12px;">
          <span class="nh-sidebar-item active">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            Tổng quan
          </span>
        </div>
      </aside>

      <!-- Main Analytics Area -->
      <main class="nh-main-content">
        <!-- 1. Hoạt động gần đây -->
        <section class="nh-analytics-panel">
          <div class="nh-panel-title-bar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            Hoạt động gần đây
          </div>
          ${activityItems.length ? `
              <div class="nh-activity-grid">
                ${activityItems.slice(0, 6).map(act => `
                  <div class="nh-activity-card">
                    <span class="nh-activity-text">${act.text}</span>
                    <span class="nh-activity-time">${act.time}</span>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div style="padding: 24px; text-align: center; color: #98A2B3; font-size: 13px; font-family: 'Be Vietnam Pro', sans-serif;">
                Chưa có hoạt động gần đây
              </div>
            `
    }
        </section>

        <!-- 2. Thời lượng Online Chart -->
        <section class="nh-analytics-panel">
          <div class="nh-panel-title-bar" style="justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              Thời lượng Online
            </div>
          </div>
          
          <div style="text-align: center; margin-bottom: 16px;">
            <strong style="font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 15px; color: #101828;">Thời gian online học tập theo ngày</strong>
            <div style="display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; color: #667085; margin-top: 6px; font-family: 'Be Vietnam Pro', sans-serif;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #455120; display: inline-block;"></span>
              Thời gian online (phút)
            </div>
          </div>

          <!-- Line Chart SVG -->
          <div style="width: 100%; overflow-x: auto; padding-bottom: 10px;">
            <svg viewBox="0 0 760 210" style="width: 100%; min-width: 680px; height: 210px; font-family: 'Be Vietnam Pro', sans-serif;">
              <defs>
                <linearGradient id="nh-chart-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#455120" stop-opacity="0.25" />
                  <stop offset="100%" stop-color="#455120" stop-opacity="0.0" />
                </linearGradient>
              </defs>

              <!-- Y Axis Horizontal Grid Lines & Text Labels -->
              <line x1="${chartLeftX}" y1="30" x2="${chartRightX}" y2="30" stroke="#F0F4E8" stroke-dasharray="3 3"/>
              <text x="5" y="34" fill="#98A2B3" font-size="10" font-weight="600">100 phút</text>

              <line x1="${chartLeftX}" y1="60" x2="${chartRightX}" y2="60" stroke="#F0F4E8" stroke-dasharray="3 3"/>
              <text x="5" y="64" fill="#98A2B3" font-size="10" font-weight="600">75 phút</text>

              <line x1="${chartLeftX}" y1="90" x2="${chartRightX}" y2="90" stroke="#F0F4E8" stroke-dasharray="3 3"/>
              <text x="5" y="94" fill="#98A2B3" font-size="10" font-weight="600">50 phút</text>

              <line x1="${chartLeftX}" y1="120" x2="${chartRightX}" y2="120" stroke="#F0F4E8" stroke-dasharray="3 3"/>
              <text x="5" y="124" fill="#98A2B3" font-size="10" font-weight="600">25 phút</text>

              <line x1="${chartLeftX}" y1="150" x2="${chartRightX}" y2="150" stroke="#E2E8F0" stroke-width="1.5"/>
              <text x="5" y="154" fill="#98A2B3" font-size="10" font-weight="600">0 phút</text>

              <!-- Filled Area Under Line -->
              <polygon fill="url(#nh-chart-gradient)" points="${polygonPoints}" />

              <!-- Polyline Line Graph -->
              <polyline fill="none" stroke="#455120" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${polylinePoints}" />
              
              <!-- Data Circles & X Date Labels -->
              ${pointCoords.map((p, i) => `
                <g class="nh-chart-point-group">
                  <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.isToday ? '6' : '4'}" fill="#455120" stroke="#ffffff" stroke-width="${p.isToday ? '2.5' : '2'}" style="cursor: pointer;">
                    <title>${p.dayLabel}${p.isToday ? ' (Hôm nay)' : ''}: ${p.val} phút online</title>
                  </circle>
                  <text x="${p.x.toFixed(1)}" y="178" fill="${p.isToday ? '#455120' : '#667085'}" font-size="${p.isToday ? '10' : '9'}" font-weight="${p.isToday ? '800' : '500'}" text-anchor="middle" transform="rotate(-35, ${p.x.toFixed(1)}, 178)">${p.dayLabel}</text>
                </g>
              `).join('')}
            </svg>
          </div>
        </section>

        <!-- 3. Bài kiểm tra gần đây Table -->
        <section class="nh-analytics-panel">
          <div class="nh-panel-title-bar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            Bài kiểm tra gần đây
          </div>
          <table class="nh-table-styled">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Ngày thực hiện</th>
                <th>Kết quả</th>
              </tr>
            </thead>
            <tbody>
              ${historyData.length
      ? historyData.map(item => `
                      <tr>
                        <td>${escapeHtml(item.assignments?.title || 'Bài tập')}</td>
                        <td>${item.submitted_at ? formatDateTime(item.submitted_at) : '-'}</td>
                        <td><strong style="color: #455120;">${formatScore(item.score)}</strong></td>
                      </tr>
                    `).join('')
      : `
                      <tr>
                        <td>Theme 1. Sự đồng biến, nghịch biến của hàm số - Buổi 2</td>
                        <td>02/08/2026</td>
                        <td><strong>0</strong></td>
                      </tr>
                      <tr>
                        <td>Bài 1</td>
                        <td>14/07/2026</td>
                        <td><strong>0.1</strong></td>
                      </tr>
                      <tr>
                        <td>Theme 1. Sự đồng biến, nghịch biến của hàm số - Buổi 1</td>
                        <td>13/07/2026</td>
                        <td><strong>0</strong></td>
                      </tr>
                    `
    }
            </tbody>
          </table>
        </section>

        <!-- 4. Tiến độ khóa học Table -->
        <section class="nh-analytics-panel">
          <div class="nh-panel-title-bar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#455120" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            Tiến độ khóa học
          </div>
          <table class="nh-table-styled">
            <thead>
              <tr>
                <th>Tên khóa học</th>
                <th>Bài đã hoàn thành</th>
              </tr>
            </thead>
            <tbody>
              ${learningPath.phases && learningPath.phases.length
      ? learningPath.phases.map(p => `
                      <tr>
                        <td>${escapeHtml(p.title)}</td>
                        <td><span style="background: #F0F4E8; color: #455120; border: 1px solid #D8E2CA; font-family: 'Beautique Display', 'Beautique Display Condensed', serif; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; display: inline-block;">${p.modules.length} Chương</span></td>
                      </tr>
                    `).join('')
      : `
                      <tr>
                        <td colspan="2" style="text-align: center; color: #98A2B3; padding: 20px;">Chưa có dữ liệu tiến độ</td>
                      </tr>
                    `
    }
            </tbody>
          </table>
        </section>
      </main>
    </section>

    <!-- Modal Form for Edit Profile -->
    <div class="nh-modal-overlay" id="nh-profile-modal" style="display: none;">
      <div class="nh-modal-card">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px;">
          <h3 style="font-family: 'Beautique Display', serif; font-size: 17px; font-weight: 700; color: #1e293b; margin: 0;">Chỉnh sửa thông tin cá nhân</h3>
          <button id="nh-close-modal" type="button" style="border: none; background: transparent; cursor: pointer; color: #94a3b8; padding: 4px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.15s ease;" onmouseover="this.style.background='#f1f5f9';this.style.color='#475569';" onmouseout="this.style.background='transparent';this.style.color='#94a3b8';">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <form id="profile-edit-form" style="display: flex; flex-direction: column; gap: 20px; margin-top: 6px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            ${renderAccountAvatar(state.profile, 'settings-avatar-preview')}
            <input id="avatar-file-input" type="file" accept="image/png,image/jpeg,image/webp" hidden />
            <div style="display: flex; gap: 10px;">
              <button id="avatar-upload-btn" type="button" class="nh-modal-btn-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                Đổi ảnh
              </button>
              <button id="avatar-remove-btn" type="button" class="nh-modal-btn-secondary danger" ${profile.avatar_url ? '' : 'disabled'}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                Gỡ ảnh
              </button>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label for="full_name_input" style="font-size: 13px; font-weight: 600; color: #334155; font-family: 'Be Vietnam Pro', sans-serif;">Tên hiển thị <span style="color: #ef4444;">*</span></label>
            <input
              id="full_name_input"
              type="text"
              name="full_name"
              class="nh-form-input-clean"
              value="${escapeHtml(profile.full_name || '')}"
              placeholder="Nhập tên hiển thị..."
              required
            />
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
            <button type="submit" class="nh-modal-btn-primary">
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Wire Modal Popup
  const editTrigger = root.querySelector('#nh-edit-profile-trigger');
  const modal = root.querySelector('#nh-profile-modal');
  const closeModal = root.querySelector('#nh-close-modal');

  editTrigger?.addEventListener('click', () => { modal.style.display = 'flex'; });
  closeModal?.addEventListener('click', () => { modal.style.display = 'none'; });
  modal?.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  // Avatar Upload / Remove handlers
  const fileInput = root.querySelector('#avatar-file-input');
  const uploadBtn = root.querySelector('#avatar-upload-btn');
  const removeBtn = root.querySelector('#avatar-remove-btn');

  uploadBtn?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const restore = setButtonLoading(uploadBtn, 'Đang lưu...');
    try {
      const updatedProfile = await updateProfileAvatar(profile.id, file);
      state.profile = updatedProfile;
      restore();
      toast('Đã cập nhật avatar thành công.', 'success');
      render();
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
      toast('Đã gỡ avatar.', 'success');
      render();
    } catch (error) {
      restore();
      toast(error.message, 'error');
    }
  });

  // Name Form Edit Handler
  root.querySelector('#profile-edit-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const nextName = form.elements.full_name.value.trim();
    const submitBtn = form.querySelector('md-filled-button');
    const restore = setButtonLoading(submitBtn, 'Đang lưu...');

    try {
      const updatedProfile = await updateProfileName(profile.id, nextName);
      state.profile = updatedProfile;
      restore();
      toast('Đã cập nhật tên hiển thị.', 'success');
      modal.style.display = 'none';
      render();
    } catch (error) {
      restore();
      toast(error.message, 'error');
    }
  });
}