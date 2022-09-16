import { Transform } from '@/team/types'

export const rotateKeys =
  (userId: string): Transform =>
  state => {
    // remove this user name from the list of pending key rotations
    const pendingKeyRotations = state.pendingKeyRotations.filter(u => u !== userId)

    return {
      ...state,
      pendingKeyRotations,
    }
  }
