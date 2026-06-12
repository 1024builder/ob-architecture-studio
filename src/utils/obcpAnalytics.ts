import type {
  ChapterStat,
  DailyPracticeStat,
  ObcpAnalytics,
  ObcpAnswerRecord,
  ObcpQuestion,
  ObcpUserState,
  StatBucket,
  WeakPointDiagnosis,
  WrongQuestionStat,
} from '../data/obcpTypes'
import { normalizeObcpAnswerRecords } from './obcpStorage'

export function calculateObcpAnalytics(
  userState: ObcpUserState,
  questions: ObcpQuestion[],
): ObcpAnalytics {
  const questionById = new Map(questions.map((question) => [question.questionId, question]))
  const records = normalizeObcpAnswerRecords(userState.records)
    .filter((record) => questionById.has(record.questionId))
  const availableQuestionIds = new Set(questionById.keys())
  const latestRecord = [...records].sort((a, b) => b.answeredAt.localeCompare(a.answeredAt))[0]
  const totalCorrect = records.filter((record) => record.isCorrect).length
  const uniqueAnswered = new Set(records.map((record) => record.questionId)).size

  const chapterStats = buildChapterStats(records, questions)
  const knowledgePointStats = buildBuckets(records.flatMap((record) =>
    record.knowledgePoints.map((knowledgePoint) => ({ key: knowledgePoint, record })),
  ))
  const difficultyStats = buildBuckets(records.map((record) => ({ key: record.difficulty, record })))
  const questionTypeStats = buildBuckets(records.map((record) => ({ key: typeLabel(record.questionType), record })))
  const wrongQuestions = buildWrongQuestionStats(records, questionById)
  const sufficientPoints = knowledgePointStats.filter((item) => item.answeredCount >= 2)
  const insufficientPoints = knowledgePointStats
    .filter((item) => item.answeredCount < 2)
    .sort((a, b) => a.answeredCount - b.answeredCount)
  const weakPoints = [...sufficientPoints]
    .filter((item) => item.correctRate < 75)
    .sort((a, b) => weaknessScore(b) - weaknessScore(a))
    .slice(0, 5)
  const strongPoints = [...sufficientPoints]
    .filter((item) => item.correctRate >= 75)
    .sort((a, b) => b.correctRate - a.correctRate || b.answeredCount - a.answeredCount)
    .slice(0, 5)
  const weakPointDiagnoses = weakPoints.map((item) =>
    buildWeakPointDiagnosis(item, records, questions),
  )
  const recentPracticeTrend = buildRecentTrend(records)
  const llmPrompt = '请基于以上 OBCP 刷题数据，输出：1）当前备考短板；2）优先补齐的知识点 Top 5；3）每个知识点的复习建议；4）未来 7 天刷题计划；5）是否适合进入模拟考试阶段及判断依据；6）下一轮应该优先刷哪些章节。请区分数据证据与推测，样本不足时明确提示继续刷题验证。'

  return {
    userSummary: {
      userId: userState.userId,
      totalAnswered: records.length,
      uniqueAnswered,
      correctRate: percentage(totalCorrect, records.length),
      wrongCount: userState.wrongBookQuestionIds.filter((id) => availableQuestionIds.has(id)).length,
      favoriteCount: userState.favoriteQuestionIds.filter((id) => availableQuestionIds.has(id)).length,
      averageDurationSeconds: average(records.map((record) => record.durationSeconds)),
      recentPractice: latestRecord ? questionById.get(latestRecord.questionId)?.chapter : undefined,
      recentPracticeAt: latestRecord?.answeredAt,
    },
    chapterStats,
    knowledgePointStats,
    difficultyStats,
    questionTypeStats,
    weakPoints,
    strongPoints,
    insufficientPoints,
    weakPointDiagnoses,
    repeatedWrongQuestions: wrongQuestions.filter((item) => item.wrongCount > 1),
    frequentWrongQuestions: wrongQuestions.slice(0, 5),
    recentPracticeTrend,
    llmPrompt,
  }
}

function buildChapterStats(records: ObcpAnswerRecord[], questions: ObcpQuestion[]): ChapterStat[] {
  const chapters = Array.from(new Set(questions.map((question) => question.chapter)))
  return chapters.map((chapter) => {
    const chapterRecords = records.filter((record) => record.chapter === chapter)
    const totalQuestions = questions.filter((question) => question.chapter === chapter).length
    const completedQuestions = new Set(chapterRecords.map((record) => record.questionId)).size
    const correctCount = chapterRecords.filter((record) => record.isCorrect).length
    const correctRate = percentage(correctCount, chapterRecords.length)
    return {
      name: chapter,
      answeredCount: chapterRecords.length,
      correctCount,
      correctRate,
      averageDurationSeconds: average(chapterRecords.map((record) => record.durationSeconds)),
      totalQuestions,
      completedQuestions,
      mastery: masteryLabel(correctRate, completedQuestions, totalQuestions),
      suggestedAction: chapterAction(correctRate, completedQuestions, totalQuestions),
    }
  })
}

