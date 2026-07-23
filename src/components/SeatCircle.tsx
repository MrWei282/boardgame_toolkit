import { useEffect, useRef, useState } from 'react'
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

// The full (unzoomed) viewBox. Zoom shrinks a window inside it; the seats stay put
// (their positions are game-critical) — this only changes what's on screen.
const VB_MIN_X = -PAD_X
const VB_MIN_Y = 0
const VB_W = SIZE + PAD_X * 2
const VB_H = SIZE
const K_MIN = 1
const K_MAX = 4

type View = { k: number; vx: number; vy: number }
const FULL_VIEW: View = { k: K_MIN, vx: VB_MIN_X, vy: VB_MIN_Y }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Keep the zoom window inside the base viewBox so you can't pan into blank space. */
function clampView(v: View): View {
  const k = clamp(v.k, K_MIN, K_MAX)
  const w = VB_W / k
  const h = VB_H / k
  return {
    k,
    vx: clamp(v.vx, VB_MIN_X, VB_MIN_X + VB_W - w),
    vy: clamp(v.vy, VB_MIN_Y, VB_MIN_Y + VB_H - h),
  }
}

/** Zoom by `factor` about a pivot (in user/viewBox coords), holding it in place. */
function zoomAt(v: View, pivot: Pt, factor: number): View {
  const k = clamp(v.k * factor, K_MIN, K_MAX)
  const fracX = (pivot.x - v.vx) / (VB_W / v.k)
  const fracY = (pivot.y - v.vy) / (VB_H / v.k)
  return clampView({ k, vx: pivot.x - fracX * (VB_W / k), vy: pivot.y - fracY * (VB_H / k) })
}

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

  // --- zoom / pan --------------------------------------------------------------
  // At 15 seats the tokens get small, so allow zooming in. It's a pure view
  // transform (the dynamic viewBox) — seat positions never move.
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<View>(FULL_VIEW)
  // Live client positions per active pointer, plus gesture bookkeeping.
  const pointers = useRef(new Map<number, Pt>())
  const pinch = useRef<{ dist: number; mid: Pt } | null>(null)
  // True once a gesture moved enough to be a pan, so it isn't also read as a tap.
  const moved = useRef(false)
  const downAt = useRef<Pt | null>(null)

  function userFromClient(v: View, clientX: number, clientY: number): Pt {
    const rect = svgRef.current!.getBoundingClientRect()
    return {
      x: v.vx + ((clientX - rect.left) / rect.width) * (VB_W / v.k),
      y: v.vy + ((clientY - rect.top) / rect.height) * (VB_H / v.k),
    }
  }

  // Wheel must be a non-passive native listener to preventDefault the page scroll.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = Math.exp(-e.deltaY * 0.0015)
      setView((v) => zoomAt(v, userFromClient(v, e.clientX, e.clientY), factor))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function midAndDist(): { mid: Pt; dist: number } {
    const [a, b] = [...pointers.current.values()]
    return {
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    moved.current = false
    downAt.current = { x: e.clientX, y: e.clientY }
    if (pointers.current.size === 2) pinch.current = midAndDist()
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, cur)
    if (downAt.current && Math.hypot(cur.x - downAt.current.x, cur.y - downAt.current.y) > 8) {
      moved.current = true
    }

    if (pointers.current.size >= 2) {
      const before = pinch.current
      const { mid, dist } = midAndDist()
      if (before) {
        setView((v) => {
          let nv = zoomAt(v, userFromClient(v, mid.x, mid.y), dist / before.dist)
          const rect = svgRef.current!.getBoundingClientRect()
          nv = clampView({
            ...nv,
            vx: nv.vx - ((mid.x - before.mid.x) / rect.width) * (VB_W / nv.k),
            vy: nv.vy - ((mid.y - before.mid.y) / rect.height) * (VB_H / nv.k),
          })
          return nv
        })
      }
      pinch.current = { mid, dist }
    } else if (view.k > K_MIN) {
      // Single-finger / mouse drag pans only once zoomed in.
      setView((v) => {
        const rect = svgRef.current!.getBoundingClientRect()
        return clampView({
          ...v,
          vx: v.vx - ((cur.x - prev.x) / rect.width) * (VB_W / v.k),
          vy: v.vy - ((cur.y - prev.y) / rect.height) * (VB_H / v.k),
        })
      })
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  const handleTokenTap = (id: PlayerId) => {
    if (!moved.current) onTokenTap(id)
  }
  const handleBackgroundTap = () => {
    if (!moved.current) onBackgroundTap()
  }

  return (
    <div className="relative">
      {view.k > K_MIN && (
        <button
          onClick={() => setView(FULL_VIEW)}
          className="absolute top-2 right-2 z-10 rounded-lg border border-line bg-surface/90 px-2.5 py-1 text-xs text-muted backdrop-blur active:bg-raised"
        >
          Reset zoom
        </button>
      )}
      <svg
        ref={svgRef}
        viewBox={`${view.vx} ${view.vy} ${VB_W / view.k} ${VB_H / view.k}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label="Player relationship diagram"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
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
  )
}
