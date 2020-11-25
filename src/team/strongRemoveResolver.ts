import { arbitraryDeterministicSort } from '/chain/arbitraryDeterministicSort'
import { LinkBody, Resolver } from '/chain/types'
import {
  AddMemberAction,
  AddMemberRoleAction,
  RemoveMemberAction,
  RemoveMemberRoleAction,
  TeamAction,
  TeamActionLink,
} from '/team/types'
import { Hash } from '/util'

export const strongRemoveResolver: Resolver<TeamAction> = (a = [], b = []) => {
  const [_a, _b] = [a, b].sort(arbitraryDeterministicSort()) // ensure predictable order

  const sequence = _a.concat(_b)

  const removedMembers = sequence.filter(isRemovalAction).map(removedUserName)

  // TODO: handle two people removing each other

  return sequence
    .filter(linkNotIn(getDuplicates(sequence))) // when actions are duplicated in a sequence, only the first is kept
    .filter(authorNotIn(removedMembers)) // removed members can't concurrently make membership changes
    .filter(addedNotIn(removedMembers)) // removed members can't be concurrently added back
}

// helpers

const getDuplicates = (sequence: TeamActionLink[]) => {
  const distinctActions = {} as Record<string, Hash>
  return sequence.filter(link => {
    const { hash } = link
    const fingerprint = getFingerprint(link)

    if (!(fingerprint in distinctActions)) {
      distinctActions[fingerprint] = hash
      return false
    } else {
      return true
    }
  })
}

const isRemovalAction = (link: TeamActionLink): boolean =>
  link.body.type === 'REMOVE_MEMBER' || link.body.type === 'REMOVE_MEMBER_ROLE'

const removedUserName = (link: TeamActionLink): string => {
  const removalAction = link.body as LinkBody<RemoveMemberAction | RemoveMemberRoleAction>
  return removalAction.payload.userName
}

const isAddAction = (link: TeamActionLink): boolean =>
  link.body.type === 'ADD_MEMBER' || link.body.type === 'ADD_MEMBER_ROLE'

const addedUserName = (link: TeamActionLink): string => {
  if (link.body.type === 'ADD_MEMBER') {
    const addAction = link.body as LinkBody<AddMemberAction>
    return addAction.payload.member.userName
  } else if (link.body.type === 'ADD_MEMBER_ROLE') {
    const addAction = link.body as LinkBody<AddMemberRoleAction>
    return addAction.payload.userName
  } else {
    throw new Error()
  }
}

const linkNotIn = (excludeList: TeamActionLink[]) => (link: TeamActionLink): boolean =>
  !excludeList.includes(link)

const authorNotIn = (excludeList: string[]) => (link: TeamActionLink): boolean => {
  const linkAuthor = link.signed.userName
  return !excludeList.includes(linkAuthor)
}

const addedNotIn = (excludeList: string[]) => (link: TeamActionLink): boolean => {
  if (!isAddAction(link)) return true // only concerned with add actions
  const added = addedUserName(link)
  return !excludeList.includes(added)
}
function getFingerprint(link: TeamActionLink) {
  const { body } = link
  const { type, payload } = body
  return JSON.stringify({ type, payload })
}
