// ignore file coverage
import { type SyncMessage } from '@localfirst/crdx'
import { truncateHashes } from '@localfirst/auth-shared'

export const syncMessageSummary = (m: SyncMessage | undefined) => {
  if (m === undefined) {
    return 'DONE'
  }

  const { head, links, need } = m
  const body = { head } as any
  if (links) {
    body.links = Object.keys(links).join(', ')
  }

  if (need) {
    body.need = need.join(', ')
  }

  return truncateHashes(JSON.stringify(body))
}
