import { architectureModels } from '../data/models'

export type ArchitectureNavigationRequest = {
  componentName: string
  requestId: number
}

type ComponentTarget = {
  modelId: string
  componentId?: string
  nodeId?: string
}

const componentTargets: Record<string, ComponentTarget> = {
  zone: { componentId: 'zone', modelId: 'replicas' },
  observer: { componentId: 'observer', modelId: 'replicas' },
  rootservice: { componentId: 'rootservice', modelId: 'replicas' },
  tenant: { componentId: 'tenant', modelId: 'tenant' },
  unit: { componentId: 'unit', modelId: 'tenant' },
  ls: { componentId: 'ls', modelId: 'ls-tablet' },
  tablet: { componentId: 'tablet', modelId: 'ls-tablet' },
  obproxy: { componentId: 'obproxy', modelId: 'proxy' },
  ocp: { componentId: 'ocp', modelId: 'ocp' },
  agent: { modelId: 'ocp', nodeId: 'agent-a' },
  monitoringagent: { modelId: 'ocp', nodeId: 'agent-a' },
  monitoringplatform: { modelId: 'ocp', nodeId: 'ocp' },
  archivelog: { modelId: 'standby', nodeId: 'archive' },
  influxdb: { modelId: 'replicas' },
  mysql: { modelId: 'replicas' },
  mysqlprimary: { modelId: 'replicas' },
  mysqlreplica: { modelId: 'replicas' },
  redis: { modelId: 'replicas' },
  postgresql: { modelId: 'replicas' },
  oracle: { modelId: 'standby' },
  oraclerac: { modelId: 'standby' },
  sqlserver: { modelId: 'replicas' },
  binlog: { modelId: 'standby' },
  fra: { modelId: 'standby' },
  asm: { modelId: 'standby' },
  linux: { modelId: 'ocp' },
  database: { modelId: 'replicas' },
}

export function resolveArchitectureTarget(componentName: string) {
  const normalized = componentName.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
  if (!normalized) {
    return null
  }

  const configuredTarget = componentTargets[normalized]
  if (configuredTarget) {
    const model = architectureModels.find((item) => item.id === configuredTarget.modelId)
    const node = configuredTarget.nodeId
      ? model?.nodes.find((item) => item.id === configuredTarget.nodeId)
      : model?.nodes.find((item) => item.componentId === configuredTarget.componentId)
    if (model && node) return { modelId: model.id, nodeId: node.id }
    if (model) return { modelId: model.id }
  }

  for (const model of architectureModels) {
    const node = model.nodes.find((item) => {
      const normalizedLabel = item.label.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
      return item.componentId.toLocaleLowerCase() === normalized
        || item.kind.toLocaleLowerCase() === normalized
        || (normalized.length >= 2 && normalizedLabel.includes(normalized))
    })
    if (node) return { modelId: model.id, nodeId: node.id }
  }
  return null
}
