import { useEffect, useRef } from 'react'
import { CHAPTERS } from '../config/chapters.config.js'
import { envelope } from '../core/math.js'
import { useStoreValue } from '../core/store.js'
import { journey, selectIndex } from '../scroll/journey.js'
import { BEATS } from './beats.jsx'

const FADE = 0.08

/** Opacity of a beat at chapter time `t`, honouring sticky first/last beats. */
function beatOpacity(beat, t) {
  if (beat.sticky === 'start' && t <= beat.from + FADE) return 1
  if (beat.sticky === 'end' && t >= beat.to - FADE) return 1
  return envelope(t, beat.from, beat.to, beat.fade ?? FADE)
}

/**
 * Overlay captions for the current chapter.
 *
 * React only re-renders when the chapter changes. Within a chapter, opacity
 * and lift are written straight to the DOM from the journey store — sixty
 * style writes a second, zero React renders.
 */
export function CaptionLayer() {
  const index = useStoreValue(journey, selectIndex)
  const chapter = CHAPTERS[index]
  const refs = useRef([])

  useEffect(() => {
    const apply = ({ t }) => {
      chapter.beats.forEach((beat, i) => {
        const el = refs.current[i]
        if (!el) return
        const o = beatOpacity(beat, t)
        el.style.opacity = o
        el.style.transform = `translate3d(0, ${(1 - o) * 18}px, 0)`
        el.style.visibility = o < 0.01 ? 'hidden' : 'visible'
        el.style.pointerEvents = o > 0.6 ? 'auto' : 'none'
      })
    }
    apply(journey.get())
    return journey.subscribe(apply)
  }, [chapter])

  return (
    <div className="captions" key={chapter.id}>
      {chapter.beats.map((beat, i) => {
        const Beat = BEATS[beat.kind]
        return (
          <div
            key={`${chapter.id}-${i}`}
            ref={(el) => (refs.current[i] = el)}
            className={`beat beat--${beat.kind} beat--${beat.align}`}
            style={{ opacity: 0, visibility: 'hidden' }}
          >
            <Beat data={beat.data} />
          </div>
        )
      })}
    </div>
  )
}
