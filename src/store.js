export const colorThemes = [
  { id: 'blue', label: 'Xanh biển', color: '#d3e4ff' },
  { id: 'yellow', label: 'Vàng', color: '#f8e287' },
  { id: 'green', label: 'Xanh lá', color: '#d9f0c3' },
  { id: 'lavender', label: 'Tím', color: '#eaddff' },
  { id: 'pink', label: 'Hồng', color: '#ffd8e4' },
];

const storedColorTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('lms:colorTheme') : null;

export const state = {
  session: null,
  profile: null,
  passwordRecovery: false,
  authMode: 'login', // 'login' | 'signup' | 'forgotPassword' | 'updatePassword'
  assignmentEditor: null,
  isEditingAssignment: false,
  theme: 'light',
  colorTheme: colorThemes.some((theme) => theme.id === storedColorTheme) ? storedColorTheme : 'blue',
};

export function isManager() {
  return state.profile?.role === 'admin' || state.profile?.role === 'teacher';
}

export function isAdmin() {
  return state.profile?.role === 'admin';
}

const detachedPageRoot = {
  isConnected: false,
  set innerHTML(_value) {},
  get innerHTML() {
    return '';
  },
};

export const APP_VERSION = '1.4.1';
export const APP_LAST_UPDATE = 'Sửa lỗi hiển thị hình ảnh và định dạng Markdown trong đề thi của học sinh. Cập nhật hệ thống render đồng bộ với giáo viên.';

export function applyTheme() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.color = state.colorTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    colorThemes.find((theme) => theme.id === state.colorTheme)?.color ?? '#d3e4ff',
  );
}

export function setThemeMode(_mode) {
  // Dark mode removed – always light
}

export function setColorTheme(colorTheme) {
  if (!colorThemes.some((theme) => theme.id === colorTheme)) return;
  state.colorTheme = colorTheme;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('lms:colorTheme', state.colorTheme);
  }
  applyTheme();
}

export function daysUntilExam() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const examDate = new Date(2027, 5, 11);
  return Math.max(0, Math.ceil((examDate - start) / 86_400_000));
}

export function pageRoot() {
  if (typeof document === 'undefined') return detachedPageRoot;
  return document.querySelector('#page-root') ?? detachedPageRoot;
}
