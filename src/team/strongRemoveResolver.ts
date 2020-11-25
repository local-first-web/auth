import { arbitraryDeterministicSort } from '/chain/arbitraryDeterministicSort'
import { LinkBody, Resolver } from '/chain/types'
import { RemoveMemberAction, RemoveMemberRoleAction, TeamAction } from '/team/types'

export const strongRemoveResolver: Resolver<TeamAction> = (a = [], b = []) => {
  const [_a, _b] = [a, b].sort(arbitraryDeterministicSort()) // ensure predictable order

  const sequence = _a.concat(_b)

  // omit any actions created by members who were removed/demoted in the same sequence
  const removedMembers = sequence
    .filter(link => link.body.type === 'REMOVE_MEMBER' || link.body.type === 'REMOVE_MEMBER_ROLE')
    .map(link => link.body as LinkBody<RemoveMemberAction | RemoveMemberRoleAction>)
    .map(linkBody => linkBody.payload.userName)

  const filteredSequence = sequence.filter(link => {
    const linkAuthor = link.signed.userName
    return !removedMembers.includes(linkAuthor)
  })

  return filteredSequence
}
