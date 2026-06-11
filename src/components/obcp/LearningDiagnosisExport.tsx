import { Check, ClipboardCopy, Eye, FileJson, FileText } from 'lucide-react'
import { useState } from 'react'
import type { ObcpAnalytics } from '../../data/obcpTypes'
import {
  downloadTextFile,
  generateDiagnosisJson,
  generateDiagnosisMarkdown,
} from '../../utils/obcpExport'

type Props = {
  analytics: ObcpAnalytics
  onView?: () => void
}

export function LearningDiagnosisExport({ analytics, onView }: Props) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle')

  async function copyForLlm() {
    const succeeded = await copyText(generateDiagnosisMarkdown(analytics))
    setCopyStatus(succeeded ? 'success' : 'error')
    window.setTimeout(() => setCopyStatus('idle'), 1800)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {onView && (
        <button
          type="button"
          onClick={onView}
          className="flex h-10 items-center gap-2 rounded-md bg-ocean-600 px-3 text-sm font-semibold text-white transition hover:bg-ocean-700"
        >
          <Eye size={16} />查看学习诊断
        </button>
      )}
      <button
        type="button"
        onClick={() => downloadTextFile('obcp-learning-diagnosis.md', generateDiagnosisMarkdown(analytics), 'text/markdown;charset=utf-8')}
        className={`flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${onView ? 'border border-slate-200 bg-white text-slate-600 hover:border-ocean-300 hover:text-ocean-700' : 'bg-ocean-600 text-white hover:bg-ocean-700'}`}
      >
        <FileText size={16} />导出学习诊断
      </button>
      <button
        type="button"
        onClick={() => downloadTextFile('obcp-learning-diagnosis.json', generateDiagnosisJson(analytics), 'application/json;charset=utf-8')}
        className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-ocean-300 hover:text-ocean-700"
      >
        <FileJson size={16} />导出 JSON
      </button>
      <button
        type="button"
        onClick={() => void copyForLlm()}
        aria-live="polite"
        className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-ocean-300 hover:text-ocean-700"
      >
        {copyStatus === 'success' ? <Check size={16} /> : <ClipboardCopy size={16} />}
        {copyStatus === 'success' ? '已复制' : copyStatus === 'error' ? '复制失败，请重试' : '复制给大模型分析'}
      </button>
    </div>
  )
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
    textarea.focus()
    textarea.select()
    const succeeded = document.execCommand('copy')
    textarea.remove()
    return succeeded
  }
}
