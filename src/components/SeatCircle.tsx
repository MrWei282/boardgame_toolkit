import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getRole, getTeam } from '../config'
import { deriveEdges, neighboursOf } from '../diagram/edges'
import { directedEdge, seatPoint, selfEdge, tokenWedge, type Pt } from '../diagram/geometry'
import { isAlive } from '../projections'
import { haloStyle, leanTone } from '../read'
import { useT } from '../i18n'
import { currentReadValue, currentRoleIds } from '../store'
import { resolveTeamColor } from '../tone'
import type { GameConfig, PlayerId, ScriptConfig, Session, Tone } from '../types'

type Props = {
  session: Session
  game: GameConfig
  script: ScriptConfig
  focusedId: PlayerId | null
  onTokenTap: (id: PlayerId) => void
  onBackgroundTap: () => void
  /** Relation ids whose arrows are toggled off (declutter when several fly at once). */
  hiddenRelations?: Set<string>
}

const BASE_RING_R = 132
// Name labels sit outside the ring at 3/9 o'clock; PAD_X widens the box for them.
const PAD_X = 50
// Room from a token's edge to the outer viewBox, for the name-label ring.
const LABEL_MARGIN = 22

// Zoom is a *spread*: it grows the ring radius so the seats move apart (tokens keep
// their size), giving crowded arrows room. The SVG grows with the ring and you
// scroll/pan around it — this is different from magnifying, which keeps the gaps.
const SPREAD_MIN = 1
const SPREAD_MAX = 2.6

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

// Relation/read tones (the four base palette colours). Team colours are resolved
// separately via resolveTeamColor, since a team's colour may be any hex.
const toneVar: Record<Tone, string> = {
  good: 'var(--color-good)',
  evil: 'var(--color-evil)',
  neutral: 'var(--color-neutral)',
  info: 'var(--color-info)',
}

