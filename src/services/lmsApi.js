import { supabase } from './supabaseClient.js';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase chưa được cấu hình. Tạo .env từ .env.example rồi khởi động lại dev server.');
  }
  return supabase;
}

function assertOk({ error }) {
  if (error) throw error;
}

export async function getSession() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  assertOk({ error });
  return data.session;
}

export async function signIn(email, password) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  assertOk({ error });
  return data.session;
}

export async function signUpStudent({ email, password, fullName }) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
  assertOk({ error });
  return data;
}

export async function signOut() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  assertOk({ error });
}

export async function getCurrentProfile() {
  const client = requireSupabase();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  assertOk({ error: userError });
  if (!user) return null;

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  assertOk({ error });
  return data;
}

export async function fetchLearningPath(role = 'student') {
  const client = requireSupabase();
  const shouldFilterPublished = role === 'student';

  let phasesQuery = client.from('phases').select('*').order('sort_order').order('created_at');
  let modulesQuery = client.from('modules').select('*').order('sort_order').order('created_at');
  let lecturesQuery = client.from('lectures').select('*').order('sort_order').order('created_at');
  let assignmentsQuery = client.from('assignments').select('*').order('sort_order').order('created_at');

  if (shouldFilterPublished) {
    phasesQuery = phasesQuery.eq('published', true);
    modulesQuery = modulesQuery.eq('published', true);
    lecturesQuery = lecturesQuery.eq('published', true);
    assignmentsQuery = assignmentsQuery.eq('published', true);
  }

  const [phasesResult, modulesResult, lecturesResult, assignmentsResult] = await Promise.all([
    phasesQuery,
    modulesQuery,
    lecturesQuery,
    assignmentsQuery,
  ]);
  [phasesResult, modulesResult, lecturesResult, assignmentsResult].forEach(assertOk);

  const modulesByPhase = new Map();
  const lecturesByModule = new Map();
  const assignmentsByLecture = new Map();
  const freeAssignments = [];

  for (const module of modulesResult.data ?? []) {
    if (!modulesByPhase.has(module.phase_id)) modulesByPhase.set(module.phase_id, []);
    modulesByPhase.get(module.phase_id).push({ ...module, lectures: [] });
  }

  for (const lecture of lecturesResult.data ?? []) {
    if (!lecturesByModule.has(lecture.module_id)) lecturesByModule.set(lecture.module_id, []);
    lecturesByModule.get(lecture.module_id).push({ ...lecture, assignments: [] });
  }

  for (const assignment of assignmentsResult.data ?? []) {
    if (!assignment.lecture_id) {
      freeAssignments.push(assignment);
      continue;
    }
    if (!assignmentsByLecture.has(assignment.lecture_id)) {
      assignmentsByLecture.set(assignment.lecture_id, []);
    }
    assignmentsByLecture.get(assignment.lecture_id).push(assignment);
  }

  for (const moduleList of modulesByPhase.values()) {
    for (const module of moduleList) {
      module.lectures = lecturesByModule.get(module.id) ?? [];
      for (const lecture of module.lectures) {
        lecture.assignments = assignmentsByLecture.get(lecture.id) ?? [];
      }
    }
  }

  const phases = (phasesResult.data ?? []).map((phase) => ({
    ...phase,
    modules: modulesByPhase.get(phase.id) ?? [],
  }));

  return {
    phases,
    modules: modulesResult.data ?? [],
    lectures: lecturesResult.data ?? [],
    assignments: assignmentsResult.data ?? [],
    freeAssignments,
  };
}

export async function upsertPhase(payload) {
  const client = requireSupabase();
  const { data, error } = await client.from('phases').upsert(payload).select().single();
  assertOk({ error });
  return data;
}

export async function deletePhase(id) {
  const client = requireSupabase();
  const { error } = await client.from('phases').delete().eq('id', id);
  assertOk({ error });
}

export async function upsertModule(payload) {
  const client = requireSupabase();
  const { data, error } = await client.from('modules').upsert(payload).select().single();
  assertOk({ error });
  return data;
}

export async function deleteModule(id) {
  const client = requireSupabase();
  const { error } = await client.from('modules').delete().eq('id', id);
  assertOk({ error });
}

export async function upsertLecture(payload) {
  const client = requireSupabase();
  const { data, error } = await client.from('lectures').upsert(payload).select().single();
  assertOk({ error });
  return data;
}

export async function deleteLecture(id) {
  const client = requireSupabase();
  const { error } = await client.from('lectures').delete().eq('id', id);
  assertOk({ error });
}

export async function fetchAssignmentsForManager() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('assignments')
    .select('*, lectures(title), profiles(full_name)')
    .order('created_at', { ascending: false });
  assertOk({ error });
  return data ?? [];
}

export async function fetchAssignmentEditor(assignmentId) {
  const client = requireSupabase();
  const [assignmentResult, questionsResult] = await Promise.all([
    client.from('assignments').select('*').eq('id', assignmentId).single(),
    client
      .from('questions')
      .select('*, answer_keys(*)')
      .eq('assignment_id', assignmentId)
      .order('sort_order')
      .order('created_at'),
  ]);
  assertOk(assignmentResult);
  assertOk(questionsResult);
  return {
    assignment: assignmentResult.data,
    questions: questionsResult.data ?? [],
  };
}

