import debug from 'debug'
import { Console } from 'console'

//@ts-ignore
import colors from 'ansi-colors'
import { DateTime } from 'luxon'
import { isPeerId } from '@libp2p/interface'
import { CID } from 'multiformats'
import type { Key } from 'interface-datastore'
import { isMultiaddr } from '@multiformats/multiaddr'
import { createHash } from 'crypto'
import * as fs from 'fs'
import * as util from 'util'
import { base32 } from 'multiformats/bases/base32'
import { base58btc } from 'multiformats/bases/base58'
import { base64 } from 'multiformats/bases/base64'
import type { PeerId } from '@libp2p/interface'
import type { Multiaddr } from '@multiformats/multiaddr'

import { findAllByKeyAndReplace } from '../utils.js'
import { LogMessage, LogQueue } from './logQueue.js'

const COLORIZE = process.env['COLORIZE'] === 'true'

export type CreateLoggerFunction = (moduleName: string) => QuietLogger

export type CallableQuietLogger = {
  (message: any, ...optionalParams: any[]): void;
  error(formatter: string, ...args: any[]): void
  trace(formatter: any, ...args: any[]): void
  enabled: boolean
  LOGGER: QuietLogger
}

/**
 * Available log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  ERROR = 'error',
  INFO = 'info',
  LOG = 'log',
  WARN = 'warn',
  TIMER = 'timer',
  TRACE = 'trace'
}

/**
 * This determines the color scheme of each log type
 */
//@ts-ignore
colors.theme({
  // debug
  debug: colors.bold.cyan,
  debug_text: colors.cyan,

  // log
  log: colors.bold.gray,
  log_text: colors.gray,

  // info
  info: colors.bold.blue,
  info_text: colors.blue,

  // warn
  warn: colors.bold.yellow,
  warn_text: colors.yellow,

  // error
  error: colors.bold.redBright,
  error_text: colors.redBright,

  // timers
  timer: colors.bold.yellowBright,
  timer_text: colors.yellowBright,

  // trace
  trace: colors.bold.gray,
  trace_text: colors.gray,

  // misc
  scope: colors.magenta,
  date: colors.bold.gray,
  object: colors.green,
  object_error: colors.red,
})

/**
 * This is the base logger we use to write to the node terminal.  Due to the ways that we import the node logger
 * we have to account for that (hence the ternary statement).
 */
export const nodeConsoleLogger = Console instanceof Function ? new Console(process.stdout, process.stderr) : console

// setup our custom string formatters
const formatters: { [char: string]: (value?: any) => string } = {}

// Add a formatter for converting to a base58 string
formatters.b = (v?: Uint8Array): string => {
  return v == null ? 'undefined' : base58btc.baseEncode(v)
}

// Add a formatter for converting to a base32 string
formatters.t = (v?: Uint8Array): string => {
  return v == null ? 'undefined' : base32.baseEncode(v)
}

// Add a formatter for converting to a base64 string
formatters.m = (v?: Uint8Array): string => {
  return v == null ? 'undefined' : base64.baseEncode(v)
}

// Add a formatter for stringifying peer ids
formatters.p = (v?: PeerId): string => {
  return v == null ? 'undefined' : v.toString()
}

// Add a formatter for stringifying CIDs
formatters.c = (v?: CID): string => {
  return v == null ? 'undefined' : v.toString()
}

// Add a formatter for stringifying Datastore keys
formatters.k = (v: Key): string => {
  return v == null ? 'undefined' : v.toString()
}

// Add a formatter for stringifying Multiaddrs
formatters.a = (v?: Multiaddr): string => {
  return v == null ? 'undefined' : v.toString()
}

formatters.d = (v?: number): string => {
  return v == null ? 'NaN' : v.toString()
}

formatters.s = (v?: string): string => {
  return v == null ? 'undefined' : v
}

formatters.o = (v?: any): string => {
  return v == null ? 'undefined' : JSON.stringify(v, null, 2)
}

// // Add a formatter for converting to a base58 string
// debug.formatters.b = (v?: Uint8Array): string => {
//   return v == null ? 'undefined' : base58btc.baseEncode(v)
// }

// // Add a formatter for converting to a base32 string
// debug.formatters.t = (v?: Uint8Array): string => {
//   return v == null ? 'undefined' : base32.baseEncode(v)
// }

// // Add a formatter for converting to a base64 string
// debug.formatters.m = (v?: Uint8Array): string => {
//   return v == null ? 'undefined' : base64.baseEncode(v)
// }

