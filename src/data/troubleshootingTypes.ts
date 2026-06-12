export type TroubleshootingDatabaseType =
  | 'OceanBase'
  | 'MySQL'
  | 'Oracle'
  | 'PostgreSQL'
  | 'SQL Server'
  | 'Redis'
  | 'InfluxDB'
  | 'Linux'
  | 'Platform'

export type TroubleshootingSeverity = '低' | '中' | '高'
export type TroubleshootingStatus = '已解决' | '处理中' | '待验证'

export type TroubleshootingStep = {
  title: string
  description: string
  command?: string
  expectedResult?: string
}

export type CaseCommand = {
  title: string
  command: string
  description: string
}

export type TroubleshootingCase = {
  caseId: string
  title: string
  databaseType: TroubleshootingDatabaseType
  faultType: string
  severity: TroubleshootingSeverity
  status: TroubleshootingStatus
  summary: string
  symptoms: string[]
  impact: string
  rootCause: string
  troubleshootingSteps: TroubleshootingStep[]
  commands: CaseCommand[]
  solution: string[]
  verification: string[]
  rollbackPlan?: string[]
  lessonsLearned: string[]
  relatedComponents: string[]
  relatedKnowledgePoints: string[]
  tags: string[]
  source?: 'built_in' | 'manual_create' | 'json_import' | string
  createdAt: string
  updatedAt: string
}
