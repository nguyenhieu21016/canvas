export const colorThemes = [
  { id: 'blue', label: 'Xanh biển', color: '#d3e4ff' },
  { id: 'yellow', label: 'Vàng', color: '#f8e287' },
  { id: 'green', label: 'Xanh lá', color: '#d9f0c3' },
  { id: 'lavender', label: 'Tím', color: '#eaddff' },
  { id: 'pink', label: 'Hồng', color: '#ffd8e4' },
];

const storedColorTheme = localStorage.getItem('lms:colorTheme');

export const state = {
  session: null,
  profile: null,
  passwordRecovery: false,
  authMode: 'login', // 'login' | 'signup' | 'forgotPassword' | 'updatePassword'
  assignmentEditor: null,
  theme: localStorage.getItem('lms:theme') || 'light',
  colorTheme: colorThemes.some((theme) => theme.id === storedColorTheme) ? storedColorTheme : 'blue',
};

export function isManager() {
  return state.profile?.role === 'admin' || state.profile?.role === 'teacher';
}

export function isAdmin() {
  return state.profile?.role === 'admin';
}

export function pageRoot() {
  const shell = document.querySelector('.app-shell');
  return shell || document.querySelector('#app');
}
