﻿import { asymmetric } from '@herbcaudill/crypto'
import { KeysetWithSecrets, PublicKeyset } from '/keyset'
import { AcceptIdentityMessage } from '/message'
import { Base64 } from '/util'

// TODO: refactor to just return payload

export const accept = ({ seed, peerKeys, userKeys }: AcceptArgs): AcceptIdentityMessage => {
  // encrypt the seed for our peer
  const peerPublicKey = peerKeys.encryption
  const mySecretKey = userKeys.encryption.secretKey
  const encryptedSeed = asymmetric.encrypt({
    secret: seed,
    recipientPublicKey: peerPublicKey,
    senderSecretKey: mySecretKey,
  })

  return {
    type: 'ACCEPT_IDENTITY',
    payload: { encryptedSeed },
  }
}

interface AcceptArgs {
  seed: Base64
  peerKeys: PublicKeyset
  userKeys: KeysetWithSecrets
}
