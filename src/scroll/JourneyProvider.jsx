import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { QUALITY } from '../core/quality.js'
import { createScrollDriver } from './scrollDriver.js'
import { journey, timeline } from './journey.js'

const JourneyContext = createContext(null)

/**
 * Owns the one requestAnimationFrame loop that turns page scroll into journey
 * progress. Scroll is a playhead, not navigation: the page scrolls natively
 * (scrollbar, keyboard and find-in-page all work) and we only *read* how far
 * the tall journey section has travelled past the viewport.
 */
export function JourneyProvider({ children }) {
  const sectionRef = useRef(null)
  const driverRef = useRef(null)

  useEffect(() => {
    const driver = createScrollDriver({ smooth: QUALITY.smoothScroll })
    driverRef.current = driver
    let frame = 0

    const measure = () => {
      const el = sectionRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const travel = rect.height - window.innerHeight
      const progress = travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 0
      const { index, t } = timeline.resolve(progress)
      journey.set({ progress, index, t })
    }

    const tick = (time) => {
      driver.update(time)
      measure()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      driver.destroy()
    }
  }, [])

  const api = useMemo(
    () => ({
      sectionRef,
      /** Scroll so the journey sits at chapter `index`, local time `t`. */
      goToChapter(index, t = 0.02) {
        const el = sectionRef.current
        if (!el || !driverRef.current) return
        const top = el.getBoundingClientRect().top + window.scrollY
        const travel = el.offsetHeight - window.innerHeight
        driverRef.current.scrollTo(top + travel * timeline.toGlobal(index, t))
      },
      scrollToElement(target) {
        if (!target || !driverRef.current) return
        driverRef.current.scrollTo(target.getBoundingClientRect().top + window.scrollY)
      },
    }),
    [],
  )

  return <JourneyContext.Provider value={api}>{children}</JourneyContext.Provider>
}

export function useJourney() {
  const ctx = useContext(JourneyContext)
  if (!ctx) throw new Error('useJourney must be used inside <JourneyProvider>')
  return ctx
}
