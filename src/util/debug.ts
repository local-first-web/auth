import fs from 'fs'
import { EOL } from 'os'
import _debug from 'debug'

const isoDateRx = /((\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d))Z? /
const hashRx = /(?:[A-Za-z0-9+/=]{32,100})?/gm

const logFile = 'log.txt'

const process = (s: string) =>
  s
    .replace(isoDateRx, '') // eliminate dates
    .replace(hashRx, s => s.slice(0, 5)) // truncate hashes

    .replace(/taco:pause/, '⌚')
    .replace(/TEST:/, '🧪')
    .replace(/taco:test/, '🧪 ')
    .replace(/taco:connection:/, '')

    .replace(/alice/, '👩🏾')
    .replace(/bob/, '👨🏻‍🦲')
    .replace(/charlie/, '👳🏽‍♂️')
    .replace(/dwight/, '👴')

    .replace(/↩/g, EOL)
    .replace(/\\n/g, EOL)

const clear = () => fs.writeFileSync(logFile, '')
const append = (s: string) => fs.appendFileSync(logFile, process(s))

const debug = (prefix: string) => {
  const logger = _debug(prefix) as ExtendedDebug

  logger.clear = clear
  logger.header = s => append(`↩${s}↩↩`)
  logger.log = s => append(`  ${s}↩`)
  return logger
}

export default debug

type ExtendedDebug = ReturnType<typeof _debug> & {
  clear: () => void
  header: (s?: string) => void
}
