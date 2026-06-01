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
