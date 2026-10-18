import { COMPANY } from '../config/content.config.js'
import { MEDIA } from '../config/media.js'
import GEO from '../config/geo.manifest.json'

/** Plain-HTML close: contact details and an honest note about what this page is. */
export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__brand">
          <img src={MEDIA.wordmark} alt="ReMo Homes" width="168" height="46" />
          <p>Steel modular homes · Built in Los Angeles</p>
        </div>

        <address className="footer__contact">
          <span>{COMPANY.address}</span>
          <a href={COMPANY.phoneHref}>{COMPANY.phone}</a>
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        </address>

        <ul className="footer__social">
          <li><a href={COMPANY.instagram} target="_blank" rel="noreferrer">Instagram</a></li>
          <li><a href={COMPANY.linkedin} target="_blank" rel="noreferrer">LinkedIn</a></li>
          <li><a href={COMPANY.x} target="_blank" rel="noreferrer">X</a></li>
          <li><a href={COMPANY.site} target="_blank" rel="noreferrer">remo.homes</a></li>
        </ul>
      </div>

      <p className="footer__note">
        Concept experience. SupReMo™ renders, floor plan and copy © {COMPANY.legalName}
      </p>
      <p className="footer__note footer__note--credits">{GEO.credits.join(' · ')}</p>
    </footer>
  )
}
