import { PermissionsMap } from './types'

export interface Role {
  roleName: string
  permissions?: PermissionsMap
}
