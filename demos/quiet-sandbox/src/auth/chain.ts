/**
 * Handles generating the chain and aggregating all chain operations
 */

import * as lfa from '@localfirst/auth'
import { LoadedSigChain } from './types.js'
import { UserService } from './services/members/userService.js'
import { RoleService } from './services/roles/roleService.js'
import { ChannelService } from './services/roles/channelService.js'
import { DeviceService } from './services/members/deviceService.js'
import { InviteService } from './services/invites/inviteService.js'
import { CryptoService } from './services/crypto/cryptoService.js'
import { RoleName } from './services/roles/roles.js'
import { findAllByKeyAndReplace } from '../utils/utils.js'

class SigChain {
  private _team: lfa.Team
  private _users: UserService | null = null
  private _devices: DeviceService | null = null
  private _roles: RoleService | null = null
  private _channels: ChannelService | null = null
  private _invites: InviteService | null = null
  private _crypto: CryptoService | null = null

  private constructor(team: lfa.Team) {
    this._team = team
  }

  private static init(team: lfa.Team): SigChain {
    const sigChain = new SigChain(team)
    sigChain.initServices()

    return sigChain
  }

  /**
   * Create a brand new SigChain with a given name and also generate the initial user with a given name
   * 
   * @param teamName Name of the team we are creating
   * @param username Username of the initial user we are generating
   */
  public static create(teamName: string, username: string): LoadedSigChain {
    const context = UserService.create(username)
    const team: lfa.Team = lfa.createTeam(teamName, context)
    const sigChain = this.init(team)
    
    sigChain.roles.createWithMembers(RoleName.MEMBER, [context.user.userId])
    // sigChain.persist()

    return {
      sigChain,
      context
    }
  }

  public static createFromTeam(team: lfa.Team, context: lfa.LocalUserContext): LoadedSigChain {
    const sigChain = this.init(team)
    return {
     context,
     sigChain
    }
 }

  private initServices() {
    this._users = UserService.init(this)
    this._devices = DeviceService.init(this)
    this._roles = RoleService.init(this)
    this._channels = ChannelService.init(this)
    this._invites = InviteService.init(this)
    this._crypto = CryptoService.init(this)
  }

  // TODO: persist to storage
  public persist(): Uint8Array {
    return this.team.save() // this doesn't actually do anything but create the new state to save
  }

  get team(): lfa.Team {
    return this._team
  }

  get teamGraph(): lfa.TeamGraph {
    return this._team.graph
  }

  get minifiedTeamGraph(): lfa.TeamGraph {
    return findAllByKeyAndReplace(JSON.parse(JSON.stringify(this.teamGraph)), [
      {
        key: 'data',
        replace: {
          replacerFunc: (dataArray: any[]) => Buffer.from(dataArray).toString('base64')
        }
      }
    ])
  }

  get users(): UserService {
    return this._users!
  }

  get roles(): RoleService {
    return this._roles!
  }

  get channels(): ChannelService {
    return this._channels!
  }

  get devices(): DeviceService {
    return this._devices!
  }

  get invites(): InviteService {
    return this._invites!
  }

  get crypto(): CryptoService {
    return this._crypto!
  }
}

export {
  SigChain
}