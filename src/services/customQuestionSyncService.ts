import type { ObcpQuestion } from '../data/obcpTypes'
import {
  isSupabaseConfigured,
  SupabaseRequestError,
  supabaseRequest,
  type SupabaseSession,
} from '../lib/supabaseClient'
import {
  saveCustomObcpQuestions,
  validateObcpQuestion,
} from '../utils/obcpQuestionImportExport'

export type CustomQuestionSyncState =
  'local' | 'signedOut' | 'syncing' | 'synced' | 'failed'

export type CustomQuestionSyncStatus = {
  configured: boolean
  loggedIn: boolean
  state: CustomQuestionSyncState
  localCount: number
  cloudCount: number
  lastSyncAt?: string
  lastError?: string
}

type CloudCustomQuestion = {
  id: string
  user_id: string
  question_id: string
  chapter: string
  knowledge_points: string[]
  type: ObcpQuestion['type'] | 'judge'
  stem: string
  options: ObcpQuestion['options']
  answer: string[]
  explanation: string
  tags: string[]
  difficulty: ObcpQuestion['difficulty']
  related_components: string[]
  common_mistakes: string[]
  review_suggestion: string
  exam_point: string
  source: string
  created_at: string
  updated_at: string
}

const STATUS_STORAGE_KEY =
  'ob-architecture-studio:obcp-custom-question-sync-status'
export const CUSTOM_QUESTION_SYNC_STATUS_CHANGED_EVENT =
  'ob-architecture-studio:obcp-custom-question-sync-status-changed'

export class CustomQuestionSyncError extends Error {
  requiresLogin: boolean

  constructor(message: string, requiresLogin = false) {
    super(message)
    this.name = 'CustomQuestionSyncError'
    this.requiresLogin = requiresLogin
  }
}

export function getCustomQuestionSyncStatus(): CustomQuestionSyncStatus {
  const fallback: CustomQuestionSyncStatus = {
    configured: isSupabaseConfigured,
    loggedIn: false,
    state: isSupabaseConfigured ? 'signedOut' : 'local',
    localCount: 0,
    cloudCount: 0,
  }
  try {
    const raw = window.localStorage.getItem(STATUS_STORAGE_KEY)
    if (!raw) return fallback
    const stored = JSON.parse(raw) as Partial<CustomQuestionSyncStatus>
    return {
      ...fallback,
      ...stored,
      configured: isSupabaseConfigured,
      loggedIn: isSupabaseConfigured && Boolean(stored.loggedIn),
      state: isSupabaseConfigured ? stored.state ?? fallback.state : 'local',
    }
  } catch {
    return fallback
  }
}

export function updateCustomQuestionSyncStatus(
  patch: Partial<CustomQuestionSyncStatus>,
) {
  const next: CustomQuestionSyncStatus = {
    ...getCustomQuestionSyncStatus(),
    ...patch,
    configured: isSupabaseConfigured,
  }
  try {
    window.localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // The event still updates the current page if localStorage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(
    CUSTOM_QUESTION_SYNC_STATUS_CHANGED_EVENT,
    { detail: next },
  ))
  return next
}

export function clearCustomQuestionSyncAccount(localCount: number) {
  return updateCustomQuestionSyncStatus({
    loggedIn: false,
    state: isSupabaseConfigured ? 'signedOut' : 'local',
    localCount,
    lastError: undefined,
  })
}

export async function syncCustomQuestionBank(
  session: SupabaseSession,
  localQuestions: ObcpQuestion[],
  builtInQuestionIds: ReadonlySet<string>,
) {
  updateCustomQuestionSyncStatus({
    loggedIn: true,
    state: 'syncing',
    localCount: localQuestions.length,
    lastError: undefined,
  })
  try {
    const cloudRows = await selectCloudQuestions(session)
    const safeCloudQuestions = cloudRows
      .map(fromCloudQuestion)
      .filter((question): question is ObcpQuestion =>
        question !== null && !builtInQuestionIds.has(question.questionId),
      )
    const normalizedLocal = localQuestions
      .filter((question) => !builtInQuestionIds.has(question.questionId))
      .map(normalizeLocalQuestion)
    const mergedQuestions = mergeByLatestUpdate(normalizedLocal, safeCloudQuestions)
    await upsertCloudQuestions(mergedQuestions, session)
    saveCustomObcpQuestions(mergedQuestions)
    const syncedAt = new Date().toISOString()
    updateCustomQuestionSyncStatus({
      loggedIn: true,
      state: 'synced',
      localCount: mergedQuestions.length,
      cloudCount: mergedQuestions.length,
      lastSyncAt: syncedAt,
      lastError: undefined,
    })
    return {
      questions: mergedQuestions,
      localCount: mergedQuestions.length,
      cloudCount: mergedQuestions.length,
      syncedAt,
    }
  } catch (error) {
    const syncError = normalizeCustomQuestionSyncError(error)
    updateCustomQuestionSyncStatus({
      loggedIn: !syncError.requiresLogin,
      state: 'failed',
      localCount: localQuestions.length,
      lastError: syncError.message,
    })
    throw syncError
  }
}

