/**
 * Handles DM/Group DM-related chain operations
 */

import { createHash } from "crypto";
import { GeneratedDMRoleName } from "./types.js";

class DMUtils {
  private constructor() {}

  public static getDmRoleName(memberIds: string[]): GeneratedDMRoleName {
    const dmId = createHash('md5').update(memberIds.toString()).digest('hex')
    return {
      dmId,
      roleName: DMUtils.getDmRoleNameFromId(dmId)
    }
  }

  public static getDmRoleNameFromId(dmId: string): string {
    return `priv_dm_${dmId}`
  }
}

export {
  DMUtils
}