import { obcpQuestions } from '../src/data/obcpQuestions'
import type { ObcpAnswerRecord } from '../src/data/obcpTypes'
import { calculateObcpAnalytics } from '../src/utils/obcpAnalytics'
import { generateDiagnosisJson, generateDiagnosisMarkdown } from '../src/utils/obcpExport'
import {
  appendAnswerRecord,
  createEmptyUserState,
  toggleFavorite,
  toggleNotUnderstood,
  toggleWrongBook,
} from '../src/utils/obcpStorage'

const emptyState = createEmptyUserState('acceptance-user')
const emptyAnalytics = calculateObcpAnalytics(emptyState, obcpQuestions)
const markdown = generateDiagnosisMarkdown(emptyAnalytics)
const json = JSON.parse(generateDiagnosisJson(emptyAnalytics)) as {
  userSummary: { totalAnswered: number; correctRate: number }
}

assert(emptyAnalytics.userSummary.totalAnswered === 0, 'empty total should be zero')
assert(emptyAnalytics.userSummary.correctRate === 0, 'empty correct rate should be zero')
assert(markdown.includes('累计刷题：0'), 'empty markdown should contain zero summary')
assert(markdown.includes('暂无错误题目'), 'empty markdown should contain friendly wrong-question state')
assert(!markdown.includes('undefined') && !markdown.includes('NaN'), 'empty markdown should not contain invalid values')
assert(json.userSummary.totalAnswered === 0 && json.userSummary.correctRate === 0, 'empty JSON should be valid')

const question = obcpQuestions[0]
const baseRecord: ObcpAnswerRecord = {
  id: 'acceptance-record',
  userId: emptyState.userId,
  questionId: question.questionId,
  selectedAnswer: ['A'],
  correctAnswer: question.answer,
  isCorrect: false,
  durationSeconds: 10,
  answeredAt: new Date().toISOString(),
  chapter: question.chapter,
  knowledgePoints: question.knowledgePoints,
  difficulty: question.difficulty,
  questionType: question.type,
  isFavorite: false,
  isWrongBook: true,
  retryCount: 0,
  isNotUnderstood: false,
}

let state = appendAnswerRecord(emptyState, baseRecord)
assert(state.wrongBookQuestionIds.includes(question.questionId), 'wrong answer should enter wrong book')
state = appendAnswerRecord(state, { ...baseRecord, id: 'acceptance-retry', selectedAnswer: question.answer, isCorrect: true, isWrongBook: false, retryCount: 1 })
assert(!state.wrongBookQuestionIds.includes(question.questionId), 'correct retry should leave wrong book')
state = toggleFavorite(state, question.questionId)
state = toggleWrongBook(state, question.questionId)
state = toggleNotUnderstood(state, question.questionId)
assert(state.favoriteQuestionIds.includes(question.questionId), 'favorite toggle should persist in state')
assert(state.wrongBookQuestionIds.includes(question.questionId), 'wrong-book toggle should persist in state')
assert(state.notUnderstoodQuestionIds.includes(question.questionId), 'not-understood toggle should persist in state')

console.log('OBCP acceptance checks passed')

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
