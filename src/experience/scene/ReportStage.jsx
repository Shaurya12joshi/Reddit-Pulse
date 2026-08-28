import ReportObject from '../report/ReportObject.jsx'
import { driver } from '../scrollDriver.js'
import { ACT_INDEX, stagePresence } from '../acts.js'
import useStageActive from '../useStageActive.js'

export default function ReportStage({ insights, company, reducedMotion = false }) {
  const active = useStageActive(ACT_INDEX.report, { lead: 0.32, tail: 0.28 })

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
            : stagePresence(driver.damped, ACT_INDEX.report, { lead: 0.32, tail: 0.28 })
        }
      />
    </group>
  )
}
