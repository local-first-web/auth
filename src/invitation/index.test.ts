import { create } from '/invitation/create'
import { accept } from '/invitation/accept'
import { validate } from '/invitation/validate'
import { deriveKeys, randomKey } from '/keys'

describe('invitations', () => {
  const teamKeys = deriveKeys(randomKey())

  test('create', () => {
    const { secretKey, invitation } = create(teamKeys, 'bob')
    expect(secretKey).toHaveLength(16)
    expect(invitation).toHaveProperty('id')
    expect(invitation.id).toHaveLength(15)
    expect(invitation).toHaveProperty('encryptedPayload')
  })

  test('validate', () => {
    // Alice creates invitation. She sends the secret key to Bob, and records the invitation on the
    // team's signature chain.
    const { secretKey, invitation } = create(teamKeys, 'bob')

    // Bob accepts invitation and obtains a credential proving that he was invited.
    const proofOfInvitation = accept(secretKey, 'bob')

    // Bob shows up to join the team & sees Charlie. Bob shows Charlie his proof of invitation, and
    // Charlie checks it against the invitation that Alice posted on the signature chain.
    const validation = () => {
      const validationResult = validate(proofOfInvitation, invitation, teamKeys)
      if (!validationResult.isValid) throw validationResult.error
    }

    expect(validation).not.toThrow()
  })
})
