import '@ibm/plex/css/ibm-plex.css'
import ReactDOM from 'react-dom/client'
import { App } from './components/App.js'
import { AuthContextProvider } from './components/AuthContextProvider.js'
import './index.css'

ReactDOM.createRoot(document.querySelector('#root')!).render(
  <AuthContextProvider>
    <App />
  </AuthContextProvider>
)
