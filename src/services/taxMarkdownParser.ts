import type {
  TaxQuestion,
  TaxQuestionBank,
  TaxQuestionDifficulty,
  TaxQuestionOption,
  TaxQuestionType,
  TaxSubject,
} from '../data/taxQuestionTypes'

export interface ParsedTaxQuestion extends Omit<TaxQuestion, 'answer' | 'explanation'> {
  answer: string[]
  explanation: string
  parseWarnings: string[]
  originalNumber: string
}

export interface ParsedTaxQuestionBank extends Omit<TaxQuestionBank, 'questions'> {
  questions: ParsedTaxQuestion[]
  parseWarnings: string[]
}

export interface TaxMarkdownParseResult {
  bank: ParsedTaxQuestionBank | null
  errors: string[]
}

interface ParseOptions {
  fileName?: string
}

const TAX_SUBJECTS: TaxSubject[] = [
  '税法一',
  '税法二',
  '涉税服务实务',
  '财务与会计',
  '涉税服务相关法律',
]

const TYPE_LABELS: Array<{ pattern: string; type: TaxQuestionType; label: string }> = [
  { pattern: '单项选择题', type: 'single', label: '单项选择题' },
  { pattern: '多项选择题', type: 'multiple', label: '多项选择题' },
  { pattern: '判断题', type: 'judge', label: '判断题' },
  { pattern: '计算题', type: 'calculation', label: '计算题' },
  { pattern: '综合题', type: 'comprehensive', label: '综合题' },
  { pattern: '简答题', type: 'short_answer', label: '简答题' },
]

const OBJECTIVE_TYPES: TaxQuestionType[] = ['single', 'multiple', 'judge', 'calculation']
const SUPPORTED_TYPES: TaxQuestionType[] = ['single', 'multiple', 'judge', 'calculation', 'comprehensive', 'short_answer']
const ANSWER_LABEL_PATTERN = /^\s*(?:【|\[)?(?:参考)?(?:正确)?答案(?:】|])?\s*[：:]?\s*(.+)$/i
const CHAPTER_PATTERN = /^(第[一二三四五六七八九十百0-9]+章)\s*(.+)$/
const QUESTION_PATTERN = /^\s*(\d+)\s*[.．、]\s*(.*)$/
const OPTION_PATTERN = /^\s*([A-E])\s*(?:[.．、:：)）]|\s+)\s*(.+)$/i
const EXPLANATION_PATTERN = /^(?:【|\[)?(?:答案)?解析(?:】|])?\s*[：:]?\s*/i
const KNOWLEDGE_PATTERN = /^(?:【|\[)?考点(?:】|])?\s*[：:]?\s*(.*)$/i
const TAG_PATTERNS = ['母题', '子题', '新变', '背', '计算题', '易错', '口诀'] as const

function stripMarkdownHeading(line: string) {
  return line.replace(/^\s{0,3}#{1,6}\s*/, '').trim()
}

function normalizeLine(line: string) {
  const normalized = line.replace(/\u00a0/g, ' ').replace(/[ \t]+$/g, '').trim()
  if (!normalized.startsWith('|')) return normalized
  return normalized
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
    .filter(Boolean)
    .join(' ')
}

function isNoiseLine(line: string) {
  const value = normalizeLine(line)
  if (!value) return true
  if (/^!\[[^\]]*]\([^)]*\)\s*$/.test(value)) return true
  if (/^<img\b[^>]*>\s*$/i.test(value)) return true
  if (/扫码(?:做题|查看|练习|听课)|扫描二维码|长按识别二维码/.test(value)) return true
  if (/^20\d{2}年.*税务师职业资格考试/.test(value)) return true
  if (/^(?:第\s*)?\d+\s*页(?:\s*\/\s*\d+\s*页)?$/.test(value)) return true
  if (/^[|: -]{3,}$/.test(value)) return true
  return false
}

function cleanContentLines(lines: string[]) {
  return lines
    .map(normalizeLine)
    .filter((line) => !isNoiseLine(line))
}

