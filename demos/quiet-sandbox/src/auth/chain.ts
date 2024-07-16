/**
 * Handles generating the chain and aggregating all chain operations
 */

import * as auth from '@localfirst/auth'
import { LoadedSigChain } from './types.js'
import { UserService } from './services/members/user_service.js'

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
  public static create(teamName: string, username: string): LoadedSigChain {
    const context = UserService.getInstance().create(username)
    const team: auth.Team = auth.createTeam(teamName, context)
    const sigChain = new SigChain(team)
    sigChain.persist()

    return {
      sigChain,
      context
    }
  }

  // TODO: persist to storage
  public persist() {
    this.team.save()
  }

  // TODO: pull user context from storage and then pull team from storage
  // private load(): LoadedSigChain {
  //   
  // }

  public getTeam(): auth.Team {
    return this.team
  }

  public getTeamGraph(): auth.TeamGraph {
    return this.team.graph
  }
}

export {
  SigChain
}