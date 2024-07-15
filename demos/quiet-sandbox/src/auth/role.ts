/**
 * Handles role-related chain operations
 */

import { PermissionsMap, Role } from "@localfirst/auth";

class RoleUtils {
  private constructor() {}

  public static create(roleName: string, permissions?: PermissionsMap): Role {
    return {
      roleName,
      permissions
    }
  }
}

export {
  RoleUtils
}