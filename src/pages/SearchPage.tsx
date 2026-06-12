import {
  ArrowRight,
  BookOpenCheck,
  Boxes,
  ChevronDown,
  Database,
  Search,
  SearchX,
  Terminal,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { GlobalSearchResult, GlobalSearchResultType } from '../services/globalSearchService'
import {
  loadRecentGlobalSearches,
  saveRecentGlobalSearch,
  searchGlobalKnowledge,
} from '../services/globalSearchService'
import { loadObcpUserState } from '../utils/obcpStorage'

const CURRENT_USER_ID = 'local-user'
const groupConfig: Array<{
  type: GlobalSearchResultType
  title: string
  icon: typeof Search
}> = [
  { type: 'question', title: '题库结果', icon: BookOpenCheck },
  { type: 'case', title: '故障案例结果', icon: Database },
  { type: 'architecture', title: '架构结果', icon: Boxes },
  { type: 'command', title: '命令 / SQL 结果', icon: Terminal },
]

type Props = {
  initialQuery?: string
  onOpenResult: (result: GlobalSearchResult) => void
}

export function SearchPage({ initialQuery = '', onOpenResult }: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery.trim())
  const [recentSearches, setRecentSearches] = useState(loadRecentGlobalSearches)
  const [expandedGroups, setExpandedGroups] = useState<GlobalSearchResultType[]>([])

  useEffect(() => {
    setQuery(initialQuery)
    setSubmittedQuery(initialQuery.trim())
  }, [initialQuery])

  const groups = useMemo(
    () => searchGlobalKnowledge(
      submittedQuery,
      loadObcpUserState(CURRENT_USER_ID),
    ),
    [submittedQuery],
  )
  const totalCount = Object.values(groups).reduce(
    (sum, items) => sum + items.length,
    0,
  )

  function submitSearch(value = query) {
    const normalized = value.trim()
    setQuery(value)
    setSubmittedQuery(normalized)
    setExpandedGroups([])
    if (normalized) setRecentSearches(saveRecentGlobalSearch(normalized))
  }

  return (
    <div className="space-y-5 p-3 sm:p-4 lg:p-5">
      <section className="border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold uppercase text-ocean-600">Knowledge Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">全局搜索与知识工作台</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          统一检索 OBCP 题目、故障案例、架构模型、节点以及 SQL 和排查命令。
        </p>
        <form
          className="mt-5 flex max-w-4xl gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            submitSearch()
          }}
        >
          <label className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-md border border-slate-200 bg-white px-4 shadow-sm focus-within:border-ocean-400 focus-within:ring-2 focus-within:ring-ocean-100">
            <Search size={19} className="shrink-0 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索题库 / 案例 / 架构 / SQL / 命令"
              aria-label="全局搜索"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
            />
            {query && (
              <button type="button" title="清空搜索" onClick={() => {
                setQuery('')
                setSubmittedQuery('')
              }} className="grid h-8 w-8 place-items-center text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            )}
          </label>
          <button type="submit" className="h-12 shrink-0 rounded-md bg-ocean-600 px-4 text-sm font-semibold text-white hover:bg-ocean-700">
            搜索
          </button>
        </form>
      </section>

      {!submittedQuery ? (
        <SearchSuggestions
          recentSearches={recentSearches}
          onSelect={submitSearch}
        />
      ) : totalCount ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              “<span className="font-semibold text-ink">{submittedQuery}</span>”共找到 {totalCount} 条结果
            </p>
            <p className="text-xs text-slate-400">结果来自当前设备已加载和已同步的数据</p>
          </div>
          <div className="space-y-5">
            {groupConfig.map(({ type, title, icon: Icon }) => {
              const items = groups[type]
              if (!items.length) return null
              const expanded = expandedGroups.includes(type)
              const visibleItems = expanded ? items : items.slice(0, 5)
              return (
                <section key={type} className="border border-slate-200 bg-white shadow-sm">
                  <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Icon size={17} className="text-ocean-600" />{title}</h2>
                    <span className="text-xs text-slate-400">{items.length} 条</span>
                  </header>
                  <div className="divide-y divide-slate-100">
                    {visibleItems.map((item) => (
                      <SearchResultItem
                        key={item.id}
                        item={item}
                        query={submittedQuery}
                        onOpen={() => onOpenResult(item)}
                      />
                    ))}
                  </div>
                  {items.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setExpandedGroups((current) =>
                        expanded
                          ? current.filter((item) => item !== type)
                          : [...current, type],
                      )}
                      className="flex h-10 w-full items-center justify-center gap-2 border-t border-slate-100 text-xs font-semibold text-ocean-700 hover:bg-ocean-50"
                    >
                      {expanded ? '收起' : `查看全部 ${items.length} 条`}
                      <ChevronDown size={15} className={expanded ? 'rotate-180' : ''} />
                    </button>
                  )}
                </section>
              )
            })}
          </div>
        </>
      ) : (
        <div className="flex min-h-72 flex-col items-center justify-center border border-dashed border-slate-300 bg-white px-5 text-center">
          <SearchX size={30} className="text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-700">没有找到相关知识内容</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">尝试组件名、故障类型、知识点或命令片段，例如 LS、主从复制、lsof。</p>
        </div>
      )}
    </div>
  )
}

