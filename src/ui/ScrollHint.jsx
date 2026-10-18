import { useEffect, useRef } from 'react'
import { journey } from '../scroll/journey.js'

/** "Scroll to descend" — fades out the moment the visitor starts moving. */
export function ScrollHint() {
  const ref = useRef(null)

  useEffect(
    () =>
      journey.subscribe(({ progress }) => {
        if (ref.current) ref.current.style.opacity = Math.max(0, 1 - progress * 60)
      }),
    [],
  )

  return (
    <div ref={ref} className="scroll-hint" aria-hidden="true">
      <span>Scroll to descend</span>
      <i />
    </div>
  )
}
