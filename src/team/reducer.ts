import { SignedLink, SignatureChain } from 'chain'
import { RootLinkPayload, TeamState } from './types'
import { linkType } from './linkType'

export const reducer = (
  prevState: TeamState,
  link: SignedLink,
  index: number,
  chain: SignatureChain
) => {
  const { type, payload } = link.body
  switch (type) {
    case linkType.ROOT: {
      // Create new

      const { name, rootContext } = payload as RootLinkPayload
      return {
        ...prevState,
        name,
        rootContext,
      }
    }

    case linkType.ADD_MEMBER: {
      const nextState = prevState
      // NEXT: ADD A MEMBER
      return nextState
    }
  }

  // fallthrough
  return prevState
}
