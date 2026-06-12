import type {
  ObcpDifficulty,
  ObcpQuestion,
  ObcpQuestionOption,
  ObcpQuestionType,
} from '../data/obcpTypes'
import { downloadTextFile } from './obcpExport'

export const OBCP_CUSTOM_QUESTIONS_STORAGE_KEY =
  'ob-architecture-studio:obcp-custom-questions'
export const OBCP_CUSTOM_QUESTIONS_CHANGED_EVENT =
  'ob-architecture-studio:obcp-custom-questions-changed'

export type QuestionImportResult = {
  importedQuestions: ObcpQuestion[]
  importedCount: number
  duplicateCount: number
  invalidCount: number
  errors: string[]
}

const questionTypes: ObcpQuestionType[] = ['single', 'multiple', 'trueFalse']
const difficulties: ObcpDifficulty[] = ['基础', '进阶', '高级']

export function loadCustomObcpQuestions(): ObcpQuestion[] {
  try {
    const raw = window.localStorage.getItem(OBCP_CUSTOM_QUESTIONS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      const validation = validateObcpQuestion(item)
      return validation.valid ? [validation.question] : []
    })
  } catch {
    return []
  }
}

export function saveCustomObcpQuestions(questions: ObcpQuestion[]) {
  try {
    window.localStorage.setItem(
      OBCP_CUSTOM_QUESTIONS_STORAGE_KEY,
      JSON.stringify(questions),
    )
    window.dispatchEvent(new CustomEvent(OBCP_CUSTOM_QUESTIONS_CHANGED_EVENT))
  } catch {
    throw new Error('题库保存失败，请检查浏览器存储空间或隐私设置。')
  }
}

export function clearCustomObcpQuestions() {
  window.localStorage.removeItem(OBCP_CUSTOM_QUESTIONS_STORAGE_KEY)
  window.dispatchEvent(new CustomEvent(OBCP_CUSTOM_QUESTIONS_CHANGED_EVENT))
}

export function mergeObcpQuestions(
  builtInQuestions: ObcpQuestion[],
  customQuestions: ObcpQuestion[],
) {
  const merged = [...builtInQuestions]
  const knownIds = new Set(builtInQuestions.map((question) => question.questionId))
  customQuestions.forEach((question) => {
    if (!knownIds.has(question.questionId)) {
      merged.push(question)
      knownIds.add(question.questionId)
    }
  })
  return merged
}

export function importObcpQuestions(
  raw: string,
  existingQuestions: ObcpQuestion[],
): QuestionImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {
      importedQuestions: [],
      importedCount: 0,
      duplicateCount: 0,
      invalidCount: 1,
      errors: ['文件不是有效的 JSON。'],
    }
  }

  const candidates = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.questions)
      ? parsed.questions
      : null

  if (!candidates) {
    return {
      importedQuestions: [],
      importedCount: 0,
      duplicateCount: 0,
      invalidCount: 1,
      errors: ['题库根节点必须是题目数组，或包含 questions 数组。'],
    }
  }

  const existingIds = new Set(existingQuestions.map((question) => question.questionId))
  const importedIds = new Set<string>()
  const importedQuestions: ObcpQuestion[] = []
  const errors: string[] = []
  let duplicateCount = 0
  let invalidCount = 0

  candidates.forEach((candidate, index) => {
    const validation = validateObcpQuestion(candidate)
    if (!validation.valid) {
      invalidCount += 1
      errors.push(`第 ${index + 1} 项：${validation.error}`)
      return
    }
    const { question } = validation
    if (existingIds.has(question.questionId) || importedIds.has(question.questionId)) {
      duplicateCount += 1
      return
    }
    importedIds.add(question.questionId)
    const now = new Date().toISOString()
    importedQuestions.push({
      ...question,
      source: question.source ?? 'json_import',
      createdAt: question.createdAt ?? now,
      updatedAt: question.updatedAt ?? now,
    })
  })

  return {
    importedQuestions,
    importedCount: importedQuestions.length,
    duplicateCount,
    invalidCount,
    errors: errors.slice(0, 5),
  }
}

export function downloadQuestionBank(questions: ObcpQuestion[]) {
  downloadTextFile(
    'obcp-question-bank.json',
    JSON.stringify(questions, null, 2),
    'application/json;charset=utf-8',
  )
}

export function downloadQuestionBankTemplate() {
  downloadTextFile(
    'obcp-question-bank-template.json',
    JSON.stringify(questionBankTemplate, null, 2),
    'application/json;charset=utf-8',
  )
}

