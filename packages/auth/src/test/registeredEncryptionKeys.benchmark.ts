import { getSequence, ROOT, type Base58 } from '@localfirst/crdx'
import { assert } from '@localfirst/shared'
import { bench, describe } from 'vitest'
import { redactDevice, type DeviceWithSecrets } from 'device/index.js'
import { ADMIN } from 'role/index.js'
import { initialState } from 'team/constants.js'
import * as teams from 'team/index.js'
import { membershipResolver } from 'team/membershipResolver.js'
import { reducer } from 'team/reducer.js'
import { isRegisteredEncryptionKey } from 'team/registeredEncryptionKeys.js'
import { type TeamAction, type TeamContext, type TeamGraph } from 'team/types.js'
import * as Auth from '../index.js'

/**
 * `isRegisteredEncryptionKey` checks the author's current key generation first — a scan of the
 * member list — and falls back to scanning every lockbox in state when that misses, which is
 * O(lockboxes). It has two call sites:
 *
 * - `linkAuthorshipIsAuthentic`, which calls it once per link, so its cost is paid on every
 *   reduction of a whole graph. This is what the benchmarks below exercise.
 * - `roleGrantMustIncludeKeys`, which calls it inside a `.some()` over an `ADD_MEMBER_ROLE`
 *   payload's lockboxes. A `false` there does not throw — `.some` moves to the next lockbox — so a
 *   single link can drive the fallback to completion several times over, once per payload lockbox
 *   naming that role and recipient. Reaching that site takes ADMIN authority: `ADD_MEMBER_ROLE`
 *   isn't on the `nonAdminActions` allowlist, and validators run in insertion order, so
 *   `mustBeAdmin` rejects a non-admin before `roleGrantMustIncludeKeys` ever runs. Tracked
 *   separately as auth-8wx. **The scenario below emits no `ADD_MEMBER_ROLE` link** (asserted), so
 *   that second site is unexercised here and none of these numbers speak to it.
 *
 * At the first call site a miss costs one full scan and then aborts the reduction, because failing
 * that validator throws.
 *
 * ## Which number to scale from
 *
 * The per-call benchmarks below run against a state produced by a reduction, which is what the
 * validator sees in production. That matters more than it sounds: running the identical loop —
 * same key, same 121,140 lockbox visits — against a live `Team`'s `.state` instead took 15.2–16.9 ms
 * versus 3.1–4.2 ms against a reduced state. A long-lived team instance accumulates its state
 * object incrementally, and scanning it is ~4.6× slower than scanning the equivalent state that
 * came out of `teams.load`. Earlier drafts of this file measured the live state and so overstated
 * the per-call cost by that factor. **Scale from the per-call numbers here, which agree with what
 * the fallback actually costs inside a reduction.**
 *
 * ## Measurements
 *
 * M-series laptop, Node 20.10.0, at the sizes configured below: 217 links (216 validated), 2212
 * lockboxes, 60 links authored under a superseded generation, each scan stopping at lockbox 2019.
 *
 * Instrumented in situ — temporary counters and timers added to `isRegisteredEncryptionKey`, not
 * committed — over six rounds with the two arms alternating order:
 *
 * | measurement                                  | value                       |
 * | --------------------------------------------- | --------------------------- |
 * | whole reduction, wall clock                   | 97–116 ms                   |
 * | 156 fast-path calls, total                    | 0.016–0.043 ms              |
 * | 60 fallback calls, total                      | 3.2–4.1 ms                  |
 * | lockbox visits on the fallback                | 121,140                     |
 * | => per fallback call                          | ~0.057 ms                   |
 * | => per lockbox visited                        | ~0.028 µs                   |
 * | => per link, baseline (whole reduction / 216) | ~0.46 ms                    |
 *
 * The committed per-call benchmarks below agree with that, which is the point of running them
 * against a reduced state:
 *
 * | bench                                     | mean over 2 runs | per call   |
 * | ------------------------------------------ | ---------------- | ---------- |
 * | fast path × 216 calls                      | 0.044–0.047 ms   | 0.0002 ms  |
 * | superseded generation × 216 calls          | 11.9–12.2 ms     | 0.055 ms   |
 * | unregistered key, full scan × 216 calls    | 14.6–15.2 ms     | 0.069 ms   |
 *
 * The end-to-end gap between the two reduction arms is *not* resolvable at this size: with the
 * order alternated the differences were +6.4, +3.9, −7.7, +7.9, −3.3, +3.3 ms — mean +1.8 ms,
 * changing sign, against a real fallback cost of ~3.4 ms. (An earlier draft reported a consistent
 * 5–7% gap; that was run-order bias, since vitest runs benches in declaration order and the
 * fallback arm was always second. Read the two reduction benches below as a shape control, not as a
 * measurement of the effect.)
 *
 * ## How often the fallback is reached
 *
 * - Across the whole test suite (517 tests), it was entered 4 times: 3 forgery-rejection tests in
 *   `linkAuthorship.test.ts`, where the key is unregistered on purpose, and 1 device removal in
 *   `devices.test.ts`.
 * - A 100-member chain with 30 member removals — 231 links, 3263 lockboxes — takes the fast path on
 *   all 230 calls. Removing a member rotates the team and role keys, not the other members' own user
 *   keys; and a link is validated against state as of its own position in the sequence, so in a
 *   linear chain the author's registered key is by construction the one they authored with.
 * - It's reached in bulk only when a run of links is authored under a generation a *concurrent*
 *   branch has superseded — someone rotated that author's own user keys while they were offline.
 *   `topoSort` emits an unbranched run contiguously, so such a run lands entirely before or entirely
 *   after the rotation, decided by link hashes. That's what the scenario below builds.
 * - Scanning stops at the first match, and a generation was lockboxed when it was minted, so the
 *   cost is O(position of that generation), not O(lockboxes). Offline observation, not committed
 *   here: with the same counters, an offline run of 25 links over a 498-lockbox chain — the natural
 *   case, where the author's superseded keys are their original ones — visited 4 lockboxes per call,
 *   and the coin flip on which side of the rotation the run landed came out 3/8 and 5/8 over trials.
 *   The scenario below is the unfavorable case, arranged so the author's generation is minted late.
 *
 * ## Conclusion
 *
 * No change warranted, so none was made. Indexing the registered keys incrementally in `TeamState`
 * would make the lookup constant-time, but at this size it would remove ~3.4 ms from a ~100 ms
 * reduction in a case that has to be constructed on purpose, and ~0.04 ms in the ordinary case — in
 * exchange for derived state that every transform has to keep correct, and that `auditAuthorship`
 * also reads.
 *
 * Revisit trigger, computed rather than hand-waved: a fallback link costs ~0.028 µs per lockbox it
 * visits, against a baseline of ~0.46 ms per link. So even with *every* link on the fallback, 2212
 * lockboxes adds ~12%. The scan only matches the rest of a reduction — i.e. doubles it — at roughly
 * 17,000 lockboxes visited per link. Worth another look if lockbox counts approach that and
 * concurrent key rotation is common.
 *
 * ## Reproducibility
 *
 * Keys are seeded, so members and devices are identical run to run. Link hashes are not: they
 * include timestamps. Which side of the rotation the sequencer puts the offline run therefore
 * varies, which is why `buildPair` keeps building until it has one chain of each kind.
 */

