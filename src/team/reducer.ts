import {
  addMember,
  addMemberRoles,
  addRole,
  collectLockboxes,
  compose,
  postInvitation,
  Reducer,
  revokeInvitation,
  removeMember,
  removeMemberRole,
  removeRole,
  setTeamName,
} from './reducers'
import { ADMIN } from '/role'
import { TeamAction, TeamLink, TeamState } from '/team/types'
import { validate } from '/team/validate'

/**
 * Each link has a `type` and a `payload`, just like a Redux action. So we can derive a `teamState`
 * from `teamChain`, by applying a Redux-style reducer to the array of links. The reducer runs on
 * each link in sequence, accumulating a team state.
 *
 * > *Note:* Keep in mind that this reducer is a pure function that acts on the publicly available
 * links in the signature chain, and must independently return the same result for every member. It
 * knows nothing about the current user's context, and it does not have access to any secrets. Any
 * crypto operations using secret keys that *the current user has* must happen elsewhere.
 *
 * @param state The team state as of the previous link in the signature chain.
 * @param link The current link being processed.
 */
export const reducer = (state: TeamState, link: TeamLink) => {
  // make sure this link can be applied to the previous state & doesn't put us in an invalid state
  const validation = validate(state, link)
  if (!validation.isValid) throw validation.error

  // recast as TeamAction so we get type enforcement on payloads
  const action: TeamAction = link.body

  // get all transforms and compose them into a single function
  const applyTransforms = compose([
    collectLockboxes(action.payload.lockboxes), // any payload can include lockboxes
    ...getTransforms(action), // get the specific transforms indicated by this action
  ])

  return applyTransforms(state)
}

/**
 * Each action type generates one or more transforms (functions that take the old state and return a
 * new state). This returns an array of transforms that are then applied in order.
 * @param action The team action (type + payload) being processed
 */
const getTransforms = (action: TeamAction): Reducer[] => {
  switch (action.type) {
    case 'ROOT':
      const { teamName, rootMember } = action.payload
      return [
        setTeamName(teamName), //
        addMember(rootMember),
        ...addMemberRoles(rootMember.userName, [ADMIN]),
      ]

    case 'ADD_MEMBER': {
      const { member: user, roles } = action.payload
      return [
        addMember(user), //
        ...addMemberRoles(user.userName, roles),
      ]
    }

    case 'ADD_DEVICE': {
      // TODO: ADD_DEVICE
      return []
    }

    case 'ADD_ROLE': {
      const newRole = action.payload
      return [
        addRole(newRole), //
      ]
    }

    case 'ADD_MEMBER_ROLE': {
      const { userName, roleName } = action.payload
      return [
        ...addMemberRoles(userName, [roleName]), //
      ]
    }

    case 'REMOVE_MEMBER': {
      const { userName } = action.payload
      return [
        removeMember(userName), //
      ]
    }

    case 'REMOVE_DEVICE': {
      // TODO: REMOVE_DEVICE
      return []
    }

    case 'REMOVE_ROLE': {
      const { roleName } = action.payload
      return [
        removeRole(roleName), //
      ]
    }

    case 'REMOVE_MEMBER_ROLE': {
      const { userName, roleName } = action.payload
      return [
        removeMemberRole(userName, roleName), //
      ]
    }

    case 'POST_INVITATION': {
      // Add the invitation to the list of open invitations.
      const { invitation } = action.payload
      return [
        postInvitation(invitation), //
      ]
    }

    case 'REVOKE_INVITATION': {
      // When an invitation is revoked, we remove it from the list of open invitations.
      const { id } = action.payload
      return [
        revokeInvitation(id), //
      ]
    }

    case 'ADMIT_INVITED_MEMBER': {
      const { id, member: user, roles } = action.payload
      return [
        addMember(user), // Add member
        ...addMemberRoles(user.userName, roles), // Add member to roles
        revokeInvitation(id), // Remove invitation from open invitations
      ]
    }

    default:
      // @ts-ignore (should never get here)
      throw new Error(`Unrecognized link type: ${action.type}`)
  }
}
