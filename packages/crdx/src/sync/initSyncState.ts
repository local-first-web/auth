import { type SyncState } from './types.js'

export const initSyncState = (): SyncState => ({
  their: {
    head: [],
    encryptedLinks: {},
    need: [],
    parentMap: {},
  },

  our: {
    head: [],
    links: [],
  },

  lastCommonHead: [],
  failedSyncCount: 0,
})
