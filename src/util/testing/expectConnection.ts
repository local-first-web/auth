import { Protocol } from '/connection'

export const expectConnection = async (connections: Protocol[]) => {
  // ✅ They're both connected
  await connectionEvent(connections, 'connected')

  const firstKey = connections[0].sessionKey
  connections.forEach((connection) => {
    expect(connection.state).toEqual('connected')
    // ✅ They've converged on a shared secret key
    expect(connection.sessionKey).toEqual(firstKey)
  })
}
export const expectDisconnection = async (connections: Protocol[], message?: string) => {
  // ✅ They're both disconnected
  await connectionEvent(connections, 'disconnected')
  connections.forEach((connection) => {
    expect(connection.state).toEqual('disconnected')
    // ✅ If we're checking for a message, it matches
    if (message !== undefined) expect(connection.error!.message).toContain(message)
  })
}
/** Promisified event */
const connectionEvent = (connections: Protocol[], event: string) =>
  Promise.all(connections.map((c) => new Promise((resolve) => c.on(event, () => resolve()))))
