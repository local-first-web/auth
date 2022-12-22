import { TeamContext, TeamLink, TeamGraph } from '@/team/types'
import { isPredecessor } from 'crdx'

export const bySeniority = (chain: TeamGraph) => (a: string, b: string) => {
  // if one of these created the chain, they win
  if (isFounder(chain, a)) return -1
  if (isFounder(chain, b)) return 1

  const linkThatAddedMember = (userId: string) => {
    const addedMember = (link: TeamLink) =>
      link.body.type === 'ADD_MEMBER' && link.body.payload.member.userId === userId
    return Object.values(chain.links).find(addedMember)
  }
  const [addedA, addedB] = [a, b].map(linkThatAddedMember)

  // if A was added first, A comes first in the sort
  if (isPredecessor(chain, addedA!, addedB!)) return -1
  else return 1
}
const isFounder = (chain: TeamGraph, userId: string) => {
  const rootLink = chain.links[chain.root]
  return rootLink.body.userId === userId
}
