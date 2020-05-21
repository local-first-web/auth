import { keyToString } from '/lib'
import { Lockbox } from '/lockbox'
import { UserLockboxMap } from '/team/types'
import { Reducer } from './index'

export const collectLockboxes = (newLockboxes?: Lockbox[]): Reducer => state => {
  const lockboxes = { ...state.lockboxes }
  if (newLockboxes)
    // add each new lockbox to the recipient's list
    for (const lockbox of newLockboxes) {
      const { recipient, recipientPublicKey } = lockbox
      const publicKey = keyToString(recipientPublicKey)
      const userLockboxMap: UserLockboxMap = lockboxes[recipient] || {}
      const lockboxesForKey = userLockboxMap[publicKey] || []
      lockboxesForKey.push(lockbox)
      userLockboxMap[publicKey] = lockboxesForKey
      lockboxes[recipient] = userLockboxMap
    }
  return { ...state, lockboxes }
}
