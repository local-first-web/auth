import { Host, Server, ServerWithSecrets } from '@/server'
import { KeyType } from '@/util'
import { all, joinTestChannel, setup, TestChannel } from '@/util/testing'
import { createKeyset, redactKeys } from 'crdx'
import { Connection, createTeam, invitation, loadTeam } from '..'

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

    it(`can't create a team`, () => {
      const { serverWithSecrets } = createServer(host)
      expect(() => {
        createTeam('team server', {
          server: serverWithSecrets,
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

    it(`can relay changes from one member to another asynchronously`, async () => {
      const { alice, bob } = setup('alice', 'bob')
      const { server, serverWithSecrets } = createServer(host)
      alice.team.addServer(server)
      const savedGraph = alice.team.save()
      const teamKeys = alice.team.teamKeys()
      const serverTeam = loadTeam(savedGraph, { server: serverWithSecrets }, teamKeys)
      bob.team = loadTeam(savedGraph, bob, teamKeys)

      alice.team.addRole('MANAGER')

      const joinAandS = joinTestChannel(new TestChannel())

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

      const aliceConnection = joinAandS(aliceConnectionContext).start()
      const serverConnection = joinAandS(serverConnectionContext).start()

      await connectionPromise(aliceConnection, serverConnection)

      // alice told server about new role
      expect(serverTeam.roles('MANAGER')).toBeDefined()

      aliceConnection.stop()
      serverConnection.stop()

      const joinBandS = joinTestChannel(new TestChannel())

      const bobConnectionContext = {
        user: bob.user,
        device: bob.device,
        team: bob.team,
      }
      const bobConnection = joinBandS(bobConnectionContext).start()
      const serverConnection2 = joinBandS(serverConnectionContext).start()

      await connectionPromise(bobConnection, serverConnection2)

      // server told bob about new role
      expect(bob.team.roles('MANAGER')).toBeDefined()
    })

    it(`can change its own keys`, async () => {
      const { alice, bob } = setup('alice', 'bob')
      const { server, serverWithSecrets } = createServer(host)
      alice.team.addServer(server)
      const savedGraph = alice.team.save()
      const teamKeys = alice.team.teamKeys()
      const serverTeam = loadTeam(savedGraph, { server: serverWithSecrets }, teamKeys)

      const teamKeys0 = serverTeam.teamKeys()
      expect(teamKeys0.generation).toBe(0)

      // Server changes their keys
      serverTeam.changeKeys(createKeyset({ type: KeyType.SERVER, name: host }))

      // server keys have been rotated
      expect(serverTeam.servers(host).keys.generation).toBe(1)

      // Server still has access to team keys
      const teamKeys1 = serverTeam.teamKeys()
      // why aren't the team keys rotated??
      // expect(teamKeys1.generation).toBe(1) // the team keys were rotated, so these are new
    })
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
