import { lazy, Suspense, useEffect, useState } from 'react'
import { boot } from '../core/boot.js'
import { supportsWebGL } from '../core/webgl.js'
import { MEDIA } from '../config/media.js'
import { CaptionLayer } from '../ui/CaptionLayer.jsx'
import { ChapterRail } from '../ui/ChapterRail.jsx'
import { Loader } from '../ui/Loader.jsx'
import { ScrollHint } from '../ui/ScrollHint.jsx'
import { RenderFade } from '../ui/tour/RenderFade.jsx'
import { TourLabels } from '../ui/tour/TourLabels.jsx'
import { TourPanel } from '../ui/tour/TourPanel.jsx'

const JourneyCanvas = lazy(() => import('./JourneyCanvas.jsx'))

/**
 * The viewport-tall, sticky frame the whole journey plays inside.
 *
 * Without WebGL (locked-down laptops, some remote desktops) it falls back to
 * ReMo's twilight render behind the same captions — a client meeting should
 * never open on a black rectangle.
 */
export function Stage() {
  const [webgl] = useState(supportsWebGL)
  const [ready, setReady] = useState(!webgl)

  useEffect(() => {
    if (ready) boot.set({ ready: true })
  }, [ready])

  return (
    <div className="stage">
      {webgl ? (
        <Suspense fallback={null}>
          <JourneyCanvas onReady={() => setReady(true)} />
        </Suspense>
      ) : (
        <img className="stage__fallback" src={MEDIA.twilight} alt="The SupReMo at twilight" />
      )}

      {webgl && <TourLabels />}
      {webgl && <RenderFade />}
      <div className="stage__vignette" aria-hidden="true" />
      <CaptionLayer />
      {webgl && <TourPanel />}
      <ChapterRail />
      <ScrollHint />
      <Loader done={ready} />
    </div>
  )
}
