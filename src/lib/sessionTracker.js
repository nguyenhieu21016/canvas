// Precision Real-Time Active Session Tracker for CANVAS LMS

const STORAGE_KEY = 'canvas_real_active_online_logs';
const IDLE_TIMEOUT_MS = 90000; // 90 seconds of inactivity pauses tracking

let lastActivityTime = Date.now();
let isTrackerRunning = false;

function getTodayKey() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function initSessionTracker() {
  if (typeof window === 'undefined' || isTrackerRunning) return;
  isTrackerRunning = true;

  // Track user interaction events
  const onUserActivity = () => {
    lastActivityTime = Date.now();
  };

  ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'].forEach((evt) => {
    window.addEventListener(evt, onUserActivity, { passive: true });
  });

  // Pulse timer: runs every 5 seconds to increment active seconds if tab is active and visible
  setInterval(() => {
    const isVisible = document.visibilityState === 'visible';
    const isUserActive = (Date.now() - lastActivityTime) < IDLE_TIMEOUT_MS;

    if (isVisible && isUserActive) {
      addActiveSeconds(5);
    }
  }, 5000);
}

function addActiveSeconds(seconds) {
  try {
    const logs = getOnlineLogs();
    const todayKey = getTodayKey();
    
    // Store in seconds, compute display in minutes
    const currentSecs = (logs[todayKey] || 0) * 60 + seconds;
    logs[todayKey] = Math.round((currentSecs / 60) * 10) / 10; // 1 decimal precision, e.g. 2.5 minutes

    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch (err) {
    console.warn('Failed recording active time:', err);
  }
}

export function getOnlineLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // fallback
  }
  return {};
}

export function getPast30DaysOnlineData() {
  const logs = getOnlineLogs();
  const now = new Date();
  const result = [];
  const pastDaysCount = 14; // Show last 14 days (from past 0m up to Today real measured active minutes)

  for (let i = pastDaysCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const key = `${yyyy}-${mm}-${dd}`;
    const dayLabel = `${dd}/${mm}`;
    const isToday = i === 0;

    const val = Number(logs[key] || 0);

    result.push({ dayLabel, val, isToday, fullDate: key });
  }

  return result;
}
