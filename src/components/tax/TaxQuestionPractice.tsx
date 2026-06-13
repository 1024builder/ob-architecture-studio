import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Lightbulb,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type {
  TaxPracticeMode,
  TaxQuestion,
  TaxQuestionState,
} from '../../data/taxQuestionTypes'
import {
  appendTaxAnswerRecord,
  updateTaxQuestionState,
} from '../../utils/taxQuestionBank'

type Props = {
  bankId: string
  questions: TaxQuestion[]
  mode: TaxPracticeMode
  states: TaxQuestionState[]
  onClose: () => void
  onDataChange: () => void
}

type SessionAnswer = {
  selected: string[]
  submitted: boolean
  isCorrect: boolean | null
}

export function TaxQuestionPractice({
  bankId,
  questions,
  mode,
  states,
  onClose,
  onDataChange,
}: Props) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, SessionAnswer>>({})
  const question = questions[index]
  const current = answers[question.questionId] ?? {
    selected: [],
    submitted: false,
    isCorrect: null,
  }
  const state = states.find((item) => item.questionId === question.questionId)
  const isSubjective = question.type === 'short_answer' || question.type === 'comprehensive'
  const allowsMultiple = question.type === 'multiple'

  const answeredCount = useMemo(
    () => Object.values(answers).filter((item) => item.submitted).length,
    [answers],
  )

  function selectAnswer(key: string) {
    if (current.submitted) return
    const selected = allowsMultiple
      ? current.selected.includes(key)
        ? current.selected.filter((item) => item !== key)
        : [...current.selected, key]
      : [key]
    setAnswers((value) => ({
      ...value,
      [question.questionId]: { ...current, selected },
    }))
  }

  function submit() {
    if (!isSubjective && !current.selected.length) return
    const selected = isSubjective ? [] : current.selected
    const isCorrect = isSubjective
      ? null
      : sameAnswer(selected, question.answer)
    setAnswers((value) => ({
      ...value,
      [question.questionId]: { selected, submitted: true, isCorrect },
    }))
    appendTaxAnswerRecord({
      recordId: `tax-${question.questionId}-${Date.now()}`,
      bankId,
      questionId: question.questionId,
      selectedAnswer: selected,
      correctAnswer: question.answer,
      isCorrect,
      answeredAt: new Date().toISOString(),
    })
    if (isCorrect === false) {
      updateTaxQuestionState(question.questionId, { isWrongBook: true })
    } else if (isCorrect === true) {
      updateTaxQuestionState(question.questionId, { isWrongBook: false })
    }
    onDataChange()
  }

  function toggleState(field: 'isFavorite' | 'isNotUnderstood') {
    updateTaxQuestionState(question.questionId, {
      [field]: !(state?.[field] ?? false),
    })
    onDataChange()
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onClose} className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600">
          <ArrowLeft size={16} />返回题库
        </button>
        <div className="text-right">
          <p className="text-xs text-slate-400">{practiceModeLabel(mode)}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{index + 1} / {questions.length} · 已提交 {answeredCount}</p>
        </div>
      </div>

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200">
        <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
      </div>

      <article className="border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">{question.subject}</span>
          <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">{question.chapter}</span>
          <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">{question.section}</span>
          <span className="text-slate-400">{difficultyLabel(question.difficulty)}</span>
        </div>

        <h1 className="mt-5 text-base font-semibold leading-8 text-ink sm:text-lg">{question.stem}</h1>

        {question.options.length ? (
          <div className="mt-5 space-y-3">
            {question.options.map((option) => {
              const selected = current.selected.includes(option.key)
              const correct = current.submitted && question.answer.includes(option.key)
              const wrongSelected = current.submitted && selected && !correct
              return (
                <button
                  key={option.key}
                  type="button"
                  disabled={current.submitted}
                  onClick={() => selectAnswer(option.key)}
                  className={`flex min-h-14 w-full items-start gap-3 rounded-md border px-4 py-3 text-left transition ${
                    correct
                      ? 'border-emerald-400 bg-emerald-50'
                      : wrongSelected
                        ? 'border-rose-400 bg-rose-50'
                        : selected
                          ? 'border-emerald-500 bg-emerald-50/60'
                          : 'border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded text-sm font-semibold ${selected || correct ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{option.key}</span>
                  <span className="pt-0.5 text-sm leading-6 text-slate-700">{option.text}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-600">
            本题为主观题。第一版不提供在线文本判分，点击“查看参考答案”后对照解析进行自评。
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={() => toggleState('isFavorite')} className={`flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold ${state?.isFavorite ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600'}`}>
            <Bookmark size={15} />{state?.isFavorite ? '已收藏' : '收藏'}
          </button>
          <button type="button" onClick={() => toggleState('isNotUnderstood')} className={`flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold ${state?.isNotUnderstood ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600'}`}>
            <Lightbulb size={15} />{state?.isNotUnderstood ? '已标记不理解' : '我不理解'}
          </button>
        </div>

        {!current.submitted ? (
          <button type="button" disabled={!isSubjective && !current.selected.length} onClick={submit} className="mt-5 h-11 w-full rounded-md bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45">
            {isSubjective ? '查看参考答案' : '提交答案'}
          </button>
        ) : (
          <div className="mt-5 space-y-4">
            <div className={`flex items-center gap-3 rounded-md px-4 py-3 ${current.isCorrect === true ? 'bg-emerald-50 text-emerald-700' : current.isCorrect === false ? 'bg-rose-50 text-rose-700' : 'bg-ocean-50 text-ocean-700'}`}>
              {current.isCorrect === true ? <CheckCircle2 size={20} /> : current.isCorrect === false ? <XCircle size={20} /> : <Lightbulb size={20} />}
              <span className="text-sm font-semibold">{current.isCorrect === true ? '回答正确' : current.isCorrect === false ? '回答错误' : '请对照参考答案自评'}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <AnswerBox label="我的答案" value={isSubjective ? '主观题未自动记录文本答案' : current.selected.join('、') || '未选择'} />
              <AnswerBox label="正确答案 / 参考答案" value={question.answer.join('、')} />
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">解析</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{question.explanation}</p>
            </div>
            {!!question.tags.length && <div className="flex flex-wrap gap-2">{question.tags.map((tag) => <span key={tag} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-500">{tag}</span>)}</div>}
          </div>
        )}

        <div className="mt-6 flex justify-between gap-3">
          <button type="button" disabled={index === 0} onClick={() => setIndex((value) => value - 1)} className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-600 disabled:opacity-40"><ArrowLeft size={16} />上一题</button>
          <button type="button" disabled={index === questions.length - 1} onClick={() => setIndex((value) => value + 1)} className="flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-40">下一题<ArrowRight size={16} /></button>
        </div>
      </article>
    </div>
  )
}

function AnswerBox({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-slate-200 px-4 py-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-700">{value}</p></div>
}

function sameAnswer(left: string[], right: string[]) {
  return [...left].sort().join('|') === [...right].sort().join('|')
}

function difficultyLabel(value: TaxQuestion['difficulty']) {
  return value === 'easy' ? '基础' : value === 'normal' ? '常规' : '较难'
}

function practiceModeLabel(mode: TaxPracticeMode) {
  return mode === 'random' ? '随机练习' : mode === 'wrongBook' ? '错题重做' : mode === 'favorite' ? '收藏题练习' : '顺序练习'
}
