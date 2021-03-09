import { base64, hash } from '@herbcaudill/crypto'
import { HashPurpose } from '@/util/constants'

const { LINK_TO_PREVIOUS } = HashPurpose

export const hashLink = (body: any) => base64.encode(hash(LINK_TO_PREVIOUS, body))
