import { getSequence, type Base58 } from '@localfirst/crdx'
import { bench, describe } from 'vitest'
import { redactDevice, type DeviceWithSecrets } from 'device/index.js'
import { type KeyManifest } from 'lockbox/index.js'
import { ADMIN } from 'role/index.js'
import * as teams from 'team/index.js'
import { membershipResolver } from 'team/membershipResolver.js'
import { isRegisteredEncryptionKey } from 'team/registeredEncryptionKeys.js'
import { type TeamAction, type TeamContext, type TeamGraph } from 'team/types.js'
import { KeyType } from 'util/index.js'
import * as Auth from '../index.js'

/**
 * `isRegisteredEncryptionKey` runs once per link in the `linkAuthorshipIsAuthentic` validator, so
 * its cost is paid on every reduction of a whole graph. It checks the author's current key
 * generation first — a scan of the member list — and only falls back to scanning every lockbox when
 * that misses, which is O(lockboxes) per link. These benchmarks size both paths on a chain that has
 * rotated keys many times, so the lockbox set is large.
 *
 * ## Measurements
 *
 * On an M-series laptop under Node 20.10, at the sizes configured below — 217 links, 2212 lockboxes,
 * 60 of those links authored under a superseded generation — over four runs:
 *
 * | measurement                                              | mean            |
 * | -------------------------------------------------------- | --------------- |
 * | reduce the chain, every link on the fast path             | 96.4–98.6 ms    |
 * | reduce the same chain, 60 links on the fallback           | 101.6–111.1 ms  |
 * | 217 fast-path calls                                       | 0.042 ms        |
 * | 217 fallback calls, key found near the end of the scan    | 55.7 ms         |
 * | 217 fallback calls, key never registered (full scan)      | 64.6 ms         |
 *
 * So the fallback is expensive per call — roughly 0.06 µs per lockbox visited — but the fast path
 * costs essentially nothing, and the gap between the two reductions is 5–7%, with the two runs'
 * error bars (±3–6%) overlapping. It is a real effect: the minima separate cleanly, and the sign was
 * the same in all four runs. It is also small, and it takes a deliberately unlucky chain to see it.
 *
 * ## How often the fallback is actually reached
 *
 * Measured by adding counters to `isRegisteredEncryptionKey` temporarily (the instrumentation is not
 * committed; the numbers are):
 *
 * - Across the whole test suite (517 tests), the fallback was entered 4 times. Three were the
 *   forgery-rejection tests, where the key is unregistered on purpose. The fourth was a device
 *   removal.
 * - A 100-member chain with 30 member removals — 231 links, 3263 lockboxes — takes the fast path on
 *   all 230 calls. Removing a member rotates the team and role keys, not the other members' own
 *   keys; and a link is validated against the state as of its own position in the sequence, so in a
 *   linear chain the author's registered key is by construction the one they authored with.
 * - The fallback is reached in bulk only when a run of links is authored under a generation that a
 *   *concurrent* branch has superseded — which means someone rotated that author's own user keys
 *   while they were offline. `topoSort` emits an unbranched run contiguously, so such a run lands
 *   entirely before or entirely after the rotation, decided by link hashes. That is what the
 *   scenario below constructs, retrying until it gets one chain of each kind.
 * - A scan that ends in a miss costs a full pass, but can only happen once per reduction: failing
 *   this validator throws, which aborts the reduction.
 * - Scanning stops at the first match, and a superseded generation was lockboxed when it was minted
 *   — so the scan is O(position of that generation), not O(lockboxes). When the author's superseded
 *   keys are their original ones, the match is near the front: an offline run of 25 links over a
 *   498-lockbox chain visited 4 lockboxes per call. The scenario below is the unfavorable case,
 *   where the author's generation is minted late and each scan visits ~1800 of 2212.
 *
 * ## Conclusion
 *
 * No change warranted, so none was made. Indexing the registered keys incrementally in `TeamState`
 * would make the lookup constant-time, but what it would buy is 0.04% of a reduction in the ordinary
 * case and 5–7% in a constructed worst case, against the cost of derived state that every transform
 * has to keep correct.
 *
 * The one thing that would change the answer is scale: the fallback is O(lockboxes) while the rest
 * of a reduction is roughly O(links), so its share grows with members × rotations. Worth revisiting
 * if lockbox counts reach the tens of thousands and concurrent key rotation is common.
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

  const aliceUser = Auth.createUser('alice', seed('alice'))
  const aliceLaptop = Auth.createDevice({ userId: aliceUser.userId, deviceName: 'laptop' })
  const alice = Auth.createTeam('Test', { user: aliceUser, device: aliceLaptop })

  const bobUser = Auth.createUser('bob', seed('bob'))
  const bobDevice = (deviceName: string) =>
    Auth.createDevice({ userId: bobUser.userId, deviceName })
  const bobLaptop = bobDevice('laptop')
  const bobPhone = bobDevice('phone')
  const bobSpare = bobDevice('spare')
  alice.addForTesting(bobUser, [ADMIN], redactDevice(bobLaptop))

  const filler: string[] = []
  for (let i = 0; i < MEMBERS; i++) {
    const user = Auth.createUser(`user-${i}`, seed(`user-${i}`))
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
    state: alice.state,
  }
}

type Scenario = ReturnType<typeof buildScenario>

/**
 * Whether Bob's offline run is sequenced after the rotation that supersedes the keys he authored it
 * with. If it is, every link in the run misses the fast path.
 */
