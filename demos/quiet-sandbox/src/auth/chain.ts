/**
 * Handles generating the chain and aggregating all chain operations
 */

import * as auth from '@localfirst/auth'
import { LoadedSigChain } from './types.js'
import { UserUtils } from './user.js'
import { RoleUtils } from './role.js'
import { ChannelUtils } from './channel.js'
import { DMUtils } from './dm.js'
import { Permissions } from './permissions.js'

class SigChain {
  private team: auth.Team

  private constructor(team: auth.Team) {
    this.team = team
  }

  /**
   * Create a brand new SigChain with a given name and also generate the initial user with a given name
   * 
   * @param teamName Name of the team we are creating
   * @param username Username of the initial user we are generating
   */
  public static create(teamName: string, username: string): LoadedSigChain {
    const context = UserUtils.create(username)
    const team: auth.Team = auth.createTeam(teamName, context)
    const sigChain = new SigChain(team)
    sigChain.persist()

    return {
      sigChain,
      context
    }
  }

  // TODO: persist to storage
  private persist() {
    this.team.save()
  }

  // TODO: pull user context from storage and then pull team from storage
  // private load(): LoadedSigChain {
  //   
  // }

  // TODO: figure out permissions
  public createRole(roleName: string, permissions: auth.PermissionsMap = {}, staticMembership: boolean = false) {
    console.log(`Adding new role with name ${roleName}`)
    if (!staticMembership) {
      permissions[Permissions.MODIFIABLE_MEMBERSHIP] = true
    }

    const role = RoleUtils.create(roleName, permissions)
    this.team.addRole(role)
    this.persist()
  }

  // TODO: figure out permissions
  public createRoleWithMembers(
    roleName: string, 
    memberIdsForRole: string[], 
    permissions: auth.PermissionsMap = {}, 
    staticMembership: boolean = false
  ) {
    this.createRole(roleName, permissions, staticMembership)
    for (const memberId of memberIdsForRole) {
      this.addMemberToRole(memberId, roleName)
    }
    this.persist()
  }

  public addMemberToRole(memberId: string, roleName: string) {
    console.log(`Adding member with ID ${memberId} to role ${roleName}`)
    this.team.addMemberRole(memberId, roleName)
    this.persist()
  }

  public revokeRole(memberId: string, roleName: string) {
    console.log(`Revoking role ${roleName} for member with ID ${memberId}`)
    this.team.removeMemberRole(memberId, roleName)
    this.persist()
  }

  public deleteRole(roleName: string) {
    console.log(`Removing role with name ${roleName}`)
    this.team.removeRole(roleName)
    this.persist()
  }

  // TODO: figure out permissions
  public createPrivateChannel(channelName: string) {
    console.log(`Creating private channel role with name ${channelName}`)
    this.createRole(ChannelUtils.getPrivateChannelRoleName(channelName))
    this.persist()
  }

  public addMemberToPrivateChannel(memberId: string, channelName: string) {
    console.log(`Adding member with ID ${memberId} to private channel role with name ${channelName}`)
    this.addMemberToRole(memberId, ChannelUtils.getPrivateChannelRoleName(channelName))
    this.persist()
  }

  public revokePrivateChannelMembership(memberId: string, channelName: string) {
    console.log(`Removing member with ID ${memberId} from private channel with name ${channelName}`)
    this.revokeRole(memberId, ChannelUtils.getPrivateChannelRoleName(channelName))
    this.persist()
  }

  public deletePrivateChannel(channelName: string) {
    console.log(`Deleting private channel with name ${channelName}`)
    this.deleteRole(ChannelUtils.getPrivateChannelRoleName(channelName))
    this.persist()
  }

  // TODO: figure out permissions
  public createDm(memberIds: string[]): string  {
    const {
      dmId,
      roleName
    } = DMUtils.getDmRoleName(memberIds)
    this.createRoleWithMembers(roleName, memberIds, {}, true)
    this.persist()

    return dmId
  }

  public deleteDm(dmId: string) {
    this.deleteRole(DMUtils.getDmRoleNameFromId(dmId))
    this.persist()
  }

  public getTeam(): auth.Team {
    return this.team
  }

  public getMembers(): auth.Member[] {
    return this.team.members()
  }

  public getTeamGraph(): auth.TeamGraph {
    return this.team.graph
  }
}

export {
  SigChain
}