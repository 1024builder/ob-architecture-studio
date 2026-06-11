import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Brain,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  FileSearch,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type {
  ObcpAnswerRecord,
  ObcpPracticeMode,
  ObcpPracticeQuestionState,
  ObcpPracticeSession,
  ObcpQuestion,
  ObcpUserState,
} from '../../data/obcpTypes'
import { QuestionNavigator } from './QuestionNavigator'

type Props = {
  userState: ObcpUserState
  questions: ObcpQuestion[]
  mode: ObcpPracticeMode
  sourceLabel: string
  onRecords: (records: ObcpAnswerRecord[]) => void
  onToggleFavorite: (questionId: string) => void
  onToggleWrongBook: (questionId: string) => void
  onToggleNotUnderstood: (questionId: string) => void
  onRetryWrong: (questionIds: string[]) => void
  onViewDiagnosis: () => void
  onViewArchitectureComponent: (componentName: string) => void
  onSessionComplete: (session: ObcpPracticeSession) => void
  onClose: () => void
}

export function QuestionPractice({
  userState,
  questions,
  mode,
  sourceLabel,
  onRecords,
  onToggleFavorite,
  onToggleWrongBook,
  onToggleNotUnderstood,
  onRetryWrong,
  onViewDiagnosis,
  onViewArchitectureComponent,
  onSessionComplete,
  onClose,
}: Props) {
  const [index, setIndex] = useState(0)
  const [questionStates, setQuestionStates] = useState<Record<string, ObcpPracticeQuestionState>>(
    () => createInitialStates(questions),
  )
  const [examRecords, setExamRecords] = useState<ObcpAnswerRecord[]>([])
  const [examCompleted, setExamCompleted] = useState(false)
  const [practiceCompleted, setPracticeCompleted] = useState(false)
  const [examConfirmOpen, setExamConfirmOpen] = useState(false)
  const sessionStartedAt = useRef(new Date().toISOString())
  const startedAtByQuestion = useRef<Record<string, number>>({ [questions[0].questionId]: Date.now() })
  const question = questions[index]
  const currentState = questionStates[question.questionId]
  const selected = currentState.selectedAnswer
  const submitted = currentState.submitted
  const isExam = mode === 'exam'
  const isFavorite = userState.favoriteQuestionIds.includes(question.questionId)
  const isWrongBook = userState.wrongBookQuestionIds.includes(question.questionId)
  const isNotUnderstood = userState.notUnderstoodQuestionIds.includes(question.questionId)
  const title = practiceTitle(mode)
  const unansweredNumbers = questions
    .map((item, questionIndex) => questionStates[item.questionId].selectedAnswer.length ? null : questionIndex + 1)
    .filter((value): value is number => value !== null)

  useEffect(() => {
    startedAtByQuestion.current[question.questionId] ??= Date.now()
  }, [question.questionId])

  function goToQuestion(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= questions.length) return
    startedAtByQuestion.current[questions[nextIndex].questionId] ??= Date.now()
    setIndex(nextIndex)
  }

  function selectOption(optionId: string) {
    if (examCompleted) return
    setQuestionStates((current) => {
      const state = current[question.questionId]
      const nextSelection = question.type === 'multiple'
        ? state.selectedAnswer.includes(optionId)
          ? state.selectedAnswer.filter((item) => item !== optionId)
          : [...state.selectedAnswer, optionId]
        : [optionId]
      return {
        ...current,
        [question.questionId]: {
          selectedAnswer: nextSelection,
          submitted: false,
          isCorrect: undefined,
        },
      }
    })
  }

  function createRecord(targetQuestion: ObcpQuestion, state: ObcpPracticeQuestionState): ObcpAnswerRecord {
    const correct = answersEqual(state.selectedAnswer, targetQuestion.answer)
    return {
      id: `${userState.userId}-${targetQuestion.questionId}-${Date.now()}`,
      userId: userState.userId,
      questionId: targetQuestion.questionId,
      selectedAnswer: [...state.selectedAnswer].sort(),
      correctAnswer: [...targetQuestion.answer].sort(),
      isCorrect: correct,
      durationSeconds: Math.max(1, Math.round((Date.now() - (startedAtByQuestion.current[targetQuestion.questionId] ?? Date.now())) / 1000)),
      answeredAt: new Date().toISOString(),
      chapter: targetQuestion.chapter,
      knowledgePoints: targetQuestion.knowledgePoints,
      difficulty: targetQuestion.difficulty,
      questionType: targetQuestion.type,
      isFavorite: userState.favoriteQuestionIds.includes(targetQuestion.questionId),
      isWrongBook: !correct,
      retryCount: userState.records.filter((record) => record.questionId === targetQuestion.questionId).length,
      isNotUnderstood: userState.notUnderstoodQuestionIds.includes(targetQuestion.questionId),
    }
  }

  function submitAnswer() {
    if (!selected.length || submitted || isExam) return
    const record = createRecord(question, currentState)
    onRecords([record])
    setQuestionStates((current) => ({
      ...current,
      [question.questionId]: {
        ...current[question.questionId],
        submitted: true,
        isCorrect: record.isCorrect,
      },
    }))
  }

  function requestSubmitExam() {
    if (unansweredNumbers.length) {
      setExamConfirmOpen(true)
      return
    }
    submitExam()
  }

  function submitExam() {
    if (!isExam || examCompleted) return
    const records = questions.map((item) => createRecord(item, questionStates[item.questionId]))
    onRecords(records)
    onSessionComplete(createSessionSummary(records))
    setExamRecords(records)
    setExamCompleted(true)
  }

  function completePractice() {
    const records = questions.flatMap((item) => {
      const state = questionStates[item.questionId]
      if (!state.submitted) return []
      return [{
        isCorrect: state.isCorrect === true,
      }]
    })
    onSessionComplete(createSessionSummary(records))
    setPracticeCompleted(true)
  }

  function createSessionSummary(records: Array<{ isCorrect: boolean }>): ObcpPracticeSession {
    const completedAt = new Date().toISOString()
    return {
      id: `${userState.userId}-session-${Date.now()}`,
      userId: userState.userId,
      mode,
      sourceLabel,
      questionIds: questions.map((item) => item.questionId),
      answeredCount: records.length,
      correctCount: records.filter((record) => record.isCorrect).length,
      startedAt: sessionStartedAt.current,
      completedAt,
      syncStatus: 'pending',
    }
  }

  if (practiceCompleted) {
    return (
      <PracticeSummary
        questions={questions}
        states={questionStates}
        userState={userState}
        onClose={onClose}
        onRetryWrong={onRetryWrong}
        onViewDiagnosis={onViewDiagnosis}
        onViewArchitectureComponent={onViewArchitectureComponent}
        onReviewQuestion={(questionIndex) => {
          goToQuestion(questionIndex)
          setPracticeCompleted(false)
        }}
      />
    )
  }

  if (examCompleted) {
    return (
      <ExamResults
        questions={questions}
        records={examRecords}
        userState={userState}
        title={title}
        sourceLabel={sourceLabel}
        onClose={onClose}
        onViewArchitectureComponent={onViewArchitectureComponent}
      />
    )
  }

  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col lg:flex-row">
        <QuestionNavigator
          title={title}
          sourceLabel={sourceLabel}
          questions={questions}
          currentIndex={index}
          states={questionStates}
          userState={userState}
          hideCorrectness={isExam}
          onSelect={goToQuestion}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-3">
              <button type="button" title="返回题库" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-500 hover:text-ocean-600">
                <ArrowLeft size={17} />
              </button>
              <div>
                <p className="text-xs font-semibold uppercase text-ocean-600">{title}</p>
                <p className="text-sm font-semibold text-ink">{question.chapter}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-500">{index + 1} / {questions.length}</span>
              <button
                type="button"
                title={isFavorite ? '取消收藏' : '收藏题目'}
                onClick={() => onToggleFavorite(question.questionId)}
                className={`grid h-9 w-9 place-items-center rounded-md border transition ${isFavorite ? 'border-violet-300 bg-violet-50 text-violet-600' : 'border-slate-200 text-slate-500 hover:text-violet-600'}`}
              >
                <Bookmark size={17} fill={isFavorite ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>

          <div className="h-1 bg-slate-100">
            <div className="h-full bg-ocean-500 transition-all" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
          </div>

          <div className="mx-auto max-w-4xl p-4 sm:p-6">
            {isExam && (
              <div className="mb-4 flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                <CircleAlert size={15} />
                模拟考试期间只保存选择，不显示答案和解析；可通过题号导航返回修改。
              </div>
            )}
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="rounded-md bg-ocean-50 px-2 py-1 text-xs font-semibold text-ocean-700">{questionTypeLabel(question.type)}</span>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{question.difficulty}</span>
              {question.knowledgePoints.map((point) => <span key={point} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500">{point}</span>)}
            </div>
            <h2 className="text-lg font-semibold leading-8 text-ink">{question.stem}</h2>

            <div className="mt-5 grid gap-3">
              {question.options.map((option) => {
                const chosen = selected.includes(option.id)
                const showFeedback = submitted && !isExam
                const correctOption = showFeedback && question.answer.includes(option.id)
                const wrongChosen = showFeedback && chosen && !question.answer.includes(option.id)
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => selectOption(option.id)}
                    className={`flex min-h-14 items-center gap-3 rounded-md border px-4 py-3 text-left transition ${
                      correctOption
                        ? 'border-emerald-400 bg-emerald-50'
                        : wrongChosen
                          ? 'border-rose-400 bg-rose-50'
                          : chosen
                            ? 'border-ocean-500 bg-ocean-50'
                            : 'border-slate-200 hover:border-ocean-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs font-bold ${chosen ? 'bg-ocean-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{option.label}</span>
                    <span className="text-sm text-slate-700">{option.text}</span>
                  </button>
                )
              })}
            </div>

            {submitted && !isExam && (
              <AnswerFeedback question={question} selected={selected} isCorrect={currentState.isCorrect === true} onViewArchitectureComponent={onViewArchitectureComponent} />
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onToggleWrongBook(question.questionId)}
                  className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${isWrongBook ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600 hover:border-amber-300'}`}
                >
                  <RotateCcw size={16} />
                  {isWrongBook ? '移出错题本' : '加入错题本'}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleNotUnderstood(question.questionId)}
                  className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${isNotUnderstood ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-600 hover:border-rose-300'}`}
                >
                  <Brain size={16} />
                  {isNotUnderstood ? '已标记不理解' : '我不理解'}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={index === 0} onClick={() => goToQuestion(index - 1)} className="flex h-10 items-center gap-1 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:border-ocean-300 disabled:cursor-not-allowed disabled:opacity-40">
                  <ChevronLeft size={16} />上一题
                </button>
                {!isExam && (
                  <button type="button" disabled={!selected.length || submitted} onClick={submitAnswer} className="h-10 rounded-md bg-ocean-600 px-4 text-sm font-semibold text-white transition hover:bg-ocean-700 disabled:cursor-not-allowed disabled:opacity-40">
                    {submitted ? '已提交' : '提交答案'}
                  </button>
                )}
                {isExam && index === questions.length - 1 ? (
                  <button type="button" onClick={requestSubmitExam} className="h-10 rounded-md bg-ocean-600 px-4 text-sm font-semibold text-white hover:bg-ocean-700">
                    提交试卷
                  </button>
                ) : (
                  <button type="button" onClick={() => index < questions.length - 1 ? goToQuestion(index + 1) : completePractice()} className="flex h-10 items-center gap-1 rounded-md bg-ocean-600 px-4 text-sm font-semibold text-white hover:bg-ocean-700">
                    {index < questions.length - 1 ? '下一题' : '完成练习'}<ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {examConfirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-label="确认提交试卷">
          <div className="w-full max-w-md rounded-md border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-700"><CircleAlert size={19} /><h3 className="text-base font-semibold">仍有未作答题目</h3></div>
            <p className="mt-3 text-sm leading-6 text-slate-600">未答题号：{unansweredNumbers.join('、')}</p>
            <p className="mt-1 text-xs text-slate-400">交卷后将按未答处理，并统一生成考试结果。</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setExamConfirmOpen(false)} className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:border-ocean-300">继续答题</button>
              <button type="button" onClick={() => { setExamConfirmOpen(false); submitExam() }} className="h-9 rounded-md bg-ocean-600 px-3 text-sm font-semibold text-white hover:bg-ocean-700">确认交卷</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function PracticeSummary({
  questions,
  states,
  userState,
  onClose,
  onRetryWrong,
  onViewDiagnosis,
  onReviewQuestion,
  onViewArchitectureComponent,
}: {
  questions: ObcpQuestion[]
  states: Record<string, ObcpPracticeQuestionState>
  userState: ObcpUserState
  onClose: () => void
  onRetryWrong: (questionIds: string[]) => void
  onViewDiagnosis: () => void
  onReviewQuestion: (questionIndex: number) => void
  onViewArchitectureComponent: (componentName: string) => void
}) {
  const submittedStates = questions.map((question) => ({ question, state: states[question.questionId] })).filter(({ state }) => state.submitted)
  const correctCount = submittedStates.filter(({ state }) => state.isCorrect).length
  const wrongQuestionIds = submittedStates.filter(({ state }) => state.isCorrect === false).map(({ question }) => question.questionId)
  const answeredCount = questions.filter((question) => states[question.questionId].selectedAnswer.length).length
  const wrongCount = submittedStates.length - correctCount
  const correctRate = submittedStates.length ? Math.round((correctCount / submittedStates.length) * 100) : 0
  const favoriteCount = questions.filter((question) => userState.favoriteQuestionIds.includes(question.questionId)).length
  const notUnderstoodCount = questions.filter((question) => userState.notUnderstoodQuestionIds.includes(question.questionId)).length
  const wrongItems = submittedStates
    .filter(({ state }) => state.isCorrect === false)
    .map(({ question, state }) => ({
      question,
      questionIndex: questions.findIndex((item) => item.questionId === question.questionId),
      selectedAnswer: state.selectedAnswer,
    }))
  const suggestions = buildNextStepSuggestions(
    submittedStates.map(({ question, state }) => ({ question, isCorrect: state.isCorrect === true })),
  )

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <p className="text-xs font-semibold uppercase text-ocean-600">Practice Summary</p>
      <h2 className="mt-1 text-xl font-semibold text-ink">本次练习完成</h2>
      <p className="mt-2 text-sm text-slate-500">已提交的题目已计入刷题记录与学习诊断。</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMetric label="总题数" value={questions.length} />
        <SummaryMetric label="已答题数" value={answeredCount} />
        <SummaryMetric label="正确数" value={correctCount} tone="good" />
        <SummaryMetric label="错误数" value={wrongCount} tone="bad" />
        <SummaryMetric label="正确率" value={`${correctRate}%`} />
        <SummaryMetric label="收藏数" value={favoriteCount} />
        <SummaryMetric label="我不理解" value={notUnderstoodCount} />
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={onClose} className="h-10 rounded-md bg-ocean-600 px-4 text-sm font-semibold text-white hover:bg-ocean-700">返回题库首页</button>
        <button type="button" disabled={!wrongQuestionIds.length} onClick={() => onRetryWrong(wrongQuestionIds)} className="flex h-10 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-45"><RotateCcw size={16} />重做错题</button>
        <button type="button" onClick={onViewDiagnosis} className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:border-ocean-300 hover:text-ocean-700"><FileSearch size={16} />查看学习诊断</button>
      </div>
      <NextStepSuggestions suggestions={suggestions} />
      <WrongReviewList items={wrongItems} onReview={onReviewQuestion} onViewArchitectureComponent={onViewArchitectureComponent} />
    </section>
  )
}

function SummaryMetric({ label, value, tone }: { label: string; value: string | number; tone?: 'good' | 'bad' }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-xl font-semibold ${tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-rose-700' : 'text-ink'}`}>{value}</p></div>
}

function ExamResults({
  questions,
  records,
  userState,
  title,
  sourceLabel,
  onClose,
  onViewArchitectureComponent,
}: {
  questions: ObcpQuestion[]
  records: ObcpAnswerRecord[]
  userState: ObcpUserState
  title: string
  sourceLabel: string
  onClose: () => void
  onViewArchitectureComponent: (componentName: string) => void
}) {
  const [reviewIndex, setReviewIndex] = useState(0)
  const recordByQuestion = new Map(records.map((record) => [record.questionId, record]))
  const questionStates = Object.fromEntries(records.map((record) => [
    record.questionId,
    { selectedAnswer: record.selectedAnswer, submitted: true, isCorrect: record.isCorrect },
  ]))
  const correctCount = records.filter((record) => record.isCorrect).length
  const correctRate = records.length ? Math.round((correctCount / records.length) * 100) : 0
  const question = questions[reviewIndex]
  const record = recordByQuestion.get(question.questionId)
  const wrongItems = records
    .filter((item) => !item.isCorrect)
    .map((item) => {
      const itemQuestion = questions.find((candidate) => candidate.questionId === item.questionId)!
      return {
        question: itemQuestion,
        questionIndex: questions.findIndex((candidate) => candidate.questionId === item.questionId),
        selectedAnswer: item.selectedAnswer,
      }
    })
  const suggestions = buildNextStepSuggestions(records.map((item) => ({
    question: questions.find((candidate) => candidate.questionId === item.questionId)!,
    isCorrect: item.isCorrect,
  })))

  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col lg:flex-row">
        <QuestionNavigator
          title={title}
          sourceLabel={sourceLabel}
          questions={questions}
          currentIndex={reviewIndex}
          states={questionStates}
          userState={userState}
          onSelect={setReviewIndex}
        />
        <div className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase text-ocean-600">Exam Results</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">模拟考试结果</h2>
              <p className="mt-2 text-sm text-slate-600">答对 {correctCount} / {records.length} 题，正确率 {correctRate}%</p>
            </div>
            <button type="button" onClick={onClose} className="flex h-10 items-center gap-2 rounded-md bg-ocean-600 px-4 text-sm font-semibold text-white hover:bg-ocean-700">
              返回题库<ArrowRight size={16} />
            </button>
          </div>
          {record && (
            <div className="mx-auto mt-5 max-w-4xl">
              <p className="text-xs font-semibold text-slate-400">第 {reviewIndex + 1} 题 · {question.chapter}</p>
              <h3 className="mt-2 text-lg font-semibold leading-8 text-ink">{question.stem}</h3>
              <AnswerFeedback question={question} selected={record.selectedAnswer} isCorrect={record.isCorrect} onViewArchitectureComponent={onViewArchitectureComponent} />
            </div>
          )}
          <div className="mx-auto max-w-4xl">
            <NextStepSuggestions suggestions={suggestions} />
            <WrongReviewList items={wrongItems} onReview={setReviewIndex} onViewArchitectureComponent={onViewArchitectureComponent} />
          </div>
        </div>
      </div>
    </section>
  )
}

type WrongReviewItem = {
  question: ObcpQuestion
  questionIndex: number
  selectedAnswer: string[]
}

function WrongReviewList({
  items,
  onReview,
  onViewArchitectureComponent,
}: {
  items: WrongReviewItem[]
  onReview: (questionIndex: number) => void
  onViewArchitectureComponent: (componentName: string) => void
}) {
  return (
    <section className="mt-6 border-t border-slate-200 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-rose-600">Wrong Answer Review</p>
          <h3 className="mt-1 text-base font-semibold text-ink">错题复盘列表</h3>
        </div>
        <span className="text-xs text-slate-400">{items.length} 道错题</span>
      </div>
      {items.length ? (
        <div className="mt-3 space-y-3">
          {items.map(({ question, questionIndex, selectedAnswer }) => (
            <article key={question.questionId} className="rounded-md border border-rose-100 bg-rose-50/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-rose-700">第 {questionIndex + 1} 题</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-ink">{truncateText(question.stem, 88)}</p>
                </div>
                <button type="button" onClick={() => onReview(questionIndex)} className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 hover:border-rose-400">
                  回到本题查看<ArrowRight size={14} />
                </button>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                <p><span className="font-semibold text-slate-700">用户答案：</span>{answerText(question, selectedAnswer) || '未作答'}</p>
                <p><span className="font-semibold text-slate-700">正确答案：</span>{answerText(question, question.answer)}</p>
              </div>
              <div className="mt-3 space-y-1 border-t border-rose-100 pt-3 text-xs leading-5 text-slate-600">
                <p><span className="font-semibold text-slate-700">知识点：</span>{question.knowledgePoints.join('、')}</p>
                <p><span className="font-semibold text-slate-700">常见误区：</span>{question.commonMistakes.join('；') || '暂无'}</p>
                <p><span className="font-semibold text-slate-700">复习建议：</span>{question.reviewSuggestion}</p>
                {!!question.relatedComponents.length && (
                  <div className="pt-1">
                    <p className="font-semibold text-slate-700">关联架构组件</p>
                    <ArchitectureComponentTags components={question.relatedComponents} onSelect={onViewArchitectureComponent} />
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">本次没有错题，继续保持。</div>
      )}
    </section>
  )
}

function NextStepSuggestions({ suggestions }: { suggestions: string[] }) {
  return (
    <section className="mt-6 rounded-md border border-sky-200 bg-sky-50 p-4">
      <p className="text-xs font-semibold uppercase text-sky-700">Next Step</p>
      <h3 className="mt-1 text-sm font-semibold text-sky-950">建议下一步</h3>
      <div className="mt-2 space-y-1.5">
        {suggestions.map((suggestion) => <p key={suggestion} className="text-sm leading-6 text-sky-900">• {suggestion}</p>)}
      </div>
    </section>
  )
}

function buildNextStepSuggestions(items: Array<{ question: ObcpQuestion; isCorrect: boolean }>) {
  if (!items.length) return ['当前已提交题目不足，建议先完成并提交更多题目，再判断下一步。']
  const wrongCount = items.filter((item) => !item.isCorrect).length
  const correctRate = Math.round(((items.length - wrongCount) / items.length) * 100)
  const chapterStats = new Map<string, { total: number; correct: number }>()
  items.forEach(({ question, isCorrect }) => {
    const current = chapterStats.get(question.chapter) ?? { total: 0, correct: 0 }
    chapterStats.set(question.chapter, {
      total: current.total + 1,
      correct: current.correct + (isCorrect ? 1 : 0),
    })
  })
  const weakChapter = [...chapterStats.entries()]
    .map(([chapter, stat]) => ({ chapter, rate: Math.round((stat.correct / stat.total) * 100) }))
    .sort((a, b) => a.rate - b.rate)[0]
  const suggestions: string[] = []
  if (wrongCount >= Math.max(2, Math.ceil(items.length * 0.3))) suggestions.push(`本次错题 ${wrongCount} 道，建议先使用“重做错题”完成一轮即时巩固。`)
  if (weakChapter && weakChapter.rate < 60) suggestions.push(`${weakChapter.chapter}正确率为 ${weakChapter.rate}%，建议下一轮优先进行该章节专项练习。`)
  if (correctRate >= 85) suggestions.push(`本次正确率 ${correctRate}%，基础掌握较稳定，建议进入模拟考试检验综合能力。`)
  if (!suggestions.length) suggestions.push('建议复盘本次错题与常见误区，再进行一次随机练习巩固。')
  return suggestions
}

function truncateText(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length)}...` : value
}

function AnswerFeedback({
  question,
  selected,
  isCorrect,
  onViewArchitectureComponent,
}: {
  question: ObcpQuestion
  selected: string[]
  isCorrect: boolean
  onViewArchitectureComponent: (componentName: string) => void
}) {
  return (
    <div className={`mt-5 rounded-md border p-4 ${isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
      <div className={`flex items-center gap-2 text-sm font-semibold ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
        {isCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
        <span>{isCorrect ? '回答正确' : '回答错误'}</span>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
        <p><span className="font-semibold">你的答案：</span>{answerText(question, selected) || '未作答'}</p>
        <p><span className="font-semibold">正确答案：</span>{answerText(question, question.answer)}</p>
      </div>
      <div className="mt-4 border-t border-slate-200/80 pt-4 text-sm leading-6 text-slate-700">
        <p><span className="font-semibold">题目解析：</span>{question.explanation}</p>
        <p className="mt-2"><span className="font-semibold">涉及知识点：</span>{question.knowledgePoints.join('、')}</p>
        <p className="mt-2"><span className="font-semibold">建议复习：</span>{question.reviewSuggestion}</p>
        {!!question.commonMistakes.length && <p className="mt-2"><span className="font-semibold">常见误区：</span>{question.commonMistakes.join('；')}</p>}
        {!!question.relatedComponents.length && (
          <div className="mt-3 rounded-md border border-ocean-100 bg-white/70 p-3">
            <p className="text-xs font-semibold text-ocean-800">建议回看架构组件</p>
            <ArchitectureComponentTags components={question.relatedComponents} onSelect={onViewArchitectureComponent} />
          </div>
        )}
      </div>
    </div>
  )
}

function ArchitectureComponentTags({ components, onSelect }: { components: string[]; onSelect: (componentName: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {components.map((component) => (
        <button key={component} type="button" onClick={() => onSelect(component)} className="rounded-md border border-ocean-200 bg-ocean-50 px-2 py-1 text-xs font-semibold text-ocean-700 transition hover:border-ocean-400 hover:bg-ocean-100">
          {component}
        </button>
      ))}
    </div>
  )
}

function createInitialStates(questions: ObcpQuestion[]) {
  return Object.fromEntries(questions.map((question) => [
    question.questionId,
    { selectedAnswer: [], submitted: false },
  ])) as Record<string, ObcpPracticeQuestionState>
}

function practiceTitle(mode: ObcpPracticeMode) {
  if (mode === 'exam') return '模拟考试'
  if (mode === 'random') return '随机练习'
  if (mode === 'wrongBook') return '错题重做'
  if (mode === 'favorite') return '收藏题目'
  return '顺序练习'
}

function answerText(question: ObcpQuestion, answer: string[]) {
  return answer.map((id) => {
    const option = question.options.find((item) => item.id === id)
    return option ? `${option.label}. ${option.text}` : id
  }).join('；')
}

function answersEqual(left: string[], right: string[]) {
  return [...left].sort().join('|') === [...right].sort().join('|')
}

function questionTypeLabel(type: ObcpQuestion['type']) {
  return { single: '单选题', multiple: '多选题', trueFalse: '判断题' }[type]
}
