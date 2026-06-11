import { AlertTriangle, ChevronRight, SearchX } from 'lucide-react'
import type { TroubleshootingCase } from '../../data/troubleshootingTypes'

type Props = {
  cases: TroubleshootingCase[]
  selectedCaseId?: string
  onSelect: (caseId: string) => void
}

export function CaseList({ cases, selectedCaseId, onSelect }: Props) {
  if (!cases.length) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center border border-dashed border-slate-300 bg-white px-5 text-center">
        <SearchX size={28} className="text-slate-400" />
        <p className="mt-3 text-sm font-semibold text-slate-700">没有匹配的故障案例</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">请清空关键词或调整数据库类型、故障类型和严重等级。</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-slate-200 overflow-hidden border border-slate-200 bg-white shadow-sm">
      {cases.map((item) => {
        const selected = item.caseId === selectedCaseId
        return (
          <button
            key={item.caseId}
            type="button"
            onClick={() => onSelect(item.caseId)}
            className={`w-full px-4 py-4 text-left transition ${selected ? 'bg-ocean-50' : 'hover:bg-slate-50'}`}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md ${severityTone[item.severity]}`}>
                <AlertTriangle size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-ocean-700">{item.databaseType}</span>
                  <span className="text-slate-300">/</span>
                  <span className="text-slate-500">{item.faultType}</span>
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${severityBadge[item.severity]}`}>{item.severity}</span>
                </span>
                <span className="mt-2 block text-sm font-semibold leading-5 text-ink">{item.title}</span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {item.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{tag}</span>)}
                </span>
                <span className="mt-2 block text-[11px] text-slate-400">更新于 {formatDate(item.updatedAt)}</span>
              </span>
              <ChevronRight size={17} className={`mt-1 shrink-0 ${selected ? 'text-ocean-600' : 'text-slate-300'}`} />
            </div>
          </button>
        )
      })}
    </div>
  )
}

const severityTone = {
  低: 'bg-emerald-50 text-emerald-700',
  中: 'bg-amber-50 text-amber-700',
  高: 'bg-rose-50 text-rose-700',
}

const severityBadge = {
  低: 'bg-emerald-100 text-emerald-700',
  中: 'bg-amber-100 text-amber-700',
  高: 'bg-rose-100 text-rose-700',
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN')
}
