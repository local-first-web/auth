import { Reducer } from '/team/reducers/index'
import { Lockbox } from '/lockbox'

export const collectLockboxes = (newLockboxes?: Lockbox[]): Reducer => state => {
  const lockboxes = state.lockboxes
  // if (newLockboxes)
  //   // add each new lockbox to the recipient's list
  //   for (const lockbox of newLockboxes) {
  //     const { recipient } = lockbox
  //     const publicKey = keyToString(recipient.publicKey)
  //     const userLockboxMap: UserLockboxMap = lockboxes[recipient.name] || {}
  //     const lockboxesForKey = userLockboxMap[publicKey] || []
  //     lockboxesForKey.push(lockbox)
  //     userLockboxMap[publicKey] = lockboxesForKey
  //     lockboxes[recipient.name] = userLockboxMap
  //   }
  return newLockboxes ? { ...state, lockboxes: lockboxes.concat(newLockboxes) } : state
}
