/**
 * Handles channel-related chain operations
 */

class ChannelUtils {
  private constructor() {}

  public static getPrivateChannelRoleName(channelName: string): string {
    return `priv_chan_${channelName}`
  }
}

export {
  ChannelUtils
}