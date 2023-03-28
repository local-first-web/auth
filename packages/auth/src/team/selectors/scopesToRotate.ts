import { KeyScope } from '@localfirst/crdx'
import { TeamState } from '@/team/types'
import { getVisibleScopes } from './getVisibleScopes'

export const scopesToRotate = (state: TeamState, compromisedScope: KeyScope) => {
  return [compromisedScope, ...getVisibleScopes(state, compromisedScope)]
}
