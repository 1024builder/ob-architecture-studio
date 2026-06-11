export type ObcpQuestionType = 'single' | 'multiple' | 'trueFalse'
export type ObcpDifficulty = '基础' | '进阶' | '高级'
export type ObcpPracticeMode = 'sequential' | 'random' | 'exam' | 'wrongBook' | 'favorite'

export type ObcpPracticeQuestionState = {
  selectedAnswer: string[]
  submitted: boolean
  isCorrect?: boolean
}

export type ObcpQuestionOption = {
  id: string
  label: string
  text: string
}

export type ObcpQuestion = {
  questionId: string
  type: ObcpQuestionType
  chapter: string
  knowledgePoints: string[]
  difficulty: ObcpDifficulty
  stem: string
  options: ObcpQuestionOption[]
  answer: string[]
  explanation: string
  tags: string[]
  relatedComponents: string[]
  commonMistakes: string[]
  reviewSuggestion: string
  examPoint: string
  source?: string
  createdAt?: string
  updatedAt?: string
}

export type ObcpAnswerRecord = {
  id: string
  userId: string
  questionId: string
  selectedAnswer: string[]
  correctAnswer: string[]
  isCorrect: boolean
  durationSeconds: number
  answeredAt: string
  chapter: string
  knowledgePoints: string[]
  difficulty: ObcpDifficulty
  questionType: ObcpQuestionType
  isFavorite: boolean
  isWrongBook: boolean
  retryCount: number
  isNotUnderstood: boolean
}

export type ObcpUserState = {
  userId: string
  records: ObcpAnswerRecord[]
  favoriteQuestionIds: string[]
  wrongBookQuestionIds: string[]
  notUnderstoodQuestionIds: string[]
}

export type StatBucket = {
  name: string
  answeredCount: number
  correctCount: number
  correctRate: number
  averageDurationSeconds: number
}

export type ChapterStat = StatBucket & {
  totalQuestions: number
  completedQuestions: number
  mastery: '待学习' | '需加强' | '基本掌握' | '已掌握'
  suggestedAction: string
}

export type WrongQuestionStat = {
  questionId: string
  stem: string
  chapter: string
  knowledgePoints: string[]
  wrongCount: number
  retryCount: number
  averageDurationSeconds: number
  latestWrongAt: string
  relatedComponents: string[]
}

export type WeakPointDiagnosis = {
  name: string
  correctRate: number
  answeredCount: number
  averageDurationSeconds: number
  reasons: string[]
  relatedComponents: string[]
  suggestion: string
}

export type DailyPracticeStat = {
  date: string
  answeredCount: number
  correctCount: number
  correctRate: number
}

export type UserSummary = {
  userId: string
  totalAnswered: number
  uniqueAnswered: number
  correctRate: number
  wrongCount: number
  favoriteCount: number
  averageDurationSeconds: number
  recentPractice?: string
  recentPracticeAt?: string
}

export type ObcpAnalytics = {
  userSummary: UserSummary
  chapterStats: ChapterStat[]
  knowledgePointStats: StatBucket[]
  difficultyStats: StatBucket[]
  questionTypeStats: StatBucket[]
  weakPoints: StatBucket[]
  strongPoints: StatBucket[]
  insufficientPoints: StatBucket[]
  weakPointDiagnoses: WeakPointDiagnosis[]
  repeatedWrongQuestions: WrongQuestionStat[]
  frequentWrongQuestions: WrongQuestionStat[]
  recentPracticeTrend: DailyPracticeStat[]
  llmPrompt: string
}
