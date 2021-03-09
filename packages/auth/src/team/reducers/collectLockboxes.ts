import { Reducer } from '@/team/reducers/index'
import { Lockbox } from '@/lockbox'

export const collectLockboxes = (newLockboxes?: Lockbox[]): Reducer => state => {
  const lockboxes = state.lockboxes
  return newLockboxes ? { ...state, lockboxes: lockboxes.concat(newLockboxes) } : state
}
