import { DeviceInfo, DeviceType, DeviceWithSecrets, getDeviceId, redactDevice } from '/device'
import {
  acceptDeviceInvitation,
  acceptMemberInvitation,
  inviteDevice,
  inviteMember,
  newInvitationKey,
  validate,
} from '/invitation'
import * as keyset from '/keyset'
import { KeyType } from '/keyset'
import { redactUser } from '/user'
import { bob, eve } from '/util/testing'

const { TEAM_SCOPE } = keyset
const { DEVICE, MEMBER } = KeyType

describe('invitations', () => {
  const teamKeys = keyset.create(TEAM_SCOPE)

  test('invite member', () => {
    const secretKey = newInvitationKey()
    const invitation = inviteMember({ teamKeys, payload: { userName: 'bob' }, secretKey })
    expect(invitation.type).toBe(MEMBER)
    expect(secretKey).toHaveLength(16)
    expect(invitation).toHaveProperty('id')
    expect(invitation.id).toHaveLength(15)
    expect(invitation).toHaveProperty('encryptedBody')
  })

  test('invite device', () => {
    const secretKey = newInvitationKey()

    const device: DeviceInfo = { userName: 'bob', name: `bob's phone`, type: DeviceType.mobile }
    const deviceId = getDeviceId(device)

    const invitation = inviteDevice({ teamKeys, payload: { ...device, deviceId }, secretKey })

    expect(invitation.type).toBe(DEVICE)
    expect(secretKey).toHaveLength(16)
    expect(invitation).toHaveProperty('id')
    expect(invitation.id).toHaveLength(15)
    expect(invitation).toHaveProperty('encryptedBody')
  })

  test('validate member invitation', () => {
    // Alice generates a secret key and sends it to Bob via a trusted side channel.
    const secretKey = newInvitationKey()

    // She generates an invitation with this key. Normally the invitation would be stored on the
    // team's signature chain; here we're just keeping it around in a variable.
    const invitation = inviteMember({ teamKeys, payload: { userName: 'bob' }, secretKey })

    // Bob accepts invitation and obtains a credential proving that he was invited.
    const proofOfInvitation = acceptMemberInvitation(secretKey, redactUser(bob))

    // Bob shows up to join the team & sees Charlie. Bob shows Charlie his proof of invitation, and
    // Charlie checks it against the invitation that Alice posted on the signature chain.
    const validationResult = validate(proofOfInvitation, invitation, teamKeys)
    expect(validationResult.isValid).toBe(true)
  })

  test(`you have to have the secret key to accept an invitation`, () => {
    // Alice generates a secret key and sends it to Bob via a trusted side channel.
    const secretKey = newInvitationKey()
    const invitation = inviteMember({ teamKeys, payload: { userName: 'bob' }, secretKey })

    // Eve tries to accept the invitation in Bob's place, but she doesn't have the correct invitation key
    const proofOfInvitation = acceptMemberInvitation('horsebatterycorrectstaple', redactUser(bob))

    // Nice try, Eve!!!
    const validationResult = validate(proofOfInvitation, invitation, teamKeys)
    expect(validationResult.isValid).toBe(false)
  })

  test(`even if you know the key, you can't accept someone else's invitation under your own name`, () => {
    // Alice generates a secret key and sends it to Bob via a trusted side channel.
    const secretKey = newInvitationKey()
    const invitation = inviteMember({ teamKeys, payload: { userName: 'bob' }, secretKey })

    // Eve has the secret key, so she tries to use it to get herself accepted into the group
    const proofOfInvitation = acceptMemberInvitation(secretKey, redactUser(eve))

    // No dice, Eve!!! foiled again!!
    const validationResult = validate(proofOfInvitation, invitation, teamKeys)
    expect(validationResult.isValid).toBe(false)
  })

  test('validate device invitation', () => {
    // On his laptop, Bob generates a secret key. He gets the secret key to his phone, perhaps by
    // typing it in or by scanning a QR code
    const secretKey = newInvitationKey()

    // He generates an invitation, which would normally be stored on the team's signature chain.
    const device: DeviceInfo = { userName: 'bob', name: `bob's phone`, type: DeviceType.mobile }
    const deviceId = getDeviceId(device)
    const deviceKeys = keyset.create({ type: DEVICE, name: deviceId })
    const deviceWithSecrets: DeviceWithSecrets = { ...device, keys: deviceKeys }
    const invitation = inviteDevice({ teamKeys, payload: { ...device, deviceId }, secretKey })

    // On his phone, Bob generates a credential proving that he was invited.
    const proofOfInvitation = acceptDeviceInvitation(secretKey, redactDevice(deviceWithSecrets))

    // The phone attempts to connect to the team and contacts some other device - say it's Alice's
    // laptop, although it could be any online device that belongs to the team. The phone sends the
    // laptop the proof of invitation, and the laptop checks it against the invitation that's posted
    // in the signature chain.
    const validationResult = validate(proofOfInvitation, invitation, teamKeys)
    expect(validationResult.isValid).toBe(true)
  })

  test(`you have to have the secret key to accept a device invitation`, () => {
    // On his laptop, Bob generates a secret key. He gets the secret key to his phone
    const secretKey = newInvitationKey()

    // He generates an invitation
    const device: DeviceInfo = { userName: 'bob', name: `bob's phone`, type: DeviceType.mobile }
    const deviceId = getDeviceId(device)
    const deviceKeys = keyset.create({ type: DEVICE, name: deviceId })
    const deviceWithSecrets: DeviceWithSecrets = { ...device, keys: deviceKeys }
    const invitation = inviteDevice({ teamKeys, payload: { ...device, deviceId }, secretKey })

    // Eve tries to use the invitation
    const proofOfInvitation = acceptDeviceInvitation(
      'iamsupersneaky',
      redactDevice(deviceWithSecrets)
    )

    // grrr...
    const validationResult = validate(proofOfInvitation, invitation, teamKeys)
    expect(validationResult.isValid).toBe(false)
  })
})
