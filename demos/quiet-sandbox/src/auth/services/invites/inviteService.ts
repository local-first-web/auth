/**
 * Handles invite-related chain operations
 */

import { BaseChainService } from "../baseService.js"
import { ValidationResult } from "../../../../../../packages/crdx/dist/validator/types.js"
import * as lfa from "@localfirst/auth"
import { SigChain } from "../../chain.js"
import { RoleName } from "../roles/roles.js"

export const DEFAULT_MAX_USES = 1
export const DEFAULT_INVITATION_VALID_FOR_MS = 604_800_000 // 1 week

class InviteService extends BaseChainService {
  public static init(sigChain: SigChain): InviteService {
    return new InviteService(sigChain)
  }

  public create(validForMs: number = DEFAULT_INVITATION_VALID_FOR_MS, maxUses: number = DEFAULT_MAX_USES): lfa.InviteResult {
    const expiration = (Date.now() + validForMs) as lfa.UnixTimestamp
    const invitation: lfa.InviteResult = this.sigChain.team.inviteMember({
      expiration,
      maxUses
    })
    // this.activeSigChain.persist()
    return invitation
  }

  public createForDevice(validForMs: number = DEFAULT_INVITATION_VALID_FOR_MS): lfa.InviteResult {
    const expiration = (Date.now() + validForMs) as lfa.UnixTimestamp
    return this.sigChain.team.inviteDevice({
      expiration
    })
  }

  public revoke(id: string) {
    this.sigChain.team.revokeInvitation(id)
    // this.activeSigChain.persist()
  }

  public getById(id: lfa.Base58): lfa.InvitationState {
    return this.sigChain.team.getInvitation(id)
  }

  public static generateProof(seed: string): lfa.ProofOfInvitation {
    return lfa.invitation.generateProof(seed)
  }

  public validateProof(proof: lfa.ProofOfInvitation): boolean {
    const validationResult = this.sigChain.team.validateInvitation(proof) as ValidationResult
    if (!validationResult.isValid) {
      console.error(`Proof was invalid or was on an invalid invitation`, validationResult.error)
      return true
    }

    return true
  }

  public acceptProof(proof: lfa.ProofOfInvitation, username: string, publicKeys: lfa.Keyset) {
    this.sigChain.team.admitMember(proof, publicKeys, username)
    // this.activeSigChain.persist()
  }

  public admitDevice(proof: lfa.ProofOfInvitation, device: lfa.FirstUseDevice | lfa.DeviceWithSecrets) {
    this.sigChain.team.admitDevice(proof, device)
  }

  public admitMemberFromInvite(proof: lfa.ProofOfInvitation, username: string, userId: string, publicKeys: lfa.Keyset): string {
    this.sigChain.team.admitMember(proof, publicKeys, username)
    this.sigChain.roles.addMember(userId, RoleName.MEMBER)
    // this.activeSigChain.persist()
    return username
  }

  public getAllInvites(): lfa.InvitationState[] {
    const inviteMap = this.sigChain.team.invitations()
    const invites: lfa.InvitationState[] = []
    for (const invite of Object.entries(inviteMap)) {
      invites.push(invite[1])
    }
    return invites
  }
}

export {
  InviteService
}