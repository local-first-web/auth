// ignore file coverage
import _debug from 'debug'
import { truncateHashes } from './truncateHashes.js'

const originalFormatArgs = _debug.formatArgs

_debug.formatArgs = function (args: any[]) {
  for (let i = 0; i < args.length; i++) {
    args[i] = truncateHashes(args[i])
  }
  originalFormatArgs.call(this, args)
}

export const debug = _debug('localfirst')

export type RegexReplacer = (substring: string, ...args: any[]) => string
