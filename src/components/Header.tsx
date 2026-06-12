import { Cpu, Search } from 'lucide-react'
import { appModules, type AppModuleId } from '../app/modules'
import { UserSyncStatus } from './auth/UserSyncStatus'

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
          {appModules.filter((module) => module.id !== 'search').map((module) => {
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

        <button
          type="button"
          title="全局搜索"
          onClick={() => onModuleChange('search')}
          className={`flex h-9 shrink-0 items-center gap-2 rounded-md border px-2.5 text-xs font-semibold transition sm:px-3 ${
            activeModule === 'search'
              ? 'border-ocean-200 bg-ocean-50 text-ocean-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-ocean-300 hover:text-ocean-700'
          }`}
        >
          <Search size={15} />
          <span className="hidden xl:inline">全局搜索</span>
        </button>
        <UserSyncStatus />
      </div>
    </header>
  )
}
