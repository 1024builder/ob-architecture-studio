import type {
  TaxAnswerRecord,
  TaxPracticeMode,
  TaxQuestion,
  TaxQuestionBank,
  TaxQuestionState,
} from '../data/taxQuestionTypes'
import {
  isSupabaseConfigured,
  SupabaseRequestError,
  supabaseRequest,
  type SupabaseSession,
} from '../lib/supabaseClient'
import {
  loadTaxAnswerRecords,
  loadTaxQuestionBanks,
  loadTaxQuestionStates,
  notifyTaxDataChanged,
  saveTaxAnswerRecords,
  saveTaxQuestionBanks,
  saveTaxQuestionStates,
  validateTaxQuestionBank,
} from '../utils/taxQuestionBank'

export type TaxSyncState = 'local' | 'signedOut' | 'syncing' | 'synced' | 'failed'

export type TaxSyncStatus = {
  configured: boolean
  loggedIn: boolean
  email?: string
  state: TaxSyncState
  localQuestionCount: number
  cloudQuestionCount: number
  localRecordCount: number
  cloudRecordCount: number
  lastSyncAt?: string
  lastError?: string
}

type CloudBank = {
  user_id: string
  bank_id: string
  bank_name: string
  exam: string
  subject: TaxQuestionBank['subject']
  source: string
  year: number
  question_count: number
  created_at: string
  updated_at: string
}

type CloudQuestion = {
  user_id: string
  bank_id: string
  question_id: string
  subject: TaxQuestion['subject']
  chapter: string
  section: string
  type: TaxQuestion['type']
  stem: string
  options: TaxQuestion['options']
  answer: string[]
  explanation: string
  difficulty: TaxQuestion['difficulty']
  tags: string[]
  note: string
  source_text?: string
  year: number
  created_at: string
  updated_at: string
}

type CloudAnswerRecord = {
  user_id: string
  record_id: string
  question_id: string
  bank_id: string
  subject: TaxQuestion['subject']
  chapter: string
  type: TaxQuestion['type']
  user_answer: string[]
  correct_answer: string[]
  is_correct: boolean | null
  duration_seconds: number
  practice_mode: TaxPracticeMode
  answered_at: string
  created_at: string
  updated_at: string
}

type CloudQuestionState = {
  user_id: string
  question_id: string
  bank_id: string
  subject: TaxQuestion['subject']
  chapter: string
  is_favorite: boolean
  is_wrong: boolean
  is_confused: boolean
  wrong_count: number
  last_answered_at?: string
  created_at: string
  updated_at: string
}

type QuestionContext = {
  bankId: string
  question: TaxQuestion
}

const STATUS_STORAGE_KEY = 'ob-architecture-studio:tax-sync-status'
export const TAX_SYNC_STATUS_CHANGED_EVENT = 'ob-architecture-studio:tax-sync-status-changed'

export class TaxQuestionSyncError extends Error {
  requiresLogin: boolean

  constructor(message: string, requiresLogin = false) {
    super(message)
    this.name = 'TaxQuestionSyncError'
    this.requiresLogin = requiresLogin
  }
}

export function getTaxSyncStatus(): TaxSyncStatus {
  const localQuestionCount = countQuestions(loadTaxQuestionBanks())
  const localRecordCount = loadTaxAnswerRecords().length
  const fallback: TaxSyncStatus = {
    configured: isSupabaseConfigured,
    loggedIn: false,
    state: isSupabaseConfigured ? 'signedOut' : 'local',
    localQuestionCount,
    cloudQuestionCount: 0,
    localRecordCount,
    cloudRecordCount: 0,
  }
  try {
    const raw = window.localStorage.getItem(STATUS_STORAGE_KEY)
    if (!raw) return fallback
    const stored = JSON.parse(raw) as Partial<TaxSyncStatus>
    return {
      ...fallback,
      ...stored,
      configured: isSupabaseConfigured,
      loggedIn: isSupabaseConfigured && Boolean(stored.loggedIn),
      state: isSupabaseConfigured ? stored.state ?? fallback.state : 'local',
      localQuestionCount,
      localRecordCount,
    }
  } catch {
    return fallback
  }
}

