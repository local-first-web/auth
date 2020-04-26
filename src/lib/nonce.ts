import nacl from 'tweetnacl'

export const nonceLength = nacl.box.nonceLength // = 24
export const newNonce = () => nacl.randomBytes(nonceLength)
