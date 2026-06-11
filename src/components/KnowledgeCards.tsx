import { motion } from 'framer-motion'
import type { KnowledgeCard } from '../data/types'

type Props = {
  cards: KnowledgeCard[]
}

export function KnowledgeCards({ cards }: Props) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">Knowledge Notes</p>
          <h2 className="mt-1 text-base font-semibold text-ink">当前模型原理卡片</h2>
        </div>
        <span className="text-xs text-slate-400">{cards.length} topics</span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map((card, index) => (
          <motion.article
            key={card.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-ink">{card.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {card.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{tag}</span>
              ))}
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  )
}