export function updateTaxSyncStatus(patch: Partial<TaxSyncStatus>) {
  const next: TaxSyncStatus = {
    ...getTaxSyncStatus(),
    ...patch,
    configured: isSupabaseConfigured,
  }
  try {
    window.localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // The status event still updates mounted views.
  }
  window.dispatchEvent(new CustomEvent(TAX_SYNC_STATUS_CHANGED_EVENT, { detail: next }))
  return next
}

export function clearTaxSyncAccount() {
  return updateTaxSyncStatus({
    loggedIn: false,
    email: undefined,
    state: isSupabaseConfigured ? 'signedOut' : 'local',
    lastError: undefined,
  })
}

export async function syncTaxQuestionData(session: SupabaseSession) {
  const localBanks = loadTaxQuestionBanks()
  const localRecords = normalizeRecords(loadTaxAnswerRecords())
  const localStates = loadTaxQuestionStates()
  updateTaxSyncStatus({
    loggedIn: true,
    email: session.user.email,
    state: 'syncing',
    localQuestionCount: countQuestions(localBanks),
    localRecordCount: localRecords.length,
    lastError: undefined,
  })

  try {
    const [cloudBanks, cloudQuestions, cloudRecords, cloudStates] = await Promise.all([
      selectRows<CloudBank>('tax_question_banks', session),
      selectRows<CloudQuestion>('tax_questions', session),
      selectRows<CloudAnswerRecord>('tax_answer_records', session),
      selectRows<CloudQuestionState>('tax_question_states', session),
    ])
    const cloudQuestionBanks = buildCloudBanks(cloudBanks, cloudQuestions)
    const mergedBanks = mergeBanks(localBanks, cloudQuestionBanks, cloudBanks)
    const questionIndex = buildQuestionIndex(mergedBanks)
    const mergedRecords = mergeRecords(localRecords, cloudRecords.map(fromCloudRecord))
    const mergedStates = mergeStates(localStates, cloudStates, mergedRecords)
    const syncedAt = new Date().toISOString()

    await Promise.all([
      upsertInBatches('tax_question_banks', mergedBanks.map((bank) =>
        toCloudBank(bank, session.user.id)), session, 'user_id,bank_id'),
      upsertInBatches('tax_questions', mergedBanks.flatMap((bank) =>
        bank.questions.map((question) => toCloudQuestion(bank.bankId, question, session.user.id))),
      session, 'user_id,bank_id,question_id'),
      upsertInBatches('tax_answer_records', mergedRecords.map((record) =>
        toCloudRecord(record, questionIndex.get(record.questionId), session.user.id)),
      session, 'user_id,record_id'),
      upsertInBatches('tax_question_states', mergedStates.flatMap((state) => {
        const context = questionIndex.get(state.questionId)
        return context ? [toCloudState(state, context, mergedRecords, cloudStates, session.user.id)] : []
      }), session, 'user_id,bank_id,question_id'),
    ])

    saveTaxQuestionBanks(mergedBanks, false)
    saveTaxAnswerRecords(mergedRecords, false)
    saveTaxQuestionStates(mergedStates, false)
    notifyTaxDataChanged('sync')
    updateTaxSyncStatus({
      loggedIn: true,
      email: session.user.email,
      state: 'synced',
      localQuestionCount: countQuestions(mergedBanks),
      cloudQuestionCount: countQuestions(mergedBanks),
      localRecordCount: mergedRecords.length,
      cloudRecordCount: mergedRecords.length,
      lastSyncAt: syncedAt,
      lastError: undefined,
    })
    return {
      banks: mergedBanks,
      records: mergedRecords,
      states: mergedStates,
      questionCount: countQuestions(mergedBanks),
      recordCount: mergedRecords.length,
      syncedAt,
    }
  } catch (error) {
    const syncError = normalizeTaxSyncError(error)
    updateTaxSyncStatus({
      loggedIn: !syncError.requiresLogin,
      email: syncError.requiresLogin ? undefined : session.user.email,
      state: 'failed',
      localQuestionCount: countQuestions(localBanks),
      localRecordCount: localRecords.length,
      lastError: syncError.message,
    })
    throw syncError
  }
}

