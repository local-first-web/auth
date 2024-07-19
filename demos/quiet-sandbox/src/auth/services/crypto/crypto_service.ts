/**
 * Handles invite-related chain operations
 */

import { EncryptedAndSignedPayload, EncryptedPayload, EncryptionScope, EncryptionScopeType } from "auth/services/crypto/types.js"
import { BaseChainService } from "../base_service.js"
import { SigChain } from "auth/chain.js"
import { Base58, Keyset, KeysetWithSecrets, LocalUserContext, Member, SignedEnvelope } from "@localfirst/auth"
import { DEFAULT_SEARCH_OPTIONS, MemberSearchOptions } from "../members/types.js"
import { ChannelService } from "../roles/channel_service.js"

class CryptoService extends BaseChainService {
  protected static _instance: CryptoService | undefined

  public static init(): CryptoService {
    if (CryptoService._instance == null) {
      CryptoService._instance = new CryptoService() 
    }

    return CryptoService.instance
  }

  // TODO: Can we get other members' keys by generation?
  public getPublicKeysForMembersById(memberIds: string[], searchOptions: MemberSearchOptions = DEFAULT_SEARCH_OPTIONS): Keyset[] {
    const members = SigChain.users.getMembersById(memberIds, searchOptions)
    return members.map((member: Member) => {
      return member.keys
    })
  }

  public getKeysForChannel(channelName: string, generation?: number): KeysetWithSecrets {
    return this.activeSigChain.team.roleKeys(ChannelService.getPrivateChannelRoleName(channelName), generation)
  }

  public encryptAndSign(message: any, scope: EncryptionScope, context: LocalUserContext): EncryptedAndSignedPayload {
    let recipientKey: Base58
    let senderKey: Base58
    let generation: number
    if (scope.type === EncryptionScopeType.ROLE) {
      if (scope.name == null) {
        throw new Error(`Must provide a role name when encryption scope is set to ${scope.type}`)
      }
      const keys = this.activeSigChain.team.roleKeys(scope.name)
      recipientKey = keys.encryption.publicKey
      senderKey = keys.encryption.secretKey
      generation = keys.generation
    } else if (scope.type === EncryptionScopeType.CHANNEL) {
      if (scope.name == null) {
        throw new Error(`Must provide a channel name when encryption scope is set to ${scope.type}`)
      }
      const keys = this.getKeysForChannel(scope.name)
      recipientKey = keys.encryption.publicKey
      senderKey = keys.encryption.secretKey
      generation = keys.generation
    } else if (scope.type === EncryptionScopeType.USER) {
      if (scope.name == null) {
        throw new Error(`Must provide a user ID when encryption scope is set to ${scope.type}`)
      }
      const recipientKeys = this.getPublicKeysForMembersById([scope.name])
      recipientKey = recipientKeys[0].encryption
      senderKey = context.user.keys.encryption.secretKey
      generation = recipientKeys[0].generation
    } else if (scope.type === EncryptionScopeType.TEAM) {
      const keys = this.activeSigChain.team.teamKeys()
      recipientKey = keys.encryption.publicKey
      senderKey = keys.encryption.secretKey
      generation = keys.generation
    } else {
      throw new Error(`Unknown encryption scope type ${scope.type}`)
    }

    const encryptedContents = SigChain.lfa.asymmetric.encrypt({
      secret: message,
      senderSecretKey: senderKey,
      recipientPublicKey: recipientKey
    })

    const signature = this.activeSigChain.team.sign(encryptedContents)

    return {
      encrypted: {
        contents: encryptedContents,
        scope: {
          ...scope,
          generation
        }
      },
      signature
    }
  }

  public decryptAndVerify(encrypted: EncryptedPayload, signature: SignedEnvelope, context: LocalUserContext): any {
    const isValid = this.activeSigChain.team.verify(signature)
    if (!isValid) {
      throw new Error(`Couldn't verify signature on message`)
    }

    let recipientKey: Base58
    let senderKey: Base58
    if (encrypted.scope.type === EncryptionScopeType.ROLE) {
      if (encrypted.scope.name == null) {
        throw new Error(`Must provide a role name when encryption scope is set to ${encrypted.scope.type}`)
      }
      const keys = this.activeSigChain.team.roleKeys(encrypted.scope.name, encrypted.scope.generation)
      recipientKey = keys.encryption.secretKey
      senderKey = keys.encryption.publicKey
    } else if (encrypted.scope.type === EncryptionScopeType.CHANNEL) {
      if (encrypted.scope.name == null) {
        throw new Error(`Must provide a channel name when encryption scope is set to ${encrypted.scope.type}`)
      }
      const keys = this.getKeysForChannel(encrypted.scope.name, encrypted.scope.generation)
      recipientKey = keys.encryption.secretKey
      senderKey = keys.encryption.publicKey
    } else if (encrypted.scope.type === EncryptionScopeType.USER) {
      if (encrypted.scope.name == null) {
        throw new Error(`Must provide a user ID when encryption scope is set to ${encrypted.scope.type}`)
      }
      const senderKeys = SigChain.crypto.getPublicKeysForMembersById([signature.author.name])
      recipientKey = context.user.keys.encryption.secretKey
      senderKey = senderKeys[0].encryption
    } else if (encrypted.scope.type === EncryptionScopeType.TEAM) {
      const keys = this.activeSigChain.team.teamKeys(encrypted.scope.generation)
      recipientKey = keys.encryption.publicKey
      senderKey = keys.encryption.secretKey
    } else {
      throw new Error(`Unknown encryption scope type ${encrypted.scope.type}`)
    }

    const decrypted = SigChain.lfa.asymmetric.decrypt({
      cipher: encrypted.contents,
      senderPublicKey: senderKey,
      recipientSecretKey: recipientKey
    })

    return decrypted
  }

  public static get instance(): CryptoService {
    if (CryptoService._instance == null) {
      throw new Error(`CryptoService hasn't been initialized yet!  Run init() before accessing`)
    }

    return CryptoService._instance
  }
}

export {
  CryptoService
}