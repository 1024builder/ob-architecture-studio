import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck2,
  Check,
  Circle,
  Clock3,
  Network,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Siren,
  Target,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { obcpQuestions } from '../data/obcpQuestions'
import { troubleshootingCases } from '../data/troubleshootingCases'
import {
  ensureDailyTasks,
  getLearningGoalLabel,
  getLearningIntensityLabel,
  getTaskProgress,
  getWeeklyCompletedDays,
  isScheduledStudyDay,
  LEARNING_PLAN_CHANGED_EVENT,
  loadDailyTaskRecord,
  loadLearningPlan,
  refreshDailyTasks,
  resetDailyTaskCompletion,
  saveLearningPlan,
  setDailyTaskCompleted,
  type DailyLearningTask,
  type DailyTaskRecord,
  type LearningFocus,
  type LearningGoal,
  type LearningIntensity,
  type LearningPlan,
  type LearningTaskTarget,
} from '../services/learningPlanService'
import { loadRecentGlobalSearches } from '../services/globalSearchService'
import { buildReviewCenterData } from '../services/reviewCenterService'
import {
  loadCustomObcpQuestions,
  mergeObcpQuestions,
  OBCP_CUSTOM_QUESTIONS_CHANGED_EVENT,
} from '../utils/obcpQuestionImportExport'
import { loadObcpUserState, OBCP_DATA_UPDATED_EVENT } from '../utils/obcpStorage'
import {
  loadCustomTroubleshootingCases,
  mergeTroubleshootingCases,
  TROUBLESHOOTING_CUSTOM_CASES_CHANGED_EVENT,
} from '../utils/troubleshootingImportExport'

const CURRENT_USER_ID = 'local-user'

type Props = {
  onStartTask: (target: LearningTaskTarget) => void
}

const focusOptions: Array<{ value: LearningFocus; label: string }> = [
  { value: 'wrong', label: '错题复盘' },
  { value: 'favorite', label: '收藏题复盘' },
  { value: 'notUnderstood', label: '不理解题' },
  { value: 'architecture', label: '架构模型' },
  { value: 'troubleshooting', label: '故障案例' },
  { value: 'exam', label: '模拟考试' },
]

