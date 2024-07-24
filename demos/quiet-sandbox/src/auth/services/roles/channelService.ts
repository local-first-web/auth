/**
 * Handles channel-related chain operations
 */

import { LocalUserContext } from "@localfirst/auth"
import { SigChain } from "../../chain.js"
import { BaseChainService } from "../baseService.js"

class ChannelService extends BaseChainService {
  public static init(sigChain: SigChain): ChannelService {
    return new ChannelService(sigChain)
  }

  // TODO: figure out permissions
  public createPrivateChannel(channelName: string, context: LocalUserContext) {
    console.log(`Creating private channel role with name ${channelName}`)
    this.sigChain.roles.create(ChannelService.getPrivateChannelRoleName(channelName))
    this.addMemberToPrivateChannel(context.user.userId, channelName)
    // this.activeSigChain.persist()
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

  public static getPrivateChannelRoleName(channelName: string): string {
    return `priv_chan_${channelName}`
  }
}

export {
  ChannelService
}