import { useEffect, useRef } from 'react'
import { COMPANY } from '../config/content.config.js'
import { MEDIA } from '../config/media.js'
import { CHAPTERS } from '../config/chapters.config.js'
import { journey } from '../scroll/journey.js'
import { useJourney } from '../scroll/JourneyProvider.jsx'
import { openStudio } from '../studio/studioState.js'
import { openZoneLab } from '../zonelab/zoneLabState.js'

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

      <button type="button" className="btn btn--gold btn--sm header__design" onClick={openStudio}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" fill="currentColor" />
        </svg>
        <span>
          Design<span className="header__long"> yours</span>
        </span>
      </button>

      <button type="button" className="btn btn--ghost btn--sm header__zone" onClick={openZoneLab}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.4 4.5 8.5 4.5 8.5s4.5-5.1 4.5-8.5A4.5 4.5 0 0 0 8 1.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="6" r="1.6" fill="currentColor" />
        </svg>
        Zone Lab
      </button>

      <a className="btn btn--ghost btn--sm header__tour" href={COMPANY.factoryTourUrl} target="_blank" rel="noreferrer">
        Factory tour
      </a>

      <span className="header__progress" aria-hidden="true">
        <span ref={bar} />
      </span>
    </header>
  )
}
