import { useState } from 'react'
import { COMPANY } from '../config/content.config.js'
import { useStoreValue } from '../core/store.js'
import { DEPTH } from './generator.js'
import { STYLES } from './styles.js'
import {
  jumpToStop,
  restartTour,
  selectEnded,
  selectFade,
  selectPlaying,
  selectStop,
  tourRefs,
  tourState,
} from './tourState.js'

/**
 * Everything on screen during the walkthrough: the room card with controls,
 * the mini floor plan (click a room to go there), and the closing card.
 */

/** 2D plan of the generated house, front of the house at the bottom. */
function MiniPlan({ plan, tour, stop }) {
  const L = plan.house.length
  const pad = 0.5
  const stopByRoom = Object.fromEntries(tour.stops.map((s, i) => [s.room, i]))
  const current = tour.stops[stop]?.room
  return (
    <svg
      className="tplan"
      viewBox={`${-L / 2 - pad} ${-DEPTH / 2 - pad} ${L + pad * 2} ${DEPTH + pad * 2 + 1.6}`}
      role="group"
      aria-label="Floor plan — choose a room to go there"
    >
      {plan.house.decks.map((d) => (
        <rect
          key={d.id}
          className="tplan__deck"
          x={d.x0}
          y={d.side === 'front' ? DEPTH / 2 : -DEPTH / 2 - 1.25}
          width={d.x1 - d.x0}
          height={1.25}
        />
      ))}
      {plan.house.rooms.map((r) => {
        const i = stopByRoom[r.id]
        const go = i === undefined ? undefined : () => jumpToStop(tour, i)
        const w = r.x1 - r.x0
        const h = r.z1 - r.z0
        return (
          <g
            key={r.id}
            className={`tplan__room ${r.id === current ? 'is-here' : ''} ${go ? 'is-link' : ''}`}
            onClick={go}
            role={go ? 'button' : undefined}
            tabIndex={go ? 0 : undefined}
            aria-label={go ? `Go to ${r.name}` : undefined}
            onKeyDown={go ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), go()) : undefined}
          >
            <rect x={r.x0} y={r.z0} width={w} height={h} />
            {w > 1.6 && h > 1.6 && r.kind !== 'hall' && (
              <text x={r.x0 + w / 2} y={r.z0 + h / 2} textAnchor="middle" dominantBaseline="middle">
                {r.name.replace('Primary ', '')}
              </text>
            )}
          </g>
        )
      })}
      {/* You are here: dot and view cone, moved every frame by TourCamera. */}
      <g ref={(el) => (tourRefs.marker = el)} className="tplan__me">
        <path d="M0 0 L2.2 -1.1 A2.4 2.4 0 0 1 2.2 1.1 Z" />
        <circle r="0.32" />
      </g>
    </svg>
  )
}

function EndCard({ plan, style, onExit, onRestart, shareUrl }) {
  const [copied, setCopied] = useState(false)
  const s = plan.stats
  const look = STYLES.find((x) => x.id === style)?.name
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      window.prompt('Copy this link:', shareUrl)
    }
  }
  return (
    <div className="tend" role="dialog" aria-labelledby="tend-title">
      <p className="eyebrow">Walkthrough complete</p>
      <h3 id="tend-title">
        That’s your <span className="accent">home.</span>
      </h3>
      <p className="tend__stats">
        {s.sqft.toLocaleString('en-US')} sq ft · {s.bedrooms} bed · {s.baths} bath · {look} interior
      </p>
      <div className="tend__actions">
        <a className="btn btn--gold btn--sm" href={COMPANY.factoryTourUrl} target="_blank" rel="noreferrer">
          See a real one: factory tour ↗
        </a>
        <button type="button" className="btn btn--ghost btn--sm" onClick={copy}>
          {copied ? 'Link copied ✓' : 'Copy link to this design'}
        </button>
      </div>
      <div className="tend__links">
        <button type="button" onClick={onRestart}>
          Walk through again
        </button>
        <button type="button" onClick={onExit}>
          Back to the interior
        </button>
      </div>
      <p className="tend__note">A concept sketch, not a ReMo plan, price or approval.</p>
    </div>
  )
}

export function TourHud({ plan, tour, style, onExit, shareUrl }) {
  const stop = useStoreValue(tourState, selectStop)
  const playing = useStoreValue(tourState, selectPlaying)
  const ended = useStoreValue(tourState, selectEnded)
  const fade = useStoreValue(tourState, selectFade)
  const here = tour.stops[stop] ?? tour.stops[0]
  const count = tour.stops.length

  const toggle = () => {
    const st = tourState.get()
    if (st.ended) restartTour()
    else tourState.set({ playing: !st.playing })
  }
  const prev = () => {
    const st = tourState.get()
    jumpToStop(tour, st.t > here.at + 1.5 ? stop : stop - 1)
  }

  return (
    <>
      <div className={`tfade ${fade ? 'is-on' : ''}`} aria-hidden="true" />

      <MiniPlan plan={plan} tour={tour} stop={stop} />

      {ended ? (
        <EndCard plan={plan} style={style} onExit={onExit} onRestart={restartTour} shareUrl={shareUrl} />
      ) : (
        <div className="tcard" aria-live="polite">
          <p className="tcard__count">
            {String(stop + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
          </p>
          <h3 className="tcard__name">
            {here.name}
            {here.area ? <small>{here.area} sq ft</small> : null}
          </h3>
          {here.text && <p className="tcard__text">{here.text}</p>}
          <div className="tcard__ctl">
            <button type="button" onClick={prev} aria-label="Previous room" disabled={stop === 0 && !playing}>
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                <path d="M5 4v12M16 4 7 10l9 6Z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" className="tcard__play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? (
                <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                  <path d="M6 4h3v12H6zM11 4h3v12h-3z" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                  <path d="M6 4l10 6-10 6Z" fill="currentColor" />
                </svg>
              )}
            </button>
            <button type="button" onClick={() => jumpToStop(tour, stop + 1)} aria-label="Next room" disabled={stop >= count - 1}>
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                <path d="M15 4v12M4 4l9 6-9 6Z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" className="tcard__exit" onClick={onExit}>
              Exit
            </button>
          </div>
          <span className="tcard__bar" aria-hidden="true">
            <span ref={(el) => (tourRefs.progress = el)} />
          </span>
        </div>
      )}
    </>
  )
}
