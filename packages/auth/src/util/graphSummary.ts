import { actionFingerprint } from './actionFingerprint.js'
import { getSequence } from 'crdx'
import { TeamAction, TeamContext, TeamGraph } from '@/team/types.js'
import { membershipResolver as resolver } from '@/team/membershipResolver.js'

export const graphSummary = (graph: TeamGraph) => {
  const links = getSequence<TeamAction, TeamContext>(graph, resolver)
    .filter(l => l.isInvalid !== true)
    .map(l => actionFingerprint(l))
    .join(',')
  return links //`${chain.head.slice(0, 5)}:${links}`
}
