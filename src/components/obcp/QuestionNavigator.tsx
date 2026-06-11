import { Bookmark, Brain } from 'lucide-react'
import { useState } from 'react'
import type {
  ObcpPracticeQuestionState,
  ObcpQuestion,
  ObcpUserState,
} from '../../data/obcpTypes'

type Props = {
  title: string
  sourceLabel: string
  questions: ObcpQuestion[]
  currentIndex: number
  states: Record<string, ObcpPracticeQuestionState>
  userState: ObcpUserState
  hideCorrectness?: boolean
  onSelect: (index: number) => void
}

type NavigatorFilter = 'all' | 'unanswered' | 'answered' | 'favorite' | 'notUnderstood'

export function QuestionNavigator({
  title,
  sourceLabel,
  questions,
  currentIndex,
  states,
  userState,
  hideCorrectness = false,
  onSelect,
}: Props) {
  const [filter, setFilter] = useState<NavigatorFilter>('all')
  const answeredCount = questions.filter((question) => states[question.questionId]?.selectedAnswer.length).length
  const favoriteCount = questions.filter((question) => userState.favoriteQuestionIds.includes(question.questionId)).length
  const notUnderstoodCount = questions.filter((question) => userState.notUnderstoodQuestionIds.includes(question.questionId)).length
  const visibleQuestions = questions
    .map((question, questionIndex) => ({ question, questionIndex }))
    .filter(({ question }) => matchesFilter(filter, question, states, userState))

  return (
    <aside className="shrink-0 border-b border-slate-200 bg-slate-50/80 p-3 lg:w-56 lg:border-b-0 lg:border-r lg:p-4">
      <div className="hidden lg:block">
        <p className="text-xs font-semibold uppercase text-ocean-600">{title}</p>
        <p className="mt-1 text-sm font-semibold text-ink">{sourceLabel}</p>
      </div>
      <div className="mb-2 flex items-center justify-between gap-3 lg:hidden">
        <span className="text-xs font-semibold text-ocean-700">{title}</span>
        <span className="truncate text-xs text-slate-500">{sourceLabel}</span>
      </div>
      <div className="mb-3 flex gap-1 overflow-x-auto lg:flex-wrap">
        {([
          ['all', '全部'],
          ['unanswered', '未答'],
          ['answered', '已答'],
          ['favorite', '收藏'],
          ['notUnderstood', '不理解'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`h-7 shrink-0 rounded-md px-2 text-xs font-medium transition ${filter === id ? 'bg-ocean-600 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:border-ocean-300'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
        {visibleQuestions.map(({ question, questionIndex }) => {
          const state = states[question.questionId]
          const answered = !!state?.selectedAnswer.length
          const isFavorite = userState.favoriteQuestionIds.includes(question.questionId)
          const isNotUnderstood = userState.notUnderstoodQuestionIds.includes(question.questionId)
          const statusClass = getStatusClass(state, answered, hideCorrectness)
          return (
            <button
              key={question.questionId}
              type="button"
              title={`第 ${questionIndex + 1} 题`}
              aria-current={questionIndex === currentIndex ? 'step' : undefined}
              onClick={() => onSelect(questionIndex)}
              className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-md border text-sm font-semibold transition ${statusClass} ${questionIndex === currentIndex ? 'ring-2 ring-ocean-500 ring-offset-2' : ''}`}
            >
              {questionIndex + 1}
              {isFavorite && <Bookmark size={9} fill="currentColor" className="absolute left-0.5 top-0.5 text-violet-600" />}
              {isNotUnderstood && <Brain size={9} className="absolute bottom-0.5 right-0.5 text-rose-600" />}
            </button>
          )
        })}
        {!visibleQuestions.length && <p className="col-span-4 whitespace-nowrap py-2 text-xs text-slate-400">暂无符合条件的题目</p>}
      </div>

      <div className="mt-3 hidden grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-200 pt-3 text-xs lg:grid">
        <Stat label="总题数" value={questions.length} />
        <Stat label="已作答" value={answeredCount} />
        <Stat label="未作答" value={questions.length - answeredCount} />
        <Stat label="已收藏" value={favoriteCount} />
        <Stat label="不理解" value={notUnderstoodCount} />
      </div>
    </aside>
  )
}

function matchesFilter(
  filter: NavigatorFilter,
  question: ObcpQuestion,
  states: Record<string, ObcpPracticeQuestionState>,
  userState: ObcpUserState,
) {
  const answered = !!states[question.questionId]?.selectedAnswer.length
  if (filter === 'answered') return answered
  if (filter === 'unanswered') return !answered
  if (filter === 'favorite') return userState.favoriteQuestionIds.includes(question.questionId)
  if (filter === 'notUnderstood') return userState.notUnderstoodQuestionIds.includes(question.questionId)
  return true
}

function getStatusClass(
  state: ObcpPracticeQuestionState | undefined,
  answered: boolean,
  hideCorrectness: boolean,
) {
  if (!hideCorrectness && state?.submitted && state.isCorrect === true) return 'border-emerald-300 bg-emerald-100 text-emerald-800'
  if (!hideCorrectness && state?.submitted && state.isCorrect === false) return 'border-rose-300 bg-rose-100 text-rose-800'
  if (answered) return 'border-ocean-300 bg-ocean-100 text-ocean-800'
  return 'border-slate-200 bg-white text-slate-500 hover:border-ocean-300'
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between gap-2 text-slate-500"><span>{label}</span><span className="font-semibold text-slate-700">{value}</span></div>
}
