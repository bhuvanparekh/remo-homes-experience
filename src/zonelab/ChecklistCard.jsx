import { useMemo } from 'react'
import { checklistFor } from './design/checklist.js'

/**
 * "Before you build": the permits, studies, code rules and fees for this lot
 * and the chosen design, each with why it applies, who handles it and an
 * official link. Printable (or "Save as PDF" from the print dialog).
 */

const LEVEL = {
  required: 'Required',
  likely: 'Likely',
  check: 'Check',
  info: 'Good to know',
}

export function ChecklistCard({ report, rules, option }) {
  const list = useMemo(() => checklistFor({ report, rules, option }), [report, rules, option])
  const today = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })

  const print = () => {
    document.documentElement.classList.add('is-printing-checklist')
    const done = () => {
      document.documentElement.classList.remove('is-printing-checklist')
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    window.print()
  }

  return (
    <section className="zl-card zc" aria-label="Before you build">
      <div className="zc__head">
        <p className="zl-card__eyebrow">Before you build · {list.count} items</p>
        <button type="button" className="zl-link" onClick={print}>
          Print / save as PDF
        </button>
      </div>
      <p className="zc__for">
        <b>{report.parcel.address || `APN ${report.parcel.apn}`}</b>
        <span>
          {list.basis} · checked {today}
        </span>
      </p>

      {list.groups.map((g, gi) => (
        <div key={g.id} className="zc-group">
          <p className="zc-group__title">
            <span>{gi + 1}</span>
            {g.title}
          </p>
          {g.note && <p className="zl-muted">{g.note}</p>}
          <ul className="zc-list">
            {g.items.map((it) => (
              <li key={it.id} className={`zc-item is-${it.level}`}>
                <span className="zc-box" aria-hidden="true" />
                <div>
                  <p className="zc-item__title">
                    {it.title}
                    <em>{LEVEL[it.level]}</em>
                  </p>
                  <p className="zc-item__why">{it.why}</p>
                  <p className="zc-item__who">
                    {it.who}
                    {it.links.map((l) => (
                      <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
                        {l.text} ↗
                      </a>
                    ))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="zl-build__fine">
        Checked against official City, County and State sources in October 2026. Rules and fees change, and your architect,
        LADBS and City Planning have the final word — this is feasibility information, not a legal determination, and not a
        ReMo plan, price or approval.
      </p>
    </section>
  )
}
