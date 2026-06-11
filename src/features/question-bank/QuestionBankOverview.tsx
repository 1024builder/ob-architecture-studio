import {
  ArrowRight,
  BookMarked,
  CheckCircle2,
  Clock3,
  Database,
  Dices,
  Download,
  FileClock,
  ListChecks,
  RotateCcw,
  Search,
  SearchX,
  Target,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react'
import { LearningDiagnosisExport } from '../../components/obcp/LearningDiagnosisExport'
import { LearningDiagnosisReport } from '../../components/obcp/LearningDiagnosisReport'
import type { ObcpAnalytics, ObcpPracticeMode, ObcpQuestion } from '../../data/obcpTypes'
import { useState } from 'react'
import { downloadQuestionBank } from '../../utils/obcpQuestionImportExport'

type Props = {
  analytics: ObcpAnalytics
  questions: ObcpQuestion[]
  wrongBookCount: number
  favoriteCount: number
  onStartPractice: (mode: ObcpPracticeMode, chapter?: string, questionIds?: string[]) => boolean
  onViewArchitectureComponent: (componentName: string) => void
  onOpenQuestionBankManager: () => void
  onImportQuestionBank: () => void
}

const modeConfig = [
  { id: 'sequential' as const, name: '顺序练习', description: '按章节和题号逐题学习', icon: ListChecks },
  { id: 'random' as const, name: '随机练习', description: '从全部题库随机组题', icon: Dices },
  { id: 'exam' as const, name: '模拟考试', description: '按考试题量完成整组练习', icon: FileClock },
]

export function QuestionBankOverview({
  analytics,
  questions,
  wrongBookCount,
  favoriteCount,
  onStartPractice,
  onViewArchitectureComponent,
  onOpenQuestionBankManager,
  onImportQuestionBank,
}: Props) {
  const [reportOpen, setReportOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [favoriteMessage, setFavoriteMessage] = useState('')
  const { userSummary } = analytics
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const filteredQuestions = normalizedQuery
    ? questions.filter((question) =>
      [
        question.stem,
        question.chapter,
        ...question.knowledgePoints,
        ...question.tags,
      ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
    )
    : questions
  const filteredQuestionIds = filteredQuestions.map((question) => question.questionId)
  const visibleChapters = analytics.chapterStats
    .map((chapter) => ({
      ...chapter,
      visibleQuestions: filteredQuestions.filter((question) => question.chapter === chapter.name),
    }))
    .filter((chapter) => !normalizedQuery || chapter.visibleQuestions.length > 0)

  function startFavoritePractice() {
    setFavoriteMessage('')
    if (!favoriteCount || !onStartPractice('favorite')) {
      setFavoriteMessage('暂无收藏题目。你可以在答题页点击书签图标收藏题目。')
    }
  }

  function startFilteredPractice(mode: ObcpPracticeMode, chapter?: string, questionIds = filteredQuestionIds) {
    if (!questionIds.length) return
    onStartPractice(mode, chapter, normalizedQuery ? questionIds : undefined)
  }

  return (
    <div className="space-y-5 p-3 sm:p-4 lg:p-5">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-ocean-600">OBCP Question Bank</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">OBCP 题库</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">围绕 OceanBase 认证知识体系进行章节练习、错题复习与模拟考试。</p>
        </div>
        <div className="flex flex-col gap-3 xl:items-end">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onOpenQuestionBankManager} className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-ocean-300 hover:text-ocean-700">
              <Database size={16} />题库管理
            </button>
            <button type="button" onClick={onImportQuestionBank} className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-ocean-300 hover:text-ocean-700">
              <Upload size={16} />导入题库
            </button>
            <button type="button" onClick={() => downloadQuestionBank(questions)} className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-ocean-300 hover:text-ocean-700">
              <Download size={16} />导出题库
            </button>
          </div>
          <LearningDiagnosisExport analytics={analytics} onView={() => setReportOpen(true)} />
          <div className="flex h-10 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 shadow-sm focus-within:border-ocean-400 focus-within:ring-2 focus-within:ring-ocean-100 xl:w-80">
            <Search size={17} className="shrink-0 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索题干、章节、知识点或标签"
              aria-label="搜索题库"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            {searchQuery && (
              <button type="button" title="清空搜索" onClick={() => setSearchQuery('')} className="grid h-7 w-7 shrink-0 place-items-center text-slate-400 hover:text-slate-700">
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryItem icon={CheckCircle2} label="累计做题" value={`${userSummary.totalAnswered} 题`} tone="ocean" />
        <SummaryItem icon={TrendingUp} label="当前正确率" value={`${userSummary.correctRate}%`} tone="green" />
        <SummaryItem icon={Target} label="待复习错题" value={`${userSummary.wrongCount} 题`} tone="orange" />
        <SummaryItem icon={BookMarked} label="收藏题目" value={`${userSummary.favoriteCount} 题`} tone="violet" onClick={startFavoritePractice} />
      </section>
      {favoriteMessage && <div className="rounded-md border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">{favoriteMessage}</div>}

      {normalizedQuery && (
        <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Search Results</p>
              <h2 className="mt-1 text-sm font-semibold text-ink">找到 {filteredQuestions.length} 道相关题目</h2>
            </div>
            {!!filteredQuestions.length && (
              <button type="button" onClick={() => startFilteredPractice('sequential')} className="flex h-9 items-center gap-2 rounded-md bg-ocean-600 px-3 text-sm font-semibold text-white hover:bg-ocean-700">
                开始练习<ArrowRight size={15} />
              </button>
            )}
          </div>
          {filteredQuestions.length ? (
            <div className="mt-3 divide-y divide-slate-100">
              {filteredQuestions.map((question) => (
                <button key={question.questionId} type="button" onClick={() => startFilteredPractice('sequential', undefined, [question.questionId])} className="flex w-full items-start justify-between gap-3 py-3 text-left hover:text-ocean-700">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-700">{question.stem}</span>
                    <span className="mt-1 block text-xs text-slate-400">{question.chapter} · {question.knowledgePoints.join('、')}</span>
                  </span>
                  <ArrowRight size={16} className="mt-0.5 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center rounded-md bg-slate-50 px-4 py-8 text-center">
              <SearchX size={24} className="text-slate-400" />
              <p className="mt-2 text-sm font-semibold text-slate-600">没有找到相关题目</p>
              <p className="mt-1 text-xs text-slate-400">换一个题干、章节、知识点或标签关键词试试。</p>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <div>
          <div className="mb-3 flex items-end justify-between">
            <div><p className="text-xs font-semibold uppercase text-slate-400">Chapters</p><h2 className="mt-1 text-lg font-semibold text-ink">章节练习</h2></div>
            <span className="text-xs text-slate-400">{filteredQuestions.length} 道{normalizedQuery ? '匹配' : '样例'}题</span>
          </div>
          <div className="divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            {visibleChapters.map((chapter) => {
              const progress = chapter.totalQuestions ? Math.round((chapter.completedQuestions / chapter.totalQuestions) * 100) : 0
              return (
                <button key={chapter.name} type="button" onClick={() => startFilteredPractice('sequential', chapter.name, chapter.visibleQuestions.map((question) => question.questionId))} className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-slate-50">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-ocean-50 text-sm font-bold text-ocean-700">{progress}%</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{chapter.name}</span>
                    <span className="mt-1 block text-xs text-slate-500">正确率 {chapter.correctRate}% · {chapter.mastery}</span>
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-ocean-500" style={{ width: `${progress}%` }} /></span>
                  </span>
                  <span className="hidden text-xs text-slate-400 sm:block">{normalizedQuery ? `${chapter.visibleQuestions.length} 道匹配` : `${chapter.completedQuestions}/${chapter.totalQuestions}`}</span>
                  <ArrowRight size={17} className="shrink-0 text-slate-400" />
                </button>
              )
            })}
            {!visibleChapters.length && <p className="px-4 py-8 text-center text-sm text-slate-400">当前搜索条件下没有可练习章节。</p>}
          </div>
        </div>

        <div className="space-y-5">
          <section>
            <div className="mb-3"><p className="text-xs font-semibold uppercase text-slate-400">Practice Modes</p><h2 className="mt-1 text-lg font-semibold text-ink">选择刷题模式</h2></div>
            <div className="grid gap-2">
              {modeConfig.map(({ id, name, description, icon: Icon }) => (
                <button key={id} type="button" disabled={!!normalizedQuery && !filteredQuestions.length} onClick={() => startFilteredPractice(id)} className="flex min-h-20 items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-ocean-300 hover:bg-ocean-50 disabled:cursor-not-allowed disabled:opacity-50">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600"><Icon size={19} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{name}</span><span className="mt-1 block text-xs text-slate-500">{description}</span></span>
                  <ArrowRight size={17} className="text-slate-400" />
                </button>
              ))}
              <button type="button" disabled={!wrongBookCount} onClick={() => onStartPractice('wrongBook')} className="flex min-h-20 items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-left shadow-sm transition hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-amber-100 text-amber-700"><RotateCcw size={19} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-amber-900">重做错题</span><span className="mt-1 block text-xs text-amber-700">{wrongBookCount} 道待复习题目</span></span>
                <ArrowRight size={17} className="text-amber-600" />
              </button>
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Clock3 size={17} /><span>最近练习</span></div>
            <p className="mt-3 text-sm text-slate-600">{userSummary.recentPractice ?? '尚未开始练习'}</p>
            <p className="mt-1 text-xs text-slate-400">{formatDate(userSummary.recentPracticeAt)} · 平均耗时 {userSummary.averageDurationSeconds} 秒</p>
          </section>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <DiagnosisList title="薄弱知识点 Top 5" items={analytics.weakPoints} tone="weak" />
        <DiagnosisList title="已掌握知识点 Top 5" items={analytics.strongPoints} tone="strong" />
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-ink">最近 7 天刷题趋势</h2><span className="text-xs text-slate-400">每日作答数量</span></div>
        <div className="grid grid-cols-7 gap-2">
          {analytics.recentPracticeTrend.map((day) => (
            <div key={day.date} className="text-center">
              <div className="flex h-20 items-end justify-center rounded-md bg-slate-50 p-2">
                <span className="w-5 rounded-t bg-ocean-500" style={{ height: `${Math.max(4, Math.min(100, day.answeredCount * 12))}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-400">{day.date.slice(5)}</p>
            </div>
          ))}
        </div>
      </section>
      {reportOpen && <LearningDiagnosisReport analytics={analytics} onClose={() => setReportOpen(false)} onViewArchitectureComponent={onViewArchitectureComponent} />}
    </div>
  )
}

function DiagnosisList({ title, items, tone }: { title: string; items: ObcpAnalytics['weakPoints']; tone: 'weak' | 'strong' }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
            <span className="text-sm font-medium text-slate-700">{item.name}</span>
            <span className={`text-sm font-semibold ${tone === 'weak' ? 'text-amber-700' : 'text-emerald-700'}`}>{item.correctRate}%</span>
          </div>
        )) : <p className="text-sm text-slate-400">完成练习后生成诊断数据。</p>}
      </div>
    </section>
  )
}

function SummaryItem({ icon: Icon, label, value, tone, onClick }: { icon: typeof CheckCircle2; label: string; value: string; tone: 'ocean' | 'green' | 'orange' | 'violet'; onClick?: () => void }) {
  const tones = { ocean: 'bg-ocean-50 text-ocean-600', green: 'bg-emerald-50 text-emerald-600', orange: 'bg-amber-50 text-amber-600', violet: 'bg-violet-50 text-violet-600' }
  const className = `flex min-h-24 w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-4 text-left shadow-sm ${onClick ? 'transition hover:border-violet-300 hover:bg-violet-50/40' : ''}`
  const content = <><span className={`grid h-11 w-11 place-items-center rounded-md ${tones[tone]}`}><Icon size={20} /></span><div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-ink">{value}</p></div>{onClick && <ArrowRight size={17} className="ml-auto text-slate-400" />}</>
  return onClick ? <button type="button" onClick={onClick} className={className}>{content}</button> : <div className={className}>{content}</div>
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN') : '暂无练习记录'
}
