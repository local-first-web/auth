export * from '/user/redact'
export * from '/user/types'

import * as keyset from '/keyset'
import { loadKeyset, storeKeyset } from '/storage'

const { MEMBER } = keyset.KeyType

export const user = (userName: string) => {
  const keys = loadKeyset(userName) || keyset.create({ type: MEMBER, name: userName })
  storeKeyset(userName, keys)
  return { userName, keys }
}
