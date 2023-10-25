// ignore file coverage

import originalDebug from "debug"
import { truncateHashes } from "./truncateHashes.js"

const substituteTokens = (s: string) => {
  return truncateHashes(s).replaceAll('"', "").replace("::", "")

  // .replace(/alice/gi, '👩🏾')
  // .replace(/bob/gi, '👨🏻‍🦲')
  // .replace(/charlie/gi, '👳🏽‍♂️')
  // .replace(/dwight/gi, '👴')
  // .replace(/eve/gi, '🦹‍♀️')

  // .replace(/laptop/gi, '💻')
  // .replace(/phone/gi, '📱')
}

export function debug(prefix: string) {
  const debug = originalDebug(prefix)
  debug.log = (s: string, ...args: string[]) =>
    originalDebug("crdx")(
      substituteTokens(s),
      ...args.map(s => truncateHashes(s))
    )
  return debug
}
