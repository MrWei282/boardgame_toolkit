import { getRole, getTeam } from '../config'
import { deriveEdges, neighboursOf } from '../diagram/edges'
import { directedEdge, seatPoint, selfEdge, tokenWedge, type Pt } from '../diagram/geometry'
import { currentRoleIds } from '../store'
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

  return (
    <svg
      viewBox={`${-PAD_X} 0 ${SIZE + PAD_X * 2} ${SIZE}`}
      className="w-full touch-none select-none"
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
        onClick={onBackgroundTap}
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
            </g>
          )
        })}
      </g>

      <g>
        {session.players.map((p) => {
          const c = centres.get(p.id)!
          const roleIds = currentRoleIds(session, p.id)
          const dim = lit ? (lit.has(p.id) ? 1 : 0.22) : 1
          const focused = focusedId === p.id

          return (
            <g
              key={p.id}
              style={{ opacity: dim, cursor: 'pointer' }}
              onClick={() => onTokenTap(p.id)}
            >
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
                stroke={focused ? 'var(--color-info)' : p.alive ? 'var(--color-line)' : 'var(--color-evil)'}
                strokeWidth={focused ? 3 : 2}
                strokeDasharray={p.alive ? undefined : '4 3'}
              />

              {/* Seat number on a chip so it stays legible over the wedges. */}
              <circle cx={c.x} cy={c.y} r={tokenR * 0.44} fill="var(--color-surface)" />
              <text
                x={c.x}
                y={c.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={tokenR * 0.5}
                fill="var(--color-ink)"
              >
                {p.seat + 1}
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
          return (
            <text
              key={p.id}
              x={label.x}
              y={label.y}
              textAnchor={anchor}
              dominantBaseline="central"
              fontSize={11}
              fill={p.alive ? 'var(--color-ink)' : 'var(--color-muted)'}
              textDecoration={p.alive ? undefined : 'line-through'}
              style={{ opacity: dim }}
            >
              {p.name.length > 8 ? p.name.slice(0, 7) + '…' : p.name}
            </text>
          )
        })}
      </g>
    </svg>
  )
}
