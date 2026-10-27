import { useState } from 'react'
import { describeZone } from './zoneCode.js'
import { zimasLink } from './data/lookup.js'
import { lotLink } from './zoneLabState.js'
import { BuildCard } from './BuildCard.jsx'
import { DesignCard } from './DesignCard.jsx'
import { ChecklistCard } from './ChecklistCard.jsx'

/**
 * The Lot Report: what the City and County say about one lot, live.
 * Every block names its source; anything the tool can't be sure of says so
 * and points to ZIMAS rather than guessing.
 */

const fmt = (n, d = 0) => (n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d }))
const time = (d) =>
  d?.toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })

const LEVEL_LABEL = { red: 'Special rules', amber: 'Extra requirements', info: 'Good to know' }

/** Zone code broken into its labelled parts. */
function ZoneParts({ z }) {
  if (!z) return null
  if (z.format === 'chapter1A') {
    const parts = [
      z.form && { code: z.form, label: 'Form district', note: 'Building size and shape' },
      z.frontage && { code: z.frontage, label: 'Frontage district', note: 'How the building meets the street' },
      z.standards && { code: z.standards, label: 'Development standards', note: 'Site rules: parking, landscaping…' },
      z.use && { code: z.use.code, label: 'Use district', note: z.use.name || 'What activities are allowed' },
      z.density && { code: z.density, label: 'Density district', note: 'How many homes are allowed' },
      ...z.supplemental.map((s) => ({ code: s.code, label: 'Overlay', note: s.name || 'Supplemental district — see ZIMAS', flag: true })),
    ].filter(Boolean)
    return <PartList parts={parts} />
  }
  const parts = [
    ...z.prefixes.map((p) => ({ code: `[${p.code}]`, label: p.name, note: p.note, flag: 'red' })),
    z.zone && { code: z.zone.code, label: `${z.zone.name} zone`, note: z.variation?.name || zoneNote(z.zone) },
    z.height && { code: z.height.code, label: z.height.name, note: 'Sets the height and floor-area limits' },
    ...z.supplemental.map((s) => ({ code: s.code, label: s.name || 'Supplemental district', note: s.name ? null : 'Not in our tables — see ZIMAS', flag: true })),
  ].filter(Boolean)
  return <PartList parts={parts} />
}

function zoneNote(zone) {
  return (
    {
      single: 'Houses (one home per lot, plus ADUs)',
      multi: 'Apartments and multi-unit homes',
      commercial: 'Shops, offices — and often homes above',
      industrial: 'Industry and workshops',
      public: 'Public land and open space',
      agricultural: 'Agriculture and large-lot homes',
      parking: 'Parking',
    }[zone.family] || null
  )
}

