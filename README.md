# ReMo Homes — From Rockets to Residences

A scroll-driven 3D journey for ReMo's SupReMo™ steel modular home. One
continuous camera move: descend through the clouds, arrive at a California
lot, watch the home get built, then walk through it room by room.

React + JSX, Vite, three.js via React Three Fiber, Lenis smooth scroll.
No 3D files — the world is built from geometry at runtime.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
```

## Hosting (GitHub Pages)

`.github/workflows/deploy.yml` builds and publishes on every push to `main`.
One-time setup: repo **Settings → Pages → Source: GitHub Actions**.
The site appears at `https://<user>.github.io/<repo-name>/`. The workflow
derives the base path from the repo name, so renaming the repo just works.

## The six chapters

| # | Chapter | Status |
|---|---------|--------|
| 01 | Descent — above the clouds at dawn | ✅ real sky, volumetric clouds, real terrain |
| 02 | The site — lot, top view, trust facts | ✅ real Altadena aerial imagery |
| 03 | Construction — Design · Pre-approve · Manufacture · Deliver, built live on the lot | ✅ Phase 5 |
| 04 | The SupReMo — golden-hour orbit, roof-off room picker | ✅ Phase 2 + 6 |
| 05 | Walkthrough — six room stops, mini-plan, ReMo render cross-fades, X-ray frame | ✅ Phase 3 |
| 06 | Visit — dusk, lit house, factory tour CTA | ✅ Phase 6 |

Review the model freely with `?explore` (drag to orbit, right-drag to pan,
scroll the page to change time of day). Add `?xray` to open with the steel
frame showing, `?snap` to turn off camera smoothing (screenshots).

## The house (Phase 2)

`src/config/floorplan.js` is the single source of truth — walls, openings,
rooms, decks, canopies, solar array — measured from ReMo's furnished floor
plan (15.68 × 8.09 m = 1,365 sq ft) and their elevation renders. The 3D
house in `src/stage/house/` is generated from it, and so are the walkthrough's
2D mini-plan and the X-ray steel frame (`SteelFrame.jsx`: indicative 24" o.c.
light-gauge framing, not ReMo's engineering drawings).

- `Shell.jsx` walls split around real openings, black window surrounds,
  glass doors, interior doors · `Roof.jsx` fascia, solar array, HVAC curb ·
  `Site.jsx` decks, steps, canopies, gravel, lawn, path ·
  `Foliage.jsx` leaf-card trees and shrubs (one instanced draw call) ·
  `interior/` kitchen, living, dining, bedrooms, baths, closets, laundry.
- Performance: static meshes are merged per material at load
  (`StaticBatch.jsx`), shadows render on demand, integrated GPUs get the
  medium tier.

## Room picker and ending (Phase 6)

- **Room picker** (end of chapter 04): the camera rises overhead and the
  roof, solar array and ceiling lift off as one lid (`RoomPicker.jsx`), with
  dark section caps on the wall tops. Hover a room in 3D or in the list card
  and both light up; tour rooms jump straight into the walkthrough. Timing
  is `PICKER` in `tour.config.js`. (No clipping planes — a clip `discard` in
  every house shader cost the tour a third of its frame rate.)
- **Ending** (chapter 06): dusk palette, interior lamps come up, the glass
  glows warm like ReMo's twilight render, the reflected sky dims; ReMo's
  Instagram line "We're proud to build for California communities." plays
  on the way out, then the factory-tour card sits left of the lit house.
- **Phones**: outdoor shots pull the camera back along its view line so the
  house fits a portrait frame (capped so it never backs into the trees).

## The construction (Phase 5)

`src/config/construction.config.js` scripts chapter 03 against ReMo's four
method steps. Scroll builds the house on the real lot (scroll back and it
un-builds):

1. **Design** — a gold wireframe of the digital model (from `floorplan.js`)
   is set out on the dirt and rises to full height.
2. **Pre-approve** — the foundation comes up out of the ground.
3. **Manufacture** — module 1's steel frame assembles on the flatbed, then
   its finished shell closes in from the floor up.
4. **Deliver** — the crane sets the four modules one by one; the truck
   fetches each next one. Then decks, path, lawn and planting.

`ModularBatch.jsx` cuts the finished house into the modules with clipping
planes (a wall crossing a seam is drawn in both modules, each copy cut at
the seam), and swaps back to one merged house once the last module lands,
so the tour costs no more than before. The four-module split is indicative;
ReMo doesn't publish its module breakdown.

`?debug` exposes the renderer as `window.__gl` for draw-call checks.

## The walkthrough (Phase 3)

`src/config/tour.config.js` scripts chapter 05: six stops (entry, living,
kitchen, dining, primary suite, bath) plus doorway waypoints. At each stop the
camera holds still and everything hangs off that hold, so text and camera can
never drift apart:

1. the room caption fades in as the camera arrives;
2. arrow callouts (ReMo's Instagram style, e.g. "Walk-in closet + en suite
   bathroom") point at features in the 3D model — `TourTracker.jsx` pins them
   to the model every frame;
3. ReMo's own render of that room cross-fades over the 3D view (each stop is
   posed to match the render's viewpoint), then the camera moves on.

The mini-plan (bottom right) shows where you are and which way you face;
click a room to go there. Toggles: **X-ray steel frame** (chapters 04–05) and
**ReMo renders**. Indoors the lens widens to ~24 mm like ReMo's renders.

## Where things live

```
src/
  config/        everything content-side — edit here, not in components
    chapters.config.js  pacing (screens), camera keys, sky, caption beats
    tour.config.js      walkthrough stops, waypoints, arrow labels
    construction.config.js  build timing, module slabs, truck + crane
    floorplan.js        the house: walls, openings, rooms, site
    content.config.js   all copy, from remo.homes
    brand.config.js     ReMo palette + fonts → CSS variables at boot
    media.js            ReMo renders in public/media
  core/          generic helpers: maths, tiny store, device quality tier
  scroll/        scroll → progress → chapter → camera (pure, testable)
  stage/         the WebGL world: sky, landscape, clouds, house, camera rig
  ui/            overlay: captions, chapter rail, header, loader
    tour/        walkthrough overlay: labels, render fades, mini-plan, toggles
  sections/      plain-HTML sections after the journey
```

**Scroll is a playhead.** The journey section is one viewport per chapter
"screen" tall with a sticky canvas inside. The page scrolls natively; the
app reads how far that section has travelled (0..1) and the camera, sky and
captions are pure functions of that number. Scroll up and it all runs back.

## Real-world data (chapters 01–02)

`python scripts/build_assets.py` (kept locally, not in the repo) regenerates everything in `public/geo`,
`public/env` and `src/config/geo.manifest.json`:

- **Aerial photos** — USDA NAIP via USGS The National Map (public domain),
  three nested layers: 0.5 m/px around the lot, 2.4 m/px, 15 m/px.
- **Terrain** — AWS Terrain Tiles (USGS 3DEP / SRTM): the San Gabriel
  Mountains behind Altadena, flattened to a graded pad near the lot.
- **Sky** — Poly Haven "Kloppenheim 06 (Pure Sky)", CC0.
- **Clouds** — ray-marched in `stage/world/Clouds.jsx` from a generated 3D
  Perlin-Worley noise, at reduced resolution then composited (≈30 fps on
  Intel UHD integrated graphics at 1440×900).

## Content

All renders, the floor plan and copy are ReMo Homes, Inc.'s own, taken from
remo.homes in October 2026. This is a concept prototype.
