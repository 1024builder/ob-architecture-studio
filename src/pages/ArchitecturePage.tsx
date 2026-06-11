import { useMemo, useState } from 'react'
import { InfoPanel } from '../components/InfoPanel'
import { KnowledgeCards } from '../components/KnowledgeCards'
import { MetricsOverview } from '../components/MetricsOverview'
import { ModelSelector } from '../components/ModelSelector'
import { TopologyCanvas } from '../components/TopologyCanvas'
import { componentDetails } from '../data/components'
import { architectureModels } from '../data/models'

export function ArchitecturePage() {
  const [activeModelId, setActiveModelId] = useState(architectureModels[0].id)
  const activeModel = useMemo(
    () => architectureModels.find((model) => model.id === activeModelId) ?? architectureModels[0],
    [activeModelId],
  )
  const [selectedNodeId, setSelectedNodeId] = useState(
    architectureModels[0].nodes.find((node) => node.componentId === architectureModels[0].defaultComponentId)?.id
      ?? architectureModels[0].nodes[0].id,
  )
  const selectedNode = activeModel.nodes.find((node) => node.id === selectedNodeId) ?? activeModel.nodes[0]
  const selectedDetail = componentDetails[selectedNode.componentId] ?? componentDetails[activeModel.defaultComponentId]

  function handleSelectModel(modelId: string) {
    const nextModel = architectureModels.find((model) => model.id === modelId) ?? architectureModels[0]
    const defaultNode = nextModel.nodes.find((node) => node.componentId === nextModel.defaultComponentId) ?? nextModel.nodes[0]
    setActiveModelId(nextModel.id)
    setSelectedNodeId(defaultNode.id)
  }

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-5">
      <ModelSelector models={architectureModels} activeModelId={activeModel.id} onSelect={handleSelectModel} />
      <MetricsOverview model={activeModel} selectedNode={selectedNode} />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <TopologyCanvas model={activeModel} selectedNodeId={selectedNode.id} onSelectNode={setSelectedNodeId} />
          <KnowledgeCards cards={activeModel.cards} />
        </div>
        <InfoPanel detail={selectedDetail} node={selectedNode} />
      </div>
    </div>
  )
}
