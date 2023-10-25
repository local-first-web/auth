export type PermissionsMap = Record<string, boolean>

export type Role = {
  roleName: string
  permissions?: PermissionsMap
}
