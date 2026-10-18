import { useEffect, useRef } from 'react'
import { CHAPTERS } from '../../config/chapters.config.js'
import { MEDIA } from '../../config/media.js'
import { renderWindow, STOPS } from '../../config/tour.config.js'
import { range, smoothstep } from '../../core/math.js'
import { useStoreValue } from '../../core/store.js'
import { journey, selectIndex } from '../../scroll/journey.js'
import { modes, selectRenders } from '../../scroll/tourState.js'

const TOUR = CHAPTERS.findIndex((c) => c.id === 'tour')
const IN = 0.03
const OUT = 0.025

/**
 * At every stop, ReMo's own render of that room fades in over the 3D view for
 * the second half of the hold, then gives the stage back as the camera moves
 * on. The camera stops are posed to match each render's viewpoint, so it
 * reads as the model resolving into the finished room.
 *
 * Images are only requested once the visitor reaches the house.
 */
export function RenderFade() {
  const index = useStoreValue(journey, selectIndex)
  const enabled = useStoreValue(modes, selectRenders)
  const load = index >= TOUR - 1
  const imgs = useRef([])
  const tag = useRef(null)

  useEffect(() => {
    const apply = ({ index: i, t }) => {
      let peak = 0
      STOPS.forEach((stop, s) => {
        const el = imgs.current[s]
        if (!el) return
        const [from, to] = renderWindow(stop)
        const o = enabled && i === TOUR ? smoothstep(Math.min(range(t, from, from + IN), 1 - range(t, to - OUT, to))) : 0
        peak = Math.max(peak, o)
        el.style.opacity = o
        el.style.visibility = o < 0.005 ? 'hidden' : 'visible'
        el.style.transform = `scale(${1.06 - 0.06 * o})`
      })
      if (tag.current) tag.current.style.opacity = peak
    }
    apply(journey.get())
    return journey.subscribe(apply)
  }, [enabled])

  if (!load) return null

  return (
    <div className="renders" aria-hidden="true">
      {STOPS.map((stop, s) => (
        <img
          key={stop.room}
          ref={(el) => (imgs.current[s] = el)}
          className="renders__img"
          src={MEDIA.rooms[stop.room]}
          alt=""
          decoding="async"
          style={{ opacity: 0, visibility: 'hidden' }}
        />
      ))}
      <p ref={tag} className="renders__tag" style={{ opacity: 0 }}>
        ReMo render
      </p>
    </div>
  )
}
