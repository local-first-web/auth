import { isMergeLink, RootLink, TeamAction, TeamLink, TeamSignatureChain } from '@/chain/types'
import { isPredecessor } from './predecessors'

export const bySeniority = (chain: TeamSignatureChain) => (a: string, b: string) => {
  // if one of these created the chain, they win
  if (isFounder(chain, a)) return -1
  if (isFounder(chain, b)) return 1

  const linkThatAddedMember = (userName: string) => {
    const addedMember = (link: TeamLink) =>
      !isMergeLink(link) &&
      link.body.type === 'ADD_MEMBER' &&
      link.body.payload.member.userName === userName
    return Object.values(chain.links).find(addedMember)
  }
  const [addedA, addedB] = [a, b].map(linkThatAddedMember)

  // if A was added first, A comes first in the sort
  if (isPredecessor(chain, addedA!, addedB!)) return -1
  else return 1
}
const isFounder = (chain: TeamSignatureChain, userName: string) => {
  const rootLink = chain.links[chain.root] as RootLink<TeamAction>
  return rootLink.signed.userName === userName
}
