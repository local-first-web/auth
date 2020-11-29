// import { normalize } from './normalize'
// import { DeviceInfo, DeviceType, DeviceWithSecrets, getDeviceId, redactDevice } from '/device'
import { generateProof, InvitationKey, invite, validate } from '/invitation'
import * as keyset from '/keyset'

const { TEAM_SCOPE } = keyset

describe('invitations', () => {
  const teamKeys = keyset.create(TEAM_SCOPE)

  describe('members', () => {
    test('create invitation', () => {
      const secretKey = InvitationKey()
      const invitation = invite({ teamKeys, userName: 'bob', secretKey })

      // looks like an invitation
      expect(secretKey).toHaveLength(16)
      expect(invitation).toHaveProperty('id')
      expect(invitation.id).toHaveLength(15)
      expect(invitation).toHaveProperty('encryptedBody')
    })

    test('validate member invitation', () => {
      // 👩🏾 Alice generates a secret key and sends it to 👨‍🦲 Bob via a trusted side channel.
      const secretKey = InvitationKey()

      // 👩🏾 Alice generates an invitation with this key. Normally the invitation would be stored on the
      // team's signature chain; here we're just keeping it around in a variable.
      const invitation = invite({ teamKeys, userName: 'bob', secretKey })

      // 👨‍🦲 Bob accepts invitation and obtains a credential proving that he was invited.
      const proofOfInvitation = generateProof(secretKey, 'bob')

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
      const invitation = invite({ teamKeys, userName: 'bob', secretKey })

      // 🦹‍♀️ Eve tries to accept the invitation in Bob's place, but she doesn't have the correct invitation key
      const proofOfInvitation = generateProof('horsebatterycorrectstaple', 'bob')

      // ❌ Nice try, Eve!!!
      const validationResult = validate(proofOfInvitation, invitation, teamKeys)
      expect(validationResult.isValid).toBe(false)
    })

    test(`even if you know the key, you can't accept someone else's invitation under your own name`, () => {
      // 👩🏾 Alice generates a secret key and sends it to Bob via a trusted side channel.
      const secretKey = InvitationKey()
      const invitation = invite({ teamKeys, userName: 'bob', secretKey })

      // 🦹‍♀️ Eve has the secret key, so she tries to use it to get herself accepted into the group
      const proofOfInvitation = generateProof(secretKey, 'eve')

      // ❌ No dice, Eve!!! foiled again!!
      const validationResult = validate(proofOfInvitation, invitation, teamKeys)
      expect(validationResult.isValid).toBe(false)
    })
  })
})
