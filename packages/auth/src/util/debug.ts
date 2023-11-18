// ignore file coverage
import _debug from 'debug'
import { truncateHashes } from './truncateHashes.js'

const originalFormatArgs = _debug.formatArgs

_debug.formatArgs = function (args: any[]) {
  originalFormatArgs.call(this, args)
  args.forEach(arg => (arg = truncateHashes(arg)))
}

export const debug = _debug('lf:auth')
