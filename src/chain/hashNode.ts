import { base64, hash } from '@herbcaudill/crypto'
import { HashPurpose } from '/util'

const { LINK_TO_PREVIOUS } = HashPurpose

export const hashNode = (body: any) => base64.encode(hash(LINK_TO_PREVIOUS, body))
