import { escapeHtml } from './html.js';
import { formatScore } from './format.js';

export function accountInitial(profile) {
  const name = (profile?.full_name || profile?.email || 'U').trim();
  const lastWord = name.split(/\s+/).filter(Boolean).at(-1) || name;
  return lastWord.charAt(0).toUpperCase();
}


export function toast(message, tone = 'info') {
  const toastEl = document.querySelector('#toast');
  if (!toastEl) return;
  
  let iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  if (tone === 'error') {
    iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
  } else if (tone === 'success') {
    iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
  }

  toastEl.innerHTML = `${iconSvg}<span>${message}</span>`;
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
    <div class="loading-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 48px; color: #455120;">
      <svg class="nh-spinner" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: nh-spin 0.8s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
      <span style="font-size: 14px; font-weight: 500;">${escapeHtml(label)}</span>
    </div>
  `;
}

export function renderSkeletonDashboard() {
  return `
    <section class="students-dashboard" style="display: flex; flex-wrap: wrap; gap: 24px; align-items: stretch; opacity: 0.85; padding: var(--page-gutter);">
      <!-- Sidebar Skeleton -->
      <div style="display: flex; flex-direction: column; gap: 16px; width: 320px; min-width: 320px;">
        <div class="panel" style="padding: 16px; border-radius: 16px; background: #ffffff; display: flex; flex-direction: column; gap: 12px;">
          <div class="skeleton" style="width: 140px; height: 20px; border-radius: 4px;"></div>
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
      <div class="panel" style="flex: 1; padding: 24px; border-radius: 16px; background: #ffffff; min-height: 480px; display: flex; flex-direction: column; gap: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div class="skeleton" style="width: 48px; height: 48px; border-radius: 50%;"></div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div class="skeleton" style="width: 180px; height: 24px; border-radius: 4px;"></div>
              <div class="skeleton" style="width: 120px; height: 14px; border-radius: 4px;"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function renderSkeletonAssignments() {
  return `
    <section class="assignment-manager" style="display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 18px; align-items: start; opacity: 0.85; padding: var(--page-gutter);">
      <aside class="panel list-panel" style="border-radius: 16px; background: #ffffff; padding: 16px; display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div class="skeleton" style="width: 120px; height: 22px;"></div>
          <div class="skeleton" style="width: 60px; height: 32px; border-radius: 16px;"></div>
        </div>
      </aside>

      <div style="display: flex; flex-direction: column; gap: 18px;">
        <div class="panel" style="border-radius: 16px; background: #ffffff; padding: 24px; display: flex; flex-direction: column; gap: 16px; height: 400px;">
          <div class="skeleton" style="width: 200px; height: 28px;"></div>
          <div class="skeleton" style="width: 100%; height: 200px; border-radius: 8px; margin-top: 12px;"></div>
        </div>
      </div>
    </section>
  `;
}

export function renderStateMessage({ tone = 'empty', icon = 'info', title, message = '', actionHref = '', actionLabel = '', retry = false }) {
  return `
    <div class="${tone === 'error' ? 'error-state' : 'empty-state'} state-message" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 48px; text-align: center;">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.7;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      <div>
        <strong style="font-size: 16px; font-weight: 700; color: #1e293b; display: block; margin-bottom: 4px;">${escapeHtml(title)}</strong>
        ${message ? `<p style="font-size: 13.5px; color: #64748b; margin: 0;">${escapeHtml(message)}</p>` : ''}
      </div>
      ${
        actionHref && actionLabel
          ? `<a class="text-link state-action" href="${escapeHtml(actionHref)}">${escapeHtml(actionLabel)}</a>`
          : ''
      }
      ${
        retry
          ? '<button class="text-link state-action" type="button" data-retry-route style="padding: 8px 16px; border-radius: 9999px; background: #F0F4E8; color: #455120; border: 1px solid #D8E2CA; font-weight: 600; cursor: pointer;">Thử lại</button>'
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

export function renderMetric(label, value) {
  return `
    <article class="metric">
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

