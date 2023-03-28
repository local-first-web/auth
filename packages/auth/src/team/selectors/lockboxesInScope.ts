import { KeyScope } from '@localfirst/crdx'
import { TeamState } from '@/team/types'
import { Lockbox } from '@/lockbox'

/** Returns all lockboxes *containing* keys for the given scope */
export const lockboxesInScope = (state: TeamState, scope: KeyScope): Lockbox[] => {
  const lockboxes = state.lockboxes.filter(
    ({ contents }) => contents.type === scope.type && contents.name === scope.name
  )
  let latestGeneration = lockboxes.reduce(maxGeneration, 0)
  const latestLockboxes = lockboxes.filter(
    ({ contents }) => contents.generation === latestGeneration
  )
  return latestLockboxes
}

const maxGeneration = (max: number, lockbox: Lockbox) => {
  const { generation } = lockbox.contents
  if (generation > max) return generation
  else return max
}
