import { ADMIN } from '@/role'
import { bySeniority } from '@/team/bySeniority'
import {
  MembershipRuleEnforcer,
  AddMemberAction,
  AddMemberRoleAction,
  RemoveMemberAction,
  RemoveMemberRoleAction,
  TeamAction,
  TeamContext,
  TeamLink,
  TeamSignatureChain,
} from '@/team/types'
import { actionFingerprint } from '@/util'
import { arraysAreEqual } from '@/util/arraysAreEqual'
import { getConcurrentBubbles, Link, LinkBody, Resolver } from 'crdx'
import { isAdminOnlyAction } from './isAdminOnlyAction'

/**
 * This is a custom resolver, used to flatten a graph of team membership operations into a strictly
 * ordered sequence. It mostly applies "strong-remove" rules to resolve tricky situations that can
 * arise with concurrency: mutual removals, duplicate actions, etc.
 */
export const membershipResolver: Resolver<TeamAction, TeamContext> = chain => {
  const pools = getConcurrentBubbles(chain).map(hashes => hashes.map(hash => chain.links[hash]))
  const invalidLinks: TeamLink[] = []
  for (var pool of pools) {
    for (const rule of Object.values(membershipRules)) {
      const invalid = rule(pool, chain)
      invalid.forEach(link => invalidLinks.push(link))
      pool = pool.filter(linkNotIn(invalidLinks))
    }
  }
  return {
    filter: linkNotIn(invalidLinks),
  }
}

const membershipRules: Record<string, MembershipRuleEnforcer> = {
  // TODO: an add->remove->add sequence on one side will result in add->remove, because the two adds are treated as duplicates
  // RULE: no duplicates
  noDuplicates: links => {
    const seen = {} as Record<string, boolean>
    return links.filter(link => {
      const fingerprint = actionFingerprint(link) // string summarizing the link, e.g. `ADD:bob`
      if (seen[fingerprint]) return true
      seen[fingerprint] = true
      return false
    })
  },

  // RULE: mutual and circular removals are resolved by seniority
  // - If A removes B and concurrently B removes A, then the *least senior* of the two's actions
  //   will be omitted: so only B will be removed
  // - If A removes B; B removes C; C removes A, then the *least senior* of the three's actions will
  //   be omitted: A will not be removed, B will be removed, and C will not be removed (because C
  //   was removed by B, and B was concurrently removed).
  //
  // I'd like to actually implement full strong-remove — e.g. remove everyone in a mutual remove
  // scenario — but not sure how to do that, since the reducer won't allow a to remove b after b has
  // removed a.
  resolveMutualRemovals: (links, chain) => {
    const removedMembers = getRemovedAndDemotedMembers(links)
    const memberRemovers = getRemovalsAndDemotions(links).map(getAuthor)

    // is this a mutual or circular removal?
    const isCircularRemoval =
      removedMembers.length > 0 && arraysAreEqual(removedMembers, memberRemovers)
    if (isCircularRemoval) {
      // figure out which member has been around for the shortest amount of time
      const mostRecentMember = leastSenior(chain, memberRemovers)
      // omit any actions by that member
      return links.filter(authorIs(mostRecentMember))
    }
    // otherwise don't omit anything
    return []
  },

  // RULE: If A is removing C, B can't overcome this by concurrently removing C then adding C back
  cantAddBackRemovedMember: links => {
    const removedMembers = getRemovedAndDemotedMembers(links)

    return links
      .filter(isAddAction) //
      .filter(link => {
        const added = addedUserName(link)
        return removedMembers.includes(added)
      })
  },

  // RULE: If B is removed, anything they do concurrently is omitted
  cantDoAnythingWhenRemoved: links => {
    const removedMembers = getRemovedMembers(links)
    return links.filter(authorIn(removedMembers))
  },

  // RULE: If B is demoted, any admin-only actions they do concurrently are omitted
  cantDoAdminActionsWhenDemoted: links => {
    const demotedMembers = getDemotedMembers(links)
    return links.filter(link => {
      const authorNotDemoted = authorNotIn(demotedMembers)
      const notAdminOnly = (link: TeamLink) => !isAdminOnlyAction(link.body)
      return !(authorNotDemoted(link) || notAdminOnly(link))
    })
  },
}

// Helpers

const leastSenior = (chain: TeamSignatureChain, userNames: string[]) =>
  userNames.sort(bySeniority(chain)).pop()!

const isRemovalAction = (link: TeamLink): boolean => link.body.type === 'REMOVE_MEMBER'

const getRemovals = (links: TeamLink[]) => links.filter(isRemovalAction) as RemoveActionLink[]

const isDemotionAction = (link: TeamLink): boolean =>
  link.body.type === 'REMOVE_MEMBER_ROLE' && link.body.payload.roleName === ADMIN

const getDemotions = (links: TeamLink[]) => links.filter(isDemotionAction) as RemoveActionLink[]

const getRemovalsAndDemotions = (links: TeamLink[]) =>
  getRemovals(links).concat(getDemotions(links))

const getRemovedAndDemotedMembers = (links: TeamLink[]) =>
  getRemovalsAndDemotions(links).map(getTarget)

const getRemovedMembers = (links: TeamLink[]) => getRemovals(links).map(getTarget)
const getDemotedMembers = (links: TeamLink[]) => getDemotions(links).map(getTarget)

const getTarget = (link: RemoveActionLink): string => link.body.payload.userName

const getAuthor = (link: TeamLink): string => link.signed.userName

const authorIs = (author: string) => (link: TeamLink) => getAuthor(link) === author

const authorIn =
  (excludeList: string[]) =>
  (link: TeamLink): boolean =>
    excludeList.includes(getAuthor(link))

const authorNotIn =
  (excludeList: string[]) =>
  (link: TeamLink): boolean =>
    !excludeList.includes(getAuthor(link))

const addedUserName = (link: AddActionLink): string => {
  if (link.body.type === 'ADD_MEMBER') {
    const addAction = link.body as LinkBody<AddMemberAction, TeamContext>
    return addAction.payload.member.userName
  } else if (link.body.type === 'ADD_MEMBER_ROLE') {
    const addAction = link.body as LinkBody<AddMemberRoleAction, TeamContext>
    return addAction.payload.userName
  }
  // ignore coverage
  else throw new Error()
}

const addedNotIn =
  (excludeList: string[]) =>
  (link: TeamLink): boolean => {
    if (!isAddAction(link)) return true // only concerned with add actions
    const added = addedUserName(link)
    return !excludeList.includes(added)
  }

const linkNotIn =
  (excludeList: TeamLink[]) =>
  (link: TeamLink): boolean =>
    !excludeList.includes(link)

// type guards

const isAddAction = (link: TeamLink): link is AddActionLink =>
  link.body.type === 'ADD_MEMBER' || link.body.type === 'ADD_MEMBER_ROLE'

type RemoveActionLink = Link<RemoveMemberAction | RemoveMemberRoleAction, TeamContext>
type AddActionLink = Link<AddMemberAction | AddMemberRoleAction, TeamContext>