function detectSubject(text: string): TaxSubject | null {
  return TAX_SUBJECTS.find((subject) => text.includes(subject)) ?? null
}

function detectYear(text: string) {
  const match = text.match(/\b(20\d{2})\b/)
  return match ? Number(match[1]) : null
}

function detectSource(text: string) {
  const match = text.match(/轻\s*([1-9]\d*)/)
  return match ? `轻${match[1]}` : 'MinerU Markdown'
}

function detectSection(line: string) {
  const normalized = stripMarkdownHeading(line).replace(/^[一二三四五六七八九十]+[、.．]\s*/, '')
  return TYPE_LABELS.find(({ pattern }) => normalized.includes(pattern)) ?? null
}

function simpleHash(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash.toString(36)
}

function normalizeAnswerToken(value: string) {
  if (/^(?:√|正确|对)$/i.test(value)) return '正确'
  if (/^(?:×|✕|错误|错)$/i.test(value)) return '错误'
  return value.toUpperCase()
}

export function normalizeTaxAnswer(value: string, type: TaxQuestionType): string[] {
  const cleaned = value
    .replace(/[（(【]/g, '')
    .split('[').join('')
    .replace(/[）)】]/g, '')
    .split(']').join('')
    .trim()
  if (type === 'short_answer' || type === 'comprehensive') {
    return cleaned ? [cleaned] : []
  }
  const judgeMatch = cleaned.match(/√|×|✕|正确|错误|(^|[\s，,、])对($|[\s，,、])|(^|[\s，,、])错($|[\s，,、])/)
  if (type === 'judge' && judgeMatch) {
    const token = judgeMatch[0].trim().replace(/[\s，,、]/g, '')
    return [normalizeAnswerToken(token)]
  }
  const letters = Array.from(new Set<string>(cleaned.toUpperCase().match(/[A-E]/g) ?? []))
  if (type === 'single' || type === 'calculation') return letters.slice(0, 1)
  return letters
}

function extractAnswer(
  lines: string[],
  type: TaxQuestionType,
): { answer: string[]; consumedIndexes: Set<number> } {
  const consumedIndexes = new Set<number>()
  let candidate = ''

  lines.forEach((line, index) => {
    const labelMatch = line.match(ANSWER_LABEL_PATTERN)
    if (labelMatch) {
      candidate = labelMatch[1]
      consumedIndexes.add(index)
      return
    }

    if (!candidate && /^(?:[（(][A-E](?:[、,，\s]*[A-E])*[）)]|[A-E]{1,5}|√|×|正确|错误|对|错)$/.test(line)) {
      candidate = line
      consumedIndexes.add(index)
    }
  })

  if (!candidate) {
    const nearbyText = lines.join(' ')
    const parenthesized = nearbyText.match(/[（(]([A-E](?:[、,，\s]*[A-E])*)[）)]/)
    if (parenthesized) candidate = parenthesized[1]
  }

  if (!candidate) return { answer: [], consumedIndexes }

  return { answer: normalizeTaxAnswer(candidate, type), consumedIndexes }
}

function buildQuestionWarnings(question: {
  chapter: string
  type: TaxQuestionType
  stem: string
  options: TaxQuestionOption[]
  answer: string[]
  explanation: string
}, extraWarnings: string[] = []) {
  const warnings = [...extraWarnings]
  const isSubjective = ['short_answer', 'comprehensive'].includes(question.type)
  if (!question.stem.trim()) warnings.push('未识别题干')
  if (question.type === 'judge') {
    const optionKeys = new Set(question.options.map((option) => option.key))
    if (!optionKeys.has('正确') || !optionKeys.has('错误')) warnings.push('未识别选项')
  } else if (OBJECTIVE_TYPES.includes(question.type)) {
    if (question.options.length === 0) warnings.push('未识别选项')
    else if (question.options.length < 4) warnings.push('客观题选项数量不足')
  }
  if (!isSubjective && question.answer.length === 0) warnings.push('未识别答案')
  if (isSubjective && !question.answer.length && !question.explanation.trim()) warnings.push('未识别答案')
  if (!question.explanation.trim() && !(isSubjective && question.answer.length)) warnings.push('未识别解析')
  return Array.from(new Set(warnings))
}

