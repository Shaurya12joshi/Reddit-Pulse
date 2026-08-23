import Experience from '../../experience/Experience.jsx'
import AnalyzeCta from './AnalyzeCta.jsx'
import ProductPreviewSection from './ProductPreviewSection.jsx'
import Footer from './Footer.jsx'

/**
 * The front door — one world, then the footer.
 *
 * There are no sections stacked below the experience any more. The report,
 * the threads behind it, who it is for and the call to action are all acts of
 * the same scroll-driven journey, so the visitor never crosses a seam between
 * "the 3D bit" and "the website".
 *
 * The footer stays flat on purpose. It is page furniture — orientation and
 * credits — not part of the story, and it is the one place a visitor expects
 * ordinary links that behave like links.
 */
export default function LandingPage({ onAnalyze, dataSource, onOpenSettings }) {
  const cta = (
    <AnalyzeCta
      onAnalyze={onAnalyze}
      dataSource={dataSource}
      onOpenSettings={onOpenSettings}
    />
  )

  return (
    <main className="paper-grain">
      <Experience
        // Only rendered on the no-WebGL / reduced-motion route, where the
        // report has to arrive as panels rather than as geometry.
        fallbackSections={<ProductPreviewSection />}
      >
        {cta}
      </Experience>

      <Footer />
    </main>
  )
}
