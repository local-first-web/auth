import { EventEmitter } from 'events'
import { chain, PartialLinkBody, SignatureChain, validate } from '../chain'
import { ContextWithSecrets } from '../context'
import {
  deriveKeys,
  KeysetWithSecrets,
  randomKey,
  redactKeys,
  PublicKeyset,
} from '../keys'
import { redactUser, User } from '../user'
import { reducer } from './reducer'
import {
  AddMemberPayload,
  ExistingTeamOptions,
  exists,
  linkType,
  NewTeamOptions,
  RootPayload,
  TeamOptions,
  TeamState,
  Member,
} from './types'

export class Team extends EventEmitter {
  constructor(options: TeamOptions) {
    super()

    this.context = options.context

    if (exists(options)) this.loadChain(options)
    else this.create(options)
  }

  // public API

  public get name() {
    return this.state.name
  }

  public save = () => {
    return JSON.stringify(this.chain)
  }

  public add = (name: string, keys: PublicKeyset) => {
    if (this.members(name)) throw new Error(`Member ${name} already exists`)
    this.addMember({ name, keys })
  }

  public invite = (name: string) => {}

  public remove = (name: string) => {}

  public members(): Member[]
  public members(name: string): Member
  public members(name?: string): Member | Member[] {
    if (name === undefined) {
      return this.state.members
    } else {
      const result = this.state.members.find(m => m.name === name)
      if (!result) throw new Error(`Member ${name} was not found`)
      return result
    }
  }

  public roles = {
    add: (name: string) => {},
    remove: (name: string) => {},
    list: () => {},
  }

  // private properties

  private chain: SignatureChain
  private context: ContextWithSecrets
  private state: TeamState

  // private functions

  private validateChain() {
    const validation = validate(this.chain)
    if (!validation.isValid) throw validation.error
  }

  private updateState = () => {
    this.validateChain()
    const initialState = {
      name: '',
      members: [],
      roles: ['admin'],
    }
    this.state = this.chain.reduce<TeamState>(reducer, initialState)
  }

  private create(options: NewTeamOptions) {
    // redact user's secret keys, since this will be written into the public chain
    const user = redactUser(options.context.user)

    // the team secret will never be stored in plaintext, only encrypted into individual lockboxes
    const teamSecret = randomKey()
    const teamKeys = deriveKeys(teamSecret)

    // create root link
    this.initializeChain(options.teamName, teamKeys, user)

    // add root member
    this.addMember(user, ['admin'])

    // this.addLockbox()
  }

  private loadChain(options: ExistingTeamOptions) {
    this.chain = options.source
    this.updateState()
  }

  private initializeChain(
    teamName: string,
    teamKeys: KeysetWithSecrets,
    foundingMember: User
  ) {
    const publicKeys = redactKeys(teamKeys)
    const payload: RootPayload = {
      teamName,
      publicKeys,
      foundingMember,
    }
    this.chain = []
    this.dispatch({ type: linkType.ROOT, payload })
  }

  private addMember(user: User, roles: string[] = []) {
    const payload: AddMemberPayload = { user, roles }
    this.dispatch({ type: linkType.ADD_MEMBER, payload })
  }

  private addMemberRole() {}

  private dispatch(link: PartialLinkBody) {
    this.chain = chain.append(this.chain, link, this.context)
    // update state
    this.updateState()
  }
}
