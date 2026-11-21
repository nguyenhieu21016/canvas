import { isManager, pageRoot } from './store.js';

export const routes = [];

export function addRoute(path, componentFn) {
  routes.push({ path, componentFn });
}

export function parseRoute(hash) {
  const path = hash.slice(2) || 'learn';
  const parts = path.split('/');
  return { name: parts[0], id: parts[1] };
}

export function route() {
  return parseRoute(window.location.hash);
}

export function go(path) {
  window.location.hash = `/${path}`;
}

let currentCleanup = null;

export function registerCleanup(fn) {
  currentCleanup = fn;
}

export async function mountCurrentRoute() {
  if (typeof currentCleanup === 'function') {
    try {
      currentCleanup();
    } catch (err) {
      console.warn('Error during route cleanup:', err);
    }
    currentCleanup = null;
  }

  const current = route();
  
  if (!isManager() && ['dashboard', 'content', 'assignments', 'students', 'manage', 'progress', 'salary', 'online', 'question-bank'].includes(current.name)) {
    go('learn');
    return;
  }

  const matchedRoute = routes.find(r => {
    const routeParts = r.path.split('/');
    if (routeParts.length === 1) return r.path === current.name;
    if (routeParts[1] === ':id') return routeParts[0] === current.name;
    return false;
  });

  if (matchedRoute) {
    const cleanup = await matchedRoute.componentFn(current.id);
    if (typeof cleanup === 'function') {
      currentCleanup = cleanup;
    }
    return cleanup;
  } else {
    go('learn');
  }
}

export function wireRouteRetry(root = pageRoot()) {
  root.querySelectorAll('[data-retry-route]').forEach((button) => {
    button.addEventListener('click', () => mountCurrentRoute());
  });
}
