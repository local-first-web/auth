import { Lockbox } from '@/lockbox'
import { Transform } from '@/team/types'

export const collectLockboxes =
  (newLockboxes?: Lockbox[]): Transform =>
  state => {
    const lockboxes = state.lockboxes
    return newLockboxes ? { ...state, lockboxes: lockboxes.concat(newLockboxes) } : state
  }
