import { KeyScope } from '/keys'
import { TeamState } from '/team/types'
import { Lockbox } from '/lockbox'

export const lockboxesInScope = (state: TeamState, scope: KeyScope): Lockbox[] =>
  state.lockboxes.filter(
    ({ contents }) => contents.type === scope.type && contents.name === scope.name
  )
