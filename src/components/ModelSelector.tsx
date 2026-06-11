import { motion } from 'framer-motion'
import type { ArchitectureModel } from '../data/types'

type Props = {
  models: ArchitectureModel[]
  activeModelId: string
  onSelect: (modelId: string) => void
}

export function ModelSelector({ models, activeModelId, onSelect }: Props) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">Architecture Models</p>
          <h2 className="mt-1 text-base font-semibold text-ink">架构模型</h2>
        </div>
        <span className="hidden text-xs text-slate-400 sm:block">选择模型以切换拓扑与诊断上下文</span>
      </div>
      <nav className="flex gap-2 overflow-x-auto pb-1">
        {models.map((model) => {
          const Icon = model.icon
          const isActive = model.id === activeModelId
          return (
            <motion.button
              key={model.id}
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(model.id)}
              className={`group flex min-h-16 w-56 shrink-0 items-center gap-3 rounded-md border px-3 py-2 text-left transition ${
                isActive
                  ? 'border-ocean-500 bg-ocean-50 text-ocean-700 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-ocean-200 hover:bg-slate-50'
              }`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${
                isActive ? 'bg-ocean-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-ocean-100 group-hover:text-ocean-600'
              }`}>
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{model.name}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">{model.subtitle}</span>
              </span>
            </motion.button>
          )
        })}
      </nav>
    </section>
  )
}
