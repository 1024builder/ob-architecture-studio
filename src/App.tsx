import { useEffect, useState } from 'react'
import { AppShell } from './app/AppShell'
import { appModules, getModuleFromHash, type AppModuleId } from './app/modules'
import { ArchitecturePage } from './pages/ArchitecturePage'
import { QuestionBankPage } from './pages/QuestionBankPage'

function App() {
  const [activeModule, setActiveModule] = useState<AppModuleId>(() => getModuleFromHash(window.location.hash))

  useEffect(() => {
    const handleHashChange = () => setActiveModule(getModuleFromHash(window.location.hash))
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  function handleModuleChange(moduleId: AppModuleId) {
    window.location.hash = appModules.find((module) => module.id === moduleId)?.path ?? '#/architecture'
    setActiveModule(moduleId)
  }

  return (
    <AppShell activeModule={activeModule} onModuleChange={handleModuleChange}>
      {activeModule === 'architecture' ? <ArchitecturePage /> : <QuestionBankPage />}
    </AppShell>
  )
}

export default App
