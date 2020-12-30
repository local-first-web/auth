import { actionFingerprint } from '/chain/actionFingerprint'
import { bySeniority } from '/chain/bySeniority'
import { baseResolver } from '/chain/getSequence'
import {
  ActionFilter,
  ActionFilterFactory,
  AddMemberAction,
  AddMemberRoleAction,
  Branch,
  LinkBody,
  RemoveMemberAction,
  RemoveMemberRoleAction,
  Resolver,
  TeamAction,
  TeamActionLink,
  TeamSignatureChain,
  TwoBranches,
} from '/chain/types'
import { arraysAreEqual, debug } from '/util'

const log = debug('lf:auth:membershipResolver')

/**
 * This is a custom resolver, used to flatten a graph of team membership operations into a strictly
 * ordered sequence. It mostly applies "strong-remove" rules to resolve tricky situations that can
 * arise with concurrency: mutual removals, duplicate actions, etc.
 */
export const membershipResolver: Resolver<TeamAction> = (heads, chain) => {
  let branches = baseResolver(heads, chain) as TwoBranches

  // Consecutively apply each type of filter to the branches
  for (const key in filterFactories) {
    const makeFilter = filterFactories[key]
    const actionFilter = makeFilter(branches, chain)
    const applyFilterToBranch = (branch: Branch) => branch.filter(actionFilter)
    branches = branches.map(applyFilterToBranch) as TwoBranches
  }

  return branches
}

const filterFactories: Record<string, ActionFilterFactory> = {
  // Deal with mutual and circular removals:
  // - If A removes B and concurrently B removes A, then the *least senior* of the two's actions
  //   will be omitted: so only B will be removed
  // - If A removes B; B removes C; C removes A, then the *least senior* of the three's actions
  //   will be omitted: A will not be removed, B will be removed, and C will not be removed
  //   (because C was removed by B, and B was concurrently removed).
  resolveMutualRemovals: (branches, chain) => {
    const removedMembers = getRemovedUsers(branches)
    const memberRemovers = getRemovals(branches).map(linkAuthor)

    // is this a mutual or circular removal?
    if (removedMembers.length > 0 && arraysAreEqual(removedMembers, memberRemovers)) {
      // figure out which member has been around for the shortest amount of time
      const mostRecentMember = leastSenior(chain, memberRemovers)
      // omit any actions by that member
      return authorIsNot(mostRecentMember)
    }
    // otherwise don't omit anything
    return noFilter
  },

  // If A is removing C, B can't overcome this by concurrently removing C then adding C back
  cantAddBackRemovedMember: (branches) => {
    const removedMembers = getRemovedUsers(branches)
    return addedNotIn(removedMembers)
  },

  // If B is removed, anything they do concurrently is omitted
  cantDoAnythingWhenRemoved: (branches) => {
    const removedMembers = getRemovedUsers(branches)
    return authorNotIn(removedMembers)
  },
}

// Helpers

const leastSenior = (chain: TeamSignatureChain, userNames: string[]) =>
  userNames.sort(bySeniority(chain)).pop()!

const getRemovals = (branches: TwoBranches) => {
  const isRemovalAction = (link: TeamActionLink): boolean =>
    link.body.type === 'REMOVE_MEMBER' || link.body.type === 'REMOVE_MEMBER_ROLE'
  return branches.flatMap((branch) => branch.filter(isRemovalAction))
}

const getRemovedUsers = (branches: TwoBranches) => getRemovals(branches).map(removedUserName)

const removedUserName = (link: TeamActionLink): string => {
  const removalAction = link.body as LinkBody<RemoveMemberAction | RemoveMemberRoleAction>
  return removalAction.payload.userName
}

const linkAuthor = (link: TeamActionLink): string => link.signed.userName

const authorIsNot = (author: string) => (link: TeamActionLink) => linkAuthor(link) !== author

const authorNotIn = (excludeList: string[]) => (link: TeamActionLink): boolean =>
  !excludeList.includes(linkAuthor(link))

const addedNotIn = (excludeList: string[]) => (link: TeamActionLink): boolean => {
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

  if (!isAddAction(link)) return true // only concerned with add actions
  const added = addedUserName(link)
  return !excludeList.includes(added)
}

const noFilter: ActionFilter = (_: any) => true
