import { AnimatePresence, motion } from 'framer-motion'
import {
  Box,
  CloudCog,
  Database,
  LayoutTemplate,
  Layers3,
  Minus,
  Network,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Server,
  Shield,
  Tablet,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { ArchitectureModel, NodeKind, NodePosition, TopologyNode } from '../data/types'
import {
  getEdgeVisualStyle,
  getNodeBounds,
  getSiblingOffset,
  getSmartEdgePath,
  type CanvasSize,
} from '../features/architecture/edgeGeometry'
import {
  clearPersistedLayout,
  loadPersistedLayout,
  savePersistedLayout,
} from '../features/architecture/layoutStorage'

type Props = {
  model: ArchitectureModel
  selectedNodeId: string
  onSelectNode: (nodeId: string) => void
}

const iconMap: Record<NodeKind, typeof Server> = {
  zone: Shield,
  observer: Server,
  tenant: UserRound,
  unit: Box,
  ls: Layers3,
  tablet: Tablet,
  obproxy: Network,
  ocp: CloudCog,
  client: Database,
  rootservice: Layers3,
  backup: Database,
}

const toneClass: Record<NonNullable<TopologyNode['tone']>, string> = {
  blue: 'from-ocean-500 to-blue-700',
  cyan: 'from-cyan-400 to-ocean-600',
  green: 'from-emerald-400 to-kelp',
  orange: 'from-coral to-amber-500',
  violet: 'from-violet-500 to-indigo-600',
  slate: 'from-slate-500 to-slate-700',
}

const sizeClass: Record<NonNullable<TopologyNode['size']>, string> = {
  sm: 'h-16 w-24',
  md: 'h-20 w-32',
  lg: 'h-24 w-40',
}

const legend = [
  { label: '节点正常', className: 'bg-emerald-500' },
  { label: '数据链路', className: 'bg-ocean-500' },
  { label: '控制链路', className: 'bg-slate-400' },
]

type DragState = {
  nodeId: string
  pointerId: number
  startClientX: number
  startClientY: number
  startPosition: NodePosition
  nodeWidth: number
  nodeHeight: number
  moved: boolean
}

const DRAG_THRESHOLD = 5

export function TopologyCanvas({ model, selectedNodeId, onSelectNode }: Props) {
  const [isFlowing, setIsFlowing] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [positions, setPositions] = useState<Record<string, NodePosition>>(() => loadPersistedLayout(model.id))
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 1000, height: 640 })
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const positionsRef = useRef(positions)

  useEffect(() => {
    const storedPositions = loadPersistedLayout(model.id)
    positionsRef.current = storedPositions
    setPositions(storedPositions)
    setDraggingNodeId(null)
    dragRef.current = null
  }, [model.id])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setCanvasSize({ width: rect.width, height: rect.height })
      }
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  const positionedNodes = useMemo(
    () => model.nodes.map((node) => ({ ...node, ...(positions[node.id] ?? {}) })),
    [model.nodes, positions],
  )
  const nodeById = new Map(positionedNodes.map((node) => [node.id, node]))
  const nodeBoundsById = new Map(positionedNodes.map((node) => [node.id, getNodeBounds(node, canvasSize)]))
  const nodeBounds = Array.from(nodeBoundsById.values())
  const hasCustomLayout = Object.keys(positions).length > 0

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>, node: TopologyNode) {
    if (event.button !== 0 || !canvasRef.current) return
    const position = positions[node.id] ?? { x: node.x, y: node.y }

    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      nodeId: node.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: position,
      nodeWidth: event.currentTarget.offsetWidth,
      nodeHeight: event.currentTarget.offsetHeight,
      moved: false,
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    const canvas = canvasRef.current
    if (!drag || drag.pointerId !== event.pointerId || !canvas) return

    const deltaX = event.clientX - drag.startClientX
    const deltaY = event.clientY - drag.startClientY
    if (!drag.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return

    event.preventDefault()
    if (!drag.moved) onSelectNode(drag.nodeId)
    drag.moved = true
    setDraggingNodeId(drag.nodeId)

    const rect = canvas.getBoundingClientRect()
    const halfWidth = (drag.nodeWidth / rect.width) * 50
    const halfHeight = (drag.nodeHeight / rect.height) * 50
    const nextX = drag.startPosition.x + (deltaX / (rect.width * zoom)) * 100
    const nextY = drag.startPosition.y + (deltaY / (rect.height * zoom)) * 100
    const minX = Math.max(halfWidth, 50 - 50 / zoom + halfWidth)
    const maxX = Math.min(100 - halfWidth, 50 + 50 / zoom - halfWidth)
    const minY = Math.max(halfHeight, 50 - 50 / zoom + halfHeight)
    const maxY = Math.min(100 - halfHeight, 50 + 50 / zoom - halfHeight)
    const position = {
      x: clamp(nextX, minX, maxX),
      y: clamp(nextY, minY, maxY),
    }

    setPositions((current) => {
      const nextPositions = { ...current, [drag.nodeId]: position }
      positionsRef.current = nextPositions
      return nextPositions
    })
  }

  function finishPointerInteraction(event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (drag.moved) {
      savePersistedLayout(model.id, positionsRef.current)
    } else if (!cancelled) {
      onSelectNode(drag.nodeId)
    }

    dragRef.current = null
    setDraggingNodeId(null)
  }

  function resetLayout() {
    clearPersistedLayout(model.id)
    positionsRef.current = {}
    setPositions({})
    setDraggingNodeId(null)
    dragRef.current = null
  }

  return (
    <section className="flex min-h-[640px] flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-soft lg:min-h-[720px]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">{model.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{model.summary}</p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton title={isFlowing ? '暂停数据流' : '播放数据流'} onClick={() => setIsFlowing((value) => !value)}>
            {isFlowing ? <Pause size={17} /> : <Play size={17} />}
          </IconButton>
          <IconButton title="缩小" onClick={() => setZoom((value) => Math.max(0.8, Number((value - 0.1).toFixed(1))))}>
            <Minus size={17} />
          </IconButton>
          <span className="grid h-9 min-w-14 place-items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-600">
            {Math.round(zoom * 100)}%
          </span>
          <IconButton title="放大" onClick={() => setZoom((value) => Math.min(1.2, Number((value + 0.1).toFixed(1))))}>
            <Plus size={17} />
          </IconButton>
          <IconButton title="重置视图" onClick={() => setZoom(1)}>
            <RotateCcw size={16} />
          </IconButton>
          <button
            type="button"
            title="清除当前模型保存的位置并恢复默认布局"
            onClick={resetLayout}
            disabled={!hasCustomLayout}
            className="ml-1 flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:border-ocean-300 hover:text-ocean-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <LayoutTemplate size={16} />
            <span className="hidden sm:inline">恢复布局</span>
          </button>
        </div>
      </div>

      <div
        ref={canvasRef}
        className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(27,143,230,0.11),transparent_30%),linear-gradient(135deg,#f8fcff_0%,#eef7ff_55%,#f6fbf8_100%)]"
      >
        <div className="absolute inset-6 rounded-md border border-white/70 bg-white/35 shadow-inner" />
        <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(#cbd5e1_1px,transparent_1px),linear-gradient(90deg,#cbd5e1_1px,transparent_1px)] [background-size:36px_36px]" />

        <motion.div className="absolute inset-0" animate={{ scale: zoom }} transition={{ type: 'spring', stiffness: 250, damping: 28 }}>
          <svg
            className="absolute inset-0 h-full w-full overflow-visible"
            viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
            preserveAspectRatio="none"
          >
            <defs>
              <marker id="arrow-primary" markerHeight="6" markerWidth="6" orient="auto" refX="5.4" refY="3">
                <path d="M0,0 L6,3 L0,6 Z" fill="#1683d8" />
              </marker>
              <marker id="arrow-primary-active" markerHeight="6.5" markerWidth="6.5" orient="auto" refX="5.8" refY="3.25">
                <path d="M0,0 L6.5,3.25 L0,6.5 Z" fill="#006fc4" />
              </marker>
              <marker id="arrow-control" markerHeight="5.5" markerWidth="5.5" orient="auto" refX="5" refY="2.75">
                <path d="M0,0 L5.5,2.75 L0,5.5 Z" fill="#718096" />
              </marker>
              <marker id="arrow-control-active" markerHeight="6" markerWidth="6" orient="auto" refX="5.4" refY="3">
                <path d="M0,0 L6,3 L0,6 Z" fill="#4b647e" />
              </marker>
              <marker id="arrow-resource" markerHeight="5" markerWidth="5" orient="auto" refX="4.5" refY="2.5">
                <path d="M0,0 L5,2.5 L0,5 Z" fill="#8aa4b8" />
              </marker>
              <marker id="arrow-resource-active" markerHeight="5.5" markerWidth="5.5" orient="auto" refX="5" refY="2.75">
                <path d="M0,0 L5.5,2.75 L0,5.5 Z" fill="#4f86a8" />
              </marker>
            </defs>
            {model.links.map((link, linkIndex) => {
              const from = nodeById.get(link.from)
              const to = nodeById.get(link.to)
              const sourceBounds = nodeBoundsById.get(link.from)
              const targetBounds = nodeBoundsById.get(link.to)
              if (!from || !to || !sourceBounds || !targetBounds) return null
              const edgeId = `${link.from}-${link.to}-${linkIndex}`
              const isActiveLink = link.from === selectedNodeId || link.to === selectedNodeId
              const isHovered = hoveredEdgeId === edgeId
              const style = getEdgeVisualStyle(link, from.kind, to.kind)
              const geometry = getSmartEdgePath(
                sourceBounds,
                targetBounds,
                getSiblingOffset(link, model.links, linkIndex),
                link.label,
                nodeBounds,
              )
              const emphasized = isActiveLink || isHovered
              const stroke = emphasized ? style.activeStroke : style.stroke
              const width = emphasized ? style.activeWidth : style.width
              const opacity = isActiveLink ? 1 : isHovered ? 0.92 : style.opacity
              const markerId = emphasized ? `${style.markerId}-active` : style.markerId

              return (
                <g
                  key={edgeId}
                  onPointerEnter={() => setHoveredEdgeId(edgeId)}
                  onPointerLeave={() => setHoveredEdgeId(null)}
                >
                  <path
                    d={geometry.path}
                    stroke="rgba(255,255,255,0.92)"
                    strokeWidth={width + 4}
                    strokeLinecap="round"
                    fill="none"
                    opacity={0.9}
                  />
                  <motion.path
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity }}
                    transition={{ duration: 0.45 }}
                    d={geometry.path}
                    stroke={stroke}
                    strokeWidth={width}
                    strokeLinecap="round"
                    strokeDasharray={style.dash ?? (isFlowing ? '9 6' : undefined)}
                    markerEnd={`url(#${markerId})`}
                    fill="none"
                    className={isFlowing && !style.dash ? 'topology-flow' : ''}
                  />
                  <path
                    d={geometry.path}
                    stroke="transparent"
                    strokeWidth="14"
                    fill="none"
                    pointerEvents="stroke"
                  />
                  {link.label && (
                    <g
                      transform={`translate(${geometry.label.x} ${geometry.label.y})`}
                      pointerEvents="none"
                      opacity={isActiveLink ? 1 : isHovered ? 0.98 : 0.9}
                    >
                      <rect
                        x={-geometry.labelWidth / 2}
                        y={-geometry.labelHeight / 2}
                        width={geometry.labelWidth}
                        height={geometry.labelHeight}
                        rx="5"
                        fill="rgba(255,255,255,0.9)"
                        stroke={emphasized ? stroke : 'rgba(203,213,225,0.8)'}
                        strokeWidth="1"
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="select-none fill-slate-700 text-[12px] font-semibold"
                      >
                        {link.label}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>

          <AnimatePresence mode="popLayout">
            {positionedNodes.map((node) => {
              const Icon = iconMap[node.kind]
              const isSelected = node.id === selectedNodeId
              const isDragging = node.id === draggingNodeId
              const size = sizeClass[node.size ?? 'md']
              const tone = toneClass[node.tone ?? 'blue']

              return (
                <motion.button
                  key={`${model.id}-${node.id}`}
                  type="button"
                  initial={{ opacity: 0, scale: 0.82, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={isDragging ? undefined : { y: -4, rotateX: 5, rotateY: -5 }}
                  transition={isDragging ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 22 }}
                  onPointerDown={(event) => handlePointerDown(event, node)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={(event) => finishPointerInteraction(event)}
                  onPointerCancel={(event) => finishPointerInteraction(event, true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') onSelectNode(node.id)
                  }}
                  className={`absolute ${size} touch-none select-none -translate-x-1/2 -translate-y-1/2 rounded-md border bg-white p-2 text-left shadow-lg transition focus:outline-none focus:ring-4 focus:ring-ocean-200 ${
                    isDragging
                      ? 'z-30 cursor-grabbing border-ocean-600 ring-4 ring-ocean-200'
                      : isSelected
                        ? 'z-10 cursor-grab border-ocean-500 ring-4 ring-ocean-100'
                        : 'cursor-grab border-white/80 hover:border-ocean-200'
                  }`}
                  style={{
                    left: `${node.x}%`,
                    top: `${node.y}%`,
                    transformStyle: 'preserve-3d',
                    boxShadow: isDragging
                      ? '0 28px 58px rgba(8,111,196,0.32)'
                      : isSelected
                        ? '0 22px 48px rgba(8,111,196,0.25)'
                        : '0 16px 34px rgba(23,32,51,0.16)',
                  }}
                >
                  <span className={`mb-2 grid h-9 w-9 place-items-center rounded-md bg-gradient-to-br ${tone} text-white shadow-node`}>
                    <Icon size={18} />
                  </span>
                  <span className="block truncate text-sm font-semibold text-ink">{node.label}</span>
                  <span className="mt-1 block truncate text-xs capitalize text-slate-500">{node.kind}</span>
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
                  <span className="absolute -bottom-2 left-4 right-4 h-3 rounded-full bg-slate-400/20 blur-sm" />
                </motion.button>
              )
            })}
          </AnimatePresence>
        </motion.div>

        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/80 bg-white/85 px-3 py-2 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            {legend.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <span className={`h-2 w-2 rounded-full ${item.className}`} />
                {item.label}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {hasCustomLayout && <span className="font-medium text-ocean-700">布局已调整</span>}
            <span>{isFlowing ? '数据流播放中' : '数据流已暂停'}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function IconButton({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-ocean-300 hover:text-ocean-600"
    >
      {children}
    </button>
  )
}