// // Add a formatter for stringifying peer ids
// debug.formatters.p = (v?: PeerId): string => {
//   return v == null ? 'undefined' : v.toString()
// }

// // Add a formatter for stringifying CIDs
// debug.formatters.c = (v?: CID): string => {
//   return v == null ? 'undefined' : v.toString()
// }

// // Add a formatter for stringifying Datastore keys
// debug.formatters.k = (v: Key): string => {
//   return v == null ? 'undefined' : v.toString()
// }

// // Add a formatter for stringifying Multiaddrs
// debug.formatters.a = (v?: Multiaddr): string => {
//   return v == null ? 'undefined' : v.toString()
// }

/**
 * This class is what we use to log to the node console and, optionally, the native console for browser-facing code
 * like the desktop renderer
 *
 * NOTE: This is exported because it needs to be exposed for the logger to work but you should use `createQuietLogger` in
 * (probably) all contexts
 */
export class QuietLogger {
  // This is based on the `debug` package and is backwards-compatible with the old logger's behavior (for the most part)
  private isDebug: boolean
  private isTrace: boolean
  private timers: Map<string, number> = new Map()
  private appendableData: any | undefined
  private fileStream: fs.WriteStream | undefined

  /**
   *
   * @param name This is the name that will be printed in the log entry
   * @param parallelConsoleLog If true we will also log to the native console (e.g. browser console)
   */
  constructor(
    public name: string,
    public writeToQueue: boolean = false,
    private filename: string | undefined = undefined
  ) {
    this.isDebug = debug.enabled(name)
    this.isTrace = debug.enabled(`${name}:trace`) && debug.names.map((r: any) => r.toString()).find((n: string) => n.includes(':trace')) != null
    if (this.filename != null) {
      this.fileStream = fs.createWriteStream(this.filename, { flags: 'a' });
    }
  }

  /*
  Log Level Methods
  */

  /**
   * Log a debug-level message if the DEBUG environment variable is set for this package/module
   *
   * @param message Message to log
   * @param optionalParams Optional parameters to log
   */
  debug(message: any, ...optionalParams: any[]) {
    if (!this.isDebug) return

    this.callLogMethods(LogLevel.DEBUG, message, ...optionalParams)
  }

  /**
   * Log an error-level message
   *
   * @param message Message to log
   * @param optionalParams Optional parameters to log
   */
  error(message: any, ...optionalParams: any[]) {
    this.callLogMethods(LogLevel.ERROR, message, ...optionalParams)
  }

  /**
   * Log an info-level message
   *
   * @param message Message to log
   * @param optionalParams Optional parameters to log
   */
  info(message: any, ...optionalParams: any[]) {
    if (!this.isDebug) return
    
    this.callLogMethods(LogLevel.INFO, message, ...optionalParams)
  }

  /**
   * Log a log-level message if the DEBUG environment variable is set for this package/module
   *
   * @param message Message to log
   * @param optionalParams Optional parameters to log
   */
  log(message: any, ...optionalParams: any[]) {
    if (!this.isDebug) return

    this.callLogMethods(LogLevel.LOG, message, ...optionalParams)
  }

  /**
   * Log a warn-level message
   *
   * @param message Message to log
   * @param optionalParams Optional parameters to log
   */
  warn(message: any, ...optionalParams: any[]) {
    this.callLogMethods(LogLevel.WARN, message, ...optionalParams)
  }

  /**
   * Log a trace-level message
   *
   * @param message Message to log
   * @param optionalParams Optional parameters to log
   */
  trace(message: any, ...optionalParams: any[]) {
    if (!this.isTrace) return

    this.callLogMethods(LogLevel.TRACE, message, ...optionalParams)
  }

  /**
   * Start a timer with a given name
   *
   * @param name Name of the timer
   */
  time(name: string) {
    if (this.timers.has(name)) {
      this.warn(`Timer with name ${name} already exists!`)
      return
    }

    const startMs = DateTime.utc().toMillis()
    this.timers.set(name, startMs)
  }

  /**
   * Calculate the runtime of the timer with a given name and log the formatted timing message
   *
   * @param name Name of the timer
   */
  timeEnd(name: string) {
    if (!this.timers.has(name)) {
      this.warn(`No timer started with name ${name}!`)
      return
    }

    const endMs = DateTime.utc().toMillis()
    const startMs = this.timers.get(name)!
    this.timers.delete(name)

    const formattedLogStrings = this.formatLog(LogLevel.TIMER, name, `${endMs - startMs}ms - timer ended`)
    this.printLog(LogLevel.LOG, ...formattedLogStrings)
  }

