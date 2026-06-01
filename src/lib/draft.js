export function draftKey(userId, assignmentId) {
  return `lms:draft:${userId}:${assignmentId}`;
}

export function saveDraft(storage, userId, assignmentId, answers) {
  storage.setItem(
    draftKey(userId, assignmentId),
    JSON.stringify({ answers, savedAt: new Date().toISOString() }),
  );
}

export function loadDraft(storage, userId, assignmentId) {
  const raw = storage.getItem(draftKey(userId, assignmentId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearDraft(storage, userId, assignmentId) {
  storage.removeItem(draftKey(userId, assignmentId));
}
