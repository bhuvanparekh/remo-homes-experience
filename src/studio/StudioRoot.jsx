import { lazy, Suspense } from 'react'
import { useStoreValue } from '../core/store.js'
import { selectOpen, studio } from './studioState.js'

// The studio (its own 3D scene and form) only downloads when someone opens it.
const Studio = lazy(() => import('./Studio.jsx'))

export function StudioRoot() {
  const open = useStoreValue(studio, selectOpen)
  if (!open) return null
  return (
    <Suspense fallback={<div className="studio studio--loading" aria-busy="true" />}>
      <Studio />
    </Suspense>
  )
}
