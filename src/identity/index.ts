import { REJECT_IDENTITY, ACCEPT_IDENTITY } from '/message'

export * from '/identity/claim'
export * from '/identity/challenge'
export * from '/identity/prove'
export * from '/identity/verify'

export const reject = () => REJECT_IDENTITY
export const accept = () => ACCEPT_IDENTITY
