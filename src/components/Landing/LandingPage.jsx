import Experience from '../../experience/Experience.jsx'
import AnalyzeCta from './AnalyzeCta.jsx'
import ProductPreviewSection from './ProductPreviewSection.jsx'
import WhoItsFor from './WhoItsFor.jsx'
import FinalCta from './FinalCta.jsx'

/**
 * The front door.
 *
 * Scrolling the first section *is* the product explanation: the camera travels
 * from raw Reddit noise through signals, sentiment, topics and competitors
 * until the data assembles into a dashboard. The sections below it are the
 * proof — the real, interactive report you get at the end of that journey.
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
      <Experience>{cta}</Experience>

      <ProductPreviewSection />
      <WhoItsFor />
      <FinalCta
        onAnalyze={onAnalyze}
        dataSource={dataSource}
        onOpenSettings={onOpenSettings}
      />
    </main>
  )
}
