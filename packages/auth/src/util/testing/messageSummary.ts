import { SyncPayload } from '@/sync/types'
import { truncateHashes } from '../truncateHashes'

// export const logMessages = (msgs: NetworkMessage[]) => {
//   msgs.forEach(m => {
//     const summary = truncateHashes(util.inspect(messageSummary(m.body), { depth: 1, colors: true }))
//     console.log(`from ${m.from} to ${m.to}: ${summary}`)
//   })
// }

export const syncMessageSummary = (m: SyncPayload<any, any> | undefined) => {
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