function expandOptionLines(block: string[]) {
  return block.flatMap((rawLine) => {
    const line = normalizeLine(rawLine)
    if (!line) return ['']
    const marker = /(?:^|[\s|])([A-E])\s*(?:[.．、:：)）]\s*|\s+)(?=\S)/gi
    const matches = Array.from(line.matchAll(marker))
    if (!matches.length) return [line]
    const prefix = line.slice(0, matches[0].index).trim()
    const pieces = matches.map((match, index) => {
      const start = (match.index ?? 0) + match[0].length
      const end = matches[index + 1]?.index ?? line.length
      return `${match[1].toUpperCase()}. ${line.slice(start, end).trim()}`
    })
    return prefix ? [prefix, ...pieces] : pieces
  })
}

function extractKnowledgeTags(lines: string[]) {
  return lines.flatMap((line) => {
    const match = line.match(KNOWLEDGE_PATTERN)
    if (!match?.[1]) return []
    return match[1]
      .split(/[、，,；;|]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && item.length <= 30)
  })
}

function extractStructuralTags(sourceText: string) {
  return TAG_PATTERNS.filter((tag) => {
    if (tag !== '背') return sourceText.includes(tag)
    return sourceText.includes('（背）')
      || sourceText.includes('(背)')
      || sourceText.includes('【背】')
      || sourceText.includes('[背]')
  })
}

function parseQuestionBlock(params: {
  block: string[]
  number: string
  chapter: string
  section: string
  type: TaxQuestionType
  subject: TaxSubject
  bankId: string
  index: number
  year: number
  now: string
}): ParsedTaxQuestion {
  const {
    block,
    number,
    chapter,
    section,
    type,
    subject,
    bankId,
    index,
    year,
    now,
  } = params
  const sourceText = block.join('\n').trim()
  const expandedLines = expandOptionLines(block)
  const lines = cleanContentLines(expandedLines)
  const options: TaxQuestionOption[] = []
  const optionIndexes = new Set<number>()
  let firstOptionIndex = -1
  let lastOptionIndex = -1

  lines.forEach((line, lineIndex) => {
    const optionMatch = line.match(OPTION_PATTERN)
    if (!optionMatch) return
    const key = optionMatch[1].toUpperCase()
    if (firstOptionIndex < 0) firstOptionIndex = lineIndex
    lastOptionIndex = lineIndex
    optionIndexes.add(lineIndex)
    if (options.some((option) => option.key === key)) return
    options.push({ key, text: optionMatch[2].trim() })
  })

  const { answer, consumedIndexes } = extractAnswer(lines, type)
  if (type === 'judge' && options.length === 0) {
    options.push(
      { key: '正确', text: '正确' },
      { key: '错误', text: '错误' },
    )
  }
  const explanationMarkerIndex = lines.findIndex((line) => EXPLANATION_PATTERN.test(line))
  const stemEnd = firstOptionIndex >= 0
    ? firstOptionIndex
    : explanationMarkerIndex >= 0
      ? explanationMarkerIndex
      : lines.length
  const stem = lines
    .slice(0, stemEnd)
    .filter((_, lineIndex) => !consumedIndexes.has(lineIndex))
    .join('\n')
    .replace(/^(?:\d+\s*[.．、]\s*)/, '')
    .trim()

  const explanationStart = explanationMarkerIndex >= 0
    ? explanationMarkerIndex
    : lastOptionIndex >= 0
      ? lastOptionIndex + 1
      : stemEnd
  const explanation = lines
    .slice(explanationStart)
    .filter((_, relativeIndex) => {
      const actualIndex = explanationStart + relativeIndex
      return !optionIndexes.has(actualIndex) && !consumedIndexes.has(actualIndex)
    })
    .filter((line) => !KNOWLEDGE_PATTERN.test(line))
    .join('\n')
    .replace(EXPLANATION_PATTERN, '')
    .trim()

  const tags = [
    ...extractStructuralTags(sourceText),
    ...extractKnowledgeTags(lines),
  ]
  const questionBase = {
    chapter,
    type,
    stem,
    options,
    answer,
    explanation,
  }

  return {
    questionId: `${bankId}-q${String(index + 1).padStart(4, '0')}`,
    subject,
    chapter,
    section,
    type,
    stem,
    options,
    answer,
    explanation,
    difficulty: 'normal' satisfies TaxQuestionDifficulty,
    tags: Array.from(new Set(tags)),
    note: '',
    sourceText,
    year,
    createdAt: now,
    updatedAt: now,
    parseWarnings: buildQuestionWarnings(questionBase),
    originalNumber: number,
  }
}

