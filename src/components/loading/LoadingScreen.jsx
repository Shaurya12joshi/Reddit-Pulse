import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei'

import RedditOrbScene from './RedditOrbScene.jsx'
import useEnvironment from '../../experience/useEnvironment.js'

const STAGES = [
  { id: 'starting', label: 'Connecting' },
  { id: 'scraping', label: 'Collecting' },
  { id: 'summarising', label: 'Analysing' },
]

function StageDots({ stage }) {
  const activeIndex = STAGES.findIndex((s) => s.id === stage)

  return (
    <div className="flex items-center gap-2">
      {STAGES.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
              i <= activeIndex ? 'bg-accent' : 'bg-accent/20'
            }`}
          />
          <span
            className={`text-[11px] uppercase tracking-wide transition-colors duration-300 ${
              i === activeIndex ? 'text-accent-ink' : 'text-ink-3/50'
            }`}
          >
            {s.label}
          </span>
          {i < STAGES.length - 1 ? <span className="h-px w-4 bg-line" /> : null}
        </div>
      ))}
    </div>
  )
}

function Overlay({ company, progress }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end gap-4 px-6 pb-16 text-center">
      <StageDots stage={progress.stage} />
      <div>
        <p className="text-[15px] font-medium text-ink">Analysing {company}</p>
        <p className="mt-1 text-[13px] text-ink-3">{progress.message}</p>
      </div>
    </div>
  )
}

function StaticFallback({ company, progress }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
      <div>
        <p className="text-[15px] font-medium text-ink">Analysing {company}</p>
        <p className="mt-1 text-[13px] text-ink-3">{progress.message}</p>
      </div>
      <StageDots stage={progress.stage} />
    </div>
  )
}

export default function LoadingScreen({ company, progress }) {
  const env = useEnvironment()
  const [dpr, setDpr] = useState(1.5)

  if (!env.ready) return null

  if (!env.webgl || env.reducedMotion) {
    return <StaticFallback company={company} progress={progress} />
  }

  return (
    <div className="relative min-h-screen bg-canvas">
      <Canvas
        dpr={dpr}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        camera={{ fov: 42, near: 0.1, far: 40, position: [0, 0, 7.5] }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <PerformanceMonitor
          onDecline={() => setDpr(1)}
          onIncline={() => setDpr(Math.min(1.75, window.devicePixelRatio || 1))}
        />
        <Suspense fallback={null}>
          <RedditOrbScene reducedMotion={false} />
        </Suspense>
        <AdaptiveDpr pixelated={false} />
      </Canvas>

      <Overlay company={company} progress={progress} />
    </div>
  )
}
