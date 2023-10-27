import { type KeyScope } from '@localfirst/crdx'
import { visibleScopes } from './visibleScopes.js'
import { type TeamState } from 'team/types.js'

export const scopesToRotate = (state: TeamState, compromisedScope: KeyScope) => [
  compromisedScope,
  ...visibleScopes(state, compromisedScope),
]
