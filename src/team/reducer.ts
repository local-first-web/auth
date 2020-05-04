import { TeamState, RootLinkPayload } from './types'
import { SignedLink } from 'chain'

export const reducer = (prevState: TeamState, link: SignedLink) => {
  const { type, payload } = link.body
  switch (type) {
    case 'ROOT': {
      const { name } = payload as RootLinkPayload
      const nextState = {
        ...prevState,
        name,
      }
      return nextState
    }

    case 'ADD_MEMBER': {
      const nextState = prevState
      // ..
      return nextState
    }
  }
  return prevState
}
