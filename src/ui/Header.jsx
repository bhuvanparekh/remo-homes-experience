import { useEffect, useRef } from 'react'
import { COMPANY } from '../config/content.config.js'
import { MEDIA } from '../config/media.js'
import { CHAPTERS } from '../config/chapters.config.js'
import { journey } from '../scroll/journey.js'
import { useJourney } from '../scroll/JourneyProvider.jsx'

const chapterIndex = (id) => CHAPTERS.findIndex((c) => c.id === id)

/** Fixed top bar: wordmark, two jump links, the tour CTA and a progress hairline. */
export function Header() {
  const { goToChapter } = useJourney()
  const bar = useRef(null)

  useEffect(
    () =>
      journey.subscribe(({ progress }) => {
        if (bar.current) bar.current.style.transform = `scaleX(${progress})`
      }),
    [],
  )

  return (
    <header className="header">
      <button type="button" className="header__brand" onClick={() => goToChapter(0, 0)} aria-label="ReMo Homes — back to start">
        <img src={MEDIA.wordmark} alt="ReMo Homes" width="132" height="36" />
      </button>

      <nav className="header__nav" aria-label="Primary">
        <button type="button" onClick={() => goToChapter(chapterIndex('construction'))}>
          How it’s built
        </button>
        <button type="button" onClick={() => goToChapter(chapterIndex('home'))}>
          The SupReMo™
        </button>
        <button type="button" onClick={() => goToChapter(chapterIndex('tour'), 0.08)}>
          Walk through
        </button>
      </nav>

      <a className="btn btn--gold btn--sm" href={COMPANY.factoryTourUrl} target="_blank" rel="noreferrer">
        Factory tour
      </a>

      <span className="header__progress" aria-hidden="true">
        <span ref={bar} />
      </span>
    </header>
  )
}
