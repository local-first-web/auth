// ignore file coverage
import { SyncMessage } from '@localfirst/crdx'
import { truncateHashes } from '../truncateHashes'

export const syncMessageSummary = (m: SyncMessage<any, any> | undefined) => {
  if (m === undefined) {
    return 'DONE'
  } else {
    const { head, links, need } = m
    const body = { head } as any
    if (links) body.links = Object.keys(links).join(', ')
    if (need) body.need = need.join(', ')

    return truncateHashes(JSON.stringify(body))
  }
}
