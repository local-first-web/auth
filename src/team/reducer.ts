import { clone, debug } from '/util'
import { ROOT, TeamAction, TeamActionLink } from '/chain'
import { ADMIN } from '/role'
import {
  addDevice,
  addMember,
  addMemberRoles,
  addRole,
  changeMemberKeys,
  collectLockboxes,
  compose,
  postInvitation,
  Reducer,
  removeDevice,
  removeMember,
  removeMemberRole,
  removeRole,
  revokeInvitation,
  setTeamName,
  useInvitation,
} from '/team/reducers'
import { TeamState } from '/team/types'
import { validate } from '/team/validate'

const log = debug('lf:auth:reducer')
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
export const reducer = (state: TeamState, link: TeamActionLink) => {
  state = clone(state)

  // make sure this link can be applied to the previous state & doesn't put us in an invalid state
  const validation = validate(state, link)
  if (!validation.isValid) throw validation.error

  // recast as TeamAction so we get type enforcement on payloads
  const action = link.body as TeamAction

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
    case ROOT:
      const { teamName, rootMember } = action.payload
      return [
        setTeamName(teamName),
        addRole({ roleName: ADMIN }), // create the admin role
        addMember(rootMember), // add the founding member
        ...addMemberRoles(rootMember.userName, [ADMIN]), // make the founding member an admin
      ]

    case 'ADD_MEMBER': {
      const { member: user, roles } = action.payload
      return [
        addMember(user), //
        ...addMemberRoles(user.userName, roles),
      ]
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

    // TODO: I can only add a device for myself
    case 'ADD_DEVICE': {
      const { device } = action.payload
      return [
        addDevice(device), //
      ]
    }

    // TODO: I can only remove my own device, unless I'm an admin
    case 'REMOVE_DEVICE': {
      const { userName, deviceId } = action.payload
      return [
        removeDevice(userName, deviceId), //
      ]
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

    case 'INVITE': {
      const { invitation } = action.payload
      return [
        postInvitation(invitation), // Add the invitation to the list of open invitations.
      ]
    }

    case 'REVOKE_INVITATION': {
      const { id } = action.payload
      return [
        revokeInvitation(id), // We mark an invitation revoked so it can't be used
      ]
    }

    case 'ADMIT': {
      const { id } = action.payload
      return [
        useInvitation(id), // Mark invitation as used so it can't be used a second time
      ]
    }

    // TODO: Can only change my own
    case 'CHANGE_MEMBER_KEYS': {
      const { keys } = action.payload
      return [
        changeMemberKeys(keys), // Replace this member's public keys with the ones provided
      ]
    }

    // TODO: Can only change my own
    case 'CHANGE_DEVICE_KEYS': {
      const { keys } = action.payload
      return [
        // changeDeviceKeys(keys), // Replace this device's public keys with the ones provided
      ]
    }

    default:
      // @ts-ignore (should never get here)
      throw new Error(`Unrecognized link type: ${action.type}`)
  }
}