export function SeatCircle({
  session,
  game,
  script,
  focusedId,
  onTokenTap,
  onBackgroundTap,
  hiddenRelations,
}: Props) {
  const { t } = useT()
  const n = session.players.length
  // Token size is fixed by the table size (so neighbours never touch at spread 1);
  // spreading the ring past that only opens up the gaps, it doesn't grow the tokens.
  const tokenR = Math.max(15, Math.min(30, (BASE_RING_R * Math.sin(Math.PI / n)) / 1.2))
  const arrow = Math.max(6, tokenR * 0.5)

  // --- zoom (ring spread) ------------------------------------------------------
  const boxRef = useRef<HTMLDivElement>(null)
  // A crowded table (12+) opens already spread out — that's the point — so "Fit"
  // and "−" have something to do. Small tables start compact.
  const initialSpread = clamp(1 + Math.max(0, n - 10) * 0.12, SPREAD_MIN, 1.8)
  const [spread, setSpread] = useState(initialSpread)
  const spreadRef = useRef(initialSpread)

  const ringR = BASE_RING_R * spread
  const half = ringR + tokenR + LABEL_MARGIN
  const CENTER: Pt = { x: half, y: half }
  const vbW = 2 * half + 2 * PAD_X
  const vbH = 2 * half
  // Rendered width relative to the compact (spread 1) box; at spread 1 it fits the
  // container, and 1 user-unit stays a constant number of pixels as it grows — so
  // tokens keep their pixel size while the gaps between them grow.
  const BASE_VB_W = 2 * (BASE_RING_R + tokenR + LABEL_MARGIN) + 2 * PAD_X
  const widthPct = (vbW / BASE_VB_W) * 100
  const vbWOf = (s: number) => 2 * (BASE_RING_R * s + tokenR + LABEL_MARGIN) + 2 * PAD_X
  const vbHOf = (s: number) => 2 * (BASE_RING_R * s + tokenR + LABEL_MARGIN)

  const centres = new Map<PlayerId, Pt>()
  session.players.forEach((p) => {
    centres.set(p.id, seatPoint(p.seat, n, CENTER.x, CENTER.y, ringR))
  })

  // Hidden relations drop out entirely — including from focus lighting — so toggling
  // one off truly declutters rather than just greying its arrows.
  const edges = deriveEdges(session, game).filter((e) => !hiddenRelations?.has(e.relation))
  const lit = focusedId ? neighboursOf(edges, focusedId) : null

  const baseBow = tokenR * 0.9
  const step = tokenR * 1.25

  // Scroll to apply after a spread change re-renders; keeps the same region in view.
  const pendingScroll = useRef<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const box = boxRef.current
    if (box && pendingScroll.current) {
      box.scrollLeft = pendingScroll.current.left
      box.scrollTop = pendingScroll.current.top
      pendingScroll.current = null
    }
  }, [spread])

  // An expanded default starts centred, not in a corner.
  useLayoutEffect(() => {
    const box = boxRef.current
    if (box && spreadRef.current > SPREAD_MIN) {
      box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2
      box.scrollTop = (box.scrollHeight - box.clientHeight) / 2
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Change the spread, keeping the same relative scroll position so the view
  // doesn't jump. (The layout reflows radially, so we anchor by fraction, not by a
  // fixed point.)
  function setSpreadKeepView(next: number) {
    const box = boxRef.current
    if (!box) return
    const s = clamp(next, SPREAD_MIN, SPREAD_MAX)
    if (Math.abs(s - spreadRef.current) < 1e-3) return
    const fx = box.scrollWidth > box.clientWidth + 1 ? box.scrollLeft / (box.scrollWidth - box.clientWidth) : 0.5
    const fy = box.scrollHeight > box.clientHeight + 1 ? box.scrollTop / (box.scrollHeight - box.clientHeight) : 0.5
    const cw = box.clientWidth
    const newW = (cw * vbWOf(s)) / BASE_VB_W
    const newH = (cw * vbHOf(s)) / BASE_VB_W
    pendingScroll.current = { left: fx * (newW - cw), top: fy * (newH - box.clientHeight) }
    spreadRef.current = s
    setSpread(s)
  }

  const zoomBy = (factor: number) => setSpreadKeepView(spreadRef.current * factor)

  // Wheel to zoom — non-passive so it doesn't just scroll the box.
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setSpreadKeepView(spreadRef.current * Math.exp(-e.deltaY * 0.0015))
    }
    box.addEventListener('wheel', onWheel, { passive: false })
    return () => box.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Two-finger pinch spreads; one finger falls through to the box's native scroll.
  // On desktop there's no touch scroll, so a mouse drag pans (only when spread, so a
  // stray move during a click never suppresses selection).
  const pinch = useRef<{ dist: number } | null>(null)
  const pts = useRef(new Map<number, Pt>())
  const drag = useRef<Pt | null>(null)
  const dragged = useRef(false)

  function onPointerDown(e: React.PointerEvent) {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (e.pointerType === 'mouse' && e.button === 0 && spreadRef.current > SPREAD_MIN) {
      drag.current = { x: e.clientX, y: e.clientY }
      dragged.current = false
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (pts.current.has(e.pointerId)) pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      if (pinch.current) setSpreadKeepView(spreadRef.current * (dist / pinch.current.dist))
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

  const spreadOut = spread > SPREAD_MIN + 1e-3

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        {spreadOut && (
          <button
            onClick={() => setSpreadKeepView(SPREAD_MIN)}
            className="rounded-lg border border-line bg-surface/90 px-2 py-1 text-xs text-muted backdrop-blur active:bg-raised"
          >
            {t('diagram.fit')}
          </button>
        )}
        <button
          onClick={() => zoomBy(1 / 1.4)}
          aria-label={t('diagram.tighten')}
          disabled={spread <= SPREAD_MIN + 1e-3}
          className="h-7 w-7 rounded-lg border border-line bg-surface/90 text-base leading-none text-muted backdrop-blur active:bg-raised disabled:opacity-30"
        >
          −
        </button>
        <button
          onClick={() => zoomBy(1.4)}
          aria-label={t('diagram.spread')}
          disabled={spread >= SPREAD_MAX - 1e-3}
          className="h-7 w-7 rounded-lg border border-line bg-surface/90 text-base leading-none text-muted backdrop-blur active:bg-raised disabled:opacity-30"
        >
          +
        </button>
      </div>

      <div
        ref={boxRef}
        className={[
          'max-h-[78vh] touch-pan-x touch-pan-y select-none overflow-auto overscroll-contain',
          spreadOut ? 'cursor-grab active:cursor-grabbing' : '',
        ].join(' ')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg
          viewBox={`${-PAD_X} 0 ${vbW} ${vbH}`}
          style={{ width: `${widthPct}%`, aspectRatio: `${vbW} / ${vbH}`, display: 'block' }}
          role="img"
          aria-label={t('diagram.aria')}
        >
          {/* Background catches taps to clear focus. */}
          <rect x={-PAD_X} y={0} width={vbW} height={vbH} fill="transparent" onClick={handleBackgroundTap} />

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
              const alive = isAlive(game, session, p.id)
              const dim = lit ? (lit.has(p.id) ? 1 : 0.22) : 1
              const focused = focusedId === p.id

              // My alignment read draws as a halo just outside the token — a separate
              // channel from the role-guess wedges (fill) and the alive/focus border.
              const lean = currentReadValue(session, p.id)
              const halo = haloStyle(lean)

              return (
                <g key={p.id} style={{ opacity: dim, cursor: 'pointer' }} onClick={() => handleTokenTap(p.id)}>
                  {halo && lean !== null && (
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
                      const color = role ? getTeam(game, role.team)?.color : undefined
                      return (
                        <path
                          key={id}
                          d={tokenWedge(c, tokenR, i, roleIds.length)}
                          fill={color ? resolveTeamColor(color) : 'var(--color-raised)'}
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
              const label = seatPoint(p.seat, n, CENTER.x, CENTER.y, ringR + tokenR + 9)
              const anchor = label.x < CENTER.x - 4 ? 'end' : label.x > CENTER.x + 4 ? 'start' : 'middle'
              const dim = lit ? (lit.has(p.id) ? 1 : 0.22) : 1
              const alive = isAlive(game, session, p.id)
              // A dead token shows 💀 where its number was, so carry the seat number
              // here instead. Living labels are just the name.
              const shortName = p.name.length > 8 ? p.name.slice(0, 7) + '…' : p.name
              const displayName = alive ? shortName : `${p.seat + 1} ${shortName}`
              // My current role guess(es), spelled out under the name — quick-glance
              // reading matters more at the table than decoding the wedge colours.
              const roleIds = currentRoleIds(session, p.id)
              const roleText = roleIds.map((id) => getRole(script, id)?.name ?? id).join(' / ')
              const roleLabel = roleText.length > 20 ? roleText.slice(0, 19) + '…' : roleText
              return (
                <g key={p.id} style={{ opacity: dim }}>
                  <text
                    x={label.x}
                    y={roleText ? label.y - 6 : label.y}
                    textAnchor={anchor}
                    dominantBaseline="central"
                    fontSize={12.5}
                    fill={alive ? 'var(--color-ink)' : 'var(--color-muted)'}
                    textDecoration={alive ? undefined : 'line-through'}
                  >
                    {displayName}
                  </text>
                  {roleText && (
                    <text
                      x={label.x}
                      y={label.y + 7}
                      textAnchor={anchor}
                      dominantBaseline="central"
                      fontSize={9.5}
                      fill="var(--color-muted)"
                    >
                      {roleLabel}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>
    </div>
  )
}
