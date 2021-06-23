import React from 'react'
import ReactDOM from 'react-dom'
import { App } from './components/App'
import { Windmill } from '@windmill/react-ui'
import { theme } from './theme'

ReactDOM.render(
  <React.StrictMode>
    <Windmill theme={theme}>
      <App />
    </Windmill>
  </React.StrictMode>,
  document.getElementById('root')
)
