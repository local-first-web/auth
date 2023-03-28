import { signatures, asymmetric, keyToBytes } from '@localfirst/crypto'
import { createKeyset } from '/keyset/createKeyset'
import { KeyType } from '/keyset/types'
import { EPHEMERAL_SCOPE } from '/constants'

const { USER } = KeyType

describe('create', () => {
  it('returns keys with the expected lengths', () => {
    const keys = createKeyset(EPHEMERAL_SCOPE)

    const { signature, encryption } = keys

    // signature keys look right
    expect(keyToBytes(signature.publicKey)).toHaveLength(32)
    expect(keyToBytes(signature.secretKey)).toHaveLength(64)

    // encryption keys look right
    expect(keyToBytes(encryption.publicKey)).toHaveLength(32)
    expect(keyToBytes(encryption.secretKey)).toHaveLength(32)
  })

  it('returns keys with the expected metadata', () => {
    const keys = createKeyset({ type: USER, name: 'alice' })

    expect(keys.type).toEqual(USER)
    expect(keys.name).toEqual('alice')
  })

  it('produces working signature keys', () => {
    const keys = createKeyset(EPHEMERAL_SCOPE)
    const { secretKey, publicKey } = keys.signature

    // Alice signs a message
    const payload = 'si vis frumenti, necesse est plantandi frumentum'
    const signature = signatures.sign(payload, secretKey)

    // Bob checks it
    const isLegit = signatures.verify({ payload, signature, publicKey })
    expect(isLegit).toBe(true)
  })

  it('produces working keys for asymmetric encryption', () => {
    const alice = createKeyset({ type: USER, name: 'alice' }).encryption
    const bob = createKeyset({ type: USER, name: 'bob' }).encryption

    const message = 'The dolphin leaps at twilight'

    // Alice encrypts a message for Bob
    const encrypted = asymmetric.encrypt({
      secret: message,
      recipientPublicKey: bob.publicKey,
      senderSecretKey: alice.secretKey,
    })

    // Bob decrypts it
    const decrypted = asymmetric.decrypt({
      cipher: encrypted,
      senderPublicKey: alice.publicKey,
      recipientSecretKey: bob.secretKey,
    })
    expect(decrypted).toEqual(message)
  })
})
