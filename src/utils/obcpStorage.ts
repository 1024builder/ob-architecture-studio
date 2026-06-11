import type { ObcpAnswerRecord, ObcpUserState } from '../data/obcpTypes'

const STORAGE_PREFIX = 'ob-architecture-studio:obcp-user'

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
  }
}

export function loadObcpUserState(userId: string): ObcpUserState {
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return createEmptyUserState(userId)
    const parsed = JSON.parse(raw) as Partial<ObcpUserState>
    return {
      userId,
      records: Array.isArray(parsed.records)
        ? parsed.records.map((record) => ({
          ...record,
          isNotUnderstood: record.isNotUnderstood ?? false,
        }))
        : [],
      favoriteQuestionIds: Array.isArray(parsed.favoriteQuestionIds) ? parsed.favoriteQuestionIds : [],
      wrongBookQuestionIds: Array.isArray(parsed.wrongBookQuestionIds) ? parsed.wrongBookQuestionIds : [],
      notUnderstoodQuestionIds: Array.isArray(parsed.notUnderstoodQuestionIds) ? parsed.notUnderstoodQuestionIds : [],
    }
  } catch {
    return createEmptyUserState(userId)
  }
}

export function saveObcpUserState(state: ObcpUserState) {
  try {
    window.localStorage.setItem(storageKey(state.userId), JSON.stringify(state))
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
    records: [...state.records, record],
    wrongBookQuestionIds: [...wrongBook],
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
    records: state.records.map((record) =>
      record.questionId === questionId ? { ...record, isNotUnderstood } : record,
    ),
  }
}
