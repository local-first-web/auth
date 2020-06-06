import { KeyNode } from '/keys'
import { TeamState } from '/team/types'
import { Lockbox } from '/lockbox'

export const getLockboxesForNode = (state: TeamState, node: KeyNode): Lockbox[] =>
  state.lockboxes.filter(
    ({ contents }) => contents.scope === node.scope && contents.name === node.name
  )
