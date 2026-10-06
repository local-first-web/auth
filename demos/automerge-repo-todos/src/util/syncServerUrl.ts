const protocol = window.location.protocol
const wsProtocol = protocol.replace('http', 'ws')
const isProduction = process.env.NODE_ENV === 'production'

export const host = process.env.SYNC_SERVER_URL || (isProduction ? undefined : 'localhost:3030')
if (!host) throw new Error('SYNC_SERVER_URL must be set')

export const [domain, port] = host.split(':')

export const url = `${protocol}//${host}`
export const wsUrl = `${wsProtocol}//${host}`
