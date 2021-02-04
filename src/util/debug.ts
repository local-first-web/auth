import fs from 'fs'
import { EOL } from 'os'
import originalDebug from 'debug'

const isoDateRx = /((\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d))Z? /
const hashRx = /(?:[A-Za-z0-9+/=]{32,100})?/gm

const logFile = 'log.txt'

const substituteTokens = (s: string) =>
  s
    .replace(isoDateRx, '') // eliminate dates
    .replace(hashRx, (s) => s.slice(0, 5)) // truncate hashes

    .replace(/lf:auth:/g, '')

    .replace(/alice/g, '👩🏾')
    .replace(/bob/g, '👨🏻‍🦲')
    .replace(/charlie/g, '👳🏽‍♂️')
    .replace(/dwight/g, '👴')

    .replace(/:laptop/g, '')
    .replace(/:mobile/g, '📱')

    .replace(/↩/g, EOL)
    .replace(/\\n/g, EOL)

const clear = () => fs.writeFileSync(logFile, '')
const append = (s: string) => fs.appendFileSync(logFile, substituteTokens(s))

const debugWithFileOutput = (prefix: string) => {
  const logger = originalDebug(prefix) as ExtendedDebug
  logger.log = (s, o) => append(`  ${s} ↩`)
  return logger
}

type ExtendedDebug = ReturnType<typeof originalDebug> & {
  clear: () => void
  header: (s?: string) => void
}
const isTestEnvironment = process.env.NODE_ENV === 'test'
if (isTestEnvironment) clear()

export const debug = isTestEnvironment ? debugWithFileOutput : originalDebug
