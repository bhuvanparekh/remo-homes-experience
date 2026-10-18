import { useEffect, useRef, useState } from 'react'
import { HERO } from '../config/content.config.js'
import { MEDIA } from '../config/media.js'
import { boot } from '../core/boot.js'
import '../styles/splash.css'

/**
 * Opening logo sequence — ReMo's mark assembled the way ReMo builds homes:
 *
 *   frame   the square draws itself like a steel frame, side by side
 *   modules R, E, M, O arrive from four sides and lock into the grid,
 *           with a gold flash along the seams
 *   name    the mark slides left as "REMO HOMES" wipes in beside it
 *   open    once the 3D world is ready, the screen parts like doors
 *
 * Every piece is cut from ReMo's own wordmark image (CSS background
 * offsets on the 700 × 190 px file), so the letterforms are exactly theirs.
 * Click, key or scroll skips ahead; reduced-motion visitors get the finished
 * mark and a simple fade.
 */

// Pixel boxes in remo-wordmark.webp: [x, y, w, h].
const LETTERS = [
  { id: 'r', box: [7, 9, 91, 89], from: 'left' },
  { id: 'e', box: [98, 9, 82, 89], from: 'top' },
  { id: 'm', box: [7, 98, 91, 84], from: 'bottom' },
  { id: 'o', box: [98, 98, 82, 84], from: 'right' },
]
const NAME = [195, 0, 505, 190]

/** How long the assembly runs before the splash may open. */
const BUILD_MS = 3300
const OPEN_MS = 1000

const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function Piece({ box, className, style }) {
  const [x, y, w, h] = box
  return (
    <span
      className={`splash__piece ${className}`}
      style={{
        left: `calc(${x} * var(--u))`,
        top: `calc(${y} * var(--u))`,
        width: `calc(${w} * var(--u))`,
        height: `calc(${h} * var(--u))`,
        backgroundPosition: `calc(${-x} * var(--u)) calc(${-y} * var(--u))`,
        ...style,
      }}
    />
  )
}

export function Splash() {
  const [stage, setStage] = useState(reduced ? 'built' : 'build') // build → built → open → done
  const [ready, setReady] = useState(boot.get().ready)
  const root = useRef(null)

  useEffect(() => boot.subscribe(({ ready: r }) => setReady(r)), [])

  // Assembly runs on CSS keyframes; this just marks when it has finished.
  useEffect(() => {
    if (stage !== 'build') return
    const id = setTimeout(() => setStage('built'), BUILD_MS)
    return () => clearTimeout(id)
  }, [stage])

  // Open once the mark is built and the world behind it can be shown.
  useEffect(() => {
    if (stage !== 'built' || !ready) return
    const id = setTimeout(() => setStage('open'), reduced ? 200 : 350)
    return () => clearTimeout(id)
  }, [stage, ready])

  useEffect(() => {
    if (stage !== 'open') return
    const id = setTimeout(() => setStage('done'), OPEN_MS)
    return () => clearTimeout(id)
  }, [stage])

  // While it's up: hold the page still (so the journey doesn't start
  // underneath), and let any click, key or scroll skip to the finished mark.
  useEffect(() => {
    if (stage === 'done') return
    const skip = (e) => {
      if (e.cancelable && e.type !== 'keydown') e.preventDefault()
      setStage((s) => (s === 'build' ? 'built' : s))
    }
    const opts = { passive: false }
    window.addEventListener('wheel', skip, opts)
    window.addEventListener('touchmove', skip, opts)
    window.addEventListener('keydown', skip)
    const el = root.current
    el?.addEventListener('pointerdown', skip)
    document.documentElement.classList.add('is-splash')
    return () => {
      window.removeEventListener('wheel', skip, opts)
      window.removeEventListener('touchmove', skip, opts)
      window.removeEventListener('keydown', skip)
      el?.removeEventListener('pointerdown', skip)
      document.documentElement.classList.remove('is-splash')
    }
  }, [stage === 'done'])

  if (stage === 'done') return null

  const waiting = stage === 'built' && !ready

  return (
    <div
      ref={root}
      className={`splash is-${stage} ${reduced ? 'is-reduced' : ''}`}
      style={{ '--logo': `url(${MEDIA.wordmark})` }}
      role="img"
      aria-label="ReMo Homes"
      data-lenis-prevent
    >
      <div className="splash__door splash__door--top" />
      <div className="splash__door splash__door--bottom" />

      <div className="splash__center">
        <div className="splash__logo">
          <div className="splash__mark">
            <span className="splash__bar splash__bar--top" />
            <span className="splash__bar splash__bar--right" />
            <span className="splash__bar splash__bar--bottom" />
            <span className="splash__bar splash__bar--left" />
            {LETTERS.map((l, i) => (
              <Piece key={l.id} box={l.box} className={`splash__letter splash__letter--${l.from}`} style={{ '--i': i }} />
            ))}
            <span className="splash__seam splash__seam--h" />
            <span className="splash__seam splash__seam--v" />
          </div>
          {/* Wipe = a window sliding right over text sliding left (both
              transforms, so it stays smooth while the site loads). */}
          <span className="splash__wipe" style={{ left: `calc(${NAME[0]} * var(--u))`, width: `calc(${NAME[2]} * var(--u))` }}>
            <Piece box={NAME} className="splash__name" style={{ left: 0, top: 0 }} />
          </span>
        </div>
        <p className="splash__tag">{HERO.eyebrow}</p>
        <span className={`splash__loading ${waiting ? 'is-on' : ''}`} aria-hidden="true" />
      </div>
    </div>
  )
}

