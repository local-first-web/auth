import { loadKeyset } from '/storage'
import { UserWithSecrets } from './types'

export const load = (userName: string): UserWithSecrets => {
  const keys = loadKeyset(userName)
  if (keys === undefined)
    throw new Error(`Keys were not found for user '${userName}'`)
  return { userName, keys }
}
