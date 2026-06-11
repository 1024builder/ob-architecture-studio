import {
  Check,
  CheckCircle2,
  ClipboardCopy,
  Download,
  Lightbulb,
  RotateCcw,
  ShieldAlert,
  Terminal,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { TroubleshootingCase } from '../../data/troubleshootingTypes'
import {
  copyTroubleshootingForLlm,
  downloadTroubleshootingMarkdown,
} from '../../utils/troubleshootingExport'

type Props = {
  item: TroubleshootingCase
}

export function CaseDetail({ item }: Props) {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle')

  async function copyCommand(title: string, command: string) {
    const succeeded = await copyText(command)
    setCopiedCommand(succeeded ? title : null)
    window.setTimeout(() => setCopiedCommand(null), 1600)
  }

  async function copyForLlm() {
    const succeeded = await copyTroubleshootingForLlm(item)
    setCopyStatus(succeeded ? 'success' : 'error')
    window.setTimeout(() => setCopyStatus('idle'), 1800)
  }

  return (
    <article className="border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-ocean-700">{item.databaseType}</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-500">{item.faultType}</span>
              <span className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-600">{item.status}</span>
              <span className={`rounded px-2 py-1 font-semibold ${item.severity === '高' ? 'bg-rose-100 text-rose-700' : item.severity === '中' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{item.severity}严重等级</span>
            </div>
            <h2 className="mt-3 text-xl font-semibold leading-8 text-ink">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={() => downloadTroubleshootingMarkdown(item)} className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:border-ocean-300 hover:text-ocean-700"><Download size={15} />导出 Markdown</button>
            <button type="button" onClick={() => void copyForLlm()} className="flex h-9 items-center gap-2 rounded-md bg-ocean-600 px-3 text-sm font-semibold text-white hover:bg-ocean-700">
              {copyStatus === 'success' ? <Check size={15} /> : <ClipboardCopy size={15} />}
              {copyStatus === 'success' ? '已复制' : copyStatus === 'error' ? '复制失败' : '复制给大模型分析'}
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-7 px-4 py-5 sm:px-6">
        <DetailSection title="故障现象" icon={ShieldAlert}>
          <BulletList items={item.symptoms} />
        </DetailSection>

        <div className="grid gap-5 lg:grid-cols-2">
          <InfoBlock title="影响范围" content={item.impact} tone="amber" />
          <InfoBlock title="根因分析" content={item.rootCause} tone="rose" />
        </div>

        <DetailSection title="排查步骤" icon={CheckCircle2}>
          <ol className="space-y-3">
            {item.troubleshootingSteps.map((step, index) => (
              <li key={`${step.title}-${index}`} className="border-l-2 border-ocean-200 pl-4">
                <p className="text-sm font-semibold text-ink">{index + 1}. {step.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
                {step.command && <pre className="mt-2 overflow-x-auto bg-slate-950 px-3 py-2 text-xs leading-5 text-slate-100"><code>{step.command}</code></pre>}
                {step.expectedResult && <p className="mt-2 text-xs leading-5 text-emerald-700">预期：{step.expectedResult}</p>}
              </li>
            ))}
          </ol>
        </DetailSection>

        <DetailSection title="关键命令" icon={Terminal}>
          <div className="grid gap-3">
            {item.commands.map((command) => (
              <div key={command.title} className="overflow-hidden border border-slate-200">
                <div className="flex items-center justify-between gap-3 bg-slate-50 px-3 py-2">
                  <div><p className="text-sm font-semibold text-ink">{command.title}</p><p className="mt-0.5 text-xs text-slate-500">{command.description}</p></div>
                  <button type="button" title={`复制${command.title}`} onClick={() => void copyCommand(command.title, command.command)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-white hover:text-ocean-700">
                    {copiedCommand === command.title ? <Check size={15} /> : <ClipboardCopy size={15} />}
                  </button>
                </div>
                <pre className="overflow-x-auto bg-slate-950 px-4 py-3 text-xs leading-5 text-slate-100"><code>{command.command}</code></pre>
              </div>
            ))}
          </div>
        </DetailSection>

        <div className="grid gap-5 lg:grid-cols-2">
          <DetailSection title="处理方案" icon={CheckCircle2}><BulletList items={item.solution} /></DetailSection>
          <DetailSection title="验证方法" icon={Check}><BulletList items={item.verification} /></DetailSection>
          {item.rollbackPlan?.length && <DetailSection title="回退方案" icon={RotateCcw}><BulletList items={item.rollbackPlan} /></DetailSection>}
          <DetailSection title="经验总结" icon={Lightbulb}><BulletList items={item.lessonsLearned} /></DetailSection>
        </div>

        <section className="border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold text-ink">相关组件与知识点</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.relatedComponents.map((component) => <span key={component} className="rounded bg-ocean-50 px-2 py-1 text-xs font-semibold text-ocean-700">{component}</span>)}
            {item.relatedKnowledgePoints.map((point) => <span key={point} className="rounded bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">{point}</span>)}
          </div>
        </section>
      </div>
    </article>
  )
}

function DetailSection({ title, icon: Icon, children }: { title: string; icon: typeof Terminal; children: ReactNode }) {
  return <section><h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><Icon size={17} className="text-ocean-600" />{title}</h3><div className="mt-3">{children}</div></section>
}

function BulletList({ items }: { items: string[] }) {
  return <ul className="space-y-2">{items.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-slate-600"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ocean-500" />{item}</li>)}</ul>
}

function InfoBlock({ title, content, tone }: { title: string; content: string; tone: 'amber' | 'rose' }) {
  const styles = tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-rose-200 bg-rose-50 text-rose-900'
  return <section className={`border p-4 ${styles}`}><h3 className="text-sm font-semibold">{title}</h3><p className="mt-2 text-sm leading-6">{content}</p></section>
}

async function copyText(content: string) {
  try {
    await navigator.clipboard.writeText(content)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = content
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const succeeded = document.execCommand('copy')
    textarea.remove()
    return succeeded
  }
}
