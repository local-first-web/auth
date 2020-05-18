import { create } from '/invitation/create'
import { deriveKeys, randomKey } from '/keys'

describe('invitations', () => {
  const teamKeys = deriveKeys(randomKey())

  test('newInvitation', () => {
    const invitation = create(teamKeys, 'bob')
    expect(invitation).toHaveProperty('id')
    expect(invitation.id).toHaveLength(15)
    expect(invitation).toHaveProperty('body')
  })
})
