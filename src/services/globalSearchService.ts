import { componentDetails } from '../data/components'
import { architectureModels } from '../data/models'
import { obcpQuestions } from '../data/obcpQuestions'
import type { ObcpUserState } from '../data/obcpTypes'
import { troubleshootingCases } from '../data/troubleshootingCases'
import {
  loadCustomObcpQuestions,
  mergeObcpQuestions,
} from '../utils/obcpQuestionImportExport'
import {
  loadCustomTroubleshootingCases,
  mergeTroubleshootingCases,
} from '../utils/troubleshootingImportExport'

export type GlobalSearchResultType =
  'question' | 'case' | 'architecture' | 'command'

export type GlobalSearchResult = {
  id: string
  type: GlobalSearchResultType
  title: string
  summary: string
  source: string
  matchedField: string
  matchedText: string
  score: number
  target: {
    questionId?: string
    caseId?: string
    modelId?: string
    nodeId?: string
    componentName?: string
  }
}

export type GlobalSearchGroups = Record<
  GlobalSearchResultType,
  GlobalSearchResult[]
>

export const GLOBAL_SEARCH_RECENT_STORAGE_KEY =
  'ob-architecture-studio:global-search-recent'

export function searchGlobalKnowledge(
  rawQuery: string,
  userState?: ObcpUserState,
): GlobalSearchGroups {
  const query = normalize(rawQuery)
  const empty = createEmptyGroups()
  if (!query) return empty

  const customQuestions = loadCustomObcpQuestions()
  const questions = mergeObcpQuestions(obcpQuestions, customQuestions)
  const customQuestionIds = new Set(customQuestions.map((item) => item.questionId))
  const customCases = loadCustomTroubleshootingCases()
  const cases = mergeTroubleshootingCases(troubleshootingCases, customCases)
  const customCaseIds = new Set(customCases.map((item) => item.caseId))
  const favoriteIds = new Set(userState?.favoriteQuestionIds ?? [])
  const wrongIds = new Set(userState?.wrongBookQuestionIds ?? [])

  questions.forEach((question) => {
    const fields = [
      ['题干', question.stem],
      ['章节', question.chapter],
      ['知识点', question.knowledgePoints.join(' ')],
      ['标签', question.tags.join(' ')],
      ['选项', question.options.map((option) => option.text).join(' ')],
      ['解析', question.explanation],
    ] as const
    const match = bestMatch(query, question.stem, question.tags, fields)
    if (!match) return
    empty.question.push({
      id: `question:${question.questionId}`,
      type: 'question',
      title: question.stem,
      summary: `${question.chapter} · ${question.knowledgePoints.join('、')}`,
      source: customQuestionIds.has(question.questionId) ? '自定义题库' : '内置题库',
      matchedField: match.field,
      matchedText: match.text,
      score: match.score
        + (favoriteIds.has(question.questionId) ? 12 : 0)
        + (wrongIds.has(question.questionId) ? 8 : 0),
      target: { questionId: question.questionId },
    })
  })

  cases.forEach((item) => {
    const fields = [
      ['标题', item.title],
      ['数据库', item.databaseType],
      ['故障类型', item.faultType],
      ['现象', item.symptoms.join(' ')],
      ['根因', item.rootCause],
      ['方案', item.solution.join(' ')],
      ['命令', item.commands.map((command) => command.command).join(' ')],
      ['标签', item.tags.join(' ')],
    ] as const
    const match = bestMatch(query, item.title, item.tags, fields)
    if (match) {
      empty.case.push({
        id: `case:${item.caseId}`,
        type: 'case',
        title: item.title,
        summary: `${item.databaseType} · ${item.faultType} · ${item.summary}`,
        source: customCaseIds.has(item.caseId) ? '自定义故障案例' : '内置故障案例',
        matchedField: match.field,
        matchedText: match.text,
        score: match.score + (item.severity === '高' ? 10 : item.severity === '中' ? 4 : 0),
        target: { caseId: item.caseId },
      })
    }
    item.commands.forEach((command, index) => {
      const commandMatch = matchText(query, command.command)
        ?? matchText(query, command.title)
      if (!commandMatch) return
      empty.command.push({
        id: `case-command:${item.caseId}:${index}`,
        type: 'command',
        title: command.title,
        summary: command.command,
        source: `故障案例 · ${item.title}`,
        matchedField: '排查命令',
        matchedText: command.command,
        score: commandMatch.score + 5,
        target: { caseId: item.caseId },
      })
    })
  })

  architectureModels.forEach((model) => {
    const modelFields = [
      ['模型名称', model.name],
      ['副标题', model.subtitle],
      ['说明', model.summary],
      ['知识卡片', model.cards.flatMap((card) => [card.title, card.body, ...card.tags]).join(' ')],
    ] as const
    const modelMatch = bestMatch(
      query,
      model.name,
      model.cards.flatMap((card) => card.tags),
      modelFields,
    )
    if (modelMatch) {
      const defaultNode = model.nodes.find((node) =>
        node.componentId === model.defaultComponentId,
      ) ?? model.nodes[0]
      empty.architecture.push({
        id: `model:${model.id}`,
        type: 'architecture',
        title: model.name,
        summary: `${model.subtitle} · ${model.summary}`,
        source: '架构模型',
        matchedField: modelMatch.field,
        matchedText: modelMatch.text,
        score: modelMatch.score,
        target: {
          modelId: model.id,
          nodeId: defaultNode?.id,
          componentName: defaultNode?.label,
        },
      })
    }

    model.nodes.forEach((node) => {
      const detail = componentDetails[node.componentId]
      const fields = [
        ['节点名称', node.label],
        ['组件名称', detail?.name ?? node.componentId],
        ['节点说明', detail?.description ?? ''],
        ['关键概念', detail?.concepts.join(' ') ?? ''],
        ['故障排查', detail?.faults.join(' ') ?? ''],
      ] as const
      const match = bestMatch(query, node.label, detail?.concepts ?? [], fields)
      if (match) {
        empty.architecture.push({
          id: `node:${model.id}:${node.id}`,
          type: 'architecture',
          title: node.label,
          summary: `${model.name} · ${detail?.role ?? node.componentId}`,
          source: '架构节点',
          matchedField: match.field,
          matchedText: match.text,
          score: match.score + 3,
          target: {
            modelId: model.id,
            nodeId: node.id,
            componentName: detail?.name ?? node.label,
          },
        })
      }
      detail?.sql.forEach((sql, index) => {
        const sqlMatch = matchText(query, sql)
        if (!sqlMatch) return
        empty.command.push({
          id: `sql:${model.id}:${node.id}:${index}`,
          type: 'command',
          title: `${detail.name} SQL / 命令`,
          summary: sql,
          source: `架构分析 · ${model.name}`,
          matchedField: 'SQL / 命令',
          matchedText: sql,
          score: sqlMatch.score + 6,
          target: {
            modelId: model.id,
            nodeId: node.id,
            componentName: detail.name,
          },
        })
      })
    })
  })

  Object.values(empty).forEach((items) =>
    items.sort((left, right) =>
      right.score - left.score || left.title.localeCompare(right.title, 'zh-CN'),
    ),
  )
  return empty
}

