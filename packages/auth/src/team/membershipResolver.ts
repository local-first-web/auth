import { Invitation } from '@/invitation'
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
import { arraysAreEqual } from '@/util/arraysAreEqual'
import { getConcurrentBubbles, Link, LinkBody, Resolver } from 'crdx'
import { isAdminOnlyAction } from './isAdminOnlyAction'

/**
 * This is a custom resolver, used to flatten a graph of team membership operations into a strictly
 * ordered sequence. It mostly applies "strong-remove" rules to resolve tricky situations that can
 * arise with concurrency: actions done while being removed, mutual removals, etc.
 */
export const membershipResolver: Resolver<TeamAction, TeamContext> = chain => {
  const bubbles = getConcurrentBubbles(chain).map(hashes => hashes.map(hash => chain.links[hash]))
  const invalidLinks: TeamLink[] = []
  for (var bubble of bubbles) {
    for (const ruleName in membershipRules) {
      // apply this rule to find any links that need to be invalidated
      const rule = membershipRules[ruleName]
      const invalidLinksByThisRule = rule(bubble, chain)

      // expand this list to include any links that depend on invalid links we've already found
      const alsoInvalid = invalidLinksByThisRule.flatMap(link => findDependentLinks(bubble, link))
      invalidLinks.push(...invalidLinksByThisRule, ...alsoInvalid)

      bubble = bubble.filter(linkNotIn(invalidLinks))
    }
  }
  return {
    filter: linkNotIn(invalidLinks),
  }
}

/**
 * If we invalidate a link, we need to invalidate all links that depend on it. For example, if
 * someone joins the group but their invitation turns out to be invalid, then anything they do needs
 * to be invalidated, including if _they_ invited someone else — and so on recursively.
 */
const findDependentLinks = (bubble: TeamLink[], invalidLink: TeamLink): TeamLink[] => {
  const dependentLinks = [] as TeamLink[]
  switch (invalidLink.body.type) {
    case 'INVITE_MEMBER':
    case 'INVITE_DEVICE':
      // invalidate ADMIT actions that used this invitation
      const { invitation } = invalidLink.body.payload
      dependentLinks.push(...bubble.filter(usesInvitation(invitation)))
      break

    case 'ADMIT_MEMBER':
      // invalidate anything the admitted member did
      const userName = invalidLink.body.payload.memberKeys.name
      dependentLinks.push(...bubble.filter(authorIs(userName)))
      break

    default:
      break
  }

  // recursively find any links that depend on the ones we've just found to be invalid
  const alsoInvalid = dependentLinks.flatMap(l => findDependentLinks(bubble, l))
  return dependentLinks.concat(alsoInvalid)
}

const membershipRules: Record<string, MembershipRuleEnforcer> = {
  // RULE: mutual and circular removals are resolved by seniority
  //
  // I'd like to actually implement full strong-remove — e.g. remove everyone in a mutual remove
  // scenario — but not sure how to do that, since the reducer won't allow a to remove b after b has
  // removed a.
  resolveMutualRemovals: (links, chain) => {
    const removed = getRemovedAndDemotedMembers(links)
    const removers = getRemovalsAndDemotions(links).map(getAuthor)

    // is this a mutual/circular removal?
    const isCircularRemoval = removed.length > 0 && arraysAreEqual(removed, removers)
    if (!isCircularRemoval) return []

    // find the least senior member and omit their actions
    return links.filter(authorIs(leastSenior(chain, removers)))
  },

  // RULE: If A is removing C, B can't overcome this by concurrently removing C then adding C back
  cantAddBackRemovedMember: links => {
    const removedMembers = getRemovedAndDemotedMembers(links)
    return getAdditions(links).filter(link => removedMembers.includes(addedUserName(link)))
  },

  // RULE: If B is removed, anything they do concurrently is omitted
  cantDoAnythingWhenRemoved: links => {
    const removedMembers = getRemovedMembers(links)
    return links.filter(authorIn(removedMembers))
  },

  // RULE: If B is demoted, any admin-only actions they do concurrently are omitted
  cantDoAdminActionsWhenDemoted: links => {
    const demotedMembers = getDemotedMembers(links)
    const authorDemoted = authorIn(demotedMembers)
    const isAdminOnly = (link: TeamLink) => isAdminOnlyAction(link.body)
    return links.filter(link => authorDemoted(link) && isAdminOnly(link))
  },
}

// Helpers

const leastSenior = (chain: TeamSignatureChain, userNames: string[]) =>
  userNames.sort(bySeniority(chain)).pop()!

const isAddAction = (link: TeamLink): link is AddActionLink =>
  link.body.type === 'ADD_MEMBER' || link.body.type === 'ADD_MEMBER_ROLE'

const isRemovalAction = (link: TeamLink): boolean => link.body.type === 'REMOVE_MEMBER'

const getAdditions = (links: TeamLink[]) => links.filter(isAddAction) as AddActionLink[]

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

const linkNotIn =
  (excludeList: TeamLink[]) =>
  (link: TeamLink): boolean =>
    !excludeList.includes(link)

const usesInvitation = (invitation: Invitation) => (l: TeamLink) =>
  (l.body.type === 'ADMIT_MEMBER' || l.body.type === 'ADMIT_DEVICE') &&
  l.body.payload.id === invitation.id

type RemoveActionLink = Link<RemoveMemberAction | RemoveMemberRoleAction, TeamContext>
type AddActionLink = Link<AddMemberAction | AddMemberRoleAction, TeamContext>
