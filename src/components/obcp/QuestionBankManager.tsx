import {
  Database,
  Download,
  FileJson,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ObcpQuestion } from '../../data/obcpTypes'
import {
  downloadQuestionBank,
  downloadQuestionBankTemplate,
  importObcpQuestions,
} from '../../utils/obcpQuestionImportExport'

type Props = {
  builtInQuestions: ObcpQuestion[]
  customQuestions: ObcpQuestion[]
  allQuestions: ObcpQuestion[]
  autoOpenImport?: boolean
  onImport: (questions: ObcpQuestion[]) => void
  onClearCustom: () => void
  onClose: () => void
}

export function QuestionBankManager({
  builtInQuestions,
  customQuestions,
  allQuestions,
  autoOpenImport,
  onImport,
  onClearCustom,
  onClose,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const chapterCounts = countBy(allQuestions, (question) => question.chapter)
  const typeCounts = countBy(allQuestions, (question) => typeLabel(question.type))
  const difficultyCounts = countBy(allQuestions, (question) => question.difficulty)

  useEffect(() => {
    if (autoOpenImport) fileInputRef.current?.click()
  }, [autoOpenImport])

  async function handleFile(file?: File) {
    if (!file) return
    const result = importObcpQuestions(await file.text(), allQuestions)
    if (result.importedQuestions.length) {
      try {
        onImport(result.importedQuestions)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '题库保存失败，请重试。')
        return
      }
    }
    const parts = [`成功导入 ${result.importedCount} 道`]
    if (result.duplicateCount) parts.push(`跳过重复 ${result.duplicateCount} 道`)
    if (result.invalidCount) parts.push(`无效 ${result.invalidCount} 道`)
    setMessage(`${parts.join('，')}。${result.errors.length ? ` ${result.errors.join(' ')}` : ''}`)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClear() {
    if (!customQuestions.length) {
      setMessage('当前没有导入题目。')
      return
    }
    if (!window.confirm(`确定清空 ${customQuestions.length} 道导入题目吗？刷题记录不会被删除。`)) return
    onClearCustom()
    setMessage('已清空导入题目，历史刷题记录保持不变。')
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-3" role="dialog" aria-modal="true" aria-label="题库管理">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md border border-slate-200 bg-slate-50 shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-ocean-50 text-ocean-700"><Database size={20} /></span>
            <div><h2 className="text-base font-semibold text-ink">题库管理</h2><p className="mt-0.5 text-xs text-slate-500">管理本地导入题目，不影响用户刷题记录</p></div>
          </div>
          <button type="button" title="关闭" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </header>

        <div className="space-y-5 p-5">
          <section className="grid gap-3 sm:grid-cols-3">
            <Metric label="当前题库总数" value={allQuestions.length} />
            <Metric label="内置题目" value={builtInQuestions.length} />
            <Metric label="导入题目" value={customQuestions.length} />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <CountList title="按章节" items={chapterCounts} />
            <CountList title="按题型" items={typeCounts} />
            <CountList title="按难度" items={difficultyCounts} />
          </section>

          {message && <div className="rounded-md border border-ocean-200 bg-ocean-50 px-4 py-3 text-sm leading-6 text-ocean-800">{message}</div>}

          <section className="flex flex-wrap gap-2 border-t border-slate-200 pt-5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            <Action icon={Upload} label="导入题库 JSON" onClick={() => fileInputRef.current?.click()} primary />
            <Action icon={Download} label="导出全部题库 JSON" onClick={() => downloadQuestionBank(allQuestions)} />
            <Action icon={FileJson} label="下载题库模板" onClick={downloadQuestionBankTemplate} />
            <Action icon={Trash2} label="清空导入题目" onClick={handleClear} danger disabled={!customQuestions.length} />
          </section>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-ink">{value}</p></div>
}

function CountList({ title, items }: { title: string; items: Array<[string, number]> }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.map(([name, count]) => <div key={name} className="flex justify-between gap-3 text-sm"><span className="text-slate-600">{name}</span><span className="font-semibold text-slate-800">{count}</span></div>)}
      </div>
    </div>
  )
}

function Action({ icon: Icon, label, onClick, primary, danger, disabled }: { icon: typeof Upload; label: string; onClick: () => void; primary?: boolean; danger?: boolean; disabled?: boolean }) {
  const tone = primary
    ? 'bg-ocean-600 text-white hover:bg-ocean-700'
    : danger
      ? 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50'
      : 'border border-slate-200 bg-white text-slate-700 hover:border-ocean-300 hover:text-ocean-700'
  return <button type="button" disabled={disabled} onClick={onClick} className={`flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${tone}`}><Icon size={16} />{label}</button>
}

function countBy(questions: ObcpQuestion[], getKey: (question: ObcpQuestion) => string) {
  const counts = new Map<string, number>()
  questions.forEach((question) => {
    const key = getKey(question)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right, 'zh-CN'))
}

function typeLabel(type: ObcpQuestion['type']) {
  return { single: '单选题', multiple: '多选题', trueFalse: '判断题' }[type]
}
