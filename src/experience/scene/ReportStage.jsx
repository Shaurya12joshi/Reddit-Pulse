import ReportObject from '../report/ReportObject.jsx'
import { driver } from '../scrollDriver.js'
import { ACT_INDEX, actLocalProgress, stagePresence } from '../acts.js'
import useStageActive from '../useStageActive.js'

const PRESENCE = { lead: 0.32, tail: 0.45 }

export default function ReportStage({ insights, company, reducedMotion = false }) {
  const active = useStageActive(ACT_INDEX.report, PRESENCE)

  if (!insights || (!active && !reducedMotion)) return null

  return (
    <group position={[-1.6, 0.2, 0]}>
      <ReportObject
        insights={insights}
        company={company}
        parallax={false}
        presence={() =>
          reducedMotion ? 1 : stagePresence(driver.damped, ACT_INDEX.report, PRESENCE)
        }
        exit={() => {
          if (reducedMotion) return 0
          const local = actLocalProgress(driver.damped, ACT_INDEX.report)
          return Math.min(1, Math.max(0, (local - 0.55) / 0.41))
        }}
      />
    </group>
  )
}
