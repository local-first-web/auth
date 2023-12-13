import * as Auth from '@localfirst/auth'
import { describe, expect, it } from 'vitest'
import { authenticatedInTime } from './helpers/authenticated.js'
import { setup } from './helpers/setup.js'
import { synced } from './helpers/synced.js'

describe.skip('persistence stress test', async () => {
  const N = 50

  for (let i = 0; i < N; i++) {
    it(`persists local context and team state (${i})`, async () => {
      const {
        users: { alice, bob },
        teardown,
      } = setup(['alice', 'bob'])

      const aliceTeam = Auth.createTeam('team A', alice.context)
      await alice.authProvider.addTeam(aliceTeam)

      // Alice sends Bob an invitation
      const { seed: bobInvite } = aliceTeam.inviteMember()

      // Bob uses the invitation to join
      await bob.authProvider.addInvitation({
        shareId: aliceTeam.id,
        invitationSeed: bobInvite,
      })

      // they're able to authenticate and sync
      const authWorked = await authenticatedInTime(alice, bob)
      expect(authWorked).toBe(true) // ✅
      await synced(alice, bob) // ✅

      // Alice and Bob both close and reopen their apps

      // reconnect via a new channel
      const channel = new MessageChannel()
      const { port1: aliceToBob, port2: bobToAlice } = channel

      // instantiate new authProviders and repos using this channel
      const alice2 = alice.restart([aliceToBob])
      const bob2 = bob.restart([bobToAlice])

      // they're able to authenticate and sync
      const authWorkedAgain = await authenticatedInTime(alice2, bob2)
      expect(authWorkedAgain).toBe(true) // ✅
      await synced(alice2, bob2) // ✅

      teardown()
    })
  }
})
