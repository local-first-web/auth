import { Repo } from '@automerge/automerge-repo'
import { pause, eventPromise } from '@localfirst/auth-shared'
import { UserStuff } from './setup.js'

export const authenticatedInTime = async (a: UserStuff, b: UserStuff, timeout = 1000) => {
  const authWorked = authenticated(a.repo, b.repo).then(() => true)
  const authTimedOut = pause(timeout).then(() => false)

  return Promise.race([authWorked, authTimedOut])
}

export const authenticated = (a: Repo, b: Repo) => {
  return Promise.all([
    eventPromise(a.networkSubsystem, 'peer'),
    eventPromise(b.networkSubsystem, 'peer'),
  ])
}
