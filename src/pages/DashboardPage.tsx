import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Bookmark,
  CheckCircle2,
  Cloud,
  CloudOff,
  Clock3,
  Database,
  GitBranch,
  Lightbulb,
  Network,
  RefreshCw,
  Search,
  Siren,
  Target,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { AppModuleId } from '../app/modules'
import { architectureModels } from '../data/models'
import { obcpQuestions } from '../data/obcpQuestions'
import { troubleshootingCases } from '../data/troubleshootingCases'
import { calculateObcpAnalytics } from '../utils/obcpAnalytics'
import {
  CUSTOM_QUESTION_SYNC_STATUS_CHANGED_EVENT,
  getCustomQuestionSyncStatus,
  type CustomQuestionSyncStatus,
} from '../services/customQuestionSyncService'
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
import {
  buildReviewCenterData,
} from '../services/reviewCenterService'
import {
  loadRecentGlobalSearches,
} from '../services/globalSearchService'
import {
  getObcpSyncStatus,
  OBCP_SYNC_STATUS_CHANGED_EVENT,
  type ObcpSyncStatusSnapshot,
} from '../services/syncStatusService'
import {
  getTroubleshootingCaseSyncStatus,
  TROUBLESHOOTING_CASE_SYNC_STATUS_CHANGED_EVENT,
  type TroubleshootingCaseSyncStatus,
} from '../services/troubleshootingCaseSyncService'

const CURRENT_USER_ID = 'local-user'

type Props = {
  onModuleChange: (moduleId: AppModuleId) => void
  onGlobalSearch: (query?: string) => void
}