export function LearningPlanPage({ onStartTask }: Props) {
  const [revision, setRevision] = useState(0)
  const [plan, setPlan] = useState<LearningPlan | null>(loadLearningPlan)
  const [form, setForm] = useState(() => planToForm(plan))
  const [record, setRecord] = useState<DailyTaskRecord | null>(loadDailyTaskRecord)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1)
    window.addEventListener(OBCP_DATA_UPDATED_EVENT, refresh)
    window.addEventListener(OBCP_CUSTOM_QUESTIONS_CHANGED_EVENT, refresh)
    window.addEventListener(TROUBLESHOOTING_CUSTOM_CASES_CHANGED_EVENT, refresh)
    window.addEventListener(LEARNING_PLAN_CHANGED_EVENT, refresh)
    return () => {
      window.removeEventListener(OBCP_DATA_UPDATED_EVENT, refresh)
      window.removeEventListener(OBCP_CUSTOM_QUESTIONS_CHANGED_EVENT, refresh)
      window.removeEventListener(TROUBLESHOOTING_CUSTOM_CASES_CHANGED_EVENT, refresh)
      window.removeEventListener(LEARNING_PLAN_CHANGED_EVENT, refresh)
    }
  }, [])

  const context = useMemo(() => {
    void revision
    const customQuestions = loadCustomObcpQuestions()
    const questions = mergeObcpQuestions(obcpQuestions, customQuestions)
    const cases = mergeTroubleshootingCases(
      troubleshootingCases,
      loadCustomTroubleshootingCases(),
    )
    const userState = loadObcpUserState(CURRENT_USER_ID)
    const recentSearches = loadRecentGlobalSearches()
    const review = buildReviewCenterData({
      userState,
      questions,
      customQuestionIds: new Set(customQuestions.map((item) => item.questionId)),
      cases,
      recentSearches,
    })
    return { questions, cases, userState, recentSearches, review }
  }, [revision])

  useEffect(() => {
    const currentPlan = loadLearningPlan()
    setPlan(currentPlan)
    if (currentPlan) setRecord(ensureDailyTasks(currentPlan, context))
    else setRecord(null)
  }, [context])

  const progress = getTaskProgress(record)
  const weeklyCompletedDays = getWeeklyCompletedDays()
  const remainingDays = form.targetDate
    ? Math.max(0, Math.ceil((new Date(`${form.targetDate}T23:59:59`).getTime() - Date.now()) / 86400000))
    : 30
  const isStudyDay = plan ? isScheduledStudyDay(plan.weeklyDays) : true

  function submitPlan(event: React.FormEvent) {
    event.preventDefault()
    const next = saveLearningPlan({
      goal: form.goal,
      targetDate: form.targetDate || undefined,
      intensity: form.intensity,
      weeklyDays: form.weeklyDays,
      focuses: form.focuses,
    })
    setPlan(next)
    setRecord(refreshDailyTasks(next, context))
    setNotice('学习计划已保存，今日任务已重新生成。')
  }

  function toggleFocus(focus: LearningFocus) {
    setForm((current) => ({
      ...current,
      focuses: current.focuses.includes(focus)
        ? current.focuses.filter((item) => item !== focus)
        : [...current.focuses, focus],
    }))
  }

  function toggleTask(task: DailyLearningTask) {
    const next = setDailyTaskCompleted(task.id, task.status !== 'completed')
    if (next) setRecord(next)
  }

  return (
    <div className="space-y-5 p-3 sm:p-4 lg:p-5">
      <section className="border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold uppercase text-ocean-600">Learning Plan</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">学习计划与每日任务</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          设置阶段目标和每日强度，系统会结合错题、收藏、架构模型、案例与最近搜索生成当天任务。
        </p>
        <p className="mt-2 text-xs text-slate-400">计划与完成状态保存在当前浏览器，本版本暂不参与云同步。</p>
      </section>

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="text-xs font-semibold">关闭</button>
        </div>
      )}

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.28fr)]">
        <form onSubmit={submitPlan} className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <SectionHeading eyebrow="Configuration" title={plan ? '调整学习计划' : '创建学习计划'} />
          <div className="mt-4 space-y-4">
            <Field label="学习目标">
              <select value={form.goal} onChange={(event) => setForm({ ...form, goal: event.target.value as LearningGoal })} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="obcp">OBCP 备考</option>
                <option value="architecture">OceanBase 架构学习</option>
                <option value="troubleshooting">DBA 故障案例沉淀</option>
                <option value="comprehensive">综合提升</option>
              </select>
            </Field>
            <Field label="目标日期" hint="不设置时按 30 天阶段计划计算">
              <input type="date" value={form.targetDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
            </Field>
            <Field label="每日学习强度">
              <div className="grid gap-2">
                {(['light', 'standard', 'sprint'] as LearningIntensity[]).map((intensity) => (
                  <button key={intensity} type="button" onClick={() => setForm({ ...form, intensity })} className={`rounded-md border px-3 py-2 text-left text-sm ${form.intensity === intensity ? 'border-ocean-400 bg-ocean-50 text-ocean-700' : 'border-slate-200 text-slate-600'}`}>
                    {getLearningIntensityLabel(intensity)}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="每周学习天数">
              <div className="grid grid-cols-3 gap-2">
                {([3, 5, 7] as const).map((days) => (
                  <button key={days} type="button" onClick={() => setForm({ ...form, weeklyDays: days })} className={`h-10 rounded-md border text-sm font-semibold ${form.weeklyDays === days ? 'border-ocean-400 bg-ocean-50 text-ocean-700' : 'border-slate-200 text-slate-600'}`}>{days} 天</button>
                ))}
              </div>
            </Field>
            <Field label="当前重点">
              <div className="flex flex-wrap gap-2">
                {focusOptions.map((item) => (
                  <button key={item.value} type="button" onClick={() => toggleFocus(item.value)} className={`rounded-md border px-3 py-2 text-xs font-semibold ${form.focuses.includes(item.value) ? 'border-ocean-400 bg-ocean-50 text-ocean-700' : 'border-slate-200 text-slate-500'}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <button type="submit" className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-ocean-600 text-sm font-semibold text-white hover:bg-ocean-700"><Save size={16} />保存并生成今日任务</button>
        </form>

        <div className="space-y-5">
          {plan ? (
            <>
              <section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <SectionHeading eyebrow="Today" title="今日任务" />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setRecord(refreshDailyTasks(plan, context))} className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:border-ocean-300"><RefreshCw size={14} />刷新任务</button>
                    <button type="button" onClick={() => setRecord(resetDailyTaskCompletion())} className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:border-ocean-300"><RotateCcw size={14} />重置完成状态</button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric icon={Target} label="任务总数" value={`${progress.total} 项`} />
                  <Metric icon={Check} label="已完成" value={`${progress.completed} 项`} />
                  <Metric icon={CalendarCheck2} label="本周完成" value={`${weeklyCompletedDays} 天`} />
                  <Metric icon={Clock3} label="目标剩余" value={`${remainingDays} 天`} />
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-500"><span>{getLearningGoalLabel(plan.goal)} · 每周 {plan.weeklyDays} 天</span><span className="font-semibold text-slate-700">{progress.percent}%</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-ocean-500 transition-all" style={{ width: `${progress.percent}%` }} /></div>
                </div>
              </section>

              <section className="space-y-3">
                {record?.tasks.length ? record.tasks.map((task) => (
                  <TaskCard key={task.id} task={task} onStart={() => onStartTask(task.target)} onToggle={() => toggleTask(task)} />
                )) : (
                  <EmptyState
                    title={isStudyDay ? '今天暂无可生成的任务' : '今天是计划休息日'}
                    description={isStudyDay
                      ? '当前知识资产不足，请先导入题目、案例或完成一次练习。'
                      : `当前设置为每周学习 ${plan.weeklyDays} 天，休息日不会生成强制任务。`}
                  />
                )}
              </section>
            </>
          ) : (
            <EmptyState title="尚未创建学习计划" description="在左侧设置学习目标、强度和重点，保存后即可生成今日任务。" />
          )}
        </div>
      </section>
    </div>
  )
}

function TaskCard({ task, onStart, onToggle }: { task: DailyLearningTask; onStart: () => void; onToggle: () => void }) {
  const Icon = task.type === 'practice' ? BookOpenCheck : task.type === 'architecture' ? Network : task.type === 'case' ? Siren : Search
  const completed = task.status === 'completed'
  return (
    <article className={`border bg-white p-4 shadow-sm sm:p-5 ${completed ? 'border-emerald-200' : 'border-slate-200'}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${completed ? 'bg-emerald-50 text-emerald-600' : 'bg-ocean-50 text-ocean-700'}`}><Icon size={19} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-ink">{task.title}</h3><span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-500">{task.estimatedMinutes} 分钟</span></div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{task.reason}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={onStart} className="flex h-9 items-center gap-2 rounded-md bg-ocean-600 px-3 text-xs font-semibold text-white hover:bg-ocean-700">开始学习<ArrowRight size={14} /></button>
          <button type="button" onClick={onToggle} className={`flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold ${completed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}>
            {completed ? <Check size={14} /> : <Circle size={14} />}{completed ? '已完成' : '标记完成'}
          </button>
        </div>
      </div>
    </article>
  )
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div><p className="text-xs font-semibold uppercase text-slate-400">{eyebrow}</p><h2 className="mt-1 text-lg font-semibold text-ink">{title}</h2></div>
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-semibold text-slate-600">{label}</span>{hint && <span className="ml-2 text-[11px] text-slate-400">{hint}</span>}<div className="mt-2">{children}</div></label>
}

function Metric({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return <div className="flex items-center gap-3 bg-slate-50 px-3 py-3"><Icon size={17} className="text-ocean-600" /><div><p className="text-[11px] text-slate-500">{label}</p><p className="mt-0.5 text-sm font-semibold text-ink">{value}</p></div></div>
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="border border-dashed border-slate-300 bg-white px-4 py-12 text-center"><CalendarCheck2 size={28} className="mx-auto text-slate-400" /><p className="mt-3 text-sm font-semibold text-slate-700">{title}</p><p className="mt-1 text-xs text-slate-500">{description}</p></div>
}

function planToForm(plan: LearningPlan | null) {
  return {
    goal: plan?.goal ?? 'obcp' as LearningGoal,
    targetDate: plan?.targetDate ?? '',
    intensity: plan?.intensity ?? 'standard' as LearningIntensity,
    weeklyDays: plan?.weeklyDays ?? 5 as 3 | 5 | 7,
    focuses: plan?.focuses ?? ['wrong', 'notUnderstood'] as LearningFocus[],
  }
}
