import { MEDIA } from '../config/media.js'

/** Covers the first second while three.js boots, then lifts away. */
export function Loader({ done }) {
  return (
    <div className={`loader${done ? ' is-done' : ''}`} aria-hidden={done} role="status">
      <img src={MEDIA.wordmark} alt="ReMo Homes" width="210" height="57" />
      <span className="loader__bar" />
      <span className="loader__text">Preparing the descent</span>
    </div>
  )
}
