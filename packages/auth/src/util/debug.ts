import originalDebug from 'debug'
import { truncateHashes } from './truncateHashes'

const eliminateDates = (s: string) => {
  const isoDateRx = /((\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d))Z? /
  return s.replace(isoDateRx, '')
}

const substituteTokens = (s: string) => {
  s = eliminateDates(s)
  s = truncateHashes(s)
  return (
    s
      .replace(/lf:auth:/g, '')

      // .replace(/alice/g, '👩🏾')
      // .replace(/bob/g, '👨🏻‍🦲')
      // .replace(/charlie/g, '👳🏽‍♂️')
      // .replace(/dwight/g, '👴')

      // .replace(/laptop/g, '💻')
      // .replace(/phone/g, '📱')

      .replace(/"/g, '')

  )
}

const modifiedDebug = (prefix: string) => {
  const debug = originalDebug(prefix)
  debug.log = (s: string, o: any) => {
    originalDebug('lf:auth')(substituteTokens(s), o)
  }
  return debug
}

export const debug = modifiedDebug