function PartList({ parts }) {
  return (
    <ul className="zl-parts">
      {parts.map((p, i) => (
        <li key={i} className={p.flag ? `is-flag ${p.flag === 'red' ? 'is-red' : ''}` : ''}>
          <code>{p.code}</code>
          <span>
            <b>{p.label}</b>
            {p.note && <small>{p.note}</small>}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Flag({ f }) {
  return (
    <li className={`zl-flag zl-flag--${f.level}`}>
      <span className="zl-flag__dot" aria-hidden="true" />
      <div>
        <p className="zl-flag__title">
          {f.label}
          <span className="zl-flag__level">{LEVEL_LABEL[f.level]}</span>
        </p>
        {f.value && f.value !== f.label && <p className="zl-flag__value">{f.value}</p>}
        <p className="zl-flag__note">{f.note}</p>
        <p className="zl-flag__src">
          {f.law} · {f.source}
        </p>
      </div>
    </li>
  )
}

function Confirm({ c }) {
  if (!c || c.status === 'skipped') return null
  if (c.status === 'pending')
    return (
      <p className="zl-confirm is-pending">
        <span className="zl-spin" aria-hidden="true" />
        Confirming with ZIMAS, the City’s live zoning system…
      </p>
    )
  if (c.status === 'match') return <p className="zl-confirm is-ok">✓ Confirmed live with City of LA ZIMAS · {time(c.at)}</p>
  if (c.status === 'differs')
    return (
      <p className="zl-confirm is-warn">
        ZIMAS shows {c.live.join(' + ')} — showing ZIMAS, the City’s system of record.
      </p>
    )
  return <p className="zl-confirm is-warn">ZIMAS didn’t answer just now — zoning shown from City GeoHub (updated weekly).</p>
}

export function LotReport({ report, rules, sidesState, onEnter, onClear, entering = false, in3d = false, designProps = null }) {
  const [copied, setCopied] = useState(false)
  const p = report.parcel
  const ex = p.existing
  const z = report.zoning
  const flags = report.overlays
  const red = flags.filter((f) => f.level === 'red').length

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lotLink(p.ain))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link:', lotLink(p.ain))
    }
  }

  return (
    <article className="zl-report" aria-live="polite">
      <header className="zl-report__head">
        <button type="button" className="zl-back" onClick={onClear}>
          ← New search
        </button>
        <h2>{p.address || 'Selected lot'}</h2>
        <p className="zl-report__meta">
          APN {p.apn || '—'}
          {report.communityPlan && <> · {report.communityPlan}</>}
        </p>
      </header>

      {!report.inCity ? (
        <section className="zl-card zl-outside">
          <p className="zl-card__eyebrow">Outside the City of Los Angeles</p>
          <p>
            This lot is in <b>{p.city || 'another jurisdiction'}</b>
            {/unincorporated/i.test(p.city) ? ' (unincorporated LA County — e.g. Altadena)' : ''}, which has its own zoning
            code. Zone Lab covers the City of Los Angeles for now, so it won’t guess the rules here.
          </p>
        </section>
      ) : (
        <>
          <div className="zl-actions">
            {onEnter && !in3d && (
              <button type="button" className="btn btn--gold btn--sm" onClick={onEnter} disabled={entering}>
                {entering ? 'Building 3D…' : 'Enter the lot in 3D'}
              </button>
            )}
            <a className="btn btn--ghost btn--sm" href={zimasLink(p)} target="_blank" rel="noreferrer">
              Open on ZIMAS ↗
            </a>
            <button type="button" className="zl-link" onClick={copy}>
              {copied ? 'Link copied ✓' : 'Copy link'}
            </button>
          </div>

          <section className="zl-card zl-zone">
            <p className="zl-card__eyebrow">Zoning</p>
            {z?.raw ? (
              <>
                <p className="zl-zone__code">{z.raw}</p>
                <p className="zl-zone__desc">{describeZone(z.parsed)}</p>
                {z.split && (
                  <p className="zl-warn">This lot is split between zones: {z.all.join(' and ')}. Each part follows its own rules.</p>
                )}
                <ZoneParts z={z.parsed} />
              </>
            ) : (
              <p>No zoning found for this lot (it may be a street, railway or public land).</p>
            )}
            <Confirm c={report.confirm} />
            {report.generalPlan && (
              <p className="zl-gp">
                General Plan land use: <b>{report.generalPlan}</b>
              </p>
            )}
          </section>

          <section className="zl-card">
            <p className="zl-card__eyebrow">The lot</p>
            <dl className="zl-stats">
              <div>
                <dt>Lot area</dt>
                <dd>{fmt(p.areaSqft)} sq ft</dd>
              </div>
              <div>
                <dt>{p.regular ? 'Width × depth' : 'Approx. size'}</dt>
                <dd>
                  {fmt(p.widthFt)} × {fmt(p.depthFt)} ft
                </dd>
              </div>
            </dl>
            {!p.regular && <p className="zl-muted">Irregular shape — size shown is the smallest rectangle around it.</p>}
          </section>

          {ex && (ex.sqft || ex.yearBuilt) && (
            <section className="zl-card">
              <p className="zl-card__eyebrow">On the lot today · LA County Assessor{ex.rollYear ? ` ${ex.rollYear}` : ''}</p>
              <dl className="zl-stats">
                <div>
                  <dt>Use</dt>
                  <dd>{[ex.use, ex.description].filter(Boolean).join(' · ') || '—'}</dd>
                </div>
                <div>
                  <dt>Built</dt>
                  <dd>{ex.yearBuilt || '—'}</dd>
                </div>
                <div>
                  <dt>Floor area</dt>
                  <dd>{ex.sqft ? `${fmt(ex.sqft)} sq ft` : '—'}</dd>
                </div>
                <div>
                  <dt>Homes</dt>
                  <dd>
                    {ex.units ?? '—'}
                    {ex.bedrooms ? ` · ${ex.bedrooms} bd / ${ex.bathrooms ?? '—'} ba` : ''}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          <BuildCard rules={rules} parcel={p} sidesState={sidesState} />

          {designProps?.limits && <DesignCard {...designProps} in3d={in3d} onEnter={onEnter} />}

          <ChecklistCard report={report} rules={rules} option={designProps?.option ?? null} />

          <section className="zl-card">
            <p className="zl-card__eyebrow">
              Special rules on this lot {flags.length ? `· ${flags.length}` : ''}
              {red ? <span className="zl-count">{red} need City review</span> : null}
            </p>
            {flags.length ? (
              <ul className="zl-flags">{flags.map((f) => <Flag key={f.id} f={f} />)}</ul>
            ) : (
              <p className="zl-ok">No overlays, specific plans or historic districts — the base zoning rules apply.</p>
            )}
          </section>

          <section className="zl-card">
            <p className="zl-card__eyebrow">Natural hazards</p>
            {report.hazards.length ? (
              <ul className="zl-flags">{report.hazards.map((f) => <Flag key={f.id} f={f} />)}</ul>
            ) : (
              <p className="zl-ok">Not in a mapped fire, fault, landslide, liquefaction or 100-year flood zone.</p>
            )}
          </section>

          {report.unavailable?.length > 0 && (
            <p className="zl-warn">Couldn’t reach: {report.unavailable.join(', ')}. Check these on ZIMAS.</p>
          )}
        </>
      )}

      <footer className="zl-source">
        <p>
          <span className="zl-live" aria-hidden="true" /> Live data · checked {time(report.checkedAt)}
        </p>
        <p>
          Sources: City of LA ZIMAS & GeoHub (zoning, overlays), LA County Assessor (lot, buildings), LA County GIS (hazards), SCAG and City Planning (transit areas).
          This is feasibility information, not a legal determination — confirm with LA City Planning and LADBS before you
          buy, design or build.
        </p>
      </footer>
    </article>
  )
}
