import { useEffect, useMemo, useState } from 'react'
import { COMPANY } from '../config/content.config.js'
import { supportsWebGL } from '../core/webgl.js'
import { generatePlan } from './generator.js'
import { buildHouse } from './houseModel.js'
import { clampSpec, designHash, EXTRAS, LIMITS, SETBACKS_FT, STREET_SIDES } from './spec.js'
import { buildTour } from './tour.js'
import { TourHud } from './TourHud.jsx'
import { closeStudio, studio } from './studioState.js'
import { StudioScene, ZONE_COLORS } from './StudioScene.jsx'
import { STYLES } from './styles.js'
import '../styles/studio.css'

/**
 * "Design yours": the visitor describes their lot and the rooms they need,
 * and a single-storey home is sketched in 3D on their lot.
 *
 * It is a concept sketch, laid out like the SupReMo — never a ReMo plan,
 * price or approval, and the page says so.
 */

const STEPS = [
  { id: 'massing', label: 'Massing' },
  { id: 'house', label: 'House' },
  { id: 'interior', label: 'Interior' },
  { id: 'tour', label: 'Walk through' },
]

const LEGEND = [
  { zone: 'living', label: 'Living' },
  { zone: 'sleep', label: 'Bedrooms' },
  { zone: 'wet', label: 'Baths' },
  { zone: 'service', label: 'Storage & laundry' },
]

const fmt = (n) => n.toLocaleString('en-US')

