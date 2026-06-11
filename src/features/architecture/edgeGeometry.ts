import type { NodeKind, TopologyLink, TopologyNode } from '../../data/types'

export type CanvasSize = {
  width: number
  height: number
}

export type EdgePoint = {
  x: number
  y: number
}

export type NodeBounds = {
  id: string
  center: EdgePoint
  width: number
  height: number
  kind: NodeKind
}

export type EdgePathGeometry = {
  path: string
  start: EdgePoint
  end: EdgePoint
  label: EdgePoint
  labelWidth: number
  labelHeight: number
}

export type EdgeCategory = 'primary' | 'control' | 'resource'

export type EdgeVisualStyle = {
  category: EdgeCategory
  stroke: string
  activeStroke: string
  width: number
  activeWidth: number
  opacity: number
  dash?: string
  markerId: string
}

const NODE_PIXEL_SIZE = {
  sm: { width: 96, height: 64 },
  md: { width: 128, height: 80 },
  lg: { width: 160, height: 96 },
}

export function getNodeBounds(node: TopologyNode, canvas: CanvasSize): NodeBounds {
  const size = NODE_PIXEL_SIZE[node.size ?? 'md']
  return {
    id: node.id,
    center: {
      x: (node.x / 100) * canvas.width,
      y: (node.y / 100) * canvas.height,
    },
    width: size.width,
    height: size.height,
    kind: node.kind,
  }
}

export function getNodeAnchorPoint(
  source: NodeBounds,
  target: NodeBounds,
  targetAnchor = false,
): EdgePoint {
  const dx = target.center.x - source.center.x
  const dy = target.center.y - source.center.y
  const distance = Math.max(Math.hypot(dx, dy), 1)
  const unitX = dx / distance
  const unitY = dy / distance
  const halfWidth = source.width / 2
  const halfHeight = source.height / 2
  const scaleX = Math.abs(dx) > 0 ? halfWidth / Math.abs(dx) : Number.POSITIVE_INFINITY
  const scaleY = Math.abs(dy) > 0 ? halfHeight / Math.abs(dy) : Number.POSITIVE_INFINITY
  const scale = Math.min(scaleX, scaleY)
  const boundary = {
    x: source.center.x + dx * scale,
    y: source.center.y + dy * scale,
  }
  const gap = targetAnchor ? 9 : 5

  return {
    x: boundary.x + unitX * gap,
    y: boundary.y + unitY * gap,
  }
}

export function getEdgeOffset(linkIndex: number, siblingCount: number) {
  if (siblingCount <= 1) return 0
  return (linkIndex - (siblingCount - 1) / 2) * 10
}

export function getSmartEdgePath(
  source: NodeBounds,
  target: NodeBounds,
  offset: number,
  labelText: string | undefined,
  obstacles: NodeBounds[],
): EdgePathGeometry {
  const start = getNodeAnchorPoint(source, target)
  const end = getNodeAnchorPoint(target, source, true)
  const dx = end.x - start.x
  const dy = end.y - start.y
  const distance = Math.max(Math.hypot(dx, dy), 1)
  const normal = { x: -dy / distance, y: dx / distance }
  const bend = Math.min(80, Math.max(28, distance * 0.22))
  const curveOffset = offset + Math.min(20, distance * 0.045) * (dy >= 0 ? 1 : -1)

  let control1: EdgePoint
  let control2: EdgePoint
  if (Math.abs(dx) >= Math.abs(dy)) {
    const direction = Math.sign(dx || 1)
    control1 = { x: start.x + bend * direction, y: start.y + normal.y * curveOffset }
    control2 = { x: end.x - bend * direction, y: end.y + normal.y * curveOffset }
  } else {
    control1 = { x: start.x + normal.x * curveOffset, y: start.y + bend * Math.sign(dy || 1) }
    control2 = { x: end.x + normal.x * curveOffset, y: end.y - bend * Math.sign(dy || 1) }
  }

  const path = `M ${round(start.x)} ${round(start.y)} C ${round(control1.x)} ${round(control1.y)}, ${round(control2.x)} ${round(control2.y)}, ${round(end.x)} ${round(end.y)}`
  const midpoint = getCubicPoint(start, control1, control2, end, 0.5)
  const tangent = getCubicTangent(start, control1, control2, end, 0.5)
  const tangentLength = Math.max(Math.hypot(tangent.x, tangent.y), 1)
  const labelNormal = { x: -tangent.y / tangentLength, y: tangent.x / tangentLength }
  let label = {
    x: midpoint.x + labelNormal.x * (12 + Math.abs(offset) * 0.35),
    y: midpoint.y + labelNormal.y * (12 + Math.abs(offset) * 0.35),
  }
  const labelWidth = Math.max(38, (labelText?.length ?? 0) * 7 + 18)
  const labelHeight = 22

  for (let attempt = 0; attempt < 5 && overlapsAnyNode(label, labelWidth, labelHeight, obstacles); attempt += 1) {
    label = {
      x: label.x + labelNormal.x * 22,
      y: label.y + labelNormal.y * 22,
    }
  }

  return { path, start, end, label, labelWidth, labelHeight }
}

