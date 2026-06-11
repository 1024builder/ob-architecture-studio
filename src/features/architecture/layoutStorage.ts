import type { NodePosition, PersistedLayout } from '../../data/types'

const STORAGE_PREFIX = 'ob-architecture-studio:topology-layout'

function getStorageKey(modelId: string) {
  return `${STORAGE_PREFIX}:${modelId}`
}

function isNodePosition(value: unknown): value is NodePosition {
  if (!value || typeof value !== 'object') return false
  const position = value as Partial<NodePosition>
  return Number.isFinite(position.x) && Number.isFinite(position.y)
}

export function loadPersistedLayout(modelId: string): Record<string, NodePosition> {
  try {
    const raw = window.localStorage.getItem(getStorageKey(modelId))
    if (!raw) return {}

    const parsed = JSON.parse(raw) as Partial<PersistedLayout>
    if (parsed.version !== 1 || parsed.modelId !== modelId || !parsed.positions) return {}

    return Object.fromEntries(
      Object.entries(parsed.positions).filter((entry): entry is [string, NodePosition] => isNodePosition(entry[1])),
    )
  } catch {
    return {}
  }
}

export function savePersistedLayout(modelId: string, positions: Record<string, NodePosition>) {
  try {
    const payload: PersistedLayout = {
      version: 1,
      modelId,
      positions,
    }
    window.localStorage.setItem(getStorageKey(modelId), JSON.stringify(payload))
  } catch {
    // A storage failure should not interrupt the active drag interaction.
  }
}

export function clearPersistedLayout(modelId: string) {
  try {
    window.localStorage.removeItem(getStorageKey(modelId))
  } catch {
    // The in-memory layout can still be reset when storage is unavailable.
  }
}
