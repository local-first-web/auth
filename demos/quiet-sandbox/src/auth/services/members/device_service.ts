/**
 * Handles device-related chain operations
 */

import * as auth from "@localfirst/auth"
import getMAC from "getmac"
import { BaseChainService } from "../base_service.js"

class DeviceService extends BaseChainService {
  protected static instance: DeviceService | undefined

  public static init(): DeviceService {
    if (DeviceService.instance == null) {
      DeviceService.instance = new DeviceService() 
    }

    return DeviceService.instance
  }

  public static getInstance(): DeviceService {
    if (DeviceService.instance == null) {
      throw new Error(`DeviceService hasn't been initialized yet!  Run init() before accessing`)
    }

    return DeviceService.instance
  }

  /**
   * Generate a brand new QuietDevice for a given User ID
   * 
   * @param userId User ID that this device is associated with
   * @returns A newly generated QuietDevice instance
   */
  public generateDeviceForUser(userId: string): auth.DeviceWithSecrets {
    const params = {
      userId,
      deviceName: DeviceService.determineDeviceName()
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
  DeviceService
}