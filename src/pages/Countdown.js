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
        <md-icon>event</md-icon>
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