export function revalidateParsedTaxQuestion(question: ParsedTaxQuestion): ParsedTaxQuestion {
  return {
    ...question,
    parseWarnings: buildQuestionWarnings(
      question,
      question.parseWarnings.includes('题号重复') ? ['题号重复'] : [],
    ),
    updatedAt: new Date().toISOString(),
  }
}

export function getParsedTaxQuestionImportBlockReasons(question: ParsedTaxQuestion): string[] {
  const reasons: string[] = []
  const isSubjective = ['short_answer', 'comprehensive'].includes(question.type)

  if (!question.chapter.trim() || question.chapter === '未识别章节') reasons.push('缺少章节')
  if (!question.stem.trim()) reasons.push('缺少题干')
  if (!SUPPORTED_TYPES.includes(question.type)) reasons.push('缺少题型')

  if (isSubjective) {
    if (!question.answer.length && !question.explanation.trim()) reasons.push('缺少参考答案或解析')
  } else {
    if (!question.answer.length) reasons.push('缺少答案')
    if (!question.explanation.trim()) reasons.push('缺少解析')
  }

  if (['single', 'multiple', 'calculation'].includes(question.type) && question.options.length < 4) {
    reasons.push(`客观题选项不足 4 个（当前 ${question.options.length} 个）`)
  }

  if (question.type === 'judge') {
    const optionKeys = new Set(question.options.map((option) => option.key))
    if (!optionKeys.has('正确') || !optionKeys.has('错误')) reasons.push('判断题缺少“正确 / 错误”选项')
  }

  const optionKeys = new Set(question.options.map((option) => option.key))
  if (question.options.length && question.answer.some((answer) => !optionKeys.has(answer))) {
    reasons.push('答案与选项不匹配')
  }
  if (['single', 'judge', 'calculation'].includes(question.type) && question.answer.length > 1) {
    reasons.push('当前题型只能有一个答案')
  }

  return Array.from(new Set(reasons))
}

export function isParsedTaxQuestionImportable(question: ParsedTaxQuestion) {
  return getParsedTaxQuestionImportBlockReasons(question).length === 0
}

export function toStandardTaxQuestionBank(
  bank: ParsedTaxQuestionBank,
  questions: ParsedTaxQuestion[] = bank.questions,
): TaxQuestionBank {
  return {
    bankId: bank.bankId,
    bankName: bank.bankName,
    exam: '税务师',
    subject: bank.subject,
    source: bank.source,
    year: bank.year,
    questions: questions.map((question) => {
      const isSubjective = ['short_answer', 'comprehensive'].includes(question.type)
      const fallback = question.explanation.trim() || question.answer[0] || '请人工补充参考答案'
      return {
      questionId: question.questionId,
      subject: question.subject,
      chapter: question.chapter,
      section: question.section,
      type: question.type,
      stem: question.stem,
      options: question.options,
      answer: question.answer.length ? question.answer : isSubjective ? [fallback] : question.answer,
      explanation: question.explanation.trim() ? question.explanation : isSubjective ? fallback : question.explanation,
      difficulty: question.difficulty,
      tags: question.tags,
      note: question.note,
      sourceText: question.sourceText,
      year: question.year,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
      }
    }),
  }
}

