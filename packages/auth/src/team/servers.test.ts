import { Host, Server } from '@/server'
import { setup } from '@/util/testing'
import { createKeyset, createUser, redactKeys } from 'crdx'
import { createDevice, createTeam } from '..'

describe('Team', () => {
  describe('a server', () => {
    const host = 'devresults.com'

    const createServer = (host: Host): Server => {
      const serverKeys = createKeyset({ type: 'SERVER', name: host })
      return { host, keys: redactKeys(serverKeys) }
    }

    it('can be added and removed by an admin', () => {
      const { alice } = setup('alice')

      // add server
      alice.team.addServer(createServer(host))
      expect(alice.team.servers().length).toBe(1)

      // look up server
      const server = alice.team.servers(host)
      expect(server.host).toBe(host)

      // remove server
      alice.team.removeServer(host)
      expect(alice.team.servers().length).toBe(0)
      expect(alice.team.serverWasRemoved(host)).toBe(true)
    })

    it(`can't be added by a non-admin member`, () => {
      const { bob } = setup('alice', { user: 'bob', admin: false })

      const tryToAddServer = () => bob.team.addServer(createServer(host))

      expect(tryToAddServer).toThrowError()
      expect(bob.team.servers().length).toBe(0)
    })

    it(`can't be removed by a non-admin member`, () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })

      // add server
      alice.team.addServer(createServer(host))
      expect(alice.team.servers().length).toBe(1)

      const tryToRemoveServer = () => bob.team.removeServer(host)
      expect(tryToRemoveServer).toThrowError()
    })

    it.todo(`can decrypt a team graph`)
    it.todo(`can sync with a member`)
    it.todo(`can admit an invitee`)
    it.todo(`can't invite a member`)
    it.todo(`can't invite a device`)
    it.todo(`can't remove a member`)
    it.todo(`can change its own keys`)
  })
})
