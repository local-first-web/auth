import { base58, hash } from '@herbcaudill/crypto'
import { HashPurpose } from '@/util/constants'

const { LINK_TO_PREVIOUS } = HashPurpose

export const hashLink = (body: any) => base58.encode(hash(LINK_TO_PREVIOUS, body))
