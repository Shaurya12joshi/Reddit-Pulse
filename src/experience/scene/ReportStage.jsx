import ReportObject from '../report/ReportObject.jsx'
import { driver } from '../scrollDriver.js'
import { ACT_INDEX, stagePresence } from '../acts.js'
import useStageActive from '../useStageActive.js'

/**
 * The report, placed inside the shared world.
 *
 * `ReportObject` owns the composition and the data-driven geometry; this is
 * only the bracket that decides *when* it exists — reading the scroll driver
 * so the report builds as the camera arrives at the REPORT act and comes
 * apart again as it leaves.
 *
 * Mounted rather than hidden. Its labels are drei `Html`, which is real DOM
 * outside the canvas and ignores `object.visible`, so an unmounted stage is
 * the only way it genuinely stops existing.
 *
 * Parallax is off here: `CameraRig` is already moving the whole scene with
 * the pointer, and a second lean on top of it reads as the object drifting
 * loose from the world rather than sitting in it.
 */
export default function ReportStage({ insights, company, reducedMotion = false }) {
  const active = useStageActive(ACT_INDEX.report, { lead: 0.25, tail: 0.08 })

  if (!insights || (!active && !reducedMotion)) return null

  return (
    <group position={[-1.6, 0.2, 0]}>
      <ReportObject
        insights={insights}
        company={company}
        parallax={false}
        presence={() =>
          reducedMotion
            ? 1
            : stagePresence(driver.damped, ACT_INDEX.report, { lead: 0.25, tail: 0.08 })
        }
      />
    </group>
  )
}
