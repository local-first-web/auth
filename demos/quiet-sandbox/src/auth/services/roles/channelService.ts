/**
 * Handles channel-related chain operations
 */

import { SigChain } from "../../chain.js"
import { BaseChainService } from "../baseService.js"

class ChannelService extends BaseChainService {
  protected static _instance: ChannelService | undefined

  public static init(): ChannelService {
    if (ChannelService._instance == null) {
      ChannelService._instance = new ChannelService() 
    }

    return ChannelService.instance
  }

  // TODO: figure out permissions
  public createPrivateChannel(channelName: string) {
    console.log(`Creating private channel role with name ${channelName}`)
    SigChain.roles.create(ChannelService.getPrivateChannelRoleName(channelName))
    // this.activeSigChain.persist()
  }

  public addMemberToPrivateChannel(memberId: string, channelName: string) {
    console.log(`Adding member with ID ${memberId} to private channel role with name ${channelName}`)
    SigChain.roles.addMember(memberId, ChannelService.getPrivateChannelRoleName(channelName))
    // this.activeSigChain.persist()
  }

  public revokePrivateChannelMembership(memberId: string, channelName: string) {
    console.log(`Removing member with ID ${memberId} from private channel with name ${channelName}`)
    SigChain.roles.revokeMembership(memberId, ChannelService.getPrivateChannelRoleName(channelName))
    // this.activeSigChain.persist()
  }

  public deletePrivateChannel(channelName: string) {
    console.log(`Deleting private channel with name ${channelName}`)
    SigChain.roles.delete(ChannelService.getPrivateChannelRoleName(channelName))
    // this.activeSigChain.persist()
  }

  public static getPrivateChannelRoleName(channelName: string): string {
    return `priv_chan_${channelName}`
  }

  public static get instance(): ChannelService {
    if (ChannelService._instance == null) {
      throw new Error(`ChannelService hasn't been initialized yet!  Run init() before accessing`)
    }

    return ChannelService._instance
  }
}

export {
  ChannelService
}