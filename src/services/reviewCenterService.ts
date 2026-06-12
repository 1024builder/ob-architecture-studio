import { architectureModels } from '../data/models'
import type {
  ChapterStat,
  ObcpAnalytics,
  ObcpQuestion,
  ObcpUserState,
} from '../data/obcpTypes'
import type { TroubleshootingCase } from '../data/troubleshootingTypes'
import { calculateObcpAnalytics } from '../utils/obcpAnalytics'

export type ReviewQuestionItem = {
  questionId: string
  stem: string
  chapter: string
  source: '内置题' | '自定义题'
  latestWrongAt?: string
  wrongCount: number
}

export type ReviewChapter = ChapterStat & {
  reviewStatus: '需加强' | '基本掌握' | '较熟悉'
}

export type ReviewArchitectureRecommendation = {
  modelId: string
  title: string
  reason: string
  componentName?: string
}

export type ReviewCaseRecommendation = {
  caseId: string
  title: string
  reason: string
}

export type ReviewCenterData = {
  analytics: ObcpAnalytics
  todaySuggestedCount: number
  recommendedChapter?: string
  chapters: ReviewChapter[]
  wrongQuestions: ReviewQuestionItem[]
  favoriteQuestions: ReviewQuestionItem[]
  notUnderstoodQuestions: ReviewQuestionItem[]
  todayQuestionIds: string[]
  recentSearches: string[]
  architectureRecommendations: ReviewArchitectureRecommendation[]
  caseRecommendations: ReviewCaseRecommendation[]
}

export function buildReviewCenterData({
  userState,
  questions,
  customQuestionIds,
  cases,
  recentSearches,
}: {
  userState: ObcpUserState
  questions: ObcpQuestion[]
  customQuestionIds: ReadonlySet<string>
  cases: TroubleshootingCase[]
  recentSearches: string[]
}): ReviewCenterData {
  const analytics = calculateObcpAnalytics(userState, questions)
  const questionById = new Map(questions.map((item) => [item.questionId, item]))
  const recordsByQuestion = new Map<string, typeof userState.records>()
  userState.records.forEach((record) => {
    recordsByQuestion.set(record.questionId, [
      ...(recordsByQuestion.get(record.questionId) ?? []),
      record,
    ])
  })
  const toReviewItem = (questionId: string): ReviewQuestionItem | null => {
    const question = questionById.get(questionId)
    if (!question) return null
    const records = recordsByQuestion.get(questionId) ?? []
    const wrongRecords = records.filter((record) => !record.isCorrect)
    return {
      questionId,
      stem: question.stem,
      chapter: question.chapter,
      source: customQuestionIds.has(questionId) ? '自定义题' : '内置题',
      latestWrongAt: [...wrongRecords]
        .sort((left, right) => right.answeredAt.localeCompare(left.answeredAt))[0]
        ?.answeredAt,
      wrongCount: wrongRecords.length,
    }
  }

  const wrongQuestions = userState.wrongBookQuestionIds
    .map(toReviewItem)
    .filter((item): item is ReviewQuestionItem => item !== null)
    .sort((left, right) =>
      (right.latestWrongAt ?? '').localeCompare(left.latestWrongAt ?? '')
      || right.wrongCount - left.wrongCount,
    )
  const favoriteQuestions = userState.favoriteQuestionIds
    .map(toReviewItem)
    .filter((item): item is ReviewQuestionItem => item !== null)
  const notUnderstoodQuestions = userState.notUnderstoodQuestionIds
    .map(toReviewItem)
    .filter((item): item is ReviewQuestionItem => item !== null)
  const chapters = analytics.chapterStats
    .map((chapter) => ({
      ...chapter,
      reviewStatus: chapter.correctRate < 60
        ? '需加强' as const
        : chapter.correctRate <= 80
          ? '基本掌握' as const
          : '较熟悉' as const,
    }))
    .sort((left, right) =>
      left.correctRate - right.correctRate
      || left.completedQuestions - right.completedQuestions,
    )
  const recommendedChapter = chapters.find((chapter) =>
    chapter.completedQuestions > 0 && chapter.correctRate < 80,
  )?.name ?? chapters.find((chapter) => chapter.completedQuestions === 0)?.name

  const weakChapterQuestionIds = questions
    .filter((question) => question.chapter === recommendedChapter)
    .map((question) => question.questionId)
  const todayQuestionIds = unique([
    ...wrongQuestions.map((item) => item.questionId),
    ...notUnderstoodQuestions.map((item) => item.questionId),
    ...favoriteQuestions.map((item) => item.questionId),
    ...weakChapterQuestionIds,
  ]).slice(0, 12)
  const todaySuggestedCount = userState.records.length
    ? Math.min(12, Math.max(5, todayQuestionIds.length))
    : Math.min(8, questions.length)

  const weakTerms = unique([
    ...chapters.filter((chapter) => chapter.correctRate < 60).map((item) => item.name),
    ...analytics.weakPoints.map((item) => item.name),
    ...wrongQuestions.flatMap((item) =>
      questionById.get(item.questionId)?.tags ?? [],
    ),
    ...recentSearches,
  ])

  return {
    analytics,
    todaySuggestedCount,
    recommendedChapter,
    chapters,
    wrongQuestions,
    favoriteQuestions,
    notUnderstoodQuestions,
    todayQuestionIds: todayQuestionIds.length
      ? todayQuestionIds
      : questions.slice(0, todaySuggestedCount).map((item) => item.questionId),
    recentSearches,
    architectureRecommendations: recommendArchitecture(chapters, weakTerms),
    caseRecommendations: recommendCases(cases, weakTerms),
  }
}

