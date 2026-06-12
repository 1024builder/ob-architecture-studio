export type QuestionNavigationRequest = {
  questionId?: string
  questionIds?: string[]
  sourceLabel?: string
  requestId: number
}

export type CaseNavigationRequest = {
  caseId: string
  requestId: number
}
