import { Transform } from '@/team/types'

export const rotateKeys =
  (userName: string): Transform =>
  state => {
    // remove this user name from the list of pending key rotations
    const pendingKeyRotations = state.pendingKeyRotations.filter(u => u !== userName)

    return {
      ...state,
      pendingKeyRotations,
    }
  }
