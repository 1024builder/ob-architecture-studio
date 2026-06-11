import { useMemo, useState } from 'react'
import { QuestionBankManager } from '../components/obcp/QuestionBankManager'
import { QuestionPractice } from '../components/obcp/QuestionPractice'
import { LearningDiagnosisReport } from '../components/obcp/LearningDiagnosisReport'
import { obcpQuestions } from '../data/obcpQuestions'
import type { ObcpAnswerRecord, ObcpPracticeMode, ObcpQuestion } from '../data/obcpTypes'
import { QuestionBankOverview } from '../features/question-bank/QuestionBankOverview'
import { calculateObcpAnalytics } from '../utils/obcpAnalytics'
import {
  clearCustomObcpQuestions,
  loadCustomObcpQuestions,
  mergeObcpQuestions,
  saveCustomObcpQuestions,
} from '../utils/obcpQuestionImportExport'
import {
  appendAnswerRecords,
  loadObcpUserState,
  saveObcpUserState,
  toggleFavorite,
  toggleNotUnderstood,
  toggleWrongBook,
} from '../utils/obcpStorage'

const CURRENT_USER_ID = 'local-user'

type ActivePractice = {
  mode: ObcpPracticeMode
  questions: ObcpQuestion[]
  sourceLabel: string
}

type Props = {
  onViewArchitectureComponent: (componentName: string) => void
}

export function QuestionBankPage({ onViewArchitectureComponent }: Props) {
  const [userState, setUserState] = useState(() => loadObcpUserState(CURRENT_USER_ID))
  const [customQuestions, setCustomQuestions] = useState(loadCustomObcpQuestions)
  const [activePractice, setActivePractice] = useState<ActivePractice | null>(null)
  const [diagnosisOpen, setDiagnosisOpen] = useState(false)
  const [managerMode, setManagerMode] = useState<'manage' | 'import' | null>(null)
  const allQuestions = useMemo(
    () => mergeObcpQuestions(obcpQuestions, customQuestions),
    [customQuestions],
  )
  const analytics = useMemo(
    () => calculateObcpAnalytics(userState, allQuestions),
    [userState, allQuestions],
  )

  function updateUserState(updater: (current: typeof userState) => typeof userState) {
    setUserState((current) => {
      const next = updater(current)
      saveObcpUserState(next)
      return next
    })
  }

  function startPractice(mode: ObcpPracticeMode, chapter?: string, questionIds?: string[]) {
    const allowedQuestionIds = questionIds ? new Set(questionIds) : null
    let questions = allQuestions.filter((question) =>
      (!chapter || question.chapter === chapter)
      && (!allowedQuestionIds || allowedQuestionIds.has(question.questionId)),
    )
    if (mode === 'random') questions = shuffle(questions).slice(0, Math.min(10, questions.length))
    if (mode === 'exam') questions = shuffle(questions).slice(0, Math.min(12, questions.length))
    if (mode === 'wrongBook') questions = allQuestions.filter((question) => userState.wrongBookQuestionIds.includes(question.questionId))
    if (mode === 'favorite') questions = allQuestions.filter((question) => userState.favoriteQuestionIds.includes(question.questionId))
    if (!questions.length) return false
    setActivePractice({
      mode,
      questions,
      sourceLabel: getPracticeSourceLabel(mode, chapter, !!questionIds),
    })
    return true
  }

  function recordAnswers(records: ObcpAnswerRecord[]) {
    updateUserState((current) => appendAnswerRecords(current, records))
  }

  if (activePractice) {
    return (
      <div className="p-3 sm:p-4 lg:p-5">
        <QuestionPractice
          userState={userState}
          questions={activePractice.questions}
          mode={activePractice.mode}
          sourceLabel={activePractice.sourceLabel}
          onRecords={recordAnswers}
          onToggleFavorite={(questionId) => updateUserState((current) => toggleFavorite(current, questionId))}
          onToggleWrongBook={(questionId) => updateUserState((current) => toggleWrongBook(current, questionId))}
          onToggleNotUnderstood={(questionId) => updateUserState((current) => toggleNotUnderstood(current, questionId))}
          onRetryWrong={(questionIds) => {
            const wrongQuestions = allQuestions.filter((question) => questionIds.includes(question.questionId))
            if (wrongQuestions.length) setActivePractice({ mode: 'wrongBook', questions: wrongQuestions, sourceLabel: '本次练习错题' })
          }}
          onViewDiagnosis={() => setDiagnosisOpen(true)}
          onViewArchitectureComponent={onViewArchitectureComponent}
          onClose={() => setActivePractice(null)}
        />
        {diagnosisOpen && <LearningDiagnosisReport analytics={analytics} onClose={() => setDiagnosisOpen(false)} onViewArchitectureComponent={onViewArchitectureComponent} />}
      </div>
    )
  }

  return (
    <>
    <QuestionBankOverview
      analytics={analytics}
      questions={allQuestions}
      wrongBookCount={userState.wrongBookQuestionIds.filter((id) => allQuestions.some((question) => question.questionId === id)).length}
      favoriteCount={userState.favoriteQuestionIds.filter((id) => allQuestions.some((question) => question.questionId === id)).length}
      onStartPractice={startPractice}
      onViewArchitectureComponent={onViewArchitectureComponent}
      onOpenQuestionBankManager={() => setManagerMode('manage')}
      onImportQuestionBank={() => setManagerMode('import')}
    />
    {managerMode && (
      <QuestionBankManager
        builtInQuestions={obcpQuestions}
        customQuestions={customQuestions}
        allQuestions={allQuestions}
        onImport={(questions) => {
          const next = [...customQuestions, ...questions]
          saveCustomObcpQuestions(next)
          setCustomQuestions(next)
        }}
        onClearCustom={() => {
          clearCustomObcpQuestions()
          setCustomQuestions([])
        }}
        autoOpenImport={managerMode === 'import'}
        onClose={() => setManagerMode(null)}
      />
    )}
    </>
  )
}

function getPracticeSourceLabel(mode: ObcpPracticeMode, chapter?: string, isSearchResult = false) {
  if (isSearchResult) return chapter ? `搜索结果 · ${chapter}` : '搜索结果'
  if (mode === 'favorite') return '收藏题目'
  if (mode === 'wrongBook') return '重做错题'
  if (mode === 'random') return '全题库随机组题'
  if (mode === 'exam') return '模拟考试'
  return chapter ?? '全部章节'
}

function shuffle<T>(items: T[]) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}
