import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { floorName, floorsOf, planFloor } from './design/floorPlans.js'

/**
 * Floor-by-floor plans of the chosen design option: pick a floor and see its
 * rooms (here) while the 3D model cuts away everything above it.
 *
 * Drawn in metres in the street-turned frame, with the street at the bottom.
 */

const FILL = {
  living: '#4a3f33',
  kitchen: '#4b4130',
  bed: '#37404a',
  bath: '#2f4548',
  garage: '#3c3f43',
  aisle: '#3a3d41',
  stall: '#45494e',
  stairs: '#5a4a2c',
  hall: '#352f2a',
  home: '#45392f',
  service: '#3b3530',
}

function Room({ r, turn = false }) {
  const w = r.u1 - r.u0
  const h = r.v1 - r.v0
  const big = Math.min(w, h) > 2.2 && w * h > 7
  // Text shrinks to fit the room's width (≈0.56 em per character).
  const across = turn ? h : w
  const fs = Math.min(0.62, Math.max(0.36, Math.min(w, h) / 6), (across * 0.9) / Math.max(4, (r.name || '').length * 0.56))
  const cx = (r.u0 + r.u1) / 2
  const cy = -(r.v0 + r.v1) / 2
  return (
    <g className={`fp-room fp-room--${r.kind}`}>
      <rect x={r.u0} y={-r.v1} width={w} height={h} fill={FILL[r.kind] || FILL.home} />
      {r.kind === 'stairs' && (
        <g className="fp-treads">
          {Array.from({ length: Math.max(2, Math.floor(Math.max(w, h) / 0.28)) }, (_, i) => {
            const along = h >= w
            const t = (i + 1) * 0.28
            return along ? <line key={i} x1={r.u0} x2={r.u1} y1={-r.v1 + t} y2={-r.v1 + t} /> : <line key={i} y1={-r.v1} y2={-r.v0} x1={r.u0 + t} x2={r.u0 + t} />
          })}
        </g>
      )}
      {r.name && Math.min(w, h) > 1.1 && (
        <text x={cx} y={cy} fontSize={fs} textAnchor="middle" dominantBaseline="middle" transform={turn ? `rotate(90 ${cx} ${cy})` : undefined}>
          <tspan x={cx} dy={big ? -fs * 0.45 : 0}>
            {r.name}
          </tspan>
          {big && (
            <tspan x={cx} dy={fs * 1.15} className="fp-sub">
              {r.sub ? `${r.sub} · ` : ''}
              {r.sqft.toLocaleString('en-US')} sq ft
            </tspan>
          )}
        </text>
      )}
    </g>
  )
}


/**
 * The drawing itself. `big` (the expanded view) turns long buildings sideways
 * so they fill a wide screen.
 */
