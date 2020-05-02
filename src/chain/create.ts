import { append } from './append'
import { ContextWithSecrets, PartialLinkBody, SignatureChain } from './types'

export const create = (payload: any = {}, context: ContextWithSecrets) => {
  // create new root link
  const link: PartialLinkBody = {
    type: 'ROOT',
    payload,
  }

  // add it to an empty chain
  const chain = [] as SignatureChain
  return append(chain, link, context)
}
