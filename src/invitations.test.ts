import {
  getInvitationId,
  newIKey,
  newInvitation,
  stretch,
  getSigningKeypair,
} from '.'

describe('invitations', () => {
  test('newIKey', () => {
    console.log(newIKey())
    let i = 1000
    while (i-- > 0) expect(newIKey()).toHaveLength(17)
  })

  test('getInvitationId', () => {
    const siKey = stretch(newIKey())
    expect(getInvitationId(siKey)).toHaveLength(15)
  })

  test('getSigningKeypair', () => {
    const siKey = stretch(newIKey())
    const keyPair = getSigningKeypair(siKey)
    expect(keyPair).toHaveProperty('publicKey')
    expect(keyPair).toHaveProperty('secretKey')
  })

  test('newInvitation', () => {
    const iKey = newIKey()
    const invitation = newInvitation(iKey)
    expect(invitation).toHaveProperty('id')
    expect(invitation.id).toHaveLength(15)
    expect(invitation).toHaveProperty('body')
    expect(invitation).toHaveProperty('type')
    expect(invitation.type).toEqual('seitan_invite_token')
  })
})
