﻿import { randomKey, KeysetWithSecrets, PublicKeyset } from '/keyset'
import { AcceptIdentityMessage, ClaimIdentityMessage } from '/message'
import { Base64 } from '/util'
import { asymmetric } from '/crypto'

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
