import { EventEmitter } from 'events'
import { chain, PartialLinkBody, SignatureChain, validate } from '../chain'
import { ContextWithSecrets } from '../context'
import { deriveKeys, KeysetWithSecrets, randomKey, redactKeys } from '../keys'
import { Member } from '../member'
import { redactUser, User } from '../user'
import { reducer } from './reducer'
import {
  AddMemberPayload,
  ExistingTeamOptions,
  exists,
  linkType,
  NewTeamOptions,
  RevokeMemberPayload,
  RootPayload,
  TeamOptions,
} from './types'
import { TeamState } from './teamState'
import * as selectors from './selectors'

export class Team extends EventEmitter {
  constructor(options: TeamOptions) {
    super()

    this.context = options.context

    if (exists(options)) this.loadChain(options)
    else this.create(options)
  }

  // public API

  public get teamName() {
    return this.state.teamName
  }

  public save = () => {
    return JSON.stringify(this.chain)
  }

  public has = (userName: string) => {
    return selectors.hasMember(this.state, userName)
  }

  public add = (user: User, roles: string[] = []) => {
    const payload: AddMemberPayload = { user, roles }
    this.dispatch({ type: linkType.ADD_MEMBER, payload })
  }

  public remove = (userName: string) => {
    // TODO these error checks belong on the chain
    // look up the user to ensure it exists
    // const user = this.members(userName)
    const payload: RevokeMemberPayload = { userName }
    this.dispatch({ type: linkType.REVOKE_MEMBER, payload })
  }

  public members(): Member[]
  public members(userName: string): Member

  public members(userName?: string): Member | Member[] {
    if (userName === undefined) return this.state.members
    else return selectors.getMember(this.state, userName)
  }

  public memberHasRole(userName: string, role: string) {
    return selectors.memberHasRole(this.state, userName, role)
  }

  public memberIsAdmin(userName: string) {
    return selectors.memberIsAdmin(this.state, userName)
  }

  public invite = (userName: string) => {
    // TODO
  }

  public roles = {
    has: (roleName: string) => {
      return this.state.roles.find(r => r.name === roleName) !== undefined
    },

    add: (roleName: string) => {
      if (this.roles.has(roleName))
        throw new Error(`A role called '${roleName}' already exists`)
    },

    remove: (roleName: string) => {},

    list: () => {
      return this.state.roles
    },
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
    const initialState: TeamState = {
      teamName: '',
      members: [],
      roles: [],
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

  public dispatch(link: PartialLinkBody) {
    this.chain = chain.append(this.chain, link, this.context)
    // update state
    this.updateState()
  }
}
