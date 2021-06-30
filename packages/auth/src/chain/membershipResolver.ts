import { bySeniority } from '@/chain/bySeniority'
import { baseResolver } from '@/chain/getSequence'
import {
  ActionFilter,
  ActionFilterFactory,
  ActionLink,
  AddMemberAction,
  AddMemberRoleAction,
  Branch,
  Link,
  LinkBody,
  RemoveMemberAction,
  RemoveMemberRoleAction,
  Resolver,
  TeamAction,
  TeamActionLink,
  TeamSignatureChain,
  TwoBranches,
} from '@/chain/types'
import { ADMIN } from '@/role'
import { isAdminOnlyAction } from './isAdminOnlyAction'
import { arraysAreEqual, debug } from '@/util'

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
    const filter = makeFilter(branches, chain)
    const applyFilterToBranch = (branch: Branch) => branch.filter(filter)
    branches = branches.map(applyFilterToBranch) as TwoBranches
  }

  return branches
}

const filterFactories: Record<string, ActionFilterFactory> = {
  // RULE: mutual and circular removals are resolved by seniority
  // - If A removes B and concurrently B removes A, then the *least senior* of the two's actions
  //   will be omitted: so only B will be removed
  // - If A removes B; B removes C; C removes A, then the *least senior* of the three's actions
  //   will be omitted: A will not be removed, B will be removed, and C will not be removed
  //   (because C was removed by B, and B was concurrently removed).
  resolveMutualRemovals: (branches, chain) => {
    const removedMembers = getRemovedAndDemotedMembers(branches)
    const memberRemovers = getRemovalsAndDemotions(branches).map(getAuthor)

    // is this a mutual or circular removal?
    const isCircularRemoval =
      removedMembers.length > 0 && arraysAreEqual(removedMembers, memberRemovers)
    if (isCircularRemoval) {
      // figure out which member has been around for the shortest amount of time
      const mostRecentMember = leastSenior(chain, memberRemovers)
      // omit any actions by that member
      return authorIsNot(mostRecentMember)
    }
    // otherwise don't omit anything
    return noFilter
  },

  // RULE: If A is removing C, B can't overcome this by concurrently removing C then adding C back
  cantAddBackRemovedMember: branches => {
    const removedMembers = getRemovedAndDemotedMembers(branches)
    return addedNotIn(removedMembers)
  },

  // RULE: If B is removed, anything they do concurrently is omitted
  cantDoAnythingWhenRemoved: branches => {
    const removedMembers = getRemovedMembers(branches)
    return authorNotIn(removedMembers)
  },

  // RULE: If B is demoted, any admin-only actions they do concurrently are omitted
  cantDoAdminActionsWhenDemoted: branches => {
    const demotedMembers = getDemotedMembers(branches)
    return (link: TeamActionLink) => {
      const authorNotDemoted = authorNotIn(demotedMembers)
      const notAdminOnly = (link: TeamActionLink) => !isAdminOnlyAction(link.body)
      return authorNotDemoted(link) || notAdminOnly(link)
    }
  },
}

// Helpers

const leastSenior = (chain: TeamSignatureChain, userNames: string[]) =>
  userNames.sort(bySeniority(chain)).pop()!

const isRemovalAction = (link: TeamActionLink): boolean => link.body.type === 'REMOVE_MEMBER'

const getRemovals = (branches: TwoBranches) =>
  branches.flatMap(branch => branch.filter(isRemovalAction)) as RemoveActionLink[]

const isDemotionAction = (link: TeamActionLink): boolean =>
  link.body.type === 'REMOVE_MEMBER_ROLE' && link.body.payload.roleName === ADMIN

const getDemotions = (branches: TwoBranches) =>
  branches.flatMap(branch => branch.filter(isDemotionAction)) as RemoveActionLink[]

const getRemovalsAndDemotions = (branches: TwoBranches) =>
  getRemovals(branches).concat(getDemotions(branches))

const getRemovedAndDemotedMembers = (branches: TwoBranches) =>
  getRemovalsAndDemotions(branches).map(getTarget)

const getRemovedMembers = (branches: TwoBranches) => getRemovals(branches).map(getTarget)
const getDemotedMembers = (branches: TwoBranches) => getDemotions(branches).map(getTarget)

const getTarget = (link: RemoveActionLink): string => link.body.payload.userName

const getAuthor = (link: TeamActionLink): string => link.signed.userName

const authorIsNot = (author: string) => (link: TeamActionLink) => getAuthor(link) !== author

const authorNotIn =
  (excludeList: string[]) =>
  (link: TeamActionLink): boolean =>
    !excludeList.includes(getAuthor(link))

const addedNotIn =
  (excludeList: string[]) =>
  (link: TeamActionLink): boolean => {
    const addedUserName = (link: AddActionLink): string => {
      if (link.body.type === 'ADD_MEMBER') {
        const addAction = link.body as LinkBody<AddMemberAction>
        return addAction.payload.member.userName
      } else if (link.body.type === 'ADD_MEMBER_ROLE') {
        const addAction = link.body as LinkBody<AddMemberRoleAction>
        return addAction.payload.userName
      }
      // ignore coverage
      else throw new Error()
    }

    if (!isAddAction(link)) return true // only concerned with add actions
    const added = addedUserName(link)
    return !excludeList.includes(added)
  }

const noFilter: ActionFilter = (_: any) => true

// type guards

const isAddAction = (link: TeamActionLink): link is AddActionLink =>
  link.body.type === 'ADD_MEMBER' || link.body.type === 'ADD_MEMBER_ROLE'

type RemoveActionLink = ActionLink<RemoveMemberAction | RemoveMemberRoleAction>
type AddActionLink = ActionLink<AddMemberAction | AddMemberRoleAction>
