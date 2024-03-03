import type { Message } from '@automerge/automerge-repo'
import type { ConnectionEvents } from '@localfirst/auth'
import { EventEmitter } from '@herbcaudill/eventemitter42'

export abstract class AbstractConnection extends EventEmitter<ConnectionEvents> {
  abstract start(): AbstractConnection

  abstract stop(): AbstractConnection

  abstract deliver(serializedMessage: Uint8Array): void

  abstract send(message: Message): void

  abstract get state(): StateValue
}

// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export type StateValueMap = {
  [key: string]: StateValue
}

export declare type StateValue = string | StateValueMap
