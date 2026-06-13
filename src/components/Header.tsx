import { Cpu, LogOut, Menu, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { appModules, type AppModuleId } from '../app/modules'
import {
  USER_SIGN_OUT_REQUEST_EVENT,
  UserSyncStatus,
} from './auth/UserSyncStatus'

type Props = {
  activeModule: AppModuleId
  onModuleChange: (moduleId: AppModuleId) => void
}

export function Header({ activeModule, onModuleChange }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isTaxSpace = activeModule === 'tax-question-bank'
  const currentSpace = isTaxSpace ? '税务师学习空间' : 'OceanBase DBA 空间'

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [activeModule])

  function openModule(moduleId: AppModuleId) {
    setMobileMenuOpen(false)
    onModuleChange(moduleId)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-[1920px] items-center gap-2 px-3 sm:min-h-16 sm:gap-3 sm:px-5">
        <div className="flex min-w-0 shrink-0 items-center gap-3">
          <div className={`grid h-9 w-9 place-items-center rounded-md text-white shadow-node sm:h-10 sm:w-10 ${
            isTaxSpace ? 'bg-emerald-600' : 'bg-ocean-600'
          }`}>
            <Cpu size={20} />
          </div>
          <div className="min-w-0 sm:hidden">
            <p className="max-w-32 truncate text-sm font-semibold text-ink">{currentSpace}</p>
            <p className="max-w-32 truncate text-[10px] text-slate-400">
              {appModules.find((module) => module.id === activeModule)?.shortName ?? '工作台'}
            </p>
          </div>
          <div className="hidden min-w-0 sm:block">
            <h1 className="truncate text-base font-semibold tracking-normal text-ink lg:text-lg">OB Architecture Studio</h1>
            <p className="hidden truncate text-xs text-slate-500 lg:block">OceanBase 学习与架构分析工作台</p>
          </div>
        </div>

        <nav className="ml-1 hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:ml-4 sm:flex">
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

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            title="全局搜索"
            onClick={() => openModule('search')}
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
          <button
            type="button"
            title={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((value) => !value)}
            className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 sm:hidden"
          >
            {mobileMenuOpen ? <X size={17} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white p-3 shadow-lg sm:hidden">
          <div className="grid grid-cols-2 gap-2">
            <MobileMenuButton
              label="OceanBase DBA 空间"
              active={!isTaxSpace && activeModule === 'dashboard'}
              onClick={() => openModule('dashboard')}
            />
            <MobileMenuButton
              label="税务师学习空间"
              active={isTaxSpace}
              onClick={() => openModule('tax-question-bank')}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
            {[
              ['question-bank', 'OBCP 题库'],
              ['tax-question-bank', '税务师题库'],
              ['review', '学习复盘'],
              ['learning-plan', '学习计划'],
            ].map(([id, label]) => (
              <MobileMenuButton
                key={id}
                label={label}
                active={activeModule === id}
                onClick={() => openModule(id as AppModuleId)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false)
              window.dispatchEvent(new CustomEvent(USER_SIGN_OUT_REQUEST_EVENT))
            }}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-md border border-rose-200 text-sm font-semibold text-rose-600"
          >
            <LogOut size={16} />退出登录
          </button>
        </div>
      )}
    </header>
  )
}

function MobileMenuButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 rounded-md border px-3 text-left text-sm font-semibold ${
        active
          ? 'border-ocean-300 bg-ocean-50 text-ocean-700'
          : 'border-slate-200 text-slate-600'
      }`}
    >
      {label}
    </button>
  )
}
