import { actionFingerprint } from './actionFingerprint'
import { getSequence } from '@localfirst/crdx'
import { TeamAction, TeamContext, TeamGraph } from '@/team/types'
import { membershipResolver as resolver } from '@/team/membershipResolver'

export const graphSummary = (graph: TeamGraph) => {
  const links = getSequence<TeamAction, TeamContext>(graph, resolver)
    .filter(l => l.isInvalid !== true)
    .map(l => actionFingerprint(l))
    .join(',')
  return links //`${chain.head.slice(0, 5)}:${links}`
}
