import type {
  ObcpAnswerRecord,
  ObcpPracticeSession,
  ObcpUserState,
} from '../data/obcpTypes'
import { supabaseRequest, type SupabaseSession } from '../lib/supabaseClient'
import {
  loadObcpPracticeSessions,
  loadObcpUserState,
  OBCP_DATA_UPDATED_EVENT,
  saveObcpPracticeSessions,
  saveObcpUserState,
} from '../utils/obcpStorage'

const LOCAL_USER_ID = 'local-user'

type CloudAnswerRecord = {
  user_id: string
  record_id: string
  question_id: string
  selected_answer: string[]
  correct_answer: string[]
  is_correct: boolean
  duration_seconds: number
  answered_at: string
  chapter: string
  knowledge_points: string[]
  difficulty: ObcpAnswerRecord['difficulty']
  question_type: ObcpAnswerRecord['questionType']
  is_favorite: boolean
  is_wrong_book: boolean
  retry_count: number
  is_not_understood: boolean
  synced_at: string
}

type CloudQuestionState = {
  user_id: string
  question_id: string
  is_favorite: boolean
  is_wrong_book: boolean
  is_not_understood: boolean
  retry_count: number
  updated_at: string
}

type CloudPracticeSession = {
  user_id: string
  session_id: string
  mode: ObcpPracticeSession['mode']
  source_label: string
  question_ids: string[]
  answered_count: number
  correct_count: number
  started_at: string
  completed_at: string
  synced_at: string
}

export async function syncObcpData(session: SupabaseSession) {
  const [cloudRecords, cloudStates, cloudSessions] = await Promise.all([
    selectRows<CloudAnswerRecord>('obcp_answer_records', session),
    selectRows<CloudQuestionState>('obcp_question_states', session),
    selectRows<CloudPracticeSession>('obcp_practice_sessions', session),
  ])

  const localState = loadObcpUserState(LOCAL_USER_ID)
  const localSessions = loadObcpPracticeSessions(LOCAL_USER_ID)
  const mergedRecords = mergeRecords(localState.records, cloudRecords.map(fromCloudRecord))
  const mergedState = mergeQuestionStates(localState, cloudStates, mergedRecords)
  const mergedSessions = mergeSessions(localSessions, cloudSessions.map(fromCloudSession))
  const syncedAt = new Date().toISOString()

  await Promise.all([
    upsertRows('obcp_answer_records', mergedRecords.map((record) => toCloudRecord(record, session.user.id, syncedAt)), session, 'user_id,record_id'),
    upsertRows('obcp_question_states', buildCloudQuestionStates(mergedState, session.user.id), session, 'user_id,question_id'),
    upsertRows('obcp_practice_sessions', mergedSessions.map((item) => toCloudSession(item, session.user.id, syncedAt)), session, 'user_id,session_id'),
  ])

  saveObcpUserState({
    ...mergedState,
    records: mergedRecords.map((record) => ({ ...record, syncStatus: 'synced', syncedAt })),
  }, false)
  saveObcpPracticeSessions(
    LOCAL_USER_ID,
    mergedSessions.map((item) => ({ ...item, syncStatus: 'synced', syncedAt })),
    false,
  )
  window.dispatchEvent(new CustomEvent(OBCP_DATA_UPDATED_EVENT))
}

async function selectRows<T>(table: string, session: SupabaseSession) {
  return supabaseRequest<T[]>(
    `/rest/v1/${table}?user_id=eq.${encodeURIComponent(session.user.id)}&select=*`,
    { method: 'GET' },
    session.accessToken,
  )
}

