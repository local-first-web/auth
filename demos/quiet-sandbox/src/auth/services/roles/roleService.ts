/**
 * Handles role-related chain operations
 */

import { BaseChainService } from "../baseService.js"
import { Permissions } from "./permissions.js"
import { RoleName } from "./roles.js"
import { PermissionsMap, Role } from "@localfirst/auth"

class RoleService extends BaseChainService {
  protected static _instance: RoleService | undefined

  public static init(): RoleService {
    if (RoleService._instance == null) {
      RoleService._instance = new RoleService() 
    }

    return RoleService.instance
  }

  // TODO: figure out permissions
  public create(roleName: RoleName | string, permissions: PermissionsMap = {}, staticMembership: boolean = false) {
    console.log(`Adding new role with name ${roleName}`)
    if (!staticMembership) {
      permissions[Permissions.MODIFIABLE_MEMBERSHIP] = true
    }

    const role: Role = {
      roleName,
      permissions
    }

    this.activeSigChain.team.addRole(role)
    // this.activeSigChain.persist()
  }

  // TODO: figure out permissions
  public createWithMembers(
    roleName: RoleName | string, 
    memberIdsForRole: string[], 
    permissions: PermissionsMap = {}, 
    staticMembership: boolean = false
  ) {
    this.create(roleName, permissions, staticMembership)
    for (const memberId of memberIdsForRole) {
      this.addMember(memberId, roleName)
    }
    // this.activeSigChain.persist()
  }

  public addMember(memberId: string, roleName: string) {
    console.log(`Adding member with ID ${memberId} to role ${roleName}`)
    this.activeSigChain.team.addMemberRole(memberId, roleName)
    // this.activeSigChain.persist()
  }

  public revokeMembership(memberId: string, roleName: string) {
    console.log(`Revoking role ${roleName} for member with ID ${memberId}`)
    this.activeSigChain.team.removeMemberRole(memberId, roleName)
    // this.activeSigChain.persist()
  }

  public delete(roleName: string) {
    console.log(`Removing role with name ${roleName}`)
    this.activeSigChain.team.removeRole(roleName)
    // this.activeSigChain.persist()
  }

  public static get instance(): RoleService {
    if (RoleService._instance == null) {
      throw new Error(`RoleService hasn't been initialized yet!  Run init() before accessing`)
    }

    return RoleService._instance
  }
}

export {
  RoleService
}