import { SyncMessage } from 'crdx'
import { truncateHashes } from '../truncateHashes'

export const syncMessageSummary = (m: SyncMessage<any, any> | undefined) => {
  if (m === undefined) {
    return 'DONE'
  } else {
    const { head, encodedFilter, links, need } = m
    const body = { head } as any
    if (encodedFilter?.length) body.encodedFilter = encodedFilter.length
    if (links) body.links = Object.keys(links).join(', ')
    if (need) body.need = need.join(', ')

    return truncateHashes(JSON.stringify(body))
  }
}
