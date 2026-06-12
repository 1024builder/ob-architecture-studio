import {
  Cloud,
  CloudOff,
  Database,
  Download,
  FileJson,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { TroubleshootingCase } from '../../data/troubleshootingTypes'
import { getActiveSession } from '../../services/authService'
import {
  deleteAllCloudTroubleshootingCases,
  deleteCloudTroubleshootingCase,
  getTroubleshootingCaseSyncStatus,
  syncTroubleshootingCases,
  TROUBLESHOOTING_CASE_SYNC_STATUS_CHANGED_EVENT,
  type TroubleshootingCaseSyncStatus,
} from '../../services/troubleshootingCaseSyncService'
import {
  downloadTroubleshootingCasesJson,
  downloadTroubleshootingCaseTemplate,
  importTroubleshootingCases,
} from '../../utils/troubleshootingImportExport'
import { CaseEditor } from './CaseEditor'

type Props = {
  builtInCases: TroubleshootingCase[]
  customCases: TroubleshootingCase[]
  allCases: TroubleshootingCase[]
  onImport: (items: TroubleshootingCase[]) => void
  onReplaceCustom: (items: TroubleshootingCase[]) => void
  onClearCustom: () => void
  onClose: () => void
}

export function CaseManager({
  builtInCases,
  customCases,
  allCases,
  onImport,
  onReplaceCustom,
  onClearCustom,
  onClose,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [editorItem, setEditorItem] =
    useState<TroubleshootingCase | 'new' | null>(null)
  const [cloudStatus, setCloudStatus] =
    useState(getTroubleshootingCaseSyncStatus)

  useEffect(() => {
    const refreshStatus = (event: Event) => {
      const detail = (event as CustomEvent<TroubleshootingCaseSyncStatus>).detail
      setCloudStatus(detail ?? getTroubleshootingCaseSyncStatus())
    }
    window.addEventListener(
      TROUBLESHOOTING_CASE_SYNC_STATUS_CHANGED_EVENT,
      refreshStatus,
    )
    return () => window.removeEventListener(
      TROUBLESHOOTING_CASE_SYNC_STATUS_CHANGED_EVENT,
      refreshStatus,
    )
  }, [])

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
    let suffix = result.errors.length ? ` ${result.errors.join(' ')}` : ''
    if (result.importedCases.length) {
      const nextCases = [...customCases, ...result.importedCases]
      const session = await getActiveSession()
      if (session) {
        try {
          const syncResult = await syncTroubleshootingCases(
            session,
            nextCases,
            new Set(builtInCases.map((item) => item.caseId)),
          )
          onReplaceCustom(syncResult.cases)
          suffix += ' 已同步到云端。'
        } catch (error) {
          suffix += ` 已保存到本地，云同步失败，可稍后重试。${error instanceof Error ? ` ${error.message}` : ''}`
        }
      } else {
        suffix += ' 当前为本地案例模式，登录后可跨设备同步。'
      }
    }
    setMessage(`${parts.join('，')}。${suffix}`)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleClear() {
    if (!customCases.length) return
    if (!window.confirm(`确定清空 ${customCases.length} 个导入案例吗？内置案例不会受到影响。`)) return
    const session = await getActiveSession()
    if (session) {
      try {
        await deleteAllCloudTroubleshootingCases(session)
      } catch (error) {
        setMessage(`云端删除失败，本地案例未清空。${error instanceof Error ? ` ${error.message}` : ''}`)
        return
      }
    }
    onClearCustom()
    setMessage(session
      ? '已清空本地和云端自定义案例，内置案例保持不变。'
      : '已清空本地导入案例，内置案例保持不变。')
  }

  async function handleManualSync() {
    const session = await getActiveSession()
    if (!session) {
      setMessage('当前为本地案例模式，请登录后再同步故障案例。')
      return
    }
    try {
      const result = await syncTroubleshootingCases(
        session,
        customCases,
        new Set(builtInCases.map((item) => item.caseId)),
      )
      onReplaceCustom(result.cases)
      setMessage(`同步完成，本地与云端共有 ${result.cloudCount} 个自定义案例。`)
    } catch (error) {
      setMessage(`故障案例同步失败，本地案例已保留。${error instanceof Error ? ` ${error.message}` : ''}`)
    }
  }

  async function saveEditedCase(item: TroubleshootingCase) {
    const nextCases = customCases.some((candidate) => candidate.caseId === item.caseId)
      ? customCases.map((candidate) => candidate.caseId === item.caseId ? item : candidate)
      : [...customCases, item]
    onReplaceCustom(nextCases)
    setEditorItem(null)
    const session = await getActiveSession()
    if (!session) {
      setMessage('案例已保存到本地。登录后可跨 Web 与移动端同步。')
      return
    }
    try {
      const result = await syncTroubleshootingCases(
        session,
        nextCases,
        new Set(builtInCases.map((candidate) => candidate.caseId)),
      )
      onReplaceCustom(result.cases)
      setMessage('案例已保存并同步到云端。')
    } catch (error) {
      setMessage(`案例已保存到本地，云同步失败，可稍后重试。${error instanceof Error ? ` ${error.message}` : ''}`)
    }
  }

  async function deleteCase(item: TroubleshootingCase) {
    if (!window.confirm(`确定删除自定义案例“${item.title}”吗？此操作会同步删除云端案例。`)) return
    const session = await getActiveSession()
    if (session) {
      try {
        await deleteCloudTroubleshootingCase(session, item.caseId)
      } catch (error) {
        setMessage(`删除失败，本地案例未修改。${error instanceof Error ? ` ${error.message}` : ''}`)
        return
      }
    }
    onReplaceCustom(customCases.filter((candidate) => candidate.caseId !== item.caseId))
    setMessage(session ? '已删除本地和云端案例。' : '已删除本地案例。')
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-3" role="dialog" aria-modal="true" aria-label="案例管理">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-md border border-slate-200 bg-slate-50 shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
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

          <section className={`rounded-md border px-4 py-4 ${cloudStatus.loggedIn ? 'border-ocean-200 bg-ocean-50' : 'border-slate-200 bg-white'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${cloudStatus.loggedIn ? 'bg-white text-ocean-700' : 'bg-slate-100 text-slate-500'}`}>
                  {cloudStatus.loggedIn ? <Cloud size={18} /> : <CloudOff size={18} />}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-ink">{cloudStatus.loggedIn ? '故障案例云同步已开启' : '当前为本地案例模式'}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {cloudStatus.loggedIn
                      ? `本地 ${customCases.length} 个 · 云端 ${cloudStatus.cloudCount} 个 · 最近同步 ${formatDate(cloudStatus.lastSyncAt)}`
                      : '登录后可在 Web 与移动端同步自定义故障案例。'}
                  </p>
                  {cloudStatus.lastError && <p className="mt-1 text-xs text-rose-700">{cloudStatus.lastError}</p>}
                </div>
              </div>
              <Action icon={RefreshCw} label={cloudStatus.state === 'syncing' ? '同步中' : '同步故障案例'} onClick={() => void handleManualSync()} disabled={cloudStatus.state === 'syncing'} />
            </div>
          </section>

          {message && <div className="rounded-md border border-ocean-200 bg-ocean-50 px-4 py-3 text-sm leading-6 text-ocean-800">{message}</div>}

          {editorItem && (
            <CaseEditor
              item={editorItem === 'new' ? undefined : editorItem}
              onSave={(item) => void saveEditedCase(item)}
              onCancel={() => setEditorItem(null)}
            />
          )}

          <section className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div><h3 className="text-sm font-semibold text-ink">自定义案例</h3><p className="mt-1 text-xs text-slate-500">新增、编辑或删除自己的案例，内置案例保持只读。</p></div>
              <Action icon={Plus} label="新增案例" onClick={() => setEditorItem('new')} primary />
            </div>
            {customCases.length ? (
              <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                {customCases.map((item) => (
                  <div key={item.caseId} className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.databaseType} · {item.faultType} · {item.caseId}</p></div>
                    <button type="button" title="编辑案例" onClick={() => setEditorItem(item)} className="grid h-8 w-8 place-items-center text-slate-500 hover:bg-slate-100 hover:text-ocean-700"><Pencil size={15} /></button>
                    <button type="button" title="删除案例" onClick={() => void deleteCase(item)} className="grid h-8 w-8 place-items-center text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            ) : <p className="mt-4 border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-400">暂无自定义案例，可新增或导入 JSON。</p>}
          </section>

          <section className="flex flex-wrap gap-2 border-t border-slate-200 pt-5">
            <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0])} />
            <Action icon={Upload} label="导入案例 JSON" onClick={() => fileInputRef.current?.click()} primary />
            <Action icon={Download} label="导出全部案例 JSON" onClick={() => downloadTroubleshootingCasesJson(allCases)} />
            <Action icon={FileJson} label="下载案例模板" onClick={downloadTroubleshootingCaseTemplate} />
            <Action icon={Trash2} label="清空导入案例" onClick={() => void handleClear()} danger disabled={!customCases.length} />
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

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN') : '尚未同步'
}
