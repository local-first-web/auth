import { SyncState } from './types'

export const initSyncState = (): SyncState => ({
  lastCommonHead: null,
  ourHead: null,
  theirHead: null,
  ourNeed: [],
  theirNeed: [],
  weHaveSent: [],
  theyHaveSent: [],
  pendingLinks: {},
})
