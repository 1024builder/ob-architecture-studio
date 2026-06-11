import { AlertTriangle, BookOpen, Check, Clipboard, ClipboardList, TerminalSquare } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ComponentDetail, TopologyNode } from '../data/types'

type Props = {
  detail: ComponentDetail
  node: TopologyNode
}

type Tab = 'overview' | 'sql' | 'faults'

export function InfoPanel({ detail, node }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [copiedSql, setCopiedSql] = useState<string | null>(null)

  useEffect(() => {
    setActiveTab('overview')
    setCopiedSql(null)
  }, [node.id])

  async function copySql(sql: string) {
    await navigator.clipboard.writeText(sql)
    setCopiedSql(sql)
    window.setTimeout(() => setCopiedSql(null), 1400)
  }

  const tabs = [
    { id: 'overview' as const, label: '概览', icon: BookOpen },
    { id: 'sql' as const, label: 'SQL 命令', icon: TerminalSquare },
    { id: 'faults' as const, label: '故障排查', icon: AlertTriangle },
  ]

  return (
    <aside className="w-full shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white shadow-soft 2xl:sticky 2xl:top-20">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase text-ocean-600">Component Detail</p>
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Healthy</span>
        </div>
        <h2 className="mt-1 text-xl font-semibold text-ink">{detail.name}</h2>
        <p className="mt-1 text-sm text-slate-500">{detail.role}</p>
        <div className="mt-3 flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
          <span className="text-xs text-slate-500">拓扑实例</span>
          <span className="truncate pl-3 text-sm font-semibold text-ink">{node.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 border-b border-slate-200 p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex min-h-10 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition ${
              activeTab === id ? 'bg-ocean-50 text-ocean-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="max-h-[720px] overflow-auto p-5">
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <section>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><BookOpen size={16} /><span>说明</span></div>
              <p className="text-sm leading-6 text-slate-600">{detail.description}</p>
            </section>
            <section>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><ClipboardList size={16} /><span>关键概念</span></div>
              <div className="flex flex-wrap gap-2">
                {detail.concepts.map((concept) => (
                  <span key={concept} className="rounded-md border border-ocean-100 bg-ocean-50 px-2.5 py-1 text-xs font-medium text-ocean-700">{concept}</span>
                ))}
              </div>
            </section>
            <section className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase text-emerald-700">DBA Checkpoint</p>
              <p className="mt-2 text-sm leading-6 text-emerald-900">先确认实例状态和位置，再结合链路延迟、资源水位与最近变更判断问题边界。</p>
            </section>
          </div>
        )}

        {activeTab === 'sql' && (
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><TerminalSquare size={16} /><span>常用 SQL / 命令</span></div>
            <div className="space-y-2">
              {detail.sql.map((sql) => (
                <div key={sql} className="relative rounded-md border border-slate-800 bg-slate-950 p-3 pr-11">
                  <code className="block break-words text-xs leading-5 text-cyan-100">{sql}</code>
                  <button
                    type="button"
                    title="复制命令"
                    onClick={() => void copySql(sql)}
                    className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-slate-800 hover:text-white"
                  >
                    {copiedSql === sql ? <Check size={14} /> : <Clipboard size={14} />}
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">执行变更类命令前，请先确认租户、集群与当前角色。</p>
          </section>
        )}

        {activeTab === 'faults' && (
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><AlertTriangle size={16} /><span>常见故障</span></div>
            <div className="space-y-2">
              {detail.faults.map((fault, index) => (
                <div key={fault} className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-amber-200 text-xs font-bold text-amber-800">{index + 1}</span>
                  <div>
                    <p className="text-sm font-medium leading-5 text-amber-900">{fault}</p>
                    <p className="mt-1 text-xs leading-5 text-amber-700">检查状态视图、相关日志与最近变更记录。</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  )
}
