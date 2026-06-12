import { BookOpenCheck, House, Network, Search, Siren } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type AppModuleId =
  'dashboard' | 'search' | 'architecture' | 'question-bank' | 'troubleshooting'

export type AppModule = {
  id: AppModuleId
  name: string
  shortName: string
  description: string
  path: string
  icon: LucideIcon
}

export const appModules: AppModule[] = [
  {
    id: 'search',
    name: '全局搜索',
    shortName: '全局搜索',
    description: '统一检索题库、案例、架构与命令',
    path: '#/search',
    icon: Search,
  },
  {
    id: 'dashboard',
    name: '首页总览',
    shortName: '首页',
    description: 'OceanBase 学习与 DBA 运维工作台总览',
    path: '#/dashboard',
    icon: House,
  },
  {
    id: 'architecture',
    name: '架构原理分析',
    shortName: '架构分析',
    description: '交互式拓扑、组件原理与 DBA 排障命令',
    path: '#/architecture',
    icon: Network,
  },
  {
    id: 'question-bank',
    name: 'OBCP 题库',
    shortName: 'OBCP 题库',
    description: '章节练习、模拟考试与学习数据',
    path: '#/question-bank',
    icon: BookOpenCheck,
  },
  {
    id: 'troubleshooting',
    name: 'DBA 故障诊断案例库',
    shortName: '故障案例',
    description: '数据库故障案例、排查步骤与关键命令',
    path: '#/troubleshooting',
    icon: Siren,
  },
]

export function getModuleFromHash(hash: string): AppModuleId {
  if (hash.includes('search')) return 'search'
  if (hash.includes('architecture')) return 'architecture'
  if (hash.includes('troubleshooting')) return 'troubleshooting'
  if (hash.includes('question-bank')) return 'question-bank'
  return 'dashboard'
}
