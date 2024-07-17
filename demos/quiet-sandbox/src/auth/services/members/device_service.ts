/**
 * Handles device-related chain operations
 */

import getMAC from "getmac"
import { BaseChainService } from "../base_service.js"
import { Device, DeviceWithSecrets } from "@localfirst/auth"
import { SigChain } from "auth/chain.js"

class DeviceService extends BaseChainService {
  protected static _instance: DeviceService | undefined

  public static init(): DeviceService {
    if (DeviceService._instance == null) {
      DeviceService._instance = new DeviceService() 
    }

    return DeviceService.instance
  }

  /**
   * Generate a brand new QuietDevice for a given User ID
   * 
   * @param userId User ID that this device is associated with
   * @returns A newly generated QuietDevice instance
   */
  public generateDeviceForUser(userId: string): DeviceWithSecrets {
    const params = {
      userId,
      deviceName: DeviceService.determineDeviceName()
    }

    return SigChain.lfa.createDevice(params)
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

  public static redactDevice(device: DeviceWithSecrets): Device {
    return SigChain.lfa.redactDevice(device)
  }

  public static get instance(): DeviceService {
    if (DeviceService._instance == null) {
      throw new Error(`DeviceService hasn't been initialized yet!  Run init() before accessing`)
    }

    return DeviceService._instance
  }
}

export {
  DeviceService
}