export function loadRecentGlobalSearches() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(GLOBAL_SEARCH_RECENT_STORAGE_KEY) ?? '[]',
    ) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 8)
      : []
  } catch {
    return []
  }
}

export function saveRecentGlobalSearch(query: string) {
  const normalized = query.trim()
  if (!normalized) return loadRecentGlobalSearches()
  const next = [
    normalized,
    ...loadRecentGlobalSearches().filter((item) =>
      normalize(item) !== normalize(normalized),
    ),
  ].slice(0, 8)
  try {
    window.localStorage.setItem(
      GLOBAL_SEARCH_RECENT_STORAGE_KEY,
      JSON.stringify(next),
    )
  } catch {
    // Search still works if recent-history persistence is unavailable.
  }
  return next
}

function createEmptyGroups(): GlobalSearchGroups {
  return { question: [], case: [], architecture: [], command: [] }
}

function bestMatch(
  query: string,
  title: string,
  tags: string[],
  fields: ReadonlyArray<readonly [string, string]>,
) {
  const normalizedTitle = normalize(title)
  if (normalizedTitle === query) {
    return { field: '标题', text: title, score: 100 }
  }
  if (normalizedTitle.includes(query)) {
    return { field: '标题', text: title, score: 80 }
  }
  const tag = tags.find((item) => normalize(item).includes(query))
  if (tag) return { field: '标签', text: tag, score: 60 }

  for (const [field, text] of fields) {
    const match = matchText(query, text)
    if (match) return { field, text: excerpt(text, query), score: match.score }
  }
  return null
}

function matchText(query: string, text: string) {
  const normalizedText = normalize(text)
  if (!normalizedText.includes(query)) return null
  return { score: normalizedText === query ? 70 : 35 }
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase()
}

function excerpt(text: string, query: string) {
  const compact = text.replace(/\s+/g, ' ').trim()
  const index = normalize(compact).indexOf(query)
  if (index < 0 || compact.length <= 110) return compact
  const start = Math.max(0, index - 35)
  return `${start ? '…' : ''}${compact.slice(start, start + 110)}${start + 110 < compact.length ? '…' : ''}`
}
