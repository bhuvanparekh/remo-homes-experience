import { useEffect, useRef } from 'react'
import { CHAPTERS } from '../config/chapters.config.js'
import { useStoreValue } from '../core/store.js'
import { journey, selectIndex } from '../scroll/journey.js'
import { useJourney } from '../scroll/JourneyProvider.jsx'

/**
 * Chapter index down the right edge: where you are, how far through it, and a
 * way to jump. The fill bar is written per frame; the active state re-renders
 * only on chapter change.
 */
export function ChapterRail() {
  const active = useStoreValue(journey, selectIndex)
  const { goToChapter } = useJourney()
  const fill = useRef(null)

  useEffect(
    () =>
      journey.subscribe(({ t }) => {
        if (fill.current) fill.current.style.transform = `scaleY(${t})`
      }),
    [],
  )

  return (
    <nav className="rail" aria-label="Chapters">
      <ol>
        {CHAPTERS.map((c, i) => (
          <li key={c.id} className={i === active ? 'is-active' : i < active ? 'is-past' : ''}>
            <button type="button" onClick={() => goToChapter(i)} aria-current={i === active ? 'step' : undefined}>
              <span className="rail__n">{c.n}</span>
              <span className="rail__label">{c.label}</span>
              <span className="rail__track" aria-hidden="true">
                {i === active && <span ref={fill} className="rail__fill" />}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
