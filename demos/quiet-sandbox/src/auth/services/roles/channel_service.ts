/**
 * Handles channel-related chain operations
 */

import { BaseChainService } from "auth/services/base_service.js"
import { RoleService } from "./role_service.js"

class ChannelService extends BaseChainService {
  protected static instance: ChannelService | undefined

  public static init(): ChannelService {
    if (ChannelService.instance == null) {
      ChannelService.instance = new ChannelService() 
    }

    return ChannelService.instance
  }

  public static getInstance(): ChannelService {
    if (ChannelService.instance == null) {
      throw new Error(`ChannelService hasn't been initialized yet!  Run init() before accessing`)
    }

    return ChannelService.instance
  }

  // TODO: figure out permissions
  public createPrivateChannel(channelName: string) {
    console.log(`Creating private channel role with name ${channelName}`)
    RoleService.getInstance().create(ChannelService.getPrivateChannelRoleName(channelName))
    this.getChain().persist()
  }

  public addMemberToPrivateChannel(memberId: string, channelName: string) {
    console.log(`Adding member with ID ${memberId} to private channel role with name ${channelName}`)
    RoleService.getInstance().addMember(memberId, ChannelService.getPrivateChannelRoleName(channelName))
    this.getChain().persist()
  }

  public revokePrivateChannelMembership(memberId: string, channelName: string) {
    console.log(`Removing member with ID ${memberId} from private channel with name ${channelName}`)
    RoleService.getInstance().revokeMembership(memberId, ChannelService.getPrivateChannelRoleName(channelName))
    this.getChain().persist()
  }

  public deletePrivateChannel(channelName: string) {
    console.log(`Deleting private channel with name ${channelName}`)
    RoleService.getInstance().delete(ChannelService.getPrivateChannelRoleName(channelName))
    this.getChain().persist()
  }

  private static getPrivateChannelRoleName(channelName: string): string {
    return `priv_chan_${channelName}`
  }
}

export {
  ChannelService
}