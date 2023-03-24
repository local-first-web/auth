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

    it(`can't be added by a non-admin member`, () => {})
    it(`can't be removed by a non-admin member`, () => {})
    it(`can decrypt a team graph`, () => {})
    it(`can sync with a member`, () => {})
    it(`can admit an invitee`, () => {})
    it(`can't invite a member`, () => {})
    it(`can't invite a device`, () => {})
    it(`can't remove a member`, () => {})
    it(`can change its own keys`, () => {})
  })
})
