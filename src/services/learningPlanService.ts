import { architectureModels } from '../data/models'
import type { ObcpPracticeMode, ObcpQuestion, ObcpUserState } from '../data/obcpTypes'
import type { TroubleshootingCase } from '../data/troubleshootingTypes'
import type { ReviewCenterData } from './reviewCenterService'

export const LEARNING_PLAN_STORAGE_KEY =
  'ob-architecture-studio:learning-plan'
export const DAILY_TASKS_STORAGE_KEY =
  'ob-architecture-studio:daily-tasks'
export const LEARNING_PLAN_CHANGED_EVENT =
  'ob-architecture-studio:learning-plan-changed'

export type LearningGoal =
  | 'obcp'
  | 'architecture'
  | 'troubleshooting'
  | 'comprehensive'
export type LearningIntensity = 'light' | 'standard' | 'sprint'
export type LearningFocus =
  | 'wrong'
  | 'favorite'
  | 'notUnderstood'
  | 'architecture'
  | 'troubleshooting'
  | 'exam'
export type DailyTaskStatus = 'pending' | 'completed'
export type DailyTaskType =
  | 'practice'
  | 'architecture'
  | 'case'
  | 'search'

export type LearningPlan = {
  goal: LearningGoal
  targetDate?: string
  intensity: LearningIntensity
  weeklyDays: 3 | 5 | 7
  focuses: LearningFocus[]
  createdAt: string
  updatedAt: string
}

export type LearningTaskTarget =
  | { kind: 'questions'; questionIds: string[]; sourceLabel: string; mode?: ObcpPracticeMode }
  | { kind: 'architecture'; modelId: string; componentName?: string }
  | { kind: 'case'; caseId: string }
  | { kind: 'search'; query: string }

export type DailyLearningTask = {
  id: string
  date: string
  type: DailyTaskType
  title: string
  reason: string
  estimatedMinutes: number
  status: DailyTaskStatus
  target: LearningTaskTarget
}

export type DailyTaskRecord = {
  date: string
  generatedAt: string
  refreshIndex: number
  tasks: DailyLearningTask[]
}

export type LearningPlanContext = {
  questions: ObcpQuestion[]
  userState: ObcpUserState
  review: ReviewCenterData
  cases: TroubleshootingCase[]
  recentSearches: string[]
}

type DailyTaskStore = Record<string, DailyTaskRecord>

