import { append } from './append'
import { PartialLinkBody, SignatureChain } from './types'
import { baseLinkType } from './baseLinkType'
import { ContextWithSecrets } from '../context'

export const create = (payload: any = {}, context: ContextWithSecrets) => {
  // create new root link
  const link: PartialLinkBody = {
    type: baseLinkType.ROOT,
    payload,
  }

  // add it to an empty chain
  const chain = [] as SignatureChain
  return append(chain, link, context)
}
