import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Grid3X3,
  Lightbulb,
  XCircle,
  X,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [navigatorOpen, setNavigatorOpen] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)
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
    window.requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  function toggleState(field: 'isFavorite' | 'isNotUnderstood') {
    updateTaxQuestionState(question.questionId, {
      [field]: !(state?.[field] ?? false),
    })
    onDataChange()
  }

  return (
    <div className="mx-auto max-w-5xl pb-[calc(112px+env(safe-area-inset-bottom))] md:pb-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onClose} className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600">
          <ArrowLeft size={16} />返回题库
        </button>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-xs text-slate-400">{practiceModeLabel(mode)}</p>
            <p className="mt-1 text-sm font-semibold text-ink">{index + 1} / {questions.length} · 已提交 {answeredCount}</p>
          </div>
          <button type="button" onClick={() => setNavigatorOpen(true)} className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-600" title="打开题卡">
            <Grid3X3 size={17} />
          </button>
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

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => toggleState('isFavorite')} className={`flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold ${state?.isFavorite ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600'}`}>
            <Bookmark size={15} />{state?.isFavorite ? '已收藏' : '收藏'}
          </button>
          <button type="button" onClick={() => toggleState('isNotUnderstood')} className={`flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold ${state?.isNotUnderstood ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-600'}`}>
            <Lightbulb size={15} />{state?.isNotUnderstood ? '已标记不理解' : '我不理解'}
          </button>
        </div>

        {question.options.length ? (
          <div className="mt-5 space-y-3">
            {question.options.map((option) => {
              const selected = current.selected.includes(option.key)
              const correct = current.submitted && question.answer.includes(option.key)
              const wrongSelected = current.submitted && selected && !correct
              const missedCorrect = current.submitted && correct && !selected
              const selectedCorrect = current.submitted && correct && selected
              const resultLabel = selectedCorrect
                ? '已选正确'
                : wrongSelected
                  ? '我的误选'
                  : missedCorrect
                    ? allowsMultiple ? '漏选' : '正确答案'
                    : ''
              return (
                <button
                  key={option.key}
                  type="button"
                  disabled={current.submitted}
                  onClick={() => selectAnswer(option.key)}
                  className={`flex min-h-14 w-full items-start gap-3 rounded-md border px-4 py-3 text-left transition ${
                    selectedCorrect
                      ? 'border-emerald-500 bg-emerald-50'
                      : missedCorrect
                        ? 'border-amber-400 bg-amber-50/70'
                      : wrongSelected
                        ? 'border-rose-400 bg-rose-50'
                        : selected
                          ? 'border-emerald-500 bg-emerald-50/60'
                          : 'border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded text-sm font-semibold ${
                    wrongSelected
                      ? 'bg-rose-600 text-white'
                      : selected || correct
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                  }`}>{option.key}</span>
                  <span className="min-w-0 flex-1 pt-0.5 text-sm leading-6 text-slate-700">{option.text}</span>
                  {resultLabel && (
                    <span className={`mt-0.5 shrink-0 rounded px-2 py-1 text-[11px] font-semibold ${
                      wrongSelected
                        ? 'bg-rose-100 text-rose-700'
                        : missedCorrect
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                    }`}>{resultLabel}</span>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-600">
            本题为主观题。第一版不提供在线文本判分，点击“查看参考答案”后对照解析进行自评。
          </div>
        )}

        {!current.submitted ? (
          <button type="button" disabled={!isSubjective && !current.selected.length} onClick={submit} className="mt-5 h-11 w-full rounded-md bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45">
            {isSubjective ? '查看参考答案' : '提交答案'}
          </button>
        ) : (
          <div ref={resultRef} className="mt-5 space-y-4 scroll-mt-20">
            <ResultSummary
              isCorrect={current.isCorrect}
              isSubjective={isSubjective}
              selected={current.selected}
              answer={question.answer}
            />
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">解析</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{question.explanation}</p>
            </div>
            {!!question.tags.length && <div className="flex flex-wrap gap-2">{question.tags.map((tag) => <span key={tag} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-500">{tag}</span>)}</div>}
          </div>
        )}

        <div className="mt-6 hidden justify-between gap-3 md:flex">
          <button type="button" disabled={index === 0} onClick={() => setIndex((value) => value - 1)} className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-600 disabled:opacity-40"><ArrowLeft size={16} />上一题</button>
          <button type="button" disabled={index === questions.length - 1} onClick={() => setIndex((value) => value + 1)} className="flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-40">下一题<ArrowRight size={16} /></button>
        </div>
      </article>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.10)] backdrop-blur md:hidden"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-5xl gap-3">
          <button type="button" disabled={index === 0} onClick={() => setIndex((value) => value - 1)} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-600 disabled:opacity-40"><ArrowLeft size={16} />上一题</button>
          <button type="button" disabled={index === questions.length - 1} onClick={() => setIndex((value) => value + 1)} className="flex h-11 flex-[1.35] items-center justify-center gap-2 rounded-md bg-emerald-600 text-sm font-semibold text-white disabled:opacity-40">下一题<ArrowRight size={16} /></button>
        </div>
      </div>

      {navigatorOpen && createPortal(
        <div className="fixed inset-0 z-[90] flex items-end bg-slate-950/45 sm:items-center sm:justify-center sm:p-5">
          <div className="max-h-[78dvh] w-full overflow-y-auto rounded-t-lg bg-white p-4 shadow-2xl sm:max-w-lg sm:rounded-md sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="text-base font-semibold text-ink">题号导航</h2><p className="mt-1 text-xs text-slate-500">点击题号可直接跳转，结果状态仅反映本次练习。</p></div>
              <button type="button" title="关闭题卡" onClick={() => setNavigatorOpen(false)} className="grid h-8 w-8 place-items-center text-slate-400"><X size={18} /></button>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-8">
              {questions.map((item, itemIndex) => {
                const itemAnswer = answers[item.questionId]
                const itemState = states.find((candidate) => candidate.questionId === item.questionId)
                const answerTone = itemAnswer?.submitted && itemAnswer.isCorrect === true
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : itemAnswer?.submitted && itemAnswer.isCorrect === false
                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                    : itemAnswer?.submitted
                      ? 'border-violet-300 bg-violet-50 text-violet-700'
                      : 'border-slate-200 text-slate-600'
                return (
                  <button
                    key={item.questionId}
                    type="button"
                    onClick={() => {
                      setIndex(itemIndex)
                      setNavigatorOpen(false)
                    }}
                    className={`relative aspect-square rounded-md border text-sm font-semibold ${answerTone} ${
                      itemIndex === index ? 'ring-2 ring-ocean-500 ring-offset-1' : ''
                    }`}
                  >
                    {itemIndex + 1}
                    {itemState?.isFavorite && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" />}
                    {itemState?.isNotUnderstood && <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-violet-500" />}
                  </button>
                )
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-500">
              <Legend tone="bg-slate-200" label="未答" />
              <Legend tone="bg-emerald-500" label="正确" />
              <Legend tone="bg-rose-500" label="错误" />
              <Legend tone="bg-amber-500" label="收藏" />
              <Legend tone="bg-violet-500" label="不理解 / 主观题已查看" />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

function ResultSummary({
  isCorrect,
  isSubjective,
  selected,
  answer,
}: {
  isCorrect: boolean | null
  isSubjective: boolean
  selected: string[]
  answer: string[]
}) {
  const title = isCorrect === true
    ? '回答正确'
    : isCorrect === false
      ? '回答错误'
      : '参考答案已展示，不自动判分'
  return (
    <div className={`rounded-md border px-4 py-3 ${
      isCorrect === true
        ? 'border-emerald-200 bg-emerald-50'
        : isCorrect === false
          ? 'border-rose-200 bg-rose-50'
          : 'border-ocean-200 bg-ocean-50'
    }`}>
      <div className="flex items-center gap-2">
        {isCorrect === true ? <CheckCircle2 size={19} className="text-emerald-600" /> : isCorrect === false ? <XCircle size={19} className="text-rose-600" /> : <Lightbulb size={19} className="text-ocean-600" />}
        <p className="text-sm font-semibold text-ink">{title}</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
        <span>我的答案：<strong className="text-ink">{isSubjective ? '主观题自评' : selected.join('、') || '未选择'}</strong></span>
        <span>正确答案 / 参考答案：<strong className="text-ink">{answer.join('、')}</strong></span>
      </div>
    </div>
  )
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${tone}`} />{label}</span>
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
