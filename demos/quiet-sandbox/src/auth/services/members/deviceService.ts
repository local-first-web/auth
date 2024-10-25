/**
 * Handles device-related chain operations
 */

import getMAC from "getmac"
import { BaseChainService } from "../baseService.js"
import * as lfa from "@localfirst/auth"
import { SigChain } from "../../chain.js"

class DeviceService extends BaseChainService {
  public static init(sigChain: SigChain): DeviceService {
    return new DeviceService(sigChain)
  }

  /**
   * Generate a brand new QuietDevice for a given User ID
   * 
   * @param userId User ID that this device is associated with
   * @returns A newly generated QuietDevice instance
   */
  public static generateDeviceForUser(userId: string, deviceName?: string): lfa.DeviceWithSecrets {
    const params = {
      userId,
      deviceName: deviceName != null ? deviceName : DeviceService.determineDeviceName()
    }

    return lfa.createDevice(params)
  }

  /**
   * Get an identifier for the current device
   * 
   * @returns Formatted MAC address of the current device
   */
  // ISLA: We probably want to rethink how we generate device names
  public static determineDeviceName(): string {
    const mac = getMAC()
    return mac.replaceAll(':','')
  }

  public static redactDevice(device: lfa.DeviceWithSecrets): lfa.Device {
    return lfa.redactDevice(device)
  }
}

export {
  DeviceService
}
