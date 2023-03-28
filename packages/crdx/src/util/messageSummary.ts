import { truncateHashes } from './truncateHashes'
import { SyncMessage } from '/sync'
import { NetworkMessage } from '/test/helpers/Network'

export const logMessages = (msgs: NetworkMessage[]) => {
  const result = msgs.map(m => JSON.stringify(networkMessageSummary(m))).join('\n')
  console.log(result)
}

export const networkMessageSummary = (m: NetworkMessage) => {
  return {
    from: m.from,
    to: m.to,
    ...syncMessageSummary(m.body),
  }
}
export const syncMessageSummary = (m: SyncMessage<any, any>) => {
  if (m === undefined) {
    return 'DONE'
  } else {
    const { head, parentMap, links, need, error } = m
    const body = { head: head.join() } as any
    if (parentMap) body.linkMap = Object.keys(parentMap).join()
    if (links) body.links = Object.keys(links).join()
    if (need) body.need = need.join()
    if (error) body.error = error.message
    return truncateHashes(body)
  }
}
