import { useCallback, useEffect, useState } from 'react'
import type { ArchitectureNavigationRequest } from './app/architectureNavigation'
import type { CaseNavigationRequest, QuestionNavigationRequest } from './app/contentNavigation'
import { AppShell } from './app/AppShell'
import { appModules, getModuleFromHash, type AppModuleId } from './app/modules'
import { ArchitecturePage } from './pages/ArchitecturePage'
import { DashboardPage } from './pages/DashboardPage'
import { LearningPlanPage } from './pages/LearningPlanPage'
import { QuestionBankPage } from './pages/QuestionBankPage'
import { ReviewCenterPage } from './pages/ReviewCenterPage'
import { SearchPage } from './pages/SearchPage'
import { TaxQuestionBankPage } from './pages/TaxQuestionBankPage'
import { TroubleshootingPage } from './pages/TroubleshootingPage'
import type { GlobalSearchResult } from './services/globalSearchService'
import type { LearningTaskTarget } from './services/learningPlanService'

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

  function handleReviewQuestions(
    questionIds: string[],
    sourceLabel: string,
    mode?: QuestionNavigationRequest['mode'],
  ) {
    setQuestionRequest({
      questionIds,
      sourceLabel,
      mode,
      requestId: Date.now(),
    })
    handleModuleChange('question-bank')
  }

  function handleReviewArchitecture(modelId: string, componentName?: string) {
    setArchitectureRequest({
      modelId,
      componentName,
      requestId: Date.now(),
    })
    handleModuleChange('architecture')
  }

  function handleReviewCase(caseId: string) {
    setCaseRequest({ caseId, requestId: Date.now() })
    handleModuleChange('troubleshooting')
  }

  function handleLearningTask(target: LearningTaskTarget) {
    if (target.kind === 'questions') {
      handleReviewQuestions(target.questionIds, target.sourceLabel, target.mode)
      return
    }
    if (target.kind === 'architecture') {
      handleReviewArchitecture(target.modelId, target.componentName)
      return
    }
    if (target.kind === 'case') {
      handleReviewCase(target.caseId)
      return
    }
    handleGlobalSearch(target.query)
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
        ) : activeModule === 'review' ? (
          <ReviewCenterPage
            onPracticeQuestions={handleReviewQuestions}
            onViewArchitecture={handleReviewArchitecture}
            onViewCase={handleReviewCase}
            onGlobalSearch={handleGlobalSearch}
            onLearningPlan={() => handleModuleChange('learning-plan')}
          />
        ) : activeModule === 'learning-plan' ? (
          <LearningPlanPage onStartTask={handleLearningTask} />
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
        ) : activeModule === 'tax-question-bank' ? (
          <TaxQuestionBankPage />
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
