/// <reference types="node" />

declare module 'isomorphic-crypto' {
  import crypto from 'crypto'
  declare const createHmac = crypto.createHmac
  declare const createHash = crypto.createHash
}
