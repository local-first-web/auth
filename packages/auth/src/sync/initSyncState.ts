import { SyncState } from './types'

export const initSyncState = (): SyncState => ({
  commonHead: null,
  ourHead: null,
  theirHead: null,
  ourNeed: [],
  theirNeed: [],
  weHaveSent: [],
  theyHaveSent: [],
  pendingLinks: {},
})
