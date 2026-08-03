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
export function formatAnswer(val) {
  if (val === null || val === undefined || val === '') return 'Chưa trả lời';
  if (typeof val === 'boolean') return val ? 'Đúng' : 'Sai';
  if (Array.isArray(val)) return val.map(formatAnswer).join(', ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}
