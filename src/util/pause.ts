import debug from '/util/debug'

const log = debug('taco:pause')
export const pause = (t = 100) => {
  log(t)
  return new Promise(resolve => setTimeout(() => resolve(), t))
}
