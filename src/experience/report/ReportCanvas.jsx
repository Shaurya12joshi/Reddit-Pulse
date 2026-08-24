import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei'

import ReportObject from './ReportObject.jsx'
import { PAPER_3D } from '../palette.js'

export default function ReportCanvas({ insights, company, active }) {
  const [dpr, setDpr] = useState(1.4)

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 42, near: 0.1, far: 120, position: [0, 0.6, 15.5] }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr(Math.min(1.6, window.devicePixelRatio || 1))}
      />

      <fog attach="fog" args={[PAPER_3D.bg, 22, 58]} />

      <ambientLight intensity={2.1} />
      <directionalLight position={[6, 10, 8]} intensity={1.5} />
      <directionalLight position={[-8, -4, 4]} intensity={0.5} color="#e8dfc9" />

      <Suspense fallback={null}>
        <ReportObject
          insights={insights}
          company={company}
          presence={() => (active ? 1 : 0)}
        />
      </Suspense>

      <AdaptiveDpr pixelated={false} />
    </Canvas>
  )
}
