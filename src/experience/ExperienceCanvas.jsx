import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor, Preload } from '@react-three/drei'

import ConversationField from './scene/ConversationField.jsx'
import CameraRig from './scene/CameraRig.jsx'
import DashboardAssembly from './scene/DashboardAssembly.jsx'
import ReportStage from './scene/ReportStage.jsx'
import EvidenceStage from './scene/EvidenceStage.jsx'
import { PAPER_3D } from './palette.js'

/**
 * The WebGL layer.
 *
 * Lighting is deliberately flat and bright: two soft directionals and a strong
 * ambient, no shadow maps. Paper does not throw hard shadows, and skipping
 * shadow rendering entirely is what keeps hundreds of instances cheap.
 *
 * Fog matched to the page background is doing real work — it dissolves distant
 * fragments into the canvas colour so the WebGL layer has no visible edge
 * against the HTML around it.
 */
export default function ExperienceCanvas({
  count,
  reducedMotion,
  insights,
  company,
  posts,
  onOpenPost,
}) {
  // Drop resolution rather than frame rate when the GPU struggles.
  const [dpr, setDpr] = useState(1.5)

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 42, near: 0.1, far: 120, position: [0, 0, 13] }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr(Math.min(1.75, window.devicePixelRatio || 1))}
      />

      <fog attach="fog" args={[PAPER_3D.bg, 20, 52]} />

      <ambientLight intensity={2.1} />
      <directionalLight position={[6, 10, 8]} intensity={1.5} />
      <directionalLight position={[-8, -4, 4]} intensity={0.5} color="#e8dfc9" />

      <Suspense fallback={null}>
        <CameraRig reducedMotion={reducedMotion} />
        <ConversationField count={count} reducedMotion={reducedMotion} />
        <DashboardAssembly reducedMotion={reducedMotion} />

        {/* The data-driven acts. Both read the scroll driver themselves and
            stop rendering outside their own stretch of the journey, so the
            world only ever draws the stage the camera is actually at. */}
        <ReportStage insights={insights} company={company} reducedMotion={reducedMotion} />
        <EvidenceStage posts={posts} onOpenPost={onOpenPost} reducedMotion={reducedMotion} />

        <Preload all />
      </Suspense>

      <AdaptiveDpr pixelated={false} />
    </Canvas>
  )
}
