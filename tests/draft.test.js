import { describe, expect, it } from 'vitest';
import { clearDraft, draftKey, loadDraft, saveDraft } from '../src/lib/draft.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
}

describe('draft storage', () => {
  it('uses stable user and assignment scoped keys', () => {
    expect(draftKey('u1', 'a1')).toBe('lms:draft:u1:a1');
  });

  it('saves, loads, and clears answer drafts', () => {
    const storage = memoryStorage();
    saveDraft(storage, 'u1', 'a1', { q1: 'A' });

    expect(loadDraft(storage, 'u1', 'a1').answers).toEqual({ q1: 'A' });

    clearDraft(storage, 'u1', 'a1');
    expect(loadDraft(storage, 'u1', 'a1')).toBeNull();
  });
});
