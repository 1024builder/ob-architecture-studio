import {
  AlertCircle,
  ArrowRight,
  BookMarked,
  Check,
  ClipboardCopy,
  Download,
  Lightbulb,
  RefreshCw,
  Search,
  Target,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getStoredSession } from '../services/authService'
import {
  loadRecentGlobalSearches,
} from '../services/globalSearchService'
import {
  buildReviewCenterData,
  type ReviewQuestionItem,
} from '../services/reviewCenterService'
import { obcpQuestions } from '../data/obcpQuestions'
import { troubleshootingCases } from '../data/troubleshootingCases'
import {
  loadCustomObcpQuestions,
  mergeObcpQuestions,
  OBCP_CUSTOM_QUESTIONS_CHANGED_EVENT,
} from '../utils/obcpQuestionImportExport'
import {
  loadObcpUserState,
  OBCP_DATA_UPDATED_EVENT,
} from '../utils/obcpStorage'
import {
  loadCustomTroubleshootingCases,
  mergeTroubleshootingCases,
  TROUBLESHOOTING_CUSTOM_CASES_CHANGED_EVENT,
} from '../utils/troubleshootingImportExport'
import {
  downloadReviewMarkdown,
  generateReviewLlmText,
} from '../utils/reviewExport'

const CURRENT_USER_ID = 'local-user'

type Props = {
  onPracticeQuestions: (questionIds: string[], sourceLabel: string) => void
  onViewArchitecture: (modelId: string, componentName?: string) => void
  onViewCase: (caseId: string) => void
  onGlobalSearch: (query: string) => void
}

