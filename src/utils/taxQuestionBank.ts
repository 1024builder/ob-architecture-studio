import type {
  TaxAnswerRecord,
  TaxQuestion,
  TaxQuestionBank,
  TaxQuestionDifficulty,
  TaxQuestionState,
  TaxQuestionType,
  TaxSubject,
} from '../data/taxQuestionTypes'
import { taxQuestionBankTemplate } from '../data/taxQuestionTemplate'
import { downloadTextFile } from './obcpExport'

export const TAX_QUESTIONS_STORAGE_KEY = 'ob-architecture-studio:tax-questions'
export const TAX_ANSWER_RECORDS_STORAGE_KEY = 'ob-architecture-studio:tax-answer-records'
export const TAX_QUESTION_STATES_STORAGE_KEY = 'ob-architecture-studio:tax-question-states'
export const TAX_ACTIVE_BANK_STORAGE_KEY = 'ob-architecture-studio:tax-active-bank'
export const TAX_DATA_CHANGED_EVENT = 'ob-architecture-studio:tax-data-changed'

const subjects: TaxSubject[] = ['税法一', '税法二', '涉税服务实务', '财务与会计', '涉税服务相关法律']
const types: TaxQuestionType[] = ['single', 'multiple', 'judge', 'calculation', 'comprehensive', 'short_answer']
const difficulties: TaxQuestionDifficulty[] = ['easy', 'normal', 'hard']

export type TaxImportResult = {
  banks: TaxQuestionBank[]
  importedCount: number
  duplicateCount: number
  invalidCount: number
  errors: string[]
}

export function loadTaxQuestionBanks(): TaxQuestionBank[] {
  try {
    const raw = window.localStorage.getItem(TAX_QUESTIONS_STORAGE_KEY)
    if (raw === null) {
      window.localStorage.setItem(
        TAX_QUESTIONS_STORAGE_KEY,
        JSON.stringify([taxQuestionBankTemplate]),
      )
      return [taxQuestionBankTemplate]
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      const result = validateTaxQuestionBank(item)
      return result.valid ? [result.bank] : []
    })
  } catch {
    return []
  }
}

export function saveTaxQuestionBanks(banks: TaxQuestionBank[]) {
  window.localStorage.setItem(TAX_QUESTIONS_STORAGE_KEY, JSON.stringify(banks))
  notify()
}

export function clearTaxQuestionBanks() {
  window.localStorage.setItem(TAX_QUESTIONS_STORAGE_KEY, '[]')
  window.localStorage.removeItem(TAX_ACTIVE_BANK_STORAGE_KEY)
  notify()
}

export function getActiveTaxBankId() {
  return window.localStorage.getItem(TAX_ACTIVE_BANK_STORAGE_KEY)
}

export function setActiveTaxBankId(bankId: string) {
  window.localStorage.setItem(TAX_ACTIVE_BANK_STORAGE_KEY, bankId)
  notify()
}

export function loadTaxAnswerRecords(): TaxAnswerRecord[] {
  return loadArray<TaxAnswerRecord>(TAX_ANSWER_RECORDS_STORAGE_KEY)
}

export function appendTaxAnswerRecord(record: TaxAnswerRecord) {
  const records = loadTaxAnswerRecords()
  window.localStorage.setItem(TAX_ANSWER_RECORDS_STORAGE_KEY, JSON.stringify([...records, record]))
  notify()
}

export function loadTaxQuestionStates(): TaxQuestionState[] {
  return loadArray<TaxQuestionState>(TAX_QUESTION_STATES_STORAGE_KEY)
}

export function updateTaxQuestionState(
  questionId: string,
  patch: Partial<Pick<TaxQuestionState, 'isFavorite' | 'isWrongBook' | 'isNotUnderstood'>>,
) {
  const states = loadTaxQuestionStates()
  const current = states.find((item) => item.questionId === questionId)
  const next: TaxQuestionState = {
    questionId,
    isFavorite: current?.isFavorite ?? false,
    isWrongBook: current?.isWrongBook ?? false,
    isNotUnderstood: current?.isNotUnderstood ?? false,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  window.localStorage.setItem(
    TAX_QUESTION_STATES_STORAGE_KEY,
    JSON.stringify([...states.filter((item) => item.questionId !== questionId), next]),
  )
  notify()
  return next
}

export function importTaxQuestionBanks(raw: string, existing: TaxQuestionBank[]): TaxImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { banks: [], importedCount: 0, duplicateCount: 0, invalidCount: 1, errors: ['文件不是有效的 JSON。'] }
  }
  const candidates = Array.isArray(parsed) ? parsed : [parsed]
  const existingIds = new Set(existing.map((item) => item.bankId))
  const importedIds = new Set<string>()
  const banks: TaxQuestionBank[] = []
  const errors: string[] = []
  let duplicateCount = 0
  let invalidCount = 0
  candidates.forEach((candidate, index) => {
    const result = validateTaxQuestionBank(candidate)
    if (!result.valid) {
      invalidCount += 1
      errors.push(`第 ${index + 1} 个题库：${result.error}`)
      return
    }
    if (existingIds.has(result.bank.bankId) || importedIds.has(result.bank.bankId)) {
      duplicateCount += 1
      return
    }
    importedIds.add(result.bank.bankId)
    banks.push(result.bank)
  })
  return { banks, importedCount: banks.length, duplicateCount, invalidCount, errors: errors.slice(0, 5) }
}