export async function saveAssignmentWithQuestions(payload, questions) {
  const client = requireSupabase();
  const { data: assignment, error } = await client
    .from('assignments')
    .upsert(payload)
    .select()
    .single();
  assertOk({ error });

  const existing = await client
    .from('questions')
    .select('id')
    .eq('assignment_id', assignment.id);
  assertOk(existing);

  const keptIds = questions.filter((item) => item.id).map((item) => item.id);
  const toDelete = (existing.data ?? [])
    .map((item) => item.id)
    .filter((id) => !keptIds.includes(id));

  if (toDelete.length > 0) {
    const deleteResult = await client.from('questions').delete().in('id', toDelete);
    assertOk(deleteResult);
  }

  for (const [index, item] of questions.entries()) {
    const questionPayload = {
      id: item.id || undefined,
      assignment_id: assignment.id,
      type: item.type,
      prompt: item.prompt,
      points: Number(item.points),
      sort_order: Number(item.sort_order ?? index + 1),
      choices: item.choices ?? [],
      settings: item.settings ?? {},
    };
    const { data: question, error: questionError } = await client
      .from('questions')
      .upsert(questionPayload)
      .select()
      .single();
    assertOk({ error: questionError });

    const keyPayload = {
      question_id: question.id,
      correct_answer: item.answer_key?.correct_answer ?? null,
      accepted_answers: item.answer_key?.accepted_answers ?? [],
      points_map: item.answer_key?.points_map ?? [],
    };
    const keyResult = await client.from('answer_keys').upsert(keyPayload, {
      onConflict: 'question_id',
    });
    assertOk(keyResult);
  }

  return assignment;
}

export async function deleteAssignment(id) {
  const client = requireSupabase();
  const { error } = await client.from('assignments').delete().eq('id', id);
  assertOk({ error });
}

export async function fetchAssignmentForStudent(assignmentId) {
  const client = requireSupabase();
  const [assignmentResult, questionsResult] = await Promise.all([
    client.from('assignments').select('*').eq('id', assignmentId).single(),
    client
      .from('questions')
      .select('id, assignment_id, type, prompt, points, sort_order, choices, settings')
      .eq('assignment_id', assignmentId)
      .order('sort_order')
      .order('created_at'),
  ]);
  assertOk(assignmentResult);
  assertOk(questionsResult);
  return {
    assignment: assignmentResult.data,
    questions: questionsResult.data ?? [],
  };
}

export async function submitAssignmentAttempt({ assignmentId, studentId, answers }) {
  const client = requireSupabase();
  const { data: attempt, error } = await client
    .from('attempts')
    .insert({
      assignment_id: assignmentId,
      student_id: studentId,
      status: 'draft',
    })
    .select()
    .single();
  assertOk({ error });

  const answerRows = Object.entries(answers).map(([questionId, answer]) => ({
    attempt_id: attempt.id,
    question_id: questionId,
    answer,
  }));

  if (answerRows.length > 0) {
    const answersResult = await client.from('attempt_answers').insert(answerRows);
    assertOk(answersResult);
  }

  const { data: submitted, error: submitError } = await client.rpc('submit_attempt', {
    p_attempt_id: attempt.id,
  });
  assertOk({ error: submitError });
  return submitted;
}

export async function fetchMyHistory() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('attempts')
    .select('*, assignments(title)')
    .order('submitted_at', { ascending: false });
  assertOk({ error });
  return data ?? [];
}

export async function fetchAttemptReview(attemptId) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_attempt_review', {
    p_attempt_id: attemptId,
  });
  assertOk({ error });
  return data;
}

export async function fetchStudents() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('role', 'student')
    .order('created_at', { ascending: false });
  assertOk({ error });
  return data ?? [];
}

export async function createManagedUser({ email, password, full_name: fullName, role = 'student' }) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('admin_create_user_sql', {
    p_email: email,
    p_password: password,
    p_full_name: fullName,
    p_role: role,
  });

  if (!error) return { profile: data, via: 'rpc' };

  if (error.code !== '42883') {
    throw error;
  }

  return invokeAdminFunction('admin-create-user', {
    email,
    password,
    full_name: fullName,
    role,
  });
}

export async function fetchGradebook() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('attempts')
    .select('*, profiles(full_name, email), assignments(title)')
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false });
  assertOk({ error });
  return data ?? [];
}

export async function fetchDashboardStats() {
  const client = requireSupabase();
  const [students, assignments, attempts] = await Promise.all([
    client.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
    client.from('assignments').select('id', { count: 'exact', head: true }),
    client.from('attempts').select('score_10').eq('status', 'submitted'),
  ]);
  [students, assignments, attempts].forEach(assertOk);

  const scores = (attempts.data ?? [])
    .map((attempt) => Number(attempt.score_10))
    .filter((score) => Number.isFinite(score));
  const average = scores.length
    ? scores.reduce((sum, score) => sum + score, 0) / scores.length
    : 0;

  return {
    totalStudents: students.count ?? 0,
    totalAssignments: assignments.count ?? 0,
    totalSubmissions: scores.length,
    averageScore: average,
  };
}

export async function invokeAdminFunction(name, body) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke(name, { body });
  assertOk({ error });
  if (data?.error) throw new Error(data.error);
  return data;
}
