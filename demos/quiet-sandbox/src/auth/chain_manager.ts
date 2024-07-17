/**
 * Manages the chain(s) and makes them accesible across the application
 */

import { SigChain } from "./chain.js";
import { DMService } from "./services/dm/dm_service.js";
import { InviteService } from "./services/invites/invite_service.js";
import { DeviceService } from "./services/members/device_service.js";
import { UserService } from "./services/members/user_service.js";
import { ChannelService } from "./services/roles/channel_service.js";
import { RoleService } from "./services/roles/role_service.js";

class SigChainManager {
  private chains: Map<string, SigChain> = new Map()
  private activeChainTeamName: string | undefined
  private static _instance: SigChainManager | undefined

  private constructor() {}

  public static init(): SigChainManager {
    if (SigChainManager._instance == null) {
      SigChainManager._instance = new SigChainManager()

      // TODO: Not sure if this actually makes sense to do here but it works in a pinch
      UserService.init()
      DeviceService.init()
      RoleService.init()
      ChannelService.init()
      DMService.init()
      InviteService.init()
    }

    return SigChainManager.instance
  }

  public getActiveChain(): SigChain {
    if (this.activeChainTeamName == null) {
      throw new Error(`No active chain found!`)
    }

    return this.getChainByTeamName(this.activeChainTeamName)
  }

  public setActiveChain(teamName: string): SigChain {
    if (!this.chains.has(teamName)) {
      throw new Error(`No chain found for team ${teamName}, can't set to active!`)
    }

    this.activeChainTeamName = teamName
    return this.getActiveChain()
  }

  public addChain(teamName: string, chain: SigChain, setActive: boolean): boolean {
    if (this.chains.has(teamName)) {
      throw new Error(`Chain for team ${teamName} already exists`)
    }

    this.chains.set(teamName, chain)
    if (this.activeChainTeamName == null || setActive) {
      this.activeChainTeamName = teamName
      return true
    }

    return false
  }

  public deleteChain(teamName: string): boolean {
    if (!this.chains.has(teamName)) {
      throw new Error(`No chain found for team ${teamName} to delete!`)
    }

    this.chains.delete(teamName)
    if (this.activeChainTeamName === teamName) {
      return true
    }

    return false
  }

  private getChainByTeamName(teamName: string): SigChain {
    if (!this.chains.has(teamName)) {
      throw new Error(`No chain found for team ${teamName}!`)
    }

    return this.chains.get(teamName)!
  }

  public static get instance(): SigChainManager {
    if (SigChainManager._instance == null) {
      throw new Error(`SigChainManager hasn't been initialized yet!  Run init() before accessing`)
    }

    return SigChainManager._instance
  }
}

export {
  SigChainManager
}