import { useEffect, useId, useRef, useState } from 'react'
import { locate, suggest } from './data/geocode.js'

/**
 * Address search with live suggestions (Esri World Geocoder, kept to the LA
 * area). Picking a suggestion — or pressing Enter — resolves it to a point.
 */
export function SearchBox({ onFound, busy }) {
  const [text, setText] = useState('')
  const [items, setItems] = useState([])
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(null)
  const listId = useId()
  const abort = useRef(null)

  // Debounced suggestions while typing.
  useEffect(() => {
    if (text.trim().length < 3) {
      setItems([])
      return
    }
    const id = setTimeout(async () => {
      abort.current?.abort()
      const ctrl = new AbortController()
      abort.current = ctrl
      try {
        const s = await suggest(text, { signal: ctrl.signal })
        if (!ctrl.signal.aborted) {
          setItems(s)
          setActive(-1)
        }
      } catch {
        /* keep the last list; Enter still searches */
      }
    }, 220)
    return () => clearTimeout(id)
  }, [text])

  const go = async (item) => {
    setOpen(false)
    setError(null)
    const target = item || items[active] || items[0] || { text }
    if (!target.text?.trim()) return
    setText(target.text)
    try {
      const hit = await locate(target)
      if (!hit) setError('No match in Los Angeles. Try a street address.')
      else onFound(hit)
    } catch {
      setError('Search is unavailable right now. Tap a lot on the map instead.')
    }
  }

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(items.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(-1, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go()
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      setOpen(false)
    }
  }

  const showList = open && items.length > 0

  return (
    <div className="zl-search">
      <svg className="zl-search__icon" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M13.5 13.5 18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        placeholder="Search an address in Los Angeles"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
        autoComplete="off"
        spellCheck={false}
      />
      {busy && <span className="zl-search__spin" aria-hidden="true" />}
      {showList && (
        <ul id={listId} role="listbox" className="zl-search__list">
          {items.map((s, i) => (
            <li
              key={s.magicKey}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : ''}
              onMouseDown={(e) => {
                e.preventDefault()
                go(s)
              }}
            >
              {s.text.replace(/, USA$/, '')}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="zl-search__error" role="status">
          {error}
        </p>
      )}
    </div>
  )
}