export function ReviewCenterPage({
  onPracticeQuestions,
  onViewArchitecture,
  onViewCase,
  onGlobalSearch,
}: Props) {
  const [revision, setRevision] = useState(0)
  const [chapterFilter, setChapterFilter] = useState('全部')
  const [copyStatus, setCopyStatus] =
    useState<'idle' | 'success' | 'error'>('idle')

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1)
    window.addEventListener(OBCP_DATA_UPDATED_EVENT, refresh)
    window.addEventListener(OBCP_CUSTOM_QUESTIONS_CHANGED_EVENT, refresh)
    window.addEventListener(TROUBLESHOOTING_CUSTOM_CASES_CHANGED_EVENT, refresh)
    return () => {
      window.removeEventListener(OBCP_DATA_UPDATED_EVENT, refresh)
      window.removeEventListener(OBCP_CUSTOM_QUESTIONS_CHANGED_EVENT, refresh)
      window.removeEventListener(TROUBLESHOOTING_CUSTOM_CASES_CHANGED_EVENT, refresh)
    }
  }, [])

  const reviewData = useMemo(() => {
    void revision
    const customQuestions = loadCustomObcpQuestions()
    const questions = mergeObcpQuestions(obcpQuestions, customQuestions)
    const cases = mergeTroubleshootingCases(
      troubleshootingCases,
      loadCustomTroubleshootingCases(),
    )
    return buildReviewCenterData({
      userState: loadObcpUserState(CURRENT_USER_ID),
      questions,
      customQuestionIds: new Set(customQuestions.map((item) => item.questionId)),
      cases,
      recentSearches: loadRecentGlobalSearches(),
    })
  }, [revision])

  const account = getStoredSession()?.user.email ?? '本地模式用户'
  const filteredWrongQuestions = chapterFilter === '全部'
    ? reviewData.wrongQuestions
    : reviewData.wrongQuestions.filter((item) => item.chapter === chapterFilter)
  const wrongChapters = Array.from(new Set(
    reviewData.wrongQuestions.map((item) => item.chapter),
  ))

  async function copyForLlm() {
    const succeeded = await copyText(generateReviewLlmText(reviewData, account))
    setCopyStatus(succeeded ? 'success' : 'error')
    window.setTimeout(() => setCopyStatus('idle'), 1800)
  }

  return (
    <div className="space-y-5 p-3 sm:p-4 lg:p-5">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-ocean-600">Learning Review Center</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">学习复盘中心</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            基于刷题记录、错题、收藏、不理解标记和知识资产生成今日复习路径。
          </p>
          <p className="mt-2 text-xs text-slate-400">
            {account === '本地模式用户'
              ? '当前使用本地学习数据，登录后可跨设备同步复盘依据。'
              : `当前账号：${account}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => downloadReviewMarkdown(reviewData, account)} className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:border-ocean-300 hover:text-ocean-700"><Download size={16} />导出复盘报告</button>
          <button type="button" onClick={() => void copyForLlm()} className="flex h-10 items-center gap-2 rounded-md bg-ocean-600 px-3 text-sm font-semibold text-white hover:bg-ocean-700">
            {copyStatus === 'success' ? <Check size={16} /> : <ClipboardCopy size={16} />}
            {copyStatus === 'success' ? '已复制' : copyStatus === 'error' ? '复制失败' : '复制给大模型分析'}
          </button>
        </div>
      </section>

      <section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeading eyebrow="Today" title="今日复盘建议" />
          <button
            type="button"
            disabled={!reviewData.todayQuestionIds.length}
            onClick={() => onPracticeQuestions(reviewData.todayQuestionIds, '今日复盘')}
            className="flex h-10 items-center gap-2 rounded-md bg-ocean-600 px-4 text-sm font-semibold text-white hover:bg-ocean-700 disabled:opacity-45"
          >
            开始今日复盘<ArrowRight size={16} />
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ReviewMetric icon={Target} label="建议完成" value={`${reviewData.todaySuggestedCount} 题`} />
          <ReviewMetric icon={AlertCircle} label="待处理错题" value={`${reviewData.wrongQuestions.length} 题`} />
          <ReviewMetric icon={BookMarked} label="收藏题" value={`${reviewData.favoriteQuestions.length} 题`} />
          <ReviewMetric icon={Lightbulb} label="我不理解" value={`${reviewData.notUnderstoodQuestions.length} 题`} />
        </div>
        <div className="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
          建议优先复习：<span className="font-semibold text-ink">{reviewData.recommendedChapter ?? 'OceanBase 架构基础'}</span>
          {reviewData.wrongQuestions.length > 0 && '，先重做最近错题'}
          {reviewData.notUnderstoodQuestions.length > 0 && '，再回看“我不理解”题'}
        </div>
      </section>

      {!reviewData.analytics.userSummary.totalAnswered && (
        <EmptyState
          title="暂无答题记录"
          description="先完成一组 OBCP 练习，复盘中心会据此生成薄弱章节和今日任务。"
        />
      )}

      <section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <SectionHeading eyebrow="Chapter Mastery" title="薄弱章节分析" />
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {reviewData.chapters.map((chapter) => (
            <div key={chapter.name} className="border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-sm font-semibold text-ink">{chapter.name}</p><p className="mt-1 text-xs text-slate-500">已完成 {chapter.completedQuestions}/{chapter.totalQuestions}</p></div>
                <span className={`rounded px-2 py-1 text-xs font-semibold ${chapterTone(chapter.reviewStatus)}`}>{chapter.reviewStatus}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-ocean-500" style={{ width: `${chapter.correctRate}%` }} /></div>
              <div className="mt-2 flex justify-between text-xs"><span className="text-slate-500">{chapter.suggestedAction}</span><span className="font-semibold text-slate-700">{chapter.correctRate}%</span></div>
            </div>
          ))}
        </div>
      </section>

      <section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeading eyebrow="Wrong Queue" title="错题复盘队列" />
          <div className="flex flex-wrap gap-2">
            <select aria-label="错题章节筛选" value={chapterFilter} onChange={(event) => setChapterFilter(event.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600">
              <option value="全部">全部章节</option>
              {wrongChapters.map((chapter) => <option key={chapter} value={chapter}>{chapter}</option>)}
            </select>
            <button type="button" disabled={!filteredWrongQuestions.length} onClick={() => onPracticeQuestions(filteredWrongQuestions.map((item) => item.questionId), '错题复盘')} className="flex h-9 items-center gap-2 rounded-md bg-ocean-600 px-3 text-xs font-semibold text-white disabled:opacity-45"><RefreshCw size={15} />重做当前错题</button>
          </div>
        </div>
        <QuestionReviewList
          items={filteredWrongQuestions}
          emptyText="暂无错题，继续保持。"
          onPractice={(item) => onPracticeQuestions([item.questionId], '错题复盘')}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <QuestionCollection
          title="收藏题"
          items={reviewData.favoriteQuestions}
          emptyText="暂无收藏题。"
          onPractice={(ids) => onPracticeQuestions(ids, '收藏题复盘')}
        />
        <QuestionCollection
          title="我不理解题"
          items={reviewData.notUnderstoodQuestions}
          emptyText="暂无“我不理解”题。"
          onPractice={(ids) => onPracticeQuestions(ids, '不理解题复盘')}
        />
      </section>

      <section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <SectionHeading eyebrow="Recommendations" title="知识推荐" />
        <div className="mt-4 grid gap-5 lg:grid-cols-3">
          <RecommendationBlock title="相关架构模型">
            {reviewData.architectureRecommendations.length
              ? reviewData.architectureRecommendations.map((item) => (
                <RecommendationButton key={item.modelId} title={item.title} description={item.reason} onClick={() => onViewArchitecture(item.modelId, item.componentName)} />
              ))
              : <EmptyLine text="暂无明确架构推荐。" />}
          </RecommendationBlock>
          <RecommendationBlock title="相关故障案例">
            {reviewData.caseRecommendations.length
              ? reviewData.caseRecommendations.map((item) => (
                <RecommendationButton key={item.caseId} title={item.title} description={item.reason} onClick={() => onViewCase(item.caseId)} />
              ))
              : <EmptyLine text="暂无明确案例推荐。" />}
          </RecommendationBlock>
          <RecommendationBlock title="最近搜索回看">
            {reviewData.recentSearches.length
              ? reviewData.recentSearches.map((query) => (
                <button key={query} type="button" onClick={() => onGlobalSearch(query)} className="flex w-full items-center justify-between gap-3 border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:border-ocean-300 hover:bg-ocean-50"><span className="flex min-w-0 items-center gap-2"><Search size={15} className="shrink-0 text-ocean-600" /><span className="truncate">{query}</span></span><ArrowRight size={15} className="shrink-0 text-slate-400" /></button>
              ))
              : <EmptyLine text="暂无最近搜索关键词。" />}
          </RecommendationBlock>
        </div>
      </section>
    </div>
  )
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div><p className="text-xs font-semibold uppercase text-slate-400">{eyebrow}</p><h2 className="mt-1 text-lg font-semibold text-ink">{title}</h2></div>
}

function ReviewMetric({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return <div className="flex items-center gap-3 bg-slate-50 px-3 py-3"><Icon size={17} className="text-ocean-600" /><div><p className="text-[11px] text-slate-500">{label}</p><p className="mt-0.5 text-sm font-semibold text-ink">{value}</p></div></div>
}

function QuestionReviewList({ items, emptyText, onPractice }: { items: ReviewQuestionItem[]; emptyText: string; onPractice: (item: ReviewQuestionItem) => void }) {
  if (!items.length) return <EmptyLine text={emptyText} />
  return <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">{items.slice(0, 12).map((item) => <div key={item.questionId} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2 text-[11px]"><span className="rounded bg-slate-100 px-2 py-1 text-slate-600">{item.source}</span><span className="py-1 text-slate-400">{item.chapter}</span>{item.wrongCount > 0 && <span className="py-1 text-rose-600">错误 {item.wrongCount} 次</span>}</div><p className="mt-2 text-sm leading-6 text-ink">{item.stem}</p></div><button type="button" onClick={() => onPractice(item)} className="h-9 shrink-0 rounded-md border border-slate-200 px-3 text-xs font-semibold text-ocean-700 hover:bg-ocean-50">进入复习</button></div>)}</div>
}

function QuestionCollection({ title, items, emptyText, onPractice }: { title: string; items: ReviewQuestionItem[]; emptyText: string; onPractice: (ids: string[]) => void }) {
  return <section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-ink">{title}</h2><button type="button" disabled={!items.length} onClick={() => onPractice(items.map((item) => item.questionId))} className="h-9 rounded-md border border-slate-200 px-3 text-xs font-semibold text-ocean-700 disabled:opacity-45">一键练习</button></div><QuestionReviewList items={items.slice(0, 6)} emptyText={emptyText} onPractice={(item) => onPractice([item.questionId])} /></section>
}

function RecommendationBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h3 className="text-sm font-semibold text-ink">{title}</h3><div className="mt-3 space-y-2">{children}</div></div>
}

function RecommendationButton({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex w-full items-start justify-between gap-3 border border-slate-200 px-3 py-3 text-left hover:border-ocean-300 hover:bg-ocean-50"><span className="min-w-0"><span className="block text-sm font-semibold text-ink">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span><ArrowRight size={15} className="mt-1 shrink-0 text-slate-400" /></button>
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="border border-dashed border-slate-300 bg-white px-4 py-8 text-center"><p className="text-sm font-semibold text-slate-700">{title}</p><p className="mt-1 text-xs text-slate-500">{description}</p></div>
}

function EmptyLine({ text }: { text: string }) {
  return <p className="mt-3 rounded-md bg-slate-50 px-3 py-5 text-center text-xs text-slate-400">{text}</p>
}

function chapterTone(status: '需加强' | '基本掌握' | '较熟悉') {
  if (status === '需加强') return 'bg-rose-100 text-rose-700'
  if (status === '基本掌握') return 'bg-amber-100 text-amber-700'
  return 'bg-emerald-100 text-emerald-700'
}

async function copyText(content: string) {
  try {
    await navigator.clipboard.writeText(content)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = content
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const succeeded = document.execCommand('copy')
    textarea.remove()
    return succeeded
  }
}
