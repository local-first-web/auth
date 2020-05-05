import { SignatureChain, SignedLink } from 'chain'
import { linkType } from './linkType'
import { Member, RootLinkPayload, TeamState } from './types'

export const reducer = (
  prevState: TeamState,
  link: SignedLink,
  index: number,
  chain: SignatureChain
) => {
  const { type, payload } = link.body
  switch (type) {
    case linkType.ROOT: {
      const { name, rootContext } = payload as RootLinkPayload
      const rootUser = {
        ...rootContext.user,
        roles: ['admin'],
      } as Member

      return {
        ...prevState,
        name,
        members: [rootUser],
        roles: ['admin'],
      }
    }

    // NEXT: ADD A MEMBER
    case linkType.ADD_MEMBER: {
      const nextState = prevState
      return nextState
    }
  }

  // fallthrough
  // TODO: should we throw an error if nothing happens here?
  return prevState
}
