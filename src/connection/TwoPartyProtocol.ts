import * as base64 from '@stablelib/base64'
import msgpack from 'msgpack-lite'
import { asymmetric, hash } from '/crypto'

/**
 * Implementation of 2-Party Secure Messaging (2SM) Protocol
 * described in "Key Agreement for Decentralized Secure Group Messaging with Strong Security Guarantees"
 * by Matthew Weidner, Martin Kleppmann, Daniel Hugenroth, and Alastair R. Beresford
 * https://eprint.iacr.org/2020/1281
 *
 * Reference implementation in java: https://github.com/trvedata/key-agreement/blob/main/group_protocol_library/src/main/java/org/trvedata/sgm/crypto/TwoPartyProtocol.java
 */
export class TwoPartyProtocol {
  private mySks: string[]
  private receivedSk: string
  private nextIndex: number
  private otherPk: string
  private otherPkSender: MeOrYou
  private otherPkIndex: number

  constructor(sk: string, pk: string) {
    this.mySks = [sk]
    this.receivedSk = EMPTY
    this.nextIndex = 1
    this.otherPk = pk
    this.otherPkSender = YOU
    this.otherPkIndex = 0
  }

  send(message: string) {
    const myNewKeyPair = asymmetric.keyPair()
    const otherNewKeyPair = asymmetric.keyPair()

    this.mySks[this.nextIndex] = myNewKeyPair.secretKey

    const plainText: TwoPartyPlaintext = {
      message,
      otherNewSk: otherNewKeyPair.secretKey,
      nextIndex: this.nextIndex,
      myNewPk: myNewKeyPair.publicKey,
    }
    const payload = pack(plainText)

    const cipher = asymmetric.encrypt({
      secret: payload,
      recipientPublicKey: this.otherPk,
    })

    const cipherWithMetadata = {
      cipher,
      keySender: this.otherPkSender,
      keyIndex: this.otherPkIndex,
    } as TwoPartyMessage

    this.nextIndex += 1

    this.otherPk = otherNewKeyPair.publicKey
    this.otherPkSender = ME
    this.otherPkIndex = 0

    return pack(cipherWithMetadata)
  }

  receive(packedCipherWithMetadata: string) {
    const cipherWithMetadata = unpack(packedCipherWithMetadata) as TwoPartyMessage
    const { cipher, keySender, keyIndex } = cipherWithMetadata

    let sk: string
    if (keySender === YOU) {
      // 'YOU' is from the sender's perspective; indicates the last one to send a key was 'ME'
      sk = this.mySks[keyIndex]
      if (sk === undefined) throw new Error('A cipher can only be decrypted once')
      // delete older keys
      for (let i = 0; i <= keyIndex; i++) delete this.mySks[i]
    } else {
      sk = this.receivedSk
    }

    const payload = asymmetric.decrypt({
      cipher: cipher,
      recipientSecretKey: sk,
    })

    const plainText: TwoPartyPlaintext = unpack(payload)
    const { message, otherNewSk, nextIndex, myNewPk } = plainText

    this.receivedSk = otherNewSk

    this.otherPk = myNewPk
    this.otherPkSender = YOU
    this.otherPkIndex = nextIndex

    return message
  }
}

const pack = (o: any) => base64.encode(msgpack.encode(o))
const unpack = (s: string) => msgpack.decode(base64.decode(s))

const EMPTY = ''
const ME = 'me'
const YOU = 'you'

type MeOrYou = typeof ME | typeof YOU

interface TwoPartyMessage {
  cipher: string // ciphertext
  keySender: MeOrYou // senderOtherPkSender
  keyIndex: number // receiverPkIndex
}

interface TwoPartyPlaintext {
  message: string // appPlaintext
  otherNewSk: string // receiverNewSk
  nextIndex: number // senderNewPkIndex
  myNewPk: string // senderNewPk
}
