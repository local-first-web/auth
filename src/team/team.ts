import { EventEmitter } from 'events'
import { chain, PartialLinkBody, SignatureChain, validate } from '../chain'
import { ContextWithSecrets } from '../context'
import {
  deriveKeys,
  KeysetWithSecrets,
  PublicKeyset,
  randomKey,
  redactKeys,
} from '../keys'
import { Member } from '../member'
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
  RevokeMemberPayload,
  RevokeRolePayload,
  AddRolePayload,
  AddMemberRolePayload,
} from './types'

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
    return this.state.members.find(m => m.userName === userName) !== undefined
  }

  public add = (user: User, roles: string[] = []) => {
    const { userName } = user
    if (this.has(userName)) throw new Error(`Member ${userName} already exists`)
    const payload: AddMemberPayload = { user, roles }
    this.dispatch({ type: linkType.ADD_MEMBER, payload })
  }

  public invite = (userName: string) => {}

  public remove = (userName: string) => {
    if (this.has(userName)) throw new Error(`Member ${userName} already exists`)
    this.removeMember(userName)
  }

  public members(): WrappedMember[]
  public members(userName: string): WrappedMember

  public members(name?: string): WrappedMember | WrappedMember[] {
    const wrap = (member: Member): WrappedMember => {
      const { userName } = member
      return {
        ...member,

        addRole: (roleName: string) => {
          const payload = { userName, roleName } as AddMemberRolePayload
          this.dispatch({ type: linkType.ADD_MEMBER_ROLE, payload })
        },

        removeRole: (roleName: string) => {
          const payload = { userName, roleName } as RevokeRolePayload
          this.dispatch({ type: linkType.REVOKE_MEMBER_ROLE, payload })
        },

        hasRole: (role: string) => member.roles.includes(role),

        permissions: () => {
          // TODO
          return []
        },

        hasPermission: (permission: string) => {
          // TODO
          return false
        },
      }
    }

    if (name === undefined) {
      return this.state.members.map(wrap)
    } else {
      const result = this.state.members.find(m => m.userName === name)
      if (!result) throw new Error(`Member ${name} was not found`)
      return wrap(result)
    }
  }

  public roles = {
    has: (roleName: string) => {
      return this.state.roles.find(r => r.name === roleName) !== undefined
    },

    add: (roleName: string) => {
      if (this.roles.has(roleName))
        throw new Error(`Role ${roleName} already exists`)
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

    // add root member
    this.add(user, ['admin'])

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

  private removeMember(userName: string) {
    const payload: RevokeMemberPayload = { userName }
    this.dispatch({ type: linkType.REVOKE_MEMBER, payload })
  }

  private dispatch(link: PartialLinkBody) {
    this.chain = chain.append(this.chain, link, this.context)
    // update state
    this.updateState()
  }
}

interface WrappedMember extends Member {
  addRole(role: string): void
  removeRole(role: string): void
  hasRole(role: string): boolean
  permissions(): string[]
  hasPermission(permission: string): boolean
}
