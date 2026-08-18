import { memoize } from '@localfirst/shared'
import { signatures } from '@localfirst/crypto'
import { type Invitation, type InvitationState, type ProofOfInvitation } from 'invitation/types.js'
import { VALID, type ValidationResult } from 'util/index.js'

/**
 * Whether this invitation is still good for admitting `invitee`.
 *
 * The invitee is optional only because a link can arrive without a proof on it; `admissionMustBeProven`
 * is what rejects that, and this says nothing about it.
 */
export const invitationCanBeUsed = (
  invitation: InvitationState,
  timeOfUse: number,
  invitee?: string
) => {
  const { revoked, maxUses, uses, expiration, admitted } = invitation
  if (revoked) {
    return fail('The invitation has been revoked')
  }

  if (maxUses > 0 && uses >= maxUses) {
    return fail('The invitation cannot be used again')
  }

  if (expiration > 0 && expiration < timeOfUse) {
    return fail('The invitation has expired')
  }

  // An invitation good for several uses is for admitting several people, not for admitting one of
  // them twice. The proof is published on the graph and is bound to the invitee's own keys, so
  // without this any member could replay it — putting someone the team had removed back on it,
  // under the current generation of the team keys.
  if (invitee !== undefined && admitted.includes(invitee)) {
    return fail(`This invitation has already been used to admit '${invitee}'`)
  }

  return VALID
}

export const validate = memoize(
  (proof: ProofOfInvitation, invitation: Invitation): ValidationResult => {
    const { id, invitee, keyHash, signature } = proof

    // Check that id from proof matches invitation
    if (id !== invitation.id) {
      return fail("IDs don't match", { proof, invitation })
    }

    // Check signature on proof against public key from invitation. Since the invitee and the
    // fingerprint of their keys are both part of the signed payload, a proof generated for one
    // invitee can't be re-presented for another, or spent on a keyset the invitee didn't choose.
    const { publicKey } = invitation
    const signatureIsValid = signatures.verify({
      payload: { id, invitee, keyHash },
      signature,
      publicKey,
    })
    if (!signatureIsValid) {
      return fail('Signature provided is not valid', { proof, invitation })
    }

    return VALID
  },

  // Without a resolver, lodash keys the cache on the first argument alone — and by identity, since
  // that argument is an object. That would make the answer for one proof stand in for the answer
  // for any other proof that happens to be the same object, whatever invitation it's presented
  // against. Everything either argument contributes to the answer goes into the key, and it's
  // serialized rather than joined: `id` and `invitee` arrive off the wire as arbitrary strings, so
  // a separator they can both contain wouldn't tell two different proofs apart.
  (proof, invitation) =>
    JSON.stringify([
      proof.id,
      proof.invitee,
      proof.keyHash,
      proof.signature,
      invitation.id,
      invitation.publicKey,
    ])
)

export const fail = (message: string, details?: any) =>
  ({
    isValid: false,
    error: new InvitationValidationError(message, details),
  }) as ValidationResult

export class InvitationValidationError extends Error {
  constructor(message: string, details?: any) {
    super()
    this.name = 'Invitation validation failed'
    this.message = message
    this.details = details
  }

  public index?: number
  public details?: any
}
