﻿import { asymmetric } from '@herbcaudill/crypto'
import { KeysetWithSecrets, PublicKeyset } from '/keyset'
import { Base64 } from '/util'

export const accept = ({ seed, peerKeys, userKeys }: AcceptArgs): Base64 => {
  // encrypt the seed for our peer
  const peerPublicKey = peerKeys.encryption
  const mySecretKey = userKeys.encryption.secretKey
  const encryptedSeed = asymmetric.encrypt({
    secret: seed,
    recipientPublicKey: peerPublicKey,
    senderSecretKey: mySecretKey,
  })

  return encryptedSeed
}

interface AcceptArgs {
  seed: Base64
  peerKeys: PublicKeyset
  userKeys: KeysetWithSecrets
}
