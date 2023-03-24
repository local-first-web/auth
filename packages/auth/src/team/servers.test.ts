import { createKeyset, createUser, KeyType, redactKeys } from 'crdx'
import { createDevice, createTeam } from '..'

describe('Team', () => {
  describe('servers', () => {
    it('can add and remove servers', () => {
      const alice = createUser('alice')
      const aliceDevice = createDevice(alice.userId, 'my-computer')
      const team = createTeam('team team', { user: alice, device: aliceDevice })

      const server = {
        host: 'www.devresults.com',
        keys: redactKeys(createKeyset({ type: KeyType.USER })), // maybe need a better way to create arbitrary public keys
      }
      team.addServer(server)

      expect(team.servers().length).toBe(1)
      expect(team.servers(server.host).host).toBe(server.host)

      team.removeServer(server.host)

      expect(team.servers().length).toBe(0)
      expect(team.serverWasRemoved(server.host)).toBe(true)
    })
  })
})
