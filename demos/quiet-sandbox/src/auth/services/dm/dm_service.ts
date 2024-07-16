/**
 * Handles DM/Group DM-related chain operations
 */

import { createHash } from "crypto"
import { BaseChainService } from "../base_service.js"
import { Keyset } from "@localfirst/auth"
import { UserService } from "../members/user_service.js"

class DMService extends BaseChainService {
  protected static instance: DMService | undefined
  private dmMap: Map<string, string[]> = new Map()

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

  // TODO: incorporate persistence
  public create(memberIds: string[]): string {
    // this is the ID that will be used for storage and mapping purposes
    const id = DMService.getDmId(memberIds)

    if (!this.dmMap.has(id)) {
      this.dmMap.set(id, memberIds)
    }

    return id
  }

  public getDmKeysById(id: string): Keyset[] {
    if (!this.dmMap.has(id)) {
      throw new Error(`No DM mapping was found for id ${id}`)
    }

    const memberIds = this.dmMap.get(id)!
    return UserService.getInstance().getPublicKeysForMembersById(memberIds, { includeRemoved: false, throwOnMissing: false })
  }

  private static getDmId(memberIds: string[]): string {
    const dmId = createHash('md5').update(memberIds.toString()).digest('hex')
    return `priv_dm_${dmId}`
  }
}

export {
  DMService
}