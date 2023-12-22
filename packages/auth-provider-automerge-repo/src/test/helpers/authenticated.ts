import { type Repo } from '@automerge/automerge-repo'
import { eventPromise, pause } from '@localfirst/auth-shared'
import { type UserStuff } from './setup.js'

export const authenticatedInTime = async (a: UserStuff, b: UserStuff, timeout = 500) => {
  const authWorked = authenticated(a.repo, b.repo).then(() => true)
  const authTimedOut = pause(timeout).then(() => false)

  return Promise.race([authWorked, authTimedOut])
}

export const authenticated = async (a: Repo, b: Repo) => {
  return Promise.all([
    eventPromise(a.networkSubsystem, 'peer'),
    eventPromise(b.networkSubsystem, 'peer'),
  ])
}
