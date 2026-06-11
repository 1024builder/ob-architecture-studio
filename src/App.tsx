import { useCallback, useEffect, useState } from 'react'
import type { ArchitectureNavigationRequest } from './app/architectureNavigation'
import { AppShell } from './app/AppShell'
import { appModules, getModuleFromHash, type AppModuleId } from './app/modules'
import { ArchitecturePage } from './pages/ArchitecturePage'
import { QuestionBankPage } from './pages/QuestionBankPage'

function App() {
  const [activeModule, setActiveModule] = useState<AppModuleId>(() => getModuleFromHash(window.location.hash))
  const [architectureRequest, setArchitectureRequest] = useState<ArchitectureNavigationRequest | null>(null)

  useEffect(() => {
    const handleHashChange = () => setActiveModule(getModuleFromHash(window.location.hash))
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  function handleModuleChange(moduleId: AppModuleId) {
    window.location.hash = appModules.find((module) => module.id === moduleId)?.path ?? '#/architecture'
    setActiveModule(moduleId)
  }

  function handleArchitectureComponent(componentName: string) {
    setArchitectureRequest({ componentName, requestId: Date.now() })
    handleModuleChange('architecture')
  }

  const handleArchitectureNavigationHandled = useCallback(() => {
    setArchitectureRequest(null)
  }, [])

  return (
    <AppShell activeModule={activeModule} onModuleChange={handleModuleChange}>
      {activeModule === 'architecture'
        ? (
          <ArchitecturePage
            navigationRequest={architectureRequest}
            onNavigationHandled={handleArchitectureNavigationHandled}
          />
        )
        : <QuestionBankPage onViewArchitectureComponent={handleArchitectureComponent} />}
    </AppShell>
  )
}

export default App
