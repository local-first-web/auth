import { ROOT } from '@localfirst/crdx'
import { type TeamAction, type TeamGraph, type TeamLinkMap } from './types.js'

/**
 * Nothing at all, in either of the spellings that reach a peer.
 *
 * A field left off a payload arrives as `undefined`, but one explicitly set to `null` survives the
 * round trip as `null` — so a guard that only knows `undefined` isn't a guard. Every default in
 * this codebase is written `= []` or `= {}`, and those only catch `undefined`.
 */
export const isMissing = (value: unknown) => value === undefined || value === null

/**
 * An identifier that something can actually be filed under: a non-empty string.
 *
 * Nothing about a keyset or a payload requires an identifier to be there, and every check that goes
 * by one reads as satisfied when it's missing on both sides — `undefined !== undefined` is false,
 * and the record of whom an invitation has admitted can't recognize whom it admitted.
 */
export const isUsableIdentifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

/**
 * An optional array field that arrived as something other than an array.
 *
 * `undefined` is what a link that carries none of these looks like, and that's what `= []` is for.
 * `null` is not that: it satisfies neither the default nor `Array.isArray`, so it reaches
 * `lockboxes.find` and `roles.map` intact.
 */
const isNotAnArray = (value: unknown) => value !== undefined && !Array.isArray(value)

/**
 * What's wrong with the shape of this action's payload, or `undefined` if nothing is.
 *
 * The payload types describe what honest code produces, but a link can be authored directly with
 * anything at all on it — or with anything at all left off. Everything downstream takes the payload
 * apart: the validators (`payload.device.userId`, `payload.keys.name`), the reducer, and the
 * transforms (`lockboxes.find`, `roles.map`, `newServer.host`). A field that didn't arrive turns
 * any of those into a TypeError thrown in the middle of replaying the chain — paid by every peer,
 * forever, rather than a refusal.
 *
 * So this describes, for every action type, every field anything downstream dereferences, plus the
 * identifiers the team is indexed by. Two things make that claim keepable rather than a list we
 * extend each time someone finds a gap:
 *
 * - the switch is exhaustive over `TeamAction`, so a new action type won't compile until its
 *   payload is described here
 * - this function itself dereferences nothing it hasn't just checked, so it can't fail the way it
 *   exists to prevent
 *
 * Two fields are deliberately left to another rule, because that rule has to look at them anyway
 * and does so before the reducer runs: the identity an admission names (`memberKeys.name`,
 * `device.deviceId`) is bound to the proof of invitation by `admissionMustBeProven`.
 *
 * It's used in two places. `payloadsMustBeWellFormed` applies it to links as they're replayed,
 * which is what makes a peer's refusal independent of who sent it. `Team.dispatch` applies it
 * before handing anything to the store, because a link is appended to the graph before the reducer
 * ever sees it — so a payload caught only on replay would leave a link that nobody, including its
 * author, can ever replay again.
 */
