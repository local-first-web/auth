import { PublicKeys } from '/keys'

export interface Member {
  userName: string
  keys: PublicKeys
  roles: string[]
}
