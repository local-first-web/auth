import { describe, expect, it } from 'vitest'
import { create as createInvitation, generateProof, randomSeed } from '../../invitation/index.js'
import { redactDevice } from '../../device/index.js'
import { type TeamAction } from '../../team/types.js'
import { setup } from '../../util/testing/index.js'
import { getDeviceUserFromGraph } from '../getDeviceUserFromGraph.js'

/**
 * An invited device gets its user keys out of lockboxes that the inviter puts on the INVITE_DEVICE
 * link. `inviteDevice` always puts them there — but the graph this runs on comes from whoever
 * admitted us, and nothing on the way in says the lockboxes have to be there. A link carrying an
 * invitation and no lockboxes replays fine: `checkPayload` doesn't look at them and the reducer
 * only posts the invitation.
 */
describe('getDeviceUserFromGraph', () => {
  it("returns the member's latest user keys", () => {
    const { alice: aliceLaptop } = setup('alice')
    const alicePhone = aliceLaptop.phone!

    const { seed } = aliceLaptop.team.inviteDevice()
    aliceLaptop.team.admitDevice(generateProof(seed, alicePhone.keys), redactDevice(alicePhone))

    const { user } = getDeviceUserFromGraph({
      serializedGraph: aliceLaptop.team.save(),
      teamKeyring: aliceLaptop.team.teamKeyring(),
      invitationSeed: seed,
    })

    expect(user.userId).toBe(aliceLaptop.userId)
    expect(user.keys).toEqual(aliceLaptop.user.keys)
  })

  it("won't build a user out of a graph whose invitation carries no user keys", () => {
    const { alice: aliceLaptop } = setup('alice')

    // A device invitation for Alice, posted without the lockboxes holding her user keys
    const seed = randomSeed()
    const invitation = createInvitation({ kind: 'DEVICE', seed, userId: aliceLaptop.userId })
    aliceLaptop.team.dispatch({
      type: 'INVITE_DEVICE',
      payload: { invitation, lockboxes: [] },
    } as TeamAction)

    const serializedGraph = aliceLaptop.team.save()
    const teamKeyring = aliceLaptop.team.teamKeyring()

    // ❌ We stop here, naming the invitation and the lockboxes...
    expect(() =>
      getDeviceUserFromGraph({ serializedGraph, teamKeyring, invitationSeed: seed })
    ).toThrowError(/didn't open any user keys/i)

    // ...rather than handing back a user with no keys, which used to load into a `Team` without
    // complaint and then fail inside `join`, out of crdx, with `Cannot read properties of
    // undefined (reading 'encryption')`.
  })
})