async function upsertRows(
  table: string,
  rows: unknown[],
  session: SupabaseSession,
  onConflict: string,
) {
  if (!rows.length) return
  await supabaseRequest(
    `/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    },
    session.accessToken,
  )
}

function mergeRecords(local: ObcpAnswerRecord[], cloud: ObcpAnswerRecord[]) {
  const merged: ObcpAnswerRecord[] = []
  ;[...cloud, ...local].forEach((record) => {
    const index = merged.findIndex((candidate) =>
      candidate.id === record.id
      || (
        candidate.questionId === record.questionId
        && candidate.answeredAt === record.answeredAt
      ),
    )
    const normalized = { ...record, userId: LOCAL_USER_ID }
    if (index >= 0) merged[index] = { ...merged[index], ...normalized }
    else merged.push(normalized)
  })
  return merged.sort((left, right) => left.answeredAt.localeCompare(right.answeredAt))
}

function mergeQuestionStates(
  local: ObcpUserState,
  cloudStates: CloudQuestionState[],
  records: ObcpAnswerRecord[],
): ObcpUserState {
  const ids = new Set([
    ...Object.keys(local.questionStateUpdatedAt),
    ...local.favoriteQuestionIds,
    ...local.wrongBookQuestionIds,
    ...local.notUnderstoodQuestionIds,
    ...cloudStates.map((item) => item.question_id),
  ])
  const favorites = new Set<string>()
  const wrongBook = new Set<string>()
  const notUnderstood = new Set<string>()
  const updatedAt: Record<string, string> = {}
  const cloudById = new Map(cloudStates.map((item) => [item.question_id, item]))

  ids.forEach((questionId) => {
    const cloud = cloudById.get(questionId)
    const localUpdatedAt = local.questionStateUpdatedAt[questionId] ?? '1970-01-01T00:00:00.000Z'
    const useCloud = Boolean(cloud && cloud.updated_at > localUpdatedAt)
    const favorite = useCloud ? cloud!.is_favorite : local.favoriteQuestionIds.includes(questionId)
    const wrong = useCloud ? cloud!.is_wrong_book : local.wrongBookQuestionIds.includes(questionId)
    const unclear = useCloud ? cloud!.is_not_understood : local.notUnderstoodQuestionIds.includes(questionId)
    if (favorite) favorites.add(questionId)
    if (wrong) wrongBook.add(questionId)
    if (unclear) notUnderstood.add(questionId)
    updatedAt[questionId] = useCloud ? cloud!.updated_at : localUpdatedAt
  })

  return {
    userId: LOCAL_USER_ID,
    records,
    favoriteQuestionIds: [...favorites],
    wrongBookQuestionIds: [...wrongBook],
    notUnderstoodQuestionIds: [...notUnderstood],
    questionStateUpdatedAt: updatedAt,
  }
}

function mergeSessions(local: ObcpPracticeSession[], cloud: ObcpPracticeSession[]) {
  const merged = new Map<string, ObcpPracticeSession>()
  ;[...cloud, ...local].forEach((item) => merged.set(item.id, { ...merged.get(item.id), ...item, userId: LOCAL_USER_ID }))
  return [...merged.values()].sort((left, right) => left.completedAt.localeCompare(right.completedAt))
}

function buildCloudQuestionStates(state: ObcpUserState, userId: string): CloudQuestionState[] {
  const ids = new Set([
    ...Object.keys(state.questionStateUpdatedAt),
    ...state.favoriteQuestionIds,
    ...state.wrongBookQuestionIds,
    ...state.notUnderstoodQuestionIds,
  ])
  return [...ids].map((questionId) => ({
    user_id: userId,
    question_id: questionId,
    is_favorite: state.favoriteQuestionIds.includes(questionId),
    is_wrong_book: state.wrongBookQuestionIds.includes(questionId),
    is_not_understood: state.notUnderstoodQuestionIds.includes(questionId),
    retry_count: state.records.filter((record) => record.questionId === questionId).length,
    updated_at: state.questionStateUpdatedAt[questionId] ?? new Date().toISOString(),
  }))
}

function toCloudRecord(record: ObcpAnswerRecord, userId: string, syncedAt: string): CloudAnswerRecord {
  return {
    user_id: userId,
    record_id: record.id,
    question_id: record.questionId,
    selected_answer: record.selectedAnswer,
    correct_answer: record.correctAnswer,
    is_correct: record.isCorrect,
    duration_seconds: record.durationSeconds,
    answered_at: record.answeredAt,
    chapter: record.chapter,
    knowledge_points: record.knowledgePoints,
    difficulty: record.difficulty,
    question_type: record.questionType,
    is_favorite: record.isFavorite,
    is_wrong_book: record.isWrongBook,
    retry_count: record.retryCount,
    is_not_understood: record.isNotUnderstood,
    synced_at: syncedAt,
  }
}

function fromCloudRecord(item: CloudAnswerRecord): ObcpAnswerRecord {
  return {
    id: item.record_id,
    userId: LOCAL_USER_ID,
    questionId: item.question_id,
    selectedAnswer: item.selected_answer,
    correctAnswer: item.correct_answer,
    isCorrect: item.is_correct,
    durationSeconds: item.duration_seconds,
    answeredAt: item.answered_at,
    chapter: item.chapter,
    knowledgePoints: item.knowledge_points,
    difficulty: item.difficulty,
    questionType: item.question_type,
    isFavorite: item.is_favorite,
    isWrongBook: item.is_wrong_book,
    retryCount: item.retry_count,
    isNotUnderstood: item.is_not_understood,
    syncStatus: 'synced',
    syncedAt: item.synced_at,
  }
}

function toCloudSession(item: ObcpPracticeSession, userId: string, syncedAt: string): CloudPracticeSession {
  return {
    user_id: userId,
    session_id: item.id,
    mode: item.mode,
    source_label: item.sourceLabel,
    question_ids: item.questionIds,
    answered_count: item.answeredCount,
    correct_count: item.correctCount,
    started_at: item.startedAt,
    completed_at: item.completedAt,
    synced_at: syncedAt,
  }
}

function fromCloudSession(item: CloudPracticeSession): ObcpPracticeSession {
  return {
    id: item.session_id,
    userId: LOCAL_USER_ID,
    mode: item.mode,
    sourceLabel: item.source_label,
    questionIds: item.question_ids,
    answeredCount: item.answered_count,
    correctCount: item.correct_count,
    startedAt: item.started_at,
    completedAt: item.completed_at,
    syncStatus: 'synced',
    syncedAt: item.synced_at,
  }
}
