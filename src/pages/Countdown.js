import { pageRoot, daysUntilExam } from '../main.js';
import { escapeHtml } from '../lib/html.js';

export function mountCountdown() {
  const root = pageRoot();
  const days = daysUntilExam();
  const examDate = new Date(2027, 5, 11);
  const formattedExamDate = examDate.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  root.innerHTML = `
    <section class="countdown-page">
      <div class="countdown-hero">
        <div>
          <p class="eyebrow">THPTQG 2027</p>
          <h2>${days}</h2>
          <span>ngày</span>
        </div>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      </div>
      <div class="countdown-details">
        <article>
          <span>Ngày thi dự kiến</span>
          <strong>${escapeHtml(formattedExamDate)}</strong>
        </article>
      </div>
    </section>
  `;
}