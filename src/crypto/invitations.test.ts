import {
  getInvitationId,
  newIKey,
  newInvitation,
  getSigningKeypair,
} from './invitations'
import { stretch } from './stretch'

describe('invitations', () => {
  test('newIKey', () => {
    let i = 1000
    while (i-- > 0) expect(newIKey()).toHaveLength(16)
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
    expect(invitation.type).toEqual('taco_invite_token')
  })
})
