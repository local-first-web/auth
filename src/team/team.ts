import { EventEmitter } from 'events'
import * as chain from '../chain'
import { SignatureChain, validate } from '../chain'
import { ContextWithSecrets } from '../context'
import { redactSecrets } from '../keys'
import { reducer } from './reducer'
import {
  ExistingTeamOptions,
  isExistingTeam,
  NewTeamOptions,
  RootLinkPayload,
  TeamOptions,
  TeamState,
} from './types'

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
    this.validate()
    const initialState = {
      name: '',
      members: [],
      roles: [],
    }
    return this.chain.reduce<TeamState>(reducer, initialState)
  }

  private create(options: NewTeamOptions) {
    // set root context (excluding private keys, since this will be written into the public chain)
    const rootContext = {
      ...this.context,
      user: {
        ...this.context.user,
        keys: redactSecrets(this.context.user.keys),
      },
    }
    const payload = { name: options.name, rootContext } as RootLinkPayload
    this.chain = chain.create(payload, this.context)
    this.state = this.extractState()
  }

  private load(options: ExistingTeamOptions) {
    this.chain = options.source
    this.state = this.extractState()
  }

  private validate() {
    const validation = validate(this.chain)
    if (!validation.isValid) throw validation.error
  }
}
