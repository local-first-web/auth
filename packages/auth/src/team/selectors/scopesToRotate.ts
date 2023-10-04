import { KeyScope } from 'crdx'
import { TeamState } from '@/team/types.js'
import { getVisibleScopes } from './getVisibleScopes.js'

export const scopesToRotate = (state: TeamState, compromisedScope: KeyScope) => {
  return [compromisedScope, ...getVisibleScopes(state, compromisedScope)]
}