const MEMBERS = 60
const REMOVALS = 30
const OFFLINE_LINKS = 60

/**
 * Builds a chain that is both rotation-heavy and rotation-concurrent.
 *
 * Alice removes members, which rotates the team and role keys and issues a fresh lockbox to every
 * remaining member, so the lockbox count grows roughly as members × removals. Then Alice removes one
 * of Bob's devices, which rotates Bob's own user keys; Bob picks up that generation, goes offline
 * and authors a run of links under it; and Alice removes another of Bob's devices, superseding it.
 * Whether Bob's run is validated against the superseded generation depends on which side of the
 * rotation the sequencer puts it.
 */
const buildScenario = (attempt: number) => {
  const seed = (name: string) => `${name}-${attempt}`
  const seededUser = (name: string) => Auth.createUser(name, seed(name), seed(name))

  const aliceUser = seededUser('alice')
  const aliceLaptop = Auth.createDevice({ userId: aliceUser.userId, deviceName: 'laptop' })
  const alice = Auth.createTeam('Test', { user: aliceUser, device: aliceLaptop })

  const bobUser = seededUser('bob')
  const bobDevice = (deviceName: string) =>
    Auth.createDevice({ userId: bobUser.userId, deviceName })
  const bobLaptop = bobDevice('laptop')
  const bobPhone = bobDevice('phone')
  const bobSpare = bobDevice('spare')
  alice.addForTesting(bobUser, [ADMIN], redactDevice(bobLaptop))

  const filler: string[] = []
  for (let i = 0; i < MEMBERS; i++) {
    const user = seededUser(`user-${i}`)
    const device = Auth.createDevice({ userId: user.userId, deviceName: `dev-${i}` })
    alice.addForTesting(user, [], redactDevice(device))
    filler.push(user.userId)
  }

  const bob = teams.load(alice.graph, { user: bobUser, device: bobLaptop }, alice.teamKeyring())

  // Bob registers two spare devices, so his keys can be rotated twice
  const addDevice = (device: DeviceWithSecrets) =>
    bob.addForTesting(bobUser, [], redactDevice(device))
  addDevice(bobPhone)
  addDevice(bobSpare)
  alice.merge(bob.graph)

  // A pile of member removals, each rotating keys and appending lockboxes
  for (let i = 0; i < REMOVALS; i++) alice.remove(filler[i])

  // Bob's own keys rotate, so the generation he's about to author under is minted at the end of
  // that pile — deep in the lockbox array, where the fallback scan has furthest to walk
  alice.removeDevice(redactDevice(bobPhone).deviceId)
  bob.merge(alice.graph)

  // Bob goes offline and authors a run of links under that generation
  for (let i = 0; i < OFFLINE_LINKS; i++) bob.addRole(`role-${i}`)

  // Concurrently, Bob's keys rotate again, superseding it
  alice.removeDevice(redactDevice(bobSpare).deviceId)
  alice.merge(bob.graph)

  return {
    serialized: alice.save(),
    keyring: alice.teamKeyring(),
    context: { user: aliceUser, device: aliceLaptop },
    graph: alice.graph,
    bobUserId: bobUser.userId,
  }
}

