import { actionFingerprint } from '/chain/actionFingerprint'
import { arbitraryDeterministicSort } from '/chain/arbitraryDeterministicSort'
import { baseResolver } from '/chain/getSequence'
import { bySeniority } from '/chain/bySeniority'
import {
  AddMemberAction,
  AddMemberRoleAction,
  LinkBody,
  RemoveMemberAction,
  RemoveMemberRoleAction,
  Resolver,
  Sequence,
  TeamAction,
  TeamActionLink,
  TeamSignatureChain,
} from '/chain/types'
import { arraysAreEqual, debug } from '/util'

const log = debug('lf:auth:membershipResolver')

// TODO: This also needs to deal with members added by invitation

// TODO: an add->remove->add sequence on one side will result in add->remove, because the two adds
// are treated as duplicates

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
  cantAddBackRemovedMember: branches => {
    const removedMembers = getRemovedUsers(branches)
    return addedNotIn(removedMembers)
  },

  // If B is removed, anything they do concurrently is omitted
  cantDoAnythingWhenRemoved: branches => {
    const removedMembers = getRemovedUsers(branches)
    return authorNotIn(removedMembers)
  },

  // If A and B do the same thing (e.g. concurrently add the same member), we only keep one of the
  // actions (but always the same one)
  omitDuplicates: branches => {
    // ensure that everyone will do this the same order, but no one can game it
    const [a, b] = branches.sort(arbitraryDeterministicSort())
    // only keep the first copy we see of any duplicate actions
    const duplicates = getDuplicates(a.concat(b))
    // log([a, b, duplicates].map(b => b.map(actionFingerprint)))
    return linkNotIn(duplicates)
  },
}

// Helpers

const leastSenior = (chain: TeamSignatureChain, userNames: string[]) =>
  userNames.sort(bySeniority(chain)).pop()!

const getDuplicates = (b: Sequence<TeamAction>): Sequence<TeamAction> => {
  const seen = {} as Record<string, boolean>
  return b.filter(link => {
    const fingerprint = actionFingerprint(link) // string summarizing the link, e.g. `ADD:bob`
    if (seen[fingerprint]) return true
    seen[fingerprint] = true
    return false
  })
}

const getRemovals = (branches: TwoBranches) => {
  const isRemovalAction = (link: TeamActionLink): boolean =>
    link.body.type === 'REMOVE_MEMBER' || link.body.type === 'REMOVE_MEMBER_ROLE'
  return branches.flatMap(branch => branch.filter(isRemovalAction))
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

const linkNotIn = (excludeList: TeamActionLink[]) => (link: TeamActionLink): boolean =>
  !excludeList.includes(link)

const noFilter: ActionFilter = (_: any) => true

type Branch = Sequence<TeamAction>
type TwoBranches = [Branch, Branch]
type ActionFilter = (link: TeamActionLink) => boolean
type ActionFilterFactory = (branches: TwoBranches, chain: TeamSignatureChain) => ActionFilter
