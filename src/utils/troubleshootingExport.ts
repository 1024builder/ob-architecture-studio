import type { TroubleshootingCase } from '../data/troubleshootingTypes'
import { downloadTextFile } from './obcpExport'

export function generateTroubleshootingMarkdown(item: TroubleshootingCase) {
  const lines = [
    `# 故障案例：${item.title}`,
    '',
    `- 案例 ID：${item.caseId}`,
    `- 数据库类型：${item.databaseType}`,
    `- 故障类型：${item.faultType}`,
    `- 严重等级：${item.severity}`,
    `- 状态：${item.status}`,
    `- 更新时间：${item.updatedAt}`,
    '',
    '## 1. 故障概述',
    '',
    item.summary,
    '',
    '## 2. 故障现象',
    '',
    ...bulletLines(item.symptoms),
    '',
    '## 3. 影响范围',
    '',
    item.impact,
    '',
    '## 4. 排查步骤',
    '',
    ...item.troubleshootingSteps.flatMap((step, index) => [
      `### ${index + 1}. ${step.title}`,
      '',
      step.description,
      ...(step.command ? ['', '```bash', step.command, '```'] : []),
      ...(step.expectedResult ? ['', `预期结果：${step.expectedResult}`] : []),
      '',
    ]),
    '## 5. 关键命令',
    '',
    ...item.commands.flatMap((command) => [
      `### ${command.title}`,
      '',
      command.description,
      '',
      '```bash',
      command.command,
      '```',
      '',
    ]),
    '## 6. 根因分析',
    '',
    item.rootCause,
    '',
    '## 7. 处理方案',
    '',
    ...bulletLines(item.solution),
    '',
    '## 8. 验证方法',
    '',
    ...bulletLines(item.verification),
    '',
    '## 9. 回退方案',
    '',
    ...(item.rollbackPlan?.length ? bulletLines(item.rollbackPlan) : ['- 当前案例未提供独立回退方案。']),
    '',
    '## 10. 经验总结',
    '',
    ...bulletLines(item.lessonsLearned),
    '',
    '## 11. 给大模型的分析提示词',
    '',
    generateTroubleshootingPrompt(item),
    '',
  ]
  return lines.join('\n')
}

export function generateTroubleshootingPrompt(item: TroubleshootingCase) {
  return `请基于以上 ${item.databaseType} 故障案例，复核排查顺序、根因证据和处理风险，并输出：1）可能遗漏的原因；2）建议补充采集的证据；3）处理方案的风险点；4）更安全的回退步骤；5）可转化为监控告警或自动巡检的规则。请区分已知事实与推测，不要执行任何命令。`
}

export function downloadTroubleshootingMarkdown(item: TroubleshootingCase) {
  const safeId = item.caseId.toLocaleLowerCase()
  downloadTextFile(
    `${safeId}.md`,
    generateTroubleshootingMarkdown(item),
    'text/markdown;charset=utf-8',
  )
}

export async function copyTroubleshootingForLlm(item: TroubleshootingCase) {
  const content = generateTroubleshootingMarkdown(item)
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

function bulletLines(items: string[]) {
  return items.map((item) => `- ${item}`)
}
