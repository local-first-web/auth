// ignore file coverage
import originalDebug from 'debug'
import { truncateHashes } from './truncateHashes.js'

const substituteTokens = (s: string) =>
  truncateHashes(s)
    .replaceAll('"', '')

    .replaceAll(/alice/gi, '👩🏾')
    .replaceAll(/bob/gi, '👨🏻‍🦲')
    .replaceAll(/charlie/gi, '👳🏽‍♂️')
    .replaceAll(/dwight/gi, '👴')
    // .replace(/eve/gi, '🦹‍♀️')

    .replaceAll(/laptop/gi, '💻')
    .replaceAll(/phone/gi, '📱')
    .replaceAll(/devresults.com/gi, '🌍')

export function debug(prefix: string) {
  const debug = originalDebug(prefix)
  debug.log = (s: string) => {
    originalDebug('lf:auth')(substituteTokens(s))
  }

  return debug
}
