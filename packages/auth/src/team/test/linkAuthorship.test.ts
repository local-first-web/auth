import { append, createKeyring, createKeyset, redactKeys, type Store } from '@localfirst/crdx'
import { redactDevice } from '../../device/index.js'
import * as lockbox from '../../lockbox/index.js'
import { type TeamAction, type TeamContext, type TeamState } from '../types.js'
import { unpack } from 'msgpackr'
import { serializeTeamGraph } from '../serialize.js'
import * as teams from '../index.js'
import { KeyType } from '../../util/index.js'
import { setup } from '../../util/testing/index.js'
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

    /**
     * The rule is only worth what "belonging to them" is worth.
     *
     * Which keys belong to a member used to include any key named on a lockbox manifest scoped to
     * them — a manifest being plaintext, author-written, and no evidence at all that its author
     * holds the key. So one ordinary lockbox, of a shape the door has to allow, registered a
     * keyset of 👨🏻‍🦲 Bob's own as 👩🏾 Alice's, and from there he could author links in her name that
     * every peer accepted: hers and an admin's included. He removed a member wearing her name.
     *
     * The control is the same attack without that one lockbox: it has to be what makes the
     * difference, or this test is measuring the wrong thing.
     */
    const impersonate = (registerFirst: boolean) => {
      const { alice, bob, charlie } = setup([
        'alice',
        { user: 'bob', admin: false },
        { user: 'charlie', admin: false },
      ])
      const teamKeys = alice.team.teamKeys()

      // 👨🏻‍🦲 Bob mints a keyset and calls it 👩🏾 Alice's
      const forged = createKeyset({ type: KeyType.USER, name: alice.userId })

      if (registerFirst) {
        // One lockbox. USER keys to a DEVICE is an honest pairing — it's how every member's own
        // device gets their keys — so nothing at the door can refuse it.
        const { store } = bob.team as unknown as {
          store: Store<TeamState, TeamAction, TeamContext>
        }
        store.dispatch(
          {
            type: 'ADD_DEVICE',
            payload: {
              device: redactDevice(bob.phone!),
              lockboxes: [lockbox.create(forged, redactKeys(bob.device.keys))],
            },
          } as TeamAction,
          bob.team.teamKeys()
        )
        bob.team.merge(bob.team.graph)
      }

      // He builds a team wearing her name, keeping his own device so he can still open team keys
      const spoofed = teams.load(
        bob.team.save(),
        {
          user: { userName: alice.userName, userId: alice.userId, keys: forged },
          device: bob.device,
        },
        createKeyring(teamKeys)
      )

      let authored = true
      try {
        spoofed.dispatch({
          type: 'ADD_DEVICE',
          payload: {
            device: { ...redactDevice(bob.phone!), deviceId: 'planted', userId: alice.userId },
          },
        } as TeamAction)
      } catch {
        authored = false
      }

      const accepted = (team: (typeof alice)['team']) => {
        try {
          team.merge(spoofed.graph)
          return team.members(alice.userId).devices!.some(d => d.deviceId === 'planted')
        } catch {
          return false
        }
      }

      return {
        authored,
        charlieAccepted: accepted(charlie.team),
        aliceAccepted: accepted(alice.team),
      }
    }

    it("won't let a lockbox manifest make someone else's key one of yours", () => {
      // Control: without the registering lockbox, none of it works
      expect(impersonate(false)).toEqual({
        authored: false,
        charlieAccepted: false,
        aliceAccepted: false,
      })

      // ✅ ...and with it, still none of it works
      expect(impersonate(true)).toEqual({
        authored: false,
        charlieAccepted: false,
        aliceAccepted: false,
      })
    })
  })
})