function SearchSuggestions({
  recentSearches,
  onSelect,
}: {
  recentSearches: string[]
  onSelect: (query: string) => void
}) {
  const recommended = ['OBProxy', 'LS', 'Tablet', '主从复制', 'InfluxDB', 'RLS', '租户资源隔离', 'SQL 审计']
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SuggestionBlock title="推荐搜索" items={recommended} onSelect={onSelect} />
      <SuggestionBlock
        title="最近搜索"
        items={recentSearches}
        emptyText="还没有搜索记录，输入关键词开始构建自己的知识路径。"
        onSelect={onSelect}
      />
    </div>
  )
}

function SuggestionBlock({
  title,
  items,
  emptyText,
  onSelect,
}: {
  title: string
  items: string[]
  emptyText?: string
  onSelect: (query: string) => void
}) {
  return (
    <section className="border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {items.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => <button key={item} type="button" onClick={() => onSelect(item)} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-ocean-300 hover:bg-ocean-50 hover:text-ocean-700">{item}</button>)}
        </div>
      ) : <p className="mt-3 text-xs leading-5 text-slate-500">{emptyText}</p>}
    </section>
  )
}

function SearchResultItem({
  item,
  query,
  onOpen,
}: {
  item: GlobalSearchResult
  query: string
  onOpen: () => void
}) {
  return (
    <article className="p-4">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded bg-ocean-50 px-2 py-1 font-semibold text-ocean-700">{typeLabel(item.type)}</span>
            <span className="text-slate-400">{item.source}</span>
            <span className="text-slate-300">命中：{item.matchedField}</span>
          </div>
          <h3 className="mt-2 text-sm font-semibold leading-6 text-ink">
            <HighlightedText text={item.title} query={query} />
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.summary}</p>
          {item.matchedText !== item.title && (
            <p className="mt-2 border-l-2 border-ocean-200 pl-3 text-xs leading-5 text-slate-500">
              <HighlightedText text={item.matchedText} query={query} />
            </p>
          )}
        </div>
        <button type="button" onClick={onOpen} className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 text-xs font-semibold text-ocean-700 hover:border-ocean-300 hover:bg-ocean-50">
          进入查看<ArrowRight size={14} />
        </button>
      </div>
    </article>
  )
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const normalizedText = text.toLocaleLowerCase()
  const normalizedQuery = query.toLocaleLowerCase()
  const index = normalizedText.indexOf(normalizedQuery)
  if (index < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-amber-100 text-inherit">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  )
}

function typeLabel(type: GlobalSearchResultType) {
  return {
    question: '题目',
    case: '案例',
    architecture: '架构',
    command: '命令',
  }[type]
}
