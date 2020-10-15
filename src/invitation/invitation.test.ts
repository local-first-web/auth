import { DeviceInfo, DeviceType, getDeviceId } from '/device'
import {
  acceptMemberInvitation,
  inviteDevice,
  inviteMember,
  newSecretKey,
  validate,
} from '/invitation'
import * as keyset from '/keyset'
import { KeyType } from '/keyset'
import { bob } from '/util/testing'

const { TEAM_SCOPE } = keyset
const { DEVICE, MEMBER } = KeyType

describe('invitations', () => {
  const teamKeys = keyset.create(TEAM_SCOPE)

  test('invite member', () => {
    const secretKey = newSecretKey()
    const invitation = inviteMember({ teamKeys, payload: { userName: 'bob' }, secretKey })
    expect(invitation.type).toBe(MEMBER)
    expect(secretKey).toHaveLength(16)
    expect(invitation).toHaveProperty('id')
    expect(invitation.id).toHaveLength(15)
    expect(invitation).toHaveProperty('encryptedBody')
  })

  test('invite device', () => {
    const secretKey = newSecretKey()

    const device: DeviceInfo = { userName: 'bob', name: `bob's phone`, type: DeviceType.mobile }
    const deviceId = getDeviceId(device)

    const invitation = inviteDevice({
      teamKeys,
      payload: { ...device, deviceId },
      secretKey,
    })
    expect(invitation.type).toBe(DEVICE)
    expect(secretKey).toHaveLength(16)
    expect(invitation).toHaveProperty('id')
    expect(invitation.id).toHaveLength(15)
    expect(invitation).toHaveProperty('encryptedBody')
  })

  test('validate', () => {
    // Alice creates invitation. She sends the secret key to Bob, and records the invitation on the
    // team's signature chain.
    const secretKey = newSecretKey()

    const invitation = inviteMember({ teamKeys, payload: { userName: 'bob' }, secretKey })

    // Bob accepts invitation and obtains a credential proving that he was invited.
    const proofOfInvitation = acceptMemberInvitation(secretKey, bob)

    // Bob shows up to join the team & sees Charlie. Bob shows Charlie his proof of invitation, and
    // Charlie checks it against the invitation that Alice posted on the signature chain.
    const validation = () => {
      const validationResult = validate(proofOfInvitation, invitation, teamKeys)
      expect(validationResult.isValid).toBe(true)
    }

    expect(validation).not.toThrow()
  })
})
