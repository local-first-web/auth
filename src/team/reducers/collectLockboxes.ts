import { keyToString } from '/lib'
import { Lockbox } from '/lockbox'
import { UserLockboxMap } from '/team/types'
import { Reducer } from './index'

export const collectLockboxes = (newLockboxes?: Lockbox[]): Reducer => state => {
  const lockboxes = { ...state.lockboxes }
  if (newLockboxes)
    // add each new lockbox to the recipient's list
    for (const lockbox of newLockboxes) {
      // console.log('collecting lockbox', lockbox)
      const { recipient } = lockbox
      const publicKey = keyToString(recipient.publicKey)
      const userLockboxMap: UserLockboxMap = lockboxes[recipient.name] || {}
      const lockboxesForKey = userLockboxMap[publicKey] || []
      lockboxesForKey.push(lockbox)
      userLockboxMap[publicKey] = lockboxesForKey
      lockboxes[recipient.name] = userLockboxMap
    }
  // console.log('done collecting', lockboxes)
  return { ...state, lockboxes }
}
