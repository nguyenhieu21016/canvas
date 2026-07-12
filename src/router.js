import { isManager } from './store.js';

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

export async function mountCurrentRoute() {
  const current = route();
  
  if (!isManager() && ['dashboard', 'content', 'assignments', 'students', 'manage', 'progress', 'salary', 'online', 'grades'].includes(current.name)) {
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
    return matchedRoute.componentFn(current.id);
  } else {
    go('learn');
  }
}
