import type { ObcpAnswerRecord, ObcpPracticeSession, ObcpUserState } from '../data/obcpTypes'

const STORAGE_PREFIX = 'ob-architecture-studio:obcp-user'
const SESSION_STORAGE_PREFIX = 'ob-architecture-studio:obcp-practice-sessions'

export const OBCP_DATA_UPDATED_EVENT = 'ob-architecture-studio:obcp-data-updated'
export const OBCP_LOCAL_DATA_CHANGED_EVENT = 'ob-architecture-studio:obcp-local-data-changed'

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`
}

export function createEmptyUserState(userId: string): ObcpUserState {
  return {
    userId,
    records: [],
    favoriteQuestionIds: [],
    wrongBookQuestionIds: [],
    notUnderstoodQuestionIds: [],
    questionStateUpdatedAt: {},
  }
}

export function loadObcpUserState(userId: string): ObcpUserState {
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return createEmptyUserState(userId)
    const parsed = JSON.parse(raw) as Partial<ObcpUserState>
    const records = Array.isArray(parsed.records)
      ? parsed.records.map((record) => ({
        ...record,
        isNotUnderstood: record.isNotUnderstood ?? false,
        syncStatus: record.syncStatus ?? 'pending' as const,
      }))
      : []
    const knownQuestionIds = new Set([
      ...(Array.isArray(parsed.favoriteQuestionIds) ? parsed.favoriteQuestionIds : []),
      ...(Array.isArray(parsed.wrongBookQuestionIds) ? parsed.wrongBookQuestionIds : []),
      ...(Array.isArray(parsed.notUnderstoodQuestionIds) ? parsed.notUnderstoodQuestionIds : []),
    ])
    const fallbackUpdatedAt = new Date().toISOString()
    return {
      userId,
      records,
      favoriteQuestionIds: Array.isArray(parsed.favoriteQuestionIds) ? parsed.favoriteQuestionIds : [],
      wrongBookQuestionIds: Array.isArray(parsed.wrongBookQuestionIds) ? parsed.wrongBookQuestionIds : [],
      notUnderstoodQuestionIds: Array.isArray(parsed.notUnderstoodQuestionIds) ? parsed.notUnderstoodQuestionIds : [],
      questionStateUpdatedAt: {
        ...Object.fromEntries([...knownQuestionIds].map((questionId) => [questionId, fallbackUpdatedAt])),
        ...(parsed.questionStateUpdatedAt ?? {}),
      },
    }
  } catch {
    return createEmptyUserState(userId)
  }
}

export function saveObcpUserState(state: ObcpUserState, notify = true) {
  try {
    window.localStorage.setItem(storageKey(state.userId), JSON.stringify(state))
    if (notify) window.dispatchEvent(new CustomEvent(OBCP_LOCAL_DATA_CHANGED_EVENT))
  } catch {
    // Keep the active session usable when browser storage is unavailable.
  }
}

export function appendAnswerRecord(state: ObcpUserState, record: ObcpAnswerRecord): ObcpUserState {
  const wrongBook = new Set(state.wrongBookQuestionIds)
  if (record.isCorrect) wrongBook.delete(record.questionId)
  else wrongBook.add(record.questionId)

  return {
    ...state,
    records: [...state.records, { ...record, syncStatus: 'pending', syncedAt: undefined }],
    wrongBookQuestionIds: [...wrongBook],
    questionStateUpdatedAt: {
      ...state.questionStateUpdatedAt,
      [record.questionId]: record.answeredAt,
    },
  }
}

export function appendAnswerRecords(state: ObcpUserState, records: ObcpAnswerRecord[]): ObcpUserState {
  return records.reduce(appendAnswerRecord, state)
}

export function toggleFavorite(state: ObcpUserState, questionId: string): ObcpUserState {
  const favorites = new Set(state.favoriteQuestionIds)
  if (favorites.has(questionId)) favorites.delete(questionId)
  else favorites.add(questionId)
  const isFavorite = favorites.has(questionId)
  return {
    ...state,
    favoriteQuestionIds: [...favorites],
    questionStateUpdatedAt: { ...state.questionStateUpdatedAt, [questionId]: new Date().toISOString() },
    records: state.records.map((record) => record.questionId === questionId ? { ...record, isFavorite } : record),
  }
}

export function toggleWrongBook(state: ObcpUserState, questionId: string): ObcpUserState {
  const wrongBook = new Set(state.wrongBookQuestionIds)
  if (wrongBook.has(questionId)) wrongBook.delete(questionId)
  else wrongBook.add(questionId)
  const isWrongBook = wrongBook.has(questionId)
  return {
    ...state,
    wrongBookQuestionIds: [...wrongBook],
    questionStateUpdatedAt: { ...state.questionStateUpdatedAt, [questionId]: new Date().toISOString() },
    records: state.records.map((record) => record.questionId === questionId ? { ...record, isWrongBook } : record),
  }
}

export function toggleNotUnderstood(state: ObcpUserState, questionId: string): ObcpUserState {
  const items = new Set(state.notUnderstoodQuestionIds)
  if (items.has(questionId)) items.delete(questionId)
  else items.add(questionId)
  const isNotUnderstood = items.has(questionId)
  return {
    ...state,
    notUnderstoodQuestionIds: [...items],
    questionStateUpdatedAt: { ...state.questionStateUpdatedAt, [questionId]: new Date().toISOString() },
    records: state.records.map((record) =>
      record.questionId === questionId ? { ...record, isNotUnderstood } : record,
    ),
  }
}

export function loadObcpPracticeSessions(userId: string): ObcpPracticeSession[] {
  try {
    const raw = window.localStorage.getItem(`${SESSION_STORAGE_PREFIX}:${userId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ObcpPracticeSession[]
    return Array.isArray(parsed)
      ? parsed.map((item) => ({ ...item, syncStatus: item.syncStatus ?? 'pending' }))
      : []
  } catch {
    return []
  }
}

export function saveObcpPracticeSessions(
  userId: string,
  sessions: ObcpPracticeSession[],
  notify = true,
) {
  try {
    window.localStorage.setItem(`${SESSION_STORAGE_PREFIX}:${userId}`, JSON.stringify(sessions))
    if (notify) window.dispatchEvent(new CustomEvent(OBCP_LOCAL_DATA_CHANGED_EVENT))
  } catch {
    // Keep local practice available when browser storage is unavailable.
  }
}

export function appendObcpPracticeSession(session: ObcpPracticeSession) {
  const sessions = loadObcpPracticeSessions(session.userId)
  saveObcpPracticeSessions(session.userId, [...sessions, session])
}
