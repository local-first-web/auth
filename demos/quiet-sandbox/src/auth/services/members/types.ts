import { Keyset, LocalUserContext, ProofOfInvitation } from "@localfirst/auth"

export type MemberSearchOptions = { 
  includeRemoved: boolean
  throwOnMissing: boolean 
}

export type ProspectiveUser = {
  context: LocalUserContext
  inviteProof: ProofOfInvitation
  publicKeys: Keyset
}
