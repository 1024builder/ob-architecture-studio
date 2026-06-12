import { Save, X } from 'lucide-react'
import { useState } from 'react'
import type {
  TroubleshootingCase,
  TroubleshootingDatabaseType,
  TroubleshootingSeverity,
} from '../../data/troubleshootingTypes'

type Props = {
  item?: TroubleshootingCase
  onSave: (item: TroubleshootingCase) => void
  onCancel: () => void
}

const databaseTypes: TroubleshootingDatabaseType[] = [
  'OceanBase',
  'MySQL',
  'Oracle',
  'PostgreSQL',
  'SQL Server',
  'Redis',
  'InfluxDB',
  'Linux',
  'Platform',
]

export function CaseEditor({ item, onSave, onCancel }: Props) {
  const [form, setForm] = useState(() => toForm(item))
  const [error, setError] = useState('')

  function submit() {
    if (!form.title.trim() || !form.faultType.trim() || !form.summary.trim()
      || !form.symptoms.trim() || !form.rootCause.trim() || !form.solution.trim()
      || !form.tags.trim()) {
      setError('请填写标题、故障类型、摘要、故障现象、根因、处理方案和标签。')
      return
    }
    const now = new Date().toISOString()
    const commands = splitLines(form.commands).map((command, index) => ({
      title: `排查命令 ${index + 1}`,
      command,
      description: '自定义案例录入的排查命令。',
    }))
    onSave({
      ...(item ?? emptyCase(now)),
      caseId: item?.caseId ?? `custom_case_${Date.now()}`,
      title: form.title.trim(),
      databaseType: form.databaseType,
      faultType: form.faultType.trim(),
      severity: form.severity,
      summary: form.summary.trim(),
      symptoms: splitLines(form.symptoms),
      impact: form.impact.trim() || '尚未补充影响范围。',
      rootCause: form.rootCause.trim(),
      solution: splitLines(form.solution),
      commands,
      troubleshootingSteps: commands.map((command) => ({
        title: command.title,
        description: command.description,
        command: command.command,
      })),
      tags: splitComma(form.tags),
      source: item?.source ?? 'manual_create',
      createdAt: item?.createdAt ?? now,
      updatedAt: now,
    })
  }

  return (
    <section className="rounded-md border border-ocean-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{item ? '编辑自定义案例' : '新增自定义案例'}</h3>
          <p className="mt-1 text-xs text-slate-500">基础字段先本地保存，登录后自动尝试云同步。</p>
        </div>
        <button type="button" title="取消编辑" onClick={onCancel} className="grid h-8 w-8 place-items-center text-slate-400 hover:text-slate-700"><X size={16} /></button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="标题" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
        <Field label="故障类型" value={form.faultType} onChange={(value) => setForm({ ...form, faultType: value })} />
        <SelectField label="数据库类型" value={form.databaseType} options={databaseTypes} onChange={(value) => setForm({ ...form, databaseType: value as TroubleshootingDatabaseType })} />
        <SelectField label="严重等级" value={form.severity} options={['低', '中', '高']} onChange={(value) => setForm({ ...form, severity: value as TroubleshootingSeverity })} />
      </div>
      <div className="mt-3 grid gap-3">
        <TextArea label="案例摘要" value={form.summary} rows={2} onChange={(value) => setForm({ ...form, summary: value })} />
        <TextArea label="故障现象（每行一项）" value={form.symptoms} rows={3} onChange={(value) => setForm({ ...form, symptoms: value })} />
        <TextArea label="影响范围" value={form.impact} rows={2} onChange={(value) => setForm({ ...form, impact: value })} />
        <TextArea label="根因分析" value={form.rootCause} rows={3} onChange={(value) => setForm({ ...form, rootCause: value })} />
        <TextArea label="处理方案（每行一项）" value={form.solution} rows={3} onChange={(value) => setForm({ ...form, solution: value })} />
        <TextArea label="排查命令（每行一条）" value={form.commands} rows={4} monospace onChange={(value) => setForm({ ...form, commands: value })} />
        <Field label="标签（逗号分隔）" value={form.tags} onChange={(value) => setForm({ ...form, tags: value })} />
      </div>
      {error && <p className="mt-3 text-xs text-rose-700">{error}</p>}
      <button type="button" onClick={submit} className="mt-4 flex h-10 items-center gap-2 rounded-md bg-ocean-600 px-4 text-sm font-semibold text-white hover:bg-ocean-700">
        <Save size={16} />保存案例
      </button>
    </section>
  )
}

function emptyCase(now: string): TroubleshootingCase {
  return {
    caseId: '',
    title: '',
    databaseType: 'OceanBase',
    faultType: '',
    severity: '中',
    status: '待验证',
    summary: '',
    symptoms: [],
    impact: '',
    rootCause: '',
    troubleshootingSteps: [],
    commands: [],
    solution: [],
    verification: [],
    lessonsLearned: [],
    relatedComponents: [],
    relatedKnowledgePoints: [],
    tags: [],
    source: 'manual_create',
    createdAt: now,
    updatedAt: now,
  }
}

function toForm(item?: TroubleshootingCase) {
  return {
    title: item?.title ?? '',
    databaseType: item?.databaseType ?? 'OceanBase' as TroubleshootingDatabaseType,
    faultType: item?.faultType ?? '',
    severity: item?.severity ?? '中' as TroubleshootingSeverity,
    summary: item?.summary ?? '',
    symptoms: item?.symptoms.join('\n') ?? '',
    impact: item?.impact ?? '',
    rootCause: item?.rootCause ?? '',
    solution: item?.solution.join('\n') ?? '',
    commands: item?.commands.map((command) => command.command).join('\n') ?? '',
    tags: item?.tags.join(', ') ?? '',
  }
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-slate-600">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm font-normal text-ink outline-none focus:border-ocean-400 focus:ring-2 focus:ring-ocean-100" /></label>
}

function TextArea({ label, value, rows, monospace, onChange }: { label: string; value: string; rows: number; monospace?: boolean; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-slate-600">{label}<textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} className={`resize-y rounded-md border border-slate-200 px-3 py-2 text-sm font-normal text-ink outline-none focus:border-ocean-400 focus:ring-2 focus:ring-ocean-100 ${monospace ? 'font-mono' : ''}`} /></label>
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-slate-600">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-ink outline-none focus:border-ocean-400 focus:ring-2 focus:ring-ocean-100">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
}

function splitLines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
}

function splitComma(value: string) {
  return value.split(/[,，]/).map((item) => item.trim()).filter(Boolean)
}
