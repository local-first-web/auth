import { acceptInvitation, create, newSecretKey, validate } from '/invitation'
import * as keyset from '/keyset'
import { bob } from '/util/testing'

const { TEAM_SCOPE } = keyset

describe('invitations', () => {
  const teamKeys = keyset.create(TEAM_SCOPE)

  test('create', () => {
    const secretKey = newSecretKey()
    const invitation = create({ teamKeys, payload: { userName: 'bob' }, secretKey })
    expect(secretKey).toHaveLength(16)
    expect(invitation).toHaveProperty('id')
    expect(invitation.id).toHaveLength(15)
    expect(invitation).toHaveProperty('encryptedBody')
  })

  test('validate', () => {
    // Alice creates invitation. She sends the secret key to Bob, and records the invitation on the
    // team's signature chain.
    const secretKey = newSecretKey()

    const invitation = create({ teamKeys, payload: { userName: 'bob' }, secretKey })

    // Bob accepts invitation and obtains a credential proving that he was invited.
    const proofOfInvitation = acceptInvitation(secretKey, bob)

    // Bob shows up to join the team & sees Charlie. Bob shows Charlie his proof of invitation, and
    // Charlie checks it against the invitation that Alice posted on the signature chain.
    const validation = () => {
      const validationResult = validate(proofOfInvitation, invitation, teamKeys)
      if (!validationResult.isValid) throw validationResult.error
    }

    expect(validation).not.toThrow()
  })
})
