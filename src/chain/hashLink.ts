import { LinkBody } from '/chain/types'
import { hash } from '/crypto'
import { base64, HashPurpose } from '/util'

const { LINK_TO_PREVIOUS } = HashPurpose

export const hashLink = (body: LinkBody) => base64.encode(hash(LINK_TO_PREVIOUS, body))
