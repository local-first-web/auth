import { Member } from '../member'
import { ADMIN } from '../role'
import { TeamState } from './teamState'
import { TeamLink, TeamLinkBody, TeamAction } from './types'
import { validate } from './validate'

export const reducer = (prevState: TeamState, link: TeamLink) => {
  // make sure this link can be applied to the previous state
  const validation = validate(prevState, link)
  if (!validation.isValid) throw validation.error

  const { context } = link.body

  // recast link body so that payload types are enforced
  const action = link.body as TeamAction

  switch (action.type) {
    case 'ROOT': {
      const { teamName } = action.payload
      const rootMember = { ...context.user, roles: [ADMIN] }
      return {
        ...prevState,
        teamName,
        members: [rootMember],
      }
    }

    case 'ADD_MEMBER': {
      const { user, roles } = action.payload
      const newMember = { ...user, roles } as Member
      return {
        ...prevState,
        members: [...prevState.members, newMember],
      }
    }

    case 'ADD_DEVICE': {
      return { ...prevState }
    }

    case 'ADD_ROLE': {
      const newRole = action.payload
      const nextState = {
        ...prevState,
        roles: [...prevState.roles, newRole],
      }
      return nextState
    }

    case 'ADD_MEMBER_ROLE': {
      return { ...prevState }
    }

    case 'REVOKE_MEMBER': {
      const { userName } = action.payload
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
