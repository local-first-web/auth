import { PublicKeyset } from 'keys'

export interface Member {
  name: string
  keys: PublicKeyset
  roles: string[]
}
