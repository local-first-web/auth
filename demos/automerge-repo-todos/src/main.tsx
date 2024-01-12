import ReactDOM from 'react-dom/client'
import { Provider as StoreProvider } from 'react-redux'
import { App } from './components/App.js'
import { LocalFirstAuthProvider } from './components/LocalFirstAuthProvider'
import './index.css'
import '@ibm/plex/css/ibm-plex.css'
import { store } from './store'
import { Layout } from './components/Layout'

ReactDOM.createRoot(document.querySelector('#root')!).render(
  <StoreProvider store={store}>
    <LocalFirstAuthProvider>
      <App />
    </LocalFirstAuthProvider>
  </StoreProvider>
)
