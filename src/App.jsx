import { TOTAL_SCREENS } from './config/chapters.config.js'
import { Footer } from './sections/Footer.jsx'
import { Stage } from './stage/Stage.jsx'
import { Header } from './ui/Header.jsx'
import { Splash } from './ui/Splash.jsx'
import { JourneyProvider, useJourney } from './scroll/JourneyProvider.jsx'

/**
 * The journey section is TOTAL_SCREENS + 1 viewports tall: one viewport for
 * the sticky stage itself, plus one per screen of scroll the chapters ask for.
 */
function Journey() {
  const { sectionRef } = useJourney()
  return (
    <section ref={sectionRef} className="journey" style={{ height: `${(TOTAL_SCREENS + 1) * 100}svh` }}>
      <Stage />
    </section>
  )
}

export default function App() {
  return (
    <JourneyProvider>
      <Splash />
      <Header />
      <main>
        <Journey />
      </main>
      <Footer />
    </JourneyProvider>
  )
}