export function parseTaxMarkdown(
  markdown: string,
  options: ParseOptions = {},
): TaxMarkdownParseResult {
  const raw = markdown.replace(/\r\n?/g, '\n').trim()
  if (!raw) return { bank: null, errors: ['Markdown 内容为空，请上传或粘贴题库文本。'] }

  const fileName = options.fileName?.replace(/\.md$/i, '') ?? ''
  const metadataText = `${fileName}\n${raw.slice(0, 5000)}`
  const subject = detectSubject(metadataText) ?? '税法一'
  const detectedYear = detectYear(metadataText)
  const year = detectedYear ?? new Date().getFullYear()
  const source = detectSource(metadataText)
  const bankId = `tax-md-${year}-${simpleHash(`${fileName}:${raw.slice(0, 8000)}`)}`
  const bankName = fileName || `${year} ${subject} Markdown 解析题库`
  const now = new Date().toISOString()
  const globalWarnings: string[] = []
  if (!detectSubject(metadataText)) globalWarnings.push('未识别科目，已暂按“税法一”处理')
  if (!detectedYear) globalWarnings.push(`未识别年份，已暂按 ${year} 年处理`)

  const lines = raw.split('\n')
  const questions: ParsedTaxQuestion[] = []
  let currentChapter = '未识别章节'
  let currentSection = '单项选择题'
  let currentType: TaxQuestionType = 'single'
  let activeBlock: string[] | null = null
  let activeNumber = ''
  let chapterCount = 0

  const flushQuestion = () => {
    if (!activeBlock) return
    questions.push(parseQuestionBlock({
      block: activeBlock,
      number: activeNumber,
      chapter: currentChapter,
      section: currentSection,
      type: currentType,
      subject,
      bankId,
      index: questions.length,
      year,
      now,
    }))
    activeBlock = null
    activeNumber = ''
  }

  lines.forEach((rawLine) => {
    const line = stripMarkdownHeading(rawLine)
    const chapterMatch = line.match(CHAPTER_PATTERN)
    if (chapterMatch) {
      flushQuestion()
      currentChapter = `${chapterMatch[1]} ${chapterMatch[2]}`.trim()
      chapterCount += 1
      return
    }

    const detectedSection = detectSection(line)
    if (detectedSection) {
      flushQuestion()
      currentSection = detectedSection.label
      currentType = detectedSection.type
      return
    }

    const questionMatch = line.match(QUESTION_PATTERN)
    if (questionMatch && !OPTION_PATTERN.test(line)) {
      flushQuestion()
      activeNumber = questionMatch[1]
      activeBlock = [`${questionMatch[1]}. ${questionMatch[2]}`]
      return
    }

    if (activeBlock) activeBlock.push(rawLine)
  })
  flushQuestion()

  const numberCounts = new Map<string, number>()
  questions.forEach((question) => {
    const key = `${question.chapter}|${question.section}|${question.originalNumber}`
    numberCounts.set(key, (numberCounts.get(key) ?? 0) + 1)
  })
  questions.forEach((question) => {
    const key = `${question.chapter}|${question.section}|${question.originalNumber}`
    if ((numberCounts.get(key) ?? 0) > 1) {
      question.parseWarnings = buildQuestionWarnings(question, ['题号重复'])
    }
  })

  if (chapterCount === 0) globalWarnings.push('未识别章节标题，请在预览中补充章节')
  if (questions.length === 0) {
    return {
      bank: null,
      errors: ['未识别到题目。请检查题号是否使用“1.”、“2.”等格式。'],
    }
  }

  return {
    bank: {
      bankId,
      bankName,
      exam: '税务师',
      subject,
      source,
      year,
      questions,
      parseWarnings: globalWarnings,
    },
    errors: [],
  }
}
