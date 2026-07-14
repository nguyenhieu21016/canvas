export function formatDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatScore(value) {
  if (value === null || value === undefined) return '-';
  return Number(value).toFixed(1);
}

export function roleLabel(role) {
  return {
    student: 'Học sinh',
    teacher: 'Giáo viên',
    admin: 'Giáo viên',
  }[role] ?? role;
}
export function formatDuration(ms) { if (!ms || ms < 0) return '-'; const m = Math.floor(ms / 60000); const s = Math.floor((ms % 60000) / 1000); return `${m}p ${s}s`; }
