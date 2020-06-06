import { KeyScope } from '/keys'
import { TeamState } from '/team/types'
import { Lockbox } from '/lockbox'

export const getLockboxesForNode = (state: TeamState, node: KeyScope): Lockbox[] =>
  state.lockboxes.filter(
    ({ contents }) => contents.type === node.type && contents.name === node.name
  )
