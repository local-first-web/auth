import { append, createKeyset } from '@localfirst/crdx'
import { unpack } from 'msgpackr'
import { serializeTeamGraph } from 'team/serialize.js'
import * as teams from 'team/index.js'
import { KeyType } from 'util/index.js'
import { setup } from 'util/testing/index.js'
import { describe, expect, it } from 'vitest'

/** Appends a link to Eve's graph attributed to someone else, bypassing `Team.dispatch`. */
const forgeLink = (eve: any, claimedAuthor: { userId: string; userName: string }, keys?: any) =>
  append({
    graph: eve.team.graph,
    action: { type: 'SET_TEAM_NAME', payload: { teamName: 'EVE WAS HERE' } } as any,
    user: { ...claimedAuthor, keys: keys ?? eve.user.keys },
    context: { deviceId: eve.device.deviceId },
    keys: eve.team.teamKeys(),
  })

describe('Team', () => {
  describe('link authorship', () => {
    it('rejects a link attributed to someone other than the member who encrypted it', () => {
      const { alice, eve } = setup('alice', { user: 'eve', admin: false })

      const forgedGraph = forgeLink(eve, {
        userId: alice.userId,
        userName: alice.user.userName,
      })

      expect(() => alice.team.merge(forgedGraph as any)).toThrow(/author/i)
      expect(alice.team.teamName).not.toBe('EVE WAS HERE')
    })

    it('rejects a forged link on a cold load with full validation', () => {
      const { alice, eve } = setup('alice', { user: 'eve', admin: false })

      const forgedGraph = forgeLink(eve, {
        userId: alice.userId,
        userName: alice.user.userName,
      })

      expect(() =>
        teams.load(serializeTeamGraph(forgedGraph as any), eve.localContext, eve.team.teamKeys())
      ).toThrow(/author/i)
    })

    it('rejects a link whose sender key was never registered with the team at all', () => {
      const { alice, eve } = setup('alice', { user: 'eve', admin: false })
      const throwawayKeys = createKeyset({ type: KeyType.USER, name: 'nobody' })

      const forgedGraph = forgeLink(
        eve,
        { userId: alice.userId, userName: alice.user.userName },
        throwawayKeys
      )

      expect(() => alice.team.merge(forgedGraph as any)).toThrow(/author/i)
    })

    it('validates a chain restored from bytes, so chains stored before this check still load', () => {
      const { alice, bob } = setup('alice', 'bob')
      bob.team.addRole('managers')
      alice.team.merge(bob.team.graph)

      const serialized = alice.team.save()

      // The stored form has never included decrypted links — only the encrypted ones, which have
      // always carried senderPublicKey. So the bytes are the same as they were before this check
      // existed, and the evidence it needs is recovered on load rather than added to storage.
      const stored = unpack(serialized)
      expect(stored).not.toHaveProperty('links')
      expect(Object.values(stored.encryptedLinks)[0]).toHaveProperty('senderPublicKey')

      const reloaded = teams.load(serialized, alice.localContext, alice.team.teamKeys())
      expect(reloaded.hasRole('managers')).toBe(true)
    })

    it('still accepts links authored under a key generation that rotation has superseded', () => {
      const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')

      // Bob authors a link under his original keys
      bob.team.addRole('managers')

      // Removing Charlie rotates keys, so Bob's registered keys move to a new generation
      alice.team.remove(charlie.userId)
      expect(alice.team.teamKeys().generation).toBe(1)

      // Bob's earlier link is still accepted, even though its sender key is now superseded
      expect(() => alice.team.merge(bob.team.graph)).not.toThrow()
      expect(alice.team.hasRole('managers')).toBe(true)
    })
  })
})
