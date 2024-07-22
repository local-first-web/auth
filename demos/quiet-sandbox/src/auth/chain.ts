/**
 * Handles generating the chain and aggregating all chain operations
 */

import * as auth from '@localfirst/auth'
import { LoadedSigChain } from './types.js'
import { UserService } from './services/members/userService.js'
import { RoleService } from './services/roles/roleService.js'
import { ChannelService } from './services/roles/channelService.js'
import { DeviceService } from './services/members/deviceService.js'
import { InviteService } from './services/invites/inviteService.js'
import { DMService } from './services/dm/dmService.js'
import { CryptoService } from './services/crypto/cryptoService.js'

class SigChain {
  private _team: auth.Team

  private constructor(team: auth.Team) {
    this._team = team
  }

  /**
   * Create a brand new SigChain with a given name and also generate the initial user with a given name
   * 
   * @param teamName Name of the team we are creating
   * @param username Username of the initial user we are generating
   */
  public static create(teamName: string, username: string): LoadedSigChain {
    const context = UserService.instance.create(username)
    const team: auth.Team = SigChain.lfa.createTeam(teamName, context)
    const sigChain = new SigChain(team)
    // sigChain.persist()

    return {
      sigChain,
      context
    }
  }

  // TODO: Is this the right signature for this method?
  public static join(context: auth.LocalUserContext, serializedTeam: Uint8Array, teamKeyRing: auth.Keyring): LoadedSigChain {
    const team: auth.Team = auth.loadTeam(serializedTeam, context, teamKeyRing)
    team.join(teamKeyRing)

    const sigChain = new SigChain(team)
    // sigChain.persist()

    return {
      sigChain,
      context
    }
  }

  // TODO: persist to storage
  public persist(): Uint8Array {
    return this.team.save() // this doesn't actually do anything but create the new state to save
  }

  // TODO: pull user context from storage and then pull team from storage
  // private load(): LoadedSigChain {
  //   
  // }

  get team(): auth.Team {
    return this._team
  }

  get teamGraph(): auth.TeamGraph {
    return this._team.graph
  }

  static get users(): UserService {
    return UserService.instance
  }

  static get roles(): RoleService {
    return RoleService.instance
  }

  static get channels(): ChannelService {
    return ChannelService.instance
  }

  static get devices(): DeviceService {
    return DeviceService.instance
  }

  static get invites(): InviteService {
    return InviteService.instance
  }

  static get dms(): DMService {
    return DMService.instance
  }

  static get crypto(): CryptoService {
    return CryptoService.instance
  }

  static get lfa(): typeof auth {
    return auth
  }
}

export {
  SigChain
}