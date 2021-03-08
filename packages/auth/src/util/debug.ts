import fs from 'fs'
import { EOL } from 'os'
import originalDebug from 'debug'
import { truncateHashes } from './truncateHashes'

export const debug = originalDebug

// const logFile = 'log.txt'

// const substituteTokens = (s: string) => {
//   s = eliminateDates(s)
//   s = truncateHashes(s)
//   return s
//     .replace(/lf:auth:/g, '')

//     .replace(/alice/g, '👩🏾')
//     .replace(/bob/g, '👨🏻‍🦲')
//     .replace(/charlie/g, '👳🏽‍♂️')
//     .replace(/dwight/g, '👴')

//     .replace(/laptop/g, '💻')
//     .replace(/phone/g, '📱')

//     .replace(/"/g, '')

//     .replace(/↩/g, EOL)
//     .replace(/\\n/g, EOL)
// }

// const clear = () => fs.writeFileSync(logFile, '')
// const append = (s: string) => fs.appendFileSync(logFile, substituteTokens(s))

// const debugWithFileOutput = (prefix: string) => {
//   const logger = originalDebug(prefix) as ExtendedDebug
//   logger.log = (s, o) => append(`  ${s} ↩`)
//   return logger
// }

// type ExtendedDebug = ReturnType<typeof originalDebug> & {
//   clear: () => void
//   header: (s?: string) => void
// }
// const isTestEnvironment = process.env.NODE_ENV === 'test'
// if (isTestEnvironment) clear()

// export const debug = isTestEnvironment ? debugWithFileOutput : originalDebug

// const eliminateDates = (s: string) => {
//   const isoDateRx = /((\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d))Z? /
//   return s.replace(isoDateRx, '')
// }