function recommendArchitecture(
  chapters: ReviewChapter[],
  weakTerms: string[],
): ReviewArchitectureRecommendation[] {
  const weakChapterNames = chapters
    .filter((chapter) => chapter.correctRate < 80)
    .map((chapter) => chapter.name)
  const preferredModelIds = new Set<string>()
  weakChapterNames.forEach((chapter) => {
    if (chapter.includes('架构')) {
      preferredModelIds.add('replicas')
      preferredModelIds.add('proxy')
    }
    if (chapter.includes('租户')) preferredModelIds.add('tenant')
    if (chapter.includes('存储') || chapter.includes('日志')) preferredModelIds.add('ls-tablet')
    if (chapter.includes('运维')) {
      preferredModelIds.add('ocp')
      preferredModelIds.add('standby')
    }
  })
  architectureModels.forEach((model) => {
    const text = normalize([
      model.name,
      model.subtitle,
      model.summary,
      ...model.nodes.map((node) => node.label),
      ...model.cards.flatMap((card) => [card.title, card.body, ...card.tags]),
    ].join(' '))
    if (weakTerms.some((term) => text.includes(normalize(term)))) {
      preferredModelIds.add(model.id)
    }
  })
  return [...preferredModelIds].slice(0, 4).flatMap((modelId) => {
    const model = architectureModels.find((item) => item.id === modelId)
    if (!model) return []
    return [{
      modelId,
      title: model.name,
      reason: model.summary,
      componentName: model.nodes[0]?.label,
    }]
  })
}

function recommendCases(
  cases: TroubleshootingCase[],
  weakTerms: string[],
): ReviewCaseRecommendation[] {
  return cases.map((item) => {
    const text = normalize([
      item.title,
      item.databaseType,
      item.faultType,
      ...item.tags,
      ...item.relatedKnowledgePoints,
    ].join(' '))
    const matchedTerms = weakTerms.filter((term) => text.includes(normalize(term)))
    return {
      item,
      score: matchedTerms.length * 10 + (item.severity === '高' ? 3 : 0),
      matchedTerms,
    }
  }).filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map(({ item, matchedTerms }) => ({
      caseId: item.caseId,
      title: item.title,
      reason: matchedTerms.length
        ? `关联：${matchedTerms.slice(0, 3).join('、')}`
        : `${item.databaseType} · ${item.faultType}`,
    }))
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)))
}

function normalize(value: string) {
  return value.toLocaleLowerCase()
}
