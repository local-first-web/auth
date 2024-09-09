import * as Auth from '@localfirst/auth'
import { SigChain } from '../auth/chain.js'


export class LocalStorage {
  private authContext: Auth.Context | null
  private context: Auth.LocalUserContext | null
  private sigChain: SigChain | null

  constructor() {        
      this.authContext = null
      this.context = null
      this.sigChain = null
  }

public setAuthContext(context: Auth.Context) {
  this.authContext = context
}

public getAuthContext(): Auth.Context | null {
  return this.authContext
}

public setSigChain(sigChain: SigChain) {
  this.sigChain = sigChain
}

public setContext(context: Auth.LocalUserContext) {
  this.context = context
}

public getSigChain(): SigChain | null {
  return this.sigChain
}

public getContext(): Auth.LocalUserContext | null {
  return this.context
}
}