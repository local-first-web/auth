/**
 * Handles invite-related chain operations
 */

import { BaseChainService } from "../baseService.js"
import { ValidationResult } from "../../../../../../packages/crdx/dist/validator/types.js"
import { Base58, InvitationState, InviteResult, Keyset, ProofOfInvitation, UnixTimestamp } from "@localfirst/auth"
import { SigChain } from "../../chain.js"
import { RoleName } from "../roles/roles.js"

const DEFAULT_MAX_USES = 1
const DEFAULT_INVITATION_VALID_FOR_MS = 604_800_000 // 1 week

class InviteService extends BaseChainService {
  public static init(sigChain: SigChain): InviteService {
    return new InviteService(sigChain)
  }

  public create(validForMs: number = DEFAULT_INVITATION_VALID_FOR_MS, maxUses: number = DEFAULT_MAX_USES) {
    const expiration = (Date.now() + validForMs) as UnixTimestamp
    const invitation: InviteResult = this.sigChain.team.inviteMember({
      expiration,
      maxUses
    })
    // this.activeSigChain.persist()
    return invitation
  }

  public revoke(id: string) {
    this.sigChain.team.revokeInvitation(id)
    // this.activeSigChain.persist()
  }

  public getById(id: Base58): InvitationState {
    return this.sigChain.team.getInvitation(id)
  }

  public static generateProof(seed: string): ProofOfInvitation {
    return SigChain.lfa.invitation.generateProof(seed)
  }

  public validateProof(proof: ProofOfInvitation): boolean {
    const validationResult = this.sigChain.team.validateInvitation(proof) as ValidationResult
    if (!validationResult.isValid) {
      console.error(`Proof was invalid or was on an invalid invitation`, validationResult.error)
      return true
    }

    return true
  }

  public acceptProof(proof: ProofOfInvitation, username: string, publicKeys: Keyset) {
    this.sigChain.team.admitMember(proof, publicKeys, username)
    // this.activeSigChain.persist()
  }

  public admitMemberFromInvite(proof: ProofOfInvitation, username: string, userId: string, publicKeys: Keyset): string {
    this.sigChain.team.admitMember(proof, publicKeys, username)
    this.sigChain.roles.addMember(userId, RoleName.MEMBER)
    // this.activeSigChain.persist()
    return username
  }
}

export {
  InviteService
}