import { Repo, type PeerId } from '@automerge/automerge-repo'
import { BrowserWebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket'
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb'
import type * as Auth from '@localfirst/auth'
import { AuthProvider } from '@localfirst/auth-provider-automerge-repo'
import { eventPromise } from '@localfirst/auth-shared'
import { host, wsUrl } from './syncServerUrl'

/**
 * Creates an auth provider and a repo with a shared storage adapter and a websocket adapter.
 * Returns when the repo has a working network connection.
 */
export const createRepoWithAuth = async ({ user, device }: Params) => {
  // We'll use the same storage adapter for the auth provider and the repo
  const storage = new IndexedDBStorageAdapter()
  const auth = new AuthProvider({ user, device, storage, server: host })

  const adapter = new BrowserWebSocketClientAdapter(wsUrl)
  const authAdapter = auth.wrap(adapter)

  // Create new repo with websocket adapter
  const repo = new Repo({
    peerId: device.deviceId as PeerId,
    network: [authAdapter],
    storage,
  })

  await eventPromise(repo.networkSubsystem, 'ready')

  return { auth, repo }
}

type Params = {
  user?: Auth.UserWithSecrets
  device: Auth.DeviceWithSecrets
}
