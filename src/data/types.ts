import type { LucideIcon } from 'lucide-react'

export type NodeKind =
  | 'zone'
  | 'observer'
  | 'tenant'
  | 'unit'
  | 'ls'
  | 'tablet'
  | 'obproxy'
  | 'ocp'
  | 'client'
  | 'rootservice'
  | 'backup'

export type TopologyNode = {
  id: string
  componentId: string
  label: string
  kind: NodeKind
  x: number
  y: number
  size?: 'sm' | 'md' | 'lg'
  tone?: 'blue' | 'cyan' | 'green' | 'orange' | 'violet' | 'slate'
}

export type NodePosition = {
  x: number
  y: number
}

export type PersistedLayout = {
  version: 1
  modelId: string
  positions: Record<string, NodePosition>
}

export type TopologyLink = {
  from: string
  to: string
  label?: string
  dashed?: boolean
}

export type ArchitectureModel = {
  id: string
  name: string
  subtitle: string
  icon: LucideIcon
  summary: string
  defaultComponentId: string
  nodes: TopologyNode[]
  links: TopologyLink[]
  cards: KnowledgeCard[]
}

export type ComponentDetail = {
  id: string
  name: string
  role: string
  description: string
  concepts: string[]
  sql: string[]
  faults: string[]
}

export type KnowledgeCard = {
  title: string
  body: string
  tags: string[]
}
