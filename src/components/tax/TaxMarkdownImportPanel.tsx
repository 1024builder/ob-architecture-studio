import {
  AlertTriangle,
  Ban,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  TaxQuestionBank,
  TaxQuestionOption,
  TaxQuestionType,
  TaxSubject,
} from '../../data/taxQuestionTypes'
import {
  getParsedTaxQuestionImportBlockReasons,
  isParsedTaxQuestionImportable,
  normalizeTaxAnswer,
  parseTaxMarkdown,
  revalidateParsedTaxQuestion,
  toStandardTaxQuestionBank,
  type ParsedTaxQuestion,
  type ParsedTaxQuestionBank,
} from '../../services/taxMarkdownParser'
import { downloadTextFile } from '../../utils/obcpExport'

type ImportSummary = {
  bank: TaxQuestionBank
  addedCount: number
  skippedCount: number
  warningCount: number
}

type Props = {
  existingBanks: TaxQuestionBank[]
  onClose: () => void
  onImport: (summary: ImportSummary) => void
}

const subjects: TaxSubject[] = ['税法一', '税法二', '涉税服务实务', '财务与会计', '涉税服务相关法律']
const questionTypes: Array<{ value: TaxQuestionType; label: string }> = [
  { value: 'single', label: '单项选择题' },
  { value: 'multiple', label: '多项选择题' },
  { value: 'judge', label: '判断题' },
  { value: 'calculation', label: '计算题' },
  { value: 'comprehensive', label: '综合题' },
  { value: 'short_answer', label: '简答题' },
]
const warningFilters = [
  { value: '全部', label: '全部题目' },
  { value: '正常题目', label: '正常题目' },
  { value: '警告题目', label: '警告题目' },
  { value: '无答案', label: '无答案' },
  { value: '选项不足', label: '选项不足' },
  { value: '无解析', label: '无解析' },
  { value: '缺少章节', label: '缺少章节' },
  { value: '题号重复', label: '题号重复' },
  { value: '无法导入题目', label: '无法导入题目' },
] as const

