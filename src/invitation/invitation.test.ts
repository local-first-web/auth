import { normalize } from './normalize'
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

  describe('members', () => {
    test('create member invitation', () => {
      const secretKey = newInvitationKey()
      const invitation = inviteMember({ teamKeys, userName: 'bob', secretKey })

      // looks like an invitation
      expect(invitation.type).toBe(MEMBER)
      expect(secretKey).toHaveLength(16)
      expect(invitation).toHaveProperty('id')
      expect(invitation.id).toHaveLength(15)
      expect(invitation).toHaveProperty('encryptedBody')
    })

    test('validate member invitation', () => {
      // 👩🏾 Alice generates a secret key and sends it to 👨‍🦲 Bob via a trusted side channel.
      const secretKey = newInvitationKey()

      // 👩🏾 Alice generates an invitation with this key. Normally the invitation would be stored on the
      // team's signature chain; here we're just keeping it around in a variable.
      const invitation = inviteMember({ teamKeys, userName: 'bob', secretKey })

      // 👨‍🦲 Bob accepts invitation and obtains a credential proving that he was invited.
      const proofOfInvitation = acceptMemberInvitation(secretKey, redactUser(bob))

      // 👨‍🦲 Bob shows up to join the team & sees 👳‍♂️ Charlie. Bob shows Charlie his proof of invitation, and
      // 👳‍♂️ Charlie checks it against the invitation that Alice posted on the signature chain.
      const validationResult = validate(proofOfInvitation, invitation, teamKeys)

      // ✅
      expect(validationResult.isValid).toBe(true)
    })

    test(`you have to have the secret key to accept an invitation`, () => {
      // 👩🏾 Alice uses a secret key to create an invitation; she sends it to Bob via a trusted side channel
      const secretKey = 'passw0rd'
      // and uses it to create an invitation for him
      const invitation = inviteMember({ teamKeys, userName: 'bob', secretKey })

      // 🦹‍♀️ Eve tries to accept the invitation in Bob's place, but she doesn't have the correct invitation key
      const proofOfInvitation = acceptMemberInvitation('horsebatterycorrectstaple', redactUser(bob))

      // ❌ Nice try, Eve!!!
      const validationResult = validate(proofOfInvitation, invitation, teamKeys)
      expect(validationResult.isValid).toBe(false)
    })

    test(`even if you know the key, you can't accept someone else's invitation under your own name`, () => {
      // 👩🏾 Alice generates a secret key and sends it to Bob via a trusted side channel.
      const secretKey = newInvitationKey()
      const invitation = inviteMember({ teamKeys, userName: 'bob', secretKey })

      // 🦹‍♀️ Eve has the secret key, so she tries to use it to get herself accepted into the group
      const proofOfInvitation = acceptMemberInvitation(secretKey, redactUser(eve))

      // ❌ No dice, Eve!!! foiled again!!
      const validationResult = validate(proofOfInvitation, invitation, teamKeys)
      expect(validationResult.isValid).toBe(false)
    })
  })

  describe('devices', () => {
    test('create device invitation', () => {
      const secretKey = newInvitationKey()

      const device: DeviceInfo = { userName: 'bob', name: `bob's phone`, type: DeviceType.mobile }
      const deviceId = getDeviceId(device)

      const invitation = inviteDevice({ teamKeys, userName: device.userName, deviceId, secretKey })

      // looks like an invitation
      expect(invitation.type).toBe(DEVICE)
      expect(secretKey).toHaveLength(16)
      expect(invitation).toHaveProperty('id')
      expect(invitation.id).toHaveLength(15)
      expect(invitation).toHaveProperty('encryptedBody')
    })

    test('validate device invitation', () => {
      // 👨‍🦲💻 On his laptop, Bob generates a secret key. He gets the secret key to his 👨‍🦲📱 phone, perhaps by
      // typing it in or by scanning a QR code
      const secretKey = newInvitationKey()

      // 👨‍🦲💻 On his laptop, Bob generates an invitation. (Pretend he stores it on the team's
      // signature chain and everyone else on the team then gets it.)
      const userName = 'bob'
      const device: DeviceInfo = { userName, name: `bob's phone`, type: DeviceType.mobile }
      const deviceId = getDeviceId(device)
      const deviceKeys = keyset.create({ type: DEVICE, name: deviceId })
      const deviceWithSecrets: DeviceWithSecrets = { ...device, keys: deviceKeys }
      const invitation = inviteDevice({ teamKeys, userName, deviceId, secretKey })

      // 👨‍🦲📱 On his phone, Bob generates a credential proving that he was invited.
      const proofOfInvitation = acceptDeviceInvitation(secretKey, redactDevice(deviceWithSecrets))

      // 👨‍🦲📱 The phone goes online and connects with 👩🏾💻 Alice's laptop (it could be any
      // online device that belongs to a team member). The phone sends the laptop the proof of
      // invitation, and the laptop checks it against the invitation from the signature chain.
      const validationResult = validate(proofOfInvitation, invitation, teamKeys)

      // ✅
      expect(validationResult.isValid).toBe(true)
    })

    test(`you have to have the secret key to accept a device invitation`, () => {
      // 👨‍🦲💻 On his laptop, Bob generates a secret key. He gets the secret key to his 👨‍🦲📱 phone
      const secretKey = newInvitationKey()

      // 👨‍🦲💻 On his laptop, Bob generates an invitation.
      const userName = 'bob'
      const device: DeviceInfo = { userName, name: `bob's phone`, type: DeviceType.mobile }
      const deviceId = getDeviceId(device)
      const deviceKeys = keyset.create({ type: DEVICE, name: deviceId })
      const deviceWithSecrets: DeviceWithSecrets = { ...device, keys: deviceKeys }
      const invitation = inviteDevice({ teamKeys, userName, deviceId, secretKey })

      // 🦹‍♀️ Eve tries to impersonate Bob's phone, but she doesn't have the secret key
      const proofOfInvitation = acceptDeviceInvitation('sneaky', redactDevice(deviceWithSecrets))

      // ❌ grrr...
      const validationResult = validate(proofOfInvitation, invitation, teamKeys)
      expect(validationResult.isValid).toBe(false)
    })
  })
})
