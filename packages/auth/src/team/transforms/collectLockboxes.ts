import { Lockbox } from '@/lockbox/index.js'
import { Transform } from '@/team/types.js'

export const collectLockboxes =
  (newLockboxes?: Lockbox[]): Transform =>
  state => {
    const lockboxes = state.lockboxes
    return newLockboxes ? { ...state, lockboxes: lockboxes.concat(newLockboxes) } : state
  }
