/**
 * Handles invite-related chain operations
 */

import { BaseChainService } from "../baseService.js"
import * as lfa from "@localfirst/auth"
import { SigChain } from "../../chain.js"

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

  // ISLA: Can be deleted (Reason: only used for printing data in sandbox)
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