import { wrap } from '../helpers'
import { type CommandFn } from '../types.js'

export const isConnectedTo: CommandFn = (subject, userName: string) =>
  wrap(subject).peerConnectionStatus(userName).should('equal', 'connected')
