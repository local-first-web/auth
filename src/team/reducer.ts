import { TeamState, TeamLockboxMap, UserLockboxMap } from '/team/teamState'
import { TeamAction, TeamLink } from '/team/types'
import { validate } from '/team/validate'
import { Member } from '/member'
import { ADMIN } from '/role'
import { Lockbox } from '/lockbox'
import { keyToString } from '/lib'

/**
 * Each link has a `type` and a `payload`, just like a Redux action. So we can derive a `teamState`
 * from `teamChain`, by applying a Redux-style reducer to the array of links. The reducer runs on
 * each link in sequence, accumulating a team state.
 *
 * > *Note:* Keep in mind that this reducer is a pure function that acts on the publicly available
 * > links in the signature chain, and must independently return the same result for every member.
 * > It knows nothing about the current user's context, and it does not have access to any secrets.
 * > Any crypto operations must happen elsewhere.
 *
 * @param state The team state as of the previous link in the signature chain.
 * @param link The current link being processed.
 */
export const reducer = (state: TeamState, link: TeamLink) => {
  // make sure this link can be applied to the previous state
  const validation = validate(state, link)
  if (!validation.isValid) throw validation.error

  const { context } = link.body

  // recast link body so that payload types are enforced
  const action = link.body as TeamAction

  const lockboxes = collectLockboxes(state.lockboxes, action.payload.lockboxes)

  switch (action.type) {
    case 'ROOT': {
      const { teamName } = action.payload
      const rootMember = { ...context.user, roles: [ADMIN] }
      return {
        ...state,
        lockboxes,
        teamName,
        members: [rootMember],
      }
    }

    case 'ADD_MEMBER': {
      const { user, roles } = action.payload
      const newMember = { ...user, roles } as Member
      return {
        ...state,
        lockboxes,
        members: [...state.members, newMember],
      }
    }

    case 'ADD_DEVICE': {
      return { ...state }
    }

    case 'ADD_ROLE': {
      const newRole = action.payload
      const nextState = {
        ...state,
        lockboxes,
        roles: [...state.roles, newRole],
      }
      return nextState
    }

    case 'ADD_MEMBER_ROLE': {
      return { ...state }
    }

    case 'REVOKE_MEMBER': {
      const { userName } = action.payload
      const nextState = {
        ...state,
        lockboxes,
        members: state.members.filter(member => member.userName !== userName),
      }
      return nextState
    }

    case 'REVOKE_DEVICE': {
      const nextState = { ...state, lockboxes }
      return nextState
    }

    case 'REVOKE_ROLE': {
      const nextState = { ...state, lockboxes }
      return nextState
    }

    case 'REVOKE_MEMBER_ROLE': {
      const nextState = { ...state, lockboxes }
      return nextState
    }

    case 'INVITE': {
      const nextState = { ...state, lockboxes }
      return nextState
    }

    case 'ACCEPT': {
      const nextState = { ...state, lockboxes }
      return nextState
    }

    case 'ROTATE_KEYS': {
      const nextState = { ...state, lockboxes }
      return nextState
    }
  }

  // @ts-ignore (should never get here)
  throw new Error(`Unrecognized link type: ${action.type}`)
}

const collectLockboxes = (
  prevLockboxMap: TeamLockboxMap,
  added?: Lockbox[]
) => {
  const lockboxMap = { ...prevLockboxMap }
  if (added)
    // add each new lockbox to the recipient's list
    for (const lockbox of added) {
      const { recipient, recipientPublicKey } = lockbox
      const publicKey = keyToString(recipientPublicKey)
      const userLockboxMap: UserLockboxMap = lockboxMap[recipient] || {}
      const lockboxes = userLockboxMap[publicKey] || []
      lockboxes.push(lockbox)
      userLockboxMap[publicKey] = lockboxes
      lockboxMap[recipient] = userLockboxMap
    }
  return lockboxMap
}
