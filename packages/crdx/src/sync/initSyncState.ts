import { SyncState } from './types'

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
