import { COMPANY } from '../config/content.config.js'
import { CHAPTERS } from '../config/chapters.config.js'
import { ROOMS_PLAN } from '../config/floorplan.js'
import { STOPS } from '../config/tour.config.js'
import { useStoreValue } from '../core/store.js'
import { useJourney } from '../scroll/JourneyProvider.jsx'
import { picker, selectHover } from '../scroll/tourState.js'

/**
 * One small layout per caption `kind` used in chapters.config.js.
 * They only lay out copy; timing and fading belong to CaptionLayer.
 */

/** Wraps the last word in the serif accent, ReMo's "next generation of *dwelling*" move. */
function Accent({ text }) {
  const i = text.lastIndexOf(' ')
  if (i < 0) return <em className="accent">{text}</em>
  return (
    <>
      {text.slice(0, i + 1)}
      <em className="accent">{text.slice(i + 1)}</em>
    </>
  )
}

function Hero({ data }) {
  return (
    <div className="hero">
      <p className="eyebrow">{data.eyebrow}</p>
      <h1 className="hero__title">
        <span>{data.title[0]}</span>
        <span>
          <Accent text={data.title[1]} />
        </span>
      </h1>
      <p className="hero__body">{data.body}</p>
    </div>
  )
}

function Line({ data }) {
  return (
    <p className="line">
      <Accent text={data.text} />
    </p>
  )
}

function Text({ data }) {
  return (
    <div className="card">
      <p className="eyebrow">{data.eyebrow}</p>
      <h2 className="card__title">
        <Accent text={data.title} />
      </h2>
      <p className="card__body">{data.body}</p>
      <div className="card__aside">
        <h3>{data.rebuild.title}</h3>
        <p>{data.rebuild.body}</p>
      </div>
    </div>
  )
}

function Stats({ data }) {
  return (
    <ul className="stats">
      {data.map((s) => (
        <li key={s.label} className="stats__item">
          <span className="stats__value">{s.value}</span>
          <span className="stats__label">{s.label}</span>
          <span className="stats__body">{s.body}</span>
        </li>
      ))}
    </ul>
  )
}

function Step({ data }) {
  return (
    <div className="card card--step">
      <p className="step__n">{data.n}</p>
      <p className="eyebrow">{data.kicker}</p>
      <h2 className="card__title">{data.title}</h2>
      <p className="card__body">{data.body}</p>
    </div>
  )
}

function Specs({ data }) {
  return (
    <div className="card">
      <p className="eyebrow">{data.eyebrow}</p>
      <h2 className="card__title">
        <Accent text={data.title} />
      </h2>
      <p className="card__body">{data.body}</p>
      <dl className="specs">
        {data.specs.map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Room({ data }) {
  return (
    <div className="room">
      <p className="room__count">
        {String(data.index + 1).padStart(2, '0')} <span>/ {String(data.total).padStart(2, '0')}</span>
      </p>
      <h2 className="room__name">
        {data.name} <em className="accent">/ {data.role}</em>
      </h2>
      <p className="room__line">{data.line}</p>
    </div>
  )
}

const TOUR = CHAPTERS.findIndex((c) => c.id === 'tour')
const PICKABLE = ROOMS_PLAN.filter((r) => r.id !== 'hall' && r.id !== 'closets').map((r) => ({ ...r, stop: STOPS.find((s) => s.plan === r.id) }))

/**
 * The room picker's list, paired with the roof-off model: hovering a line
 * lights the room in 3D (and vice versa); rooms on the walkthrough jump there.
 */
function Picker({ data }) {
  const hover = useStoreValue(picker, selectHover)
  const { goToChapter } = useJourney()
  return (
    <div className="card picker">
      <p className="eyebrow">{data.eyebrow}</p>
      <h2 className="card__title">
        <Accent text={data.title} />
      </h2>
      <p className="card__body">{data.body}</p>
      <ul className="picker__list">
        {PICKABLE.map((r) => {
          const props = {
            className: `picker__room ${hover === r.id ? 'is-hover' : ''} ${r.stop ? 'is-stop' : ''}`,
            onPointerEnter: () => picker.set({ hover: r.id }),
            onPointerLeave: () => picker.get().hover === r.id && picker.set({ hover: null }),
            onFocus: () => picker.set({ hover: r.id }),
            onBlur: () => picker.set({ hover: null }),
          }
          return (
            <li key={r.id}>
              {r.stop ? (
                <button type="button" {...props} onClick={() => goToChapter(TOUR, r.stop.from + 0.012)}>
                  <span>{r.name}</span>
                  <span className="picker__go">Walk through →</span>
                </button>
              ) : (
                <span {...props} tabIndex={0}>
                  <span>{r.name}</span>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Visit({ data }) {
  return (
    <div className="visit">
      <p className="eyebrow">{data.eyebrow}</p>
      <h2 className="visit__title">
        <span>{data.title[0]}</span>
        <span>
          <Accent text={data.title[1]} />
        </span>
      </h2>
      <p className="visit__body">{data.body}</p>
      <ul className="visit__dates">
        {data.dates.map((d) => (
          <li key={d.day + d.month}>
            <span className="visit__day">{d.day}</span>
            <span>
              {d.month}
              <small>{d.weekday}</small>
            </span>
          </li>
        ))}
      </ul>
      <div className="visit__actions">
        <a className="btn btn--gold" href={COMPANY.factoryTourUrl} target="_blank" rel="noreferrer">
          Schedule a factory tour
        </a>
        <a className="btn btn--ghost" href={COMPANY.phoneHref}>
          {COMPANY.phone}
        </a>
      </div>
    </div>
  )
}

export const BEATS = {
  hero: Hero,
  line: Line,
  text: Text,
  stats: Stats,
  step: Step,
  specs: Specs,
  room: Room,
  picker: Picker,
  visit: Visit,
}
