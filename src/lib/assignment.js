import { exportQuestionsToLatex, shuffleMcqChoices } from './examGenerator.js';

export function extractCategoryFromTitle(rawTitle = '') {
  const match = String(rawTitle || '').match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!match) {
    return { category: '', cleanTitle: String(rawTitle || '').trim() };
  }
  return { category: match[1].trim(), cleanTitle: match[2].trim() };
}

export function applyCategoryToTitle(rawTitle = '', rawCategory = '') {
  const customCategory = String(rawCategory || '').trim();
  let title = String(rawTitle || '').trim();
  if (customCategory && !title.startsWith(`[${customCategory}]`)) {
    if (/^\[[^\]]+\]\s*/.test(title)) {
      title = title.replace(/^\[[^\]]+\]\s*/, `[${customCategory}] `);
    } else {
      title = title ? `[${customCategory}] ${title}` : `[${customCategory}]`;
    }
  } else if (!customCategory && /^\[[^\]]+\]\s*/.test(title)) {
    title = title.replace(/^\[[^\]]+\]\s*/, '').trim();
  }
  return title;
}

export function normalizeEditorQuestion(q) {
  return {
    ...q,
    answer_key: q.answer_keys && q.answer_keys.length > 0 ? q.answer_keys[0] : null,
  };
}

export function normalizeAssignmentEditor(editor) {
  const questions = (editor.questions || []).map(normalizeEditorQuestion);
  const isLatexMode = !editor.assignment?.pdf_url || editor.assignment.pdf_url === 'latex';
  const rawDesc = String(editor.assignment?.description || '');
  let latexSource = '';
  if (isLatexMode) {
    if (rawDesc.includes('\\begin{ex}')) {
      latexSource = rawDesc;
    } else if (questions.length > 0) {
      latexSource = exportQuestionsToLatex(editor.assignment?.title, questions);
    } else {
      latexSource = rawDesc;
    }
  }
  return {
    assignment: editor.assignment,
    questions,
    latexSource,
  };
}

