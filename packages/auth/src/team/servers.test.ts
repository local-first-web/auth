import { Host, Server, ServerWithSecrets } from '@/server'
import { setup } from '@/util/testing'
import { createKeyset, createUser, redactKeys } from 'crdx'
import { createDevice, createTeam, loadTeam } from '..'

describe('Team', () => {
  describe('a server', () => {
    const host = 'devresults.com'

    const createServer = (host: Host) => {
      const serverKeys = createKeyset({ type: 'SERVER', name: host })
      const serverWithSecrets: ServerWithSecrets = {
        host,
        keys: createKeyset({ type: 'SERVER', name: host }),
      }
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
      const aliceNewKeys = createKeyset({ type: 'USER', name: alice.userId })
      alice.team.changeKeys(aliceNewKeys)
      alice.team.inviteMember()
      alice.team.inviteDevice()

      const savedGraph = alice.team.save()
      const teamKeys = alice.team.teamKeys()

      // the server instantiates the team
      const serverTeam = loadTeam(savedGraph, { server: serverWithSecrets }, teamKeys)

      expect(serverTeam.members().length).toBe(3)
    })
    it.todo(`can sync with a member`)
    it.todo(`can admit an invitee`)
    it.todo(`can't invite a member`)
    it.todo(`can't invite a device`)
    it.todo(`can't remove a member`)
    it.todo(`can change its own keys`)
  })
})
