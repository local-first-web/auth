import { Member } from '.'
import { TeamLink, TeamState } from './types'

/**
 * This function is used as an alternative reducer for invalid links; the normal reducer just
 * returns the result of this function.
 *
 * Invalid links are actions that were flagged to be discarded by the MembershipResolver when
 * dealing with conflicting concurrent actions.
 *
 * Example: Bob invited Charlie, but concurrently Alice removed Bob from the team. Bob's invitation
 * of Charlie is now invalid, as well as anything resulting from that invitation (e.g. Charlie is
 * admitted, Charlie does stuff, etc.)
 *
 * Normally we just ignore these links and they don't affect state at all. However, there are some
 * situations where we need to pay attention. In the above example, we need to act as if Charlie was
 * removed from the team, and do some cleanup.
 */
export const invalidLinkReducer = (state: TeamState, link: TeamLink): TeamState => {
  switch (link.body.type) {
    case 'ADMIT_MEMBER':
      // We need to treat invalidated ADMIT_MEMBER actions as removals, in that they're included in
      // `removedMembers`. This way their client will receive the appropriate error message when
      // trying to connect, and will know to self-destruct the chain they received.
      const keys = link.body.payload.memberKeys
      const userId = keys.name

      const member: Member = { userId: userId, keys, roles: [] }
      const removedMembers = [...state.removedMembers, member]

      // We also need to flag the user as compromised, so that an admin can rotate all keys they had access to at the first opportunity.
      const pendingKeyRotations = [...state.pendingKeyRotations]
      if (!pendingKeyRotations.includes(userId)) pendingKeyRotations.push(userId)
      return {
        ...state,
        // Note that we don't need to alter the list of members, because this member is never added
        removedMembers,
        pendingKeyRotations,
      }

    default:
      break
  }

  return state
}
