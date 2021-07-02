import originalDebug from 'debug'
import { truncateHashes } from './truncateHashes'

const substituteTokens = (s: string) => {
  return truncateHashes(s)
    .replace(/"/g, '')
    .replace('::', '')

    .replace(/alice/gi, '👩🏾')
    .replace(/bob/gi, '👨🏻‍🦲')
    .replace(/charlie/gi, '👳🏽‍♂️')
    .replace(/dwight/gi, '👴')
    .replace(/eve/gi, '🦹‍♀️')

    .replace(/laptop/gi, '💻')
    .replace(/phone/gi, '📱')
}

export function debug(prefix: string) {
  const debug = originalDebug(prefix)
  debug.log = (s: string, ...args: any[]) =>
    console.log(substituteTokens(s), ...args.map(truncateHashes))
  return debug
}
