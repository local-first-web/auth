export const getSyncServerUrl = () => {
  const protocol = window.location.protocol
  return `${protocol}//${getSyncServerDomain()}${getSyncServerPort()}`
}

export const getSyncServerDomain = () => {
  return process.env.NODE_ENV === 'production'
    ? 'sync.xdev.devresults.com'
    : window.location.hostname
}

export const getSyncServerPort = () => {
  if (process.env.NODE_ENV === 'production') {
    return ''
  }

  return window.location.port ? ':3030' : ''
}

export const getSyncServerWebsocketUrl = () => {
  const protocol = window.location.protocol.replace('http', 'ws')
  return `${protocol}//${getSyncServerDomain()}${getSyncServerPort()}`
}
