import { Context, ContextWithSecrets } from 'context'
import { EventEmitter } from 'events'
import { redactSecrets } from 'keys'
import * as chain from '../chain'
import { SignatureChain, validate, InvalidResult } from '../chain'

export class Team extends EventEmitter {
  constructor(options: TeamOptions) {
    super()
    this.context = options.context
    if (isExistingTeam(options)) this.load(options)
    else this.create(options)
  }

  // public

  public name: string
  public rootContext: Context
  public signatureChain: SignatureChain

  public invite = (name: string) => {}
  public add = (name: string) => {}
  public remove = (name: string) => {}
  public save = () => {}

  public members = Object.assign(
    (name?: string) => {
      if (name) {
        // return one member
      } else {
        // return all members
      }
    },
    {
      get: (name: string) => {},
      invite: (name: string) => {},
    }
  )

  public roles = Object.assign(
    (name?: string) => {
      if (name) {
        // return one role
      } else {
        // return all roles
      }
    },
    {
      get: (name: string) => {},
      add: (name: string) => {},
      remove: (name: string) => {},
    }
  )

  // private

  private context: ContextWithSecrets

  private create(options: NewTeamOptions) {
    this.name = options.name
    // set root context
    this.rootContext = {
      ...this.context,
      user: {
        ...this.context.user,
        keys: redactSecrets(this.context.user.keys),
      },
    }
    const payload = { name: this.name, rootContext: this.rootContext }
    this.signatureChain = chain.create(payload, this.context)
  }

  private load(options: ExistingTeamOptions) {
    this.signatureChain = options.source
    // validate chain
    const validation = validate(this.signatureChain)
    if (!validation.isValid) throw validation.error
    // TODO: get team name
    this.name = ''
    // TODO: get root context
    this.rootContext = {
      user: { name: '', keys: { signature: '', encryption: '' } },
      device: { name: '', type: 0 },
    }
  }
}

export interface NewTeamOptions {
  name: string
  context: ContextWithSecrets
}

export interface ExistingTeamOptions {
  source: SignatureChain
  context: ContextWithSecrets
}

export type TeamOptions = NewTeamOptions | ExistingTeamOptions

// type guard
function isExistingTeam(options: TeamOptions): options is ExistingTeamOptions {
  return (options as ExistingTeamOptions).source !== undefined
}

interface FunctionsOnYourFunctions {
  (args?: any): any | void
  [key: string]: (...args: any[]) => any | void
}
