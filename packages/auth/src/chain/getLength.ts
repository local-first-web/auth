import { SignatureChain } from '@/chain/types'

export const getLength = (chain: SignatureChain<any>) => Object.keys(chain.links).length