export function validateObcpQuestion(
  value: unknown,
): { valid: true; question: ObcpQuestion } | { valid: false; error: string } {
  if (!isRecord(value)) return { valid: false, error: '题目必须是对象。' }

  const requiredStrings = [
    'questionId',
    'chapter',
    'stem',
    'explanation',
    'reviewSuggestion',
    'examPoint',
  ] as const
  for (const field of requiredStrings) {
    if (!isNonEmptyString(value[field])) {
      return { valid: false, error: `缺少有效字段 ${field}。` }
    }
  }

  if (!questionTypes.includes(value.type as ObcpQuestionType)) {
    return { valid: false, error: 'type 必须为 single、multiple 或 trueFalse。' }
  }
  if (!difficulties.includes(value.difficulty as ObcpDifficulty)) {
    return { valid: false, error: 'difficulty 必须为基础、进阶或高级。' }
  }

  const arrayFields = [
    'knowledgePoints',
    'answer',
    'tags',
    'relatedComponents',
    'commonMistakes',
  ] as const
  for (const field of arrayFields) {
    if (!isStringArray(value[field], true)) {
      return { valid: false, error: `${field} 必须是非空字符串数组。` }
    }
  }

  if (!Array.isArray(value.options) || value.options.length < 2) {
    return { valid: false, error: 'options 至少需要两个选项。' }
  }
  const options = value.options.filter(isQuestionOption)
  if (options.length !== value.options.length) {
    return { valid: false, error: '选项必须包含非空的 id、label 和 text。' }
  }

  const optionIds = new Set(options.map((option) => option.id))
  const answers = value.answer as string[]
  if (answers.some((answer) => !optionIds.has(answer))) {
    return { valid: false, error: 'answer 中存在未定义的选项 ID。' }
  }
  if (value.type !== 'multiple' && answers.length !== 1) {
    return { valid: false, error: '单选题和判断题只能有一个正确答案。' }
  }

  const optionalDateFields = ['createdAt', 'updatedAt', 'source'] as const
  for (const field of optionalDateFields) {
    if (value[field] !== undefined && typeof value[field] !== 'string') {
      return { valid: false, error: `${field} 必须是字符串。` }
    }
  }

  return {
    valid: true,
    question: {
      questionId: value.questionId as string,
      type: value.type as ObcpQuestionType,
      chapter: value.chapter as string,
      knowledgePoints: [...value.knowledgePoints as string[]],
      difficulty: value.difficulty as ObcpDifficulty,
      stem: value.stem as string,
      options: options.map((option) => ({ ...option })),
      answer: [...answers],
      explanation: value.explanation as string,
      tags: [...value.tags as string[]],
      relatedComponents: [...value.relatedComponents as string[]],
      commonMistakes: [...value.commonMistakes as string[]],
      reviewSuggestion: value.reviewSuggestion as string,
      examPoint: value.examPoint as string,
      source: value.source as string | undefined,
      createdAt: value.createdAt as string | undefined,
      updatedAt: value.updatedAt as string | undefined,
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown, requireItems = false): value is string[] {
  return Array.isArray(value)
    && (!requireItems || value.length > 0)
    && value.every(isNonEmptyString)
}

function isQuestionOption(value: unknown): value is ObcpQuestionOption {
  return isRecord(value)
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.label)
    && isNonEmptyString(value.text)
}

const templateBase = {
  chapter: '示例章节',
  knowledgePoints: ['示例知识点'],
  difficulty: '基础' as const,
  tags: ['示例标签'],
  relatedComponents: ['OBServer'],
  commonMistakes: ['示例常见误区'],
  reviewSuggestion: '复习该知识点的核心概念和架构关系。',
  examPoint: '关注定义、职责边界和典型场景。',
  source: '自定义题库',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const questionBankTemplate: ObcpQuestion[] = [
  {
    ...templateBase,
    questionId: 'CUSTOM-SINGLE-001',
    type: 'single',
    stem: '这是一道单选题示例，请选择正确答案。',
    options: [
      { id: 'A', label: 'A', text: '选项 A' },
      { id: 'B', label: 'B', text: '选项 B' },
    ],
    answer: ['A'],
    explanation: '这里填写单选题解析。',
  },
  {
    ...templateBase,
    questionId: 'CUSTOM-MULTIPLE-001',
    type: 'multiple',
    stem: '这是一道多选题示例，请选择所有正确答案。',
    options: [
      { id: 'A', label: 'A', text: '选项 A' },
      { id: 'B', label: 'B', text: '选项 B' },
      { id: 'C', label: 'C', text: '选项 C' },
    ],
    answer: ['A', 'C'],
    explanation: '这里填写多选题解析。',
  },
  {
    ...templateBase,
    questionId: 'CUSTOM-TRUEFALSE-001',
    type: 'trueFalse',
    stem: '这是一道判断题示例。',
    options: [
      { id: 'true', label: 'A', text: '正确' },
      { id: 'false', label: 'B', text: '错误' },
    ],
    answer: ['true'],
    explanation: '这里填写判断题解析。',
  },
]
