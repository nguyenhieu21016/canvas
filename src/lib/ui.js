import { escapeHtml } from './html.js';

export function wireMaterialFormButtons(root = document) {
  if (!root) return;
  root.querySelectorAll('md-filled-button[type="submit"], md-filled-tonal-button[type="submit"], md-outlined-button[type="submit"]').forEach((button) => {
    if (button.dataset.formBridge === 'true') return;
    button.dataset.formBridge = 'true';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      if (button.disabled) return;
      button.closest('form')?.requestSubmit();
    });
  });

  root.querySelectorAll('md-filled-button[type="reset"], md-filled-tonal-button[type="reset"], md-outlined-button[type="reset"]').forEach((button) => {
    if (button.dataset.formBridge === 'true') return;
    button.dataset.formBridge = 'true';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      button.closest('form')?.reset();
    });
  });
}

export function toast(message, tone = 'info') {
  toastEl.textContent = message;
  toastEl.dataset.tone = tone;
  toastEl.classList.add('show');
  window.clearTimeout(toastEl._timer);
  toastEl._timer = window.setTimeout(() => toastEl.classList.remove('show'), 3600);
}

export function renderAccountAvatar(profile, className = 'account-avatar') {
  if (profile?.avatar_url) {
    return `
      <span class="${className} has-image" aria-hidden="true">
        <img src="${escapeHtml(profile.avatar_url)}" alt="">
      </span>
    `;
  }

  return `
    <span class="${className}" aria-hidden="true">
      ${escapeHtml(accountInitial(profile))}
    </span>
  `;
}

