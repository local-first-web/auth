import { SigChain } from "../chain.js";
import { SigChainManager } from "../chain_manager.js";

class BaseChainService {
  protected static instance: BaseChainService | undefined

  protected constructor() {}

  public static init(...params: any[]): BaseChainService {
    throw new Error('init not implemented')
  }

  public static getInstance(): BaseChainService {
    throw new Error('getInstance not implemented')
  }

  protected getChain(): SigChain {
    return SigChainManager.getInstance().getActiveChain()
  }
}

export {
  BaseChainService
}