import { Windmill } from '@windmill/react-ui'
import React, { StrictMode } from 'react'
import ReactDOM from 'react-dom'
import { App } from './components/App'
import '@ibm/plex'
import './index.css'

import { theme } from './theme'

ReactDOM.render(
  <StrictMode>
    <Windmill theme={theme}>
      <App />
    </Windmill>
  </StrictMode>,
  document.getElementById('root')
)
