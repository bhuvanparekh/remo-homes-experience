import { useEffect, useRef } from 'react'
import { CHAPTERS } from '../../config/chapters.config.js'
import { BOUNDS, ROOMS_PLAN } from '../../config/floorplan.js'
import { STOPS } from '../../config/tour.config.js'
import { useStoreValue } from '../../core/store.js'
import { journey, selectIndex } from '../../scroll/journey.js'
import { useJourney } from '../../scroll/JourneyProvider.jsx'
import { liveCamera, modes, selectRenders, selectXray } from '../../scroll/tourState.js'

const HOME = CHAPTERS.findIndex((c) => c.id === 'home')
const TOUR = CHAPTERS.findIndex((c) => c.id === 'tour')

const PAD = 0.35
const VIEW = [BOUNDS.x0 - PAD, BOUNDS.z0 - PAD, BOUNDS.x1 - BOUNDS.x0 + PAD * 2, BOUNDS.z1 - BOUNDS.z0 + PAD * 2 + 1.2]
const ENTRY_MARK = [2.84, BOUNDS.z1 + 0.75]

const bounds = (poly) => {
  const xs = poly.map((p) => p[0])
  const zs = poly.map((p) => p[1])
  return { x: Math.min(...xs), z: Math.min(...zs), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs) }
}
const ROOM_RECTS = ROOMS_PLAN.map((r) => ({ ...r, ...bounds(r.poly), stop: STOPS.find((s) => s.plan === r.id) }))
const ENTRY_STOP = STOPS.find((s) => s.room === 'entry')

/** Which plan room contains (x, z) — or 'entry' out on the front path. */
function roomAt(x, z) {
  const r = ROOM_RECTS.find((r) => x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d)
  if (r) return r.id
  return z > BOUNDS.z1 ? 'entry' : null
}

/**
 * The 2D plan, drawn from the same floorplan.js the 3D house is built from:
 * a "you are here" dot with a view cone that follows the real camera, the
 * current room lit, and every tour room clickable to jump there.
 */
function MiniPlan({ goTo }) {
  const dot = useRef(null)
  const rooms = useRef({})
  const current = useRef(null)

  useEffect(
    () =>
      journey.subscribe(() => {
        const { x, z, heading } = liveCamera
        if (dot.current) dot.current.setAttribute('transform', `translate(${x.toFixed(2)} ${z.toFixed(2)}) rotate(${((heading * 180) / Math.PI).toFixed(1)})`)
        // Light the room being described; between stops, the one we're in.
        const { index, t } = journey.get()
        const stop = index === TOUR ? STOPS.find((s) => t >= s.from - 0.035 && t <= s.to + 0.03) : null
        const id = stop ? (stop.plan ?? 'entry') : roomAt(x, z)
        if (id !== current.current) {
          rooms.current[current.current]?.classList.remove('is-here')
          rooms.current[id]?.classList.add('is-here')
          current.current = id
        }
      }),
    [],
  )

  return (
    <svg className="plan" viewBox={VIEW.join(' ')} role="group" aria-label="Floor plan — choose a room">
      <rect className="plan__shell" x={BOUNDS.x0} y={BOUNDS.z0} width={BOUNDS.x1 - BOUNDS.x0} height={BOUNDS.z1 - BOUNDS.z0} />
      {ROOM_RECTS.map((r) => {
        const props = r.stop
          ? { role: 'button', tabIndex: 0, 'aria-label': `Go to ${r.stop.content.name}`, onClick: () => goTo(r.stop), onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && goTo(r.stop) }
          : {}
        return (
          <g key={r.id} ref={(el) => (rooms.current[r.id] = el)} className={`plan__room ${r.stop ? 'is-stop' : ''}`} {...props}>
            <rect x={r.x} y={r.z} width={r.w} height={r.d} />
            {r.stop && (
              <text x={r.label?.[0] ?? r.x + r.w / 2} y={r.label?.[1] ?? r.z + r.d / 2}>
                {r.stop.content.name}
              </text>
            )}
          </g>
        )
      })}
      <g
        ref={(el) => (rooms.current.entry = el)}
        className="plan__room plan__entry is-stop"
        role="button"
        tabIndex={0}
        aria-label="Go to Entry"
        onClick={() => goTo(ENTRY_STOP)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && goTo(ENTRY_STOP)}
      >
        <rect x={ENTRY_MARK[0] - 1.3} y={ENTRY_MARK[1] - 0.5} width={2.6} height={1.0} rx={0.5} />
        <text x={ENTRY_MARK[0]} y={ENTRY_MARK[1]}>Entry</text>
      </g>
      <g ref={dot} className="plan__you" pointerEvents="none">
        <path d="M0 0 L2.2 -1.1 A2.45 2.45 0 0 1 2.2 1.1 Z" />
        <circle r={0.32} />
      </g>
    </svg>
  )
}

function Toggle({ on, onClick, children }) {
  return (
    <button type="button" className={`tpanel__toggle ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={onClick}>
      <span className="tpanel__switch" aria-hidden="true" />
      {children}
    </button>
  )
}

/**
 * Bottom-right walkthrough panel: the mini-plan during the tour, and the
 * X-ray (see the steel frame) and render toggles. X-ray is offered from the
 * orbit chapter on, where the whole frame is in view.
 */
export function TourPanel() {
  const index = useStoreValue(journey, selectIndex)
  const xray = useStoreValue(modes, selectXray)
  const renders = useStoreValue(modes, selectRenders)
  const { goToChapter } = useJourney()

  const showPanel = index === HOME || index === TOUR
  const goTo = (stop) => goToChapter(TOUR, stop.from + 0.012)

  return (
    <aside className={`tpanel ${showPanel ? 'is-visible' : ''} ${index === TOUR ? 'is-tour' : ''}`} inert={!showPanel}>
      {index === TOUR && <MiniPlan goTo={goTo} />}
      <div className="tpanel__toggles">
        <Toggle on={xray} onClick={() => modes.set({ xray: !xray })}>
          X-ray steel frame
        </Toggle>
        {index === TOUR && (
          <Toggle on={renders} onClick={() => modes.set({ renders: !renders })}>
            ReMo renders
          </Toggle>
        )}
      </div>
    </aside>
  )
}
