import { Context } from '/context'
import { Invitation } from '/invitation'
import { keyToString } from '/lib'
import { Lockbox } from '/lockbox'
import { ADMIN, Role } from '/role'
import { TeamAction, TeamLink, TeamState, UserLockboxMap } from '/team/types'
import { validate } from '/team/validate'
import { User } from '/user'

/**
 * Each link has a `type` and a `payload`, just like a Redux action. So we can derive a `teamState`
 * from `teamChain`, by applying a Redux-style reducer to the array of links. The reducer runs on
 * each link in sequence, accumulating a team state.
 *
 * > *Note:* Keep in mind that this reducer is a pure function that acts on the publicly available
 * links in the signature chain, and must independently return the same result for every member. It
 * knows nothing about the current user's context, and it does not have access to any secrets. Any
 * crypto operations using secret keys that the current user has must happen elsewhere.
 *
 * @param state The team state as of the previous link in the signature chain.
 * @param link The current link being processed.
 */
export const reducer = (state: TeamState, link: TeamLink) => {
  // make sure this link can be applied to the previous state
  const validation = validate(state, link)
  if (!validation.isValid) throw validation.error

  const action = link.body as TeamAction
  const baseTransforms = [
    collectLockboxes(action.payload.lockboxes), //
  ]
  const transforms = [
    ...baseTransforms, //
    ...getTransforms(action),
  ]

  const allTransforms = compose(transforms)
  return allTransforms(state)
}

const getTransforms = (action: TeamAction) => {
  switch (action.type) {
    case 'ROOT':
      const { teamName, rootMember } = action.payload
      return [
        setTeamName(teamName), //
        addMember(rootMember),
        ...addMemberRoles(rootMember.userName, [ADMIN]),
      ]

    case 'ADD_MEMBER': {
      const { user, roles } = action.payload
      return [
        addMember(user), //
        ...addMemberRoles(user.userName, roles),
      ]
    }

    case 'ADD_DEVICE': {
      return [todoTransform()]
    }

    case 'ADD_ROLE': {
      const newRole = action.payload
      return [
        addRole(newRole), //
      ]
    }

    case 'ADD_MEMBER_ROLE': {
      return [
        todoTransform(), //
      ]
    }

    case 'REVOKE_MEMBER': {
      const { userName } = action.payload
      return [
        revokeMember(userName), //
      ]
    }

    case 'REVOKE_DEVICE': {
      return [todoTransform()]
    }

    case 'REVOKE_ROLE': {
      return [todoTransform()]
    }

    case 'REVOKE_MEMBER_ROLE': {
      return [todoTransform()]
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
        removeInvitation(id), //
      ]
    }

    case 'USE_INVITATION': {
      const { id, user, roles } = action.payload
      return [
        addMember(user), // Add member
        ...addMemberRoles(user.userName, roles), // Add member to roles
        removeInvitation(id), // Remove invitation from open invitations
      ]
    }

    case 'ROTATE_KEYS':
      return [todoTransform()]

    default:
      // @ts-ignore (should never get here)
      throw new Error(`Unrecognized link type: ${action.type}`)
  }
}

const todoTransform = (): Transform => (state) => state

const collectLockboxes = (newLockboxes?: Lockbox[]): Transform => (state) => {
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

const setTeamName = (teamName: string): Transform => (state) => ({
  ...state,
  teamName,
})

const addMember = (user: User): Transform => (state) => ({
  ...state,
  members: [...state.members, { ...user, roles: [] }],
})

const revokeMember = (userName: string): Transform => (state) => ({
  ...state,
  members: state.members.filter((member) => member.userName !== userName),
})

const addRole = (newRole: Role): Transform => (state) => ({
  ...state,
  roles: [...state.roles, newRole],
})

const addMemberRoles = (userName: string, roles: string[] = []): Transform[] =>
  roles.map((roleName) => (state) => ({
    ...state,
    members: state.members.map((m) => {
      if (m.userName === userName && !m.roles.includes(roleName)) m.roles.push(roleName)
      return m
    }),
  }))

const postInvitation = (invitation: Invitation): Transform => (state) => ({
  ...state,
  invitations: {
    ...state.invitations,
    [invitation.id]: invitation,
  },
})

const removeInvitation = (id: string): Transform => (state) => {
  const invitations = { ...state.invitations }
  delete invitations[id]
  return {
    ...state,
    invitations,
  }
}

type Transform = (state: TeamState) => TeamState

const compose = (transforms: Transform[]): Transform => (state) =>
  transforms.reduce((state, transform) => transform(state), state)
