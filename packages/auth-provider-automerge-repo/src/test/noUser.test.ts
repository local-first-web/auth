import { Repo, type PeerId } from '@automerge/automerge-repo'
import { MessageChannelNetworkAdapter } from '@automerge/automerge-repo-network-messagechannel'
import { NodeFSStorageAdapter } from '@automerge/automerge-repo-storage-nodefs'
import * as Auth from '@localfirst/auth'
import { pause } from '@localfirst/shared'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../AuthProvider.js'
import { getStorageDirectory } from './helpers/setup.js'

/**
 * An AuthProvider can be created with only a device — that's how a new device joins a team it's
 * been invited to, before anyone has given it the user's keys. Every other path needs the user, and
 * these are the three that used to reach for it through a cast and then fail somewhere else, out of
 * `new Team`, as `Cannot read properties of undefined (reading 'userId')`.
 */
describe('AuthProvider without a user', () => {
  it("won't create a team", async () => {
    const storage = new NodeFSStorageAdapter(getStorageDirectory('no-user-create-team'))
    const device = Auth.createDevice({ userId: 'alice', deviceName: "Alice's phone" })
    const auth = new AuthProvider({ device, storage })

    await expect(auth.createTeam('team A')).rejects.toThrowError(/has no user/i)
  })

  it("won't load a stored team share", async () => {
    const storageDir = getStorageDirectory('no-user-load-state')

    // Alice's laptop saves a team share
    const user = Auth.createUser('alice')
    const laptop = Auth.createDevice({ userId: user.userId, deviceName: "Alice's laptop" })
    const laptopAuth = new AuthProvider({
      user,
      device: laptop,
      storage: new NodeFSStorageAdapter(storageDir),
    })
    await laptopAuth.addTeam(Auth.createTeam('team A', { user, device: laptop }))

    // The application restarts us on the same storage, but without the user
    const [error] = await collectingUnhandledRejections(async firstRejection => {
      const _auth = new AuthProvider({
        device: laptop,
        storage: new NodeFSStorageAdapter(storageDir),
      })
      await firstRejection
    })

    expect((error as Error).message).toMatch(/has no user/i)
  })

  it("won't build a member context for a peer on a team it has", async () => {
    // Alice's laptop has a team, and 👨🏻‍🦲 Bob has the same team
    const user = Auth.createUser('alice')
    const laptop = Auth.createDevice({ userId: user.userId, deviceName: "Alice's laptop" })
    const team = Auth.createTeam('team A', { user, device: laptop })

    const bob = Auth.createUser('bob')
    const bobDevice = Auth.createDevice({ userId: bob.userId, deviceName: "Bob's laptop" })
    const bobTeam = Auth.loadTeam(team.save(), { user: bob, device: bobDevice }, team.teamKeyring())

    const { port1: aliceToBob, port2: bobToAlice } = new MessageChannel()

    // ...but the provider holding Alice's copy was created with only a device
    const [error] = await collectingUnhandledRejections(async firstRejection => {
      const aliceAuth = new AuthProvider({
        device: laptop,
        storage: new NodeFSStorageAdapter(getStorageDirectory('no-user-member-context-alice')),
      })
      const _aliceRepo = new Repo({
        peerId: laptop.deviceId as PeerId,
        network: [aliceAuth.wrap(new MessageChannelNetworkAdapter(aliceToBob))],
      })

      const bobAuth = new AuthProvider({
        user: bob,
        device: bobDevice,
        storage: new NodeFSStorageAdapter(getStorageDirectory('no-user-member-context-bob')),
      })
      const _bobRepo = new Repo({
        peerId: bobDevice.deviceId as PeerId,
        network: [bobAuth.wrap(new MessageChannelNetworkAdapter(bobToAlice))],
      })

      await Promise.all([aliceAuth.addTeam(team), bobAuth.addTeam(bobTeam)])
      await firstRejection

      aliceToBob.close()
      bobToAlice.close()
    })

    expect((error as Error).message).toMatch(/has no user/i)
  })
})

/**
 * All three of these paths throw where nothing is holding the promise they throw in, so the only
 * place to see what they threw is Node's unhandled-rejection hook. That's a defect of its own —
 * see auth-zf1 — and here it's just how we get to look at the error.
 *
 * `fn` is given a promise that resolves on the first rejection. Everything it rejects with while
 * `fn` runs is collected, and the test runner's own handlers are put back afterwards, so a leftover
 * retry from a peer that hasn't given up yet doesn't get reported as a failure of the run.
 */
const collectingUnhandledRejections = async (
  fn: (firstRejection: Promise<unknown>) => Promise<void>
) => {
  const handlers = process.listeners('unhandledRejection')
  process.removeAllListeners('unhandledRejection')

  const rejections: unknown[] = []
  let onFirst: (error: unknown) => void
  const firstRejection = new Promise<unknown>(resolve => {
    onFirst = resolve
  })
  const collect = (error: unknown) => {
    rejections.push(error)
    onFirst(error)
  }
  process.on('unhandledRejection', collect)

  try {
    await fn(firstRejection)
    await pause(50) // let any retries in flight land here rather than after we've stepped away
    return rejections
  } finally {
    process.removeListener('unhandledRejection', collect)
    for (const handler of handlers) process.on('unhandledRejection', handler)
  }
}
