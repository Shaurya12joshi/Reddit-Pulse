import { Link, Navigate, Route, Routes } from 'react-router'

import LandingRoute from './pages/LandingRoute.jsx'
import AnalyzePage from './pages/AnalyzePage.jsx'
import ConnectAiPage from './pages/ConnectAiPage.jsx'

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-[15px] font-medium text-ink">Page not found</p>
      <Link to="/" className="text-[13px] text-accent-ink underline underline-offset-2">
        Back to the start
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingRoute />} />
      <Route path="/analyze/:company" element={<AnalyzePage />} />
      <Route path="/connect" element={<ConnectAiPage />} />
      {}
      <Route path="/analyze" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
