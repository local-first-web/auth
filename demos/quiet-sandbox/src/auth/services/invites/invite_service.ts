/**
 * Handles invite-related chain operations
 */

import { BaseChainService } from "../base_service.js"
import { ValidationResult } from "../../../../../../packages/crdx/dist/validator/types.js"
import { Base58, InvitationState, InviteResult, Keyset, ProofOfInvitation, UnixTimestamp } from "@localfirst/auth"
import { SigChain } from "auth/chain.js"
import { RoleName } from "../roles/roles.js"

const DEFAULT_MAX_USES = 1
const DEFAULT_INVITATION_VALID_FOR_MS = 604_800_000 // 1 week

class InviteService extends BaseChainService {
  protected static _instance: InviteService | undefined

  public static init(): InviteService {
    if (InviteService._instance == null) {
      InviteService._instance = new InviteService() 
    }

    return InviteService.instance
  }

  public create(validForMs: number = DEFAULT_INVITATION_VALID_FOR_MS, maxUses: number = DEFAULT_MAX_USES) {
    const expiration = (Date.now() + validForMs) as UnixTimestamp
    const invitation: InviteResult = this.activeSigChain.team.inviteMember({
      expiration,
      maxUses
    })
    this.activeSigChain.persist()
    return invitation
  }

  public revoke(id: string) {
    this.activeSigChain.team.revokeInvitation(id)
    this.activeSigChain.persist()
  }

  public getById(id: Base58): InvitationState {
    return this.activeSigChain.team.getInvitation(id)
  }

  public generateProof(seed: string): ProofOfInvitation {
    return SigChain.lfa.invitation.generateProof(seed)
  }

  public validateProof(proof: ProofOfInvitation): boolean {
    const validationResult = this.activeSigChain.team.validateInvitation(proof) as ValidationResult
    if (!validationResult.isValid) {
      console.error(`Proof was invalid or was on an invalid invitation`, validationResult.error)
      return true
    }

    return true
  }

  public acceptProof(proof: ProofOfInvitation, username: string, publicKeys: Keyset) {
    this.activeSigChain.team.admitMember(proof, publicKeys, username)
    this.activeSigChain.persist()
  }

  public admitMemberFromInvite(proof: ProofOfInvitation, username: string, userId: string, publicKeys: Keyset): string {
    this.activeSigChain.team.admitMember(proof, publicKeys, username)
    SigChain.roles.addMember(userId, RoleName.MEMBER)
    this.activeSigChain.persist()
    return username
  }

  public static get instance(): InviteService {
    if (InviteService._instance == null) {
      throw new Error(`InviteService hasn't been initialized yet!  Run init() before accessing`)
    }

    return InviteService._instance
  }
}

export {
  InviteService
}