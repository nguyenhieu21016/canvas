import { supabase } from './supabaseClient.js';

const CACHE_TTL_MS = 120_000;
const LEARNING_PATH_CACHE_TTL_MS = 10 * 60_000;
const STALE_CACHE_TTL_MS = 30 * 60_000;
const REQUEST_TIMEOUT_MS = 30_000;
const AUTH_TIMEOUT_MS = 20_000;
const cache = new Map();
const inFlight = new Map();

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

function getStaleCached(key, maxAge = STALE_CACHE_TTL_MS) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - (item.createdAt ?? 0) > maxAge) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCached(key, value, ttl = CACHE_TTL_MS) {
  cache.set(key, {
    value,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttl,
  });
  return value;
}

function clearLmsCache() {
  cache.clear();
  inFlight.clear();
}

function withTimeout(promise, label = 'request', timeoutMs = REQUEST_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = globalThis.setTimeout(() => {
      reject(new Error(`${label} đang chậm hơn bình thường. Thử lại sau một chút.`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => globalThis.clearTimeout(timer));
}

function dedupeRequest(key, factory) {
  const active = inFlight.get(key);
  if (active) return active;

  const request = factory().finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

export async function getSession() {
  const client = requireSupabase();
  const { data, error } = await withTimeout(client.auth.getSession(), 'Kiểm tra phiên đăng nhập', AUTH_TIMEOUT_MS);
  assertOk({ error });
  return data.session;
}

export async function signIn(email, password) {
  const client = requireSupabase();
  const { data, error } = await withTimeout(
    client.auth.signInWithPassword({ email, password }),
    'Đăng nhập',
    AUTH_TIMEOUT_MS,
  );
  assertOk({ error });
  return data.session;
}

export async function signUpStudent({ email, password, fullName }) {
  const client = requireSupabase();
  const { data, error } = await withTimeout(
    client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    }),
    'Đăng ký',
    AUTH_TIMEOUT_MS,
  );
  assertOk({ error });
  return data;
}

export async function signOut() {
  const client = requireSupabase();
  const { error } = await withTimeout(client.auth.signOut(), 'Đăng xuất', AUTH_TIMEOUT_MS);
  assertOk({ error });
}

export async function getCurrentProfile(sessionUser = null) {
  const client = requireSupabase();
  let user = sessionUser;
  if (!user) {
    const {
      data: { user: authUser },
      error: userError,
    } = await withTimeout(client.auth.getUser(), 'Kiểm tra tài khoản', AUTH_TIMEOUT_MS);
    assertOk({ error: userError });
    user = authUser;
  }
  if (!user) return null;

  const { data, error } = await withTimeout(client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle(), 'Tải hồ sơ');
  assertOk({ error });
  return data;
}

export async function updateProfileName(profileId, fullName) {
  const client = requireSupabase();
  const name = fullName.trim();
  if (!profileId) throw new Error('Không tìm thấy tài khoản để cập nhật.');
  if (!name) throw new Error('Tên hiển thị không được để trống.');

  const { data, error } = await withTimeout(
    client
      .from('profiles')
      .update({ full_name: name })
      .eq('id', profileId)
      .select('*')
      .single(),
    'Cập nhật tên',
  );
  assertOk({ error });
  clearLmsCache();
  return data;
}

export async function fetchLearningPath(role = 'student') {
  const cacheKey = `learning-path:${role}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const stale = getStaleCached(cacheKey);
  if (stale) return stale;

  return dedupeRequest(cacheKey, async () => {
    const cachedAgain = getCached(cacheKey);
    if (cachedAgain) return cachedAgain;
    const staleAgain = getStaleCached(cacheKey);
    if (staleAgain) return staleAgain;

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

    const [phasesResult, modulesResult, lectureGroupsResult, lecturesResult, assignmentsResult, attemptsResult] =
      await withTimeout(
        Promise.all([
          phasesQuery,
          modulesQuery,
          lectureGroupsQuery,
          lecturesQuery,
          assignmentsQuery,
          shouldFilterPublished
            ? client.from('attempts').select('assignment_id, score_10, submitted_at').eq('status', 'submitted')
            : Promise.resolve({ data: [], error: null }),
        ]),
        'Tải lộ trình',
      );
    [phasesResult, modulesResult, lectureGroupsResult, lecturesResult, assignmentsResult, attemptsResult].forEach(assertOk);

    const modulesByPhase = new Map();
    const groupsByModule = new Map();
    const lecturesByModule = new Map();
    const lecturesByGroup = new Map();
    const assignmentsByLecture = new Map();
    const freeAssignments = [];
    const bestAttemptsByAssignment = new Map();

    for (const attempt of attemptsResult.data ?? []) {
      const current = bestAttemptsByAssignment.get(attempt.assignment_id);
      const score = Number(attempt.score_10 ?? 0);
      if (!current || score > Number(current.score_10 ?? 0)) {
        bestAttemptsByAssignment.set(attempt.assignment_id, attempt);
      }
    }

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
      const bestAttempt = bestAttemptsByAssignment.get(assignment.id);
      const assignmentWithProgress = {
        ...assignment,
        progress: bestAttempt
          ? {
              status: 'submitted',
              bestScore: Number(bestAttempt.score_10 ?? 0),
              submittedAt: bestAttempt.submitted_at,
            }
          : { status: 'not_started', bestScore: null, submittedAt: null },
      };
      if (!assignment.lecture_id) {
        freeAssignments.push(assignmentWithProgress);
        continue;
      }
      if (!assignmentsByLecture.has(assignment.lecture_id)) {
        assignmentsByLecture.set(assignment.lecture_id, []);
      }
      assignmentsByLecture.get(assignment.lecture_id).push(assignmentWithProgress);
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
    }, LEARNING_PATH_CACHE_TTL_MS);
  });
}

export async function upsertPhase(payload) {
  const client = requireSupabase();
  const { data, error } = await withTimeout(client.from('phases').upsert(payload).select().single(), 'Lưu giai đoạn');
  assertOk({ error });
  clearLmsCache();
  return data;
}

export async function deletePhase(id) {
  const client = requireSupabase();
  const { error } = await withTimeout(client.from('phases').delete().eq('id', id), 'Xóa giai đoạn');
  assertOk({ error });
  clearLmsCache();
}

export async function upsertModule(payload) {
  const client = requireSupabase();
  const { data, error } = await withTimeout(client.from('modules').upsert(payload).select().single(), 'Lưu chuyên đề');
  assertOk({ error });
  clearLmsCache();
  return data;
}

export async function deleteModule(id) {
  const client = requireSupabase();
  const { error } = await withTimeout(client.from('modules').delete().eq('id', id), 'Xóa chuyên đề');
  assertOk({ error });
  clearLmsCache();
}

export async function upsertLectureGroup(payload) {
  const client = requireSupabase();
  const { data, error } = await withTimeout(
    client.from('lecture_groups').upsert(payload).select().single(),
    'Lưu nhóm bài giảng',
  );
  assertOk({ error });
  clearLmsCache();
  return data;
}

export async function deleteLectureGroup(id) {
  const client = requireSupabase();
  const { error } = await withTimeout(client.from('lecture_groups').delete().eq('id', id), 'Xóa nhóm bài giảng');
  assertOk({ error });
  clearLmsCache();
}

export async function upsertLecture(payload) {
  const client = requireSupabase();
  const { data, error } = await withTimeout(client.from('lectures').upsert(payload).select().single(), 'Lưu bài giảng');
  assertOk({ error });
  clearLmsCache();
  return data;
}

export async function deleteLecture(id) {
  const client = requireSupabase();
  const { error } = await withTimeout(client.from('lectures').delete().eq('id', id), 'Xóa bài giảng');
  assertOk({ error });
  clearLmsCache();
}

export async function fetchAssignmentsForManager() {
  const client = requireSupabase();
  const { data, error } = await withTimeout(client
    .from('assignments')
    .select('id, lecture_id, owner_id, title, description, pdf_url, sort_order, published, created_at, lectures(title), profiles(full_name)')
    .order('created_at', { ascending: false }), 'Tải danh sách đề');
  assertOk({ error });
  return data ?? [];
}

export async function fetchAssignmentEditor(assignmentId) {
  const client = requireSupabase();
  const [assignmentResult, questionsResult] = await withTimeout(Promise.all([
    client.from('assignments').select('*').eq('id', assignmentId).single(),
    client
      .from('questions')
      .select('*, answer_keys(*)')
      .eq('assignment_id', assignmentId)
      .order('sort_order')
      .order('created_at'),
  ]), 'Tải trình sửa đề');
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
  const [assignmentResult, questionsResult] = await withTimeout(Promise.all([
    client.from('assignments').select('*').eq('id', assignmentId).single(),
    client
      .from('questions')
      .select('id, assignment_id, type, prompt, points, sort_order, choices, settings')
      .eq('assignment_id', assignmentId)
      .order('sort_order')
      .order('created_at'),
  ]), 'Tải đề bài');
  assertOk(assignmentResult);
  assertOk(questionsResult);
  return {
    assignment: assignmentResult.data,
    questions: questionsResult.data ?? [],
  };
}

export async function fetchStudentAssignmentOverview(assignmentId) {
  const client = requireSupabase();
  const [assignmentResult, attemptsResult] = await withTimeout(Promise.all([
    client.from('assignments').select('*').eq('id', assignmentId).single(),
    client
      .from('attempts')
      .select('id, assignment_id, status, submitted_at, score, max_points, score_10')
      .eq('assignment_id', assignmentId)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false }),
  ]), 'Tải lịch sử bài tập');
  assertOk(assignmentResult);
  assertOk(attemptsResult);

  return {
    assignment: assignmentResult.data,
    attempts: attemptsResult.data ?? [],
  };
}

export async function submitAssignmentAttempt({ assignmentId, answers }) {
  const client = requireSupabase();
  const { data: submitted, error } = await withTimeout(client.rpc('submit_assignment_attempt', {
    p_assignment_id: assignmentId,
    p_answers: answers ?? {},
  }), 'Nộp bài', 20_000);
  assertOk({ error });
  clearLmsCache();
  return submitted;
}

export async function fetchMyHistory() {
  const cached = getCached('my-history');
  if (cached) return cached;

  const client = requireSupabase();
  return dedupeRequest('my-history', async () => {
    const cachedAgain = getCached('my-history');
    if (cachedAgain) return cachedAgain;
    const { data, error } = await withTimeout(client
      .from('attempts')
      .select('*, assignments(title)')
      .order('submitted_at', { ascending: false }), 'Tải lịch sử');
    assertOk({ error });
    return setCached('my-history', data ?? []);
  });
}

export async function fetchAttemptReview(attemptId) {
  const client = requireSupabase();
  const { data, error } = await withTimeout(client.rpc('get_attempt_review', {
    p_attempt_id: attemptId,
  }), 'Tải chi tiết bài làm');
  assertOk({ error });
  return data;
}

export async function fetchAssignmentInsights(assignmentId) {
  const client = requireSupabase();
  const [assignmentResult, attemptsResult, studentsResult] = await withTimeout(Promise.all([
    client
      .from('assignments')
      .select('id, title, description, pdf_url, published, created_at, lectures(title), profiles(full_name)')
      .eq('id', assignmentId)
      .single(),
    client
      .from('attempts')
      .select('id, assignment_id, student_id, status, submitted_at, score, max_points, score_10, profiles(full_name, email)')
      .eq('assignment_id', assignmentId)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false }),
    client
      .from('profiles')
      .select('id, email, full_name, status')
      .eq('role', 'student')
      .order('full_name', { ascending: true }),
  ]), 'Tải thống kê bài tập');
  [assignmentResult, attemptsResult, studentsResult].forEach(assertOk);

  const attempts = attemptsResult.data ?? [];
  const latestByStudent = new Map();
  for (const attempt of attempts) {
    if (!latestByStudent.has(attempt.student_id)) {
      latestByStudent.set(attempt.student_id, attempt);
    }
  }

  const students = studentsResult.data ?? [];
  const submittedStudents = students
    .map((student) => ({ student, attempt: latestByStudent.get(student.id) }))
    .filter((item) => item.attempt);
  const pendingStudents = students.filter((student) => !latestByStudent.has(student.id));
  const scores = submittedStudents.map((item) => Number(item.attempt.score_10 ?? 0));
  const averageScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;

  return {
    assignment: assignmentResult.data,
    attempts,
    submittedStudents,
    pendingStudents,
    stats: {
      totalStudents: students.length,
      submittedCount: submittedStudents.length,
      pendingCount: pendingStudents.length,
      averageScore,
      bestScore: scores.length ? Math.max(...scores) : 0,
    },
  };
}

export async function fetchStudents() {
  const cached = getCached('students');
  if (cached) return cached;

  const client = requireSupabase();
  const { data, error } = await withTimeout(client
    .from('profiles')
    .select('id, email, full_name, role, status, created_at, updated_at')
    .eq('role', 'student')
    .order('created_at', { ascending: false }), 'Tải danh sách học sinh');
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
  const cached = getCached('gradebook');
  if (cached) return cached;

  const client = requireSupabase();
  return dedupeRequest('gradebook', async () => {
    const cachedAgain = getCached('gradebook');
    if (cachedAgain) return cachedAgain;
    const { data, error } = await withTimeout(client
      .from('attempts')
      .select('id, assignment_id, student_id, status, submitted_at, score, max_points, score_10, profiles(full_name, email), assignments(title)')
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false }), 'Tải bảng điểm');
    assertOk({ error });
    return setCached('gradebook', data ?? []);
  });
}

export async function fetchDashboardStats() {
  const client = requireSupabase();
  const { data, error } = await withTimeout(client.rpc('get_dashboard_stats'), 'Tải thống kê');
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
