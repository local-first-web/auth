import { loadKeyset } from '../secureStorage'
import { UserWithSecrets } from './types'

export const load = (name: string): UserWithSecrets => {
  const keys = loadKeyset(name)
  if (keys === undefined)
    throw new Error(`Keys were not found for user '${name}'`)
  return { name, keys }
}
