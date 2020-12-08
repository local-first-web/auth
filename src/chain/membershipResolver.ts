﻿import { trivialResolver } from './trivialResolver'
import { actionFingerprint } from '/chain/actionFingerprint'
import { getAllNodes } from '/chain/getAllNodes'
import { getCommonPredecessor } from '/chain/predecessors'
import {
  AddMemberAction,
  AddMemberRoleAction,
  isMergeLink,
  LinkBody,
  NonRootLinkBody,
  RemoveMemberAction,
  RemoveMemberRoleAction,
  Resolver,
  RootLink,
  Sequence,
  TeamAction,
  TeamActionLink,
  TeamLink,
  TeamSignatureChain,
} from '/chain/types'
import { debug, Hash } from '/util'

// TODO: This also needs to deal with members added by invitation

const log = debug('taco:membershipResolver')

export const membershipResolver: Resolver<TeamAction> = ([a, b], chain) => {
  const baseResolver = trivialResolver as Resolver<TeamAction>
  const [branchA, branchB] = baseResolver([a, b], chain)

  // // handle special case: members deleting each other concurrently
  // sequence = resolveMutualDeletions(sequence, chain)

  // // removed members can't concurrently do other things, nor can they be added back concurrently
  // const removedMembers = sequence.filter(isRemovalAction).map(removedUserName)

  // return sequence
  //   .filter(linkNotIn(getDuplicates(sequence))) // when actions are duplicated in a sequence, only the first is kept
  //   .filter(authorNotIn(removedMembers)) // removed members can't concurrently make membership changes
  //   .filter(addedNotIn(removedMembers)) // removed members can't be concurrently added back

  return [branchA, branchB]
}

// helpers

const arraysAreEqual = (a: string[], b: string[]) => {
  const normalize = (arr: string[]) => arr.sort().join(',')
  return normalize(a) === normalize(b)
}

const getDuplicates = (sequence: TeamActionLink[]) => {
  // TODO: an add->remove->add sequence on one side will result in add->remove, because the two adds
  // are treated as duplicates

  const distinctActions = {} as Record<string, Hash>
  return sequence.filter(link => {
    const { hash } = link
    const fingerprint = actionFingerprint(link)
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

const linkAuthor = (link: TeamActionLink): string => link.signed.userName

const linkNotIn = (excludeList: TeamActionLink[]) => (link: TeamActionLink): boolean =>
  !excludeList.includes(link)

const authorNotIn = (excludeList: string[]) => (link: TeamActionLink): boolean =>
  !excludeList.includes(linkAuthor(link))

const addedNotIn = (excludeList: string[]) => (link: TeamActionLink): boolean => {
  if (!isAddAction(link)) return true // only concerned with add actions
  const added = addedUserName(link)
  return !excludeList.includes(added)
}

// members removing each other
const resolveMutualDeletions = (sequence: TeamActionLink[], chain: TeamSignatureChain) => {
  const removals = sequence.filter(isRemovalAction)
  const removedMembers = removals.map(removedUserName)
  const memberRemovers = removals.map(linkAuthor)

  console.log({ removedMembers, memberRemovers })
  if (removedMembers.length > 1 && arraysAreEqual(removedMembers, memberRemovers)) {
    // figure out which member has been around for the shortest amount of time
    const removedMembersBySeniority = removedMembers.sort(bySeniority(chain))
    const mostRecentMember = removedMembersBySeniority.pop()!
    console.log({ mostRecentMember })
    return sequence.filter(authorNotIn([mostRecentMember]))
  } else {
    return sequence
  }
}

const bySeniority = (chain: TeamSignatureChain) => (userNameA: string, userNameB: string) => {
  const rootLink = chain.links[chain.root] as RootLink<TeamAction>

  // if one of these created the chain, they win
  if (rootLink.signed.userName === userNameA) return -1
  if (rootLink.signed.userName === userNameB) return 1

  const findLinkThatAddedMember = (userName: string) =>
    Object.values(chain.links).find(
      link =>
        !isMergeLink(link) &&
        link.body.type === 'ADD_MEMBER' &&
        link.body.payload.member.userName === userName
    )

  const getTimestamp = (userName: string) => {
    const addLink = findLinkThatAddedMember(userName)!.body as NonRootLinkBody<AddMemberAction>
    return addLink.timestamp
  }

  // otherwise go by timestamp

  // TODO: would be better to do this by causal order if possible, but we can't naively rely on
  // getSequence because it uses this resolver so that would be circular. But we could use
  // getSequence with the trivial resolver, which will give us the causal sequence without

  return getTimestamp(userNameA) - getTimestamp(userNameB)
}