export function DashboardPage({ onModuleChange, onGlobalSearch }: Props) {
  const [dataRevision, setDataRevision] = useState(0)
  const [syncStatus, setSyncStatus] = useState(getObcpSyncStatus)
  const [customQuestionSyncStatus, setCustomQuestionSyncStatus] =
    useState(getCustomQuestionSyncStatus)
  const [caseSyncStatus, setCaseSyncStatus] =
    useState(getTroubleshootingCaseSyncStatus)
  const [knowledgeQuery, setKnowledgeQuery] = useState('')
  useEffect(() => {
    const refreshDashboard = () => setDataRevision((value) => value + 1)
    const refreshSyncStatus = (event: Event) => {
      const detail = (event as CustomEvent<ObcpSyncStatusSnapshot>).detail
      setSyncStatus(detail ?? getObcpSyncStatus())
    }
    const refreshCustomQuestionSyncStatus = (event: Event) => {
      const detail = (event as CustomEvent<CustomQuestionSyncStatus>).detail
      setCustomQuestionSyncStatus(detail ?? getCustomQuestionSyncStatus())
    }
    const refreshCaseSyncStatus = (event: Event) => {
      const detail = (event as CustomEvent<TroubleshootingCaseSyncStatus>).detail
      setCaseSyncStatus(detail ?? getTroubleshootingCaseSyncStatus())
    }
    window.addEventListener(OBCP_DATA_UPDATED_EVENT, refreshDashboard)
    window.addEventListener(OBCP_CUSTOM_QUESTIONS_CHANGED_EVENT, refreshDashboard)
    window.addEventListener(TROUBLESHOOTING_CUSTOM_CASES_CHANGED_EVENT, refreshDashboard)
    window.addEventListener(OBCP_SYNC_STATUS_CHANGED_EVENT, refreshSyncStatus)
    window.addEventListener(
      CUSTOM_QUESTION_SYNC_STATUS_CHANGED_EVENT,
      refreshCustomQuestionSyncStatus,
    )
    window.addEventListener(
      TROUBLESHOOTING_CASE_SYNC_STATUS_CHANGED_EVENT,
      refreshCaseSyncStatus,
    )
    return () => {
      window.removeEventListener(OBCP_DATA_UPDATED_EVENT, refreshDashboard)
      window.removeEventListener(OBCP_CUSTOM_QUESTIONS_CHANGED_EVENT, refreshDashboard)
      window.removeEventListener(TROUBLESHOOTING_CUSTOM_CASES_CHANGED_EVENT, refreshDashboard)
      window.removeEventListener(OBCP_SYNC_STATUS_CHANGED_EVENT, refreshSyncStatus)
      window.removeEventListener(
        CUSTOM_QUESTION_SYNC_STATUS_CHANGED_EVENT,
        refreshCustomQuestionSyncStatus,
      )
      window.removeEventListener(
        TROUBLESHOOTING_CASE_SYNC_STATUS_CHANGED_EVENT,
        refreshCaseSyncStatus,
      )
    }
  }, [])

  const dashboardData = useMemo(() => {
    void dataRevision
    const customQuestions = loadCustomObcpQuestions()
    const allQuestions = mergeObcpQuestions(obcpQuestions, customQuestions)
    const userState = loadObcpUserState(CURRENT_USER_ID)
    const analytics = calculateObcpAnalytics(userState, allQuestions)
    const customCases = loadCustomTroubleshootingCases()
    const allCases = mergeTroubleshootingCases(troubleshootingCases, customCases)
    const allNodes = architectureModels.flatMap((model) => model.nodes)
    const recentCase = [...allCases].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
    const review = buildReviewCenterData({
      userState,
      questions: allQuestions,
      customQuestionIds: new Set(customQuestions.map((item) => item.questionId)),
      cases: allCases,
      recentSearches: loadRecentGlobalSearches(),
    })

    return {
      analytics,
      allQuestions,
      customQuestionCount: customQuestions.length,
      allCases,
      customCaseCount: customCases.length,
      recentCase,
      review,
      architecture: {
        modelCount: architectureModels.length,
        nodeCount: allNodes.length,
        linkCount: architectureModels.reduce((sum, model) => sum + model.links.length, 0),
        componentTypeCount: new Set(allNodes.map((node) => node.componentId)).size,
      },
    }
  }, [dataRevision])

  const { analytics, allQuestions, allCases, recentCase, architecture } = dashboardData
  const { userSummary } = analytics
  const highSeverityCount = allCases.filter((item) => item.severity === '高').length
  const resolvedCount = allCases.filter((item) => item.status === '已解决').length
  const databaseTypeCount = new Set(allCases.map((item) => item.databaseType)).size
  const recommendations = buildRecommendations(
    userSummary.totalAnswered,
    userSummary.correctRate,
    userSummary.recentPractice,
    dashboardData.customCaseCount,
  )

  return (
    <div className="space-y-6 p-3 sm:p-4 lg:p-5">
      <section className="border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold uppercase text-ocean-600">Learning & Operations Workspace</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink sm:text-3xl">OceanBase Learning & DBA Studio</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          OceanBase 架构学习、OBCP 刷题训练与 DBA 故障案例沉淀工作台
        </p>
      </section>

      <section>
        <SectionHeading eyebrow="Knowledge Workspace" title="知识工作台" />
        <div className="mt-3 grid gap-4 border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)] sm:p-5">
          <div>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                onGlobalSearch(knowledgeQuery)
              }}
            >
              <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-200 px-3 focus-within:border-ocean-400 focus-within:ring-2 focus-within:ring-ocean-100">
                <Search size={17} className="shrink-0 text-slate-400" />
                <input
                  value={knowledgeQuery}
                  onChange={(event) => setKnowledgeQuery(event.target.value)}
                  placeholder="搜索题库 / 案例 / 架构 / SQL / 命令"
                  aria-label="Dashboard 全局搜索"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>
              <button type="submit" className="h-11 shrink-0 rounded-md bg-ocean-600 px-4 text-sm font-semibold text-white hover:bg-ocean-700">搜索</button>
            </form>
            <DashboardSearchTerms
              title="推荐搜索"
              items={['OBProxy', 'LS', 'Tablet', '主从复制', 'InfluxDB', 'RLS', '租户资源隔离', 'SQL 审计']}
              onSelect={onGlobalSearch}
            />
            <DashboardSearchTerms
              title="最近搜索"
              items={loadRecentGlobalSearches()}
              emptyText="暂无搜索记录"
              onSelect={onGlobalSearch}
            />
          </div>
          <div className="border-t border-slate-100 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <p className="text-xs font-semibold uppercase text-slate-400">Knowledge Assets</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <KnowledgeMetric label="内置题" value={obcpQuestions.length} />
              <KnowledgeMetric label="自定义题" value={dashboardData.customQuestionCount} />
              <KnowledgeMetric label="内置案例" value={troubleshootingCases.length} />
              <KnowledgeMetric label="自定义案例" value={dashboardData.customCaseCount} />
              <KnowledgeMetric label="架构模型" value={architecture.modelCount} wide />
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading eyebrow="Daily Review" title="今日复盘" />
        <div className="mt-3 border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SmallMetric icon={Target} label="建议复习" value={`${dashboardData.review.todaySuggestedCount} 题`} />
              <SmallMetric icon={AlertTriangle} label="错题" value={`${dashboardData.review.wrongQuestions.length} 题`} />
              <SmallMetric icon={Bookmark} label="收藏" value={`${dashboardData.review.favoriteQuestions.length} 题`} />
              <SmallMetric icon={Lightbulb} label="我不理解" value={`${dashboardData.review.notUnderstoodQuestions.length} 题`} />
            </div>
            <div className="min-w-0 border-t border-slate-100 pt-4 lg:w-72 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
              <p className="text-xs text-slate-500">推荐复习章节</p>
              <p className="mt-1 truncate text-sm font-semibold text-ink">{dashboardData.review.recommendedChapter ?? 'OceanBase 架构基础'}</p>
              <button type="button" onClick={() => onModuleChange('review')} className="mt-3 flex h-9 items-center gap-2 rounded-md bg-ocean-600 px-3 text-sm font-semibold text-white hover:bg-ocean-700"><RefreshCw size={15} />进入学习复盘</button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading eyebrow="Core Modules" title="核心模块" />
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          <ModuleCard
            icon={Network}
            title="架构分析"
            description="交互式查看 OceanBase 架构模型、组件原理与排障信息。"
            overview={`${architecture.modelCount} 个模型 · ${architecture.nodeCount} 个拓扑节点`}
            tone="ocean"
            onClick={() => onModuleChange('architecture')}
          />
          <ModuleCard
            icon={BookOpenCheck}
            title="OBCP 题库"
            description="章节练习、随机刷题、模拟考试与学习诊断。"
            overview={`${allQuestions.length} 道题 · 已作答 ${userSummary.totalAnswered} 次`}
            tone="violet"
            onClick={() => onModuleChange('question-bank')}
          />
          <ModuleCard
            icon={Siren}
            title="故障案例"
            description="沉淀 DBA 故障现象、排查步骤、命令与处理方案。"
            overview={`${allCases.length} 个案例 · ${databaseTypeCount} 类数据库`}
            tone="amber"
            onClick={() => onModuleChange('troubleshooting')}
          />
        </div>
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(22rem,0.88fr)]">
        <div className="space-y-5">
          <section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionHeading eyebrow="OBCP Progress" title="OBCP 学习概览" />
              <div className="flex flex-wrap gap-2">
                <ActionButton label="继续刷题" onClick={() => onModuleChange('question-bank')} primary />
                <ActionButton label="查看学习诊断" onClick={() => onModuleChange('question-bank')} />
              </div>
            </div>
            <SyncHint status={syncStatus} />
            <QuestionBankSyncHint
              builtInCount={obcpQuestions.length}
              customCount={dashboardData.customQuestionCount}
              status={customQuestionSyncStatus}
            />
            {userSummary.totalAnswered ? (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <SmallMetric icon={CheckCircle2} label="累计刷题" value={`${userSummary.totalAnswered} 题`} />
                  <SmallMetric icon={TrendingUp} label="当前正确率" value={`${userSummary.correctRate}%`} />
                  <SmallMetric icon={Target} label="待复习题数" value={`${userSummary.wrongCount} 题`} />
                  <SmallMetric icon={Bookmark} label="收藏题数" value={`${userSummary.favoriteCount} 题`} />
                </div>
                <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-slate-100 text-slate-600"><Clock3 size={17} /></span>
                  <div><p className="text-xs text-slate-500">最近练习章节</p><p className="mt-0.5 text-sm font-semibold text-ink">{userSummary.recentPractice ?? '暂无章节记录'}</p></div>
                  <span className="ml-auto text-xs text-slate-400">{formatDate(userSummary.recentPracticeAt)}</span>
                </div>
              </>
            ) : (
              <div className="mt-4 border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                <BookOpenCheck size={26} className="mx-auto text-slate-400" />
                <p className="mt-3 text-sm font-semibold text-slate-700">还没有刷题记录</p>
                <p className="mt-1 text-xs text-slate-500">建议从“OceanBase 架构基础”章节开始顺序练习。</p>
              </div>
            )}
          </section>

          <section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionHeading eyebrow="DBA Case Lab" title="故障案例概览" />
              <ActionButton label="进入故障案例库" onClick={() => onModuleChange('troubleshooting')} primary />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SmallMetric icon={Database} label="总案例数" value={`${allCases.length}`} />
              <SmallMetric icon={AlertTriangle} label="高严重等级" value={`${highSeverityCount}`} />
              <SmallMetric icon={CheckCircle2} label="已解决案例" value={`${resolvedCount}`} />
              <SmallMetric icon={GitBranch} label="数据库类型" value={`${databaseTypeCount}`} />
            </div>
            <CaseSyncHint
              builtInCount={troubleshootingCases.length}
              customCount={dashboardData.customCaseCount}
              status={caseSyncStatus}
            />
            {recentCase && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">最近更新案例</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-ink">{recentCase.title}</p>
                <p className="mt-1 text-xs text-slate-400">{recentCase.databaseType} · {recentCase.faultType} · {formatDate(recentCase.updatedAt)}</p>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionHeading eyebrow="Architecture" title="架构学习概览" />
              <ActionButton label="进入架构分析" onClick={() => onModuleChange('architecture')} primary />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <OverviewMetric label="架构模型" value={architecture.modelCount} />
              <OverviewMetric label="拓扑节点" value={architecture.nodeCount} />
              <OverviewMetric label="逻辑链路" value={architecture.linkCount} />
              <OverviewMetric label="组件类型" value={architecture.componentTypeCount} />
            </div>
          </section>

          <section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <SectionHeading eyebrow="Next Actions" title="推荐下一步" />
            <div className="mt-4 space-y-3">
              {recommendations.map((recommendation) => (
                <button
                  key={recommendation.title}
                  type="button"
                  onClick={() => onModuleChange(recommendation.module)}
                  className="flex w-full items-start gap-3 border border-slate-200 px-3 py-3 text-left transition hover:border-ocean-300 hover:bg-ocean-50"
                >
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-ocean-50 text-ocean-700"><Lightbulb size={16} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{recommendation.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{recommendation.description}</span></span>
                  <ArrowRight size={16} className="mt-1 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div><p className="text-xs font-semibold uppercase text-slate-400">{eyebrow}</p><h2 className="mt-1 text-lg font-semibold text-ink">{title}</h2></div>
}

function ModuleCard({ icon: Icon, title, description, overview, tone, onClick }: { icon: typeof Network; title: string; description: string; overview: string; tone: 'ocean' | 'violet' | 'amber'; onClick: () => void }) {
  const tones = { ocean: 'bg-ocean-50 text-ocean-700', violet: 'bg-violet-50 text-violet-700', amber: 'bg-amber-50 text-amber-700' }
  return (
    <article className="flex min-h-52 flex-col border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`grid h-11 w-11 place-items-center rounded-md ${tones[tone]}`}><Icon size={21} /></span>
      <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <p className="mt-3 text-xs font-medium text-slate-500">{overview}</p>
      <button type="button" onClick={onClick} className="mt-auto flex h-9 items-center justify-between border-t border-slate-100 pt-3 text-sm font-semibold text-ocean-700 hover:text-ocean-900">
        进入模块<ArrowRight size={16} />
      </button>
    </article>
  )
}

function SmallMetric({ icon: Icon, label, value }: { icon: typeof CheckCircle2; label: string; value: string }) {
  return <div className="flex items-center gap-3 bg-slate-50 px-3 py-3"><Icon size={17} className="shrink-0 text-ocean-600" /><div><p className="text-[11px] text-slate-500">{label}</p><p className="mt-0.5 text-sm font-semibold text-ink">{value}</p></div></div>
}

function OverviewMetric({ label, value }: { label: string; value: number }) {
  return <div className="bg-slate-50 px-4 py-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-ink">{value}</p></div>
}

function DashboardSearchTerms({
  title,
  items,
  emptyText,
  onSelect,
}: {
  title: string
  items: string[]
  emptyText?: string
  onSelect: (query: string) => void
}) {
  return (
    <div className="mt-4 flex items-start gap-3">
      <span className="w-16 shrink-0 pt-1 text-[11px] font-semibold text-slate-400">{title}</span>
      {items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => <button key={item} type="button" onClick={() => onSelect(item)} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-ocean-50 hover:text-ocean-700">{item}</button>)}
        </div>
      ) : <span className="pt-1 text-xs text-slate-400">{emptyText}</span>}
    </div>
  )
}

function KnowledgeMetric({ label, value, wide }: { label: string; value: number; wide?: boolean }) {
  return <div className={`bg-slate-50 px-3 py-3 ${wide ? 'col-span-2' : ''}`}><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold text-ink">{value}</p></div>
}

function ActionButton({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return <button type="button" onClick={onClick} className={`h-9 rounded-md px-3 text-sm font-semibold transition ${primary ? 'bg-ocean-600 text-white hover:bg-ocean-700' : 'border border-slate-200 bg-white text-slate-600 hover:border-ocean-300 hover:text-ocean-700'}`}>{label}</button>
}

function SyncHint({ status }: { status: ObcpSyncStatusSnapshot }) {
  const failed = status.state === 'failed'
  const Icon = failed || !status.loggedIn ? CloudOff : Cloud
  let text = '当前为本地记录'
  if (failed) {
    text = `同步失败：${status.lastError ?? '已保留本地记录'}`
  } else if (status.state === 'syncing') {
    text = '云端同步进行中，本地记录仍可正常使用'
  } else if (status.loggedIn && status.state === 'synced') {
    text = `云端同步已开启 · 最近同步 ${formatDate(status.lastSyncAt)}`
  } else if (status.loggedIn) {
    text = '云端同步已开启'
  } else if (status.configured) {
    text = '未登录，当前为本地记录'
  }
  return (
    <div className={`mt-4 flex items-start gap-2 rounded-md px-3 py-2 text-xs leading-5 ${failed ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'}`}>
      <Icon size={15} className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  )
}

function QuestionBankSyncHint({
  builtInCount,
  customCount,
  status,
}: {
  builtInCount: number
  customCount: number
  status: CustomQuestionSyncStatus
}) {
  let syncText = status.configured
    ? '自定义题库当前仅保存在本地'
    : '本地题库模式'
  if (status.state === 'syncing') syncText = '自定义题库同步中'
  else if (status.state === 'failed') syncText = '自定义题库同步失败，可稍后重试'
  else if (status.loggedIn && status.state === 'synced') {
    syncText = `自定义题库已同步 · ${formatDate(status.lastSyncAt)}`
  } else if (status.loggedIn) syncText = '自定义题库云同步已开启'

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-slate-500">
      <span>内置题库 {builtInCount} 道</span>
      <span>自定义题库 {customCount} 道</span>
      <span className={status.state === 'failed' ? 'text-rose-700' : ''}>{syncText}</span>
    </div>
  )
}

function CaseSyncHint({
  builtInCount,
  customCount,
  status,
}: {
  builtInCount: number
  customCount: number
  status: TroubleshootingCaseSyncStatus
}) {
  let syncText = status.configured ? '自定义案例当前仅保存在本地' : '本地案例模式'
  if (status.state === 'syncing') syncText = '故障案例同步中'
  else if (status.state === 'failed') syncText = '故障案例同步失败，可稍后重试'
  else if (status.loggedIn && status.state === 'synced') {
    syncText = `故障案例已同步 · ${formatDate(status.lastSyncAt)}`
  } else if (status.loggedIn) syncText = '故障案例云同步已开启'

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
      <span>内置案例 {builtInCount} 个</span>
      <span>自定义案例 {customCount} 个</span>
      <span className={status.state === 'failed' ? 'text-rose-700' : ''}>{syncText}</span>
    </div>
  )
}

function buildRecommendations(totalAnswered: number, correctRate: number, recentPractice: string | undefined, customCaseCount: number) {
  const items: Array<{ title: string; description: string; module: AppModuleId }> = []
  if (!totalAnswered) {
    items.push({ title: '从架构基础开始练习', description: '先完成 OBCP 架构基础章节，建立核心概念框架。', module: 'question-bank' })
  } else if (correctRate < 60) {
    items.push({ title: '查看学习诊断并重做错题', description: `当前正确率 ${correctRate}%，建议优先补齐薄弱知识点。`, module: 'question-bank' })
  } else {
    items.push({ title: '继续最近练习', description: recentPractice ? `继续完成“${recentPractice}”相关练习。` : '继续完成随机练习并巩固知识点。', module: 'question-bank' })
  }
  if (!customCaseCount) {
    items.push({ title: '导入自己的 DBA 故障案例', description: '使用案例模板整理真实排障经验，形成可搜索的本地案例库。', module: 'troubleshooting' })
  } else {
    items.push({ title: '复盘最近故障案例', description: `当前已有 ${customCaseCount} 个自定义案例，可继续补充根因证据和验证步骤。`, module: 'troubleshooting' })
  }
  items.push({ title: '回看交互式架构模型', description: '结合拓扑、组件详情和故障排查信息巩固架构关系。', module: 'architecture' })
  return items
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN') : '暂无记录'
}