export function renderLoading(label = 'Đang tải dữ liệu') {
  return `
    <div class="loading-state">
      <md-circular-progress indeterminate></md-circular-progress>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

export function renderSkeletonDashboard() {
  return `
    <section class="students-dashboard" style="display: flex; flex-wrap: wrap; gap: 24px; align-items: stretch; opacity: 0.85; padding: var(--page-gutter);">
      <!-- Sidebar Skeleton -->
      <div style="display: flex; flex-direction: column; gap: 16px; width: 320px; min-width: 320px;">
        <div class="panel" style="padding: 16px; border-radius: var(--md-sys-shape-corner-large, 16px); background: var(--md-sys-color-surface-container-low); display: flex; flex-direction: column; gap: 12px;">
          <div class="skeleton" style="width: 140px; height: 20px; border-radius: 4px;"></div>
          <div style="display: flex; align-items: center; gap: 12px; padding: 12px;">
            <div class="skeleton" style="width: 40px; height: 40px; border-radius: 50%;"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
              <div class="skeleton" style="width: 100px; height: 16px; border-radius: 4px;"></div>
              <div class="skeleton" style="width: 140px; height: 12px; border-radius: 4px;"></div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; padding: 12px;">
            <div class="skeleton" style="width: 40px; height: 40px; border-radius: 50%;"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
              <div class="skeleton" style="width: 100px; height: 16px; border-radius: 4px;"></div>
              <div class="skeleton" style="width: 140px; height: 12px; border-radius: 4px;"></div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Details Panel Skeleton -->
      <div class="panel" style="flex: 1; padding: 24px; border-radius: var(--md-sys-shape-corner-large, 16px); background: var(--md-sys-color-surface-container-low); min-height: 480px; display: flex; flex-direction: column; gap: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div class="skeleton" style="width: 48px; height: 48px; border-radius: 50%;"></div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div class="skeleton" style="width: 180px; height: 24px; border-radius: 4px;"></div>
              <div class="skeleton" style="width: 120px; height: 14px; border-radius: 4px;"></div>
            </div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
          <div class="panel" style="background: var(--md-sys-color-surface-container-high); padding: 12px; border-radius: var(--md-sys-shape-corner-medium, 12px); display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div class="skeleton" style="width: 60px; height: 14px; border-radius: 4px;"></div>
            <div class="skeleton" style="width: 40px; height: 20px; border-radius: 4px;"></div>
          </div>
          <div class="panel" style="background: var(--md-sys-color-surface-container-high); padding: 12px; border-radius: var(--md-sys-shape-corner-medium, 12px); display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div class="skeleton" style="width: 60px; height: 14px; border-radius: 4px;"></div>
            <div class="skeleton" style="width: 40px; height: 20px; border-radius: 4px;"></div>
          </div>
          <div class="panel" style="background: var(--md-sys-color-surface-container-high); padding: 12px; border-radius: var(--md-sys-shape-corner-medium, 12px); display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div class="skeleton" style="width: 60px; height: 14px; border-radius: 4px;"></div>
            <div class="skeleton" style="width: 40px; height: 20px; border-radius: 4px;"></div>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function renderSkeletonAssignments() {
  return `
    <section class="assignment-manager" style="display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 18px; align-items: start; opacity: 0.85; padding: var(--page-gutter);">
      <!-- Sidebar List Skeleton -->
      <aside class="panel list-panel" style="border-radius: var(--md-sys-shape-corner-large, 16px); background: var(--md-sys-color-surface-container-low); padding: 16px; display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div class="skeleton" style="width: 120px; height: 22px;"></div>
          <div class="skeleton" style="width: 60px; height: 32px; border-radius: 16px;"></div>
        </div>
        <div style="padding: 12px 0; display: flex; flex-direction: column; gap: 6px;">
          <div class="skeleton" style="width: 80%; height: 18px;"></div>
          <div class="skeleton" style="width: 50%; height: 12px;"></div>
        </div>
        <div style="padding: 12px 0; display: flex; flex-direction: column; gap: 6px;">
          <div class="skeleton" style="width: 75%; height: 18px;"></div>
          <div class="skeleton" style="width: 40%; height: 12px;"></div>
        </div>
      </aside>

      <!-- Split workspace skeleton -->
      <div style="display: flex; flex-direction: column; gap: 18px;">
        <div class="panel" style="border-radius: var(--md-sys-shape-corner-large, 16px); background: var(--md-sys-color-surface-container-low); padding: 24px; display: flex; flex-direction: column; gap: 16px; height: 400px;">
          <div class="skeleton" style="width: 200px; height: 28px;"></div>
          <div class="skeleton" style="width: 100%; height: 44px; border-radius: 8px;"></div>
          <div class="skeleton" style="width: 100%; height: 200px; border-radius: 8px; margin-top: 12px;"></div>
        </div>
      </div>
    </section>
  `;
}

export function renderStateMessage({ tone = 'empty', icon = 'info', title, message = '', actionHref = '', actionLabel = '', actionIcon = 'arrow_forward', retry = false }) {
  return `
    <div class="${tone === 'error' ? 'error-state' : 'empty-state'} state-message">
      <md-icon>${escapeHtml(icon)}</md-icon>
      <div>
        <strong>${escapeHtml(title)}</strong>
        ${message ? `<p>${escapeHtml(message)}</p>` : ''}
      </div>
      ${
        actionHref && actionLabel
          ? `<a class="text-link state-action" href="${escapeHtml(actionHref)}"><md-icon>${escapeHtml(actionIcon)}</md-icon>${escapeHtml(actionLabel)}</a>`
          : ''
      }
      ${
        retry
          ? '<button class="text-link state-action" type="button" data-retry-route><md-icon>refresh</md-icon>Thử lại</button>'
          : ''
      }
    </div>
  `;
}

export function renderErrorState(error, message = 'Không tải được dữ liệu. Kiểm tra kết nối rồi thử lại.') {
  return renderStateMessage({
    tone: 'error',
    icon: 'error',
    title: error?.message || 'Có lỗi xảy ra',
    message,
    retry: true,
  });
}

export function renderScoreProgress(score) {
  const value = Math.max(0, Math.min(10, Number(score ?? 0)));
  return `
    <div class="score-progress" aria-label="Điểm ${formatScore(value)} trên 10">
      <span style="width: ${value * 10}%"></span>
    </div>
  `;
}

export function renderMetric(label, value, icon) {
  return `
    <article class="metric">
      <md-icon>${icon}</md-icon>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

export function wireTableSearch(inputSelector, rowSelector) {
  const input = document.querySelector(inputSelector);
  if (!input) return;

  input.addEventListener('input', () => {
    const keyword = input.value.trim().toLowerCase();
    document.querySelectorAll(rowSelector).forEach((row) => {
      const haystack = (row.dataset.search ?? '').toLowerCase();
      row.hidden = keyword !== '' && !haystack.includes(keyword);
    });
  });
}

