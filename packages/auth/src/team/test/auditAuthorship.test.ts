import { append, createKeyset, redactKeys } from '@localfirst/crdx'
import { createDevice, redactDevice } from 'index.js'
import { generateProof } from 'invitation/index.js'
import { KeyType } from 'util/index.js'
import { setup } from 'util/testing/index.js'
import { describe, expect, it } from 'vitest'

describe('Team', () => {
  describe('auditAuthorship', () => {
    it('finds nothing wrong with a chain where everyone authored their own links', () => {
      const { alice, bob } = setup('alice', 'bob')

      alice.team.setTeamName('a new name')
      bob.team.merge(alice.team.graph)
      bob.team.addRole('managers')
      alice.team.merge(bob.team.graph)

      expect(alice.team.auditAuthorship()).toEqual([])
      expect(bob.team.auditAuthorship()).toEqual([])
    })

    it('finds nothing wrong after key rotation, which supersedes the keys links were authored with', () => {
      const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')

      // Everyone authors something under their original keys
      bob.team.addRole('managers')
      charlie.team.addRole('interns')
      alice.team.merge(bob.team.graph).merge(charlie.team.graph)

      // Removing Charlie rotates the keys he could see
      alice.team.remove(charlie.userId)
      expect(alice.team.teamKeys().generation).toBe(1)

      // Bob's earlier link was authored under a key generation that's no longer current
      expect(alice.team.auditAuthorship()).toEqual([])
    })

    it('finds nothing wrong with invitations, devices, and servers', () => {
      const { alice, bob } = setup('alice', { user: 'bob', member: false })

      // Bob joins by invitation
      const { seed } = alice.team.inviteMember()
      const proof = generateProof(seed, bob.userId)
      alice.team.admitMember(proof, bob.user.keys, bob.user.userName)

      // Bob adds a device of his own
      const bobsPhone = createDevice({ userId: bob.userId, deviceName: 'phone' })
      alice.team.addForTesting(bob.user, [], redactDevice(bobsPhone))

      // A server is added and later changes its keys
      const host = 'sync.example.com'
      const serverKeys = createKeyset({ type: KeyType.SERVER, name: host })
      alice.team.addServer({ host, keys: redactKeys(serverKeys) })

      expect(alice.team.auditAuthorship()).toEqual([])
    })

    it('detects a forged link and names the member who really authored it', () => {
      const { alice, eve } = setup('alice', { user: 'eve', admin: false })

      // Eve appends a link claiming to be Alice, using her own keys to encrypt it
      const forgedGraph = append({
        graph: eve.team.graph,
        action: { type: 'SET_TEAM_NAME', payload: { teamName: 'EVE WAS HERE' } } as any,
        user: { userId: alice.userId, userName: alice.user.userName, keys: eve.user.keys },
        context: { deviceId: eve.device.deviceId },
        keys: eve.team.teamKeys(),
      })

      // Alice accepts it, because nothing in validation checks authorship
      alice.team.merge(forgedGraph as any)
      expect(alice.team.teamName).toBe('EVE WAS HERE')

      // But the audit catches it
      const anomalies = alice.team.auditAuthorship()
      expect(anomalies).toHaveLength(1)
      expect(anomalies[0]).toMatchObject({
        linkType: 'SET_TEAM_NAME',
        claimedAuthor: alice.userId,
        actualAuthor: eve.userId,
      })
    })

    it('reports an unrecognized sender key without naming an author', () => {
      const { alice, eve } = setup('alice', { user: 'eve', admin: false })

      // Eve uses a throwaway keyset that was never registered on the team
      const throwawayKeys = createKeyset({ type: KeyType.USER, name: 'nobody' })
      const forgedGraph = append({
        graph: eve.team.graph,
        action: { type: 'SET_TEAM_NAME', payload: { teamName: 'EVE WAS HERE' } } as any,
        user: { userId: alice.userId, userName: alice.user.userName, keys: throwawayKeys },
        context: { deviceId: eve.device.deviceId },
        keys: eve.team.teamKeys(),
      })
      alice.team.merge(forgedGraph as any)

      const anomalies = alice.team.auditAuthorship()
      expect(anomalies).toHaveLength(1)
      expect(anomalies[0].claimedAuthor).toBe(alice.userId)
      expect(anomalies[0].actualAuthor).toBeUndefined()
    })
  })
})
