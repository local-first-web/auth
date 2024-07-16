/**
 * Handles DM/Group DM-related chain operations
 */

import { BaseChainService } from "../base_service.js"

class DMService extends BaseChainService {
  protected static instance: DMService | undefined

  public static init(): DMService {
    if (DMService.instance == null) {
      DMService.instance = new DMService() 
    }

    return DMService.instance
  }

  public static getInstance(): DMService {
    if (DMService.instance == null) {
      throw new Error(`DMService hasn't been initialized yet!  Run init() before accessing`)
    }

    return DMService.instance
  }

}

export {
  DMService
}