export async function deleteAllCloudTaxData(session: SupabaseSession) {
  try {
    for (const table of ['tax_question_states', 'tax_answer_records', 'tax_questions', 'tax_question_banks']) {
      await supabaseRequest(
        `/rest/v1/${table}?user_id=eq.${encodeURIComponent(session.user.id)}`,
        { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
        session.accessToken,
      )
    }
    updateTaxSyncStatus({
      loggedIn: true,
      email: session.user.email,
      state: 'synced',
      cloudQuestionCount: 0,
      cloudRecordCount: 0,
      lastSyncAt: new Date().toISOString(),
      lastError: undefined,
    })
  } catch (error) {
    throw normalizeTaxSyncError(error)
  }
}

async function selectRows<T>(table: string, session: SupabaseSession) {
  return supabaseRequest<T[]>(
    `/rest/v1/${table}?user_id=eq.${encodeURIComponent(session.user.id)}&select=*`,
    { method: 'GET' },
    session.accessToken,
  )
}

async function upsertInBatches(
  table: string,
  rows: unknown[],
  session: SupabaseSession,
  onConflict: string,
) {
  const batchSize = 200
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize)
    await supabaseRequest(
      `/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(batch),
      },
      session.accessToken,
    )
  }
}

function buildCloudBanks(bankRows: CloudBank[], questionRows: CloudQuestion[]) {
  return bankRows.flatMap((row) => {
    const candidate = {
      bankId: row.bank_id,
      bankName: row.bank_name,
      exam: '税务师',
      subject: row.subject,
      source: row.source,
      year: row.year,
      questions: questionRows
        .filter((question) => question.bank_id === row.bank_id)
        .map(fromCloudQuestion),
    }
    const validation = validateTaxQuestionBank(candidate)
    return validation.valid ? [validation.bank] : []
  })
}

function mergeBanks(localBanks: TaxQuestionBank[], cloudBanks: TaxQuestionBank[], cloudRows: CloudBank[]) {
  const ids = new Set([...localBanks.map((bank) => bank.bankId), ...cloudBanks.map((bank) => bank.bankId)])
  return [...ids].flatMap((bankId) => {
    const local = localBanks.find((bank) => bank.bankId === bankId)
    const cloud = cloudBanks.find((bank) => bank.bankId === bankId)
    if (!local) return cloud ? [cloud] : []
    if (!cloud) return [local]
    const cloudUpdatedAt = cloudRows.find((row) => row.bank_id === bankId)?.updated_at
      ?? '1970-01-01T00:00:00.000Z'
    const localUpdatedAt = latestQuestionUpdate(local)
    const metadata = cloudUpdatedAt > localUpdatedAt ? cloud : local
    const questions = new Map<string, TaxQuestion>()
    ;[...cloud.questions, ...local.questions].forEach((question) => {
      const existing = questions.get(question.questionId)
      if (!existing || timestamp(question.updatedAt) >= timestamp(existing.updatedAt)) {
        questions.set(question.questionId, question)
      }
    })
    return [{ ...metadata, questions: [...questions.values()] }]
  })
}

function mergeRecords(local: TaxAnswerRecord[], cloud: TaxAnswerRecord[]) {
  const merged = new Map<string, TaxAnswerRecord>()
  ;[...cloud, ...local].forEach((record) => {
    const normalized = normalizeRecord(record)
    merged.set(normalized.recordId, normalized)
  })
  return [...merged.values()].sort((left, right) => left.answeredAt.localeCompare(right.answeredAt))
}

function mergeStates(
  local: TaxQuestionState[],
  cloud: CloudQuestionState[],
  records: TaxAnswerRecord[],
) {
  const merged = new Map<string, TaxQuestionState>()
  cloud.forEach((state) => {
    const existing = merged.get(state.question_id)
    if (!existing || state.updated_at > existing.updatedAt) {
      merged.set(state.question_id, fromCloudState(state))
    }
  })
  local.forEach((state) => {
    const existing = merged.get(state.questionId)
    if (!existing || state.updatedAt >= existing.updatedAt) merged.set(state.questionId, state)
  })
  records.forEach((record) => {
    if (record.isCorrect !== false) return
    const existing = merged.get(record.questionId)
    if (!existing) {
      merged.set(record.questionId, {
        questionId: record.questionId,
        isFavorite: false,
        isWrongBook: true,
        isNotUnderstood: false,
        updatedAt: record.answeredAt,
      })
    }
  })
  return [...merged.values()]
}

function buildQuestionIndex(banks: TaxQuestionBank[]) {
  const index = new Map<string, QuestionContext>()
  banks.forEach((bank) => bank.questions.forEach((question) => {
    const existing = index.get(question.questionId)
    if (!existing || timestamp(question.updatedAt) > timestamp(existing.question.updatedAt)) {
      index.set(question.questionId, { bankId: bank.bankId, question })
    }
  }))
  return index
}

function normalizeRecords(records: TaxAnswerRecord[]) {
  return records.map(normalizeRecord)
}

function normalizeRecord(record: TaxAnswerRecord): TaxAnswerRecord {
  return {
    ...record,
    recordId: record.recordId || stableRecordId(record),
  }
}

function stableRecordId(record: TaxAnswerRecord) {
  const source = [
    record.bankId,
    record.questionId,
    record.answeredAt,
    record.selectedAnswer?.join(',') ?? '',
  ].join('|')
  let hash = 0
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0
  }
  return `tax-record-${hash.toString(36)}`
}

function toCloudBank(bank: TaxQuestionBank, userId: string): CloudBank {
  const createdAt = earliestQuestionCreate(bank)
  const updatedAt = latestQuestionUpdate(bank)
  return {
    user_id: userId,
    bank_id: bank.bankId,
    bank_name: bank.bankName,
    exam: '税务师',
    subject: bank.subject,
    source: bank.source,
    year: bank.year,
    question_count: bank.questions.length,
    created_at: createdAt,
    updated_at: updatedAt,
  }
}

function toCloudQuestion(bankId: string, question: TaxQuestion, userId: string): CloudQuestion {
  return {
    user_id: userId,
    bank_id: bankId,
    question_id: question.questionId,
    subject: question.subject,
    chapter: question.chapter,
    section: question.section,
    type: question.type,
    stem: question.stem,
    options: question.options,
    answer: question.answer,
    explanation: question.explanation,
    difficulty: question.difficulty,
    tags: question.tags,
    note: question.note,
    source_text: question.sourceText,
    year: question.year,
    created_at: question.createdAt,
    updated_at: question.updatedAt,
  }
}

function fromCloudQuestion(row: CloudQuestion): TaxQuestion {
  return {
    questionId: row.question_id,
    subject: row.subject,
    chapter: row.chapter,
    section: row.section,
    type: row.type,
    stem: row.stem,
    options: row.options,
    answer: row.answer,
    explanation: row.explanation,
    difficulty: row.difficulty,
    tags: row.tags,
    note: row.note,
    sourceText: row.source_text,
    year: row.year,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toCloudRecord(
  record: TaxAnswerRecord,
  context: QuestionContext | undefined,
  userId: string,
): CloudAnswerRecord {
  const question = context?.question
  return {
    user_id: userId,
    record_id: record.recordId,
    question_id: record.questionId,
    bank_id: record.bankId,
    subject: question?.subject ?? '税法一',
    chapter: question?.chapter ?? '未知章节',
    type: question?.type ?? 'single',
    user_answer: record.selectedAnswer,
    correct_answer: record.correctAnswer,
    is_correct: record.isCorrect,
    duration_seconds: record.durationSeconds ?? 0,
    practice_mode: record.practiceMode ?? 'sequential',
    answered_at: record.answeredAt,
    created_at: record.answeredAt,
    updated_at: record.answeredAt,
  }
}

function fromCloudRecord(row: CloudAnswerRecord): TaxAnswerRecord {
  return {
    recordId: row.record_id,
    bankId: row.bank_id,
    questionId: row.question_id,
    selectedAnswer: row.user_answer,
    correctAnswer: row.correct_answer,
    isCorrect: row.is_correct,
    answeredAt: row.answered_at,
    durationSeconds: row.duration_seconds,
    practiceMode: row.practice_mode,
  }
}

function toCloudState(
  state: TaxQuestionState,
  context: QuestionContext,
  records: TaxAnswerRecord[],
  cloudStates: CloudQuestionState[],
  userId: string,
): CloudQuestionState {
  const questionRecords = records.filter((record) => record.questionId === state.questionId)
  const cloudWrongCount = Math.max(0, ...cloudStates
    .filter((item) => item.question_id === state.questionId)
    .map((item) => item.wrong_count))
  const localWrongCount = questionRecords.filter((record) => record.isCorrect === false).length
  const answeredTimes = questionRecords
    .map((record) => record.answeredAt)
    .sort()
  const lastAnsweredAt = answeredTimes[answeredTimes.length - 1]
  return {
    user_id: userId,
    question_id: state.questionId,
    bank_id: context.bankId,
    subject: context.question.subject,
    chapter: context.question.chapter,
    is_favorite: state.isFavorite,
    is_wrong: state.isWrongBook,
    is_confused: state.isNotUnderstood,
    wrong_count: Math.max(localWrongCount, cloudWrongCount),
    last_answered_at: lastAnsweredAt,
    created_at: state.updatedAt,
    updated_at: state.updatedAt,
  }
}

function fromCloudState(row: CloudQuestionState): TaxQuestionState {
  return {
    questionId: row.question_id,
    isFavorite: row.is_favorite,
    isWrongBook: row.is_wrong,
    isNotUnderstood: row.is_confused,
    updatedAt: row.updated_at,
  }
}

function countQuestions(banks: TaxQuestionBank[]) {
  return banks.reduce((total, bank) => total + bank.questions.length, 0)
}

function latestQuestionUpdate(bank: TaxQuestionBank) {
  const values = bank.questions.map((question) => question.updatedAt).sort()
  return values[values.length - 1] ?? new Date().toISOString()
}

function earliestQuestionCreate(bank: TaxQuestionBank) {
  const values = bank.questions.map((question) => question.createdAt).sort()
  return values[0] ?? new Date().toISOString()
}

function timestamp(value?: string) {
  const parsed = Date.parse(value ?? '')
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeTaxSyncError(error: unknown) {
  if (error instanceof SupabaseRequestError) {
    if (error.status === 401) {
      return new TaxQuestionSyncError('税务师同步登录状态已失效，请重新登录。', true)
    }
    if (error.status === 403) {
      return new TaxQuestionSyncError('税务师同步 RLS 权限校验失败，请检查 Supabase 策略。')
    }
    if (error.status === 404 || error.message.includes('PGRST205')) {
      return new TaxQuestionSyncError('税务师云端表不存在，请先执行 v1.4.0 Supabase SQL。')
    }
    if (!error.status) {
      return new TaxQuestionSyncError(error.message || '网络异常，税务师数据已保留在本地。')
    }
    return new TaxQuestionSyncError(`税务师云端操作失败（HTTP ${error.status}），本地数据已保留。`)
  }
  return error instanceof TaxQuestionSyncError
    ? error
    : new TaxQuestionSyncError('税务师同步失败，已保留本地题库和学习记录。')
}
