import { append } from '/chain/append'
import { PartialLinkBody, SignatureChain } from '/chain/types'
import { LocalUserContext } from '/context'

export const create = (payload: any = {}, context: LocalUserContext) => {
  // create new root link
  const link: PartialLinkBody = {
    type: 'ROOT',
    payload,
  }

  // add it to an empty chain
  const chain = [] as SignatureChain
  return append(chain, link, context)
}
