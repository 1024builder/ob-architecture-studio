import { architectureModels } from '../data/models'

export type ArchitectureNavigationRequest = {
  componentName: string
  requestId: number
}

const componentTargets: Record<string, { componentId: string; modelId: string }> = {
  zone: { componentId: 'zone', modelId: 'replicas' },
  observer: { componentId: 'observer', modelId: 'replicas' },
  rootservice: { componentId: 'rootservice', modelId: 'replicas' },
  tenant: { componentId: 'tenant', modelId: 'tenant' },
  unit: { componentId: 'unit', modelId: 'tenant' },
  ls: { componentId: 'ls', modelId: 'ls-tablet' },
  tablet: { componentId: 'tablet', modelId: 'ls-tablet' },
  obproxy: { componentId: 'obproxy', modelId: 'proxy' },
  ocp: { componentId: 'ocp', modelId: 'ocp' },
}

export function resolveArchitectureTarget(componentName: string) {
  const normalized = componentName.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
  const configuredTarget = componentTargets[normalized]
  if (configuredTarget) {
    const model = architectureModels.find((item) => item.id === configuredTarget.modelId)
    const node = model?.nodes.find((item) => item.componentId === configuredTarget.componentId)
    if (model && node) return { modelId: model.id, nodeId: node.id }
  }

  for (const model of architectureModels) {
    const node = model.nodes.find((item) =>
      item.componentId.toLocaleLowerCase() === normalized
      || item.kind.toLocaleLowerCase() === normalized
      || item.label.toLocaleLowerCase().replace(/[^a-z0-9]/g, '').includes(normalized),
    )
    if (node) return { modelId: model.id, nodeId: node.id }
  }
  return null
}
