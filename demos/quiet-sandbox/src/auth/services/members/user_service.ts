/**
 * Handles user-related chain operations
 */

import * as auth from '@localfirst/auth'
import { DeviceService } from './device_service.js'
import { BaseChainService } from '../base_service.js'
import { MemberSearchOptions } from './types.js'

const DEFAULT_SEARCH_OPTIONS: MemberSearchOptions = { includeRemoved: false, throwOnMissing: true }

class UserService extends BaseChainService {
  protected static instance: UserService | undefined

  public static init(): UserService {
    if (UserService.instance == null) {
      UserService.instance = new UserService() 
    }

    return UserService.instance
  }

  public static getInstance(): UserService {
    if (UserService.instance == null) {
      throw new Error(`UserService hasn't been initialized yet!  Run init() before accessing`)
    }

    return UserService.instance
  }

  /**
   * Generates a brand new QuietUser instance with an initial device from a given username
   * 
   * @param name The username
   * @param id Optionally specify the user's ID (otherwise autogenerate)
   * @returns New QuietUser instance with an initial device
   */
  public create(name: string, id?: string): auth.LocalUserContext {
    const user: auth.UserWithSecrets = auth.createUser(name, id)
    const device: auth.DeviceWithSecrets = DeviceService.getInstance().generateDeviceForUser(user.userId)

    return {
      user,
      device
    }
  }

  public getAllMembers(): auth.Member[] {
    return this.getChain().getTeam().members()
  }

  public getMembersById(memberIds: string[], options: MemberSearchOptions = DEFAULT_SEARCH_OPTIONS): auth.Member[] {
    if (memberIds.length === 0) {
      return []
    }

    return this.getChain().getTeam().members(memberIds, options)
  }

  public getPublicKeysForMembersById(memberIds: string[], searchOptions: MemberSearchOptions = DEFAULT_SEARCH_OPTIONS): auth.Keyset[] {
    const members = this.getMembersById(memberIds, searchOptions)
    return members.map((member: auth.Member) => {
      return member.keys
    })
  }

  public static redactUser(user: auth.UserWithSecrets): auth.User {
    return auth.redactUser(user)
  }
}

export {
  UserService
}