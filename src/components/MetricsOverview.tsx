import { Activity, GitCommitHorizontal, Layers3, MousePointer2 } from 'lucide-react'
import type { ArchitectureModel, TopologyNode } from '../data/types'

type Props = {
  model: ArchitectureModel
  selectedNode: TopologyNode
}

export function MetricsOverview({ model, selectedNode }: Props) {
  const metrics = [
    { label: '拓扑节点', value: model.nodes.length, suffix: '个', icon: Layers3, tone: 'bg-ocean-50 text-ocean-600' },
    { label: '逻辑链路', value: model.links.length, suffix: '条', icon: GitCommitHorizontal, tone: 'bg-violet-50 text-violet-600' },
    { label: '组件类型', value: new Set(model.nodes.map((node) => node.kind)).size, suffix: '类', icon: Activity, tone: 'bg-emerald-50 text-emerald-600' },
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, suffix, icon: Icon, tone }) => (
        <div key={label} className="flex min-h-20 items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${tone}`}><Icon size={19} /></span>
          <div>
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-ink">{value}<span className="ml-1 text-xs font-medium text-slate-400">{suffix}</span></p>
          </div>
        </div>
      ))}
      <div className="flex min-h-20 min-w-0 items-center gap-3 rounded-md border border-ocean-200 bg-ocean-50 px-4 py-3 shadow-sm">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-ocean-600 text-white"><MousePointer2 size={19} /></span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-ocean-700">当前选中</p>
          <p className="mt-1 truncate text-sm font-semibold text-ink">{selectedNode.label}</p>
        </div>
      </div>
    </section>
  )
}
