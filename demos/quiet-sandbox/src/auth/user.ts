/**
 * Handles user-related chain operations
 */

import * as auth from '@localfirst/auth'
import { DeviceUtils } from './device.js'

class UserUtils {
  private constructor() {}

  /**
   * Generates a brand new QuietUser instance with an initial device from a given username
   * 
   * @param name The username
   * @param id Optionally specify the user's ID (otherwise autogenerate)
   * @returns New QuietUser instance with an initial device
   */
  public static create(name: string, id?: string): auth.LocalUserContext {
    const user: auth.UserWithSecrets = auth.createUser(name, id)
    const device: auth.DeviceWithSecrets = DeviceUtils.generateDeviceForUser(user.userId)

    return {
      user,
      device
    }
  }

  public static redactUser(user: auth.UserWithSecrets): auth.User {
    return auth.redactUser(user)
  }
}

export {
  UserUtils
}