function buildBuckets(items: Array<{ key: string; record: ObcpAnswerRecord }>): StatBucket[] {
  const grouped = new Map<string, ObcpAnswerRecord[]>()
  items.forEach(({ key, record }) => grouped.set(key, [...(grouped.get(key) ?? []), record]))
  return [...grouped.entries()].map(([name, records]) => {
    const correctCount = records.filter((record) => record.isCorrect).length
    return {
      name,
      answeredCount: records.length,
      correctCount,
      correctRate: percentage(correctCount, records.length),
      averageDurationSeconds: average(records.map((record) => record.durationSeconds)),
    }
  })
}

function buildWrongQuestionStats(
  records: ObcpAnswerRecord[],
  questionById: Map<string, ObcpQuestion>,
): WrongQuestionStat[] {
  const grouped = new Map<string, ObcpAnswerRecord[]>()
  records.filter((record) => !record.isCorrect).forEach((record) => {
    grouped.set(record.questionId, [...(grouped.get(record.questionId) ?? []), record])
  })

  return [...grouped.entries()].map(([questionId, wrongRecords]) => {
    const question = questionById.get(questionId)
    return {
      questionId,
      stem: question?.stem ?? questionId,
      chapter: question?.chapter ?? wrongRecords[0]?.chapter ?? '未知章节',
      knowledgePoints: question?.knowledgePoints ?? wrongRecords[0]?.knowledgePoints ?? [],
      wrongCount: wrongRecords.length,
      retryCount: Math.max(...wrongRecords.map((record) => record.retryCount)),
      averageDurationSeconds: average(wrongRecords.map((record) => record.durationSeconds)),
      latestWrongAt: [...wrongRecords].sort((a, b) => b.answeredAt.localeCompare(a.answeredAt))[0]?.answeredAt ?? '',
      relatedComponents: question?.relatedComponents ?? [],
    }
  }).sort((a, b) => b.wrongCount - a.wrongCount || b.retryCount - a.retryCount)
}

function buildRecentTrend(records: ObcpAnswerRecord[]): DailyPracticeStat[] {
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (6 - index))
    return date
  })

  return dates.map((date) => {
    const key = localDateKey(date)
    const dailyRecords = records.filter((record) => localDateKey(new Date(record.answeredAt)) === key)
    const correctCount = dailyRecords.filter((record) => record.isCorrect).length
    return {
      date: key,
      answeredCount: dailyRecords.length,
      correctCount,
      correctRate: percentage(correctCount, dailyRecords.length),
    }
  })
}

function weaknessScore(item: StatBucket) {
  return (100 - item.correctRate) + Math.min(item.averageDurationSeconds, 120) * 0.25 + Math.min(item.answeredCount, 10)
}

function buildWeakPointDiagnosis(
  item: StatBucket,
  records: ObcpAnswerRecord[],
  questions: ObcpQuestion[],
): WeakPointDiagnosis {
  const pointRecords = records.filter((record) => record.knowledgePoints.includes(item.name))
  const relatedQuestions = questions.filter((question) => question.knowledgePoints.includes(item.name))
  const reasons = new Set<string>()
  if (item.answeredCount < 3) reasons.add('样本量不足，需要继续刷题验证')
  if (pointRecords.some((record) => record.questionType === 'multiple' && !record.isCorrect)) reasons.add('多选题可能存在漏选或错选')
  if (relatedQuestions.some((question) => question.relatedComponents.length >= 2)) reasons.add('架构组件关系可能不够清晰')
  if (relatedQuestions.some((question) => question.chapter.includes('运维')) && item.correctRate < 70) reasons.add('运维场景判断不足')
  if (pointRecords.some((record) => record.isNotUnderstood)) reasons.add('用户已标记不理解，可能存在概念混淆')
  if (!reasons.size) reasons.add('基础概念掌握不稳定')

  return {
    name: item.name,
    correctRate: item.correctRate,
    answeredCount: item.answeredCount,
    averageDurationSeconds: item.averageDurationSeconds,
    reasons: [...reasons],
    relatedComponents: Array.from(new Set(relatedQuestions.flatMap((question) => question.relatedComponents))),
    suggestion: relatedQuestions[0]?.reviewSuggestion ?? '回看相关知识点并完成专项练习。',
  }
}

function masteryLabel(correctRate: number, completed: number, total: number): ChapterStat['mastery'] {
  if (completed === 0) return '待学习'
  if (correctRate < 60) return '需加强'
  if (correctRate >= 85 && completed >= Math.ceil(total * 0.6)) return '已掌握'
  return '基本掌握'
}

function chapterAction(correctRate: number, completed: number, total: number) {
  if (completed === 0) return '先完成本章基础题'
  if (completed < total) return '补齐未练题目并复习错题'
  if (correctRate < 60) return '回看原理并进行专项重练'
  if (correctRate < 85) return '重做错题并强化进阶题'
  return '进入随机练习或模拟考试'
}

function typeLabel(type: ObcpAnswerRecord['questionType']) {
  return { single: '单选题', multiple: '多选题', trueFalse: '判断题' }[type]
}

function percentage(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
