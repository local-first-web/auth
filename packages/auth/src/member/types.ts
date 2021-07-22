import { Keyset } from 'crdx'
import { PublicDevice } from '@/device'

export interface Member {
  userName: string
  keys: Keyset
  roles: string[]
  devices?: PublicDevice[]
  keyHistory?: Keyset[]
}
