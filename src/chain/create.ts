import { append } from './append'
import { Context, LinkType, PartialLinkBody, SignatureChain } from './types'

interface CreateArgs {
  payload: any
  context: Context
}

export const create = ({ payload = {}, context }: CreateArgs) => {
  const { localUser, device, client } = context

  // create new root link
  const link: PartialLinkBody = {
    type: LinkType.ROOT,
    payload,
    user: localUser.name,
    device,
    client,
  }

  // add it to an empty chain
  const chain = [] as SignatureChain
  return append({ chain, link, localUser })
}
