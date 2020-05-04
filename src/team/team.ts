import { ContextWithSecrets, Context } from '../context'
import { EventEmitter } from 'events'
import { redactSecrets } from '../keys'
import * as chain from '../chain'
import { SignatureChain, validate } from '../chain'

export class Team extends EventEmitter {
  constructor(options: TeamOptions) {
    super()
    this.context = options.context
    if (isExistingTeam(options)) this.load(options)
    else this.create(options)

    this.state = this.extractState()
  }

  // public properties

  public chain: SignatureChain

  // public functions

  public get name() {
    return this.state.name
  }

  public save = () => {}

  public add = (_name: string) => {}
  public invite = (_name: string) => {}
  public remove = (_name: string) => {}
  public members = (_name?: string) => {
    if (_name === undefined) {
      // return all members
    } else {
      // return one member
    }
  }

  public roles = {
    add: (_name: string) => {},
    remove: (_name: string) => {},
    list: () => {},
  }

  // private properties

  public state: TeamState
  private context: ContextWithSecrets

  // private functions

  private extractState = (): TeamState => {
    return {
      name: '',
      members: [],
      roles: [],
    }
  }

  private create(options: NewTeamOptions) {
    // set root context
    const rootContext = {
      ...this.context,
      user: {
        ...this.context.user,
        keys: redactSecrets(this.context.user.keys),
      },
    }
    const payload = { name: options.name, rootContext }
    this.chain = chain.create(payload, this.context)
    this.state = this.extractState()
  }

  private load(options: ExistingTeamOptions) {
    this.chain = options.source
    // validate chain
    const validation = validate(this.chain)
    if (!validation.isValid) throw validation.error
    this.state = this.extractState()
  }
}

export interface TeamState {
  name: string
  rootContext?: Context
  members: string[]
  roles: string[]
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
