import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  BookOpenCheck,
  CheckCircle2,
  Download,
  Dices,
  FileCode2,
  Filter,
  ListChecks,
  RotateCcw,
  Trash2,
  TrendingUp,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { TaxMarkdownImportPanel } from '../components/tax/TaxMarkdownImportPanel'
import { TaxQuestionPractice } from '../components/tax/TaxQuestionPractice'
import type {
  TaxPracticeMode,
  TaxQuestion,
  TaxQuestionDifficulty,
  TaxQuestionType,
  TaxSubject,
} from '../data/taxQuestionTypes'
import {
  clearTaxQuestionBanks,
  downloadTaxQuestionBanks,
  downloadTaxQuestionBankTemplate,
  getActiveTaxBankId,
  importTaxQuestionBanks,
  loadTaxAnswerRecords,
  loadTaxQuestionBanks,
  loadTaxQuestionStates,
  saveTaxQuestionBanks,
  setActiveTaxBankId,
  TAX_DATA_CHANGED_EVENT,
} from '../utils/taxQuestionBank'

type ActivePractice = {
  mode: TaxPracticeMode
  bankId: string
  questions: TaxQuestion[]
}

export function TaxQuestionBankPage() {
  const [revision, setRevision] = useState(0)
  const [activePractice, setActivePractice] = useState<ActivePractice | null>(null)
  const [message, setMessage] = useState('')
  const [markdownImportOpen, setMarkdownImportOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const banks = useMemo(() => {
    void revision
    return loadTaxQuestionBanks()
  }, [revision])
  const records = useMemo(() => {
    void revision
    return loadTaxAnswerRecords()
  }, [revision])
  const states = useMemo(() => {
    void revision
    return loadTaxQuestionStates()
  }, [revision])
  const [activeBankId, setActiveBank] = useState(() => getActiveTaxBankId() ?? banks[0]?.bankId ?? '')
  const [subject, setSubject] = useState<'全部' | TaxSubject>('全部')
  const [chapter, setChapter] = useState('全部')
  const [type, setType] = useState<'全部' | TaxQuestionType>('全部')
  const [difficulty, setDifficulty] = useState<'全部' | TaxQuestionDifficulty>('全部')
  const [stateFilter, setStateFilter] = useState<'全部' | '收藏' | '错题'>('全部')

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1)
    window.addEventListener(TAX_DATA_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(TAX_DATA_CHANGED_EVENT, refresh)
  }, [])

  useEffect(() => {
    if (banks.length && !banks.some((item) => item.bankId === activeBankId)) {
      setActiveBank(banks[0].bankId)
    }
  }, [activeBankId, banks])

  useEffect(() => {
    if (activeBankId && getActiveTaxBankId() !== activeBankId) {
      setActiveTaxBankId(activeBankId)
    }
  }, [activeBankId])

  const activeBank = banks.find((bank) => bank.bankId === activeBankId)
  const allQuestions = activeBank?.questions ?? []
  const activeQuestionIds = new Set(allQuestions.map((item) => item.questionId))
  const activeRecords = records.filter((item) => activeQuestionIds.has(item.questionId))
  const stateById = new Map(states.map((item) => [item.questionId, item]))
  const chapters = unique(allQuestions
    .filter((question) => subject === '全部' || question.subject === subject)
    .map((question) => question.chapter))
  const filteredQuestions = allQuestions.filter((question) => {
    const state = stateById.get(question.questionId)
    return (subject === '全部' || question.subject === subject)
      && (chapter === '全部' || question.chapter === chapter)
      && (type === '全部' || question.type === type)
      && (difficulty === '全部' || question.difficulty === difficulty)
      && (stateFilter === '全部'
        || (stateFilter === '收藏' && state?.isFavorite)
        || (stateFilter === '错题' && state?.isWrongBook))
  })
  const judgedRecords = activeRecords.filter((item) => item.isCorrect !== null)
  const correctCount = judgedRecords.filter((item) => item.isCorrect).length
  const wrongCount = states.filter((item) => activeQuestionIds.has(item.questionId) && item.isWrongBook).length
  const favoriteCount = states.filter((item) => activeQuestionIds.has(item.questionId) && item.isFavorite).length

  function startPractice(mode: TaxPracticeMode, questions = filteredQuestions) {
    let candidates = questions
    if (mode === 'wrongBook') candidates = allQuestions.filter((item) => stateById.get(item.questionId)?.isWrongBook)
    if (mode === 'favorite') candidates = allQuestions.filter((item) => stateById.get(item.questionId)?.isFavorite)
    if (mode === 'random') candidates = shuffle(candidates).slice(0, Math.min(20, candidates.length))
    if (!candidates.length) {
      setMessage(mode === 'wrongBook' ? '暂无错题可重做。' : mode === 'favorite' ? '暂无收藏题可练习。' : '当前筛选条件下没有可练习题目。')
      return
    }
    const bankId = banks.find((bank) => bank.questions.some((item) => item.questionId === candidates[0].questionId))?.bankId ?? activeBankId
    setActivePractice({ mode, bankId, questions: candidates })
  }

  async function importFile(file: File) {
    const result = importTaxQuestionBanks(await file.text(), banks)
    if (result.banks.length) {
      const next = [...banks, ...result.banks]
      saveTaxQuestionBanks(next)
      setActiveTaxBankId(result.banks[0].bankId)
      setActiveBank(result.banks[0].bankId)
    }
    setMessage(`导入 ${result.importedCount} 个题库，跳过重复 ${result.duplicateCount} 个，无效 ${result.invalidCount} 个。${result.errors[0] ? ` ${result.errors[0]}` : ''}`)
  }

  if (activePractice) {
    return (
      <div className="p-3 sm:p-4 lg:p-5">
        <TaxQuestionPractice
          bankId={activePractice.bankId}
          questions={activePractice.questions}
          mode={activePractice.mode}
          states={states}
          onClose={() => setActivePractice(null)}
          onDataChange={() => setRevision((value) => value + 1)}
        />
      </div>
    )
  }

  const subjectGroups = unique(allQuestions.map((item) => item.subject))

  return (
    <div className="space-y-5 p-3 sm:p-4 lg:p-5">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-600">Tax Professional Learning Space</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">税务师题库</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">面向税法一、税法二、涉税服务实务、财务与会计及涉税服务相关法律的本地题库空间。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.currentTarget.value = '' }} />
          <ActionButton icon={Upload} label="导入 JSON" onClick={() => fileInputRef.current?.click()} />
          <ActionButton icon={FileCode2} label="Markdown 解析" onClick={() => setMarkdownImportOpen(true)} />
          <ActionButton icon={Download} label="导出 JSON" disabled={!banks.length} onClick={() => downloadTaxQuestionBanks(banks)} />
          <ActionButton icon={FileCode2} label="下载模板" onClick={downloadTaxQuestionBankTemplate} />
          <ActionButton icon={Trash2} label="清空本地题库" danger disabled={!banks.length} onClick={() => { if (window.confirm('确定清空本地税务师题库吗？答题记录和题目状态将保留。')) { clearTaxQuestionBanks(); setMessage('本地税务师题库已清空。') } }} />
        </div>
      </section>

      {message && <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><span>{message}</span><button type="button" onClick={() => setMessage('')} className="text-xs font-semibold">关闭</button></div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={BookOpenCheck} label="总题数" value={allQuestions.length} tone="emerald" />
        <Metric icon={CheckCircle2} label="已答题数" value={new Set(activeRecords.map((item) => item.questionId)).size} tone="ocean" />
        <Metric icon={TrendingUp} label="正确率" value={judgedRecords.length ? `${Math.round((correctCount / judgedRecords.length) * 100)}%` : '0%'} tone="violet" />
        <Metric icon={AlertTriangle} label="错题数" value={wrongCount} tone="amber" />
        <Metric icon={BookMarked} label="收藏题数" value={favoriteCount} tone="rose" />
      </section>

      <section className="border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Filter size={17} />题目筛选</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Select value={subject} onChange={(value) => { setSubject(value as typeof subject); setChapter('全部') }} options={['全部', ...subjectGroups]} label="科目" />
          <Select value={chapter} onChange={setChapter} options={['全部', ...chapters]} label="章节" />
          <Select value={type} onChange={(value) => setType(value as typeof type)} options={['全部', 'single', 'multiple', 'judge', 'calculation', 'comprehensive', 'short_answer']} labels={typeLabels} label="题型" />
          <Select value={difficulty} onChange={(value) => setDifficulty(value as typeof difficulty)} options={['全部', 'easy', 'normal', 'hard']} labels={{ easy: '基础', normal: '常规', hard: '较难' }} label="难度" />
          <Select value={stateFilter} onChange={(value) => setStateFilter(value as typeof stateFilter)} options={['全部', '收藏', '错题']} label="题目状态" />
          <div className="flex items-end"><span className="w-full rounded-md bg-slate-50 px-3 py-2.5 text-sm text-slate-600">匹配 {filteredQuestions.length} 题</span></div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
        <div>
          <SectionHeading eyebrow="Chapters" title="章节练习" />
          <div className="mt-3 space-y-4">
            {subjectGroups.map((subjectName) => {
              const subjectQuestions = allQuestions.filter((item) => item.subject === subjectName)
              const subjectChapters = unique(subjectQuestions.map((item) => item.chapter))
              return (
                <div key={subjectName} className="overflow-hidden border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between bg-slate-50 px-4 py-3"><h3 className="text-sm font-semibold text-ink">{subjectName}</h3><span className="text-xs text-slate-400">{subjectQuestions.length} 题</span></div>
                  <div className="divide-y divide-slate-100">
                    {subjectChapters.map((chapterName) => {
                      const questions = subjectQuestions.filter((item) => item.chapter === chapterName)
                      const questionIds = new Set(questions.map((item) => item.questionId))
                      const chapterRecords = activeRecords.filter((item) => questionIds.has(item.questionId) && item.isCorrect !== null)
                      const completed = new Set(chapterRecords.map((item) => item.questionId)).size
                      const rate = chapterRecords.length ? Math.round((chapterRecords.filter((item) => item.isCorrect).length / chapterRecords.length) * 100) : 0
                      const progress = questions.length ? Math.round((completed / questions.length) * 100) : 0
                      return (
                        <button key={chapterName} type="button" onClick={() => startPractice('sequential', questions)} className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-emerald-50/40">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-emerald-50 text-sm font-bold text-emerald-700">{progress}%</span>
                          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{chapterName}</span><span className="mt-1 block text-xs text-slate-500">{questions.length} 题 · 正确率 {rate}%</span><span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></span></span>
                          <ArrowRight size={16} className="shrink-0 text-slate-400" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {!banks.length && <EmptyState title="暂无税务师题库" description="下载标准模板，整理为 JSON 后导入即可开始练习。" />}
          </div>
        </div>

        <div className="space-y-5">
          <section>
            <SectionHeading eyebrow="Practice Modes" title="练习模式" />
            <div className="mt-3 grid gap-2">
              <ModeButton icon={ListChecks} title="顺序练习" description={`按当前筛选练习 ${filteredQuestions.length} 道题`} onClick={() => startPractice('sequential')} />
              <ModeButton icon={Dices} title="随机练习" description="最多随机抽取 20 道题" onClick={() => startPractice('random')} />
              <ModeButton icon={RotateCcw} title="错题重做" description={`${wrongCount} 道待复习错题`} disabled={!wrongCount} onClick={() => startPractice('wrongBook')} />
              <ModeButton icon={BookMarked} title="收藏题练习" description={`${favoriteCount} 道收藏题`} disabled={!favoriteCount} onClick={() => startPractice('favorite')} />
            </div>
          </section>

          <section className="border border-dashed border-slate-300 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink"><FileCode2 size={17} />Markdown 题库解析（实验）</div>
            <p className="mt-2 text-xs leading-6 text-slate-500">Markdown 解析受 OCR 质量影响，建议先转换为标准 JSON 后导入。</p>
            <button type="button" onClick={() => setMarkdownImportOpen(true)} className="mt-3 h-9 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">开始解析导入</button>
          </section>

          {!!banks.length && (
            <section className="border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">当前题库</p>
              <select value={activeBankId} onChange={(event) => { setActiveBank(event.target.value); setActiveTaxBankId(event.target.value) }} className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                {banks.map((bank) => <option key={bank.bankId} value={bank.bankId}>{bank.bankName} · {bank.year}</option>)}
              </select>
              <p className="mt-2 text-xs text-slate-400">当前导入数据保存在本地浏览器，暂不参与 Supabase 同步。</p>
            </section>
          )}
        </div>
      </section>
      {markdownImportOpen && (
        <TaxMarkdownImportPanel
          existingBanks={banks}
          onClose={() => setMarkdownImportOpen(false)}
          onImport={({ bank, addedCount, skippedCount, warningCount }) => {
            saveTaxQuestionBanks([...banks, bank])
            setActiveTaxBankId(bank.bankId)
            setActiveBank(bank.bankId)
            setMarkdownImportOpen(false)
            setMessage(`Markdown 题库导入完成：新增 ${addedCount} 题，跳过重复 ${skippedCount} 题，保留警告 ${warningCount} 题。`)
          }}
        />
      )}
    </div>
  )
}

function ActionButton({ icon: Icon, label, onClick, disabled, danger }: { icon: typeof Upload; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`flex h-10 items-center gap-2 rounded-md border bg-white px-3 text-sm font-semibold disabled:opacity-40 ${danger ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'}`}><Icon size={16} />{label}</button>
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof BookOpenCheck; label: string; value: number | string; tone: 'emerald' | 'ocean' | 'violet' | 'amber' | 'rose' }) {
  const tones = { emerald: 'bg-emerald-50 text-emerald-600', ocean: 'bg-ocean-50 text-ocean-600', violet: 'bg-violet-50 text-violet-600', amber: 'bg-amber-50 text-amber-600', rose: 'bg-rose-50 text-rose-600' }
  return <div className="flex min-h-24 items-center gap-3 border border-slate-200 bg-white px-4 shadow-sm"><span className={`grid h-10 w-10 place-items-center rounded-md ${tones[tone]}`}><Icon size={19} /></span><div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-ink">{value}</p></div></div>
}

function Select({ label, value, options, labels = {}, onChange }: { label: string; value: string; options: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return <label><span className="text-xs font-semibold text-slate-500">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">{options.map((option) => <option key={option} value={option}>{labels[option] ?? option}</option>)}</select></label>
}

function ModeButton({ icon: Icon, title, description, onClick, disabled }: { icon: typeof ListChecks; title: string; description: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="flex min-h-20 items-center gap-3 border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-45"><span className="grid h-10 w-10 place-items-center rounded-md bg-emerald-50 text-emerald-700"><Icon size={19} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{title}</span><span className="mt-1 block text-xs text-slate-500">{description}</span></span><ArrowRight size={16} className="text-slate-400" /></button>
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div><p className="text-xs font-semibold uppercase text-slate-400">{eyebrow}</p><h2 className="mt-1 text-lg font-semibold text-ink">{title}</h2></div>
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="border border-dashed border-slate-300 bg-white px-4 py-10 text-center"><p className="text-sm font-semibold text-slate-700">{title}</p><p className="mt-1 text-xs text-slate-500">{description}</p></div>
}

const typeLabels: Record<string, string> = {
  single: '单项选择题',
  multiple: '多项选择题',
  judge: '判断题',
  calculation: '计算题',
  comprehensive: '综合题',
  short_answer: '简答题',
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items))
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5)
}