function Range({ label, value, unit, limits, onChange }) {
  return (
    <label className="sfield srange">
      <span className="sfield__top">
        <span>{label}</span>
        <b>
          {value} {unit}
        </b>
      </span>
      <input
        type="range"
        min={limits.min}
        max={limits.max}
        step={limits.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

function Stepper({ label, value, limits, onChange, max = limits.max }) {
  return (
    <div className="sfield sstep" role="group" aria-label={label}>
      <span>{label}</span>
      <div className="sstep__ctl">
        <button type="button" onClick={() => onChange(value - 1)} disabled={value <= limits.min} aria-label={`Fewer ${label.toLowerCase()}`}>
          −
        </button>
        <b aria-live="polite">{value}</b>
        <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`}>
          +
        </button>
      </div>
    </div>
  )
}

export default function Studio() {
  const [spec, setSpec] = useState(() => studio.get().spec)
  // stage: brief → massing → house → interior. `reached` unlocks the step pills.
  const [flow, setFlow] = useState(() => {
    const { stage, reached } = studio.get()
    return { stage, prev: stage, at: 0, reached }
  })
  const [style, setStyle] = useState(() => {
    const s = studio.get().style
    return STYLES.some((x) => x.id === s) ? s : 'signature'
  })
  const [buildKey, setBuildKey] = useState(0)
  const { stage } = flow
  const built = stage !== 'brief'
  const [webgl] = useState(supportsWebGL)
  const plan = useMemo(() => generatePlan(spec), [spec])
  const { stats, site } = plan
  const tour = useMemo(() => (plan.site.ok ? buildTour(plan, buildHouse(plan.house, plan.spec)) : null), [plan])
  const shareUrl = `${location.origin}${location.pathname}${location.search}${designHash(spec, style)}`

  const update = (patch) =>
    setSpec((s) => {
      const next = clampSpec({ ...s, ...patch })
      studio.set({ spec: next })
      return next
    })

  const goTo = (next) =>
    setFlow((f) => {
      const reached = Math.max(f.reached, STEPS.findIndex((x) => x.id === next))
      studio.set({ stage: next, reached })
      return { stage: next, prev: f.stage, at: performance.now() / 1000, reached }
    })

  const build = () => {
    goTo('massing')
    setBuildKey((k) => k + 1)
  }

  const chooseStyle = (id) => {
    setStyle(id)
    studio.set({ style: id })
  }

  const cta = {
    brief: { label: 'Build my massing', run: build },
    massing: { label: 'Next: build the house', run: () => goTo('house') },
    house: { label: 'Next: lift the roof', run: () => goTo('interior') },
    interior: { label: 'Walk through it', run: () => goTo('tour') },
    tour: { label: 'Back to the interior', run: () => goTo('interior') },
  }[stage]

  // While open: page scroll is held, Escape closes.
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('is-studio')
    const onKey = (e) => e.key === 'Escape' && closeStudio()
    window.addEventListener('keydown', onKey)
    return () => {
      root.classList.remove('is-studio')
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div
      className={`studio ${stage === 'tour' ? 'is-tour' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="studio-title"
      data-lenis-prevent
    >
      <div className="studio__view">
        {webgl ? (
          <StudioScene plan={plan} stage={stage} stageAt={flow.at} prevStage={flow.prev} buildKey={buildKey} style={style} tour={tour} />
        ) : (
          <p className="studio__nogl">Your browser can’t show 3D here. Try Chrome or Edge on a laptop.</p>
        )}

        <ol className="studio__steps" aria-label="Design steps">
          {STEPS.map((s, i) => {
            const on = s.id === stage
            const open = built && i <= flow.reached
            const next = (!built && i === 0) || i === flow.reached + 1
            return (
              <li key={s.id} className={on ? 'is-on' : open ? 'is-open' : next ? 'is-next' : 'is-later'}>
                <button type="button" disabled={!open || on || !site.ok} onClick={() => goTo(s.id)} aria-current={on ? 'step' : undefined}>
                  <span>{i + 1}</span>
                  {s.label}
                </button>
              </li>
            )
          })}
        </ol>

        <button type="button" className="studio__close" onClick={closeStudio} aria-label="Close the studio">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path d="M4 4l12 12M16 4 4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        {stage === 'massing' && site.ok && (
          <div className="studio__legend" aria-hidden="true">
            {LEGEND.map((l) => (
              <span key={l.zone}>
                <i style={{ background: ZONE_COLORS[l.zone] }} />
                {l.label}
              </span>
            ))}
          </div>
        )}

        {stage === 'tour' && tour && (
          <TourHud plan={plan} tour={tour} style={style} onExit={() => goTo('interior')} shareUrl={shareUrl} />
        )}

        {!site.ok && (
          <p className="studio__warn" role="status">
            {site.reason}
          </p>
        )}
      </div>

      <aside className="studio__panel">
        <p className="eyebrow">Design yours</p>
        <h2 id="studio-title" className="studio__title">
          Your home, sketched <span className="accent">in 3D</span>
        </h2>
        <p className="studio__lede">
          Tell us about your lot and the rooms you need. We’ll lay out a single-storey home on it, planned like the SupReMo:
          one level, living in the middle, bedrooms either side.
        </p>

        <fieldset className="sgroup">
          <legend>Your lot</legend>
          <Range label="Width" value={spec.lotW} unit="ft" limits={LIMITS.lotW} onChange={(lotW) => update({ lotW })} />
          <Range label="Depth" value={spec.lotD} unit="ft" limits={LIMITS.lotD} onChange={(lotD) => update({ lotD })} />
          <div className="sfield">
            <span className="sfield__top">
              <span>Street is on the</span>
              <b>{fmt(spec.lotW * spec.lotD)} sq ft lot</b>
            </span>
            <div className="sseg" role="radiogroup" aria-label="Street side">
              {STREET_SIDES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={spec.street === s.id}
                  className={spec.street === s.id ? 'is-on' : ''}
                  onClick={() => update({ street: s.id })}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="sgroup">
          <legend>Rooms</legend>
          <Stepper label="Bedrooms" value={spec.bedrooms} limits={LIMITS.bedrooms} onChange={(bedrooms) => update({ bedrooms })} />
          <Stepper
            label="Bathrooms"
            value={spec.baths}
            limits={LIMITS.baths}
            max={Math.min(LIMITS.baths.max, spec.bedrooms + 1)}
            onChange={(baths) => update({ baths })}
          />
          <div className="schips" role="group" aria-label="Extras">
            {EXTRAS.map((x) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={spec[x.id]}
                className={spec[x.id] ? 'is-on' : ''}
                onClick={() => update({ [x.id]: !spec[x.id] })}
              >
                {x.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="sgroup">
          <legend>Interior style</legend>
          <div className="sstyles" role="radiogroup" aria-label="Interior style">
            {STYLES.map((x) => (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={style === x.id}
                className={style === x.id ? 'is-on' : ''}
                onClick={() => chooseStyle(x.id)}
              >
                <span className="sstyles__sw" aria-hidden="true">
                  {x.swatch.map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
                <b>{x.name}</b>
                <small>{x.note}</small>
              </button>
            ))}
          </div>
        </fieldset>

        {built && site.ok && (
          <div className="ssum" aria-live="polite">
            <p className="ssum__big">
              {fmt(stats.sqft)} <span>sq ft</span>
            </p>
            <p>
              {stats.bedrooms} bed · {stats.baths} bath · {stats.lengthFt} × {stats.depthFt} ft
            </p>
            <p>Covers {stats.coverage}% of the lot</p>
            {site.rotated && <p className="ssum__note">Turned to face the side yard so it fits the lot’s width.</p>}
          </div>
        )}

        <button type="button" className="btn btn--gold studio__go" onClick={cta.run} disabled={!site.ok}>
          {cta.label}
          {stage !== 'tour' && <span aria-hidden="true">→</span>}
        </button>
        {(stage === 'interior' || stage === 'tour') && (
          <button type="button" className="studio__again" onClick={build}>
            Start again from the massing
          </button>
        )}

        <p className="studio__note">
          Concept sketch only — not a ReMo plan, price or approval. Setbacks shown are typical Los Angeles values (front{' '}
          {SETBACKS_FT.front} ft, sides {SETBACKS_FT.side} ft, rear {SETBACKS_FT.rear} ft); your city’s rules decide.{' '}
          <a href={COMPANY.contactUrl} target="_blank" rel="noreferrer">
            Talk to ReMo
          </a>
        </p>
      </aside>
    </div>
  )
}