type Scenario = ReturnType<typeof buildScenario>

/**
 * Exactly how many links enter the fallback, by replaying the sequence the way `teamMachine` does
 * and testing the same condition the fast path tests: is the key this link was encrypted with the
 * one the team has registered for its author, as of the state just before it?
 */
const countFallbackEntries = (graph: TeamGraph) => {
  const sequence = getSequence<TeamAction, TeamContext>(graph, membershipResolver)
  let state = initialState
  let count = 0
  for (const link of sequence) {
    if (link.body.type !== ROOT && !link.isInvalid) {
      const { userId } = link.body
      const { senderPublicKey } = graph.encryptedLinks[link.hash]
      const author = [...state.members, ...state.removedMembers].find(m => m.userId === userId)
      if (author?.keys.encryption !== senderPublicKey) count++
    }

    state = reducer(state, link)
  }

  return count
}

const linkTypes = (graph: TeamGraph) =>
  new Set(
    getSequence<TeamAction, TeamContext>(graph, membershipResolver).map(l => l.body.type as string)
  )

/**
 * Two chains of identical shape: one whose offline run stays on the fast path, one whose offline run
 * falls through to the lockbox scan. Which one a given chain turns out to be comes down to link
 * hashes, so we keep building until we've seen both.
 */
const buildPair = () => {
  let fastPath: Scenario | undefined
  let fallback: Scenario | undefined
  for (let attempt = 0; attempt < 25 && !(fastPath && fallback); attempt++) {
    const scenario = buildScenario(attempt)
    if (countFallbackEntries(scenario.graph) > 0) fallback ??= scenario
    else fastPath ??= scenario
  }

  if (!fastPath || !fallback)
    throw new Error(
      "Couldn't build a chain of each kind — the sequencer put the offline run on the same side of the rotation every time"
    )

  return { fastPath, fallback }
}

