import { eventPromise, pause } from '@localfirst/auth-shared'
import { type UserStuff } from './setup.js'

export const authenticatedInTime = async (a: UserStuff, b: UserStuff, timeout = 500) => {
  const authWorked = authenticated(a, b).then(() => true)
  const authTimedOut = pause(timeout).then(() => false)

  return Promise.race([authWorked, authTimedOut])
}

export const authenticated = async (a: UserStuff, b: UserStuff) => {
  return Promise.all([
    eventPromise(a.repo.networkSubsystem, 'peer'),
    eventPromise(b.repo.networkSubsystem, 'peer'),
  ])
}
