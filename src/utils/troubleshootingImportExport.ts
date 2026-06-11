import type {
  CaseCommand,
  TroubleshootingCase,
  TroubleshootingDatabaseType,
  TroubleshootingSeverity,
  TroubleshootingStatus,
  TroubleshootingStep,
} from '../data/troubleshootingTypes'
import { downloadTextFile } from './obcpExport'

export const TROUBLESHOOTING_CUSTOM_CASES_STORAGE_KEY =
  'ob-architecture-studio:troubleshooting-custom-cases'

export type TroubleshootingImportResult = {
  importedCases: TroubleshootingCase[]
  importedCount: number
  duplicateCount: number
  invalidCount: number
  errors: string[]
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
const severities: TroubleshootingSeverity[] = ['低', '中', '高']
const statuses: TroubleshootingStatus[] = ['已解决', '处理中', '待验证']

export function loadCustomTroubleshootingCases(): TroubleshootingCase[] {
  try {
    const raw = window.localStorage.getItem(TROUBLESHOOTING_CUSTOM_CASES_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      const validation = validateTroubleshootingCase(item)
      return validation.valid ? [validation.item] : []
    })
  } catch {
    return []
  }
}

export function saveCustomTroubleshootingCases(items: TroubleshootingCase[]) {
  try {
    window.localStorage.setItem(
      TROUBLESHOOTING_CUSTOM_CASES_STORAGE_KEY,
      JSON.stringify(items),
    )
  } catch {
    throw new Error('案例保存失败，请检查浏览器存储空间或隐私设置。')
  }
}

export function clearCustomTroubleshootingCases() {
  window.localStorage.removeItem(TROUBLESHOOTING_CUSTOM_CASES_STORAGE_KEY)
}

export function mergeTroubleshootingCases(
  builtInCases: TroubleshootingCase[],
  customCases: TroubleshootingCase[],
) {
  const merged = [...builtInCases]
  const knownIds = new Set(builtInCases.map((item) => item.caseId))
  customCases.forEach((item) => {
    if (!knownIds.has(item.caseId)) {
      merged.push(item)
      knownIds.add(item.caseId)
    }
  })
  return merged
}

export function importTroubleshootingCases(
  raw: string,
  existingCases: TroubleshootingCase[],
): TroubleshootingImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return emptyResult('文件不是有效的 JSON。')
  }

  const candidates = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.cases)
      ? parsed.cases
      : null
  if (!candidates) {
    return emptyResult('案例库根节点必须是案例数组，或包含 cases 数组。')
  }

  const existingIds = new Set(existingCases.map((item) => item.caseId))
  const importedIds = new Set<string>()
  const importedCases: TroubleshootingCase[] = []
  const errors: string[] = []
  let duplicateCount = 0
  let invalidCount = 0

  candidates.forEach((candidate, index) => {
    const validation = validateTroubleshootingCase(candidate)
    if (!validation.valid) {
      invalidCount += 1
      errors.push(`第 ${index + 1} 项：${validation.error}`)
      return
    }
    if (existingIds.has(validation.item.caseId) || importedIds.has(validation.item.caseId)) {
      duplicateCount += 1
      return
    }
    importedIds.add(validation.item.caseId)
    importedCases.push(validation.item)
  })

  return {
    importedCases,
    importedCount: importedCases.length,
    duplicateCount,
    invalidCount,
    errors: errors.slice(0, 5),
  }
}

export function downloadTroubleshootingCasesJson(items: TroubleshootingCase[]) {
  downloadTextFile(
    'troubleshooting-case-library.json',
    JSON.stringify(items, null, 2),
    'application/json;charset=utf-8',
  )
}

export function downloadTroubleshootingCaseTemplate() {
  downloadTextFile(
    'troubleshooting-case-template.json',
    JSON.stringify([troubleshootingCaseTemplate], null, 2),
    'application/json;charset=utf-8',
  )
}

