import { state, colorThemes } from '../store.js';
import { pageRoot } from '../main.js';
import { escapeHtml, setButtonLoading } from '../lib/html.js';
import { renderAccountAvatar, render, toast, setThemeMode, setColorTheme, APP_VERSION, APP_LAST_UPDATE } from '../main.js';
import { updateProfileAvatar, removeProfileAvatar, updateProfileName } from '../services/lmsApi.js';

export function mountSettings() {
  const root = pageRoot();
  const profileName = state.profile?.full_name ?? '';
  root.innerHTML = `
    <section class="settings-page">
      <div class="settings-main-column">
        <div class="panel settings-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Tài khoản</p>
              <h2>Thông tin cá nhân</h2>
            </div>
          </div>
          <div class="avatar-settings">
            ${renderAccountAvatar(state.profile, 'settings-avatar-preview')}
            <div class="avatar-settings-copy">
              <strong>Avatar</strong>
              <p class="muted">Ảnh sẽ được crop vuông và nén nhẹ trước khi lưu.</p>
            </div>
            <input id="avatar-input" type="file" accept="image/png,image/jpeg,image/webp" hidden>
            <div class="avatar-actions">
              <md-outlined-button id="avatar-upload-button" type="button">
                <md-icon slot="icon">photo_camera</md-icon>
                Đổi ảnh
              </md-outlined-button>
              <md-outlined-button id="avatar-remove-button" type="button" ${state.profile?.avatar_url ? '' : 'disabled'}>
                <md-icon slot="icon">person</md-icon>
                Gỡ ảnh
              </md-outlined-button>
            </div>
          </div>
          <form id="profile-name-form" class="settings-form">
            <md-outlined-text-field
              name="full_name"
              label="Tên hiển thị"
              value="${escapeHtml(profileName)}"
              required
            ></md-outlined-text-field>
            <md-filled-button type="submit">
              <md-icon slot="icon">save</md-icon>
              Lưu tên
            </md-filled-button>
          </form>
        </div>
        <div class="panel settings-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Giao diện</p>
              <h2>Cài đặt hiển thị</h2>
            </div>
          </div>
          <div class="settings-row">
            <div>
              <strong>Dark mode</strong>
              <p class="muted">Chuyển giao diện sang nền tối.</p>
            </div>
            <md-switch id="settings-dark-mode" ${state.theme === 'dark' ? 'selected' : ''} aria-label="Dark mode"></md-switch>
          </div>
          <div class="settings-color-row">
            <div>
              <strong>Màu giao diện</strong>
              <p class="muted">Chọn tông màu chính của web.</p>
            </div>
            <div class="theme-color-options" role="radiogroup" aria-label="Màu giao diện">
              ${colorThemes
                .map(
                  (theme) => `
                    <button
                      class="theme-color-option ${state.colorTheme === theme.id ? 'active' : ''}"
                      type="button"
                      data-color-theme="${escapeHtml(theme.id)}"
                      role="radio"
                      aria-checked="${state.colorTheme === theme.id ? 'true' : 'false'}"
                      aria-label="${escapeHtml(theme.label)}"
                      title="${escapeHtml(theme.label)}"
                    >
                      <span style="--swatch-color: ${escapeHtml(theme.color)}"></span>
                    </button>
                  `,
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="panel settings-panel app-info-panel">
        <div>
          <p class="eyebrow">Canvas</p>
          <div style="display: flex; align-items: center; gap: 12px;">
            <h2 style="margin: 0;">Canvas</h2>
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--md-sys-color-primary); background: var(--md-sys-color-primary-container); padding: 4px 10px; border-radius: 6px;">@nguyenhieu21016</span>
          </div>
        </div>
        <div class="app-info-list">
          <div>
            <span>Phiên bản</span>
            <strong>${escapeHtml(APP_VERSION)}</strong>
          </div>
          <div>
            <span>Cập nhật gần nhất</span>
            <strong>${escapeHtml(APP_LAST_UPDATE)}</strong>
          </div>
        </div>
      </div>
    </section>
  `;

  const avatarInput = document.querySelector('#avatar-input');
  const avatarButton = document.querySelector('#avatar-upload-button');
  const removeAvatarButton = document.querySelector('#avatar-remove-button');
  avatarButton?.addEventListener('click', () => avatarInput?.click());
  avatarInput?.addEventListener('change', async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const restore = setButtonLoading(avatarButton, 'Đang lưu...');

    try {
      const avatarBlob = await resizeAvatarFile(file);
      const updatedProfile = await updateProfileAvatar(state.profile?.id, avatarBlob);
      state.profile = updatedProfile;
      restore();
      toast('Đã cập nhật avatar.', 'success');
      render();
    } catch (error) {
      restore();
      toast(error.message, 'error');
    } finally {
      event.currentTarget.value = '';
    }
  });
  removeAvatarButton?.addEventListener('click', async () => {
    if (!state.profile?.avatar_url) return;
    const restore = setButtonLoading(removeAvatarButton, 'Đang gỡ...');

    try {
      const updatedProfile = await removeProfileAvatar(state.profile?.id);
      state.profile = updatedProfile;
      restore();
      toast('Đã gỡ avatar.', 'success');
      render();
    } catch (error) {
      restore();
      toast(error.message, 'error');
    }
  });

  document.querySelector('#profile-name-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const field = form.elements.full_name;
    const button = form.querySelector('md-filled-button');
    const nextName = field.value.trim();
    const restore = setButtonLoading(button, 'Đang lưu...');

    try {
      const updatedProfile = await updateProfileName(state.profile?.id, nextName);
      state.profile = updatedProfile;
      restore();
      toast('Đã cập nhật tên hiển thị.', 'success');
      render();
    } catch (error) {
      restore();
      toast(error.message, 'error');
    }
  });

  document.querySelector('#settings-dark-mode')?.addEventListener('change', (event) => {
    setThemeMode(event.currentTarget.selected ? 'dark' : 'light');
  });
  document.querySelectorAll('[data-color-theme]').forEach((button) => {
    button.addEventListener('click', () => {
      setColorTheme(button.dataset.colorTheme);
      render();
    });
  });
}