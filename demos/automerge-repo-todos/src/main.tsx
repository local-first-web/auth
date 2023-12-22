import { Repo } from '@automerge/automerge-repo'
import { BroadcastChannelNetworkAdapter } from '@automerge/automerge-repo-network-broadcastchannel'
import { BrowserWebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket'
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb'
import * as Auth from '@localfirst/auth'
import { AuthProvider, ShareId } from '@localfirst/auth-provider-automerge-repo'
import ReactDOM from 'react-dom/client'
import { Provider as StoreProvider } from 'react-redux'
import { App } from './components/App.js'
import './index.css'
import { store } from './store'
import { LocalFirstAuthProvider } from './components/LocalFirstAuthProvider'

// const host = 'localhost:3030'
// const shareId = 'anonymous-todo-app' as ShareId

// // Initialize user & device
// // todo: persist these and check for existing user/device
// const userName = 'alice' // TODO: get from user input
// const user = Auth.createUser(userName)
// const device = Auth.createDevice(user.userId, `${userName}'s device`)

// // Storage is shared by the auth provider and the repo
// const storage = new IndexedDBStorageAdapter('automerge-repo-demo-todo')

// // Create auth provider
// const authProvider = new AuthProvider({ user, device, storage })

// // Create an anonymous share
// authProvider.addAnonymousShare(shareId)

// // Tell the sync server about it
// fetch(`http://${host}/anonymous-shares`, {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ shareId }),
// })

// // Create repo

// const repo = new Repo({
//   network: [
//     new BroadcastChannelNetworkAdapter(),
//     authProvider.wrap(new BrowserWebSocketClientAdapter(`ws://${host}`)),
//   ],
//   storage,
// })

ReactDOM.createRoot(document.querySelector('#root')!).render(
  <StoreProvider store={store}>
    <LocalFirstAuthProvider>
      <App />
    </LocalFirstAuthProvider>
  </StoreProvider>
)
