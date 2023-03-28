import React, { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './components/App'
import '@ibm/plex/css/ibm-plex.css'
import './index.css'

ReactDOM.createRoot(document.querySelector('#root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
