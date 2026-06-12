import { useCallback, useEffect, useState } from 'react'
import type { ArchitectureNavigationRequest } from './app/architectureNavigation'
import type { CaseNavigationRequest, QuestionNavigationRequest } from './app/contentNavigation'
import { AppShell } from './app/AppShell'
import { appModules, getModuleFromHash, type AppModuleId } from './app/modules'
import { ArchitecturePage } from './pages/ArchitecturePage'
import { DashboardPage } from './pages/DashboardPage'
import { QuestionBankPage } from './pages/QuestionBankPage'
import { SearchPage } from './pages/SearchPage'
import { TroubleshootingPage } from './pages/TroubleshootingPage'
import type { GlobalSearchResult } from './services/globalSearchService'

function App() {
  const [activeModule, setActiveModule] = useState<AppModuleId>(() => getModuleFromHash(window.location.hash))
  const [architectureRequest, setArchitectureRequest] = useState<ArchitectureNavigationRequest | null>(null)
  const [questionRequest, setQuestionRequest] = useState<QuestionNavigationRequest | null>(null)
  const [caseRequest, setCaseRequest] = useState<CaseNavigationRequest | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const handleHashChange = () => setActiveModule(getModuleFromHash(window.location.hash))
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  function handleModuleChange(moduleId: AppModuleId) {
    window.location.hash = appModules.find((module) => module.id === moduleId)?.path ?? '#/dashboard'
    setActiveModule(moduleId)
  }

  function handleArchitectureComponent(componentName: string) {
    setArchitectureRequest({ componentName, requestId: Date.now() })
    handleModuleChange('architecture')
  }

  function handleGlobalSearch(query = '') {
    setSearchQuery(query)
    handleModuleChange('search')
  }

  function handleSearchResult(result: GlobalSearchResult) {
    if (result.target.questionId) {
      setQuestionRequest({
        questionId: result.target.questionId,
        requestId: Date.now(),
      })
      handleModuleChange('question-bank')
      return
    }
    if (result.target.caseId) {
      setCaseRequest({ caseId: result.target.caseId, requestId: Date.now() })
      handleModuleChange('troubleshooting')
      return
    }
    if (result.target.modelId || result.target.componentName) {
      setArchitectureRequest({
        modelId: result.target.modelId,
        nodeId: result.target.nodeId,
        componentName: result.target.componentName,
        requestId: Date.now(),
      })
      handleModuleChange('architecture')
    }
  }

  const handleArchitectureNavigationHandled = useCallback(() => {
    setArchitectureRequest(null)
  }, [])
  const handleQuestionNavigationHandled = useCallback(() => {
    setQuestionRequest(null)
  }, [])
  const handleCaseNavigationHandled = useCallback(() => {
    setCaseRequest(null)
  }, [])

  return (
    <AppShell activeModule={activeModule} onModuleChange={handleModuleChange}>
      {activeModule === 'dashboard' ? (
          <DashboardPage
            onModuleChange={handleModuleChange}
            onGlobalSearch={handleGlobalSearch}
          />
        ) : activeModule === 'search' ? (
          <SearchPage
            initialQuery={searchQuery}
            onOpenResult={handleSearchResult}
          />
        ) : activeModule === 'architecture' ? (
          <ArchitecturePage
            navigationRequest={architectureRequest}
            onNavigationHandled={handleArchitectureNavigationHandled}
          />
        ) : activeModule === 'question-bank' ? (
          <QuestionBankPage
            navigationRequest={questionRequest}
            onNavigationHandled={handleQuestionNavigationHandled}
            onViewArchitectureComponent={handleArchitectureComponent}
          />
        ) : (
          <TroubleshootingPage
            navigationRequest={caseRequest}
            onNavigationHandled={handleCaseNavigationHandled}
            onViewArchitectureComponent={handleArchitectureComponent}
          />
        )}
    </AppShell>
  )
}

export default App
