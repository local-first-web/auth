import { type Invitation } from '../../invitation/index.js'
import { type Lockbox } from '../../lockbox/index.js'
import { KeyType } from '../../util/types.js'
import { type Transform } from '../types.js'

/**
 * Adds an invitation to the list of open invitations, along with the ear it was posted with.
 *
 * An invitation for a device comes with lockboxes holding the member's own keys, addressed to a
 * keyset derived from the invitation seed — the "ear". Which keyset that is has to be recorded
 * here, by the reducer, on the link that posts the invitation. Deciding it later by looking for the
 * earliest lockbox naming the invitation's signature key is not the same thing: position in the
 * replayed graph is settled by the resolver, whose input includes a `prev` its author chose, so an
 * author who learns the signature key from the public invitation link can post an ear of their own
 * on an older head and come out first. Measured — it took the real invitee's ear out of the
 * rotation set and put the attacker's in.
 */
export const postInvitation =
  (invitation: Invitation, lockboxes: Lockbox[] = []): Transform =>
  state => {
    const ear = lockboxes.find(
      ({ recipient }) =>
        recipient.type === KeyType.EPHEMERAL &&
        (recipient as { signature?: string }).signature === invitation.publicKey
    )

    const invitationState = {
      ...invitation,
      uses: 0,
      revoked: false,
      admitted: [],
      earPublicKey: ear?.recipient.publicKey,
    }

    return {
      ...state,
      invitations: {
        ...state.invitations,
        [invitation.id]: invitationState,
      },
    }
  }
