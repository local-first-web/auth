/**
 * Manages the chain(s) and makes them accesible across the application
 */

import { SigChain } from "./chain.js";

class SigChainManager {
  private chains: Map<string, SigChain> = new Map()
  private activeChainTeamName: string | undefined
  public static readonly instance: SigChainManager = new SigChainManager()
  
  private constructor() {}

  public getActiveChain(): SigChain {
    if (this.activeChainTeamName == null) {
      throw new Error(`No active chain found!`)
    }

    return this.getChainByTeamName(this.activeChainTeamName)
  }

  public setActiveChain(teamName: string): SigChain {
    if (!this.chains.has(teamName)) {
      throw new Error(`No chain found for team ${teamName}, can't set to active!`)
    }

    this.activeChainTeamName = teamName
    return this.getActiveChain()
  }

  public addChain(teamName: string, chain: SigChain, setActive: boolean): boolean {
    if (this.chains.has(teamName)) {
      throw new Error(`Chain for team ${teamName} already exists`)
    }

    this.chains.set(teamName, chain)
    if (this.activeChainTeamName == null || setActive) {
      this.activeChainTeamName = teamName
      return true
    }

    return false
  }

  public deleteChain(teamName: string): boolean {
    if (!this.chains.has(teamName)) {
      throw new Error(`No chain found for team ${teamName} to delete!`)
    }

    this.chains.delete(teamName)
    if (this.activeChainTeamName === teamName) {
      return true
    }

    return false
  }

  private getChainByTeamName(teamName: string): SigChain {
    if (!this.chains.has(teamName)) {
      throw new Error(`No chain found for team ${teamName}!`)
    }

    return this.chains.get(teamName)!
  }
}

export {
  SigChainManager
}