import { type KeyScope } from '@localfirst/crdx'
import { getVisibleScopes } from './getVisibleScopes.js'
import { type TeamState } from 'team/types.js'

export const scopesToRotate = (state: TeamState, compromisedScope: KeyScope) => [
  compromisedScope,
  ...getVisibleScopes(state, compromisedScope),
]
