import { createKeyset, createUser, redactKeys } from 'crdx'
import { createDevice, createTeam } from '..'

describe('Team', () => {
  describe('a server', () => {
    it('can be added and removed by an admin', () => {
      const alice = createUser('alice')
      const aliceDevice = createDevice(alice.userId, 'my-computer')
      const aliceTeam = createTeam('team team', { user: alice, device: aliceDevice })
      const host = 'devresults.com'
      const serverKeys = createKeyset({ type: 'SERVER', name: host })

      // add server
      aliceTeam.addServer({ host, keys: redactKeys(serverKeys) })
      expect(aliceTeam.servers().length).toBe(1)

      // look up server
      const server = aliceTeam.servers(host)
      expect(server.host).toBe(host)

      // remove server
      aliceTeam.removeServer(host)
      expect(aliceTeam.servers().length).toBe(0)
      expect(aliceTeam.serverWasRemoved(host)).toBe(true)
    })
  })
})
