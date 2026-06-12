import { useEffect, useMemo, useState } from 'react'
import { resolveArchitectureTarget, type ArchitectureNavigationRequest } from '../app/architectureNavigation'
import { InfoPanel } from '../components/InfoPanel'
import { KnowledgeCards } from '../components/KnowledgeCards'
import { MetricsOverview } from '../components/MetricsOverview'
import { ModelSelector } from '../components/ModelSelector'
import { TopologyCanvas } from '../components/TopologyCanvas'
import { componentDetails } from '../data/components'
import { architectureModels } from '../data/models'

type Props = {
  navigationRequest?: ArchitectureNavigationRequest | null
  onNavigationHandled?: () => void
}

export function ArchitecturePage({ navigationRequest, onNavigationHandled }: Props) {
  const [activeModelId, setActiveModelId] = useState(architectureModels[0].id)
  const activeModel = useMemo(
    () => architectureModels.find((model) => model.id === activeModelId) ?? architectureModels[0],
    [activeModelId],
  )
  const [selectedNodeId, setSelectedNodeId] = useState(
    architectureModels[0].nodes.find((node) => node.componentId === architectureModels[0].defaultComponentId)?.id
      ?? architectureModels[0].nodes[0].id,
  )
  const [navigationNotice, setNavigationNotice] = useState('')
  const selectedNode = activeModel.nodes.find((node) => node.id === selectedNodeId) ?? activeModel.nodes[0]
  const selectedDetail = componentDetails[selectedNode.componentId] ?? componentDetails[activeModel.defaultComponentId]

  function handleSelectModel(modelId: string) {
    const nextModel = architectureModels.find((model) => model.id === modelId) ?? architectureModels[0]
    const defaultNode = nextModel.nodes.find((node) => node.componentId === nextModel.defaultComponentId) ?? nextModel.nodes[0]
    setActiveModelId(nextModel.id)
    setSelectedNodeId(defaultNode.id)
  }

  useEffect(() => {
    if (!navigationRequest) return
    const directModel = navigationRequest.modelId
      ? architectureModels.find((model) => model.id === navigationRequest.modelId)
      : undefined
    const directNode = directModel && navigationRequest.nodeId
      ? directModel.nodes.find((node) => node.id === navigationRequest.nodeId)
      : undefined
    const target = directModel
      ? { modelId: directModel.id, nodeId: directNode?.id }
      : resolveArchitectureTarget(navigationRequest.componentName ?? '')
    const targetName = navigationRequest.componentName
      ?? directNode?.label
      ?? directModel?.name
      ?? '相关架构'
    if (target) {
      setActiveModelId(target.modelId)
      if (target.nodeId) {
        setSelectedNodeId(target.nodeId)
        setNavigationNotice(`已定位到 ${targetName}`)
      } else {
        const targetModel = architectureModels.find((model) => model.id === target.modelId)
        const defaultNode = targetModel?.nodes.find((node) => node.componentId === targetModel.defaultComponentId)
          ?? targetModel?.nodes[0]
        if (defaultNode) setSelectedNodeId(defaultNode.id)
        setNavigationNotice(`建议查看 ${targetName}`)
      }
    } else {
      setNavigationNotice(`建议查看 ${targetName}`)
    }
    onNavigationHandled?.()
  }, [navigationRequest, onNavigationHandled])

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-5">
      {navigationNotice && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-ocean-200 bg-ocean-50 px-4 py-3 text-sm text-ocean-800">
          <span>{navigationNotice}</span>
          <button type="button" onClick={() => setNavigationNotice('')} className="text-xs font-semibold text-ocean-700 hover:text-ocean-900">关闭</button>
        </div>
      )}
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
