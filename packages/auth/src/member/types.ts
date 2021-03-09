import { PublicKeyset } from '@/keyset'
import { PublicDevice } from '@/device'

export interface Member {
  userName: string
  keys: PublicKeyset
  roles: string[]
  devices?: PublicDevice[]
  keyHistory?: PublicKeyset[]
}
