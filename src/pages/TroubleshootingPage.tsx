import { AlertTriangle, CheckCircle2, Database, FolderCog, Search, ShieldCheck, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CaseDetail } from '../components/troubleshooting/CaseDetail'
import { CaseList } from '../components/troubleshooting/CaseList'
import { CaseManager } from '../components/troubleshooting/CaseManager'
import { troubleshootingCases } from '../data/troubleshootingCases'
import type { TroubleshootingSeverity } from '../data/troubleshootingTypes'
import {
  clearCustomTroubleshootingCases,
  loadCustomTroubleshootingCases,
  mergeTroubleshootingCases,
  saveCustomTroubleshootingCases,
} from '../utils/troubleshootingImportExport'

export function TroubleshootingPage() {
  const [customCases, setCustomCases] = useState(loadCustomTroubleshootingCases)
  const [managerOpen, setManagerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [databaseType, setDatabaseType] = useState('全部')
  const [faultType, setFaultType] = useState('全部')
  const [severity, setSeverity] = useState<'全部' | TroubleshootingSeverity>('全部')
  const [selectedCaseId, setSelectedCaseId] = useState(troubleshootingCases[0]?.caseId)

  const allCases = useMemo(
    () => mergeTroubleshootingCases(troubleshootingCases, customCases),
    [customCases],
  )
  const databaseTypes = useMemo(() => unique(allCases.map((item) => item.databaseType)), [allCases])
  const faultTypes = useMemo(() => unique(allCases.map((item) => item.faultType)), [allCases])
  const filteredCases = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase()
    return allCases.filter((item) => {
      const matchesQuery = !query || [
        item.title,
        item.summary,
        item.databaseType,
        item.faultType,
        ...item.symptoms,
        ...item.tags,
        ...item.relatedKnowledgePoints,
      ].some((value) => value.toLocaleLowerCase().includes(query))
      return matchesQuery
        && (databaseType === '全部' || item.databaseType === databaseType)
        && (faultType === '全部' || item.faultType === faultType)
        && (severity === '全部' || item.severity === severity)
    })
  }, [allCases, databaseType, faultType, searchQuery, severity])

  useEffect(() => {
    if (filteredCases.length && !filteredCases.some((item) => item.caseId === selectedCaseId)) {
      setSelectedCaseId(filteredCases[0].caseId)
    }
  }, [filteredCases, selectedCaseId])

  const selectedCase = filteredCases.find((item) => item.caseId === selectedCaseId)
  const highSeverityCount = allCases.filter((item) => item.severity === '高').length
  const resolvedCount = allCases.filter((item) => item.status === '已解决').length

  return (
    <div className="space-y-5 p-3 sm:p-4 lg:p-5">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-ocean-600">DBA Case Lab</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">故障案例</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">沉淀数据库与监控平台故障的排查证据、关键命令、根因和处理方案。</p>
        </div>
        <button type="button" onClick={() => setManagerOpen(true)} className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-ocean-300 hover:text-ocean-700">
          <FolderCog size={16} />案例管理
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Database} label="总案例数" value={allCases.length} tone="ocean" />
        <Metric icon={AlertTriangle} label="高严重等级" value={highSeverityCount} tone="rose" />
        <Metric icon={CheckCircle2} label="已解决案例" value={resolvedCount} tone="green" />
        <Metric icon={ShieldCheck} label="数据库类型" value={databaseTypes.length} tone="violet" />
      </section>

      <section className="grid gap-3 border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_13rem_13rem_10rem]">
        <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 focus-within:border-ocean-400 focus-within:ring-2 focus-within:ring-ocean-100">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索标题、现象、标签或知识点" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          {searchQuery && <button type="button" title="清空搜索" onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-700"><X size={15} /></button>}
        </label>
        <FilterSelect label="数据库类型" value={databaseType} options={databaseTypes} onChange={setDatabaseType} />
        <FilterSelect label="故障类型" value={faultType} options={faultTypes} onChange={setFaultType} />
        <FilterSelect label="严重等级" value={severity} options={['低', '中', '高']} onChange={(value) => setSeverity(value as typeof severity)} />
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.6fr)]">
        <div className="xl:sticky xl:top-24">
          <div className="mb-3 flex items-end justify-between">
            <div><p className="text-xs font-semibold uppercase text-slate-400">Cases</p><h2 className="mt-1 text-lg font-semibold text-ink">案例列表</h2></div>
            <span className="text-xs text-slate-400">{filteredCases.length} / {allCases.length}</span>
          </div>
          <CaseList cases={filteredCases} selectedCaseId={selectedCaseId} onSelect={setSelectedCaseId} />
        </div>
        {selectedCase
          ? <CaseDetail item={selectedCase} />
          : <div className="hidden min-h-72 place-items-center border border-dashed border-slate-300 bg-white text-sm text-slate-400 xl:grid">调整筛选条件后查看案例详情</div>}
      </section>
      {managerOpen && (
        <CaseManager
          builtInCases={troubleshootingCases}
          customCases={customCases}
          allCases={allCases}
          onImport={(items) => {
            const next = [...customCases, ...items]
            saveCustomTroubleshootingCases(next)
            setCustomCases(next)
          }}
          onClearCustom={() => {
            clearCustomTroubleshootingCases()
            setCustomCases([])
          }}
          onClose={() => setManagerOpen(false)}
        />
      )}
    </div>
  )
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Database; label: string; value: number; tone: 'ocean' | 'rose' | 'green' | 'violet' }) {
  const tones = { ocean: 'bg-ocean-50 text-ocean-700', rose: 'bg-rose-50 text-rose-700', green: 'bg-emerald-50 text-emerald-700', violet: 'bg-violet-50 text-violet-700' }
  return <div className="flex min-h-24 items-center gap-3 border border-slate-200 bg-white px-4 shadow-sm"><span className={`grid h-11 w-11 place-items-center rounded-md ${tones[tone]}`}><Icon size={20} /></span><div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-ink">{value}</p></div></div>
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="grid gap-1"><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-ocean-400 focus:ring-2 focus:ring-ocean-100"><option value="全部">{label}：全部</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
}

function unique(items: string[]) {
  return Array.from(new Set(items)).sort((left, right) => left.localeCompare(right, 'zh-CN'))
}
