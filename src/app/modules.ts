import { BookOpenCheck, Network } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type AppModuleId = 'architecture' | 'question-bank'

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
]

export function getModuleFromHash(hash: string): AppModuleId {
  return hash.includes('question-bank') ? 'question-bank' : 'architecture'
}
