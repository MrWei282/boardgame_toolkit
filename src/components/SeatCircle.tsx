import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getRole, getTeam } from '../config'
import { deriveEdges, neighboursOf } from '../diagram/edges'
import { directedEdge, seatPoint, selfEdge, tokenWedge, type Pt } from '../diagram/geometry'
import { isAlive } from '../projections'
import { haloStyle, leanTone } from '../read'
import { currentRead, currentRoleIds } from '../store'
import type { GameConfig, PlayerId, ScriptConfig, Session, Tone } from '../types'

type Props = {
  session: Session
  game: GameConfig
  script: ScriptConfig
  focusedId: PlayerId | null
  onTokenTap: (id: PlayerId) => void
  onBackgroundTap: () => void
}

const SIZE = 360
const CENTER: Pt = { x: SIZE / 2, y: SIZE / 2 }
const RING_R = 132
// Name labels sit outside the ring at 3 and 9 o'clock and would clip on the
// viewBox edges, so the box is widened horizontally to give them room.
const PAD_X = 50

// The viewBox is fixed at the whole circle. Zoom *enlarges the rendered SVG* past
// its container and you scroll around it — so the circle can grow bigger than the
// screen and crowded arrows get room. Seats never move (their positions are
// game-critical); only the on-screen size does.
const VB_W = SIZE + PAD_X * 2
const VB_H = SIZE
const SCALE_MIN = 1
const SCALE_MAX = 3.5

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

const toneVar: Record<Tone, string> = {
  good: 'var(--color-good)',
  evil: 'var(--color-evil)',
  neutral: 'var(--color-neutral)',
  info: 'var(--color-info)',
  blue: 'var(--color-blue)',
}

