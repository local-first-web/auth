import { Repo, type PeerId } from '@automerge/automerge-repo'
import { BrowserWebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket'
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb'
import type * as Auth from '@localfirst/auth'
import { AuthProvider } from '@localfirst/auth-provider-automerge-repo'
import { eventPromise } from '@localfirst/auth-shared'
import { getSyncServerWebsocketUrl } from './getSyncServer'

export async function createRepoWithAuth(
  user: Auth.UserWithSecrets,
  device: Auth.DeviceWithSecrets
) {
  const storage = new IndexedDBStorageAdapter()
  const auth = new AuthProvider({ user, device, storage })

  const url = getSyncServerWebsocketUrl()
  const adapter = new BrowserWebSocketClientAdapter(url)
  const authAdapter = auth.wrap(adapter)

  // Create new automerge-repo with websocket adapter
  const repo = new Repo({
    peerId: device.deviceId as PeerId,
    network: [authAdapter],
    storage,
  })

  await Promise.all([
    eventPromise(authAdapter, 'ready'),
    eventPromise(auth, 'ready'),
    eventPromise(repo.networkSubsystem, 'ready'),
  ])

  return { auth, repo }
}
