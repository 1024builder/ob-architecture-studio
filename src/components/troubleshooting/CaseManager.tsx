import { Database, Download, FileJson, Trash2, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { TroubleshootingCase } from '../../data/troubleshootingTypes'
import {
  downloadTroubleshootingCasesJson,
  downloadTroubleshootingCaseTemplate,
  importTroubleshootingCases,
} from '../../utils/troubleshootingImportExport'

type Props = {
  builtInCases: TroubleshootingCase[]
  customCases: TroubleshootingCase[]
  allCases: TroubleshootingCase[]
  onImport: (items: TroubleshootingCase[]) => void
  onClearCustom: () => void
  onClose: () => void
}

export function CaseManager({
  builtInCases,
  customCases,
  allCases,
  onImport,
  onClearCustom,
  onClose,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  async function handleFile(file?: File) {
    if (!file) return
    const result = importTroubleshootingCases(await file.text(), allCases)
    if (result.importedCases.length) {
      try {
        onImport(result.importedCases)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '案例保存失败，请重试。')
        return
      }
    }
    const parts = [`成功导入 ${result.importedCount} 个`]
    if (result.duplicateCount) parts.push(`跳过重复 ${result.duplicateCount} 个`)
    if (result.invalidCount) parts.push(`无效 ${result.invalidCount} 个`)
    setMessage(`${parts.join('，')}。${result.errors.length ? ` ${result.errors.join(' ')}` : ''}`)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClear() {
    if (!customCases.length) return
    if (!window.confirm(`确定清空 ${customCases.length} 个导入案例吗？内置案例不会受到影响。`)) return
    onClearCustom()
    setMessage('已清空导入案例，内置案例保持不变。')
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-3" role="dialog" aria-modal="true" aria-label="案例管理">
      <div className="w-full max-w-2xl overflow-hidden rounded-md border border-slate-200 bg-slate-50 shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-ocean-50 text-ocean-700"><Database size={20} /></span>
            <div><h2 className="text-base font-semibold text-ink">案例管理</h2><p className="mt-0.5 text-xs text-slate-500">管理本地导入案例，内置案例保持只读</p></div>
          </div>
          <button type="button" title="关闭" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </header>

        <div className="space-y-5 p-5">
          <section className="grid gap-3 sm:grid-cols-3">
            <Metric label="当前案例总数" value={allCases.length} />
            <Metric label="内置案例" value={builtInCases.length} />
            <Metric label="导入案例" value={customCases.length} />
          </section>

          {message && <div className="rounded-md border border-ocean-200 bg-ocean-50 px-4 py-3 text-sm leading-6 text-ocean-800">{message}</div>}

          <section className="flex flex-wrap gap-2 border-t border-slate-200 pt-5">
            <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0])} />
            <Action icon={Upload} label="导入案例 JSON" onClick={() => fileInputRef.current?.click()} primary />
            <Action icon={Download} label="导出全部案例 JSON" onClick={() => downloadTroubleshootingCasesJson(allCases)} />
            <Action icon={FileJson} label="下载案例模板" onClick={downloadTroubleshootingCaseTemplate} />
            <Action icon={Trash2} label="清空导入案例" onClick={handleClear} danger disabled={!customCases.length} />
          </section>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-ink">{value}</p></div>
}

function Action({ icon: Icon, label, onClick, primary, danger, disabled }: { icon: typeof Upload; label: string; onClick: () => void; primary?: boolean; danger?: boolean; disabled?: boolean }) {
  const tone = primary ? 'bg-ocean-600 text-white hover:bg-ocean-700' : danger ? 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50' : 'border border-slate-200 bg-white text-slate-700 hover:border-ocean-300 hover:text-ocean-700'
  return <button type="button" disabled={disabled} onClick={onClick} className={`flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${tone}`}><Icon size={16} />{label}</button>
}