export function loadLearningPlan(): LearningPlan | null {
  try {
    const raw = window.localStorage.getItem(LEARNING_PLAN_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LearningPlan>
    if (!isLearningGoal(parsed.goal) || !isIntensity(parsed.intensity)) return null
    return {
      goal: parsed.goal,
      targetDate: typeof parsed.targetDate === 'string' ? parsed.targetDate : undefined,
      intensity: parsed.intensity,
      weeklyDays: parsed.weeklyDays === 3 || parsed.weeklyDays === 7 ? parsed.weeklyDays : 5,
      focuses: Array.isArray(parsed.focuses)
        ? parsed.focuses.filter(isLearningFocus)
        : [],
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function saveLearningPlan(input: Omit<LearningPlan, 'createdAt' | 'updatedAt'>) {
  const current = loadLearningPlan()
  const now = new Date().toISOString()
  const plan: LearningPlan = {
    ...input,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  }
  window.localStorage.setItem(LEARNING_PLAN_STORAGE_KEY, JSON.stringify(plan))
  notifyLearningPlanChanged()
  return plan
}

export function loadDailyTaskRecord(date = getLocalDateKey()) {
  return loadDailyTaskStore()[date] ?? null
}

export function ensureDailyTasks(
  plan: LearningPlan,
  context: LearningPlanContext,
  date = getLocalDateKey(),
) {
  const store = loadDailyTaskStore()
  if (store[date]) return store[date]
  const record = createDailyTaskRecord(plan, context, date, 0)
  saveDailyTaskStore({ ...store, [date]: record }, false)
  return record
}

export function refreshDailyTasks(
  plan: LearningPlan,
  context: LearningPlanContext,
  date = getLocalDateKey(),
) {
  const store = loadDailyTaskStore()
  const refreshIndex = (store[date]?.refreshIndex ?? 0) + 1
  const record = createDailyTaskRecord(plan, context, date, refreshIndex)
  saveDailyTaskStore({ ...store, [date]: record })
  return record
}

export function setDailyTaskCompleted(
  taskId: string,
  completed: boolean,
  date = getLocalDateKey(),
) {
  const store = loadDailyTaskStore()
  const current = store[date]
  if (!current) return null
  const record = {
    ...current,
    tasks: current.tasks.map((task) =>
      task.id === taskId
        ? { ...task, status: completed ? 'completed' as const : 'pending' as const }
        : task,
    ),
  }
  saveDailyTaskStore({ ...store, [date]: record })
  return record
}

export function resetDailyTaskCompletion(date = getLocalDateKey()) {
  const store = loadDailyTaskStore()
  const current = store[date]
  if (!current) return null
  const record = {
    ...current,
    tasks: current.tasks.map((task) => ({ ...task, status: 'pending' as const })),
  }
  saveDailyTaskStore({ ...store, [date]: record })
  return record
}

export function getWeeklyCompletedDays(referenceDate = new Date()) {
  const store = loadDailyTaskStore()
  const day = referenceDate.getDay() || 7
  const monday = new Date(referenceDate)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - day + 1)
  let completedDays = 0
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + offset)
    const record = store[getLocalDateKey(date)]
    if (record?.tasks.length && record.tasks.every((task) => task.status === 'completed')) {
      completedDays += 1
    }
  }
  return completedDays
}

export function getTaskProgress(record: DailyTaskRecord | null) {
  const total = record?.tasks.length ?? 0
  const completed = record?.tasks.filter((task) => task.status === 'completed').length ?? 0
  return {
    total,
    completed,
    percent: total ? Math.round((completed / total) * 100) : 0,
  }
}

export function getLearningGoalLabel(goal: LearningGoal) {
  return {
    obcp: 'OBCP 备考',
    architecture: 'OceanBase 架构学习',
    troubleshooting: 'DBA 故障案例沉淀',
    comprehensive: '综合提升',
  }[goal]
}

export function getLearningIntensityLabel(intensity: LearningIntensity) {
  return {
    light: '轻量 · 每天 15-20 分钟',
    standard: '标准 · 每天 30-45 分钟',
    sprint: '冲刺 · 每天 60 分钟以上',
  }[intensity]
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isScheduledStudyDay(
  weeklyDays: 3 | 5 | 7,
  date = new Date(),
) {
  if (weeklyDays === 7) return true
  const day = date.getDay()
  if (weeklyDays === 5) return day >= 1 && day <= 5
  return day === 1 || day === 3 || day === 5
}

function createDailyTaskRecord(
  plan: LearningPlan,
  context: LearningPlanContext,
  date: string,
  refreshIndex: number,
): DailyTaskRecord {
  const tasks = generateDailyTasks(plan, context, date, refreshIndex)
  return {
    date,
    generatedAt: new Date().toISOString(),
    refreshIndex,
    tasks,
  }
}

function generateDailyTasks(
  plan: LearningPlan,
  context: LearningPlanContext,
  date: string,
  refreshIndex: number,
) {
  if (!isScheduledStudyDay(plan.weeklyDays, new Date(`${date}T12:00:00`))) {
    return []
  }
  const tasks: DailyLearningTask[] = []
  const maxTasks = plan.intensity === 'light' ? 4 : plan.intensity === 'standard' ? 6 : 8
  const questionCount = plan.intensity === 'light' ? 5 : plan.intensity === 'standard' ? 8 : 12
  const addTask = (
    type: DailyTaskType,
    title: string,
    reason: string,
    estimatedMinutes: number,
    target: LearningTaskTarget,
  ) => {
    if (tasks.length >= maxTasks) return
    const targetKey = target.kind === 'questions'
      ? target.questionIds.join('-')
      : target.kind === 'search'
        ? target.query
        : target.kind === 'case'
          ? target.caseId
          : target.modelId
    tasks.push({
      id: `${date}:${type}:${targetKey}:${tasks.length}`,
      date,
      type,
      title,
      reason,
      estimatedMinutes,
      status: 'pending',
      target,
    })
  }

  const takeQuestionIds = (ids: string[], count = questionCount) =>
    rotate(unique(ids), refreshIndex).slice(0, count)
  const wrongIds = takeQuestionIds(context.review.wrongQuestions.map((item) => item.questionId))
  const favoriteIds = takeQuestionIds(context.review.favoriteQuestions.map((item) => item.questionId))
  const notUnderstoodIds = takeQuestionIds(context.review.notUnderstoodQuestions.map((item) => item.questionId))
  const chapterIds = takeQuestionIds(context.questions
    .filter((question) => question.chapter === context.review.recommendedChapter)
    .map((question) => question.questionId))
  const randomIds = takeQuestionIds(context.questions.map((question) => question.questionId))

  if (plan.focuses.includes('wrong') && wrongIds.length) {
    addTask('practice', `重做 ${wrongIds.length} 道错题`, '优先修正近期重复错误，降低知识盲区。', estimatePractice(wrongIds.length), {
      kind: 'questions',
      questionIds: wrongIds,
      sourceLabel: '学习计划 · 错题重做',
      mode: 'wrongBook',
    })
  }
  if (plan.focuses.includes('notUnderstood') && notUnderstoodIds.length) {
    addTask('practice', `回看 ${notUnderstoodIds.length} 道不理解题`, '这些题已被主动标记，需要结合解析重新理解。', estimatePractice(notUnderstoodIds.length), {
      kind: 'questions',
      questionIds: notUnderstoodIds,
      sourceLabel: '学习计划 · 不理解题',
    })
  }
  if (plan.focuses.includes('favorite') && favoriteIds.length) {
    addTask('practice', `复习 ${favoriteIds.length} 道收藏题`, '巩固主动收藏的重点题目。', estimatePractice(favoriteIds.length), {
      kind: 'questions',
      questionIds: favoriteIds,
      sourceLabel: '学习计划 · 收藏题复习',
      mode: 'favorite',
    })
  }

  if ((plan.goal === 'obcp' || plan.goal === 'comprehensive') && chapterIds.length) {
    addTask('practice', `专项练习：${context.review.recommendedChapter ?? 'OceanBase 架构基础'}`, '当前章节正确率或完成度仍有提升空间。', estimatePractice(chapterIds.length), {
      kind: 'questions',
      questionIds: chapterIds,
      sourceLabel: `学习计划 · ${context.review.recommendedChapter ?? '章节练习'}`,
    })
  } else if ((plan.goal === 'obcp' || plan.goal === 'comprehensive') && randomIds.length) {
    addTask('practice', `完成 ${randomIds.length} 道随机练习`, '保持每日题感并持续积累诊断样本。', estimatePractice(randomIds.length), {
      kind: 'questions',
      questionIds: randomIds,
      sourceLabel: '学习计划 · 随机练习',
      mode: 'random',
    })
  }

  if (plan.focuses.includes('exam') && context.questions.length) {
    const examIds = takeQuestionIds(context.questions.map((question) => question.questionId), Math.min(12, questionCount))
    addTask('practice', `完成 ${examIds.length} 道模拟训练`, '用综合题组检查当前备考状态。', Math.max(20, estimatePractice(examIds.length)), {
      kind: 'questions',
      questionIds: examIds,
      sourceLabel: '学习计划 · 模拟训练',
      mode: 'exam',
    })
  }

  if (
    plan.goal === 'architecture'
    || plan.goal === 'comprehensive'
    || plan.focuses.includes('architecture')
  ) {
    const recommendedModelId = context.review.architectureRecommendations[0]?.modelId
    const modelIndex = Math.max(0, architectureModels.findIndex((item) => item.id === recommendedModelId))
    const model = architectureModels[(modelIndex + refreshIndex) % architectureModels.length]
    if (model) {
      addTask('architecture', `学习架构模型：${model.name}`, model.summary, 12, {
        kind: 'architecture',
        modelId: model.id,
        componentName: model.nodes[0]?.label,
      })
      const node = model.nodes[(refreshIndex + 1) % model.nodes.length]
      if (node && plan.intensity !== 'light') {
        addTask('architecture', `回顾组件：${node.label}`, '查看组件说明、相关 SQL 和故障排查信息。', 8, {
          kind: 'architecture',
          modelId: model.id,
          componentName: node.label,
        })
      }
    }
  }

  if (
    plan.goal === 'troubleshooting'
    || plan.goal === 'comprehensive'
    || plan.focuses.includes('troubleshooting')
  ) {
    const recommendedCaseId = context.review.caseRecommendations[0]?.caseId
    const preferredCases = [
      ...context.cases.filter((item) => item.caseId === recommendedCaseId),
      ...context.cases.filter((item) => item.severity === '高' && item.caseId !== recommendedCaseId),
      ...context.cases.filter((item) => item.severity !== '高' && item.caseId !== recommendedCaseId),
    ]
    const item = preferredCases[refreshIndex % preferredCases.length]
    if (item) {
      addTask('case', `复盘案例：${item.title}`, item.severity === '高' ? '优先掌握高严重等级故障的排查闭环。' : '积累故障现象、根因和验证方法。', 12, {
        kind: 'case',
        caseId: item.caseId,
      })
    }
  }

  const searchTerm = context.recentSearches[refreshIndex % context.recentSearches.length]
  if (searchTerm) {
    addTask('search', `回顾最近搜索：${searchTerm}`, '把近期检索过的知识点重新串联到题库、架构和案例中。', 6, {
      kind: 'search',
      query: searchTerm,
    })
  }

  if (!tasks.length && randomIds.length) {
    addTask('practice', `完成 ${randomIds.length} 道基础练习`, '先积累一组答题记录，系统会逐步生成个性化任务。', estimatePractice(randomIds.length), {
      kind: 'questions',
      questionIds: randomIds,
      sourceLabel: '学习计划 · 基础练习',
    })
  }

  return tasks.slice(0, 8)
}

function loadDailyTaskStore(): DailyTaskStore {
  try {
    const raw = window.localStorage.getItem(DAILY_TASKS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as DailyTaskStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveDailyTaskStore(store: DailyTaskStore, notify = true) {
  window.localStorage.setItem(DAILY_TASKS_STORAGE_KEY, JSON.stringify(store))
  if (notify) notifyLearningPlanChanged()
}

function notifyLearningPlanChanged() {
  window.dispatchEvent(new CustomEvent(LEARNING_PLAN_CHANGED_EVENT))
}

function estimatePractice(count: number) {
  return Math.max(8, count * 2)
}

function rotate<T>(items: T[], offset: number) {
  if (!items.length) return []
  const index = offset % items.length
  return [...items.slice(index), ...items.slice(0, index)]
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)))
}

function isLearningGoal(value: unknown): value is LearningGoal {
  return ['obcp', 'architecture', 'troubleshooting', 'comprehensive'].includes(String(value))
}

function isIntensity(value: unknown): value is LearningIntensity {
  return ['light', 'standard', 'sprint'].includes(String(value))
}

function isLearningFocus(value: unknown): value is LearningFocus {
  return ['wrong', 'favorite', 'notUnderstood', 'architecture', 'troubleshooting', 'exam'].includes(String(value))
}
