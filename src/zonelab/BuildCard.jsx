import { zimasLink } from './data/lookup.js'

/**
 * "What you can build": the rules engine's answer for one lot, in plain words.
 * Every number carries the code section it comes from and a link to the
 * official document that states it. Anything the engine can't be sure of is
 * flagged and sent to City Planning — it never guesses.
 */

function Cite({ c }) {
  if (!c) return null
  return (
    <p className="zl-rule__cite">
      {c.href ? (
        <a href={c.href} target="_blank" rel="noreferrer">
          {c.text} ↗
        </a>
      ) : (
        c.text
      )}
    </p>
  )
}

function Rule({ r }) {
  return (
    <li className={`zl-rule ${r.estimate ? 'is-estimate' : ''}`}>
      <p className="zl-rule__label">{r.label}</p>
      {r.value && <p className="zl-rule__value">{r.value}</p>}
      {r.rows && (
        <dl className="zl-rule__rows">
          {r.rows.map(([k, v, note]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>
                {v}
                {note && <small>{note}</small>}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {r.note && <p className="zl-rule__note">{r.note}</p>}
      {r.cite && [].concat(r.cite).map((c, i) => <Cite key={i} c={c} />)}
    </li>
  )
}

export function BuildCard({ rules, parcel, sidesState }) {
  if (!rules) return null
  const red = rules.cautions.filter((c) => c.level === 'red')
  const other = rules.cautions.filter((c) => c.level !== 'red')

  return (
    <section className="zl-card zl-build" aria-label="What you can build">
      <p className="zl-card__eyebrow">What you can build</p>

      {rules.headline && <p className="zl-build__headline">{rules.headline}</p>}
      {rules.basis && <p className="zl-build__basis">{rules.basis}</p>}

      {red.length > 0 && (
        <div className="zl-build__confirm" role="note">
          <p>
            <b>Confirm with LA City Planning</b>
            {rules.items.length ? ' — these numbers are the base zone only:' : ':'}
          </p>
          <ul>
            {red.map((c, i) => (
              <li key={i}>{c.text}</li>
            ))}
          </ul>
          <a href={zimasLink(parcel)} target="_blank" rel="noreferrer">
            Check this lot on ZIMAS ↗
          </a>
        </div>
      )}

      {rules.items.length > 0 && <ul className="zl-rules">{rules.items.map((r) => <Rule key={r.id} r={r} />)}</ul>}

      {other.length > 0 && (
        <ul className="zl-build__notes">
          {other.map((c, i) => (
            <li key={i} className={`is-${c.level}`}>
              {c.text}
              {c.cite && (
                <>
                  {' '}
                  <a href={c.cite.href} target="_blank" rel="noreferrer">
                    {c.cite.text} ↗
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {sidesState === 'loading' && (
        <p className="zl-muted">
          <span className="zl-spin" aria-hidden="true" /> Finding the street side of the lot…
        </p>
      )}

      <p className="zl-build__fine">
        Base zoning rules from the Los Angeles Municipal Code, as summarised by City Planning. Feasibility information, not a
        legal determination — and not a ReMo plan, price or approval.
      </p>
    </section>
  )
}
