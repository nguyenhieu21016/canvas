export function draftKey(userId, assignmentId) {
  return `lms:draft:${userId}:${assignmentId}`;
}

export function saveDraft(storage, userId, assignmentId, answers, timeSpent = {}) {
  storage.setItem(
    draftKey(userId, assignmentId),
    JSON.stringify({ answers, timeSpent, savedAt: new Date().toISOString() }),
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

export function editorDraftKey(userId, assignmentId = 'new') {
  return `lms:editorDraft:${userId || 'anon'}:${assignmentId || 'new'}`;
}

export function saveEditorDraft(storage, userId, assignmentId, editorState) {
  if (!storage || !editorState) return;
  try {
    storage.setItem(
      editorDraftKey(userId, assignmentId),
      JSON.stringify({
        assignment: editorState.assignment || {},
        questions: Array.isArray(editorState.questions) ? editorState.questions : [],
        latexSource: typeof editorState.latexSource === 'string' ? editorState.latexSource : '',
        savedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function loadEditorDraft(storage, userId, assignmentId) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(editorDraftKey(userId, assignmentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.assignment) return null;
    return {
      assignment: parsed.assignment,
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      latexSource: typeof parsed.latexSource === 'string' ? parsed.latexSource : '',
    };
  } catch {
    return null;
  }
}

export function clearEditorDraft(storage, userId, assignmentId) {
  if (!storage) return;
  try {
    storage.removeItem(editorDraftKey(userId, assignmentId));
  } catch {
    // Ignore storage errors
  }
}
