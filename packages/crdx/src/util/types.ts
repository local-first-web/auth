export type { Base58, Utf8, Hash, Payload } from '@localfirst/crypto'

export type UnixTimestamp = number & { _unixTimestamp: false }

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<T>
