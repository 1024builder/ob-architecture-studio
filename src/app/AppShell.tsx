import type { ReactNode } from 'react'
import { Header } from '../components/Header'
import type { AppModuleId } from './modules'

type Props = {
  activeModule: AppModuleId
  onModuleChange: (moduleId: AppModuleId) => void
  children: ReactNode
}

export function AppShell({ activeModule, onModuleChange, children }: Props) {
  return (
    <div className="min-h-screen bg-[#f4f7fa] text-ink">
      <Header activeModule={activeModule} onModuleChange={onModuleChange} />
      <main className="mx-auto w-full max-w-[1920px]">{children}</main>
    </div>
  )
}
