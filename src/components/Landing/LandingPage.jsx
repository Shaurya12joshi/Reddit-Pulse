import Experience from '../../experience/Experience.jsx'
import AnalyzeCta from './AnalyzeCta.jsx'
import ProductPreviewSection from './ProductPreviewSection.jsx'
import Footer from './Footer.jsx'

export default function LandingPage({ onAnalyze, resolving = false }) {
  const cta = <AnalyzeCta onAnalyze={onAnalyze} resolving={resolving} />

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
