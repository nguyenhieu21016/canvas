export function normalizeEditorQuestion(q) {
  return {
    id: q.id,
    content: q.content,
    type: q.type,
    options: q.options ? JSON.stringify(q.options) : '[]',
    correct_option: q.type === 'multiple_choice' ? q.correct_option : null,
    correct_text: q.type === 'short_answer' ? q.correct_text : null,
    explanation: q.explanation || null,
    solution_video_url: q.solution_video_url || null,
    solution_image_url: q.solution_image_url || null,
  };
}

export function normalizeAssignmentEditor(editor) {
  return {
    assignment: editor.assignment,
    questions: editor.questions.map(normalizeEditorQuestion),
    latexSource: editor.assignment.pdf_url === 'latex' ? editor.assignment.description : '',
  };
}