export const payloadProblem = (action: TeamAction): string | undefined => {
  /** Something a link of this type has to carry, and this one didn't */
  const has = (what: string) => `This ${action.type} link has to carry ${what}.`

  /** Something the team is indexed by, which can't be used as an identifier */
  const usable = (identifier: string, value: unknown) =>
    `This ${action.type} link needs a usable ${identifier}, and '${String(value)}' is not one.`

  // Nothing below can look at a field until we know there's a payload for it to be on
  const { payload } = action
  if (isMissing(payload) || typeof payload !== 'object') return has('a payload')

  // Whatever its type, a link's lockboxes are collected, and several rules walk them. `= []`
  // catches a payload that carries none; it doesn't catch one that carries `null`.
  const { lockboxes } = payload as { lockboxes?: unknown }
  if (isNotAnArray(lockboxes)) return has('its lockboxes as an array')
  if (Array.isArray(lockboxes)) {
    // Being an array isn't enough: `collectLockboxes` concatenates the ELEMENTS into
    // `state.lockboxes`, where every later link's rules destructure them — so one bad element
    // outlives the link that carried it and breaks everything downstream of it.
    for (const [index, lockbox] of lockboxes.entries()) {
      const problem = lockboxProblem(lockbox)
      if (problem !== undefined)
        return `${has(`lockboxes it can use`).slice(0, -1)}: lockbox ${index} ${problem}.`
    }
  }

  switch (action.type) {
    case ROOT: {
      const { rootMember, rootDevice } = action.payload
      if (isMissing(rootMember)) return has('a founding member')
      if (isMissing(rootMember.keys)) return has("the founding member's keys")
      if (!isUsableIdentifier(rootMember.userId)) return usable('userId', rootMember.userId)
      if (!isUsableIdentifier(rootMember.userName)) return usable('userName', rootMember.userName)
      if (isMissing(rootDevice)) return has('a founding device')
      if (isMissing(rootDevice.keys)) return has("the founding device's keys")
      if (!isUsableIdentifier(rootDevice.deviceId)) return usable('deviceId', rootDevice.deviceId)
      if (!isUsableIdentifier(rootDevice.userId)) return usable('userId', rootDevice.userId)
      return undefined
    }

    case 'ADD_MEMBER': {
      const { member, roles } = action.payload
      if (isMissing(member)) return has('a member')
      if (isMissing(member.keys)) return has("the member's keys")
      if (!isUsableIdentifier(member.userId)) return usable('userId', member.userId)
      if (!isUsableIdentifier(member.userName)) return usable('userName', member.userName)
      if (isNotAnArray(roles)) return has('its roles as an array')
      if (Array.isArray(roles) && !roles.every(isUsableIdentifier))
        return has('roles that are all usable role names')
      return undefined
    }

    case 'ADD_DEVICE': {
      const { device } = action.payload
      if (isMissing(device)) return has('a device')
      if (isMissing(device.keys)) return has("the device's keys")
      if (!isUsableIdentifier(device.deviceId)) return usable('deviceId', device.deviceId)
      if (!isUsableIdentifier(device.userId)) return usable('userId', device.userId)
      return undefined
    }

    case 'ADD_ROLE': {
      const { roleName } = action.payload
      if (!isUsableIdentifier(roleName)) return usable('roleName', roleName)
      return undefined
    }

    case 'ADD_MEMBER_ROLE':
    case 'REMOVE_MEMBER_ROLE': {
      const { userId, roleName } = action.payload
      if (!isUsableIdentifier(userId)) return usable('userId', userId)
      if (!isUsableIdentifier(roleName)) return usable('roleName', roleName)
      return undefined
    }

    case 'REMOVE_MEMBER':
    case 'ROTATE_KEYS': {
      const { userId } = action.payload
      if (!isUsableIdentifier(userId)) return usable('userId', userId)
      return undefined
    }

    case 'REMOVE_DEVICE': {
      const { deviceId } = action.payload
      if (!isUsableIdentifier(deviceId)) return usable('deviceId', deviceId)
      return undefined
    }

    case 'REMOVE_ROLE': {
      const { roleName } = action.payload
      if (!isUsableIdentifier(roleName)) return usable('roleName', roleName)
      return undefined
    }

    case 'INVITE_MEMBER':
    case 'INVITE_DEVICE': {
      const { invitation } = action.payload
      if (isMissing(invitation)) return has('an invitation')
      if (!isUsableIdentifier(invitation.id)) return usable('invitation id', invitation.id)
      return undefined
    }

    case 'REVOKE_INVITATION': {
      const { id } = action.payload
      if (!isUsableIdentifier(id)) return usable('invitation id', id)
      return undefined
    }

    case 'ADMIT_MEMBER': {
      // The identity being admitted (`memberKeys.name`) is `admissionMustBeProven`'s, which binds
      // it to the proof of invitation before the reducer reads it
      const { id, memberKeys, userName } = action.payload
      if (!isUsableIdentifier(id)) return usable('invitation id', id)
      if (isMissing(memberKeys)) return has("the member's keys")
      if (!isUsableIdentifier(userName)) return usable('userName', userName)
      return undefined
    }

    case 'ADMIT_DEVICE': {
      // Likewise the device's own identifiers: `admissionMustBeProven` binds `deviceId` to the
      // proof, and `userId` to the member the invitation was issued for
      const { id, device } = action.payload
      if (!isUsableIdentifier(id)) return usable('invitation id', id)
      if (isMissing(device)) return has('a device')
      if (isMissing(device.keys)) return has("the device's keys")
      return undefined
    }

    case 'CHANGE_MEMBER_KEYS': {
      const { keys } = action.payload
      if (isMissing(keys)) return has('a keyset')
      if (!isUsableIdentifier(keys.name)) return usable('keyset name', keys.name)
      return undefined
    }

    case 'ADD_SERVER': {
      const { server } = action.payload
      if (isMissing(server)) return has('a server')
      if (isMissing(server.keys)) return has("the server's keys")
      if (!isUsableIdentifier(server.host)) return usable('host', server.host)
      return undefined
    }

    case 'REMOVE_SERVER': {
      const { host } = action.payload
      if (!isUsableIdentifier(host)) return usable('host', host)
      return undefined
    }

    // Nothing takes these payloads apart: the message and the team name are stored as they arrive
    case 'MESSAGE':
    case 'SET_TEAM_NAME': {
      return undefined
    }

    default: {
      // Exhaustive: a new action type won't compile until its payload is described above
      const unhandled: never = action
      return `Unrecognized link type '${String((unhandled as TeamAction).type)}'.`
    }
  }
}

