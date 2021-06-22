import { clone, debug } from '@/util'
import { ROOT, TeamAction, TeamActionLink } from '@/chain'
import { ADMIN } from '@/role'
import {
  addDevice,
  addMember,
  addMemberRoles,
  addRole,
  changeMemberKeys,
  changeDeviceKeys,
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
} from '@/team/reducers'
import { TeamState } from '@/team/types'
import { validate } from '@/team/validate'
import { Member } from '@/member'
import { PublicDevice } from '@/device'

export const setHead = (link: TeamActionLink): Reducer => state => {
  return { ...state, __HEAD: link.hash }
}

/**
 * Each link has a `type` and a `payload`, just like a Redux action. So we can derive a `TeamState`
 * from a `TeamChain`, by applying a Redux-style reducer to the array of links. The reducer runs on
 * each link in sequence, accumulating a team state.
 *
 * > *Note:* Keep in mind that this reducer is a pure function that acts on the publicly available
 * links in the signature chain, and must independently return the same result for every member. It
 * knows nothing about the current user's context, and it does not have access to any secrets. Any
 * crypto operations using secret keys that **the current user has** must happen elsewhere.
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
    setHead(link),
    collectLockboxes(action.payload.lockboxes), // any payload can include lockboxes
    ...getTransforms(action), // get the specific transforms indicated by this action
  ])
  const newState = applyTransforms(state)

  return newState
}

/**
 * Each action type generates one or more transforms (functions that take the old state and return a
 * new state). This returns an array of transforms that are then applied in order.
 * @param action The team action (type + payload) being processed
 */
const getTransforms = (action: TeamAction): Reducer[] => {
  switch (action.type) {
    case ROOT:
      const { teamName, rootMember, rootDevice } = action.payload
      return [
        setTeamName(teamName),
        addRole({ roleName: ADMIN }), // create the admin role
        addMember(rootMember), // add the founding member
        addDevice(rootDevice), // add the founding member's device
        ...addMemberRoles(rootMember.userName, [ADMIN]), // make the founding member an admin
      ]

    case 'ADD_MEMBER': {
      const { member, roles } = action.payload
      return [
        addMember(member), // add this member to the team
        ...addMemberRoles(member.userName, roles), // add each of these roles to the member's list of roles
      ]
    }

    case 'ADD_ROLE': {
      const newRole = action.payload
      return [
        addRole(newRole), // add this role to the team
      ]
    }

    case 'ADD_MEMBER_ROLE': {
      const { userName, roleName } = action.payload
      return [
        ...addMemberRoles(userName, [roleName]), // add this role to the member's list of roles
      ]
    }

    case 'REMOVE_MEMBER': {
      const { userName } = action.payload
      return [
        removeMember(userName), // remove this member from the team
      ]
    }

    case 'ADD_DEVICE': {
      const { device } = action.payload
      return [
        addDevice(device), // add this device to the member's list of devices
      ]
    }

    case 'REMOVE_DEVICE': {
      const { userName, deviceName } = action.payload
      return [
        removeDevice(userName, deviceName), // remove this device from the member's list of devices
      ]
    }

    case 'REMOVE_ROLE': {
      const { roleName } = action.payload
      return [
        removeRole(roleName), // remove this role from the team
      ]
    }

    case 'REMOVE_MEMBER_ROLE': {
      const { userName, roleName } = action.payload
      return [
        removeMemberRole(userName, roleName), // remove this role from the member's list of roles
      ]
    }

    case 'INVITE_MEMBER': {
      const { invitation } = action.payload
      return [
        postInvitation(invitation), // add the invitation to the list of open invitations.
      ]
    }

    case 'INVITE_DEVICE': {
      const { invitation } = action.payload
      return [
        postInvitation(invitation), // add the invitation to the list of open invitations.
      ]
    }

    case 'REVOKE_INVITATION': {
      const { id } = action.payload
      return [
        revokeInvitation(id), // mark the invitation revoked so it can't be used
      ]
    }

    case 'ADMIT_MEMBER': {
      const { id, memberKeys } = action.payload
      const userName = memberKeys.name

      const member: Member = {
        userName,
        keys: memberKeys,
        roles: [],
      }

      return [
        useInvitation(id), // mark the invitation as used
        addMember(member), // add this member to the team
      ]
    }

    case 'ADMIT_DEVICE': {
      const { id, userName, deviceKeys } = action.payload

      const device: PublicDevice = {
        userName,
        deviceName: deviceKeys.name,
        keys: deviceKeys,
      }

      return [
        useInvitation(id), // mark the invitation as used
        addDevice(device), // add this device
      ]
    }

    case 'CHANGE_MEMBER_KEYS': {
      const { keys } = action.payload
      return [
        changeMemberKeys(keys), // replace this member's public keys with the ones provided
      ]
    }

    case 'CHANGE_DEVICE_KEYS': {
      const { keys } = action.payload
      return [
        changeDeviceKeys(keys), // replace this device's public keys with the ones provided
      ]
    }

    default:
      // @ts-ignore (should never get here)
      throw new Error(`Unrecognized link type: ${action.type}`)
  }
}
