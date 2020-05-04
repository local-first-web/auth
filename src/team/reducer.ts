import { SignedLink } from 'chain'
import { RootLinkPayload, TeamState } from './types'
import { linkType } from './linkType'

export const reducer = (prevState: TeamState, link: SignedLink) => {
  const { type, payload } = link.body
  switch (type) {
    case linkType.ROOT: {
      const { name, rootContext } = payload as RootLinkPayload
      return {
        ...prevState,
        name,
        rootContext,
      }
    }

    case linkType.ADD_MEMBER: {
      const nextState = prevState
      // ..
      return nextState
    }
  }

  // fallthrough
  return prevState
}
