import type { PeerId } from '@libp2p/interface'
import { CallableQuietLogger, createQuietLogger, QuietLogger } from './logger.js'


export interface QuietLibp2pLogger {
  (formatter: string, ...args: any[]): void
  error(formatter: string, ...args: any[]): void
  trace(formatter: any, ...args: any[]): void
  enabled: boolean
}

export interface ComponentLogger {
  forComponent(name: string): CallableQuietLogger
}

export interface PeerLoggerOptions {
  prefixLength: number
  suffixLength: number
}

/**
 * Create a component logger that will prefix any log messages with a truncated
 * peer id.
 *
 * @example
 *
 * ```TypeScript
 * import { peerLogger } from '@libp2p/logger'
 * import { peerIdFromString } from '@libp2p/peer-id'
 *
 * const peerId = peerIdFromString('12D3FooBar')
 * const logger = peerLogger(peerId)
 *
 * const log = logger.forComponent('my-component')
 * log.info('hello world')
 * // logs "12…oBar:my-component hello world"
 * ```
 */
export function peerLogger (peerId: PeerId, options: Partial<PeerLoggerOptions> = {}): ComponentLogger {
  return prefixLogger(peerId.toString())
}

/**
 * Create a component logger that will prefix any log messages with the passed
 * string.
 *
 * @example
 *
 * ```TypeScript
 * import { prefixLogger } from '@libp2p/logger'
 *
 * const logger = prefixLogger('my-node')
 *
 * const log = logger.forComponent('my-component')
 * log.info('hello world')
 * // logs "my-node:my-component hello world"
 * ```
 */
export function prefixLogger (prefix: string): ComponentLogger {
  return {
    forComponent (name: string) {
      return logger(`${prefix}:${name}`)()
    }
  }
}

export function suffixLogger (suffix: string): ComponentLogger {
  return {
    forComponent (name: string) {
      return logger(`${name}:${suffix}`)()
    }
  }
}

/**
 * Create a component logger
 *
 * @example
 *
 * ```TypeScript
 * import { defaultLogger } from '@libp2p/logger'
 * import { peerIdFromString } from '@libp2p/peer-id'
 *
 * const logger = defaultLogger()
 *
 * const log = logger.forComponent('my-component')
 * log.info('hello world')
 * // logs "my-component hello world"
 * ```
 */
export function defaultLogger (): ComponentLogger {
  return {
    forComponent (name: string) {
      return logger(name)()
    }
  }
}

/**
 * Creates a logger for the passed component name.
 *
 * @example
 *
 * ```TypeScript
 * import { logger } from '@libp2p/logger'
 *
 * const log = logger('my-component')
 * log.info('hello world')
 * // logs "my-component hello world"
 * ```
 */
export function logger (name: string): () => CallableQuietLogger {
  return (): CallableQuietLogger => {
    const LOGGER = createQuietLogger(name)()

    const makeCallable = (logger: QuietLogger): CallableQuietLogger => {
      const callable = {
        LOGGER: logger,
        enabled: logger.enabled,
        error: (message: any, ...optionalParams: any[]) => logger.error(message, ...optionalParams),
        trace: (message: any, ...optionalParams: any[]) => logger.trace(message, ...optionalParams)
      }
      const func = (message: any, ...optionalParams: any[]) => logger.info(message, ...optionalParams)
      return Object.assign(func, callable)
    }
    

    return makeCallable(LOGGER)
  }
}
