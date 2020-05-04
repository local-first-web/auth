import { TeamState, RootLinkPayload, LinkType } from './types'
import { SignedLink } from 'chain'

export const reducer = (prevState: TeamState, link: SignedLink) => {
  const { type, payload } = link.body
  switch (type) {
    case LinkType.ROOT: {
      const { name, rootContext } = payload as RootLinkPayload
      return {
        ...prevState,
        name,
        rootContext,
      }
    }

    case LinkType.ADD_MEMBER: {
      const nextState = prevState
      // ..
      return nextState
    }
  }

  // fallthrough
  return prevState
}
