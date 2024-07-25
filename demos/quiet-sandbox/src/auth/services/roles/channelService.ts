/**
 * Handles channel-related chain operations
 */

import { LocalUserContext, role, Role } from "@localfirst/auth"
import { SigChain } from "../../chain.js"
import { BaseChainService } from "../baseService.js"
import { Channel } from "./roles.js"

const CHANNEL_ROLE_KEY_PREFIX = "priv_chan_"

class ChannelService extends BaseChainService {
  public static init(sigChain: SigChain): ChannelService {
    return new ChannelService(sigChain)
  }

  // TODO: figure out permissions
  public createPrivateChannel(channelName: string, context: LocalUserContext): Channel {
    console.log(`Creating private channel role with name ${channelName}`)
    this.sigChain.roles.create(ChannelService.getPrivateChannelRoleName(channelName))
    this.addMemberToPrivateChannel(context.user.userId, channelName)
    // this.activeSigChain.persist()

    return this.getChannel(channelName, context)
  }

  public addMemberToPrivateChannel(memberId: string, channelName: string) {
    console.log(`Adding member with ID ${memberId} to private channel role with name ${channelName}`)
    this.sigChain.roles.addMember(memberId, ChannelService.getPrivateChannelRoleName(channelName))
    // this.activeSigChain.persist()
  }

  public revokePrivateChannelMembership(memberId: string, channelName: string) {
    console.log(`Removing member with ID ${memberId} from private channel with name ${channelName}`)
    this.sigChain.roles.revokeMembership(memberId, ChannelService.getPrivateChannelRoleName(channelName))
    // this.activeSigChain.persist()
  }

  public deletePrivateChannel(channelName: string) {
    console.log(`Deleting private channel with name ${channelName}`)
    this.sigChain.roles.delete(ChannelService.getPrivateChannelRoleName(channelName))
    // this.activeSigChain.persist()
  }

  public leaveChannel(channelName: string, context: LocalUserContext) {
    console.log(`Leaving private channel with name ${channelName}`)
    this.revokePrivateChannelMembership(context.user.userId, channelName)
  }

  public getChannel(channelName: string, context: LocalUserContext): Channel {
    const role = this.sigChain.roles.getRole(ChannelService.getPrivateChannelRoleName(channelName))
    return this.roleToChannel(role, channelName, context)
  }

  public getChannels(context: LocalUserContext, haveAccessOnly: boolean = false): Channel[] {
    const allRoles = this.sigChain.roles.getAllRoles()
    const allChannels = allRoles.filter((role: Role) => role.roleName.startsWith(CHANNEL_ROLE_KEY_PREFIX)).map((role: Role) => (
      this.roleToChannel(role, ChannelService.getPrivateChannelNameFromRoleName(role.roleName), context)
    ));

    if (haveAccessOnly) {
      return allChannels.filter((channel: Channel) => channel.hasRole === true)
    }

    return allChannels
  }

  public memberInChannel(memberId: string, channelName: string): boolean {
    const roleName = ChannelService.getPrivateChannelRoleName(channelName)
    return this.sigChain.roles.memberHasRole(memberId, roleName)
  }

  public amIInChannel(context: LocalUserContext, channelName: string): boolean {
    return this.memberInChannel(context.user.userId, channelName)
  }

  private roleToChannel(role: Role, channelName: string, context: LocalUserContext): Channel {
    const members = this.sigChain.roles.getMembersForRole(role.roleName)
    const hasRole = this.sigChain.roles.amIMemberOfRole(context, role.roleName)
    return {
      ...role,
      members,
      hasRole,
      channelName
    } as Channel
  }

  public static getPrivateChannelRoleName(channelName: string): string {
    return `${CHANNEL_ROLE_KEY_PREFIX}${channelName}`
  }

  public static getPrivateChannelNameFromRoleName(roleName: string): string {
    return roleName.split(CHANNEL_ROLE_KEY_PREFIX)[1]
  }
}

export {
  ChannelService
}