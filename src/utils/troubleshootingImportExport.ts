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
export const TROUBLESHOOTING_CUSTOM_CASES_CHANGED_EVENT =
  'ob-architecture-studio:troubleshooting-custom-cases-changed'

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
      return validation.valid
        ? [{ ...validation.item, source: validation.item.source ?? 'json_import' }]
        : []
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
    window.dispatchEvent(new CustomEvent(TROUBLESHOOTING_CUSTOM_CASES_CHANGED_EVENT))
  } catch {
    throw new Error('案例保存失败，请检查浏览器存储空间或隐私设置。')
  }
}

export function clearCustomTroubleshootingCases() {
  window.localStorage.removeItem(TROUBLESHOOTING_CUSTOM_CASES_STORAGE_KEY)
  window.dispatchEvent(new CustomEvent(TROUBLESHOOTING_CUSTOM_CASES_CHANGED_EVENT))
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
    importedCases.push({
      ...validation.item,
      source: validation.item.source ?? 'json_import',
    })
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

export function validateTroubleshootingCase(
  value: unknown,
): { valid: true; item: TroubleshootingCase } | { valid: false; error: string } {
  if (!isRecord(value)) return { valid: false, error: '案例必须是对象。' }

  const normalized = normalizeLegacyCaseFields(value)
  for (const field of ['caseId', 'title', 'faultType', 'summary', 'rootCause'] as const) {
    if (!isNonEmptyString(normalized[field])) {
      return { valid: false, error: `缺少有效字段 ${field}。` }
    }
  }
  if (!databaseTypes.includes(normalized.databaseType as TroubleshootingDatabaseType)) {
    return { valid: false, error: 'databaseType 不在支持范围内。' }
  }
  if (!severities.includes(normalized.severity as TroubleshootingSeverity)) {
    return { valid: false, error: 'severity 必须为低、中或高。' }
  }
  for (const field of ['symptoms', 'solution', 'tags'] as const) {
    if (!isStringArray(normalized[field], true)) {
      return { valid: false, error: `${field} 必须是非空字符串数组。` }
    }
  }

  const now = new Date().toISOString()
  return {
    valid: true,
    item: {
      caseId: normalized.caseId as string,
      title: normalized.title as string,
      databaseType: normalized.databaseType as TroubleshootingDatabaseType,
      faultType: normalized.faultType as string,
      severity: normalized.severity as TroubleshootingSeverity,
      status: statuses.includes(normalized.status as TroubleshootingStatus)
        ? normalized.status as TroubleshootingStatus
        : '待验证',
      summary: normalized.summary as string,
      symptoms: [...normalized.symptoms as string[]],
      impact: isNonEmptyString(normalized.impact) ? normalized.impact : '导入案例未提供影响范围说明。',
      rootCause: normalized.rootCause as string,
      troubleshootingSteps: normalizeSteps(normalized.troubleshootingSteps),
      commands: normalizeCommands(normalized.commands),
      solution: [...normalized.solution as string[]],
      verification: isStringArray(normalized.verification) ? [...normalized.verification] : [],
      rollbackPlan: isStringArray(normalized.rollbackPlan) ? [...normalized.rollbackPlan] : undefined,
      lessonsLearned: isStringArray(normalized.lessonsLearned) ? [...normalized.lessonsLearned] : [],
      relatedComponents: isStringArray(normalized.relatedComponents) ? [...normalized.relatedComponents] : [],
      relatedKnowledgePoints: isStringArray(normalized.relatedKnowledgePoints) ? [...normalized.relatedKnowledgePoints] : [],
      tags: [...normalized.tags as string[]],
      source: isNonEmptyString(normalized.source) ? normalized.source : undefined,
      createdAt: isNonEmptyString(normalized.createdAt) ? normalized.createdAt : now,
      updatedAt: isNonEmptyString(normalized.updatedAt) ? normalized.updatedAt : now,
    },
  }
}

function normalizeLegacyCaseFields(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...value,
    caseId: value.caseId ?? value.case_id,
    databaseType: value.databaseType ?? value.database_type,
    faultType: value.faultType ?? value.fault_type,
    rootCause: value.rootCause ?? value.root_cause,
    troubleshootingSteps: value.troubleshootingSteps ?? value.troubleshooting_steps,
    lessonsLearned: value.lessonsLearned ?? value.lessons_learned,
    rollbackPlan: value.rollbackPlan ?? value.rollback_plan,
    relatedComponents: value.relatedComponents ?? value.related_components,
    relatedKnowledgePoints: value.relatedKnowledgePoints ?? value.related_knowledge_points,
    createdAt: value.createdAt ?? value.created_at,
    updatedAt: value.updatedAt ?? value.updated_at,
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
  source: 'json_import',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}
