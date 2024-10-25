/**
 * Handles user-related chain operations
 */

//import { KeyMap } from '../../../../../../packages/auth/dist/team/selectors/keyMap.js'
import { BaseChainService } from '../baseService.js'
import { ProspectiveUser, MemberSearchOptions, DEFAULT_SEARCH_OPTIONS } from './types.js'
import * as lfa from '@localfirst/auth'
import { SigChain } from '../../chain.js'
import { DeviceService } from './deviceService.js'
import { InviteService } from '../invites/inviteService.js'

class UserService extends BaseChainService {
  public static init(sigChain: SigChain): UserService {
    return new UserService(sigChain)
  }

  /**
   * Generates a brand new QuietUser instance with an initial device from a given username
   * 
   * @param name The username
   * @param id Optionally specify the user's ID (otherwise autogenerate)
   * @returns New QuietUser instance with an initial device
   */
  public static create(name: string, id?: string, deviceName?: string): lfa.LocalUserContext {
    const user: lfa.UserWithSecrets = lfa.createUser(name, id)
    const device: lfa.DeviceWithSecrets = DeviceService.generateDeviceForUser(user.userId, deviceName)

    return {
      user,
      device
    }
  }

  public static createFromInviteSeed(name: string, seed: string, deviceName?: string): ProspectiveUser {
    const context = this.create(name, undefined, deviceName)
    const inviteProof = InviteService.generateProof(seed)
    const publicKeys = UserService.redactUser(context.user).keys

    return {
      context,
      inviteProof,
      publicKeys
    }
  }

  public getAllMembers(): lfa.Member[] {
    return this.sigChain.team.members()
  }

  public getMembersById(memberIds: string[], options: MemberSearchOptions = DEFAULT_SEARCH_OPTIONS): lfa.Member[] {
    if (memberIds.length === 0) {
      return []
    }

    return this.sigChain.team.members(memberIds, options)
  }

  public static redactUser(user: lfa.UserWithSecrets): lfa.User {
    return lfa.redactUser(user)
  }
}

export {
  UserService
}
