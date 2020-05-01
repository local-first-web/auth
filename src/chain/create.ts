import { LocalUser } from '~stash'
import { Device, Client, LinkBody, LinkType, SignatureChain } from './types'
import { append } from './append'

interface CreateArgs {
  payload: any
  context: {
    localUser: LocalUser
    device: Device
    client: Client
  }
}
export const create = ({ payload = {}, context }: CreateArgs) => {
  const { localUser, device, client } = context

  // create new root link
  const link: LinkBody = {
    type: LinkType.ROOT,
    payload,
    user: localUser.name,
    device,
    client,
    timestamp: new Date().getTime(),
    index: 0,
  }

  // add it to an empty chain
  const chain = [] as SignatureChain
  return append({ chain, link, localUser })
}
