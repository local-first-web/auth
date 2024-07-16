/**
 * Handles invite-related chain operations
 */

import * as auth from "@localfirst/auth"
import { BaseChainService } from "../base_service.js"
import { ValidationResult } from "../../../../../../packages/crdx/dist/validator/types.js"

const DEFAULT_MAX_USES = 1
const DEFAULT_INVITATION_VALID_FOR_MS = 604_800_000 // 1 week

class InviteService extends BaseChainService {
  protected static instance: InviteService | undefined

  public static init(): InviteService {
    if (InviteService.instance == null) {
      InviteService.instance = new InviteService() 
    }

    return InviteService.instance
  }

  public static getInstance(): InviteService {
    if (InviteService.instance == null) {
      throw new Error(`InviteService hasn't been initialized yet!  Run init() before accessing`)
    }

    return InviteService.instance
  }

  public create(validForMs: number = DEFAULT_INVITATION_VALID_FOR_MS, maxUses: number = DEFAULT_MAX_USES) {
    const expiration = (Date.now() + validForMs) as auth.UnixTimestamp
    const invitation: auth.InviteResult = this.getChain().getTeam().inviteMember({
      expiration,
      maxUses
    })
    this.getChain().persist()
    return invitation
  }

  public revoke(id: string) {
    this.getChain().getTeam().revokeInvitation(id)
    this.getChain().persist()
  }

  public getById(id: auth.Base58): auth.InvitationState {
    return this.getChain().getTeam().getInvitation(id)
  }

  public generateProof(seed: string): auth.ProofOfInvitation {
    return auth.invitation.generateProof(seed)
  }

  public validateProof(proof: auth.ProofOfInvitation): boolean {
    const validationResult = this.getChain().getTeam().validateInvitation(proof) as ValidationResult
    if (!validationResult.isValid) {
      console.error(`Proof was invalid or was on an invalid invitation`, validationResult.error)
      return true
    }

    return true
  }

  public acceptProof(proof: auth.ProofOfInvitation, username: string, publicKeys: auth.Keyset) {
    this.getChain().getTeam().admitMember(proof, publicKeys, username)
    this.getChain().persist()
  }
}

export {
  InviteService
}