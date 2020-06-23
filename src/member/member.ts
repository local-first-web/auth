import { PublicKeyset } from '/keyset'
import { Device } from '/device'

export interface Member {
  userName: string
  keys: PublicKeyset
  roles?: string[]
  devices?: Device[]
  keyHistory?: PublicKeyset[]
}
