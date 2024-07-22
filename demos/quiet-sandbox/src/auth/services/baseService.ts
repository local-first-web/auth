import { SigChain } from "../chain.js";
import { SigChainManager } from "../chainManager.js";

class BaseChainService {
  protected static _instance: BaseChainService | undefined

  protected constructor() {}

  public static init(...params: any[]): BaseChainService {
    throw new Error('init not implemented')
  }

  public static get instance(): BaseChainService {
    throw new Error('getInstance not implemented')
  }

  get activeSigChain(): SigChain {
    return SigChainManager.instance.getActiveChain()
  }
}

export {
  BaseChainService
}