export function validateTaxQuestionBank(
  value: unknown,
): { valid: true; bank: TaxQuestionBank } | { valid: false; error: string } {
  if (!isRecord(value)) return { valid: false, error: '题库必须是对象。' }
  for (const field of ['bankId', 'bankName', 'source'] as const) {
    if (!isNonEmptyString(value[field])) return { valid: false, error: `缺少有效字段 ${field}。` }
  }
  if (value.exam !== '税务师') return { valid: false, error: 'exam 必须固定为“税务师”。' }
  if (!subjects.includes(value.subject as TaxSubject)) return { valid: false, error: 'subject 不是支持的税务师科目。' }
  if (!Number.isInteger(value.year)) return { valid: false, error: 'year 必须是整数年份。' }
  if (!Array.isArray(value.questions) || !value.questions.length) return { valid: false, error: 'questions 必须是非空数组。' }
  const questions: TaxQuestion[] = []
  const ids = new Set<string>()
  for (let index = 0; index < value.questions.length; index += 1) {
    const result = validateTaxQuestion(value.questions[index])
    if (!result.valid) return { valid: false, error: `第 ${index + 1} 题：${result.error}` }
    if (ids.has(result.question.questionId)) return { valid: false, error: `题号 ${result.question.questionId} 重复。` }
    ids.add(result.question.questionId)
    questions.push(result.question)
  }
  return {
    valid: true,
    bank: {
      bankId: value.bankId as string,
      bankName: value.bankName as string,
      exam: '税务师',
      subject: value.subject as TaxSubject,
      source: value.source as string,
      year: value.year as number,
      questions,
    },
  }
}

export function downloadTaxQuestionBankTemplate() {
  downloadTextFile('tax-question-bank-template.json', JSON.stringify(taxQuestionBankTemplate, null, 2), 'application/json;charset=utf-8')
}

export function downloadTaxQuestionBanks(banks: TaxQuestionBank[]) {
  downloadTextFile('tax-question-banks.json', JSON.stringify(banks, null, 2), 'application/json;charset=utf-8')
}

function validateTaxQuestion(
  value: unknown,
): { valid: true; question: TaxQuestion } | { valid: false; error: string } {
  if (!isRecord(value)) return { valid: false, error: '题目必须是对象。' }
  for (const field of ['questionId', 'chapter', 'section', 'stem', 'explanation', 'note', 'createdAt', 'updatedAt'] as const) {
    if (typeof value[field] !== 'string' || (field !== 'note' && !value[field])) return { valid: false, error: `缺少有效字段 ${field}。` }
  }
  if (!subjects.includes(value.subject as TaxSubject)) return { valid: false, error: 'subject 无效。' }
  if (!types.includes(value.type as TaxQuestionType)) return { valid: false, error: 'type 无效。' }
  if (!difficulties.includes(value.difficulty as TaxQuestionDifficulty)) return { valid: false, error: 'difficulty 无效。' }
  if (!Number.isInteger(value.year)) return { valid: false, error: 'year 必须是整数。' }
  if (!isStringArray(value.answer, true)) return { valid: false, error: 'answer 必须是非空字符串数组。' }
  if (!isStringArray(value.tags, false)) return { valid: false, error: 'tags 必须是字符串数组。' }
  if (!Array.isArray(value.options) || !value.options.every(isOption)) return { valid: false, error: 'options 必须是 { key, text } 数组。' }
  const type = value.type as TaxQuestionType
  if (!['short_answer', 'comprehensive'].includes(type) && value.options.length < 2) return { valid: false, error: '客观题至少需要两个选项。' }
  const answer = value.answer as string[]
  const optionKeys = new Set((value.options as Array<{ key: string }>).map((item) => item.key))
  if (value.options.length && answer.some((item) => !optionKeys.has(item))) return { valid: false, error: 'answer 中存在未定义的选项。' }
  if (['single', 'judge', 'calculation'].includes(type) && answer.length !== 1) return { valid: false, error: '单选、判断和计算型单选只能有一个答案。' }
  return { valid: true, question: value as TaxQuestion }
}

function loadArray<T>(key: string): T[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}

function notify() {
  window.dispatchEvent(new CustomEvent(TAX_DATA_CHANGED_EVENT))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown, requireItem: boolean) {
  return Array.isArray(value)
    && (!requireItem || value.length > 0)
    && value.every(isNonEmptyString)
}

function isOption(value: unknown) {
  return isRecord(value) && isNonEmptyString(value.key) && isNonEmptyString(value.text)
}
