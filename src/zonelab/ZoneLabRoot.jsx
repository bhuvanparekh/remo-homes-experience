import { lazy, Suspense } from 'react'
import { useStoreValue } from '../core/store.js'
import { selectZoneLabOpen, zoneLab } from './zoneLabState.js'

// Zone Lab (map library, 3D site model, data code) downloads only when opened.
const ZoneLab = lazy(() => import('./ZoneLab.jsx'))

export function ZoneLabRoot() {
  const open = useStoreValue(zoneLab, selectZoneLabOpen)
  if (!open) return null
  return (
    <Suspense fallback={<div className="zl zl--loading" aria-busy="true" />}>
      <ZoneLab />
    </Suspense>
  )
}
