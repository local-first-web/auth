import fs from 'fs'
import { EOL } from 'os'
import _debug from 'debug'
import { stringify } from 'querystring'

const isoDateRx = /((\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d))Z? /
const hashRx = /(?:[A-Za-z0-9+/=]{32,100})?/gm

const logFile = 'log.txt'

const process = (s: string) => {
  // trim each line
  s = s
    .split(/\n/)
    .map(s => s.trim())
    .join(EOL)

  // indent everything but headers
  s = `  ${s}↩`

  // replace stuff
  s = s
    .replace(isoDateRx, '')
    .replace(hashRx, s => s.slice(0, 5))
    .replace(/taco:connection:alice/, '👩🏾')
    .replace(/taco:connection:bob/, '👨🏻‍🦲')
    .replace(/taco:connection:charlie/, '👳🏽‍♂️')
    .replace(/taco:connection:dwight/, '👴')
    .replace(/taco:pause/, '⌚')
    .replace(/taco/, '')
    .replace(/↩/g, EOL)
    .replace(/\\n/g, EOL)
  return s
}

const debug = (s: string) => {
  const logger = _debug(s) as ExtendedDebug
  logger.log = s => fs.appendFileSync(logFile, process(s))
  logger.clear = (s = '') => fs.writeFileSync(logFile, s)
  logger.header = (s = '---') => fs.appendFileSync(logFile, `${EOL}${s}${EOL}${EOL}`)
  return logger
}

export default debug

type ExtendedDebug = ReturnType<typeof _debug> & {
  clear: (s?: string) => void
  header: (s?: string) => void
}
