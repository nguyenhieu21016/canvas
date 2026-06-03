import { describe, expect, it } from 'vitest';
import { gradeAttempt, gradeQuestion, normalizeShortAnswer } from '../src/lib/scoring.js';

describe('normalizeShortAnswer', () => {
  it('trims, lowercases, and collapses whitespace', () => {
    expect(normalizeShortAnswer('  Đáp   Án   A  ')).toBe('đáp án a');
  });
});

describe('gradeQuestion', () => {
  it('grades multiple choice', () => {
    const result = gradeQuestion(
      { type: 'mcq', points: 1 },
      { correct_answer: 'B' },
      'b',
    );
    expect(result).toEqual({ earned: 1, max: 1, isCorrect: true });
  });

  it('grades true/false four-part questions as one full question', () => {
    const result = gradeQuestion(
      { type: 'tf4', points: 2 },
      { correct_answer: [true, false, true, false] },
      [true, true, true, null],
    );
    expect(result.earned).toBe(0);
    expect(result.max).toBe(1);
    expect(result.isCorrect).toBe(false);
  });

  it('ignores custom point maps for true/false item scoring', () => {
    const result = gradeQuestion(
      { type: 'tf4', points: 3 },
      { correct_answer: [true, false, true, false], points_map: [0.25, 0.5, 1, 1.25] },
      [true, false, true, false],
    );
    expect(result.earned).toBe(1);
    expect(result.max).toBe(1);
  });

  it('grades accepted short answers exactly after normalization', () => {
    const result = gradeQuestion(
      { type: 'short', points: 1.5 },
      { accepted_answers: ['Hàm số bậc hai'] },
      ' hàm   số bậc hai ',
    );
    expect(result.earned).toBe(1);
  });
});

describe('gradeAttempt', () => {
  it('returns score on a 10-point scale rounded to one decimal by correct question count', () => {
    const result = gradeAttempt(
      [
        { id: 'q1', type: 'mcq', points: 1 },
        { id: 'q2', type: 'short', points: 2 },
        { id: 'q3', type: 'mcq', points: 5 },
      ],
      { q1: 'A', q2: 'wrong', q3: 'C' },
      {
        q1: { correct_answer: 'A' },
        q2: { accepted_answers: ['right'] },
        q3: { correct_answer: 'D' },
      },
    );
    expect(result.earned).toBe(1);
    expect(result.max).toBe(3);
    expect(result.score10).toBe(3.3);
  });
});
