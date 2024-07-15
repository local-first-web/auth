/**
 * Handles generating the chain and aggregating all chain operations
 */

import * as auth from '@localfirst/auth'
import { CreatedChain } from './types.js'
import { UserUtils } from './user.js'

class SigChain {
  private team: auth.Team

  private constructor(team: auth.Team) {
    this.team = team
  }

  /**
   * Create a brand new SigChain with a given name and also generate the initial user with a given name
   * 
   * @param teamName Name of the team we are creating
   * @param username Username of the initial user we are generating
   */
  public static create(teamName: string, username: string): CreatedChain {
    const {
      user,
      initialDevice
    } = UserUtils.create(username)
    const context: auth.LocalUserContext = { 
      user, 
      device: initialDevice
    }
    const team: auth.Team = auth.createTeam(teamName, context)
    const sigChain = new SigChain(team)

    return {
      sigChain,
      initialUser: user
    }
  }

  public getTeam(): auth.Team {
    return this.team
  }

  public getMembers(): auth.Member[] {
    return this.team.members()
  }

  public getTeamGraph(): auth.TeamGraph {
    return this.team.graph
  }
}

export {
  SigChain
}