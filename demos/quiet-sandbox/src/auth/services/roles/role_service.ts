/**
 * Handles role-related chain operations
 */

import * as auth from "@localfirst/auth"
import { BaseChainService } from "auth/services/base_service.js"
import { Permissions } from "auth/services/roles/permissions.js"

class RoleService extends BaseChainService {
  protected static instance: RoleService | undefined

  public static init(): RoleService {
    if (RoleService.instance == null) {
      RoleService.instance = new RoleService() 
    }

    return RoleService.instance
  }

  public static getInstance(): RoleService {
    if (RoleService.instance == null) {
      throw new Error(`RoleService hasn't been initialized yet!  Run init() before accessing`)
    }

    return RoleService.instance
  }

  // TODO: figure out permissions
  public create(roleName: string, permissions: auth.PermissionsMap = {}, staticMembership: boolean = false) {
    console.log(`Adding new role with name ${roleName}`)
    if (!staticMembership) {
      permissions[Permissions.MODIFIABLE_MEMBERSHIP] = true
    }

    const role: auth.Role = {
      roleName,
      permissions
    }

    this.getChain().getTeam().addRole(role)
    this.getChain().persist()
  }

  // TODO: figure out permissions
  public createWithMembers(
    roleName: string, 
    memberIdsForRole: string[], 
    permissions: auth.PermissionsMap = {}, 
    staticMembership: boolean = false
  ) {
    this.create(roleName, permissions, staticMembership)
    for (const memberId of memberIdsForRole) {
      this.addMember(memberId, roleName)
    }
    this.getChain().persist()
  }

  public addMember(memberId: string, roleName: string) {
    console.log(`Adding member with ID ${memberId} to role ${roleName}`)
    this.getChain().getTeam().addMemberRole(memberId, roleName)
    this.getChain().persist()
  }

  public revokeMembership(memberId: string, roleName: string) {
    console.log(`Revoking role ${roleName} for member with ID ${memberId}`)
    this.getChain().getTeam().removeMemberRole(memberId, roleName)
    this.getChain().persist()
  }

  public delete(roleName: string) {
    console.log(`Removing role with name ${roleName}`)
    this.getChain().getTeam().removeRole(roleName)
    this.getChain().persist()
  }
}

export {
  RoleService
}