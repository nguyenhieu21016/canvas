export function formatDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatScore(value) {
  if (value === null || value === undefined) return '-';
  return Number(value).toFixed(2);
}

export function roleLabel(role) {
  return {
    student: 'Học sinh',
    teacher: 'Giáo viên',
    admin: 'Giáo viên',
  }[role] ?? role;
}
