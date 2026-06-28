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

function hydrateLearningPath(raw) {
  const modulesByPhase = new Map();
  const groupsByModule = new Map();
  const lecturesByModule = new Map();
  const lecturesByGroup = new Map();
  const assignmentsByLecture = new Map();
  const freeAssignments = [];

  for (const module of raw.modules ?? []) {
    if (!modulesByPhase.has(module.phase_id)) modulesByPhase.set(module.phase_id, []);
    modulesByPhase.get(module.phase_id).push({ ...module, lecture_groups: [], lectures: [] });
  }

  const groupModuleMap = new Map();

  for (const group of raw.lectureGroups ?? raw.lecture_groups ?? []) {
    if (!groupsByModule.has(group.module_id)) groupsByModule.set(group.module_id, []);
    groupsByModule.get(group.module_id).push({ ...group, lectures: [] });
    groupModuleMap.set(group.id, group.module_id);
  }

  for (const lecture of raw.lectures ?? []) {
    if (lecture.group_id) {
      const groupModuleId = groupModuleMap.get(lecture.group_id);
      if (groupModuleId && groupModuleId !== lecture.module_id) {
        lecture.module_id = groupModuleId;
      }
    }
    
    if (!lecturesByModule.has(lecture.module_id)) lecturesByModule.set(lecture.module_id, []);
    lecturesByModule.get(lecture.module_id).push({ ...lecture, assignments: [] });
    
    if (lecture.group_id) {
      if (!lecturesByGroup.has(lecture.group_id)) lecturesByGroup.set(lecture.group_id, []);
      lecturesByGroup.get(lecture.group_id).push({ ...lecture, assignments: [] });
    }
  }

  for (const assignment of raw.assignments ?? []) {
    const assignmentWithProgress = {
      ...assignment,
      progress: assignment.progress ?? { status: 'not_started', bestScore: null, submittedAt: null },
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

  const phases = (raw.phases ?? []).map((phase) => ({
    ...phase,
    modules: modulesByPhase.get(phase.id) ?? [],
  }));

  return {
    phases,
    modules: raw.modules ?? [],
    lectureGroups: raw.lectureGroups ?? raw.lecture_groups ?? [],
    lectures: raw.lectures ?? [],
    assignments: raw.assignments ?? [],
    freeAssignments,
  };
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

export async function requestPasswordReset(email) {
  const client = requireSupabase();
  const redirectTo = `${window.location.origin}${window.location.pathname}#/reset-password`;
  const { error } = await withTimeout(
    client.auth.resetPasswordForEmail(email, { redirectTo }),
    'Gửi email đặt lại mật khẩu',
    AUTH_TIMEOUT_MS,
  );
  assertOk({ error });
}

export async function updateCurrentUserPassword(password) {
  const client = requireSupabase();
  const nextPassword = String(password ?? '');
  if (nextPassword.length < 6) throw new Error('Mật khẩu mới cần ít nhất 6 ký tự.');
  const { data, error } = await withTimeout(
    client.auth.updateUser({ password: nextPassword }),
    'Cập nhật mật khẩu',
    AUTH_TIMEOUT_MS,
  );
  assertOk({ error });
  return data.user;
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

export async function updateProfileAvatar(profileId, avatarBlob) {
  const client = requireSupabase();
  if (!profileId) throw new Error('Không tìm thấy tài khoản để cập nhật avatar.');
  if (!avatarBlob) throw new Error('Chọn ảnh avatar trước khi lưu.');

  const avatarPath = `${profileId}/avatar.webp`;
  const { error: uploadError } = await withTimeout(
    client.storage.from('avatars').upload(avatarPath, avatarBlob, {
      cacheControl: '3600',
      contentType: avatarBlob.type || 'image/webp',
      upsert: true,
    }),
    'Tải avatar lên',
  );
  assertOk({ error: uploadError });

  const { data: publicUrlData } = client.storage.from('avatars').getPublicUrl(avatarPath);
  const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;
  const { data, error } = await withTimeout(
    client
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', profileId)
      .select('*')
      .single(),
    'Cập nhật avatar',
  );
  assertOk({ error });
  clearLmsCache();
  return data;
}

export async function removeProfileAvatar(profileId) {
  const client = requireSupabase();
  if (!profileId) throw new Error('Không tìm thấy tài khoản để gỡ avatar.');

  const avatarPath = `${profileId}/avatar.webp`;
  const { error: removeError } = await withTimeout(
    client.storage.from('avatars').remove([avatarPath]),
    'Gỡ avatar',
  );
  assertOk({ error: removeError });

  const { data, error } = await withTimeout(
    client
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', profileId)
      .select('*')
      .single(),
    'Cập nhật avatar',
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

    try {
      const { data, error } = await withTimeout(client.rpc('get_learning_path'), 'Tải lộ trình');
      if (!error && data) {
        return setCached(cacheKey, hydrateLearningPath(data), LEARNING_PATH_CACHE_TTL_MS);
      }
      if (error?.code && error.code !== '42883') {
        console.warn('get_learning_path RPC failed, falling back to REST queries:', error.message);
      }
    } catch (error) {
      console.warn('get_learning_path RPC timed out, falling back to REST queries:', error.message);
    }

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

    const bestAttemptsByAssignment = new Map();

    for (const attempt of attemptsResult.data ?? []) {
      const current = bestAttemptsByAssignment.get(attempt.assignment_id);
      const score = Number(attempt.score_10 ?? 0);
      if (!current || score > Number(current.score_10 ?? 0)) {
        bestAttemptsByAssignment.set(attempt.assignment_id, attempt);
      }
    }

    const assignments = (assignmentsResult.data ?? []).map((assignment) => {
      const bestAttempt = bestAttemptsByAssignment.get(assignment.id);
      return {
        ...assignment,
        progress: bestAttempt
          ? {
              status: 'submitted',
              bestScore: Number(bestAttempt.score_10 ?? 0),
              submittedAt: bestAttempt.submitted_at,
            }
          : { status: 'not_started', bestScore: null, submittedAt: null },
      };
    });

    return setCached(cacheKey, hydrateLearningPath({
      phases: phasesResult.data ?? [],
      modules: modulesResult.data ?? [],
      lectureGroups: lectureGroupsResult.data ?? [],
      lectures: lecturesResult.data ?? [],
      assignments,
    }), LEARNING_PATH_CACHE_TTL_MS);
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

export async function reorderContentNodes(kind, ids) {
  const client = requireSupabase();
  const { error } = await withTimeout(
    client.rpc('reorder_content_nodes', { p_kind: kind, p_ids: ids }),
    'Cập nhật thứ tự nội dung',
  );
  assertOk({ error });
  clearLmsCache();
}

export async function fetchAssignmentsForManager({ limit = 100, offset = 0 } = {}) {
  const client = requireSupabase();
  const { data, error } = await withTimeout(client
    .from('assignments')
    .select('id, lecture_id, owner_id, title, description, pdf_url, sort_order, published, created_at, lectures(title), profiles(full_name)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1), 'Tải danh sách đề');
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

export async function regradeAssignment(assignmentId) {
  const client = requireSupabase();
  if (!assignmentId) return 0;
  const { data, error } = await withTimeout(
    client.rpc('regrade_assignment', { p_assignment_id: assignmentId }),
    'Chấm lại bài đã nộp',
  );
  assertOk({ error });
  clearLmsCache();
  return Number(data ?? 0);
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

export async function fetchMyHistory({ limit = 100, offset = 0 } = {}) {
  const cacheKey = `my-history:${limit}:${offset}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const client = requireSupabase();
  return dedupeRequest(cacheKey, async () => {
    const cachedAgain = getCached(cacheKey);
    if (cachedAgain) return cachedAgain;
    const { data, error } = await withTimeout(client
      .from('attempts')
      .select('*, assignments(title)')
      .order('submitted_at', { ascending: false })
      .range(offset, offset + limit - 1), 'Tải lịch sử');
    assertOk({ error });
    return setCached(cacheKey, data ?? []);
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

export async function fetchSolutionRequestsForAttempt(attemptId) {
  const client = requireSupabase();
  const { data, error } = await withTimeout(client
    .from('solution_requests')
    .select('*')
    .eq('attempt_id', attemptId)
    .order('created_at', { ascending: false }), 'Tải yêu cầu lời giải');
  assertOk({ error });
  return data ?? [];
}

export async function fetchSolutionRequest(requestId) {
  const client = requireSupabase();
  const { data, error } = await withTimeout(client
    .from('solution_requests')
    .select('*, assignments(title, pdf_url), profiles(full_name, email), attempts(score_10, submitted_at)')
    .eq('id', requestId)
    .single(), 'Tải lời giải chi tiết');
  assertOk({ error });
  return data;
}

export async function createSolutionRequest({ assignmentId, attemptId, requestedQuestions, note }) {
  const client = requireSupabase();
  const createdAt = new Date().toISOString();
  const { error } = await withTimeout(client
    .from('solution_requests')
    .insert({
      assignment_id: assignmentId,
      attempt_id: attemptId,
      requested_questions: requestedQuestions,
      note: note ?? '',
    }), 'Gửi yêu cầu lời giải');
  assertOk({ error });
  return {
    assignment_id: assignmentId,
    attempt_id: attemptId,
    requested_questions: requestedQuestions,
    note: note ?? '',
    status: 'pending',
    solution_pdf_url: '',
    created_at: createdAt,
  };
}

export async function fetchAssignmentSolutionRequests(assignmentId) {
  const client = requireSupabase();
  const { data, error } = await withTimeout(client
    .from('solution_requests')
    .select('*, profiles(full_name, email), attempts(score_10, submitted_at)')
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: false }), 'Tải danh sách yêu cầu lời giải');
  assertOk({ error });
  return data ?? [];
}

export async function fetchSolutionRequestsForManager() {
  const client = requireSupabase();
  const { data, error } = await withTimeout(client
    .from('solution_requests')
    .select('*, assignments(title), profiles(full_name, email), attempts(score_10, submitted_at)')
    .order('created_at', { ascending: false }), 'Tải quản lý yêu cầu lời giải');
  assertOk({ error });
  return data ?? [];
}

export async function updateSolutionRequest(requestId, { solutionPdfUrl }) {
  const client = requireSupabase();
  const url = String(solutionPdfUrl ?? '').trim();
  const status = url ? 'fulfilled' : 'pending';
  const fulfilledAt = url ? new Date().toISOString() : null;
  const { error } = await withTimeout(client
    .from('solution_requests')
    .update({
      solution_pdf_url: url,
      status,
      fulfilled_at: fulfilledAt,
    })
    .eq('id', requestId), 'Lưu lời giải');
  assertOk({ error });
  return {
    id: requestId,
    solution_pdf_url: url,
    status,
    fulfilled_at: fulfilledAt,
  };
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

export async function fetchStudents({ limit = 200, offset = 0 } = {}) {
  const cacheKey = `students:${limit}:${offset}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const client = requireSupabase();
  const { data, error } = await withTimeout(client
    .from('profiles')
    .select('id, email, full_name, role, status, created_at, updated_at')
    .eq('role', 'student')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1), 'Tải danh sách học sinh');
  assertOk({ error });
  return setCached(cacheKey, data ?? []);
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

export async function fetchGradebook({ limit = 200, offset = 0 } = {}) {
  const cacheKey = `gradebook:${limit}:${offset}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const client = requireSupabase();
  return dedupeRequest(cacheKey, async () => {
    const cachedAgain = getCached(cacheKey);
    if (cachedAgain) return cachedAgain;
    const { data, error } = await withTimeout(client
      .from('attempts')
      .select('id, assignment_id, student_id, status, submitted_at, score, max_points, score_10, profiles(full_name, email), assignments(title)')
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false })
      .range(offset, offset + limit - 1), 'Tải bảng điểm');
    assertOk({ error });
    return setCached(cacheKey, data ?? []);
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

export async function fetchTeachingLogs(studentId) {
  const cacheKey = `teaching-logs:${studentId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const client = requireSupabase();
  const { data, error } = await withTimeout(
    client
      .from('teaching_logs')
      .select('id, lecture_id, taught_at, note')
      .eq('student_id', studentId)
      .order('taught_at', { ascending: false }),
    'Tải tiến độ bài giảng',
  );
  assertOk({ error });
  return setCached(cacheKey, data ?? []);
}

export async function upsertTeachingLog({ studentId, lectureId, note = null }) {
  const client = requireSupabase();
  const { data, error } = await withTimeout(
    client
      .from('teaching_logs')
      .upsert(
        {
          teacher_id: (await client.auth.getUser()).data.user?.id,
          student_id: studentId,
          lecture_id: lectureId,
          note,
          taught_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,lecture_id' },
      )
      .select()
      .single(),
    'Lưu tiến độ bài giảng',
  );
  assertOk({ error });
  cache.delete(`teaching-logs:${studentId}`);
  return data;
}

export async function deleteTeachingLog({ studentId, lectureId }) {
  const client = requireSupabase();
  const { error } = await withTimeout(
    client
      .from('teaching_logs')
      .delete()
      .eq('student_id', studentId)
      .eq('lecture_id', lectureId),
    'Xóa tiến độ bài giảng',
  );
  assertOk({ error });
  cache.delete(`teaching-logs:${studentId}`);
}

// ─── Salary Management ────────────────────────────────────────────────────────

export async function fetchSalaryMonth(month) {
  // month: 'YYYY-MM-DD' (first day of month)
  const client = requireSupabase();
  const { data, error } = await withTimeout(
    client
      .from('salary_schedules')
      .select('*, profiles(full_name), salary_sessions(id, session_date)')
      .eq('month', month)
      .order('created_at'),
    'Tải lịch lương',
  );
  assertOk({ error });
  return data ?? [];
}

export async function upsertSalarySchedule({ studentId, month, ratePerSession, notes }) {
  const client = requireSupabase();
  const { data, error } = await withTimeout(
    client
      .from('salary_schedules')
      .upsert(
        { student_id: studentId, month, rate_per_session: ratePerSession, notes },
        { onConflict: 'student_id,month' },
      )
      .select('id')
      .single(),
    'Lưu lịch lương',
  );
  assertOk({ error });
  return data;
}

export async function deleteSalarySchedule(scheduleId) {
  const client = requireSupabase();
  const { error } = await withTimeout(
    client.from('salary_schedules').delete().eq('id', scheduleId),
    'Xóa lịch lương',
  );
  assertOk({ error });
}

export async function toggleSalarySession({ scheduleId, sessionDate, taught }) {
  const client = requireSupabase();
  if (taught) {
    const { error } = await withTimeout(
      client
        .from('salary_sessions')
        .insert({ schedule_id: scheduleId, session_date: sessionDate }),
      'Tick buổi dạy',
    );
    assertOk({ error });
  } else {
    const { error } = await withTimeout(
      client
        .from('salary_sessions')
        .delete()
        .eq('schedule_id', scheduleId)
        .eq('session_date', sessionDate),
      'Untick buổi dạy',
    );
    assertOk({ error });
  }
}
