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
 *   reduction of a whole graph. This is what the benchmarks below exercise. A miss here costs one
 *   full scan and then aborts the reduction, because failing that validator throws.
 * - `roleGrantMustIncludeKeys`, which calls it inside a `.some()` over an `ADD_MEMBER_ROLE`
 *   payload's lockboxes. A `false` there does not throw — `.some` moves to the next lockbox — so a
 *   single link can drive the fallback to completion several times over, once per payload lockbox
 *   naming that role and recipient. Reaching that site takes ADMIN authority: `ADD_MEMBER_ROLE`
 *   isn't on the `nonAdminActions` allowlist, and validators run in insertion order, so
 *   `mustBeAdmin` rejects a non-admin before `roleGrantMustIncludeKeys` ever runs. Tracked
 *   separately as auth-8wx. **The scenario below emits no `ADD_MEMBER_ROLE` link** (asserted), so
 *   that second site is unexercised here and none of these numbers speak to it.
 *
 * ## The per-call cost is bimodal, by ~4.6x
 *
 * The same lookup — same key, same 216 calls, same first match at lockbox 2018 of 2212, so
 * byte-for-byte the same work — costs either ~0.06 ms or ~0.27 ms per call depending on where the
 * state object it scans came from. Medians of 9 interleaved rounds:
 *
 * | state scanned                                    | per call |
 * | ------------------------------------------------- | -------- |
 * | live `Team.state`, built up by a running team     | 0.272 ms |
 * | `teams.load(bytes)` — a cold load                 | 0.059 ms |
 * | `teams.load(graph)` — the merge path              | 0.271 ms |
 * | live state, `lockboxes.slice()`                   | 0.270 ms |
 * | live state, manifests rebuilt uniformly           | 0.048 ms |
 *
 * The determinant is the hidden-class provenance of the lockbox *manifest* objects, not how the
 * array was accumulated. A fresh array over the same manifests stays slow; the same array with
 * uniformly rebuilt manifests goes fast. A cold load is fast only because decoding every manifest
 * through msgpackr gives the array one uniform shape, which keeps the `manifest.type` / `.name` /
 * `.publicKey` loads in the scan monomorphic; locally constructed manifests mix shapes and
 * depolymorphize them.
 *
 * **Which mode applies where matters, because the two are not equally relevant.** `Store.merge`
 * calls `updateState()`, which runs `sequence.reduce(reducer, initialState)` over the in-memory
 * graph (`makeMachine.ts:19`), and `maybeDeserialize` hands a `TeamGraph` source straight through
 * without re-decoding (`serialize.ts:29-32`). So a merge reduces in the *slow* mode — and by the
 * analysis further down, a merge is the only thing that reaches the fallback in bulk. The cold-load
 * mode is the one a fresh load from storage runs in.
 *
 * Not measured here: a real sync produces a mixed array, since links that arrived over the wire are
 * decoded while locally authored ones are not. Where the boundary lies between a mostly-decoded and
 * a mostly-local array is an open question for whoever revisits this.
 *
 * ## Measurements
 *
 * M-series laptop, Node 20.10.0, at the sizes configured below: 217 links (216 validated), 2212
 * lockboxes, 60 links authored under a superseded generation, each scan stopping at lockbox 2018.
 *
 * End to end. Medians of 20 reps with the two arms interleaved, and the same pair as run by the
 * committed benches below:
 *
 * | mode       | fast-path arm | fallback arm  | gap                  |
 * | ----------- | ------------- | ------------- | -------------------- |
 * | cold load   | 104.4–107.7 ms | 106.4–108.5 ms | +0.8 to +2.5 ms (~+2%) |
 * | merge path  | 22.5–23.6 ms  | 40.0–41.6 ms  | +16.5 to +18.4 ms (~+75%) |
 *
 * The merge path is cheaper overall because it skips decrypting the links — which is exactly why
 * the fallback dominates it. Per link: the baseline is ~0.50 ms on a cold load and ~0.11 ms on a
 * merge, while one fallback call costs ~0.059 ms and ~0.27 ms respectively. **On the merge path a
 * single fallback link costs about 2.5 ordinary links.**
 *
 * The committed per-call benches reproduce the split directly:
 *
 * | bench                                                  | mean over 2 runs | per call      |
 * | ------------------------------------------------------- | ---------------- | ------------- |
 * | fast path × 216 calls                                   | 0.045–0.049 ms   | 0.0002 ms     |
 * | superseded generation × 216, decoded state              | 11.0–12.8 ms     | 0.051–0.059 ms |
 * | superseded generation × 216, locally built state        | 54.3–57.5 ms     | 0.251–0.266 ms |
 * | unregistered key, full scan × 216, locally built state  | 64.9–68.7 ms     | 0.301–0.318 ms |
 *
 * The end-to-end gap is not resolvable by the two reduction benches below on the cold path: with
 * the order alternated over six rounds the differences were +6.4, +3.9, -7.7, +7.9, -3.3, +3.3 ms
 * against ~8 ms of noise. That is a power problem, not evidence of absence — 20 interleaved reps
 * recover +2.5 ms, consistent with 60 calls at 0.059 ms. (An earlier draft reported a consistent
 * 5-7% gap on that pair; that was run-order bias, since vitest runs benches in declaration order
 * and the fallback arm was always second.) On the merge path the gap is far above the noise and the
 * benches resolve it easily.
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
 *   here: with temporary counters, an offline run of 25 links over a 498-lockbox chain — the natural
 *   case, where the author's superseded keys are their original ones — visited 4 lockboxes per call,
 *   and the coin flip on which side of the rotation the run landed came out 3/8 and 5/8 over trials.
 *   The scenario below is the unfavorable case, arranged so the author's generation is minted late.
 *
 * ## Conclusion
 *
 * No change warranted, so none was made — but this is a closer call than an earlier draft of this
 * file made it look. Indexing the registered keys incrementally in `TeamState` would make the
 * lookup constant-time. What it would buy is ~0.04 ms on an ordinary reduction, where nothing
 * reaches the fallback, and ~18 ms — around +75% — on the merge of a deliberately constructed
 * concurrent chain. What it would cost is derived state that every transform has to keep correct
 * and that `auditAuthorship` also reads. On those numbers the trade still doesn't pay, because the
 * ordinary case is the one that runs constantly; but the deciding factor is how rare the
 * constructed case is, not how cheap the fallback is.
 *
 * Revisit trigger, computed rather than hand-waved, and stated per mode because they differ by 20x:
 * a fallback link costs ~0.133 us per lockbox visited on the merge path and ~0.029 us on a cold
 * load, against per-link baselines of ~0.11 ms and ~0.50 ms. So one fallback link costs as much as
 * one ordinary link at roughly **810 lockboxes on the merge path**, and roughly 17,000 on a cold
 * load. The merge-path figure is not a distant threshold: the 100-member/30-removal chain described
 * above already carries 3263 lockboxes, four times past it. What keeps the cost small today is that
 * almost no links reach the fallback — not that the fallback is cheap. Revisit if concurrent key
 * rotation becomes common, rather than waiting for a lockbox count.
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

