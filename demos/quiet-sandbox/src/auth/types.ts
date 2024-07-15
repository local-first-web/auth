import { DeviceWithSecrets, UserWithSecrets } from "@localfirst/auth"
import { SigChain } from "./chain.js"

export type CreatedChain = {
  sigChain: SigChain
  initialUser: UserWithSecrets
}

export type GeneratedUser = {
  user: UserWithSecrets
  initialDevice: DeviceWithSecrets
}