  setAppendData(data: any, overwrite: boolean = true) {
    if (!overwrite && this.appendableData != null) {
      this.appendableData = {
        ...this.appendableData,
        ...data
      }
    } else {
      this.appendableData = data
    }
  }

  extend(name: string) {
    this.name = `${this.name}:${name}`
  }

  get enabled(): boolean {
    return this.isDebug
  }

  // makeCallable(): () => CallableQuietLogger {
  //   const callable: Partial<CallableQuietLogger> = {
  //     LOGGER: this
  //   }

  //   callable.enabled = callable.LOGGER!.enabled
  //   callable.error = callable.LOGGER!.error
  //   callable.trace = callable.LOGGER!.trace
  //   const func = (message: any, ...optionalParams: any[]) => callable.LOGGER!.info(message, ...optionalParams)

  //   return func & this
  // }

  /**
   * Formats the message and writes it out to the node logger and, optionally, to the native console with
   * colorized text and parameters
   *
   * NOTE: The text and optional parameter are printed in different colors for clarity when reading a given log
   * line
   *
   * @param level The level we are logging at
   * @param message The main log message
   * @param optionalParams Other parameters we want to log
   */
  private callLogMethods(level: LogLevel, message: any, ...optionalParams: any[]): void {
    const formattedLogStrings = this.formatLog(level, message, ...optionalParams)
    this.printLog(level, ...formattedLogStrings)
  }

  /**
   * Print logs to node console and, optionally, the native console (e.g. browser)
   *
   * @param level The level we are logging at
   * @param formattedLogStrings Array of formatted log strings
   */
  public printLog(level: LogLevel, ...formattedLogStrings: string[]): void {
    if (!this.writeToQueue) {
      if (this.fileStream != null) {
        this.fileStream.write(formattedLogStrings.join(' ') + '\n');
      }

      if ([LogLevel.WARN, LogLevel.ERROR].includes(level) || formattedLogStrings[0].includes('qsb:')) {
        // @ts-ignore
        nodeConsoleLogger[level](...formattedLogStrings)
      }
      
      return
    }

    const queuable: LogMessage = {
      message: formattedLogStrings,
      level
    }
    LogQueue.instance.addToTaskQueue(queuable)
  }

  /**
   * Format the message and optional parameters according to the formatting rules for a given log level
   *
   * @param level The level we are logging at
   * @param message The main log message
   * @param optionalParams Other parameters we want to log
   * @returns Array of formatted log strings
   */
  private formatLog(level: LogLevel, message: any, ...optionalParams: any[]): string[] {
    const { formatted, params } = this.formatMessage(message, level, ...optionalParams)
    const formattedMessage = [formatted]
    const formattedAppendableData = this.formatAppendableData()
    if (formattedAppendableData != null) {
      formattedMessage.push(formattedAppendableData)
    }
    const formattedOptionalParams = params.map((param: any) => this.formatObject(param))
    return [...formattedMessage, ...formattedOptionalParams]
  }

  /**
   * Formats the primary log message and applies the level-specific coloring
   *
   * @param message Primary message to log
   * @param level The level we are logging at
   * @returns A colorized log string
   */
  private formatMessage(message: any, level: string, ...optionalParams: any[]): { formatted: string, params: any[] } {
    let formattedLevel = level.toUpperCase()
    let scope = this.name
    let date = DateTime.utc().toISO()
    const { formatted, params } = this.formatMessageText(message, level, ...optionalParams)

    if (COLORIZE) {
      //@ts-ignore
      formattedLevel = colors[level](formattedLevel)
      //@ts-ignore
      scope = colors['scope'](scope)
      //@ts-ignore
      date = colors['date'](date)
    }

    return {
      formatted: `${date} ${formattedLevel} ${scope} ${formatted}`,
      params
    }
  }

  private formatMessageText(message: any, level: string, ...optionalParams: any[]): { formatted: string, params: any[] } {
    if (['string', 'number', 'boolean', 'bigint'].includes(typeof message)) {
      let formatted = message
      let params: any[] = optionalParams
      if (typeof message === 'string') {
        const withFormatters = this.applyFormatters(formatted, ...optionalParams)
        formatted = withFormatters.formatted
        params = withFormatters.params
      }

      if (COLORIZE) {
        //@ts-ignore
        formatted = colors[`${level}_text`](message)
      }

      return {
        formatted,
        params
      }
    }

    return { 
      formatted: this.formatObject(message, level),
      params: optionalParams
    }
  }

