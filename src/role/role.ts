import { PermissionsMap } from './types'

export class Role {
  public name: string

  public permissions: PermissionsMap

  public hasPermission() {}
}
