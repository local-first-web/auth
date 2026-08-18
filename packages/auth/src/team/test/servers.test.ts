import { createKeyset, redactKeys } from '@localfirst/crdx'
import type { Host, Server, ServerWithSecrets } from 'server/index.js'
import { KeyType } from 'util/index.js'
import { eventPromise } from '@localfirst/shared'
import { symmetric } from '@localfirst/crypto'
import {
  TestChannel,
  all,
  joinTestChannel,
  setup as setupHumans,
  type SetupConfig,
  type UserStuff,
} from 'util/testing/index.js'
import { describe, expect, it } from 'vitest'
import {
  createTeam,
  invitation,
  loadTeam,
  type Connection,
  type Context,
  type InviteeDeviceContext,
  type MemberContext,
  type Team,
} from 'index.js'

describe('Team', () => {
  describe('a server', () => {
    it('can be added and removed by an admin', () => {
      const { alice } = setupHumans('alice')

      // Add server
      const { server } = createServer(host)
      alice.team.addServer(server)
      expect(alice.team.servers().length).toBe(1)

      // Look up server
      const serverFromTeam = alice.team.servers(host)
      expect(serverFromTeam.host).toBe(host)

      // Remove server
      alice.team.removeServer(host)
      expect(alice.team.servers().length).toBe(0)
      expect(alice.team.serverWasRemoved(host)).toBe(true)
    })

    it('loses access to the team keys when it is removed', () => {
      const { alice, bob } = setupHumans('alice', 'bob')
      const { server } = createServer(host)
      alice.team.addServer(server)

      // The server was given the team keys, so removing it has to leave those keys behind
      const teamKeysWhileOnTheTeam = alice.team.teamKeys()
      expect(teamKeysWhileOnTheTeam.generation).toBe(0)

      alice.team.removeServer(host)

      // The team keys have been rotated
      const currentTeamKeys = alice.team.teamKeys()
      expect(currentTeamKeys.generation).toBe(1)
      expect(currentTeamKeys.encryption.publicKey).not.toEqual(
        teamKeysWhileOnTheTeam.encryption.publicKey
      )

      // ❌ Anything the team encrypts from here on is closed to the ex-server
      const encrypted = alice.team.encrypt('the eagle has landed')
      expect(() =>
        symmetric.decryptBytes(encrypted.contents, teamKeysWhileOnTheTeam.secretKey)
      ).toThrow()

      // ✅ But the members still on the team can read it
      bob.team = loadTeam(alice.team.save(), bob.localContext, alice.team.teamKeyring())
      expect(bob.team.decrypt(encrypted)).toEqual('the eagle has landed')
    })

    it("throws if a named server doesn't exist on the team", () => {
      const { alice } = setupHumans('alice')
      expect(() => alice.team.servers('foo.com')).toThrow()
    })

    it('can be re-added after being removed', () => {
      const { alice } = setupHumans('alice')

      // Add server
      const { server } = createServer(host)
      alice.team.addServer(server)
      expect(alice.team.servers().length).toBe(1)

      // Remove server
      alice.team.removeServer(host)
      expect(alice.team.servers().length).toBe(0)
      expect(alice.team.serverWasRemoved(host)).toBe(true)

      // Add server again
      alice.team.addServer(server)
      expect(alice.team.servers().length).toBe(1)
      expect(alice.team.serverWasRemoved(host)).toBe(false)
    })

    it("can't be added by a non-admin member", () => {
      const { bob } = setupHumans('alice', { user: 'bob', admin: false })

      const { server } = createServer(host)
      const tryToAddServer = () => {
        bob.team.addServer(server)
      }

      expect(tryToAddServer).toThrowError()
      expect(bob.team.servers().length).toBe(0)
    })

    it("can't be removed by a non-admin member", () => {
      const { alice, bob } = setupHumans('alice', { user: 'bob', admin: false })

      // Add server
      const { server } = createServer(host)
      alice.team.addServer(server)
      expect(alice.team.servers().length).toBe(1)

      const tryToRemoveServer = () => {
        bob.team.removeServer(host)
      }

      expect(tryToRemoveServer).toThrowError()
    })

    it('can decrypt a team graph', () => {
      const { alice } = setupHumans('alice', 'bob', {
        user: 'charlie',
        admin: false,
      })
      const { server, serverWithSecrets } = createServer(host)
      alice.team.addServer(server)

      // Add some stuff to the team graph
      alice.team.addRole('MANAGER')
      const { id: memberInviteId } = alice.team.inviteMember()
      const { id: deviceInviteId } = alice.team.inviteDevice()

      const savedGraph = alice.team.save()
      const teamKeys = alice.team.teamKeys()

      // The server instantiates the team
      const serverTeam = loadTeam(savedGraph, { server: serverWithSecrets }, teamKeys)

      // All the stuff that should be on the graph is there
      expect(serverTeam.members().length).toBe(3)
      expect(serverTeam.roles('MANAGER')).toBeDefined()
      expect(serverTeam.getInvitation(memberInviteId)).toBeDefined()
      expect(serverTeam.getInvitation(deviceInviteId)).toBeDefined()
    })

    it('syncs with a user - changes made before connecting', async () => {
      const { server, alice } = setup('alice')

      // Alice makes a change
      alice.team.addRole('MANAGER')

      // Alice connects to the server
      await connectWithServer(alice, server)

      // The server gets the change
      expect(server.team.roles('MANAGER')).toBeDefined()
    })

    it('syncs with a user - changes made after connecting', async () => {
      const { server, alice } = setup('alice')

      // Alice connects to the server
      await connectWithServer(alice, server)

      // Alice makes a change
      alice.team.addRole('MANAGER')

      // The server gets the change
      await eventPromise(server.team, 'updated')
      expect(server.team.roles('MANAGER')).toBeDefined()
    })

    it("can't create a team", () => {
      const { serverWithSecrets } = createServer(host)
      expect(() => {
        createTeam('team server', {
          server: serverWithSecrets,
        })
      }).toThrow()
    })

    it("can't invite a member", () => {
      const { server } = setup('alice')

      expect(() => server.team.inviteMember()).toThrow()
    })

    it('can admit an invitee', async () => {
      const { server, alice, bob } = setup('alice', {
        user: 'bob',
        member: false,
      })
      const { seed: bobInvite } = alice.team.inviteMember()

      // The server learns about the invitation by connecting with Alice
      await connectWithServer(alice, server)

      // Now if Bob connects to the server, the server can admit him
      server.team.admitMember(
        invitation.generateProof(bobInvite, bob.user.keys),
        bob.user.keys,
        bob.userId
      )
      expect(server.team.members().length).toBe(2)
    })

    it("can't invite a device", () => {
      const { server } = setup('alice')
      expect(() => server.team.inviteDevice()).toThrow()
    })

    it("can't remove a member", () => {
      const { server, bob } = setup('alice', 'bob')
      expect(() => {
        server.team.remove(bob.userId)
      }).toThrow()
    })

    it('can relay changes from one member to another asynchronously', async () => {
      const { server, alice, bob } = setup('alice', 'bob')

      // Alice makes a change
      alice.team.addRole('MANAGER')

      // Alice connects to the server
      await connectWithServer(alice, server)

      // Server learned of the change
      expect(server.team.roles('MANAGER')).toBeDefined()

      // Alice disconnects from the server
      alice.connection[host].stop()
      server.connection[alice.userId].stop()

      // Bob connects to the server
      await connectWithServer(bob, server)

      // Server told bob about new role
      expect(bob.team.roles('MANAGER')).toBeDefined()
    })

    it('can admit a device invited by a member', async () => {
      const { server, alice, bob } = setup('alice', 'bob')
      const { seed } = bob.team.inviteDevice()

      // Bob's laptop connects to the server, so now it knows about the invitation
      await connectWithServer(bob, server)

      // Bob's laptop disconnects from the server
      bob.connection[host].stop()
      server.connection[bob.userId].stop()

      // Bob's phone connects to the server
      const phoneContext: InviteeDeviceContext = {
        userName: bob.userName,
        device: bob.phone!,
        invitationSeed: seed,
      }
      const join = joinTestChannel(new TestChannel())
      const serverConnection = join(server.connectionContext).start()
      const phoneConnection = join(phoneContext).start()
      await all([serverConnection, phoneConnection], 'connected')

      // const phoneTeam = phoneConnection.team!

      // Bob reconnects to the server
      await connectWithServer(bob, server)

      // 👨🏻‍🦲👍📱 Bob's phone is added to his list of devices
      expect(bob.team.members(bob.userId).devices).toHaveLength(2)

      // ✅ 👩🏾👍📱 Alice knows about Bob's phone
      await connectWithServer(alice, server)
      expect(alice.team.members(bob.userId).devices).toHaveLength(2)
    })

    it(`can't change its own keys`, async () => {
      const { alice } = setupHumans('alice', 'bob')
      const { server, serverWithSecrets } = createServer(host)
      alice.team.addServer(server)

      const host2 = 'foo.com'
      const { server: server2 } = createServer(host2)
      alice.team.addServer(server2)

      const savedGraph = alice.team.save()
      const aliceTeamKeys = alice.team.teamKeys()
      const serverTeam = loadTeam(savedGraph, { server: serverWithSecrets }, aliceTeamKeys)

      expect(serverTeam.teamKeys().generation).toBe(0)

      // A server can only admit members and devices, and changing keys isn't that — rotating the
      // team keys is something only the team's own members get to do
      expect(() => {
        serverTeam.changeKeys(createKeyset({ type: KeyType.SERVER, name: host }))
      }).toThrow(/server/i)

      // No keys have been rotated
      expect(serverTeam.teamKeys().generation).toBe(0)
      expect(serverTeam.servers(host).keys.generation).toBe(0)
    })

    it(`can't invite a device by authoring a link directly`, async () => {
      const { server, alice } = setup('alice')

      // A server holds the team keys, so it can author links itself rather than going through the
      // methods that refuse to run on a server. If it could post an invitation, it could name any
      // member as the owner and then admit a device of its own onto that member's account.
      const tryToInviteDevice = () => {
        server.team.dispatch({
          type: 'INVITE_DEVICE',
          payload: {
            invitation: invitation.create({
              kind: 'DEVICE',
              seed: 'passw0rd',
              userId: alice.userId,
            }),
          },
        })
      }

      expect(tryToInviteDevice).toThrow(/server/i)
      expect(Object.keys(server.team.state.invitations)).toHaveLength(0)
    })

    it(`can't set the team name`, async () => {
      const { server } = setup('alice')

      const tryToRenameTeam = () => {
        server.team.setTeamName('Servers Я Us')
      }

      expect(tryToRenameTeam).toThrow(/server/i)
    })

    it(`can't change a member's keys`, async () => {
      const { server, alice } = setup('alice')

      // The server makes up new keys for Alice, which it would then hold the secrets for
      const evilKeys = createKeyset({ type: KeyType.USER, name: alice.userId })
      const tryToChangeAlicesKeys = () => {
        server.team.dispatch({
          type: 'CHANGE_MEMBER_KEYS',
          payload: { keys: redactKeys(evilKeys) },
        })
      }

      expect(tryToChangeAlicesKeys).toThrow(/server/i)
      expect(server.team.members(alice.userId).keys.encryption).not.toBe(
        evilKeys.encryption.publicKey
      )
    })

    it(`can't change another server's keys`, async () => {
      const { alice } = setupHumans('alice', 'bob')
      const { server, serverWithSecrets } = createServer(host)
      alice.team.addServer(server)

      const host2 = 'foo.com'
      const { server: server2 } = createServer(host2)
      alice.team.addServer(server2)

      const savedGraph = alice.team.save()
      const aliceTeamKeys = alice.team.teamKeys()
      const serverTeam = loadTeam(savedGraph, { server: serverWithSecrets }, aliceTeamKeys)

      expect(serverTeam.teamKeys().generation).toBe(0)
      expect(serverTeam.servers(host2).keys.generation).toBe(0)

      // server tries to change another server's keys
      expect(() => {
        serverTeam.changeKeys(createKeyset({ type: KeyType.SERVER, name: host2 }))
      }).toThrow()

      // No keys have been rotated
      expect(serverTeam.teamKeys().generation).toBe(0)
      expect(serverTeam.servers(host2).keys.generation).toBe(0)
    })
  })
})

