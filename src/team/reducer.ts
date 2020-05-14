import { SignedLink } from '../chain'
import { Member } from '../member'
import { ADMIN } from '../role'
import { TeamState } from './teamState'
import {
  AddMemberPayload,
  linkType,
  RevokeMemberPayload,
  RootPayload,
} from './types'
import { validate } from './validate'

export const reducer = (prevState: TeamState, link: SignedLink) => {
  // make sure this link can be applied to the previous state
  const validation = validate(prevState, link)
  if (!validation.isValid) throw validation.error

  const { type, payload, context } = link.body

  switch (type) {
    case linkType.ROOT: {
      const { teamName } = payload as RootPayload
      const rootMember = { ...context.user, roles: [ADMIN] }
      return {
        ...prevState,
        teamName,
        members: [rootMember],
      }
    }

    case linkType.ADD_MEMBER: {
      const { user, roles } = payload as AddMemberPayload
      const nextState = {
        ...prevState,
        members: [
          ...prevState.members,
          {
            ...user,
            roles,
          } as Member,
        ],
      }
      return nextState
    }

    case linkType.ADD_DEVICE: {
      const nextState = { ...prevState }
      return nextState
    }

    case linkType.ADD_ROLE: {
      const nextState = { ...prevState }
      return nextState
    }

    case linkType.ADD_MEMBER_ROLE: {
      const nextState = { ...prevState }
      return nextState
    }

    case linkType.REVOKE_MEMBER: {
      const { userName } = payload as RevokeMemberPayload
      const nextState = {
        ...prevState,
        members: prevState.members.filter(
          member => member.userName !== userName
        ),
      }
      return nextState
    }

    case linkType.REVOKE_DEVICE: {
      const nextState = { ...prevState }
      return nextState
    }

    case linkType.REVOKE_ROLE: {
      const nextState = { ...prevState }
      return nextState
    }

    case linkType.REVOKE_MEMBER_ROLE: {
      const nextState = { ...prevState }
      return nextState
    }

    case linkType.INVITE: {
      const nextState = { ...prevState }
      return nextState
    }

    case linkType.ACCEPT: {
      const nextState = { ...prevState }
      return nextState
    }

    case linkType.ROTATE_KEYS: {
      const nextState = { ...prevState }
      return nextState
    }
  }

  // fallthrough
  // TODO: should we throw an error if we get here?
  return prevState
}
