/**
 * Handles invite-related chain operations
 */
import * as bs58 from 'bs58'

import { EncryptedAndSignedPayload, EncryptedPayload, EncryptionScope, EncryptionScopeType } from "./types.js"
import { BaseChainService } from "../baseService.js"
import { SigChain } from "../../chain.js"
import * as lfa from "@localfirst/auth"
import { DEFAULT_SEARCH_OPTIONS, MemberSearchOptions } from "../members/types.js"
import { ChannelService } from "../roles/channelService.js"

class CryptoService extends BaseChainService {
  public static init(sigChain: SigChain): CryptoService {
    return new CryptoService(sigChain)
  }

  // TODO: Can we get other members' keys by generation?
  public getPublicKeysForMembersById(memberIds: string[], searchOptions: MemberSearchOptions = DEFAULT_SEARCH_OPTIONS): lfa.Keyset[] {
    const members = this.sigChain.users.getMembersById(memberIds, searchOptions)
    return members.map((member: lfa.Member) => {
      return member.keys
    })
  }

  public getKeysForRole(roleName: string, generation?: number): lfa.KeysetWithSecrets {
    return this.sigChain.team.roleKeys(roleName, generation)
  }

  public getKeysForChannel(channelName: string, generation?: number): lfa.KeysetWithSecrets {
    return this.getKeysForRole(ChannelService.getPrivateChannelRoleName(channelName), generation)
  }

  public encryptAndSign(message: any, scope: EncryptionScope, context: lfa.LocalUserContext): EncryptedAndSignedPayload {
    let encryptedPayload: EncryptedPayload
    switch (scope.type) {
      // Symmetrical Encryption Types
      case EncryptionScopeType.CHANNEL:
      case EncryptionScopeType.ROLE:
      case EncryptionScopeType.TEAM:
        encryptedPayload = this.symEncrypt(message, scope)
        break
      // Asymmetrical Encryption Types
      case EncryptionScopeType.USER:
        encryptedPayload = this.asymUserEncrypt(message, scope, context)
        break
      // Unknown Type
      default:
        throw new Error(`Unknown encryption type ${scope.type} provided!`)
    }

    const signature = this.sigChain.team.sign(encryptedPayload.contents)

    return {
      encrypted: encryptedPayload,
      signature,
      ts: Date.now(),
      username: context.user.userName
    }
  }

  private symEncrypt(message: any, scope: EncryptionScope): EncryptedPayload {
    if (scope.type != EncryptionScopeType.TEAM && scope.name == null) {
      throw new Error(`Must provide a scope name when encryption scope is set to ${scope.type}`)
    }

    const envelope = this.sigChain.team.encrypt(message, scope.name)
    return {
      contents: bs58.default.encode(envelope.contents) as lfa.Base58,
      scope: {
        ...scope,
        generation: envelope.recipient.generation
      }
    }
  }

  private asymUserEncrypt(message: any, scope: EncryptionScope, context: lfa.LocalUserContext): EncryptedPayload {
    if (scope.name == null) {
      throw new Error(`Must provide a user ID when encryption scope is set to ${scope.type}`)
    }

    const recipientKeys = this.getPublicKeysForMembersById([scope.name])
    const recipientKey = recipientKeys[0].encryption
    const senderKey = context.user.keys.encryption.secretKey
    const generation = recipientKeys[0].generation

    const encryptedContents = lfa.asymmetric.encrypt({
      secret: message,
      senderSecretKey: senderKey,
      recipientPublicKey: recipientKey
    })

    return {
      contents: encryptedContents,
      scope: {
        ...scope,
        generation
      }
    }
  }

  public decryptAndVerify(encrypted: EncryptedPayload, signature: lfa.SignedEnvelope, context: lfa.LocalUserContext): any {
    const isValid = this.sigChain.team.verify(signature)
    if (!isValid) {
      throw new Error(`Couldn't verify signature on message`)
    }

    switch (encrypted.scope.type) {
       // Symmetrical Encryption Types
      case EncryptionScopeType.CHANNEL:
      case EncryptionScopeType.ROLE:
      case EncryptionScopeType.TEAM:
        return this.symDecrypt(encrypted)
      // Asymmetrical Encryption Types
      case EncryptionScopeType.USER:
        return this.asymUserDecrypt(encrypted, signature, context)
      // Unknown Type
      default:
        throw new Error(`Unknown encryption scope type ${encrypted.scope.type}`)
    }
  }

  private symDecrypt(encrypted: EncryptedPayload): any {
    if (encrypted.scope.type !== EncryptionScopeType.TEAM && encrypted.scope.name == null) {
      throw new Error(`Must provide a scope name when encryption scope is set to ${encrypted.scope.type}`)
    }

    return this.sigChain.team.decrypt({
      contents: bs58.default.decode(encrypted.contents),
      recipient: {
        ...encrypted.scope,
        // you don't need a name on the scope when encrypting but you need one for decrypting because of how LFA searches for keys in lockboxes
        name: encrypted.scope.type === EncryptionScopeType.TEAM ? EncryptionScopeType.TEAM : encrypted.scope.name!
      }
    })
  }

  private asymUserDecrypt(encrypted: EncryptedPayload, signature: lfa.SignedEnvelope, context: lfa.LocalUserContext): any {
    if (encrypted.scope.name == null) {
      throw new Error(`Must provide a user ID when encryption scope is set to ${encrypted.scope.type}`)
    }

    const senderKeys = this.sigChain.crypto.getPublicKeysForMembersById([signature.author.name])
    const recipientKey = context.user.keys.encryption.secretKey
    const senderKey = senderKeys[0].encryption

    return lfa.asymmetric.decrypt({
      cipher: encrypted.contents,
      senderPublicKey: senderKey,
      recipientSecretKey: recipientKey
    })
  }
}

export {
  CryptoService
}