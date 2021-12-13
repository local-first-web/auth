import { Member, TEAM_SCOPE } from '.'
import { TeamLink, TeamState } from './types'

/**
 * Invalid links are actions that were flagged to be discarded by the MembershipResolver when
 * dealing with conflicting concurrent actions.
 *
 * Example: Bob invited Charlie, but concurrently Alice removed Bob from the team. Bob's invitation
 * of Charlie is now invalid, as well as anything resulting from that invitation (e.g. Charlie is
 * admitted, Charlie does stuff, etc.)
 *
 * Normally we just ignore these links and they don't affect state at all. However, there are some
 * situations where we need to pay attention. In the above example, we need to act as if
 * Charlie was removed from the team.
 */
export const invalidLinkReducer = (state: TeamState, link: TeamLink): TeamState => {
  switch (link.body.type) {
    case 'ADMIT_MEMBER':
      // We need to treat invalidated ADMIT_MEMBER actions as removals, in that they're included in
      // `removedMembers`. This way their client will receive the appropriate error message when
      // trying to connect, and will know to self-destruct the chain they received.
      const keys = link.body.payload.memberKeys
      const userName = keys.name
      const member: Member = { userName, keys, roles: [] }
      const removedMembers = [...state.removedMembers, member]

      // We also need to flag the team keys as compromised, so that an admin can rotate them at the first opportunity.
      const scopesToRotate = state.pendingKeyRotations[userName] || []
      const pendingKeyRotations = {
        ...state.pendingKeyRotations,
        [userName]: [...scopesToRotate, TEAM_SCOPE],
      }

      // Note that we don't need to alter the list of members, because they're never added
      return {
        ...state,
        removedMembers,
        pendingKeyRotations,
      }

    default:
      break
  }

  return state
}
