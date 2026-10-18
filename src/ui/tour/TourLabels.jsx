import { labelWindow, STOPS } from '../../config/tour.config.js'
import { labelEls } from '../../scroll/tourState.js'

const LABELS = STOPS.flatMap((stop) =>
  stop.labels.map((label, i) => ({ ...label, key: `${stop.room}-${i}`, window: labelWindow(stop) })),
)

/** Registers (or unregisters) one half of a label — the text or its arrow. */
function bind(label, part) {
  return (el) => {
    const entry = labelEls.get(label.key) ?? { ...label, shown: false }
    entry[part] = el
    if (entry.root && entry.path) labelEls.set(label.key, entry)
    else if (!el) labelEls.delete(label.key)
    else labelEls.set(label.key, entry)
  }
}

/**
 * The walkthrough's arrow callouts, in the style of ReMo's Instagram posts:
 * white italic text and a thin curved arrow onto the feature. This component
 * only lays them out; TourTracker (inside the canvas) moves them each frame,
 * because only it knows where the camera is.
 */
export function TourLabels() {
  return (
    <div className="tlabels" aria-hidden="true">
      <svg className="tlabels__arrows">
        {LABELS.map((label) => (
          <path key={label.key} ref={bind(label, 'path')} style={{ opacity: 0 }} />
        ))}
      </svg>
      {LABELS.map((label) => (
        <div key={label.key} ref={bind(label, 'root')} className="tlabel" style={{ opacity: 0 }}>
          <span className={`tlabel__text ${label.dy < 0 ? 'is-up' : ''}`}>{label.text}</span>
        </div>
      ))}
    </div>
  )
}