function validateTroubleshootingCase(
  value: unknown,
): { valid: true; item: TroubleshootingCase } | { valid: false; error: string } {
  if (!isRecord(value)) return { valid: false, error: '案例必须是对象。' }

  for (const field of ['caseId', 'title', 'faultType', 'summary', 'rootCause'] as const) {
    if (!isNonEmptyString(value[field])) {
      return { valid: false, error: `缺少有效字段 ${field}。` }
    }
  }
  if (!databaseTypes.includes(value.databaseType as TroubleshootingDatabaseType)) {
    return { valid: false, error: 'databaseType 不在支持范围内。' }
  }
  if (!severities.includes(value.severity as TroubleshootingSeverity)) {
    return { valid: false, error: 'severity 必须为低、中或高。' }
  }
  for (const field of ['symptoms', 'solution', 'tags'] as const) {
    if (!isStringArray(value[field], true)) {
      return { valid: false, error: `${field} 必须是非空字符串数组。` }
    }
  }

  const now = new Date().toISOString()
  return {
    valid: true,
    item: {
      caseId: value.caseId as string,
      title: value.title as string,
      databaseType: value.databaseType as TroubleshootingDatabaseType,
      faultType: value.faultType as string,
      severity: value.severity as TroubleshootingSeverity,
      status: statuses.includes(value.status as TroubleshootingStatus)
        ? value.status as TroubleshootingStatus
        : '待验证',
      summary: value.summary as string,
      symptoms: [...value.symptoms as string[]],
      impact: isNonEmptyString(value.impact) ? value.impact : '导入案例未提供影响范围说明。',
      rootCause: value.rootCause as string,
      troubleshootingSteps: normalizeSteps(value.troubleshootingSteps),
      commands: normalizeCommands(value.commands),
      solution: [...value.solution as string[]],
      verification: isStringArray(value.verification) ? [...value.verification] : [],
      rollbackPlan: isStringArray(value.rollbackPlan) ? [...value.rollbackPlan] : undefined,
      lessonsLearned: isStringArray(value.lessonsLearned) ? [...value.lessonsLearned] : [],
      relatedComponents: isStringArray(value.relatedComponents) ? [...value.relatedComponents] : [],
      relatedKnowledgePoints: isStringArray(value.relatedKnowledgePoints) ? [...value.relatedKnowledgePoints] : [],
      tags: [...value.tags as string[]],
      createdAt: isNonEmptyString(value.createdAt) ? value.createdAt : now,
      updatedAt: isNonEmptyString(value.updatedAt) ? value.updatedAt : now,
    },
  }
}

function normalizeSteps(value: unknown): TroubleshootingStep[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((step) => {
    if (!isRecord(step) || !isNonEmptyString(step.title) || !isNonEmptyString(step.description)) return []
    return [{
      title: step.title,
      description: step.description,
      command: isNonEmptyString(step.command) ? step.command : undefined,
      expectedResult: isNonEmptyString(step.expectedResult) ? step.expectedResult : undefined,
    }]
  })
}

function normalizeCommands(value: unknown): CaseCommand[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((command) => {
    if (!isRecord(command) || !isNonEmptyString(command.title) || !isNonEmptyString(command.command)) return []
    return [{
      title: command.title,
      command: command.command,
      description: isNonEmptyString(command.description) ? command.description : '',
    }]
  })
}

function emptyResult(error: string): TroubleshootingImportResult {
  return { importedCases: [], importedCount: 0, duplicateCount: 0, invalidCount: 1, errors: [error] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown, requireItems = false): value is string[] {
  return Array.isArray(value)
    && (!requireItems || value.length > 0)
    && value.every(isNonEmptyString)
}

const troubleshootingCaseTemplate: TroubleshootingCase = {
  caseId: 'CUSTOM-CASE-001',
  title: '自定义故障案例标题',
  databaseType: 'OceanBase',
  faultType: '性能异常',
  severity: '中',
  status: '待验证',
  summary: '简要描述故障背景和核心问题。',
  symptoms: ['故障现象一', '故障现象二'],
  impact: '描述业务、数据或监控受到的影响。',
  rootCause: '描述经过证据验证的根因。',
  troubleshootingSteps: [
    {
      title: '确认故障范围',
      description: '收集时间窗口、影响对象和关键日志。',
      command: '示例检查命令',
      expectedResult: '描述预期结果。',
    },
  ],
  commands: [
    {
      title: '示例命令',
      command: '示例检查命令',
      description: '说明命令用途和执行注意事项。',
    },
  ],
  solution: ['处理步骤一', '处理步骤二'],
  verification: ['验证指标恢复', '验证业务功能正常'],
  rollbackPlan: ['描述回退条件和步骤'],
  lessonsLearned: ['描述可沉淀的经验和预防措施'],
  relatedComponents: ['OBServer'],
  relatedKnowledgePoints: ['故障诊断'],
  tags: ['自定义案例', '示例'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}
