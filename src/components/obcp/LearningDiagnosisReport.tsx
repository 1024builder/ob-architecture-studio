import { CheckCircle2, Clock3, Target, X } from 'lucide-react'
import type { ObcpAnalytics } from '../../data/obcpTypes'
import { LearningDiagnosisExport } from './LearningDiagnosisExport'

type Props = {
  analytics: ObcpAnalytics
  onClose: () => void
  onViewArchitectureComponent: (componentName: string) => void
}

export function LearningDiagnosisReport({ analytics, onClose, onViewArchitectureComponent }: Props) {
  const { userSummary } = analytics

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/35 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="OBCP 学习诊断报告">
      <div className="my-auto w-full max-w-6xl rounded-md border border-slate-200 bg-slate-50 shadow-2xl">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase text-ocean-600">Learning Diagnosis</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">OBCP 用户学习诊断</h2>
          </div>
          <div className="flex items-center gap-2">
            <LearningDiagnosisExport analytics={analytics} />
            <button type="button" title="关闭报告" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-slate-800">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="space-y-5 p-4 sm:p-6">
          {userSummary.totalAnswered === 0 && (
            <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-800">
              暂无已提交的答题记录。完成一次练习后，这里会生成章节掌握、薄弱知识点和错题诊断。
            </div>
          )}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric icon={CheckCircle2} label="累计作答" value={`${userSummary.totalAnswered} 题`} />
            <Metric icon={Target} label="正确率" value={`${userSummary.correctRate}%`} />
            <Metric icon={X} label="待复习错题" value={`${userSummary.wrongCount} 题`} />
            <Metric icon={Clock3} label="平均耗时" value={`${userSummary.averageDurationSeconds} 秒`} />
          </section>

          <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3"><h3 className="text-sm font-semibold text-ink">章节掌握情况</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr><th className="px-4 py-3">章节</th><th className="px-4 py-3">进度</th><th className="px-4 py-3">正确率</th><th className="px-4 py-3">掌握状态</th><th className="px-4 py-3">建议动作</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.chapterStats.map((item) => (
                    <tr key={item.name}>
                      <td className="px-4 py-3 font-medium text-ink">{item.name}</td>
                      <td className="px-4 py-3 text-slate-600">{item.completedQuestions}/{item.totalQuestions}</td>
                      <td className="px-4 py-3 text-slate-600">{item.correctRate}%</td>
                      <td className="px-4 py-3"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{item.mastery}</span></td>
                      <td className="px-4 py-3 text-slate-600">{item.suggestedAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <KnowledgeList
              title="薄弱知识点 Top 5"
              items={analytics.weakPoints}
              tone="weak"
              componentMap={new Map(analytics.weakPointDiagnoses.map((item) => [item.name, item.relatedComponents]))}
              onViewArchitectureComponent={onViewArchitectureComponent}
            />
            <KnowledgeList title="已掌握知识点 Top 5" items={analytics.strongPoints} tone="strong" />
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-ink">高频错题与重复错误</h3>
            <div className="mt-3 divide-y divide-slate-100">
              {analytics.frequentWrongQuestions.length ? analytics.frequentWrongQuestions.map((item) => (
                <div key={item.questionId} className="grid gap-2 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_7rem] sm:items-center">
                  <span className="text-xs font-semibold text-rose-700">{item.questionId}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-700">{item.stem}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.knowledgePoints.join('、')} · {formatDate(item.latestWrongAt)}</p>
                  </div>
                  <span className="text-sm font-semibold text-rose-600">错误 {item.wrongCount} 次</span>
                </div>
              )) : <p className="py-3 text-sm text-slate-400">暂无错误题目。</p>}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.75fr)]">
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-ink">薄弱点原因推测</h3>
              <div className="mt-3 space-y-3">
                {analytics.weakPointDiagnoses.length ? analytics.weakPointDiagnoses.map((item) => (
                  <div key={item.name} className="rounded-md bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-ink">{item.name}</span><span className="text-sm font-semibold text-amber-700">{item.correctRate}%</span></div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{item.reasons.join('；')}</p>
                    {!!item.relatedComponents.length && <ArchitectureComponentTags components={item.relatedComponents} onSelect={onViewArchitectureComponent} />}
                  </div>
                )) : <p className="text-sm text-slate-400">有效样本不足，继续完成章节练习后会生成原因推测。</p>}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-ink">AI 分析提示词预览</h3>
              <p className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-600">{analytics.llmPrompt}</p>
              {!!analytics.insufficientPoints.length && <p className="mt-3 text-xs leading-5 text-amber-700">样本不足：{analytics.insufficientPoints.map((item) => item.name).join('、')}</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof CheckCircle2; label: string; value: string }) {
  return <div className="flex min-h-20 items-center gap-3 rounded-md border border-slate-200 bg-white px-4 shadow-sm"><span className="grid h-10 w-10 place-items-center rounded-md bg-ocean-50 text-ocean-600"><Icon size={18} /></span><div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold text-ink">{value}</p></div></div>
}

function KnowledgeList({
  title,
  items,
  tone,
  componentMap,
  onViewArchitectureComponent,
}: {
  title: string
  items: ObcpAnalytics['weakPoints']
  tone: 'weak' | 'strong'
  componentMap?: Map<string, string[]>
  onViewArchitectureComponent?: (componentName: string) => void
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => (
          <div key={item.name}>
            <div className="flex items-center justify-between text-sm"><span className="font-medium text-slate-700">{item.name}</span><span className={tone === 'weak' ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'}>{item.correctRate}%</span></div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${tone === 'weak' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${item.correctRate}%` }} /></div>
            {!!componentMap?.get(item.name)?.length && onViewArchitectureComponent && <ArchitectureComponentTags components={componentMap.get(item.name) ?? []} onSelect={onViewArchitectureComponent} />}
          </div>
        )) : <p className="text-sm text-slate-400">暂无达到诊断样本量的数据。</p>}
      </div>
    </section>
  )
}

function ArchitectureComponentTags({ components, onSelect }: { components: string[]; onSelect: (componentName: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {components.map((component) => (
        <button key={component} type="button" onClick={() => onSelect(component)} className="rounded-md border border-ocean-200 bg-ocean-50 px-2 py-1 text-xs font-semibold text-ocean-700 transition hover:border-ocean-400 hover:bg-ocean-100">
          {component}
        </button>
      ))}
    </div>
  )
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString('zh-CN') : '暂无'
}
