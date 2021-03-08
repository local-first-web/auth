import fs from 'fs'
import path from 'path'

const profiler = require('v8-profiler-node8')

/**
 * To use:
 *
 * ```ts
 * const my_slow_function = () => {...}
 * await profile(my_slow_function)
 * ```
 *
 * Each time this is run, it will rewrite a file at `./profiles/my_slow_function.cpuprofile`.
 *
 * To analyze this file:
 *
 * - open Chrome
 * - visit `chrome://inspect`
 * - click 'Open dedicated DevTools for Node'
 * - switch to the 'Profiler' tab
 * - press 'Load' and find `./profiles/my_slow__function.cpuprofile`
 */
export const profile = async (fn: Function) => {
  profiler.startProfiling()
  await fn()
  const profile = profiler.stopProfiling()
  profile.export((err: any, result: any) => {
    const name = fn.name || 'anonymous'
    fs.writeFileSync(path.join(__dirname, '../..', `.profiles/${name}.cpuprofile`), result)
    profile.delete()
  })
}
