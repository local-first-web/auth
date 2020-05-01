export type UnixTimestamp = number
export type Utf8 = string
export type Base64 = string
export type SemVer = string
export type Key = Utf8 | Uint8Array
export type Payload = Base64 | Uint8Array | object
export type Message = Base64 | Uint8Array

export type Base64Keypair = {
  publicKey: Base64
  secretKey: Base64
}
