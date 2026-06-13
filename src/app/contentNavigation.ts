import type { ObcpPracticeMode } from '../data/obcpTypes'

export type QuestionNavigationRequest = {
  questionId?: string
  questionIds?: string[]
  sourceLabel?: string
  mode?: ObcpPracticeMode
  requestId: number
}

export type CaseNavigationRequest = {
  caseId: string
  requestId: number
}
