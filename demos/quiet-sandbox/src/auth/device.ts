/**
 * Handles device-related chain operations
 */

import * as auth from "@localfirst/auth"
import getMAC from "getmac"

class DeviceUtils {
  private constructor() {}

  /**
   * Generate a brand new QuietDevice for a given User ID
   * 
   * @param userId User ID that this device is associated with
   * @returns A newly generated QuietDevice instance
   */
  public static generateDeviceForUser(userId: string): auth.DeviceWithSecrets {
    const params = {
      userId,
      deviceName: DeviceUtils.determineDeviceName()
    }

    return auth.createDevice(params)
  }

  /**
   * Get an identifier for the current device
   * 
   * @returns Formatted MAC address of the current device
   */
  public static determineDeviceName(): string {
    const mac = getMAC()
    return mac.replaceAll(':','')
  }

  public static redactDevice(device: auth.DeviceWithSecrets): auth.Device {
    return auth.redactDevice(device)
  }
}

export {
  DeviceUtils
}