const runIsAfterRotation = (graph: TeamGraph) => {
  const sequence = getSequence<TeamAction, TeamContext>(graph, membershipResolver)
  const lastRotation = sequence.findLastIndex(link => link.body.type === 'REMOVE_DEVICE')
  const startOfRun = sequence.findIndex(
    link => link.body.type === 'ADD_ROLE' && link.body.payload.roleName.startsWith('role-')
  )
  return lastRotation < startOfRun
}

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
    if (runIsAfterRotation(scenario.graph)) fallback ??= scenario
    else fastPath ??= scenario
  }

  if (!fastPath || !fallback)
    throw new Error(
      "Couldn't build a chain of each kind — the sequencer put the offline run on the same side of the rotation every time"
    )

  return { fastPath, fallback }
}

const { fastPath, fallback } = buildPair()

const { state } = fallback
const linkCount = Object.keys(fallback.graph.links).length
const lockboxCount = state.lockboxes.length

// A key that's current for its member, so the member-list scan answers it
const currentMember = state.members.at(-1)!
const currentKey = currentMember.keys.encryption

/**
 * A key that rotation has superseded. Removing a member mints a new generation of their own user
 * keys, which lands in a lockbox but never replaces the generation recorded against the removed
 * member — so looking it up misses the fast path. We take the last such key, so the scan runs most
 * of the way before it hits.
 */
const isSuperseded = ({ type, name, publicKey }: KeyManifest) => {
  if (type !== KeyType.USER) return false
  const member = [...state.members, ...state.removedMembers].find(m => m.userId === name)
  return member !== undefined && member.keys.encryption !== publicKey
}

const supersededEntry = state.lockboxes
  .map(({ contents }) => contents)
  .filter(entry => isSuperseded(entry))
  .at(-1)!

// A key that was never registered for anyone, so the scan runs to the end and returns false
const unregisteredKey = Auth.createUser('nobody', 'nobody').keys.encryption
  .publicKey as unknown as Base58

const reduce = ({ serialized, context, keyring }: Scenario) => {
  teams.load(serialized, context, keyring)
}

describe(`registered encryption keys (${linkCount} links, ${lockboxCount} lockboxes)`, () => {
  // The two reductions differ only in which side of the rotation the offline run is sequenced on,
  // so the gap between them is what the fallback costs across a whole reduction
  bench('reduce a chain whose offline run stays on the fast path', () => {
    reduce(fastPath)
  })

  bench(`reduce a chain with ${OFFLINE_LINKS} links on the fallback`, () => {
    reduce(fallback)
  })

  // The validator's own contribution, one call per link, on each path
  bench('fast path × one call per link', () => {
    for (let i = 0; i < linkCount; i++)
      isRegisteredEncryptionKey(state, currentMember.userId, currentKey)
  })

  bench('superseded generation × one call per link', () => {
    for (let i = 0; i < linkCount; i++)
      isRegisteredEncryptionKey(state, supersededEntry.name, supersededEntry.publicKey)
  })

  bench('unregistered key, full scan × one call per link', () => {
    for (let i = 0; i < linkCount; i++)
      isRegisteredEncryptionKey(state, currentMember.userId, unregisteredKey)
  })
})