export async function deleteAllCloudCustomQuestions(
  session: SupabaseSession,
) {
  try {
    await supabaseRequest(
      `/rest/v1/obcp_custom_questions?user_id=eq.${encodeURIComponent(session.user.id)}`,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
      session.accessToken,
    )
    updateCustomQuestionSyncStatus({
      loggedIn: true,
      state: 'synced',
      localCount: 0,
      cloudCount: 0,
      lastSyncAt: new Date().toISOString(),
      lastError: undefined,
    })
  } catch (error) {
    const syncError = normalizeCustomQuestionSyncError(error)
    updateCustomQuestionSyncStatus({
      loggedIn: !syncError.requiresLogin,
      state: 'failed',
      lastError: syncError.message,
    })
    throw syncError
  }
}

async function selectCloudQuestions(session: SupabaseSession) {
  return supabaseRequest<CloudCustomQuestion[]>(
    `/rest/v1/obcp_custom_questions?user_id=eq.${encodeURIComponent(session.user.id)}&select=*`,
    { method: 'GET' },
    session.accessToken,
  )
}

async function upsertCloudQuestions(
  questions: ObcpQuestion[],
  session: SupabaseSession,
) {
  if (!questions.length) return
  await supabaseRequest(
    '/rest/v1/obcp_custom_questions?on_conflict=user_id,question_id',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(questions.map((question) =>
        toCloudQuestion(question, session.user.id),
      )),
    },
    session.accessToken,
  )
}

function mergeByLatestUpdate(
  localQuestions: ObcpQuestion[],
  cloudQuestions: ObcpQuestion[],
) {
  const merged = new Map<string, ObcpQuestion>()
  ;[...cloudQuestions, ...localQuestions].forEach((question) => {
    const existing = merged.get(question.questionId)
    if (!existing || getUpdatedTimestamp(question) >= getUpdatedTimestamp(existing)) {
      merged.set(question.questionId, question)
    }
  })
  return [...merged.values()].sort((left, right) =>
    left.questionId.localeCompare(right.questionId),
  )
}

function normalizeLocalQuestion(question: ObcpQuestion): ObcpQuestion {
  const now = new Date().toISOString()
  return {
    ...question,
    source: question.source ?? 'json_import',
    createdAt: question.createdAt ?? now,
    updatedAt: question.updatedAt ?? question.createdAt ?? now,
  }
}

function getUpdatedTimestamp(question: ObcpQuestion) {
  const timestamp = Date.parse(
    question.updatedAt ?? question.createdAt ?? '1970-01-01T00:00:00.000Z',
  )
  return Number.isFinite(timestamp) ? timestamp : 0
}

function toCloudQuestion(
  question: ObcpQuestion,
  userId: string,
): Omit<CloudCustomQuestion, 'id'> {
  const normalized = normalizeLocalQuestion(question)
  return {
    user_id: userId,
    question_id: normalized.questionId,
    chapter: normalized.chapter,
    knowledge_points: normalized.knowledgePoints,
    type: normalized.type,
    stem: normalized.stem,
    options: normalized.options,
    answer: normalized.answer,
    explanation: normalized.explanation,
    tags: normalized.tags,
    difficulty: normalized.difficulty,
    related_components: normalized.relatedComponents,
    common_mistakes: normalized.commonMistakes,
    review_suggestion: normalized.reviewSuggestion,
    exam_point: normalized.examPoint,
    source: normalized.source ?? 'json_import',
    created_at: normalized.createdAt!,
    updated_at: normalized.updatedAt!,
  }
}

function fromCloudQuestion(row: CloudCustomQuestion): ObcpQuestion | null {
  const candidate = {
    questionId: row.question_id,
    type: row.type === 'judge' ? 'trueFalse' : row.type,
    chapter: row.chapter,
    knowledgePoints: row.knowledge_points,
    difficulty: row.difficulty,
    stem: row.stem,
    options: row.options,
    answer: row.answer,
    explanation: row.explanation,
    tags: row.tags,
    relatedComponents: row.related_components,
    commonMistakes: row.common_mistakes,
    reviewSuggestion: row.review_suggestion,
    examPoint: row.exam_point,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
  const validation = validateObcpQuestion(candidate)
  return validation.valid ? validation.question : null
}

function normalizeCustomQuestionSyncError(error: unknown) {
  if (error instanceof SupabaseRequestError) {
    if (error.status === 401) {
      return new CustomQuestionSyncError(
        '登录状态已失效，请重新登录后同步自定义题库。',
        true,
      )
    }
    if (error.status === 403) {
      return new CustomQuestionSyncError(
        '自定义题库 RLS 权限校验失败，请检查 Supabase 策略。',
      )
    }
    if (!error.status) {
      return new CustomQuestionSyncError(
        error.message || '网络异常，自定义题库已保留在本地。',
      )
    }
    return new CustomQuestionSyncError(
      `自定义题库云端写入失败（HTTP ${error.status}），本地题库已保留。`,
    )
  }
  return error instanceof CustomQuestionSyncError
    ? error
    : new CustomQuestionSyncError('自定义题库同步失败，本地题库已保留。')
}
