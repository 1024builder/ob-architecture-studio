import { Activity, Cpu } from 'lucide-react'
import { appModules, type AppModuleId } from '../app/modules'

type Props = {
  activeModule: AppModuleId
  onModuleChange: (moduleId: AppModuleId) => void
}

export function Header({ activeModule, onModuleChange }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-[1920px] items-center gap-3 px-3 sm:px-5">
        <div className="flex min-w-0 shrink-0 items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-ocean-600 text-white shadow-node">
            <Cpu size={22} />
          </div>
          <div className="hidden min-w-0 sm:block">
            <h1 className="truncate text-base font-semibold tracking-normal text-ink lg:text-lg">OB Architecture Studio</h1>
            <p className="hidden truncate text-xs text-slate-500 lg:block">OceanBase 学习与架构分析工作台</p>
          </div>
        </div>

        <nav className="ml-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:ml-4">
          {appModules.map((module) => {
            const Icon = module.icon
            const isActive = activeModule === module.id
            return (
              <button
                key={module.id}
                type="button"
                onClick={() => onModuleChange(module.id)}
                className={`flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                  isActive ? 'bg-ocean-50 text-ocean-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon size={17} />
                <span>{module.shortName}</span>
              </button>
            )
          })}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 md:flex">
          <Activity size={16} />
          <span>Learning Lab</span>
        </div>
      </div>
    </header>
  )
}
