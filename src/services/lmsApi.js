import { supabase } from './supabaseClient.js';

const CACHE_TTL_MS = 20_000;
const cache = new Map();

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase chưa được cấu hình. Tạo .env từ .env.example rồi khởi động lại dev server.');
  }
  return supabase;
}

function assertOk({ error }) {
  if (error) throw error;
}

function getCached(key) {
  const item = cache.get(key);
  if (!item || item.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCached(key, value, ttl = CACHE_TTL_MS) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttl,
  });
  return value;
}

function clearLmsCache() {
  cache.clear();
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
  const cacheKey = `learning-path:${role}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const client = requireSupabase();
  const shouldFilterPublished = role === 'student';

  let phasesQuery = client
    .from('phases')
    .select('id, owner_id, title, description, sort_order, published, created_at')
    .order('sort_order')
    .order('created_at');
  let modulesQuery = client
    .from('modules')
    .select('id, phase_id, owner_id, title, description, sort_order, published, created_at')
    .order('sort_order')
    .order('created_at');
  let lectureGroupsQuery = client
    .from('lecture_groups')
    .select('id, module_id, owner_id, title, description, sort_order, published, created_at')
    .order('sort_order')
    .order('created_at');
  let lecturesQuery = client
    .from('lectures')
    .select('id, module_id, group_id, owner_id, title, description, slide_url, sort_order, published, created_at')
    .order('sort_order')
    .order('created_at');
  let assignmentsQuery = client
    .from('assignments')
    .select('id, lecture_id, owner_id, title, description, pdf_url, sort_order, published, created_at')
    .order('sort_order')
    .order('created_at');

  if (shouldFilterPublished) {
    phasesQuery = phasesQuery.eq('published', true);
    modulesQuery = modulesQuery.eq('published', true);
    lectureGroupsQuery = lectureGroupsQuery.eq('published', true);
    lecturesQuery = lecturesQuery.eq('published', true);
    assignmentsQuery = assignmentsQuery.eq('published', true);
  }

  const [phasesResult, modulesResult, lectureGroupsResult, lecturesResult, assignmentsResult] = await Promise.all([
    phasesQuery,
    modulesQuery,
    lectureGroupsQuery,
    lecturesQuery,
    assignmentsQuery,
  ]);
  [phasesResult, modulesResult, lectureGroupsResult, lecturesResult, assignmentsResult].forEach(assertOk);

  const modulesByPhase = new Map();
  const groupsByModule = new Map();
  const lecturesByModule = new Map();
  const lecturesByGroup = new Map();
  const assignmentsByLecture = new Map();
  const freeAssignments = [];

  for (const module of modulesResult.data ?? []) {
    if (!modulesByPhase.has(module.phase_id)) modulesByPhase.set(module.phase_id, []);
    modulesByPhase.get(module.phase_id).push({ ...module, lecture_groups: [], lectures: [] });
  }

  for (const group of lectureGroupsResult.data ?? []) {
    if (!groupsByModule.has(group.module_id)) groupsByModule.set(group.module_id, []);
    groupsByModule.get(group.module_id).push({ ...group, lectures: [] });
  }

  for (const lecture of lecturesResult.data ?? []) {
    if (!lecturesByModule.has(lecture.module_id)) lecturesByModule.set(lecture.module_id, []);
    lecturesByModule.get(lecture.module_id).push({ ...lecture, assignments: [] });
    if (lecture.group_id) {
      if (!lecturesByGroup.has(lecture.group_id)) lecturesByGroup.set(lecture.group_id, []);
      lecturesByGroup.get(lecture.group_id).push({ ...lecture, assignments: [] });
    }
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
      module.lecture_groups = groupsByModule.get(module.id) ?? [];
      for (const lecture of module.lectures) {
        lecture.assignments = assignmentsByLecture.get(lecture.id) ?? [];
      }
      for (const group of module.lecture_groups) {
        group.lectures = (lecturesByGroup.get(group.id) ?? []).map((lecture) => ({
          ...lecture,
          assignments: assignmentsByLecture.get(lecture.id) ?? [],
        }));
      }
    }
  }

  const phases = (phasesResult.data ?? []).map((phase) => ({
    ...phase,
    modules: modulesByPhase.get(phase.id) ?? [],
  }));

  return setCached(cacheKey, {
    phases,
    modules: modulesResult.data ?? [],
    lectureGroups: lectureGroupsResult.data ?? [],
    lectures: lecturesResult.data ?? [],
    assignments: assignmentsResult.data ?? [],
    freeAssignments,
  });
}

export async function upsertPhase(payload) {
  const client = requireSupabase();
  const { data, error } = await client.from('phases').upsert(payload).select().single();
  assertOk({ error });
  clearLmsCache();
  return data;
}

export async function deletePhase(id) {
  const client = requireSupabase();
  const { error } = await client.from('phases').delete().eq('id', id);
  assertOk({ error });
  clearLmsCache();
}

export async function upsertModule(payload) {
  const client = requireSupabase();
  const { data, error } = await client.from('modules').upsert(payload).select().single();
  assertOk({ error });
  clearLmsCache();
  return data;
}

export async function deleteModule(id) {
  const client = requireSupabase();
  const { error } = await client.from('modules').delete().eq('id', id);
  assertOk({ error });
  clearLmsCache();
}

export async function upsertLectureGroup(payload) {
  const client = requireSupabase();
  const { data, error } = await client.from('lecture_groups').upsert(payload).select().single();
  assertOk({ error });
  clearLmsCache();
  return data;
}

export async function deleteLectureGroup(id) {
  const client = requireSupabase();
  const { error } = await client.from('lecture_groups').delete().eq('id', id);
  assertOk({ error });
  clearLmsCache();
}

export async function upsertLecture(payload) {
  const client = requireSupabase();
  const { data, error } = await client.from('lectures').upsert(payload).select().single();
  assertOk({ error });
  clearLmsCache();
  return data;
}

export async function deleteLecture(id) {
  const client = requireSupabase();
  const { error } = await client.from('lectures').delete().eq('id', id);
  assertOk({ error });
  clearLmsCache();
}

export async function fetchAssignmentsForManager() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('assignments')
    .select('id, lecture_id, owner_id, title, description, pdf_url, sort_order, published, created_at, lectures(title), profiles(full_name)')
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

  const questionRows = questions.map((item, index) => ({
    id: item.id || crypto.randomUUID(),
    assignment_id: assignment.id,
    type: item.type,
    prompt: item.prompt || `Câu ${index + 1}`,
    points: Number(item.points),
    sort_order: Number(item.sort_order ?? index + 1),
    choices: item.choices ?? [],
    settings: item.settings ?? {},
  }));

  if (questionRows.length > 0) {
    const questionsResult = await client.from('questions').upsert(questionRows, {
      onConflict: 'id',
    });
    assertOk(questionsResult);

    const keyRows = questions.map((item, index) => ({
      question_id: questionRows[index].id,
      correct_answer: item.answer_key?.correct_answer ?? null,
      accepted_answers: item.answer_key?.accepted_answers ?? [],
      points_map: item.answer_key?.points_map ?? [],
    }));
    const keyResult = await client.from('answer_keys').upsert(keyRows, {
      onConflict: 'question_id',
    });
    assertOk(keyResult);
  }

  clearLmsCache();
  return assignment;
}

export async function deleteAssignment(id) {
  const client = requireSupabase();
  const { error } = await client.from('assignments').delete().eq('id', id);
  assertOk({ error });
  clearLmsCache();
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
  const cached = getCached('students');
  if (cached) return cached;

  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('id, email, full_name, role, status, created_at, updated_at')
    .eq('role', 'student')
    .order('created_at', { ascending: false });
  assertOk({ error });
  return setCached('students', data ?? []);
}

export async function createManagedUser({ email, password, full_name: fullName, role = 'student' }) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('admin_create_user_sql', {
    p_email: email,
    p_password: password,
    p_full_name: fullName,
    p_role: role,
  });

  if (!error) {
    clearLmsCache();
    return { profile: data, via: 'rpc' };
  }

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

export async function deleteManagedUser(id) {
  const client = requireSupabase();
  const { error } = await client.rpc('admin_delete_user_sql', {
    p_user_id: id,
  });

  if (!error) {
    clearLmsCache();
    return;
  }

  if (error.code !== '42883') {
    throw error;
  }

  await invokeAdminFunction('admin-delete-user', { id });
  clearLmsCache();
}

export async function fetchGradebook() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('attempts')
    .select('id, assignment_id, student_id, status, submitted_at, score, max_points, score_10, profiles(full_name, email), assignments(title)')
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false });
  assertOk({ error });
  return data ?? [];
}

export async function fetchDashboardStats() {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_dashboard_stats');
  assertOk({ error });

  return {
    totalStudents: Number(data?.total_students ?? 0),
    totalAssignments: Number(data?.total_assignments ?? 0),
    totalSubmissions: Number(data?.total_submissions ?? 0),
    averageScore: Number(data?.average_score ?? 0),
  };
}

export async function invokeAdminFunction(name, body) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke(name, { body });
  assertOk({ error });
  if (data?.error) throw new Error(data.error);
  return data;
}
