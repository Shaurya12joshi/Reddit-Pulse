import { useEffect, useState } from 'react'

export default function useEnvironment() {
  const [env, setEnv] = useState({
    ready: false,
    webgl: false,
    reducedMotion: false,
    mobile: false,
  })

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarseQuery = window.matchMedia('(max-width: 860px), (pointer: coarse)')

    const evaluate = () =>
      setEnv({
        ready: true,
        webgl: detectWebGL(),
        reducedMotion: motionQuery.matches,
        mobile: coarseQuery.matches,
      })

    evaluate()
    motionQuery.addEventListener('change', evaluate)
    coarseQuery.addEventListener('change', evaluate)
    return () => {
      motionQuery.removeEventListener('change', evaluate)
      coarseQuery.removeEventListener('change', evaluate)
    }
  }, [])

  return env
}

function detectWebGL() {
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}
