import { SignatureChain, SignedLink } from 'chain'
import { linkType, RootPayload, TeamState, AddMemberPayload } from './types'
import { Member } from '../member'

export const reducer = (
  prevState: TeamState,
  link: SignedLink,
  index: number,
  chain: SignatureChain
) => {
  const { type, payload } = link.body
  switch (type) {
    case linkType.ROOT: {
      const { teamName } = payload as RootPayload
      return {
        ...prevState,
        name: teamName,
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
  }

  // fallthrough
  // TODO: should we throw an error if we get here?
  return prevState
}