/**
 * What's wrong with the shape of this lockbox, or `undefined` if nothing is.
 *
 * A lockbox is not read by the link that carries it. `collectLockboxes` puts it in
 * `state.lockboxes`, and from then on every link's rules walk that list —
 * `registeredEncryptionKeys` reads both manifests to decide whether a link's author is who it says,
 * `lockboxesInScope` and `removeRole` filter on them, `removeDevice` looks for one addressed to the
 * departing device. So an element that can't be destructured isn't a problem for one link; it's a
 * problem for every link that comes after it.
 *
 * `generation` is deliberately not required: it's only ever compared or added to, so a missing one
 * makes a lockbox that never matches rather than one that throws.
 */
const lockboxProblem = (lockbox: unknown): string | undefined => {
  if (isMissing(lockbox) || typeof lockbox !== 'object') return 'is not a lockbox'

  const { contents, recipient, encryptionKey, encryptedPayload } = lockbox as Record<string, any>
  for (const [name, manifest] of [
    ['contents', contents],
    ['recipient', recipient],
  ] as const) {
    if (isMissing(manifest) || typeof manifest !== 'object') return `has no ${name} manifest`
    if (!isUsableIdentifier(manifest.type)) return `has no type on its ${name} manifest`
    if (!isUsableIdentifier(manifest.name)) return `has no name on its ${name} manifest`
    if (!isUsableIdentifier(manifest.publicKey)) return `has no public key on its ${name} manifest`
  }

  if (isMissing(encryptionKey) || !isUsableIdentifier(encryptionKey.publicKey))
    return 'has no public key to open it with'
  if (isMissing(encryptedPayload)) return 'has nothing in it'

  return undefined
}

/**
 * Refuses a graph carrying a link whose payload nothing downstream could safely take apart.
 *
 * Payload shape is syntactic: it says nothing about the team, so it can be settled once, at the
 * door, rather than during reduction. That matters because reduction is not a chokepoint — the
 * resolver walks payloads over a merged graph before anything has validated it, and the reducer
 * hands links the resolver discarded to `invalidLinkReducer`, which runs INSTEAD of the validators.
 * Checking here puts all three downstream of a checked payload by construction, rather than each
 * needing a guard of its own.
 *
 * The whole graph is refused, rather than the offending links dropped. Links are hash-linked, so
 * dropping one strands everything descending from it; and a graph that carries a link like this is
 * one we could never finish replaying anyway. Refusing leaves OUR graph untouched, which is what
 * keeps a peer who sends one of these from taking us down with them: we go on syncing with everyone
 * else. What it costs is that we can't sync with that peer again until the link is gone from their
 * chain — but there is no version of accepting it that leaves us able to compute team state.
 */
export const assertLinksAreWellFormed = (
  graph: TeamGraph,
  /** Links we've already checked — anything already in our own graph came through here or through
   * `Team.dispatch`, so it doesn't need checking again */
  alreadyChecked: TeamLinkMap = {}
) => {
  for (const hash in graph.links) {
    if (hash in alreadyChecked) continue

    const problem = payloadProblem(graph.links[hash].body as TeamAction)
    if (problem !== undefined) {
      throw new Error(`Refusing this graph: the link '${hash}' can't be replayed. ${problem}`)
    }
  }
}
