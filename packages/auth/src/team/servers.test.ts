import { Host, Server, ServerWithSecrets } from '@/server'
import { all, connection, joinTestChannel, setup, TestChannel } from '@/util/testing'
import { createKeyset, createUser, KeyType, redactKeys } from 'crdx'
import { Connection, createDevice, createTeam, invitation, loadTeam } from '..'

describe('Team', () => {
  describe('a server', () => {
    const host = 'devresults.com'

    const createServer = (host: Host) => {
      const serverKeys = createKeyset({ type: KeyType.SERVER, name: host })
      const serverWithSecrets: ServerWithSecrets = { host, keys: serverKeys }
      const server: Server = { host, keys: redactKeys(serverKeys) }
      return { server, serverWithSecrets }
    }

    it('can be added and removed by an admin', () => {
      const { alice } = setup('alice')

      // add server
      const { server } = createServer(host)
      alice.team.addServer(server)
      expect(alice.team.servers().length).toBe(1)

      // look up server
      const serverFromTeam = alice.team.servers(host)
      expect(serverFromTeam.host).toBe(host)

      // remove server
      alice.team.removeServer(host)
      expect(alice.team.servers().length).toBe(0)
      expect(alice.team.serverWasRemoved(host)).toBe(true)
    })

    it(`can't be added by a non-admin member`, () => {
      const { bob } = setup('alice', { user: 'bob', admin: false })

      const { server } = createServer(host)
      const tryToAddServer = () => bob.team.addServer(server)

      expect(tryToAddServer).toThrowError()
      expect(bob.team.servers().length).toBe(0)
    })

    it(`can't be removed by a non-admin member`, () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })

      // add server
      const { server } = createServer(host)
      alice.team.addServer(server)
      expect(alice.team.servers().length).toBe(1)

      const tryToRemoveServer = () => bob.team.removeServer(host)
      expect(tryToRemoveServer).toThrowError()
    })

    it(`can decrypt a team graph`, () => {
      const { alice } = setup('alice', 'bob', { user: 'charlie', admin: false })
      const { server, serverWithSecrets } = createServer(host)
      alice.team.addServer(server)

      // add some stuff to the team graph
      alice.team.addRole('MANAGER')
      const { id: memberInviteId } = alice.team.inviteMember()
      const { id: deviceInviteId } = alice.team.inviteDevice()

      const savedGraph = alice.team.save()
      const teamKeys = alice.team.teamKeys()

      // the server instantiates the team
      const serverTeam = loadTeam(savedGraph, { server: serverWithSecrets }, teamKeys)

      // all the stuff that should be on the graph is there
      expect(serverTeam.members().length).toBe(3)
      expect(serverTeam.roles('MANAGER')).toBeDefined()
      expect(serverTeam.getInvitation(memberInviteId)).toBeDefined()
      expect(serverTeam.getInvitation(deviceInviteId)).toBeDefined()
    })

    it(`can sync with a member`, async () => {
      const { alice } = setup('alice', 'bob', { user: 'charlie', admin: false })
      const { server, serverWithSecrets } = createServer(host)
      alice.team.addServer(server)
      const savedGraph = alice.team.save()
      const teamKeys = alice.team.teamKeys()
      const serverTeam = loadTeam(savedGraph, { server: serverWithSecrets }, teamKeys)

      alice.team.addRole('MANAGER')

      const join = joinTestChannel(new TestChannel())

      const aliceConnectionContext = {
        user: alice.user,
        device: alice.device,
        team: alice.team,
      }
      const serverConnectionContext = {
        user: {
          userName: host,
          userId: host,
          keys: serverWithSecrets.keys,
        },
        device: {
          userId: host,
          deviceName: host,
          keys: serverWithSecrets.keys,
        },
        team: serverTeam,
      }

      const aliceConnection = join(aliceConnectionContext).start()
      const serverConnection = join(serverConnectionContext).start()

      await connectionPromise(aliceConnection, serverConnection)

      expect(serverTeam.roles('MANAGER')).toBeDefined()
    })

    it.skip(`can't create a team`, () => {
      const { serverWithSecrets } = createServer(host)
      expect(() => {
        createTeam('team server', {
          user: {
            userName: host,
            userId: host,
            keys: serverWithSecrets.keys,
          },
          device: {
            userId: host,
            deviceName: host,
            keys: serverWithSecrets.keys,
          },
        })
      }).toThrow()
    })

    it(`can't invite a member`, () => {
      const { alice } = setup('alice')
      const { server, serverWithSecrets } = createServer(host)
      alice.team.addServer(server)
      const savedGraph = alice.team.save()
      const teamKeys = alice.team.teamKeys()
      const serverTeam = loadTeam(savedGraph, { server: serverWithSecrets }, teamKeys)

      expect(() => serverTeam.inviteMember()).toThrow()
    })

    it(`can admit an invitee`, () => {
      const { alice, bob } = setup('alice', { user: 'bob', member: false })
      const { server, serverWithSecrets } = createServer(host)
      alice.team.addServer(server)
      const { seed: bobInvite } = alice.team.inviteMember()

      const savedGraph = alice.team.save()
      const teamKeys = alice.team.teamKeys()
      const serverTeam = loadTeam(savedGraph, { server: serverWithSecrets }, teamKeys)

      serverTeam.admitMember(invitation.generateProof(bobInvite), bob.user.keys, bob.userId)
      expect(serverTeam.members().length).toBe(2)
    })

    it(`can't invite a device`, () => {
      const { alice } = setup('alice')
      const { server, serverWithSecrets } = createServer(host)
      alice.team.addServer(server)
      const savedGraph = alice.team.save()
      const teamKeys = alice.team.teamKeys()
      const serverTeam = loadTeam(savedGraph, { server: serverWithSecrets }, teamKeys)

      expect(() => serverTeam.inviteDevice()).toThrow()
    })

    it(`can't remove a member`, () => {
      const { alice, bob } = setup('alice', 'bob')
      const { server, serverWithSecrets } = createServer(host)
      alice.team.addServer(server)
      const savedGraph = alice.team.save()
      const teamKeys = alice.team.teamKeys()
      const serverTeam = loadTeam(savedGraph, { server: serverWithSecrets }, teamKeys)

      expect(() => serverTeam.remove(bob.userId)).toThrow()
    })

    it.todo(`can relay changes from one member to another asynchronously`)

    it.todo(`can change its own keys`)
  })
})

const connectionPromise = async (a: Connection, b: Connection) => {
  const connections = [a, b]

  // ✅ They're both connected
  await all(connections, 'connected')

  const sharedKey = connections[0].sessionKey
  connections.forEach(connection => {
    expect(connection.state).toEqual('connected')
    // ✅ They've converged on a shared secret key
    expect(connection.sessionKey).toEqual(sharedKey)
  })
}
