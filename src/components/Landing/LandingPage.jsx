import Experience from '../../experience/Experience.jsx'
import AnalyzeCta from './AnalyzeCta.jsx'
import ProductPreviewSection from './ProductPreviewSection.jsx'
import Footer from './Footer.jsx'

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
        fallbackSections={<ProductPreviewSection />}
      >
        {cta}
      </Experience>

      <Footer />
    </main>
  )
}
