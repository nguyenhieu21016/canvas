import { escapeHtml } from './html.js';

const DRIVE_FILE_PATTERNS = [
  /drive\.google\.com\/file\/d\/([^/]+)/i,
  /drive\.google\.com\/open\?id=([^&]+)/i,
  /drive\.google\.com\/uc\?id=([^&]+)/i,
];

const DOC_PREVIEW_PATTERNS = [
  /(docs\.google\.com\/presentation\/d\/[^/]+)\/(?:edit|view|preview)?/i,
  /(docs\.google\.com\/document\/d\/[^/]+)\/(?:edit|view|preview)?/i,
];

export function toDrivePreviewUrl(rawUrl) {
  if (!rawUrl) return null;

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const normalized = url.toString();
  for (const pattern of DRIVE_FILE_PATTERNS) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      return `https://drive.google.com/file/d/${encodeURIComponent(match[1])}/preview`;
    }
  }

  for (const pattern of DOC_PREVIEW_PATTERNS) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      return `https://${match[1]}/preview`;
    }
  }

  return null;
}

export function canEmbedDrive(rawUrl) {
  return Boolean(toDrivePreviewUrl(rawUrl));
}

export function driveFrame(url, title, embed = false) {
  if (!url) return '';
  if (embed) {
    const preview = toDrivePreviewUrl(url);
    if (!preview) {
      return `
        <div class="empty-state">
          <md-icon>open_in_new</md-icon>
          <a class="text-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer noopener">Mở tài liệu</a>
        </div>
      `;
    }
    return `<iframe class="doc-frame" src="${escapeHtml(preview)}" title="${escapeHtml(title)}" loading="lazy"></iframe>`;
  }
  // default: show a button that opens the lecture link in a new tab
  return `
    <div class="drive-link">
      <a class="nh-lecture-slide-btn" href="${escapeHtml(url)}" target="_blank" rel="noreferrer noopener">
        <md-icon style="font-size: 18px; color: #455120;">open_in_new</md-icon>
        <span>Mở bài giảng</span>
      </a>
    </div>
  `;
}
