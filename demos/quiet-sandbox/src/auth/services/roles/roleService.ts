/**
 * Handles role-related chain operations
 */

import { SigChain } from "../../chain.js"
import { BaseChainService } from "../baseService.js"
import { Permissions } from "./permissions.js"
import { RoleName } from "./roles.js"
import { PermissionsMap, Role } from "@localfirst/auth"

class RoleService extends BaseChainService {
  public static init(sigChain: SigChain): RoleService {
    return new RoleService(sigChain)
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

    this.sigChain.team.addRole(role)
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
    this.sigChain.team.addMemberRole(memberId, roleName)
    // this.activeSigChain.persist()
  }

  public revokeMembership(memberId: string, roleName: string) {
    console.log(`Revoking role ${roleName} for member with ID ${memberId}`)
    this.sigChain.team.removeMemberRole(memberId, roleName)
    // this.activeSigChain.persist()
  }

  public delete(roleName: string) {
    console.log(`Removing role with name ${roleName}`)
    this.sigChain.team.removeRole(roleName)
    // this.activeSigChain.persist()
  }

  public getAllRoles(): Role[] {
    return this.sigChain.team.roles()
  }
}

export {
  RoleService
}