const connectionPromise = async (a: Connection, b: Connection) => {
  const connections = [a, b]

  // ✅ They're both connected
  await all(connections, 'connected')

  const sharedKey = connections[0]._sessionKey
  for (const connection of connections) {
    expect(connection.state).toEqual('connected')
    // ✅ They've converged on a shared secret key
    expect(connection._sessionKey).toEqual(sharedKey)
  }
}

const connectWithServer = async (user: UserStuff, server: ServerStuff) => {
  const join = joinTestChannel(new TestChannel())

  user.connection[host] = join(user.connectionContext).start()
  server.connection[user.userId] = join(server.connectionContext).start()

  return connectionPromise(user.connection[host], server.connection[user.userId])
}

const createServer = (host: Host) => {
  const serverKeys = createKeyset({ type: KeyType.SERVER, name: host })
  const serverWithSecrets: ServerWithSecrets = { host, keys: serverKeys }
  const server: Server = { host, keys: redactKeys(serverKeys) }
  return { server, serverWithSecrets }
}

const host = 'example.com'

const setup = (...humanUsers: SetupConfig) => {
  const serverKeys = createKeyset({ type: KeyType.SERVER, name: host })
  const serverWithSecrets: ServerWithSecrets = { host, keys: serverKeys }
  const server: Server = { host, keys: redactKeys(serverKeys) }

  const users = setupHumans(...humanUsers)

  const founder = users[humanUsers[0] as string]
  const teamKeys = founder.team.teamKeys()

  // Add the server to one team
  founder.team.addServer(server)
  const savedGraph = founder.team.save()

  // Set everybody's team to the one containing the server
  for (const userStuff of Object.values(users)) {
    const { userId, user, device, team } = userStuff
    if (userId === founder.userId) continue

    if (team) {
      const newTeam = loadTeam(savedGraph, { user, device }, teamKeys)
      userStuff.team = newTeam
      const connectionContext = userStuff.connectionContext as MemberContext
      connectionContext.team = newTeam
    }
  }

  const serverTeam = loadTeam(savedGraph, { server: serverWithSecrets }, teamKeys)

  const serverStuff = {
    server,
    serverWithSecrets,
    team: serverTeam,

    connectionContext: {
      server: serverWithSecrets,
      team: serverTeam,
    },
    connection: {},
  } as ServerStuff
  return {
    ...users,
    server: serverStuff,
  } as Record<string, UserStuff> & { server: ServerStuff }
}

type ServerStuff = {
  server: Server
  serverWithSecrets: ServerWithSecrets
  team: Team
  connectionContext: Context
  connection: Record<string, Connection>
}
