import { ROOT, type Base58, type Hash } from '@localfirst/crdx'
import { base58 } from '@localfirst/crypto'
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

/** What libsodium's key and signature arguments have to decode to, in bytes */
const PUBLIC_KEY_BYTES = 32
const SIGNATURE_BYTES = 64

/**
 * A string libsodium can actually take: base58, and the right number of bytes of it.
 *
 * Being a non-empty string is not enough for a field that ends up as a key or a signature. Every one
 * of them is handed to `keyToBytes`, which is `base58.decode`, and then to libsodium — and each
 * stage of that has its own way of throwing rather than answering. `base58.decode` throws
 * `Expected String` for anything that isn't one, and `Non-base58 character` for a string outside the
 * alphabet; libsodium throws `invalid signature length` or `invalid publicKey length` for base58
 * that decodes to the wrong size. None of those are refusals — they're TypeErrors thrown out of the
 * middle of a replay, which is the failure this whole file exists to prevent.
 *
 * So the length is part of the check, not just the alphabet: `''` and `'zzz'` are both perfectly
 * good base58 and both blow up in libsodium.
 */
export const isUsableBase58 = (value: unknown, byteLength: number): value is Base58 => {
  if (typeof value !== 'string' || value.length === 0) return false

  // Decoding is what settles the length, and decoding is quadratic in the length of the string — so
  // a peer could otherwise hand us a megabyte of '1's and make us pay for it before we refused it.
  // Base58 never encodes a byte as more than two characters, so nothing of the right length is
  // ruled out by bounding it here.
  if (value.length > byteLength * 2) return false

  if (!base58.detect(value)) return false
  return base58.decode(value).length === byteLength
}

/**
 * A counter something does arithmetic on: a number, and one that arithmetic means something for.
 *
 * A generation is compared, and it is also ADDED TO — `lockbox.rotate` computes the next one as
 * `oldLockbox.contents.generation + 1`, and `Team.changeKeys` computes it as
 * `oldKeys.generation + 1`. Adding to a value is not the same kind of safe as comparing it:
 * JavaScript compares a BigInt against a number happily and refuses to add one to it, so a BigInt
 * generation sails through every filter that selects the lockbox to rotate and then throws
 * `Cannot mix BigInt and other types` in the line that rotates it. msgpackr round-trips a BigInt as
 * a BigInt, so one put on a payload arrives intact.
 *
 * The other types are not "caught by the comparisons", which is what an earlier version of this
 * said. Only ONE of the two comparisons is a test a forged value has to pass. `maxGeneration` asks
 * `generation > max`, which coerces — and then RETURNS THE VALUE ITSELF as the new max, so
 * `lockboxesInScope`'s `generation === latestGeneration` is comparing the forged value against
 * itself and cannot fail. (`===` doesn't coerce; it doesn't have to. For `'5'` that's string
 * equality, for a `Date` or an array it's reference identity.) So clearing `> 0` is the whole of
 * being selected, and it also DISPLACES the honest lockbox, whose generation is now below the max.
 * Measured against an honest generation 0: `'5'`, `true`, `Infinity`, a `Date` and even `[7]` each
 * end up as the only lockbox in scope, and only `null`, `undefined`, `NaN`, `{}` and `[]` fail
 * `> 0` and drop out. None of the selected ones throws on `+ 1` — they concatenate, or saturate, or
 * quietly produce a generation nobody can count from — so BigInt is the only one this check is
 * load-bearing against today. It's written as "a generation is a finite number" rather than "a
 * generation is not a BigInt" because saying what a field is is the only form of this that stays
 * true when a consumer changes.
 *
 * What none of this reaches is a generation that IS a finite number and is simply a lie. Being
 * selected is the whole mechanism above, and an honest-looking `3` wins that selection the same way
 * — see auth-xgl, which needs a rule about the team rather than a rule about the payload.
 */
