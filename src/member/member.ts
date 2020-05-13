import { PublicKeyset } from '../keys'

export interface Member {
  userName: string
  keys: PublicKeyset
  roles: string[]
}
