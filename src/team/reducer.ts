import { ADMIN } from '../role'
import { SignedLink } from '../chain'
import { Member } from '../member'
import {
  AddMemberPayload,
  linkType,
  RevokeMemberPayload,
  RootPayload,
} from './types'
import { TeamState } from './teamState'
import * as selectors from './selectors'

export const reducer = (prevState: TeamState, link: SignedLink) => {
  const { type, payload, context } = link.body

  // check that the user who made these changes was admin at the time
  const { userName } = context.user
  if (type !== linkType.ROOT && !selectors.memberIsAdmin(prevState, userName))
    throw new Error(
      `Invalid signature chain: member '${userName}' is not an admin at this time`
    )

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