  // stolen from the debug package and retooled
  private applyFormatters(message: string, ...optionalParams: any[]): { formatted: string, params: any[] } {
    let index = 0;
    const formatted = message.replace(/%([a-zA-Z%])/g, (match, format) => {
      // If we encounter an escaped % then don't increase the array index
      if (match === '%%') {
        return '%';
      }
      if (index > 0) index++;
      const formatter = formatters[format]
      if (typeof formatter === 'function') {
        const val = optionalParams[index];
        match = formatter(val)

        // Now we need to remove `args[index]` since it's inlined in the `format`
        optionalParams.splice(index, 1);
        if (index > 0) index--;
      }
      return match;
    });

    return {
      formatted,
      params: optionalParams
    }
  }

  /**
   * Colorizes an object parameter based on its type.
   *   - Errors are printed in red and we attempt to log the full stacktrace
   *   - Objects are stringified and logged
   *   - All other types are logged as-is
   *
   * @param param Object to format
   * @returns Colorized string
   */
  private formatObject(param: any, overrideColorKey: string | undefined = undefined): string {    
    if (param instanceof Error) {
      let formattedError = param.stack || `${param.name}: ${param.message}`
      if (COLORIZE) {
        //@ts-ignore
        formattedError = colors[overrideColorKey || 'object_error'](formattedError)
      }
      return formattedError
    }
    
    const colorize = (stringifiedParam: string): string => {
      //@ts-ignore
      return COLORIZE ? colors[overrideColorKey || 'object'](stringifiedParam) : stringifiedParam
    }

    let formatted: string
    if (['string', 'number', 'boolean', 'bigint'].includes(typeof param)) {
      formatted = param
    } else if (param == null) {
      formatted = "undefined"
    } else if (isPeerId(param)) {
      formatted = param.toString()
    } else if (param instanceof CID) {
      formatted = param.toString()
    } else if ((param as Key).baseNamespace != null) {
      formatted = param.toString()
    } else if (isMultiaddr(param)) {
      formatted = param.toString()
    } else {
      try {
        let truncatedOrNot: string
        if ((param as ArrayLike<any>).length != undefined) {
          truncatedOrNot = param
        } else {
          truncatedOrNot = this.truncateMessageForLogging(param)
        }
        formatted = JSON.stringify(truncatedOrNot, null, 2)
      } catch(e) {
        formatted = param.toString()
        if (formatted.startsWith('[object')) {
          formatted = param
        }
      }
    }

    return colorize(formatted)
  }

  private formatAppendableData(): string | undefined {
    if (this.appendableData != null) {
      return JSON.stringify(this.appendableData, null, 2)
    }

    return undefined
  }

  private truncateMessageForLogging(obj: any): string {
    return findAllByKeyAndReplace(JSON.parse(JSON.stringify(obj)), [
      {
        key: 'data',
        replace: {
          replacerFunc: (dataArray: any[]) => {
            if (dataArray.length != undefined) {
              return Buffer.from(dataArray).toString('base64')
            }
            return dataArray
          }
        }
      },
      {
        key: 'serializedGraph',
        replace: {
          replacerFunc: (graphObj: any) => createHash('md5').update(JSON.stringify(graphObj)).digest('hex')
        }
      },
      {
        key: 'encryptedBody',
        replace: {
          replacerFunc: (body: any) => {
            if (body["0"] != null) {
              return createHash('md5').update(JSON.stringify(body)).digest('hex')
            }
            return body
          }
        }
      },
      {
        key: 'encryptedPayload',
        replace: {
          replacerFunc: (body: any) => {
            if (body["0"] != null) {
              return createHash('md5').update(JSON.stringify(body)).digest('hex')
            }
            return body
          }
        }
      }
    ])
  }
}

/**
 * Generate a function that creates a module-level logger with a name like `packageName:moduleName`.  This is the main
 * entry point for logging in Quiet.
 *
 * @param packageName Name of the package we are logging in
 * @param writeToQueue If true we will write the message to queue for processing
 * @returns A function that can be used to generate a module-level logger
 */
export const createQuietLogger = (
  packageName: string,
  writeToQueue: boolean = true,
  filename: string | undefined = undefined
): ((moduleName?: string | undefined) => QuietLogger) => {
  return (moduleName?: string | undefined) => {
    let name: string
    if (moduleName == null) {
      name = packageName
    } else {
      name = `${packageName}:${moduleName}`
    }
    nodeConsoleLogger.info(`Initializing logger ${name}`)
    return new QuietLogger(name, writeToQueue, filename)
  }
}

export const createQsbLogger = createQuietLogger("qsb")
