import nacl from 'tweetnacl'
import { base30 } from '/lib'
import { IKEY_LENGTH } from '/invitation/create'

// TODO make key strength & encoding pluggable

// ## Step 1a
// The invitation key is a randomly generated secret that is sent to Bob via a pre-authenticated
// channel (e.g. WhatsApp). If Alice is inviting Bob, only Alice and Bob will ever have this key.
// (Keybase docs refer to this as `iKey`.)

/**
 * Returns a 16-character base30 string, for example `4kgd5mwq5z4fmfwq`, to be used as the secret
 * key for an invitation.
 *
 * Note: Alternatively, you can come up with your own method of generating the secret key. The
 * length of the key specified in the protocol makes it quite strong, and the choice of the base30
 * character set omits confusing characters like `1` and `l`. Depending on the security context, it
 * might make sense to strike a different balance between strength and human-friendliness - one
 * application might use BIP39 word pairs (weaker but friendlier), while another might use
 * 32-character strings using the full ASCII character set (stronger but practically impossible to
 * remember or communicate verbally).
 */
export const newSecretKey = (length = IKEY_LENGTH) => base30.encode(nacl.randomBytes(length))
