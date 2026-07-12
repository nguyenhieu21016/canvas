export const state = {
  session: null,
  profile: null,
  passwordRecovery: false,
  authMode: 'login', // 'login' | 'signup' | 'forgotPassword' | 'updatePassword'
};

export function isManager() {
  return state.profile?.role === 'admin' || state.profile?.role === 'teacher';
}

export function pageRoot() {
  const shell = document.querySelector('.app-shell');
  return shell || document.querySelector('#app');
}