const isUsableGeneration = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

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
 * Being present isn't the whole of being usable, and there are four other ways a field is described
 * here. Three of them are about the TYPE a field arrives as, and they exist because absence is only
 * the most obvious way a field can be wrong: msgpackr round-trips numbers, strings, BigInts,
 * objects and arrays alike, so every one of those is a value a peer can put anywhere. Establishing
 * that a field is safe for one of them establishes nothing about the rest.
 *
 * - **A field that ends up in libsodium has to be base58 of the right length.** `proof.signature`,
 *   `invitation.publicKey`, a keyset's `encryption` and `signature`, and a lockbox's
 *   `encryptionKey.publicKey` and `recipient.publicKey` are all decoded before they're used, and
 *   both `base58.decode` and libsodium throw rather than answering. These are described as a group
 *   by `isUsableBase58`, because they fail as a group: the one that matters is whichever one a peer
 *   thinks to send.
 * - **A field that reaches `JSON.stringify` has to be a string.** `JSON.stringify` throws on a
 *   BigInt. The place that matters is the lodash `memoize` resolver at `invitation/validate.ts`,
 *   which serializes `proof.id`, `proof.invitee` and `proof.keyHash` to build its cache key —
 *   before the memoized body runs, so before anything compares them. Three other `JSON.stringify`s
 *   see data off the graph, and they divide into three different answers rather than one:
 *   `actionFingerprint` catches what it throws. `assertScopesMatch` builds its message EAGERLY, on
 *   every rotate, but only over `getScope`, which is a `type` and a `name` — and those reach it
 *   only from a lockbox manifest, which this file requires to be strings; so that one is safe
 *   because of a rule here, not on its own. The `Couldn't find keys` assert in `selectors/keys.ts`
 *   is EAGER too, on every key lookup including the ones that succeed, and it is not confined to a
 *   scope: it summarizes every lockbox in state and runs `JSON.stringify` over the keysets `keyMap`
 *   recovered from the lockboxes this device could OPEN. The summary is within this file's reach;
 *   the recovered keysets are not, because they come out of a ciphertext — nobody but the recipient
 *   can see them, so no door can. Measured: a lockbox that opens and unpacks to a keyset carrying a
 *   BigInt makes `teamKeys()` itself throw. That's auth-csu's family, and it's the reason the
 *   sentence this replaces was wrong to describe both asserts as one safe case.
 * - **A field something does arithmetic on has to be a number.** A generation is compared AND added
 *   to, and those aren't the same kind of safe — see `isUsableGeneration`.
 * - **A device carried on a member has to be that member's.** Shape is per-field, but a device
 *   naming a `userId` no member has is well-shaped and still unreplayable — `removeDevice` looks
 *   its owner up and asserts. That's a relation between two fields of one payload rather than a
 *   fact about the team, so it's settled here, next to them, rather than in a validator that a
 *   discarded link would never reach. (`rootDeviceBelongsToRootUser` is the same invariant for the
 *   founding device, where the team's own rules do have to speak to it.)
 *
 * Nothing is left to a validator to describe. Deferring a field to a rule that reads it anyway was
 * only ever sound while that rule ran, and the two paths this file exists for are exactly the paths
 * where it doesn't: the resolver walks payloads before anything has validated them, and a link the
 * resolver discards goes to `invalidLinkReducer` INSTEAD of to the validators.
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

  /** Something the link carries that can't be used, and what's wrong with it */
  const detail = (what: string, problem: string) =>
    `This ${action.type} link has to carry ${what}: ${problem}.`

  // ...and nothing can look at a payload until we know there's an action for it to be on
  if (isMissing(action) || typeof action !== 'object') {
    return 'This link has to carry an action.'
  }

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
      const keysProblem = keysetProblem(rootMember.keys)
      if (keysProblem !== undefined) return detail("the founding member's keys", keysProblem)
      if (!isUsableIdentifier(rootMember.userId)) return usable('userId', rootMember.userId)
      if (!isUsableIdentifier(rootMember.userName)) return usable('userName', rootMember.userName)
      const rootDeviceProblem = deviceProblem(rootDevice)
      if (rootDeviceProblem !== undefined)
        return detail('a founding device it can use', rootDeviceProblem)
      return membersDevicesProblem(rootMember, detail)
    }

    case 'ADD_MEMBER': {
      const { member, roles } = action.payload
      if (isMissing(member)) return has('a member')
      const keysProblem = keysetProblem(member.keys)
      if (keysProblem !== undefined) return detail("the member's keys", keysProblem)
      if (!isUsableIdentifier(member.userId)) return usable('userId', member.userId)
      if (!isUsableIdentifier(member.userName)) return usable('userName', member.userName)
      if (isNotAnArray(roles)) return has('its roles as an array')
      if (Array.isArray(roles) && !roles.every(isUsableIdentifier))
        return has('roles that are all usable role names')
      return membersDevicesProblem(member, detail)
    }

    case 'ADD_DEVICE': {
      const problem = deviceProblem(action.payload.device)
      if (problem !== undefined) return detail('a device it can use', problem)
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
      if (isMissing(invitation) || typeof invitation !== 'object') return has('an invitation')
      if (!isUsableIdentifier(invitation.id)) return usable('invitation id', invitation.id)

      // The public key is the whole of what an invitation is for: `validate` verifies the invitee's
      // proof against it. Nothing on the way in touches it — the invitation is just recorded — so a
      // key that libsodium can't take is dormant on the graph until the first admission names it,
      // and then it's every peer's problem at once, including peers who accepted the invitation
      // link happily.
      if (!isUsableBase58(invitation.publicKey, PUBLIC_KEY_BYTES))
        return usable('invitation public key', invitation.publicKey)
      return undefined
    }

    case 'REVOKE_INVITATION': {
      const { id } = action.payload
      if (!isUsableIdentifier(id)) return usable('invitation id', id)
      return undefined
    }

    case 'ADMIT_MEMBER': {
      const { id, memberKeys, userName, proof } = action.payload
      if (!isUsableIdentifier(id)) return usable('invitation id', id)
      const keysProblem = keysetProblem(memberKeys)
      if (keysProblem !== undefined) return detail("the member's keys", keysProblem)

      // The identity being admitted is the `name` on the keyset the invitee chose, and it's the
      // userId the team files them under from then on. `admissionMustBeProven` says this too, and
      // says it better, because it can see the invitation — but that was only ever enough while
      // that rule ran. A link the resolver discards goes to `invalidLinkReducer`, which reads
      // `memberKeys.name` and puts it in `removedMembers` and `pendingKeyRotations`; the merge
      // COMMITS, and then the `updated` handler dispatches a ROTATE_KEYS naming `undefined`, which
      // no admin can ever get past again — on a graph that reloads fine, so it survives a restart.
      if (!isUsableIdentifier(memberKeys.name)) return usable('userId', memberKeys.name)

      if (!isUsableIdentifier(userName)) return usable('userName', userName)
      const theProofProblem = proofProblem(proof)
      if (theProofProblem !== undefined) return detail('a proof it can check', theProofProblem)
      return undefined
    }

    case 'ADMIT_DEVICE': {
      const { id, device, proof } = action.payload
      if (!isUsableIdentifier(id)) return usable('invitation id', id)

      // This is the fourth place a device arrives, and it gets the same rule as the other three.
      // Leaving the device's own identifiers to `admissionMustBeProven` was only ever sound while
      // that rule ran, and a link the resolver discards is handed to `invalidLinkReducer` instead.
      const theDeviceProblem = deviceProblem(device)
      if (theDeviceProblem !== undefined) return detail('a device it can use', theDeviceProblem)
      const theProofProblem = proofProblem(proof)
      if (theProofProblem !== undefined) return detail('a proof it can check', theProofProblem)
      return undefined
    }

    case 'CHANGE_MEMBER_KEYS': {
      const { keys } = action.payload
      const keysProblem = keysetProblem(keys)
      if (keysProblem !== undefined) return detail('a keyset', keysProblem)
      if (!isUsableIdentifier(keys.name)) return usable('keyset name', keys.name)
      return undefined
    }

    case 'ADD_SERVER': {
      const { server } = action.payload
      if (isMissing(server)) return has('a server')
      const keysProblem = keysetProblem(server.keys)
      if (keysProblem !== undefined) return detail("the server's keys", keysProblem)
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
 * What's wrong with the shape of this device, or `undefined` if nothing is.
 *
 * A device shows up in four places — the founding device, an ADD_DEVICE payload, an ADMIT_DEVICE
 * payload, and the `devices` on a member — and the same things read it wherever it came from:
 * `addDevice` and `getDevice` go by `deviceId`, `removeDevice` files the device it removed under
 * `removedDevices`, where a later `addDevice` reads `keys.name` off it, and `memberByDeviceId`
 * resolves a connecting peer through all of it. So there's one rule, not four.
 */
const deviceProblem = (device: unknown): string | undefined => {
  if (isMissing(device) || typeof device !== 'object') return "there isn't one"

  const { deviceId, userId, keys } = device as Record<string, unknown>
  const keysProblem = keysetProblem(keys)
  if (keysProblem !== undefined) return `it has no keys we can use (${keysProblem})`
  if (!isUsableIdentifier(deviceId)) return `'${String(deviceId)}' is not a usable deviceId`
  if (!isUsableIdentifier(userId)) return `'${String(userId)}' is not a usable userId`

  return undefined
}

/**
 * What's wrong with the shape of this public keyset, or `undefined` if nothing is.
 *
 * A keyset arrives on six kinds of link, and the same two things happen to it wherever it came
 * from. `hashKeys` fingerprints it to check an admission against the proof of invitation, and it
 * does that through `redactKeys`, which reads `.hasOwnProperty` off `encryption` and `signature` —
 * so a keyset carrying neither is a TypeError during validation, not a refusal. And both of those
 * fields are base58 public keys that go on to `lockbox.create` and the connection handshake, which
 * decode them. So there's one rule for keysets, and it says the keys are there and are keys.
 *
 * `generation` is here because it is added to, not just compared: `Team.changeKeys` computes a
 * member's next generation as `oldKeys.generation + 1`, so a keyset that arrives on the graph
 * carrying a BigInt is a member nobody can ever re-key. Both halves of that were established by
 * trying every type a payload can carry, not by reading the callers — reading is what missed it.
 *
 * `name` and `type` aren't here, and the reason is narrower than "they're only compared". They're
 * copied verbatim into the recipient manifest of every lockbox later addressed to this keyset, and
 * `lockboxProblem` requires a manifest's to be strings — so a keyset carrying a `name` that isn't
 * one costs that member the ability to be granted a role, at the door of the link that would grant
 * it. That's a refusal rather than a throw during a replay, which is the line this file draws, but
 * it isn't nothing: see auth-2oa. Where a particular one is load-bearing on arrival, the case that
 * carries it says so (`keys.name` on CHANGE_MEMBER_KEYS, `memberKeys.name` on ADMIT_MEMBER).
 */
const keysetProblem = (keys: unknown): string | undefined => {
  if (isMissing(keys) || typeof keys !== 'object') return 'there is no keyset'

  const { encryption, signature, generation } = keys as Record<string, unknown>
  if (!isUsableBase58(encryption, PUBLIC_KEY_BYTES))
    return `'${String(encryption)}' is not a usable encryption key`
  if (!isUsableBase58(signature, PUBLIC_KEY_BYTES))
    return `'${String(signature)}' is not a usable signature key`
  if (!isUsableGeneration(generation)) return `'${String(generation)}' is not a usable generation`

  return undefined
}

/**
 * What's wrong with the shape of this proof of invitation, or `undefined` if nothing is.
 *
 * The proof travels on the graph so that every peer can check the admission for itself, which means
 * every peer runs `invitation/validate` over it — and the last thing that does is hand `signature`
 * to `signatures.verify`, which decodes it and gives it to libsodium. Nothing down there returns
 * `false` for a signature it can't read; it throws.
 *
 * `id`, `invitee` and `keyHash` aren't decoded, but they aren't only compared either: they're the
 * cache key. `validate` is a lodash `memoize`, and its resolver runs `JSON.stringify` over them to
 * build that key — before the memoized body, so before the `!==` that would otherwise be all that
 * happens to them. `JSON.stringify` throws on a BigInt, and msgpackr round-trips a BigInt as a
 * BigInt, so a proof carrying one for any of these three is a TypeError thrown out of validation
 * rather than a refusal, on every peer, forever. Being a string is the whole of what they need to
 * be here; what they have to SAY about the identity being admitted is still
 * `admissionMustBeProven`'s, which says it better because it can see the invitation too.
 */
const proofProblem = (proof: unknown): string | undefined => {
  if (isMissing(proof) || typeof proof !== 'object') return "there isn't one"

  const { id, invitee, keyHash, signature } = proof as Record<string, unknown>
  if (!isUsableBase58(signature, SIGNATURE_BYTES))
    return `'${String(signature)}' is not a usable signature`
  for (const [name, value] of [
    ['id', id],
    ['invitee', invitee],
    ['keyHash', keyHash],
  ] as const) {
    if (!isUsableIdentifier(value)) return `'${String(value)}' is not a usable ${name}`
  }

  return undefined
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
 * A manifest is a keyset's public half, so the fields it shares with a keyset get the rule a keyset
 * gives them. `generation` used to be excused here on the grounds that it's "only ever compared or
 * added to" — which named the danger and then filed it under safe. Added-to IS the throw:
 * `lockbox.rotate` computes `oldLockbox.contents.generation + 1`, and `lockboxesInScope` picks the
 * highest generation in scope, so a BigInt one is selected FIRST and guaranteed to reach that line.
 * Aimed at a member's own scope it disables `changeKeys` for them; aimed at the team's it disables
 * `remove` for everybody, permanently, on a graph that still loads.
 *
 * `encryption` and `signature` are on a manifest too, and `removeDevice` promotes them: a lockbox
 * naming a later generation than the member has is treated as the authority on that member's public
 * keys, and its `encryption` and `signature` are written into `state.members[…].keys` verbatim.
 * From there `createMemberLockboxes` hands the ENCRYPTION key to `lockbox.create`, so granting that
 * member a role throws in libsodium rather than refusing.
 *
 * The two are load-bearing for different callers, and neither is here by symmetry — but NEITHER of
 * them breaks a replay, which is worth saying plainly, because a throw during one is the criterion
 * at the top of this file and it would give the wrong answer here. Every replay-side reader of a
 * promoted key only compares it or files it away; measured, a poisoned `encryption` merges cleanly,
 * survives a full re-replay from `save()`, and leaves `members()` and `teamKeys()` working. What
 * breaks is an operation somebody AUTHORS afterwards, aimed at the member the lockbox lied about.
 *
 * For the encryption key that operation is granting them a role. `redactKeys` asks `hasSecrets`,
 * which reads `keys.encryption.hasOwnProperty` first and short-circuits there, and `lockbox.create`
 * then reads `.encryption` and nothing else — so `Team.addMemberRole` throws `invalid publicKey
 * length`, `Non-base58 character` or `Cannot read properties of null` before it has a link to
 * dispatch. For the signature key it's `Team.verify`, which hands `members(author).keys.signature`
 * straight to libsodium: measured over every value, `null`, `123`, `{}` and `1n` give `Expected
 * String`, `'zzz'` and `''` give `invalid publicKey length`, and `'not-base58!!!'` gives
 * `Non-base58 character`. Not one of them returns `false`.
 *
 * `removeDevice` resolves the member from the device being REMOVED and promotes only from a lockbox
 * in that member's own scope, so what a member can do unaided is poison their own record — after
 * which every peer's `team.verify()` throws on anything they sign, permanently, instead of
 * answering. Aiming it at somebody else takes an admin, because `canOnlyRemoveYourOwnDevices`
 * stands in the way of removing their device. Being outside replay is why neither of these is a
 * graph you can't open; it is not a reason to think either check optional.
 *
 * They're optional because a manifest built from another manifest doesn't carry them — and
 * `undefined` is exactly what `removeDevice` checks for before promoting, so absence is the one
 * value it already handles and every other value is one it doesn't.
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

    // A manifest's `publicKey` is a key, and one of them is decoded. Re-keying a member replaces
    // every lockbox they can see, and `lockbox.rotate` hands the OLD lockbox's recipient manifest
    // straight back to `lockbox.create`, which takes `manifest.publicKey` as the
    // `recipientPublicKey` it encrypts to — `keyToBytes`, then libsodium. Nothing on the way in
    // touches it, so a forged one merges cleanly everywhere and loads fine, and detonates the
    // first time an admin re-keys that member: the one remediation the team has for a compromised
    // member is the thing it disables, and it's disabled for good, because the lockbox is on the
    // chain. Any member can post a lockbox, so this doesn't take an admin to do. The contents
    // manifest's key isn't decoded anywhere today — it's the same field of the same kind of
    // manifest, and describing one of the two would just be a note about which caller we happened
    // to look at.
    if (!isUsableBase58(manifest.publicKey, PUBLIC_KEY_BYTES))
      return `has no usable public key on its ${name} manifest ('${String(manifest.publicKey)}')`

    if (!isUsableGeneration(manifest.generation))
      return `has no usable generation on its ${name} manifest ('${String(manifest.generation)}')`

    // A manifest built from another manifest carries no public keys of its own, and `removeDevice`
    // already handles that: it promotes these two only when both are there. Every other value is
    // one it doesn't handle.
    for (const key of ['encryption', 'signature'] as const) {
      if (manifest[key] !== undefined && !isUsableBase58(manifest[key], PUBLIC_KEY_BYTES))
        return `has no usable ${key} key on its ${name} manifest ('${String(manifest[key])}')`
    }
  }

  // The key a lockbox was sealed with is base58 that `asymmetric.decryptBytes` decodes. Nothing on
  // the way in reads it — the author isn't the recipient, and a non-recipient never opens the
  // lockbox at all — so a key libsodium can't take is accepted everywhere and surfaces only at the
  // one member the lockbox names, on load, for good. Lockbox manifests are plaintext on the graph,
  // so anyone can copy a real lockbox and change this one field to aim that at a chosen member.
  if (isMissing(encryptionKey) || typeof encryptionKey !== 'object')
    return 'has no key to open it with'
  if (!isUsableBase58(encryptionKey.publicKey, PUBLIC_KEY_BYTES))
    return `has no usable public key to open it with ('${String(encryptionKey.publicKey)}')`
  // What's in a lockbox is bytes. Nothing on the way in reads them — the author isn't the
  // recipient — so anything else in this field surfaces on the RECIPIENT's side, in the `updated`
  // handler, after `Store.merge` has already committed the graph.
  if (isMissing(encryptedPayload)) return 'has nothing in it'
  if (!(encryptedPayload instanceof Uint8Array)) return 'has something other than bytes in it'

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
 *
 * That last part is only true of what's refused HERE. `Store.merge` assigns the merged graph before
 * it recomputes state, so anything this misses is already committed by the time it throws — and it
 * throws every time the graph is replayed after that, including on load. A field this doesn't
 * describe isn't a noisier error; it's a graph that can't be opened again. That is the whole reason
 * to keep this total, and the reason a `never` check over action types isn't enough on its own: it
 * catches a new action, not a new field.
 */
export const assertLinksAreWellFormed = (
  graph: TeamGraph,
  /** Links we've already checked — anything already in our own graph came through here or through
   * `Team.dispatch`, so it doesn't need checking again */
  alreadyChecked: TeamLinkMap = {}
) => {
  for (const hash in graph.links) {
    if (Object.hasOwn(alreadyChecked, hash)) continue

    // A link entry is as much a peer's to make up as the payload on it, and this is the one place
    // that reads one. `payloadProblem` allows for there being no action at all, so handing it
    // whatever this is — including nothing — is the check; reaching for `.body` first is not.
    const link = graph.links[hash as Hash] as { body?: unknown } | undefined
    const problem = payloadProblem(link?.body as TeamAction)
    if (problem !== undefined) {
      throw new Error(`Refusing this graph: the link '${hash}' can't be replayed. ${problem}`)
    }
  }
}

/**
 * A member arrives carrying their devices, and nothing checks them again once they're on the team.
 *
 * `addDevice` reads `member.devices` with `= []`, and `getDevice` reads it with `?? []`; both of
 * those catch a member who came with none, and neither catches one who came with `null`. Because
 * the member is state from then on, the throw doesn't land on the link that carried it — it lands
 * on the next ordinary ADD_DEVICE for that member, on every peer, for good.
 *
 * The same is true of a device that is perfectly well shaped but names somebody else. A device
 * carried this way is filed under the member carrying it and never checked against them again;
 * `removeDevice` then looks its `userId` up among the members and asserts when it finds nobody. So
 * the owner has to be the member here, in the payload, where both are in front of us —
 * `rootDeviceBelongsToRootUser` says exactly this about the founding device, and until now nothing
 * said it about the devices a member arrives with.
 */
const membersDevicesProblem = (
  member: unknown,
  detail: (what: string, problem: string) => string
) => {
  const { userId, devices } = member as { userId?: unknown; devices?: unknown }

  // A member who carries none is what every honest link looks like
  if (devices === undefined) return undefined
  if (!Array.isArray(devices)) return detail('devices it can use', "they aren't a list")

  for (const [index, device] of devices.entries()) {
    const problem = deviceProblem(device)
    if (problem !== undefined) return detail('devices it can use', `device ${index}: ${problem}`)

    // `deviceProblem` has just established that this is a usable userId, and the caller has
    // established the same of the member's
    const owner = (device as { userId: string }).userId
    if (owner !== userId)
      return detail(
        'devices it can use',
        `device ${index}: it belongs to '${owner}', not to '${String(userId)}'`
      )
  }

  return undefined
}
