export type TaxExam = '税务师'
export type TaxSubject =
  | '税法一'
  | '税法二'
  | '涉税服务实务'
  | '财务与会计'
  | '涉税服务相关法律'
export type TaxQuestionType =
  | 'single'
  | 'multiple'
  | 'judge'
  | 'calculation'
  | 'comprehensive'
  | 'short_answer'
export type TaxQuestionDifficulty = 'easy' | 'normal' | 'hard'

export type TaxQuestionOption = {
  key: string
  text: string
}

export type TaxQuestion = {
  questionId: string
  subject: TaxSubject
  chapter: string
  section: string
  type: TaxQuestionType
  stem: string
  options: TaxQuestionOption[]
  answer: string[]
  explanation: string
  difficulty: TaxQuestionDifficulty
  tags: string[]
  note: string
  sourceText?: string
  year: number
  createdAt: string
  updatedAt: string
}

export type TaxQuestionBank = {
  bankId: string
  bankName: string
  exam: TaxExam
  subject: TaxSubject
  source: string
  year: number
  questions: TaxQuestion[]
}

export type TaxAnswerRecord = {
  recordId: string
  bankId: string
  questionId: string
  selectedAnswer: string[]
  correctAnswer: string[]
  isCorrect: boolean | null
  answeredAt: string
}

export type TaxQuestionState = {
  questionId: string
  isFavorite: boolean
  isWrongBook: boolean
  isNotUnderstood: boolean
  updatedAt: string
}

export type TaxPracticeMode =
  | 'sequential'
  | 'random'
  | 'wrongBook'
  | 'favorite'
