import { loadKeyset } from '/storage'
import { LocalUser } from '/user/types'

export const load = (userName: string): LocalUser => {
  const keys = loadKeyset(userName)
  if (keys === undefined) throw new Error(`Keys were not found for user '${userName}'`)
  return { userName, keys }
}