export function parseLatexAssignment(latexText) {
  const regex = /\\begin\{ex\}([\s\S]*?)\\end\{ex\}/g;
  let match;
  const questions = [];

  const extractBracketMatch = (text, startIndex) => {
    let depth = 0;
    let start = startIndex + 1;
    for (let i = start; i < text.length; i++) {
      let backslashCount = 0;
      let j = i - 1;
      while (j >= 0 && text[j] === '\\') {
        backslashCount++;
        j--;
      }
      if (backslashCount % 2 === 1) {
        continue;
      }

      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        if (depth === 0) {
          return { content: text.substring(start, i), endIndex: i };
        }
        depth--;
      }
    }
    return null;
  };

  while ((match = regex.exec(latexText)) !== null) {
    let rawContent = match[1].trim();
    let explanation = '';

    // Parse \loigiai{}
    const loigiaiIdx = rawContent.indexOf('\\loigiai');
    if (loigiaiIdx !== -1) {
      const openBracketIdx = rawContent.indexOf('{', loigiaiIdx);
      if (openBracketIdx !== -1) {
        const loigiaiMatch = extractBracketMatch(rawContent, openBracketIdx);
        if (loigiaiMatch) {
          explanation = loigiaiMatch.content.trim();
          rawContent = rawContent.substring(0, loigiaiIdx) + rawContent.substring(loigiaiMatch.endIndex + 1);
        }
      }
    }

    let type = 'mcq';
    let prompt = rawContent.trim();
    let choices = [];
    let correctAnswer = 'A';
    let tfStatements = ['', '', '', ''];
    let tfCorrect = [false, false, false, false];
    let shortAnswer = '';

    const choiceIdx = rawContent.indexOf('\\choice');
    const choiceTFIdx = rawContent.indexOf('\\choiceTF');
    const shortansIdx = rawContent.indexOf('\\shortans');

    if (choiceTFIdx !== -1) {
      type = 'tf4';
      prompt = rawContent.substring(0, choiceTFIdx).trim();
      let currentIdx = choiceTFIdx + '\\choiceTF'.length;

      for (let c = 0; c < 4; c++) {
        while (currentIdx < rawContent.length && /\s/.test(rawContent[currentIdx])) currentIdx++;
        if (rawContent[currentIdx] === '{') {
          const choiceMatch = extractBracketMatch(rawContent, currentIdx);
          if (choiceMatch) {
            let content = choiceMatch.content.trim();
            tfCorrect[c] = content.includes('\\True') || content.startsWith('\\True');
            tfStatements[c] = content.replace(/\\True\s*/g, '').replace(/\\False\s*/g, '').trim();
            currentIdx = choiceMatch.endIndex + 1;
          } else {
            break;
          }
        } else {
          break;
        }
      }
    } else if (choiceIdx !== -1) {
      type = 'mcq';
      prompt = rawContent.substring(0, choiceIdx).trim();
      let currentIdx = choiceIdx + '\\choice'.length;

      for (let c = 0; c < 4; c++) {
        while (currentIdx < rawContent.length && /\s/.test(rawContent[currentIdx])) currentIdx++;
        if (rawContent[currentIdx] === '{') {
          const choiceMatch = extractBracketMatch(rawContent, currentIdx);
          if (choiceMatch) {
            choices.push(choiceMatch.content.trim());
            currentIdx = choiceMatch.endIndex + 1;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      let correctIndex = choices.findIndex(c => c.includes('\\True') || c.startsWith('\\True'));
      if (correctIndex === -1) {
        const rawChoiceSection = rawContent.substring(choiceIdx);
        if (rawChoiceSection.includes('\\True')) {
          const bracketMatches = Array.from(rawChoiceSection.matchAll(/\{([^}]*)\}/g)).map(m => m[1]);
          correctIndex = bracketMatches.findIndex(b => b.includes('\\True'));
        }
      }

      if (correctIndex !== -1 && correctIndex < 4) {
        correctAnswer = ['A', 'B', 'C', 'D'][correctIndex];
      }
      
      choices = choices.map(c => c.replace(/\\True\s*/g, '').trim());
    } else if (shortansIdx !== -1) {
      type = 'short';
      prompt = rawContent.substring(0, shortansIdx).trim();
      let currentIdx = shortansIdx + '\\shortans'.length;
      while (currentIdx < rawContent.length && /\s/.test(rawContent[currentIdx])) currentIdx++;
      if (rawContent[currentIdx] === '{') {
        const shortMatch = extractBracketMatch(rawContent, currentIdx);
        if (shortMatch) {
          shortAnswer = shortMatch.content.trim();
        }
      }
    } else {
      type = 'short';
    }

    questions.push({
      type: type,
      prompt: prompt,
      choices: type === 'mcq' ? choices : undefined,
      points: 1,
      sort_order: questions.length + 1,
      settings: type === 'tf4' ? { explanation, statements: tfStatements } : { explanation },
      answer_key: type === 'short' 
        ? { accepted_answers: shortAnswer ? [shortAnswer] : [] } 
        : { correct_answer: type === 'tf4' ? tfCorrect : correctAnswer },
      startIndex: match.index,
    });
  }

  return questions;
}

const TYPE_SORT_ORDER = { mcq: 1, tf4: 2, short: 3 };

/**
 * Convert Question Bank items (or { q } matrix slots) into unified Assignment Editor state,
 * preserving full metadata (title, category, lecture_id, published) and generating EX_TEST LaTeX.
 * When `existingEditor` is passed, appends new questions onto the existing LaTeX source cleanly.
 */
export function buildAssignmentSeedFromBank(items = [], options = {}) {
  const {
    title = '',
    category = '',
    lectureId = '',
    published = true,
    shuffleChoices = false,
    existingEditor = null,
  } = options;

  const normalizedList = (items || [])
    .map((entry) => entry?.q || entry)
    .filter(Boolean)
    .sort((a, b) => (TYPE_SORT_ORDER[a.type] || 1) - (TYPE_SORT_ORDER[b.type] || 1));

  const prepared = normalizedList.map((q, idx) => {
    const rawKey = Array.isArray(q.answer_keys) ? q.answer_keys[0] : (q.answer_keys || q.answer_key);
    const keyObj = rawKey || { correct_answer: 'A' };
    const maybeShuffled = shuffleChoices && (q.type || 'mcq') === 'mcq'
      ? shuffleMcqChoices(q, keyObj)
      : { choices: q.choices || [], answerKey: keyObj };
    return {
      type: q.type || 'mcq',
      prompt: q.prompt || '',
      points: q.points || 1,
      sort_order: idx + 1,
      choices: maybeShuffled.choices,
      settings: q.settings || {},
      answer_key: maybeShuffled.answerKey,
    };
  });

  if (existingEditor) {
    const existingAssignment = existingEditor.assignment || {};
    const existingTitle = existingAssignment.title || applyCategoryToTitle(title, category);
    const existingLatex = String(existingEditor.latexSource || '').trim();
    const addedLatex = exportQuestionsToLatex(existingTitle, prepared)
      .split('\n')
      .filter((line, idx) => !(idx === 0 && line.startsWith('% ')))
      .join('\n')
      .trim();

    const combinedLatex = existingLatex
      ? `${existingLatex}\n\n${addedLatex}\n`
      : exportQuestionsToLatex(existingTitle, prepared);
    const reparsed = parseLatexAssignment(combinedLatex);

    return {
      assignment: {
        ...existingAssignment,
        pdf_url: 'latex',
        description: combinedLatex,
      },
      questions: reparsed.length ? reparsed : [...(existingEditor.questions || []), ...prepared],
      latexSource: combinedLatex,
    };
  }

  const finalTitle = applyCategoryToTitle(title || `Đề luyện tập (${prepared.length} câu)`, category);
  const latexSource = exportQuestionsToLatex(finalTitle, prepared);
  const reparsed = parseLatexAssignment(latexSource);

  return {
    assignment: {
      title: finalTitle,
      category: String(category || '').trim(),
      description: latexSource,
      pdf_url: 'latex',
      lecture_id: lectureId || '',
      sort_order: 0,
      published: published !== false,
    },
    questions: reparsed.length ? reparsed : prepared,
    latexSource,
  };
}
