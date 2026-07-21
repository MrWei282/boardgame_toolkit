// Pure geometry for the seat circle. No React, no layout library — seat order is
// game-critical in BotC, so positions are fixed trigonometry and a force layout
// would only fight it. Everything here is a pure function of its inputs so the
// SVG component stays declarative.

export type Pt = { x: number; y: number }

const TAU = Math.PI * 2

/** Seat `index` of `total`, placed on the ring. Seat 0 at 12 o'clock, clockwise. */
export function seatPoint(index: number, total: number, cx: number, cy: number, r: number): Pt {
  const angle = -Math.PI / 2 + (index / total) * TAU
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
}

function sub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y }
}
function add(a: Pt, b: Pt): Pt {
  return { x: a.x + b.x, y: a.y + b.y }
}
function scale(a: Pt, k: number): Pt {
  return { x: a.x * k, y: a.y * k }
}
function len(a: Pt): number {
  return Math.hypot(a.x, a.y) || 1
}
function norm(a: Pt): Pt {
  return scale(a, 1 / len(a))
}
/** Left-hand perpendicular in screen space (y points down). */
function perp(a: Pt): Pt {
  return { x: -a.y, y: a.x }
}

export type EdgeGeometry = {
  /** SVG path data for the curved shaft. */
  path: string
  /** SVG points for a triangular arrowhead at the target end. */
  arrow: string
}

export type EdgeOpts = {
  /** Token radius — the shaft stops this far short of each centre. */
  tokenR: number
  /**
   * Perpendicular bow of the curve. Signed and measured left of travel, so A→B
   * and B→A bow to opposite sides and never overlap. Callers fan parallel edges
   * by increasing the magnitude.
   */
  curve: number
  /** Arrowhead length. */
  arrow: number
}

/** A curved directed arrow from one seat centre to another. */
export function directedEdge(from: Pt, to: Pt, opts: EdgeOpts): EdgeGeometry {
  const chord = sub(to, from)
  const dir = norm(chord)
  const mid = scale(add(from, to), 0.5)
  const control = add(mid, scale(perp(dir), opts.curve))

  // B'(0) ∝ control - from, B'(1) ∝ to - control for a quadratic bezier, so the
  // shaft leaves and enters along those tangents. Trim each end by the token
  // radius so the arrow touches the token edge, not its centre.
  const startDir = norm(sub(control, from))
  const endDir = norm(sub(to, control))
  const start = add(from, scale(startDir, opts.tokenR))
  const end = sub(to, scale(endDir, opts.tokenR))

  const path = `M ${r(start.x)} ${r(start.y)} Q ${r(control.x)} ${r(control.y)} ${r(end.x)} ${r(end.y)}`
  const arrow = arrowHead(end, endDir, opts.arrow)
  return { path, arrow }
}

/**
 * A small loop that leaves a token and returns to it, for the rare self-target
 * edge (e.g. self-nomination). Bows outward, away from the circle centre.
 */
export function selfEdge(at: Pt, center: Pt, opts: EdgeOpts): EdgeGeometry {
  const out = norm(sub(at, center))
  const side = perp(out)
  const reach = opts.tokenR * 2.4
  const spread = opts.tokenR * 0.9

  const base = add(at, scale(out, opts.tokenR))
  const start = add(base, scale(side, spread))
  const end = sub(base, scale(side, spread))
  const c1 = add(add(at, scale(out, reach)), scale(side, spread))
  const c2 = sub(add(at, scale(out, reach)), scale(side, spread))

  const path = `M ${r(start.x)} ${r(start.y)} C ${r(c1.x)} ${r(c1.y)} ${r(c2.x)} ${r(c2.y)} ${r(end.x)} ${r(end.y)}`
  // Arrow enters the token pointing back inward.
  const arrow = arrowHead(end, scale(out, -1), opts.arrow)
  return { path, arrow }
}

function arrowHead(tip: Pt, dir: Pt, size: number): string {
  const back = sub(tip, scale(dir, size))
  const wing = scale(perp(dir), size * 0.55)
  const a = add(back, wing)
  const b = sub(back, wing)
  return `${r(tip.x)},${r(tip.y)} ${r(a.x)},${r(a.y)} ${r(b.x)},${r(b.y)}`
}

/** Wedge path for one of `count` equal slices of a token, for role-guess fills. */
export function tokenWedge(center: Pt, radius: number, index: number, count: number): string {
  if (count <= 1) {
    return `M ${r(center.x - radius)} ${r(center.y)} a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0`
  }
  // Start at 12 o'clock so slices read clockwise like a clock face.
  const a0 = -Math.PI / 2 + (index / count) * TAU
  const a1 = -Math.PI / 2 + ((index + 1) / count) * TAU
  const p0 = { x: center.x + radius * Math.cos(a0), y: center.y + radius * Math.sin(a0) }
  const p1 = { x: center.x + radius * Math.cos(a1), y: center.y + radius * Math.sin(a1) }
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M ${r(center.x)} ${r(center.y)} L ${r(p0.x)} ${r(p0.y)} A ${radius} ${radius} 0 ${large} 1 ${r(p1.x)} ${r(p1.y)} Z`
}

/** Round to 2dp to keep the emitted SVG small and diff-friendly. */
function r(n: number): number {
  return Math.round(n * 100) / 100
}