export function SeatCircle({
  session,
  game,
  script,
  focusedId,
  onTokenTap,
  onBackgroundTap,
}: Props) {
  const n = session.players.length
  // Shrink tokens as the table grows so neighbours never touch; the divisor is
  // the minimum centre-to-centre gap in token radii.
  const tokenR = Math.max(15, Math.min(30, (RING_R * Math.sin(Math.PI / n)) / 1.2))
  const arrow = Math.max(6, tokenR * 0.5)

  const centres = new Map<PlayerId, Pt>()
  session.players.forEach((p) => {
    centres.set(p.id, seatPoint(p.seat, n, CENTER.x, CENTER.y, RING_R))
  })

  const edges = deriveEdges(session, game)
  const lit = focusedId ? neighboursOf(edges, focusedId) : null

  const baseBow = tokenR * 0.9
  const step = tokenR * 1.25

  // --- zoom --------------------------------------------------------------------
  // Zoom enlarges the SVG past its scroll box; one finger pans by native scroll,
  // two fingers pinch, the wheel and +/− buttons zoom. Taps select as normal — no
  // pointer capture, which is what had been eating clicks.
  const boxRef = useRef<HTMLDivElement>(null)
  // A crowded table (12+) opens already spread out — that's the point of zoom, and
  // it's why "−" (fit to screen) then has something to do. Small tables fit as-is.
  const initialScale = clamp(1 + Math.max(0, n - 10) * 0.12, SCALE_MIN, 1.8)
  const [scale, setScale] = useState(initialScale)
  const scaleRef = useRef(initialScale)
  // Scroll to apply after a zoom re-renders, so it stays centred on the pointer.
  const pendingScroll = useRef<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const box = boxRef.current
    if (box && pendingScroll.current) {
      box.scrollLeft = pendingScroll.current.left
      box.scrollTop = pendingScroll.current.top
      pendingScroll.current = null
    }
  }, [scale])

  // On first mount an expanded default starts centred, not in a corner.
  useLayoutEffect(() => {
    const box = boxRef.current
    if (box && scaleRef.current > SCALE_MIN) {
      box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2
      box.scrollTop = (box.scrollHeight - box.clientHeight) / 2
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Zoom to `next`, holding the content point under (clientX, clientY) in place. */
  function zoomTo(next: number, clientX: number, clientY: number) {
    const box = boxRef.current
    if (!box) return
    const cur = scaleRef.current
    const target = clamp(next, SCALE_MIN, SCALE_MAX)
    if (target === cur) return
    const rect = box.getBoundingClientRect()
    const w = box.clientWidth
    const h = w * (VB_H / VB_W)
    const px = clientX - rect.left
    const py = clientY - rect.top
    const fx = (box.scrollLeft + px) / (w * cur)
    const fy = (box.scrollTop + py) / (h * cur)
    pendingScroll.current = { left: fx * w * target - px, top: fy * h * target - py }
    scaleRef.current = target
    setScale(target)
  }

  function zoomBy(factor: number) {
    const box = boxRef.current
    if (!box) return
    const r = box.getBoundingClientRect()
    zoomTo(scaleRef.current * factor, r.left + r.width / 2, r.top + r.height / 2)
  }

  function resetZoom() {
    pendingScroll.current = { left: 0, top: 0 }
    scaleRef.current = SCALE_MIN
    setScale(SCALE_MIN)
  }

  // Wheel to zoom — non-passive so it doesn't just scroll the box.
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomTo(scaleRef.current * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY)
    }
    box.addEventListener('wheel', onWheel, { passive: false })
    return () => box.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Two-finger pinch zooms; one finger falls through to the box's native scroll.
  // On desktop there's no touch scroll, so a mouse drag pans (only when zoomed, so
  // a stray move during a click never suppresses selection).
  const pinch = useRef<{ dist: number } | null>(null)
  const pts = useRef(new Map<number, Pt>())
  const drag = useRef<Pt | null>(null)
  const dragged = useRef(false)

  function onPointerDown(e: React.PointerEvent) {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (e.pointerType === 'mouse' && e.button === 0 && scaleRef.current > SCALE_MIN) {
      drag.current = { x: e.clientX, y: e.clientY }
      dragged.current = false
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (pts.current.has(e.pointerId)) pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      if (pinch.current) zoomTo(scaleRef.current * (dist / pinch.current.dist), (a.x + b.x) / 2, (a.y + b.y) / 2)
      pinch.current = { dist }
      return
    }

    if (drag.current && (e.buttons & 1) && boxRef.current) {
      const dx = e.clientX - drag.current.x
      const dy = e.clientY - drag.current.y
      if (Math.abs(dx) + Math.abs(dy) > 3) dragged.current = true
      boxRef.current.scrollLeft -= dx
      boxRef.current.scrollTop -= dy
      drag.current = { x: e.clientX, y: e.clientY }
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    pts.current.delete(e.pointerId)
    if (pts.current.size < 2) pinch.current = null
    if (e.pointerType === 'mouse') drag.current = null
  }

  // A completed mouse-drag suppresses the click it would otherwise fire.
  const handleTokenTap = (id: PlayerId) => {
    if (dragged.current) {
      dragged.current = false
      return
    }
    onTokenTap(id)
  }
  const handleBackgroundTap = () => {
    if (dragged.current) {
      dragged.current = false
      return
    }
    onBackgroundTap()
  }

  const zoomed = scale > SCALE_MIN

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        {zoomed && (
          <button
            onClick={resetZoom}
            className="rounded-lg border border-line bg-surface/90 px-2 py-1 text-xs text-muted backdrop-blur active:bg-raised"
          >
            Reset
          </button>
        )}
        <button
          onClick={() => zoomBy(1 / 1.4)}
          aria-label="Zoom out"
          disabled={!zoomed}
          className="h-7 w-7 rounded-lg border border-line bg-surface/90 text-base leading-none text-muted backdrop-blur active:bg-raised disabled:opacity-30"
        >
          −
        </button>
        <button
          onClick={() => zoomBy(1.4)}
          aria-label="Zoom in"
          className="h-7 w-7 rounded-lg border border-line bg-surface/90 text-base leading-none text-muted backdrop-blur active:bg-raised"
        >
          +
        </button>
      </div>

      <div
        ref={boxRef}
        className={[
          'max-h-[78vh] touch-pan-x touch-pan-y select-none overflow-auto overscroll-contain',
          zoomed ? 'cursor-grab active:cursor-grabbing' : '',
        ].join(' ')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg
          viewBox={`${-PAD_X} 0 ${VB_W} ${VB_H}`}
          style={{ width: `${scale * 100}%`, aspectRatio: `${VB_W} / ${VB_H}`, display: 'block' }}
          role="img"
          aria-label="Player relationship diagram"
        >
        {/* Background catches taps to clear focus. */}
        <rect
          x={-PAD_X}
          y={0}
          width={SIZE + PAD_X * 2}
          height={SIZE}
          fill="transparent"
          onClick={handleBackgroundTap}
        />

      <g>
        {edges.map((e) => {
          const from = centres.get(e.from)!
          const to = centres.get(e.to)!
          const curve = baseBow + e.fanIndex * step
          const geo =
            e.from === e.to
              ? selfEdge(from, CENTER, { tokenR, curve, arrow })
              : directedEdge(from, to, { tokenR, curve, arrow })

          const dim = focusedId ? (e.from === focusedId || e.to === focusedId ? 1 : 0.08) : 1
          const color = toneVar[e.tone]

          return (
            <g key={e.key} style={{ opacity: dim }} pointerEvents="none">
              <path d={geo.path} fill="none" stroke={color} strokeWidth={2.25} strokeLinecap="round" />
              <polygon points={geo.arrow} fill={color} />
              {/* Repeated identical assertions collapse into one arrow; the count
                  badge at its midpoint shows how many times it was logged. */}
              {e.count > 1 && (
                <g>
                  <rect
                    x={geo.mid.x - tokenR * 0.5}
                    y={geo.mid.y - tokenR * 0.32}
                    width={tokenR}
                    height={tokenR * 0.64}
                    rx={tokenR * 0.32}
                    fill="var(--color-surface)"
                    stroke={color}
                    strokeWidth={1}
                  />
                  <text
                    x={geo.mid.x}
                    y={geo.mid.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={tokenR * 0.45}
                    fontWeight={600}
                    fill="var(--color-ink)"
                  >
                    ×{e.count}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </g>

      <g>
        {session.players.map((p) => {
          const c = centres.get(p.id)!
          const roleIds = currentRoleIds(session, p.id)
          const alive = isAlive(session, p.id)
          const dim = lit ? (lit.has(p.id) ? 1 : 0.22) : 1
          const focused = focusedId === p.id

          // My alignment read draws as a halo just outside the token — a separate
          // channel from the role-guess wedges (fill) and the alive/focus border.
          const lean = currentRead(session, p.id)
          const halo = haloStyle(lean)

          return (
            <g
              key={p.id}
              style={{ opacity: dim, cursor: 'pointer' }}
              onClick={() => handleTokenTap(p.id)}
            >
              {halo && (
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={tokenR + 4}
                  fill="none"
                  stroke={toneVar[leanTone(lean)]}
                  strokeWidth={halo.width}
                  strokeDasharray={halo.dash}
                  opacity={halo.opacity}
                />
              )}

              {/* Role-guess wedges, or a plain fill when there is no guess. */}
              {roleIds.length > 0 ? (
                roleIds.map((id, i) => {
                  const role = getRole(script, id)
                  const tone = role ? getTeam(game, role.team)?.tone : undefined
                  return (
                    <path
                      key={id}
                      d={tokenWedge(c, tokenR, i, roleIds.length)}
                      fill={tone ? toneVar[tone] : 'var(--color-raised)'}
                      fillOpacity={0.4}
                    />
                  )
                })
              ) : (
                <circle cx={c.x} cy={c.y} r={tokenR} fill="var(--color-raised)" />
              )}

              <circle
                cx={c.x}
                cy={c.y}
                r={tokenR}
                fill="none"
                stroke={focused ? 'var(--color-info)' : alive ? 'var(--color-line)' : 'var(--color-muted)'}
                strokeWidth={focused ? 3 : 2}
              />

              {/* The inner chip is the token's one non-role zone, so death lives
                  here where it never covers the role-guess wedges: a living seat
                  shows its number, a dead one shows 💀 in its place. The number is
                  not lost — it moves to the name label below. */}
              <circle cx={c.x} cy={c.y} r={tokenR * 0.46} fill="var(--color-surface)" />
              <text
                x={c.x}
                y={c.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={alive ? tokenR * 0.5 : tokenR * 0.6}
                fill="var(--color-ink)"
              >
                {alive ? p.seat + 1 : '💀'}
              </text>

              {/* Larger invisible hit area — tokens get small at 15 players. */}
              <circle cx={c.x} cy={c.y} r={tokenR + 6} fill="transparent" />
            </g>
          )
        })}
      </g>

      {/* Name labels sit outside the ring so they never overlap the wedges. */}
      <g pointerEvents="none">
        {session.players.map((p) => {
          const label = seatPoint(p.seat, n, CENTER.x, CENTER.y, RING_R + tokenR + 9)
          const anchor = label.x < CENTER.x - 4 ? 'end' : label.x > CENTER.x + 4 ? 'start' : 'middle'
          const dim = lit ? (lit.has(p.id) ? 1 : 0.22) : 1
          const alive = isAlive(session, p.id)
          // A dead token shows 💀 where its number was, so carry the seat number
          // here instead. Living labels are just the name.
          const shortName = p.name.length > 8 ? p.name.slice(0, 7) + '…' : p.name
          return (
            <text
              key={p.id}
              x={label.x}
              y={label.y}
              textAnchor={anchor}
              dominantBaseline="central"
              fontSize={12.5}
              fill={alive ? 'var(--color-ink)' : 'var(--color-muted)'}
              textDecoration={alive ? undefined : 'line-through'}
              style={{ opacity: dim }}
            >
              {alive ? shortName : `${p.seat + 1} ${shortName}`}
            </text>
          )
        })}
      </g>
      </svg>
      </div>
    </div>
  )
}