/** Reduces from serialized bytes, decoding every manifest on the way — the cold-load mode */
const reduceFromBytes = ({ serialized, context, keyring }: Scenario) =>
  teams.load(serialized, context, keyring)

/** Reduces an in-memory graph, leaving locally built manifests as they are — the merge-path mode */
const reduceFromGraph = ({ graph, context, keyring }: Scenario) =>
  teams.load(graph, context, keyring)

// The two arms are only a control if they differ in exactly one thing, so check that they do.
// (The counts are hoisted because `assert`'s message argument is eager, and each of these replays
// the whole chain.)
const countLinks = ({ graph }: Scenario) => Object.keys(graph.links).length
const fallbackLinks = countLinks(fallback)
const fastPathLinks = countLinks(fastPath)
const fallbackEntries = countFallbackEntries(fallback.graph)
const fastPathEntries = countFallbackEntries(fastPath.graph)

// One state object of each provenance, so the benches can measure both modes
const decodedState = reduceFromBytes(fallback).state
const locallyBuiltState = reduceFromGraph(fallback).state
const fastPathLockboxes = reduceFromBytes(fastPath).state.lockboxes.length

assert(
  fallbackLinks === fastPathLinks,
  `The two arms should have the same number of links (${fallbackLinks} vs ${fastPathLinks})`
)
assert(
  decodedState.lockboxes.length === fastPathLockboxes,
  `The two arms should have the same number of lockboxes (${decodedState.lockboxes.length} vs ${fastPathLockboxes})`
)
assert(
  fallbackEntries === OFFLINE_LINKS,
  `The fallback arm should put exactly ${OFFLINE_LINKS} links on the fallback, not ${fallbackEntries}`
)
assert(
  fastPathEntries === 0,
  `The fast-path arm should put no links on the fallback, not ${fastPathEntries}`
)
assert(
  !linkTypes(fallback.graph).has('ADD_MEMBER_ROLE'),
  "These numbers don't cover the ADD_MEMBER_ROLE call site, and the scenario isn't supposed to contain one"
)

const linkCount = fallbackLinks
const validatedLinkCount = linkCount - 1 // the root link is exempt from this validator
const lockboxCount = decodedState.lockboxes.length

// A key that's current for its member, so the member-list scan answers it
const currentMember = decodedState.members.at(-1)!
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
  // End to end in both modes. The arms differ only in which side of the rotation the offline run is
  // sequenced on. On the cold path the gap is below what this many samples can resolve; on the
  // merge path it's the dominant term. Note that vitest runs benches in declaration order, which
  // biases whichever one goes second — read the cold-path pair with that in mind.
  bench('cold load — offline run stays on the fast path', () => {
    reduceFromBytes(fastPath)
  })

  bench(`cold load — ${OFFLINE_LINKS} links on the fallback`, () => {
    reduceFromBytes(fallback)
  })

  bench('merge path — offline run stays on the fast path', () => {
    reduceFromGraph(fastPath)
  })

  bench(`merge path — ${OFFLINE_LINKS} links on the fallback`, () => {
    reduceFromGraph(fallback)
  })

  // The validator's own contribution, one call per validated link. The fast path never touches the
  // lockboxes, so it doesn't care about provenance; the fallback arms run in both modes.
  bench(`fast path × ${validatedLinkCount} calls`, () => {
    for (let i = 0; i < validatedLinkCount; i++)
      isRegisteredEncryptionKey(decodedState, currentMember.userId, currentKey)
  })

  bench(`superseded generation × ${validatedLinkCount} calls, decoded state`, () => {
    for (let i = 0; i < validatedLinkCount; i++)
      isRegisteredEncryptionKey(decodedState, fallback.bobUserId, supersededKey)
  })

  bench(`superseded generation × ${validatedLinkCount} calls, locally built state`, () => {
    for (let i = 0; i < validatedLinkCount; i++)
      isRegisteredEncryptionKey(locallyBuiltState, fallback.bobUserId, supersededKey)
  })

  bench(`unregistered key, full scan × ${validatedLinkCount} calls, locally built state`, () => {
    for (let i = 0; i < validatedLinkCount; i++)
      isRegisteredEncryptionKey(locallyBuiltState, currentMember.userId, unregisteredKey)
  })
})
