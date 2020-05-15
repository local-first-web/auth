import { SignedLink } from '../chain'
import { Member } from '../member'
import { ADMIN } from '../role'
import { TeamState } from './teamState'
import { validate } from './validate'
import { TeamLinkBody } from './types'

export const reducer = (
  prevState: TeamState,
  link: SignedLink<TeamLinkBody>
) => {
  // make sure this link can be applied to the previous state
  const validation = validate(prevState, link)
  if (!validation.isValid) throw validation.error

  const { type, payload, context } = link.body

  switch (type) {
    case 'ROOT': {
      const { teamName } = payload
      const rootMember = { ...context.user, roles: [ADMIN] }
      return {
        ...prevState,
        teamName,
        members: [rootMember],
      }
    }

    case 'ADD_MEMBER': {
      const { user, roles } = payload
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

    case 'ADD_DEVICE': {
      const nextState = { ...prevState }
      return nextState
    }

    case 'ADD_ROLE': {
      const nextState = { ...prevState }
      return nextState
    }

    case 'ADD_MEMBER_ROLE': {
      const nextState = { ...prevState }
      return nextState
    }

    case 'REVOKE_MEMBER': {
      const { userName } = payload
      const nextState = {
        ...prevState,
        members: prevState.members.filter(
          member => member.userName !== userName
        ),
      }
      return nextState
    }

    case 'REVOKE_DEVICE': {
      const nextState = { ...prevState }
      return nextState
    }

    case 'REVOKE_ROLE': {
      const nextState = { ...prevState }
      return nextState
    }

    case 'REVOKE_MEMBER_ROLE': {
      const nextState = { ...prevState }
      return nextState
    }

    case 'INVITE': {
      const nextState = { ...prevState }
      return nextState
    }

    case 'ACCEPT': {
      const nextState = { ...prevState }
      return nextState
    }

    case 'ROTATE_KEYS': {
      const nextState = { ...prevState }
      return nextState
    }
  }

  // fallthrough
  // TODO: should we throw an error if we get here?
  return prevState
}
