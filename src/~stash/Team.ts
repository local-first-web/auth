// import { EventEmitter } from 'events'
// import { signatures } from './lib'
// import { LocalUser } from './LocalUser'
// import {
//   LinkBody,
//   LinkType,
//   RootLink,
//   Member,
//   SignatureChain,
//   SignedLink,
//   Device,
// } from './types'

// export class Team extends EventEmitter {
//   constructor(options: TeamOptions) {
//     super()
//     const { name, currentUser, source, secureStorage } = options

//     this.name = name
//     this.signatureChain = []
//     this.secureStorage = secureStorage

//     if (!source) this.create(currentUser)
//     else this.load(source)
//   }

//   public name: string
//   public secureStorage: any // TODO
//   public rootUser?: Member
//   public signatureChain: SignatureChain

//   private create(currentUser: string) {
//     const localUser = new LocalUser({
//       name: currentUser,
//       secureStorage: this.secureStorage,
//     })
//     this.rootUser = {
//       name: localUser.name,
//       signingKey: localUser.keys.signature.publicKey,
//       encryptionKey: localUser.keys.asymmetric.publicKey,
//       generation: localUser.keys.generation,
//     }

//     const rootLink: RootLink = {
//       type: LinkType.root,
//       payload: {
//         team: {
//           name: this.name,
//           rootUser: this.rootUser,
//         },
//       },

//       //context
//       user: this.rootUser.name, // TODO: this needs to be the current user from ambient context
//       // TODO: device
//       // TODO: client
//       timestamp: new Date().getTime(),

//       prev: null,
//       index: 0,
//     }
//     const signedLink = this.signLink(rootLink)
//     this.addLink(signedLink)
//   }

//   private signLink(body: LinkBody) {
//     const { name, keys } = this.rootUser // TODO: this needs to be the current user from ambient context
//     const { publicKey, secretKey } = keys.signature

//     const signature = signatures.sign(body, secretKey)
//     return {
//       body,
//       signed: {
//         name,
//         signature,
//         key: publicKey,
//       },
//     }
//   }

//   private addLink(link: SignedLink) {
//     this.signatureChain.push(link)
//   }

//   private load(source: string | object) {
//     console.log(source)
//     // TODO
//   }

//   public members = {
//     invite: () => {},
//     accept: () => {},
//     remove: () => {},
//     list: () => {},
//   }

//   public roles = {
//     create: () => {},
//     addUser: () => {},
//     removeUser: () => {},
//     isAdmin: () => {},
//     check: () => {},
//     remove: () => {},
//     list: () => {},
//   }

//   public crypto = {
//     asymmetric: {
//       encrypt: () => {},
//       decrypt: () => {},
//     },

//     symmetric: {
//       encrypt: () => {},
//       decrypt: () => {},
//     },

//     signature: {
//       sign: () => {},
//       verify: () => {},
//     },
//   }
// }

// export interface Context {
//   currentUser: LocalUser
//   device: Device
// }

// export interface TeamOptions {
//   context: Context
//   name: string
//   secureStorage?: any // TODO
//   source?: string | object // JSON or instantiated object
// }