export function TaxMarkdownImportPanel({ existingBanks, onClose, onImport }: Props) {
  const [markdown, setMarkdown] = useState('')
  const [fileName, setFileName] = useState('')
  const [draft, setDraft] = useState<ParsedTaxQuestionBank | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [warningFilter, setWarningFilter] = useState<(typeof warningFilters)[number]['value']>('全部')
  const [validationOpen, setValidationOpen] = useState(false)
  const [lastBlockedIds, setLastBlockedIds] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const overview = useMemo(() => {
    if (!draft) return null
    const chapters = new Set(draft.questions.map((question) => question.chapter))
    const typeCounts = questionTypes.map((item) => ({
      ...item,
      count: draft.questions.filter((question) => question.type === item.value).length,
    })).filter((item) => item.count > 0)
    const importableQuestions = draft.questions.filter(isParsedTaxQuestionImportable)
    const excludedQuestions = draft.questions.filter((question) => !isParsedTaxQuestionImportable(question))
    const excludedReasonTypes = new Set(
      excludedQuestions.flatMap(getParsedTaxQuestionImportBlockReasons),
    )
    return {
      chapterCount: chapters.size,
      warningCount: draft.questions.filter((question) => question.parseWarnings.length > 0).length,
      normalCount: draft.questions.filter((question) =>
        question.parseWarnings.length === 0 && isParsedTaxQuestionImportable(question)).length,
      noAnswerCount: draft.questions.filter((question) => question.parseWarnings.includes('未识别答案')).length,
      insufficientOptionCount: draft.questions.filter((question) =>
        question.parseWarnings.includes('客观题选项数量不足')
        || question.parseWarnings.includes('未识别选项')).length,
      importableCount: importableQuestions.length,
      excludedCount: excludedQuestions.length,
      excludedReasonCount: excludedReasonTypes.size,
      typeCounts,
    }
  }, [draft])
  const blockedSelectedQuestions = useMemo(() => {
    if (!draft) return []
    return draft.questions.filter((question) =>
      selectedIds.has(question.questionId) && !isParsedTaxQuestionImportable(question))
  }, [draft, selectedIds])
  const visibleQuestions = useMemo(() => {
    if (!draft || warningFilter === '全部') return draft?.questions ?? []
    if (warningFilter === '正常题目') {
      return draft.questions.filter((question) =>
        question.parseWarnings.length === 0 && isParsedTaxQuestionImportable(question))
    }
    if (warningFilter === '警告题目') {
      return draft.questions.filter((question) => question.parseWarnings.length > 0)
    }
    if (warningFilter === '无法导入题目') {
      return draft.questions.filter((question) => !isParsedTaxQuestionImportable(question))
    }
    if (warningFilter === '无答案') {
      return draft.questions.filter((question) =>
        getParsedTaxQuestionImportBlockReasons(question).some((reason) =>
          reason === '缺少答案' || reason === '缺少参考答案或解析'))
    }
    if (warningFilter === '选项不足') {
      return draft.questions.filter((question) =>
        getParsedTaxQuestionImportBlockReasons(question).some((reason) =>
          reason.includes('选项不足') || reason.includes('缺少“正确 / 错误”选项')))
    }
    if (warningFilter === '无解析') {
      return draft.questions.filter((question) =>
        getParsedTaxQuestionImportBlockReasons(question).some((reason) =>
          reason === '缺少解析' || reason === '缺少参考答案或解析'))
    }
    if (warningFilter === '缺少章节') {
      return draft.questions.filter((question) =>
        getParsedTaxQuestionImportBlockReasons(question).includes('缺少章节'))
    }
    return draft.questions.filter((question) => question.parseWarnings.includes(warningFilter))
  }, [draft, warningFilter])

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.md')) {
      setMessage('请选择 .md 格式的 Markdown 文件。')
      return
    }
    try {
      setMarkdown(await file.text())
      setFileName(file.name)
      setMessage(`已读取 ${file.name}，点击“开始解析”生成预览。`)
    } catch {
      setMessage('Markdown 文件读取失败，请重试或直接粘贴文本。')
    }
  }

  function handleParse() {
    const result = parseTaxMarkdown(markdown, { fileName })
    if (!result.bank) {
      setMessage(result.errors.join(' '))
      return
    }
    setDraft(result.bank)
    setSelectedIds(new Set(result.bank.questions.map((question) => question.questionId)))
    setExpandedId(result.bank.questions[0]?.questionId ?? null)
    setWarningFilter('全部')
    setMessage(result.bank.parseWarnings.join('；'))
  }

  function updateQuestion(questionId: string, updater: (question: ParsedTaxQuestion) => ParsedTaxQuestion) {
    if (!draft) return
    const currentQuestion = draft.questions.find((question) => question.questionId === questionId)
    if (!currentQuestion) return
    const nextQuestion = revalidateParsedTaxQuestion(updater(currentQuestion))
    setDraft({
      ...draft,
      questions: draft.questions.map((question) =>
        question.questionId === questionId ? nextQuestion : question),
    })
    if (isParsedTaxQuestionImportable(nextQuestion)) {
      setLastBlockedIds((blockedIds) => {
        const remaining = blockedIds.filter((id) => id !== questionId)
        if (!remaining.length && blockedIds.length) setMessage('')
        return remaining
      })
    } else {
      setSelectedIds((selected) => {
        if (!selected.has(questionId)) return selected
        const nextSelected = new Set(selected)
        nextSelected.delete(questionId)
        return nextSelected
      })
    }
  }

  function deleteQuestion(questionId: string) {
    setDraft((current) => current ? {
      ...current,
      questions: current.questions.filter((question) => question.questionId !== questionId),
    } : current)
    setSelectedIds((current) => {
      const next = new Set(current)
      next.delete(questionId)
      return next
    })
    if (expandedId === questionId) setExpandedId(null)
  }

  function selectWarningFree() {
    if (!draft) return
    setSelectedIds(new Set(
      draft.questions
        .filter((question) =>
          question.parseWarnings.length === 0 && isParsedTaxQuestionImportable(question))
        .map((question) => question.questionId),
    ))
  }

  function selectImportable() {
    if (!draft) return
    setSelectedIds(new Set(
      draft.questions
        .filter(isParsedTaxQuestionImportable)
        .map((question) => question.questionId),
    ))
    setLastBlockedIds([])
    setValidationOpen(false)
  }

  function deselectBlocked() {
    if (!draft) return
    const blockedIds = new Set(
      draft.questions
        .filter((question) => !isParsedTaxQuestionImportable(question))
        .map((question) => question.questionId),
    )
    setSelectedIds((current) => new Set(
      [...current].filter((questionId) => !blockedIds.has(questionId)),
    ))
  }

  function showBlocked() {
    setWarningFilter('无法导入题目')
  }

  function locateQuestion(questionId: string) {
    setValidationOpen(false)
    setWarningFilter('无法导入题目')
    setExpandedId(questionId)
    window.setTimeout(() => {
      document.getElementById(`tax-markdown-question-${questionId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  function exportBlockedQuestions() {
    if (!draft) return
    const blocked = draft.questions
      .filter((question) => !isParsedTaxQuestionImportable(question))
      .map((question) => ({
        displayNumber: draft.questions.indexOf(question) + 1,
        questionId: question.questionId,
        originalNumber: question.originalNumber,
        chapter: question.chapter,
        type: question.type,
        stem: question.stem,
        options: question.options,
        answer: question.answer,
        explanation: question.explanation,
        tags: question.tags,
        importBlockReasons: getParsedTaxQuestionImportBlockReasons(question),
        parseWarnings: question.parseWarnings,
      }))
    if (!blocked.length) {
      setMessage('当前没有无法导入的题目。')
      return
    }
    downloadTextFile(
      `${safeFileName(draft.bankName)}-blocked-questions.json`,
      JSON.stringify(blocked, null, 2),
      'application/json;charset=utf-8',
    )
  }

  function deleteBlockedQuestions() {
    if (!draft) return
    const blocked = draft.questions.filter((question) => !isParsedTaxQuestionImportable(question))
    if (!blocked.length) {
      setMessage('当前没有无法导入的题目。')
      return
    }
    if (!window.confirm(`确定删除全部 ${blocked.length} 道无法导入题目吗？此操作只影响当前解析草稿。`)) return
    const blockedIds = new Set(blocked.map((question) => question.questionId))
    setDraft({
      ...draft,
      questions: draft.questions.filter((question) => !blockedIds.has(question.questionId)),
    })
    setSelectedIds((current) => new Set([...current].filter((questionId) => !blockedIds.has(questionId))))
    setMessage(`已从解析草稿中删除 ${blocked.length} 道无法导入题目。`)
  }

  function exportParsedJson() {
    if (!draft) return
    try {
      const selected = draft.questions.filter((question) => selectedIds.has(question.questionId))
      const bank = toStandardTaxQuestionBank(draft, selected.length ? selected : draft.questions)
      downloadTextFile(
        `${safeFileName(bank.bankName)}-parsed.json`,
        JSON.stringify(bank, null, 2),
        'application/json;charset=utf-8',
      )
    } catch {
      setMessage('解析结果生成 JSON 失败，请检查题目内容后重试。')
    }
  }

  function confirmImport() {
    if (!draft) return
    if (!draft.bankName.trim() || !draft.source.trim() || !Number.isInteger(draft.year)) {
      setMessage('请补充有效的题库名称、来源和年份。')
      return
    }
    const selected = draft.questions.filter((question) => selectedIds.has(question.questionId))
    if (!selected.length) {
      setMessage('请至少选择一道题目后再导入。')
      return
    }

    const invalid = selected.filter((question) => !isParsedTaxQuestionImportable(question))
    if (invalid.length) {
      const numbers = invalid.map((question) => draft.questions.indexOf(question) + 1)
      setLastBlockedIds(invalid.map((question) => question.questionId))
      const numberText = numbers.slice(0, 10).map((number) => `第 ${number} 题`).join('、')
      setMessage(`仍有 ${invalid.length} 道题无法导入：${numberText}${numbers.length > 10 ? `等 ${numbers.length} 题` : ''}。`)
      setValidationOpen(true)
      return
    }

    const existingQuestionIds = new Set(existingBanks.flatMap((bank) => bank.questions.map((question) => question.questionId)))
    const uniqueQuestions = selected.filter((question) => !existingQuestionIds.has(question.questionId))
    const skippedCount = selected.length - uniqueQuestions.length
    if (!uniqueQuestions.length) {
      setMessage('所选题目均与现有 questionId 重复，没有可新增题目。')
      return
    }

    const existingBankIds = new Set(existingBanks.map((bank) => bank.bankId))
    const bankId = existingBankIds.has(draft.bankId) ? `${draft.bankId}-${Date.now()}` : draft.bankId
    const bank = toStandardTaxQuestionBank({ ...draft, bankId }, uniqueQuestions)
    try {
      onImport({
        bank,
        addedCount: uniqueQuestions.length,
        skippedCount,
        warningCount: uniqueQuestions.filter((question) => question.parseWarnings.length > 0).length,
      })
    } catch {
      setMessage('题库保存失败，本次解析草稿仍保留在当前页面，请稍后重试。')
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Markdown 题库解析导入">
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-50 shadow-2xl sm:h-[min(92dvh,920px)] sm:max-w-6xl sm:rounded-md">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase text-emerald-600">Experimental Parser</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">Markdown 题库解析导入</h2>
            <p className="mt-1 text-xs text-slate-500">全部解析在当前浏览器本地完成，不会上传 Markdown 原文。</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="关闭">
            <X size={17} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[calc(24px+env(safe-area-inset-bottom))] sm:p-5">
          {!draft ? (
            <div className="mx-auto max-w-4xl space-y-4">
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
                MinerU Markdown 受 OCR、页眉页脚和选项错位影响，解析结果必须先预览。复杂编辑建议在电脑端完成。
              </div>
              <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
                <div className="space-y-3 border border-slate-200 bg-white p-4 shadow-sm">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,text/markdown,text/plain"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) void handleFile(file)
                      event.currentTarget.value = ''
                    }}
                  />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">
                    <Upload size={17} />上传 .md 文件
                  </button>
                  <div className="rounded-md bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-500">
                    <p className="font-semibold text-slate-700">识别范围</p>
                    <p className="mt-1">章节标题、题型分组、数字题号、A-E 选项、答案标记及解析文本。</p>
                  </div>
                  {fileName && <p className="break-all text-xs text-slate-500">当前文件：{fileName}</p>}
                </div>
                <label className="block border border-slate-200 bg-white p-4 shadow-sm">
                  <span className="text-sm font-semibold text-ink">粘贴 Markdown 文本</span>
                  <textarea
                    value={markdown}
                    onChange={(event) => setMarkdown(event.target.value)}
                    placeholder={'# 税法一\n## 第一章 税法基本原理\n### 一、单项选择题\n1. 题干...\nA. 选项...'}
                    className="mt-3 min-h-[52dvh] w-full resize-y rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-6 text-slate-700 outline-none focus:border-emerald-400 sm:min-h-96"
                  />
                </label>
              </div>
              {message && <Message text={message} />}
              <div className="flex justify-end">
                <button type="button" onClick={handleParse} disabled={!markdown.trim()} className="h-10 rounded-md bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
                  开始解析
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <section className="border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="题库名称">
                    <input value={draft.bankName} onChange={(event) => setDraft({ ...draft, bankName: event.target.value })} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400" />
                  </Field>
                  <Field label="科目">
                    <select value={draft.subject} onChange={(event) => {
                      const subject = event.target.value as TaxSubject
                      setDraft({ ...draft, subject, questions: draft.questions.map((question) => ({ ...question, subject })) })
                    }} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400">
                      {subjects.map((subject) => <option key={subject}>{subject}</option>)}
                    </select>
                  </Field>
                  <Field label="年份">
                    <input type="number" value={draft.year} onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) })} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400" />
                  </Field>
                  <Field label="来源">
                    <input value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400" />
                  </Field>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
                  <Summary label="章节" value={overview?.chapterCount ?? 0} />
                  <Summary label="题目" value={draft.questions.length} />
                  <Summary label="正常题目" value={overview?.normalCount ?? 0} />
                  <Summary label="警告题目" value={overview?.warningCount ?? 0} warning />
                  <Summary label="无答案" value={overview?.noAnswerCount ?? 0} warning />
                  <Summary label="选项不足" value={overview?.insufficientOptionCount ?? 0} warning />
                  <Summary label="可导入" value={overview?.importableCount ?? 0} />
                  <Summary label="被排除" value={overview?.excludedCount ?? 0} danger />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  {overview?.typeCounts.map((item) => <span key={item.value} className="rounded bg-slate-100 px-2 py-1">{item.label} {item.count}</span>)}
                  {draft.parseWarnings.map((warning) => <span key={warning} className="rounded bg-amber-50 px-2 py-1 text-amber-700">{warning}</span>)}
                </div>
              </section>

              {message && (
                <Message
                  text={message}
                  danger={lastBlockedIds.length > 0}
                  action={lastBlockedIds.length ? {
                    label: '查看无法导入题目',
                    onClick: () => {
                      showBlocked()
                      if (lastBlockedIds[0]) locateQuestion(lastBlockedIds[0])
                    },
                  } : undefined}
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={selectWarningFree} className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Check size={15} />只选择无警告题</button>
                  <button type="button" onClick={selectImportable} className="flex h-9 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"><Check size={15} />只选择可导入题</button>
                  <button type="button" onClick={deselectBlocked} className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Ban size={15} />取消选择无法导入题</button>
                  <button type="button" onClick={showBlocked} className="flex h-9 items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100"><Eye size={15} />只显示无法导入题</button>
                  <button type="button" onClick={() => setSelectedIds(new Set(draft.questions.map((question) => question.questionId)))} className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">全选</button>
                  <button type="button" onClick={() => setSelectedIds(new Set())} className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">清空选择</button>
                  <select value={warningFilter} onChange={(event) => setWarningFilter(event.target.value as typeof warningFilter)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none focus:border-emerald-400" aria-label="警告类型筛选">
                    {warningFilters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">显示 {visibleQuestions.length} 题 · 已选择 {selectedIds.size} 题</span>
                  <button type="button" onClick={() => { setDraft(null); setExpandedId(null) }} className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">返回原文</button>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                <span>
                  可导入 {overview?.importableCount ?? 0} 题 · 被排除 {overview?.excludedCount ?? 0} 题 · 排除原因 {overview?.excludedReasonCount ?? 0} 类
                </span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={exportBlockedQuestions} className="font-semibold text-slate-600 hover:text-emerald-700">导出无法导入题 JSON</button>
                  <button type="button" onClick={deleteBlockedQuestions} className="font-semibold text-rose-600 hover:text-rose-700">删除全部无法导入题</button>
                </div>
              </div>

              <div className="space-y-3">
                {visibleQuestions.map((question) => {
                  const index = draft.questions.findIndex((item) => item.questionId === question.questionId)
                  return (
                  <QuestionEditor
                    key={question.questionId}
                    question={question}
                    index={index}
                    selected={selectedIds.has(question.questionId)}
                    expanded={expandedId === question.questionId}
                    onToggleSelected={() => setSelectedIds((current) => {
                      const next = new Set(current)
                      if (next.has(question.questionId)) next.delete(question.questionId)
                      else next.add(question.questionId)
                      return next
                    })}
                    onToggleExpanded={() => setExpandedId((current) => current === question.questionId ? null : question.questionId)}
                    onUpdate={(updater) => updateQuestion(question.questionId, updater)}
                    onDelete={() => deleteQuestion(question.questionId)}
                  />
                  )
                })}
                {!visibleQuestions.length && <div className="border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">当前筛选条件下没有题目。</div>}
              </div>
            </div>
          )}
        </div>

        {draft && (
          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:px-5">
            <button type="button" onClick={exportParsedJson} className="flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              <Download size={16} />导出解析 JSON
            </button>
            <button type="button" onClick={confirmImport} className="h-10 rounded-md bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700">
              确认导入 {selectedIds.size} 题
            </button>
          </footer>
        )}
        {validationOpen && draft && (
          <ImportValidationDialog
            questions={blockedSelectedQuestions}
            allQuestions={draft.questions}
            onClose={() => setValidationOpen(false)}
            onLocate={locateQuestion}
          />
        )}
      </div>
    </div>
  )
}

function QuestionEditor({
  question,
  index,
  selected,
  expanded,
  onToggleSelected,
  onToggleExpanded,
  onUpdate,
  onDelete,
}: {
  question: ParsedTaxQuestion
  index: number
  selected: boolean
  expanded: boolean
  onToggleSelected: () => void
  onToggleExpanded: () => void
  onUpdate: (updater: (question: ParsedTaxQuestion) => ParsedTaxQuestion) => void
  onDelete: () => void
}) {
  const optionCount = question.options.length
  const hasReferenceAnswer = ['short_answer', 'comprehensive'].includes(question.type) && question.answer.length > 0
  const blockReasons = getParsedTaxQuestionImportBlockReasons(question)
  const importable = blockReasons.length === 0
  const status = !importable ? '无法导入' : question.parseWarnings.length ? '警告' : '可导入'
  const borderClass = !importable
    ? 'border-rose-400'
    : question.parseWarnings.length
      ? 'border-amber-300'
      : 'border-emerald-300'
  const statusClass = !importable
    ? 'bg-rose-100 text-rose-700'
    : question.parseWarnings.length
      ? 'bg-amber-100 text-amber-700'
      : 'bg-emerald-100 text-emerald-700'
  return (
    <article
      id={`tax-markdown-question-${question.questionId}`}
      className={`scroll-mt-6 border bg-white shadow-sm ${borderClass} ${selected ? 'ring-1 ring-emerald-200' : ''}`}
    >
      <div className="flex items-start gap-3 p-4">
        <input type="checkbox" checked={selected} onChange={onToggleSelected} className="mt-1 h-4 w-4 accent-emerald-600" />
        <button type="button" onClick={onToggleExpanded} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-ink">第 {index + 1} 题</span>
            <span className={`rounded px-2 py-0.5 font-semibold ${statusClass}`}>{status}</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">{question.chapter}</span>
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">{typeLabel(question.type)}</span>
            {question.tags.map((tag) => <span key={tag} className="rounded bg-violet-50 px-2 py-0.5 text-violet-700">{tag}</span>)}
          </div>
          {!!blockReasons.length && (
            <p className="mt-2 text-xs font-semibold leading-5 text-rose-700">
              阻塞原因：{blockReasons.join('；')}
            </p>
          )}
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">{question.stem || '题干为空'}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>选项 {optionCount}</span>
            <span>答案 {question.answer.join('、') || '未识别'}</span>
            <span>{question.explanation ? '已有解析' : hasReferenceAnswer ? '已有参考答案' : '无解析'}</span>
            {!!question.parseWarnings.length && <span className="font-semibold text-amber-700">{question.parseWarnings.join('；')}</span>}
          </div>
        </button>
        <button type="button" onClick={onToggleExpanded} className="grid h-8 w-8 shrink-0 place-items-center text-slate-400" aria-label={expanded ? '收起编辑' : '展开编辑'}>
          {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="章节">
              <input value={question.chapter} onChange={(event) => onUpdate((current) => ({ ...current, chapter: event.target.value }))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400" />
            </Field>
            <Field label="题型">
              <select value={question.type} onChange={(event) => onUpdate((current) => ({ ...current, type: event.target.value as TaxQuestionType, section: typeLabel(event.target.value as TaxQuestionType) }))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400">
                {questionTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="答案（逗号分隔）">
              <input value={question.answer.join(',')} onChange={(event) => onUpdate((current) => ({ ...current, answer: normalizeTaxAnswer(event.target.value, current.type) }))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400" placeholder="A,C,D" />
            </Field>
          </div>
          <Field label="题干">
            <textarea value={question.stem} onChange={(event) => onUpdate((current) => ({ ...current, stem: event.target.value }))} className="min-h-24 w-full resize-y rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 outline-none focus:border-emerald-400" />
          </Field>
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500">选项</p>
              <button type="button" onClick={() => onUpdate((current) => ({ ...current, options: [...current.options, nextOption(current.options)] }))} className="flex items-center gap-1 text-xs font-semibold text-emerald-700"><Plus size={14} />添加选项</button>
            </div>
            <div className="mt-2 space-y-2">
              {question.options.map((option, optionIndex) => (
                <div key={`${option.key}-${optionIndex}`} className="grid grid-cols-[3.5rem_minmax(0,1fr)_2rem] gap-2">
                  <input value={option.key} onChange={(event) => onUpdate((current) => ({ ...current, options: replaceOption(current.options, optionIndex, { ...option, key: event.target.value.toUpperCase() }) }))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-center text-sm font-semibold text-slate-700 outline-none focus:border-emerald-400" />
                  <input value={option.text} onChange={(event) => onUpdate((current) => ({ ...current, options: replaceOption(current.options, optionIndex, { ...option, text: event.target.value }) }))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400" />
                  <button type="button" onClick={() => onUpdate((current) => ({ ...current, options: current.options.filter((_, index) => index !== optionIndex) }))} className="grid h-10 place-items-center text-rose-500" aria-label={`删除选项 ${option.key}`}><X size={15} /></button>
                </div>
              ))}
              {!question.options.length && <p className="text-xs text-amber-700">未识别到选项，可手动添加后再导入。</p>}
            </div>
          </div>
          <Field label="解析">
            <textarea value={question.explanation} onChange={(event) => onUpdate((current) => ({ ...current, explanation: event.target.value }))} className="min-h-32 w-full resize-y rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 outline-none focus:border-emerald-400" />
          </Field>
          <div className="flex justify-end">
            <button type="button" onClick={onDelete} className="flex h-9 items-center gap-2 rounded-md border border-rose-200 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50"><Trash2 size={14} />删除此题</button>
          </div>
        </div>
      )}
    </article>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="text-xs font-semibold text-slate-500">{label}</span><span className="mt-1 block">{children}</span></label>
}

function Summary({ label, value, warning, danger }: { label: string; value: number; warning?: boolean; danger?: boolean }) {
  const tone = danger && value
    ? 'bg-rose-50 text-rose-800'
    : warning && value
      ? 'bg-amber-50 text-amber-800'
      : 'bg-slate-50 text-slate-700'
  return <div className={`rounded-md px-3 py-3 ${tone}`}><p className="text-xs">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>
}

function Message({
  text,
  danger,
  action,
}: {
  text: string
  danger?: boolean
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 text-xs leading-5 ${danger ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
      <span className="flex min-w-0 items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{text}</span></span>
      {action && <button type="button" onClick={action.onClick} className="shrink-0 rounded-md border border-current px-3 py-1 font-semibold">{action.label}</button>}
    </div>
  )
}

function ImportValidationDialog({
  questions,
  allQuestions,
  onClose,
  onLocate,
}: {
  questions: ParsedTaxQuestion[]
  allQuestions: ParsedTaxQuestion[]
  onClose: () => void
  onLocate: (questionId: string) => void
}) {
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/60 p-3" role="dialog" aria-modal="true" aria-label="导入前校验">
      <div className="flex max-h-[85dvh] w-full max-w-3xl flex-col overflow-hidden rounded-md bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4">
          <div>
            <h3 className="text-base font-semibold text-rose-700">存在 {questions.length} 道阻塞题目</h3>
            <p className="mt-1 text-xs text-slate-500">请定位修正，或取消选择这些题目后再导入。</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-500" aria-label="关闭导入校验"><X size={15} /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {questions.map((question) => {
            const displayNumber = allQuestions.findIndex((item) => item.questionId === question.questionId) + 1
            return (
              <div key={question.questionId} className="border border-rose-200 bg-rose-50/50 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="font-semibold text-rose-700">第 {displayNumber} 题</span>
                      <span className="text-slate-500">{question.chapter || '缺少章节'}</span>
                      <span className="text-slate-500">{typeLabel(question.type)}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-700">{question.stem || '题干为空'}</p>
                    <p className="mt-2 text-xs font-semibold leading-5 text-rose-700">{getParsedTaxQuestionImportBlockReasons(question).join('；')}</p>
                  </div>
                  <button type="button" onClick={() => onLocate(question.questionId)} className="h-8 shrink-0 rounded-md border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50">定位</button>
                </div>
              </div>
            )
          })}
        </div>
        <footer className="flex justify-end border-t border-slate-200 px-4 py-3">
          <button type="button" onClick={onClose} className="h-9 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-600">返回修正</button>
        </footer>
      </div>
    </div>
  )
}

function typeLabel(type: TaxQuestionType) {
  return questionTypes.find((item) => item.value === type)?.label ?? type
}

function replaceOption(options: TaxQuestionOption[], index: number, option: TaxQuestionOption) {
  return options.map((item, itemIndex) => itemIndex === index ? option : item)
}

function nextOption(options: TaxQuestionOption[]): TaxQuestionOption {
  const keys = ['A', 'B', 'C', 'D', 'E']
  return { key: keys.find((key) => !options.some((option) => option.key === key)) ?? `X${options.length + 1}`, text: '' }
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'tax-markdown-bank'
}