const { fastPath, fallback } = buildPair()

// The two arms are only a control if they differ in exactly one thing, so check that they do
const countLinks = ({ graph }: Scenario) => Object.keys(graph.links).length
const reduceArm = ({ serialized, context, keyring }: Scenario) =>
  teams.load(serialized, context, keyring)

const fallbackState = reduceArm(fallback).state
const fastPathState = reduceArm(fastPath).state

assert(
  countLinks(fallback) === countLinks(fastPath),
  `The two arms should have the same number of links (${countLinks(fallback)} vs ${countLinks(fastPath)})`
)
assert(
  fallbackState.lockboxes.length === fastPathState.lockboxes.length,
  `The two arms should have the same number of lockboxes (${fallbackState.lockboxes.length} vs ${fastPathState.lockboxes.length})`
)
assert(
  countFallbackEntries(fallback.graph) === OFFLINE_LINKS,
  `The fallback arm should put exactly ${OFFLINE_LINKS} links on the fallback, not ${countFallbackEntries(fallback.graph)}`
)
assert(
  countFallbackEntries(fastPath.graph) === 0,
  `The fast-path arm should put no links on the fallback, not ${countFallbackEntries(fastPath.graph)}`
)
assert(
  !linkTypes(fallback.graph).has('ADD_MEMBER_ROLE'),
  "These numbers don't cover the ADD_MEMBER_ROLE call site, and the scenario isn't supposed to contain one"
)

const linkCount = countLinks(fallback)
const validatedLinkCount = linkCount - 1 // the root link is exempt from this validator
const lockboxCount = fallbackState.lockboxes.length

// A key that's current for its member, so the member-list scan answers it
const currentMember = fallbackState.members.at(-1)!
const currentKey = currentMember.keys.encryption

// The generation Bob's offline run was authored under — the same lookup the fallback does in situ
const firstOfBobsRun = getSequence<TeamAction, TeamContext>(
  fallback.graph,
  membershipResolver
).find(link => link.body.userId === fallback.bobUserId && link.body.type === 'ADD_ROLE')!
const supersededKey = fallback.graph.encryptedLinks[firstOfBobsRun.hash].senderPublicKey

// A key that was never registered for anyone, so the scan runs to the end and returns false
const unregisteredKey = Auth.createUser('nobody', 'nobody').keys.encryption
  .publicKey as unknown as Base58

describe(`registered encryption keys (${linkCount} links, ${lockboxCount} lockboxes)`, () => {
  // A shape control, not a measurement: the arms differ only in which side of the rotation the
  // offline run is sequenced on, but the gap is smaller than the noise at this size — and vitest
  // runs benches in declaration order, which biases whichever one goes second
  bench('reduce a chain whose offline run stays on the fast path', () => {
    reduceArm(fastPath)
  })

  bench(`reduce a chain with ${OFFLINE_LINKS} links on the fallback`, () => {
    reduceArm(fallback)
  })

  // The validator's own contribution, one call per validated link, on each path
  bench(`fast path × ${validatedLinkCount} calls`, () => {
    for (let i = 0; i < validatedLinkCount; i++)
      isRegisteredEncryptionKey(fallbackState, currentMember.userId, currentKey)
  })

  bench(`superseded generation × ${validatedLinkCount} calls`, () => {
    for (let i = 0; i < validatedLinkCount; i++)
      isRegisteredEncryptionKey(fallbackState, fallback.bobUserId, supersededKey)
  })

  bench(`unregistered key, full scan × ${validatedLinkCount} calls`, () => {
    for (let i = 0; i < validatedLinkCount; i++)
      isRegisteredEncryptionKey(fallbackState, currentMember.userId, unregisteredKey)
  })
})
