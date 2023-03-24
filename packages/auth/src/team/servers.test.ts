import { Host, Server } from '@/server'
import { setup } from '@/util/testing'
import { createKeyset, createUser, redactKeys } from 'crdx'
import { createDevice, createTeam } from '..'

describe('Team', () => {
  describe('a server', () => {
    const createServer = (host: Host): Server => {
      const serverKeys = createKeyset({ type: 'SERVER', name: host })
      return { host, keys: redactKeys(serverKeys) }
    }

    it('can be added and removed by an admin', () => {
      const { alice } = setup('alice')
      const host = 'devresults.com'

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
      const host = 'devresults.com'

      const tryToAddServer = () => bob.team.addServer(createServer(host))

      expect(tryToAddServer).toThrowError()
    })

  })
})
