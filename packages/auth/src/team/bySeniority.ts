import { isPredecessor } from '@localfirst/crdx'
import { type TeamGraph, type TeamLink } from 'team/types.js'
import { assert } from '../util/index.js'

export const bySeniority = (chain: TeamGraph) => (a: string, b: string) => {
  // If one of these created the chain, they win
  if (isFounder(chain, a)) {
    return -1
  }

  if (isFounder(chain, b)) {
    return 1
  }

  const linkThatAddedMember = (userId: string) => {
    const addedMember = (link: TeamLink) =>
      link.body.type === 'ADD_MEMBER' && link.body.payload.member.userId === userId
    const result = Object.values(chain.links).find(addedMember)
    assert(result, `Could not find link that added member ${userId}`)
    return result
  }

  const [addedA, addedB] = [a, b].map(linkThatAddedMember)

  // if A was added first, A comes first in the sort
  if (isPredecessor(chain, addedA, addedB)) return -1
  return 1
}

const isFounder = (chain: TeamGraph, userId: string) => {
  const rootLink = chain.links[chain.root]
  return rootLink.body.userId === userId
}
