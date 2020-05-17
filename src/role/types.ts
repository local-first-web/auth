export type PermissionsMap = {
  [key: string]: boolean
}

export interface Role {
  roleName: string
  permissions?: PermissionsMap
}
