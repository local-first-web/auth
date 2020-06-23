import { PublicKeyset } from '/keyset'

export interface Member {
  userName: string
  keys: PublicKeyset
  roles?: string[]
  devices?: string[]
  keyHistory?: PublicKeyset[]
}
