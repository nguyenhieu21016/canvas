export function normalizeEditorQuestion(q) {
  return {
    ...q,
    answer_key: q.answer_keys && q.answer_keys.length > 0 ? q.answer_keys[0] : null,
  };
}

export function normalizeAssignmentEditor(editor) {
  return {
    assignment: editor.assignment,
    questions: editor.questions.map(normalizeEditorQuestion),
    latexSource: editor.assignment.pdf_url === 'latex' ? editor.assignment.description : '',
  };
}