function PlanSvg({ plan, label, big = false }) {
  const b = plan.bounds
  const pad = 2.2
  const w = b.u1 - b.u0 + pad * 2
  const h = b.v1 - b.v0 + pad * 2 + 1.6
  const turn = big && h > w * 1.3
  // rotate(-90) maps (x, y) → (y, −x): the turned drawing spans y-range × flipped x-range.
  const vb = turn ? [-b.v1 - pad, -(b.u1 + pad), h, w] : [b.u0 - pad, -b.v1 - pad, w, h]
  const tooMany = plan.buildings.reduce((s, x) => s + x.rooms.length, 0) > 220 && !big
  return (
    <svg className={big ? 'fp-svg fp-svg--big' : 'fp-svg'} viewBox={vb.join(' ')} role="img" aria-label={label}>
      <g transform={turn ? 'rotate(-90)' : undefined}>

        {plan.buildings.map((bd) => (
          <g key={bd.name}>
            {bd.rooms.filter((r) => !tooMany || r.kind !== 'stall').map((r, i) => (
              <Room key={i} r={r} turn={turn} />
            ))}
            {tooMany && bd.stalls.length > 0 && (
              <rect
                x={Math.min(...bd.stalls.map((s) => s.u0))}
                y={-Math.max(...bd.stalls.map((s) => s.v1))}
                width={Math.max(...bd.stalls.map((s) => s.u1)) - Math.min(...bd.stalls.map((s) => s.u0))}
                height={Math.max(...bd.stalls.map((s) => s.v1)) - Math.min(...bd.stalls.map((s) => s.v0))}
                className="fp-stallzone"
              />
            )}
            <rect className="fp-outline" x={bd.outline.u0} y={-bd.outline.v1} width={bd.outline.u1 - bd.outline.u0} height={bd.outline.v1 - bd.outline.v0} />
          </g>
        ))}
        {/* Street edge and a 10 ft scale bar */}
        <line className="fp-street" x1={b.u0 - pad} x2={b.u1 + pad} y1={-b.v0 + pad * 0.7} y2={-b.v0 + pad * 0.7} />
        <text className="fp-label" x={(b.u0 + b.u1) / 2} y={-b.v0 + pad * 0.7 + 0.9} textAnchor="middle" fontSize={0.6}>
          Street side ↓
        </text>
        <g className="fp-scale" transform={`translate(${b.u0} ${-b.v0 + pad * 0.7 + 1.4})`}>
          <line x1={0} x2={3.048} y1={0} y2={0} />
          <text x={3.3} y={0.2} fontSize={0.5}>
            10 ft
          </text>
        </g>
            </g>
    </svg>
  )
}

export function FloorPlan({ option, floor, setFloor, filters }) {
  const [big, setBig] = useState(false)
  useEffect(() => {
    if (!big) return
    const onKey = (e) => e.key === 'Escape' && (e.stopPropagation(), setBig(false))
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [big])
  if (!option?.vols?.length) return null
  const floors = floorsOf(option)
  const shown = floor ?? floors[0]
  const plan = planFloor(option, shown, filters)
  const b = plan.bounds
  if (!b) return null
  const homes = plan.buildings.flatMap((x) => x.rooms).filter((r) => r.kind === 'home').length
  const stalls = plan.buildings.reduce((s, x) => s + x.stalls.length, 0)
  return (
    <div className="fp">
      <div className="fp-pills" role="tablist" aria-label="Floors">
        <button type="button" role="tab" aria-selected={floor == null} className={floor == null ? 'is-on' : ''} onClick={() => setFloor(null)}>
          All floors
        </button>
        {floors.map((f) => (
          <button key={f} type="button" role="tab" aria-selected={floor === f} className={floor === f ? 'is-on' : ''} onClick={() => setFloor(f)}>
            {f === 0 ? 'Ground' : floorName(f).replace(' floor', '')}
          </button>
        ))}
      </div>

      <p className="fp-title">
        {floorName(shown)}
        <small>
          {homes ? `${homes} home${homes === 1 ? '' : 's'}` : ''}
          {stalls ? `${homes ? ' · ' : ''}${stalls} parking spaces` : ''}
          {floor == null ? ' · pick a floor to cut the 3D model' : ''}
        </small>
      </p>

      <PlanSvg plan={plan} label={`Plan of the ${floorName(shown).toLowerCase()}`} />
      <button type="button" className="fp-expand" onClick={() => setBig(true)}>
        ⤢ Expand plan
      </button>
      {big &&
        createPortal(
          <div className="fp-big" role="dialog" aria-modal="true" aria-label={`${floorName(shown)} plan`}>
            <div className="fp-big__bar">
              <p>
                {option.name} · {floorName(shown)}
                <small>{homes ? ` · ${homes} homes` : ''}{stalls ? ` · ${stalls} parking spaces` : ''}</small>
              </p>
              <button type="button" onClick={() => setBig(false)} aria-label="Close the plan">
                ✕
              </button>
            </div>
            <PlanSvg plan={plan} label={`Plan of the ${floorName(shown).toLowerCase()}`} big />
          </div>,
          document.body,
        )}
      <p className="fp-note">Concept layout — room sizes are indicative, not an architect’s plan.</p>
    </div>
  )
}
