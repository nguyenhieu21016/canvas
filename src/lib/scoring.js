export const QUESTION_TYPES = Object.freeze({
  MCQ: 'mcq',
  TF4: 'tf4',
  SHORT: 'short',
});

export function normalizeShortAnswer(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return Boolean(value);
}

function answerAt(value, index) {
  if (Array.isArray(value)) return value[index];
  if (value && typeof value === 'object') return value[index] ?? value[String(index)];
  return undefined;
}

export function gradeQuestion(question, key, answer) {
  const points = Number(question?.points ?? key?.points ?? 0);
  const type = question?.type;

  if (type === QUESTION_TYPES.MCQ) {
    const expected = String(key?.correct_answer ?? '').trim().toUpperCase();
    const actual = String(answer ?? '').trim().toUpperCase();
    const isCorrect = actual !== '' && actual === expected;
    return { earned: isCorrect ? points : 0, max: points, isCorrect };
  }

  if (type === QUESTION_TYPES.TF4) {
    const correct = key?.correct_answer ?? [];
    const pointMap = Array.isArray(key?.points_map) ? key.points_map : null;
    let earned = 0;
    let compared = 0;

    for (let index = 0; index < 4; index += 1) {
      const expected = answerAt(correct, index);
      if (expected === undefined || expected === null) continue;
      const actual = answerAt(answer, index);
      if (actual === undefined || actual === null) continue;
      compared += 1;
      const itemPoint = Number(pointMap?.[index] ?? points / 4);
      if (toBoolean(actual) === toBoolean(expected)) {
        earned += itemPoint;
      }
    }

    const max = compared > 0 ? points : 0;
    return {
      earned: Number(earned.toFixed(4)),
      max,
      isCorrect: max > 0 && Math.abs(earned - max) < 0.0001,
    };
  }

  if (type === QUESTION_TYPES.SHORT) {
    const accepted = Array.isArray(key?.accepted_answers) ? key.accepted_answers : [];
    const actual = normalizeShortAnswer(answer);
    const isCorrect = actual !== '' && accepted.some((item) => normalizeShortAnswer(item) === actual);
    return { earned: isCorrect ? points : 0, max: points, isCorrect };
  }

  return { earned: 0, max: points, isCorrect: false };
}

export function gradeAttempt(questions, answersByQuestionId, keysByQuestionId) {
  const details = questions.map((question) => {
    const result = gradeQuestion(
      question,
      keysByQuestionId[question.id],
      answersByQuestionId[question.id],
    );
    return { questionId: question.id, ...result };
  });
  const earned = details.reduce((sum, item) => sum + item.earned, 0);
  const max = details.reduce((sum, item) => sum + item.max, 0);
  const score10 = max > 0 ? Math.round((earned / max) * 1000) / 100 : 0;

  return {
    earned: Number(earned.toFixed(4)),
    max: Number(max.toFixed(4)),
    score10,
    details,
  };
}