export function getEdgeVisualStyle(
  link: TopologyLink,
  sourceKind: NodeKind,
  targetKind: NodeKind,
): EdgeVisualStyle {
  const label = link.label?.toLowerCase() ?? ''
  const isPrimary = ['sql', 'route', 'paxos', 'log', 'archive', 'sync'].some((value) => label.includes(value))
  const isResource =
    label.includes('cpu')
    || sourceKind === 'unit'
    || targetKind === 'unit'
    || (sourceKind === 'tenant' && targetKind === 'observer')

  if (isResource) {
    return {
      category: 'resource',
      stroke: '#8aa4b8',
      activeStroke: '#4f86a8',
      width: 1.7,
      activeWidth: 2.4,
      opacity: 0.64,
      markerId: 'arrow-resource',
    }
  }

  if (!isPrimary || link.dashed || label.includes('leader')) {
    return {
      category: 'control',
      stroke: '#718096',
      activeStroke: '#4b647e',
      width: 1.55,
      activeWidth: 2.25,
      opacity: 0.58,
      dash: link.dashed ? '6 6' : undefined,
      markerId: 'arrow-control',
    }
  }

  return {
    category: 'primary',
    stroke: '#1683d8',
    activeStroke: '#006fc4',
    width: 2.25,
    activeWidth: 3,
    opacity: 0.78,
    markerId: 'arrow-primary',
  }
}

export function getSiblingOffset(
  link: TopologyLink,
  links: TopologyLink[],
  linkIndex: number,
) {
  const siblings = links
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.from === link.from || candidate.to === link.to)
  const position = siblings.findIndex(({ index }) => index === linkIndex)
  return getEdgeOffset(position, siblings.length)
}

function getCubicPoint(
  start: EdgePoint,
  control1: EdgePoint,
  control2: EdgePoint,
  end: EdgePoint,
  t: number,
) {
  const inverse = 1 - t
  return {
    x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * control1.x + 3 * inverse * t ** 2 * control2.x + t ** 3 * end.x,
    y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * control1.y + 3 * inverse * t ** 2 * control2.y + t ** 3 * end.y,
  }
}

function getCubicTangent(
  start: EdgePoint,
  control1: EdgePoint,
  control2: EdgePoint,
  end: EdgePoint,
  t: number,
) {
  const inverse = 1 - t
  return {
    x: 3 * inverse ** 2 * (control1.x - start.x) + 6 * inverse * t * (control2.x - control1.x) + 3 * t ** 2 * (end.x - control2.x),
    y: 3 * inverse ** 2 * (control1.y - start.y) + 6 * inverse * t * (control2.y - control1.y) + 3 * t ** 2 * (end.y - control2.y),
  }
}

function overlapsAnyNode(
  point: EdgePoint,
  width: number,
  height: number,
  nodes: NodeBounds[],
) {
  return nodes.some((node) => (
    Math.abs(point.x - node.center.x) < width / 2 + node.width / 2 + 8
    && Math.abs(point.y - node.center.y) < height / 2 + node.height / 2 + 8
  ))
}

function round(value: number) {
  return Math.round(value * 100) / 100
}
