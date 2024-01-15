import '@ibm/plex/css/ibm-plex.css'
import ReactDOM from 'react-dom/client'
import { App } from './components/App.js'
import { LocalFirstAuthProvider } from './components/LocalFirstAuthProvider'
import './index.css'

ReactDOM.createRoot(document.querySelector('#root')!).render(
  <LocalFirstAuthProvider>
    <App />
  </LocalFirstAuthProvider>
)
