import { Component } from 'react'

/**
 * Keeps a broken scene from taking the page with it.
 *
 * A thrown error inside the R3F tree unmounts the whole canvas, and because
 * the canvas *is* the landing page now, an uncaught one leaves a blank
 * screen — which is exactly what happened when a stage was handed null data
 * before the backend answered.
 *
 * The 3D is an enhancement over content that also exists as HTML, so the
 * honest response to a scene failure is to show that HTML, not an apology.
 */
export default class SceneBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    // Loud in development, because a silent fallback is how a broken scene
    // ships unnoticed.
    console.error('[experience] scene failed, falling back to the flat route:', error, info)
    this.props.onFail?.(error)
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null
    return this.props.children
  }
}
